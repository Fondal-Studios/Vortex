// ESTADO DEL EDITOR (EH-08/09, docs/EDITOR_HUESPEDES.md §4.5): el diseño que se está editando, con deshacer/rehacer, snapshots y borrador. Módulo PURO (sin DOM, sin three):
// lo prueban `node:test` (tests/lab-estado.test.js) y lo usa la pantalla (laboratorio.js).
//
//   const E = crearEstado({ build, ctx: () => ({ evo, poseidas }), azar, almacen });
//   E.build · E.validacion · E.on(fn) → desuscribe · E.setProp('piernas', 1.1) · E.agregar('cuerno_curvo', 'cabeza') · E.patch(i, { pos: [0.01, 0, 0] }) · E.quitar(i)
//   E.undo() / E.redo() · E.begin('arrastre') … E.end() (un arrastre o una ráfaga de slider = UN paso) · E.crearSnapshot('antes de las alas') · E.restaurarSnapshot(n)
//
// REGLAS (cada una tiene su prueba):
//   · La build que se guarda aquí SIEMPRE es canónica (normalizar): imposible salir de los límites; un valor fuera de rango se recorta, no se guarda.
//   · Los topes duros se imponen al EDITAR (no solo al validar): una pieza que rompería el presupuesto de dibujo, la capacidad, los choques o la regla anti-oclusión NO se agrega
//     y el motivo vuelve en español. Escalar una pieza se detiene en el máximo que no rompe nada.
//   · El historial guarda 100 pasos; ir y volver 100 pasos devuelve la MISMA build (misma huella).
import { defecto, idNuevo, normalizar, validar, huella, limitesDe, PARTES, ANCLAS, costeRender, derivarStats, MENSAJES, TOPES_RENDER } from '../shared/host-build.js';
import { ajustarProp, limitarProp } from './lab-prop.js';

export const HISTORIAL_MAX = 100, SNAPSHOTS_MAX = 5, RAFAGA_MS = 700;
export const CLAVE_BORRADOR = 'vortex.lab.borrador.v1';
/** Códigos que BLOQUEAN una edición (si la edición los crea, no se hace). */
const BLOQUEA = new Set(['HB-09', 'HB-10', 'HB-11', 'HB-12', 'HB-13', 'HB-16']);
const copia = (x) => JSON.parse(JSON.stringify(x));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const firma = (e) => `${e.codigo}|${e.detalle || ''}|${e.pieza || ''}|${e.i ?? ''}|${e.j ?? ''}`;

export function crearEstado({ build = null, ctx = () => ({}), azar = Math.random, almacen = null, ahora = () => Date.now(), snaps = [] } = {}) {
  const C = () => { const c = ctx() || {}; return { evo: Number.isInteger(c.evo) ? c.evo : 0, poseidas: c.poseidas, calidad: 'low' }; };
  let cur = normalizar(build || { ...defecto(), id: idNuevo(azar), nombre: 'Mi Híbrido', meta: { creado: ahora(), editor: '1.0.0' } });
  let hist = [copia(cur)], idx = 0, grupo = null, ultima = { clave: '', t: 0 }, cache = null, snapshots = copia(snaps).slice(0, SNAPSHOTS_MAX), sucio = false;
  const oyentes = new Set();
  const emitir = (que = 'cambio') => { cache = null; sucio = true; for (const f of oyentes) { try { f(que); } catch (e) { console.warn('Laboratorio (oyente):', e.message); } } };

  function validacion() { return cache || (cache = (() => { const c = C(), v = validar(cur, c); return { ...v, stats: derivarStats(cur, c), render: costeRender(cur, 'low') }; })()); }
  function guardarPaso(next, clave) {
    next = normalizar(next); if (huella(next) === huella(cur)) { cur = next; return false; }
    cur = next;
    if (grupo) { grupo.cambio = true; return true; }
    const t = ahora();
    if (clave && ultima.clave === clave && t - ultima.t < RAFAGA_MS && idx === hist.length - 1 && idx > 0) hist[idx] = copia(cur);   // ráfaga (un slider): un solo paso
    else { hist = hist.slice(0, idx + 1); hist.push(copia(cur)); if (hist.length > HISTORIAL_MAX + 1) hist.shift(); idx = hist.length - 1; }
    ultima = { clave: clave || '', t };
    return true;
  }
  /** Aplica un cambio (si no hay cambio, no hace nada). */
  function cambiar(next, clave) { const hubo = guardarPaso(next, clave); if (hubo) emitir(); return hubo; }
  const nuevosBloqueos = (antes, despues) => { const a = new Set(antes.errores.filter((e) => BLOQUEA.has(e.codigo)).map(firma)); return despues.errores.filter((e) => BLOQUEA.has(e.codigo) && !a.has(firma(e))); };
  const mensajeDe = (e) => e.msg || MENSAJES[e.codigo] || 'No se puede hacer eso.';

  const E = {
    get build() { return cur; }, get validacion() { return validacion(); }, get ctx() { return C(); },
    get sucio() { return sucio; }, marcarLimpio() { sucio = false; },
    get snapshots() { return snapshots; },
    on(f) { oyentes.add(f); return () => oyentes.delete(f); },
    /** Reemplaza todo el diseño (cargar uno guardado, una plantilla…). `historia: false` empieza un historial nuevo. */
    cargar(raw, { historia = false } = {}) {
      const nb = normalizar(raw);
      if (historia) { cambiar(nb); return; }
      cur = nb; hist = [copia(cur)]; idx = 0; grupo = null; ultima = { clave: '', t: 0 }; snapshots = Array.isArray(raw && raw.snap) ? copia(raw.snap).slice(0, SNAPSHOTS_MAX) : []; sucio = false; emitir('carga'); sucio = false;
    },
    /** Agrupa varios cambios en UN paso (un arrastre del gizmo). */
    begin(clave = 'grupo') { if (!grupo) grupo = { clave, cambio: false, antes: copia(cur) }; },
    end() {
      if (!grupo) return; const g = grupo; grupo = null;
      if (g.cambio && huella(cur) !== huella(g.antes)) { hist = hist.slice(0, idx + 1); hist.push(copia(cur)); if (hist.length > HISTORIAL_MAX + 1) hist.shift(); idx = hist.length - 1; ultima = { clave: '', t: 0 }; }
      emitir();
    },
    get puedeUndo() { return idx > 0; }, get puedeRedo() { return idx < hist.length - 1; }, get pasos() { return { atras: idx, adelante: hist.length - 1 - idx }; },
    undo() { if (grupo) E.end(); if (idx <= 0) return false; idx--; cur = normalizar(hist[idx]); ultima = { clave: '', t: 0 }; emitir('undo'); return true; },
    redo() { if (grupo) E.end(); if (idx >= hist.length - 1) return false; idx++; cur = normalizar(hist[idx]); ultima = { clave: '', t: 0 }; emitir('redo'); return true; },

    /* ───── cuerpo ───── */
    /** Cambia UNA proporción. Si rompería una regla entre proporciones se detiene en el límite y lo dice. → { ok, tope } */
    setProp(k, v) { const r = ajustarProp(cur.prop, k, v); cambiar({ ...cur, prop: r.prop }, 'prop:' + k); return { ok: true, tope: r.tope, valor: r.prop[k] }; },
    setProps(prop) { cambiar({ ...cur, prop: limitarProp(prop) }, 'props'); },
    setNombre(n) { cambiar({ ...cur, nombre: n }, 'nombre'); },
    setPal(campo, hex) { cambiar({ ...cur, pal: { ...cur.pal, [campo]: hex } }, 'pal:' + campo); },
    setPaleta(pal) { cambiar({ ...cur, pal: { ...cur.pal, ...pal } }, 'paleta'); },
    setBase(campo, v) { cambiar({ ...cur, base: { ...cur.base, [campo]: v } }, 'base:' + campo); },

    /* ───── piezas ───── */
    /** ¿Se puede agregar? → { ok, motivo } sin tocar nada. */
    puedeAgregar(p, a) { const r = E._probarAgregar(p, a, {}); return { ok: r.ok, motivo: r.motivo || '' }; },
    _probarAgregar(p, a, o) {
      const d = PARTES[p], A = ANCLAS[a];
      if (!d || d.retirada) return { ok: false, motivo: 'Esa pieza no existe.' };
      if (!A || !d.anclas.includes(a)) return { ok: false, motivo: `«${d.nombre}» no se puede poner en ${A ? A.nombre.toLowerCase() : 'ese lugar'}.` };
      const c = C(); if (c.poseidas && !(c.poseidas instanceof Set ? c.poseidas.has(p) : c.poseidas.includes(p))) return { ok: false, motivo: `Todavía no tenés «${d.nombre}»: se consigue jugando.`, codigo: 'HB-06' };
      if (d.cat === 'funcional' && cur.partes.some((e) => e.p === p)) return { ok: false, motivo: `Ya tenés «${d.nombre}»: una pieza funcional cuenta una sola vez.` };
      const sinDer = a === 'manos' && !o.sim, sim = o.sim || (sinDer ? 'ninguna' : d.lados === 'par' ? 'espejo' : 'ninguna'), e = { p, a, sim, ...(A.lados === 2 && sim === 'ninguna' ? { l: sinDer ? 'izq' : (o.l || 'der') } : {}),   // la mano derecha lleva tu arma (HB-12): las garras empiezan en la izquierda
      t: { pos: o.pos || [0, 0, 0], rot: o.rot || [0, 0, 0], esc: o.esc || 1 }, c: { mat: o.mat || d.variantesMat[0], tinte: o.tinte || null } };
      const next = normalizar({ ...cur, partes: [...cur.partes, e] });
      if (next.partes.length !== cur.partes.length + 1) return { ok: false, motivo: 'No se pudo poner esa pieza.' };
      const antes = validar(cur, c), despues = validar(next, c), nuevos = nuevosBloqueos(antes, despues);
      if (nuevos.length) { const m = nuevos[0]; return { ok: false, codigo: m.codigo, motivo: mensajeDe(m) + (m.codigo === 'HB-11' ? ` Quitá otra pieza para hacer lugar.` : '') }; }
      return { ok: true, next, i: next.partes.length - 1 };
    },
    /** Pone una pieza en un ancla. → { ok, i, motivo } */
    agregar(p, a, o = {}) { const r = E._probarAgregar(p, a, o); if (!r.ok) return { ok: false, motivo: r.motivo, codigo: r.codigo }; cambiar(r.next); return { ok: true, i: r.i, motivo: '' }; },
    quitar(i) { if (!cur.partes[i]) return false; cambiar({ ...cur, partes: cur.partes.filter((_, k) => k !== i) }); return true; },
    /**
     * Cambia posición/giro/tamaño/simetría/material de una pieza. El valor se RECORTA a los límites de la pieza en su ancla; el tamaño se detiene donde no rompe el presupuesto.
     * `patch` = { pos?: [x,y,z], rot?: [x,y,z], esc?, sim?, l?, mat?, tinte?, a? }.  → { ok, tope: { pos:[bool,bool,bool], rot:[…], esc: bool }, motivo }
     */
    patch(i, patch, clave = '') {
      const e = cur.partes[i]; if (!e) return { ok: false, motivo: 'Esa pieza no existe.', tope: { pos: [false, false, false], rot: [false, false, false], esc: false } };
      const d = PARTES[e.p], c = C(), tope = { pos: [false, false, false], rot: [false, false, false], esc: false }; let motivo = '';
      let a = e.a; if (patch.a && patch.a !== e.a) { if (!d.anclas.includes(patch.a)) return { ok: false, motivo: `«${d.nombre}» no se puede poner en ese lugar.`, tope }; a = patch.a; }
      const lim = limitesDe(e.p, a), t = { pos: [...e.t.pos], rot: [...e.t.rot], esc: e.t.esc };
      if (patch.pos) for (let k = 0; k < 3; k++) if (patch.pos[k] !== undefined && Number.isFinite(patch.pos[k])) { const v = clamp(patch.pos[k], ...lim.pos[k]); tope.pos[k] = Math.abs(v - patch.pos[k]) > 1e-6; t.pos[k] = v; }
      if (patch.rot) for (let k = 0; k < 3; k++) if (patch.rot[k] !== undefined && Number.isFinite(patch.rot[k])) { const v = clamp(patch.rot[k], ...lim.rot[k]); tope.rot[k] = Math.abs(v - patch.rot[k]) > 1e-6; t.rot[k] = v; }
      if (patch.esc !== undefined && Number.isFinite(patch.esc)) { const v = clamp(patch.esc, ...lim.esc); tope.esc = Math.abs(v - patch.esc) > 1e-6; t.esc = v; }
      const ne = { ...e, a, t, ...(patch.sim ? { sim: patch.sim } : {}), ...(patch.l ? { l: patch.l } : {}), c: { mat: patch.mat ?? e.c.mat, tinte: patch.tinte === undefined ? e.c.tinte : patch.tinte } };
      if (patch.sim === 'espejo') delete ne.l;
      let next = normalizar({ ...cur, partes: cur.partes.map((x, k) => (k === i ? ne : x)) });
      // el tamaño no puede romper la regla anti-oclusión ni el presupuesto: se detiene en el último valor que sirve
      const antes = validar(cur, c); let des = validar(next, c), nuevos = nuevosBloqueos(antes, des);
      if (nuevos.length && (patch.esc !== undefined || patch.sim || patch.a)) {
        if (patch.esc !== undefined && !patch.sim && !patch.a) {
          let lo = e.t.esc, hi = t.esc; for (let n = 0; n < 12; n++) { const mid = (lo + hi) / 2, tt = normalizar({ ...cur, partes: cur.partes.map((x, k) => (k === i ? { ...ne, t: { ...ne.t, esc: mid } } : x)) }); if (nuevosBloqueos(antes, validar(tt, c)).length) hi = mid; else lo = mid; }
          ne.t = { ...ne.t, esc: lo }; tope.esc = true; motivo = 'Tope de tamaño: más grande taparía demasiado el cuerpo.'; next = normalizar({ ...cur, partes: cur.partes.map((x, k) => (k === i ? ne : x)) }); des = validar(next, c); nuevos = nuevosBloqueos(antes, des);
        }
        if (nuevos.length) return { ok: false, motivo: mensajeDe(nuevos[0]), tope };
      }
      if (tope.pos.some(Boolean)) motivo = motivo || 'Tope de posición: la pieza no puede ir más lejos.'; else if (tope.rot.some(Boolean)) motivo = motivo || 'Tope de giro.'; else if (tope.esc) motivo = motivo || 'Tope de tamaño.';
      cambiar(next, clave || (patch.pos || patch.rot || patch.esc !== undefined ? `pieza:${i}` : ''));
      return { ok: true, tope, motivo };
    },
    /** Quita todas las piezas y deja el cuerpo tal cual. */
    vaciarPiezas() { cambiar({ ...cur, partes: [] }); },

    /* ───── snapshots (hasta 5, dentro del propio diseño) ───── */
    crearSnapshot(etiqueta = '') {
      if (snapshots.length >= SNAPSHOTS_MAX) return { ok: false, motivo: `Ya tenés ${SNAPSHOTS_MAX} copias: borrá una para guardar otra.` };
      const n = normalizar(cur), et = String(etiqueta || `Copia ${snapshots.length + 1}`).replace(/[\u0000-\u001f<>&"'`]/g, '').trim().slice(0, 24) || `Copia ${snapshots.length + 1}`;
      snapshots = [...snapshots, { ...n, h: huella(n), etiqueta: et }]; emitir('snap'); return { ok: true, n: snapshots.length - 1 };
    },
    restaurarSnapshot(n) { const s = snapshots[n]; if (!s) return false; const { etiqueta, h, snap, ...b } = s; void etiqueta; void h; void snap; cambiar({ ...b, id: cur.id, nombre: cur.nombre }); return true; },
    borrarSnapshot(n) { if (!snapshots[n]) return false; snapshots = snapshots.filter((_, k) => k !== n); emitir('snap'); return true; },
    /** Diseño listo para GUARDAR (con sus snapshots). */
    paraGuardar() { return { ...normalizar(cur), snap: copia(snapshots) }; },

    /* ───── borrador (localStorage; puede fallar) ───── */
    guardarBorrador() { if (!almacen) return false; try { almacen.setItem(CLAVE_BORRADOR, JSON.stringify({ v: 1, t: ahora(), build: cur, snap: snapshots })); return true; } catch { return false; } },
    leerBorrador() { if (!almacen) return null; try { const o = JSON.parse(almacen.getItem(CLAVE_BORRADOR) || 'null'); return o && o.build ? { build: normalizar(o.build), snap: Array.isArray(o.snap) ? o.snap : [], t: Number(o.t) || 0 } : null; } catch { return null; } },
    borrarBorrador() { if (!almacen) return; try { almacen.removeItem(CLAVE_BORRADOR); } catch { /* nada */ } },
  };
  return E;
}

/** Texto en español del presupuesto de dibujo: { tris, llamadas, pctTris, pctLlamadas, restoTris, restoLlamadas, nivel: 'ok'|'aviso'|'tope' }. */
export function presupuestoDe(build) {
  const r = costeRender(build, 'low'), T = TOPES_RENDER, pct = Math.max(r.pctTris, r.pctLlamadas, r.materiales.length / T.materiales * 100, r.halos / T.halos * 100, r.cadenas / T.cadenas * 100, r.telas / T.telas * 100);
  return { ...r, restoTris: T.tris - r.tris, restoLlamadas: T.llamadas - r.llamadas, pct, nivel: r.excede || pct >= 100 ? 'tope' : pct >= 90 ? 'aviso' : 'ok' };
}
