// PANTALLA «LABORATORIO» (EH-06…EH-10, EH-13, EH-16; docs/EDITOR_HUESPEDES.md §4). Editor 3D del Híbrido Genómico: se ve el cuerpo REAL del juego, se tocan y arrastran sus partes,
// se deforman las proporciones, se colocan piezas en anclas y se ven los cambios en vivo. Vive como una pestaña de «Huéspedes» (menu-nav.js) y también se abre desde el Armero.
//   · ui.js llama: buildLaboratorioScreen(menu) una vez, showLaboratorio(menu) al entrar y hideLaboratorio(menu) al salir (libera todo el 3D).
//   · El estado (deshacer, topes, snapshots, borrador) es lab-estado.js; el 3D es lab-visor.js (se carga recién al abrir la pantalla); los datos/validación son host-build.js.
//   · Todo funciona con teclado y táctil: cada gizmo tiene su alternativa en botones y números, y la lista de piezas es una alternativa completa al visor.
import { crearEstado, presupuestoDe } from './lab-estado.js';
import { PROP_RANGOS, PROP_CLAVES, PROP_ES, PROP_BASICAS } from './lab-prop.js';
import { idNuevo, defecto, ANCLAS, PARTES, COSMETICAS, FUNCIONALES, ORDEN_ANCLAS, ACABADOS, PRESETS, TOPES_RENDER, limitesDe, derivarStats, decodificar, codificar, validar } from '../shared/host-build.js';
import { FINISHES } from '../shared/cosmetics.js';
import { guardarDiseno, borrarDiseno, elegirActivo, exportar, importar, comoSeConsigue, LAB_MAX_DISENOS, reglaObtencion } from '../sim/laboratorio-perfil.js';
import { PLANTILLAS, PLANTILLA_IDS, sugerir, reparar, completarSimetria, sugerirPaleta, explicar } from '../shared/host-build-sugeridor.js';
import { Equipo, saveEquipo } from './equipo.js';
import { setActivo } from './lab-activo.js';
import * as Perfil from './perfil.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f2 = (n, d = 2) => Number(n).toFixed(d).replace('.', ',');
const KEY_MODO = 'vortex.lab.modo.v1', KEY_VOLVER = 'vortex.lab.volver.v1';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const ssGet = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const ssSet = (k, v) => { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* nada */ } };
const PALETAS = [['Brasa', '#7a3a1c', '#2b2430', '#ff7a22'], ['Hielo', '#3a5a7a', '#1c2430', '#5ad2ff'], ['Veneno', '#3a6a2a', '#1c2a20', '#9aff4a'], ['Orquídea', '#7a2a6a', '#2a1c30', '#ff5ad8'], ['Oro viejo', '#7a6a2a', '#2a2620', '#ffd45a'], ['Ceniza', '#5a5a64', '#18181e', '#c8d0ff']];
const PIELES = [['Canela', '#8a5a3c'], ['Miel', '#c58c6a'], ['Cacao', '#5a3a28'], ['Marfil', '#e0b090'], ['Ébano', '#3a2a22']];
const CUERPOS = { jugador1: 'Cuerpo A', jugador2: 'Cuerpo B', jugador3: 'Cuerpo C', jugador4: 'Cuerpo D' };
const TAB_ES = { cuerpo: 'Cuerpo', piezas: 'Piezas', aspecto: 'Aspecto', datos: 'Datos' };
const EJES_ES = { dano: 'Daño', resistencia: 'Resistencia', movilidad: 'Movilidad', control: 'Control', utilidad: 'Utilidad', dificultad: 'Dificultad' };
const NOMBRE_PIEZA = (id) => (PARTES[id] ? PARTES[id].nombre : id);
const ANCLAS_USO = ORDEN_ANCLAS.filter((a) => Object.values(PARTES).some((p) => p.anclas.includes(a)));
const MODOS_ES = { mover: 'Mover', girar: 'Girar', escalar: 'Tamaño' };
const AYUDA_TECLAS = 'Teclas: Ctrl+Z deshacer · Ctrl+Y rehacer · S simetría · W mover · E girar · R tamaño · 1-7 cámaras · flechas mover la pieza (Mayús = más) · Supr quitar · Esc soltar';

export function buildLaboratorioScreen(menu) {
  const root = menu.root.querySelector('#laboratorio'); if (!root) return;
  root.classList.add('lb');
  root.innerHTML = `
    <button class="backbtn" type="button" aria-label="Volver al menú anterior"><span aria-hidden="true">‹</span> Volver</button>
    <h2 class="lb-sr">Editor Genómico: diseñá tu propio cuerpo</h2>
    <div class="lb-wrap">
      <section class="lb-stage" id="lbstage" aria-label="Visor 3D de tu Híbrido">
        <canvas id="lbcanvas" aria-label="Tu Híbrido en 3D: arrastrá para girar, pellizcá o usá la rueda para acercar. Todo lo que se hace acá también se puede hacer con las listas y los botones del panel." tabindex="0"></canvas>
        <div class="lb-cargando" id="lbcarga" role="status">Preparando el Editor Genómico…</div>
        <div class="lb-cams" id="lbcams" role="group" aria-label="Cámaras"></div>
        <div class="lb-medidor" id="lbmed" role="group" aria-label="Presupuesto de dibujo"></div>
        <div class="lb-aviso" id="lbaviso" role="status" aria-live="polite"></div>
        <div class="lb-sel" id="lbsel" hidden></div>
        <div class="lb-pista" id="lbpista"></div>
        <div class="lb-antes" id="lbantes" hidden>ANTES</div>
      </section>
      <aside class="lb-panel" aria-label="Editor">
        <header class="lb-cab">
          <label class="lb-nombre"><span class="lb-sr">Nombre del diseño</span><input id="lbnombre" class="lb-nav" type="text" maxlength="24" autocomplete="off" spellcheck="false" aria-label="Nombre del diseño"></label>
          <button class="lb-chip lb-nav" type="button" id="lbmodo" aria-pressed="false" title="Básico: lo esencial. Avanzado: todos los deslizadores, números por pieza y colores a mano."></button>
          <span class="lb-estado" id="lbestado" role="status"></span>
          <span class="lb-etiqueta" title="Este diseño es una creación tuya: no es uno de los Huéspedes oficiales">Creación del jugador</span>
        </header>
        <div class="lb-tabs" role="tablist" aria-label="Secciones del editor" id="lbtabs">${Object.entries(TAB_ES).map(([k, n]) => `<button class="lb-tab lb-nav" role="tab" type="button" id="lbtab-${k}" aria-controls="lbpanel" data-tab="${k}">${n}</button>`).join('')}</div>
        <div class="lb-body" id="lbpanel" role="tabpanel" tabindex="-1"></div>
        <footer class="lb-bar" role="toolbar" aria-label="Acciones">
          <button class="lb-btn lb-nav" type="button" id="lbundo" aria-label="Deshacer"><span aria-hidden="true">↶</span><i>Deshacer</i></button>
          <button class="lb-btn lb-nav" type="button" id="lbredo" aria-label="Rehacer"><span aria-hidden="true">↷</span><i>Rehacer</i></button>
          <button class="lb-btn lb-nav" type="button" id="lbcopias" aria-haspopup="dialog"><span aria-hidden="true">⧉</span><i>Copias</i></button>
          <button class="lb-btn lb-nav" type="button" id="lbdisenos" aria-haspopup="dialog"><span aria-hidden="true">▤</span><i>Diseños</i></button>
          <button class="lb-btn lb-nav lb-probar" type="button" id="lbprobar"><span aria-hidden="true">▶</span><i>Probar</i></button>
          <button class="lb-btn lb-nav lb-guardar" type="button" id="lbguardar"><span aria-hidden="true">✓</span><i>Guardar</i></button>
        </footer>
      </aside>
    </div>
    <div class="lb-dialogo" id="lbdialogo" role="dialog" aria-modal="true" aria-labelledby="lbdtitulo" hidden><div class="lb-dcaja"><h3 id="lbdtitulo"></h3><div id="lbdcuerpo"></div><button class="lb-btn lb-nav" type="button" id="lbdcerrar">Cerrar</button></div></div>`;
  const $ = (s) => root.querySelector(s);
  $('.backbtn').addEventListener('click', (e) => { e.stopPropagation(); menu.back(); });
  const L = menu.lb = {
    E: null, V: null, tab: 'cuerpo', avanzado: lsGet(KEY_MODO) === 'avanzado', sel: { ancla: null, lado: 'der', i: -1 }, gizmo: 'mover', cam: 'tres_cuartos', abierto: false, cargando: false, antes: null, antesBuild: null, ultimaMed: null,
    avisoT: 0, plantillaSemilla: 1, regionFoco: null, guardadoH: '', seleccionando: 0,
  };
  const lab = () => Perfil.perfil().lab;
  const ctxJ = () => { const p = Perfil.perfil(); return { evo: (p.evo && p.evo.laboratorio) | 0, poseidas: lab().piezas }; };
  const aviso = (txt, tipo = '') => { const el = $('#lbaviso'); el.textContent = txt; el.dataset.tipo = tipo; el.classList.toggle('on', !!txt); clearTimeout(L.avisoT); if (txt) L.avisoT = setTimeout(() => { el.classList.remove('on'); }, 2600); };
  const calidadVisor = () => { const q = new URLSearchParams(location.search).get('quality') || new URLSearchParams(location.search).get('lq'); if (['low', 'medium', 'high'].includes(q)) return q; const coarse = matchMedia('(pointer: coarse)').matches; return coarse || (window.__api && window.__api.level === 'low') ? 'low' : (window.__api && window.__api.level === 'high' ? 'high' : 'medium'); };

  /* ───────────────── estado y visor ───────────────── */
  function iniciarEstado() {
    const almacen = (() => { try { return localStorage; } catch { return null; } })();
    const E = crearEstado({ ctx: ctxJ, almacen });
    const borr = E.leerBorrador(), act = lab().slots.find((s) => s.id === lab().activo);
    if (borr) { E.cargar({ ...borr.build, snap: borr.snap }); aviso('Recuperamos tu borrador.', 'ok'); } else if (act) E.cargar(act); else E.cargar(E.build);
    L.guardadoH = act && !borr ? E.paraGuardar().h || '' : '';
    E.on((que) => { if (que === 'carga') { L.sel = { ancla: null, lado: 'der', i: -1 }; } sincronizar(que); });
    L.E = E; L.antesBuild = JSON.parse(JSON.stringify(E.build));
  }
  async function abrirVisor() {
    if (L.V || L.cargando) return; L.cargando = true; $('#lbcarga').hidden = false;
    try {
      const stage = $('#lbstage'), old = $('#lbcanvas'), nuevo = document.createElement('canvas'); nuevo.id = 'lbcanvas'; nuevo.tabIndex = 0; nuevo.setAttribute('aria-label', old.getAttribute('aria-label')); old.replaceWith(nuevo);   // un canvas nuevo por apertura (el contexto anterior se libera)
      const { crearVisor } = await import('./lab-visor.js');
      const V = await crearVisor(stage, { calidad: calidadVisor(), reducirMovimiento: matchMedia('(prefers-reduced-motion: reduce)').matches || !!(menu.settings && menu.settings.reducirGravedad), regionFoco: () => L.regionFoco, alListo: () => { $('#lbcarga').hidden = true; setTimeout(medir, 160); }, eventos: eventosVisor() });
      if (!V) return; if (!L.abierto) { V.dispose(); return; }
      L.V = V; V.setModo(L.tab === 'piezas' ? 'piezas' : 'cuerpo'); V.camara(L.cam, true); V.setBuild(L.E.build, { inmediato: true }); V.seleccionar({ ancla: L.sel.ancla, i: L.sel.i }); V.setGizmo(L.gizmo); window.__lab = { ...(window.__lab || {}), visor: V, estado: L.E, ui: L };
    } catch (e) { console.warn('Laboratorio: sin 3D —', e.message); $('#lbcarga').textContent = 'No se pudo preparar el visor 3D. Podés seguir editando con las listas y los botones.'; $('#lbcarga').hidden = false; }
    finally { L.cargando = false; }
  }
  function eventosVisor() {
    return {
      tapAncla: (a, lado) => { L.sel = { ancla: a, lado: lado === 'izq' ? 'izq' : 'der', i: -1 }; L.V && L.V.seleccionar({ ancla: a, i: -1 }); if (L.tab !== 'piezas') irTab('piezas'); else pintarPanel(); aviso(`Ancla: ${ANCLAS[a].nombre}. Elegí una pieza del catálogo.`); },
      tapPieza: (i) => seleccionarPieza(i),
      tapVacio: () => { if (L.sel.i >= 0 || L.sel.ancla) { L.sel = { ancla: null, lado: 'der', i: -1 }; L.V.seleccionar({}); pintarPanel(); } },
      tapRegion: (r) => { const k = { cabeza: 'cabeza', torso: 'torso', hombros: 'hombros', brazos: 'brazos', manos: 'manos', piernas: 'piernas', pies: 'pies' }[r]; if (k) enfocarSlider(k); },
      regionHover: () => {},
      deformar: (region, dy, fase) => deformar(region, dy, fase),
      gizmo: (modo, dato, fase) => gizmo(modo, dato, fase),
    };
  }
  function cerrarVisor() { if (L.V) { try { L.V.dispose(); } catch (e) { console.warn('Laboratorio: cierre del visor —', e.message); } L.V = null; if (window.__lab) window.__lab.visor = null; } }

  /* ───────────────── acciones del visor ───────────────── */
  const REGION_PROP = { cabeza: 'cabeza', torso: 'torso', hombros: 'hombros', brazos: 'brazos', manos: 'manos', piernas: 'piernas', pies: 'pies' };
  let defo = null;
  function deformar(region, dy, fase) {
    const k = REGION_PROP[region]; if (!k) return; if (fase === 'inicio') { defo = { k, v: L.E.build.prop[k], acc: 0 }; L.E.begin('deformar'); L.regionFoco = region; if (L.tab !== 'cuerpo') irTab('cuerpo'); aviso(`${PROP_ES[k]}: arrastrá hacia arriba o abajo.`); return; }
    if (fase === 'fin') { L.E.end(); defo = null; L.regionFoco = null; return; }
    if (!defo) return; const [a, b] = PROP_RANGOS[k]; defo.acc += dy * (b - a) / 160; const r = L.E.setProp(k, defo.v + defo.acc);
    if (r.tope) aviso(r.tope, 'tope'); else if (Math.abs(r.valor - (defo.v + defo.acc)) > 0.004) aviso(`Tope de ${PROP_ES[k].toLowerCase()}: ${f2(r.valor)}`, 'tope');
  }
  let gz = null;
  function gizmo(modo, dato, fase) {
    const i = L.sel.i; if (i < 0 || !L.E.build.partes[i]) return;
    if (fase === 'inicio') { const e = L.E.build.partes[i]; gz = { pos: [...e.t.pos], rot: [...e.t.rot], esc: e.t.esc }; L.E.begin('gizmo'); return; }
    if (fase === 'fin') { L.E.end(); gz = null; return; }
    if (!gz) return; let patch, r;
    if (modo === 'mover') { const p = [...gz.pos]; p[dato.eje] += dato.delta; patch = { pos: p }; }
    else if (modo === 'girar') { const q = [...gz.rot]; q[dato.eje] += dato.grados; patch = { rot: q }; } else patch = { esc: gz.esc * dato.factor };
    r = L.E.patch(i, patch); if (r.motivo) aviso(r.motivo, 'tope'); else if (!r.ok) aviso(r.motivo, 'tope');
  }
  function seleccionarPieza(i) { const e = L.E.build.partes[i]; if (!e) return; L.sel = { ancla: e.a, lado: e.l || 'der', i }; if (L.V) L.V.seleccionar({ ancla: e.a, i }); if (L.tab !== 'piezas') irTab('piezas'); else pintarPanel(); }
  function enfocarSlider(k) { if (L.tab !== 'cuerpo') irTab('cuerpo'); const el = root.querySelector(`#lbp-${k}`); if (el) { el.focus({ preventScroll: false }); el.closest('.lb-fila').classList.add('foco'); setTimeout(() => el.closest('.lb-fila') && el.closest('.lb-fila').classList.remove('foco'), 1200); } }

  /* ───────────────── sincronía con el estado ───────────────── */
  function sincronizar(que) {
    const E = L.E; if (!E) return;
    if (L.V) { L.V.setBuild(E.build); if (que === 'undo' || que === 'redo' || que === 'carga') { L.V.setBuild(E.build, { inmediato: true }); } }
    if (L.sel.i >= E.build.partes.length) { L.sel.i = -1; L.V && L.V.seleccionar({ ancla: L.sel.ancla, i: -1 }); }
    $('#lbnombre').value !== E.build.nombre && document.activeElement !== $('#lbnombre') && ($('#lbnombre').value = E.build.nombre);
    E.guardarBorrador(); pintarBarra(); pintarEstado(); pintarMedidor(); refrescarValores(); if (que === 'carga' || que === 'undo' || que === 'redo' || que === 'snap' || !L.parcial) pintarPanelSiCambia(que);
    setActivo(E.build); medirSoon();
  }
  let ultimaFirmaPanel = '';
  function firmaPanel() { const b = L.E.build; return JSON.stringify([L.tab, L.avanzado, L.sel, b.partes.map((e) => [e.p, e.a, e.sim, e.l, e.c]), b.base, b.pal, L.E.snapshots.length, L.E.validacion.errores.map((e) => e.codigo + e.msg).join(), L.E.validacion.avisos.length]); }
  function pintarPanelSiCambia() { const f = firmaPanel(); if (f !== ultimaFirmaPanel && !L.arrastrandoSlider) pintarPanel(); }
  let medT = 0; function medirSoon() { clearTimeout(medT); medT = setTimeout(medir, 220); }
  function medir() { if (!L.V) return; L.ultimaMed = L.V.medida(); pintarMedidor(); const el = root.querySelector('#lbreal'); if (el && L.ultimaMed) el.textContent = textoReal(); }
  const textoReal = () => (L.ultimaMed ? `${L.ultimaMed.tris} triángulos y ${L.ultimaMed.llamadas} llamadas de dibujo medidos en pantalla` : 'Midiendo…');

  function pintarBarra() {
    const E = L.E; $('#lbundo').disabled = !E.puedeUndo; $('#lbredo').disabled = !E.puedeRedo; $('#lbcopias').setAttribute('aria-label', `Copias del diseño: ${E.snapshots.length} de 5`); $('#lbcopias').title = `${E.snapshots.length} de 5 copias`;
  }
  function pintarEstado() {
    const v = L.E.validacion, el = $('#lbestado'), n = v.errores.length;
    el.className = 'lb-estado ' + (n ? 'mal' : 'ok'); el.textContent = n ? `⚠ ${n} problema${n > 1 ? 's' : ''}` : '✓ Válido';
    el.title = n ? v.errores.map((e) => e.msg).join('\n') : 'El diseño se puede guardar y jugar.';
  }
  function pintarMedidor() {
    const p = presupuestoDe(L.E.build), el = $('#lbmed'), real = L.ultimaMed, T = TOPES_RENDER;
    const ico = p.nivel === 'tope' ? '⛔' : p.nivel === 'aviso' ? '⚠' : '✓', txt = p.nivel === 'tope' ? 'Presupuesto lleno' : p.nivel === 'aviso' ? 'Casi lleno' : 'Hay lugar';
    el.className = 'lb-medidor ' + p.nivel;
    el.innerHTML = `<div class="lb-med-t"><span aria-hidden="true">${ico}</span> <b>${txt}</b></div>
      <div class="lb-barra" title="Triángulos"><i style="width:${Math.min(100, p.pctTris)}%"></i><span>Triángulos ${p.tris.toLocaleString('es')} / ${T.tris.toLocaleString('es')}</span></div>
      <div class="lb-barra" title="Llamadas de dibujo"><i style="width:${Math.min(100, p.pctLlamadas)}%"></i><span>Llamadas ${p.llamadas} / ${T.llamadas}</span></div>
      ${real ? `<small>Real: ${real.tris.toLocaleString('es')} tri · ${real.llamadas} llam.</small>` : ''}`;
    el.setAttribute('aria-label', `Presupuesto de dibujo: ${txt}. Triángulos ${p.tris} de ${T.tris}. Llamadas ${p.llamadas} de ${T.llamadas}.`);
  }

  /* ───────────────── panel: pestañas ───────────────── */
  function irTab(t) {
    L.tab = t; for (const b of root.querySelectorAll('.lb-tab')) { const on = b.dataset.tab === t; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; b.classList.toggle('on', on); }
    $('#lbpanel').setAttribute('aria-labelledby', 'lbtab-' + t); if (L.V) L.V.setModo(t === 'piezas' ? 'piezas' : 'cuerpo');
    $('#lbpista').textContent = t === 'cuerpo' ? 'Arrastrá una parte del cuerpo hacia arriba o abajo para cambiar su tamaño. Arrastrá el fondo para girar.' : t === 'piezas' ? 'Tocá un punto del cuerpo (ancla) y elegí una pieza. Tocá una pieza para moverla.' : '';
    pintarPanel();
  }
  function pintarPanel() { const P = $('#lbpanel'), prev = P.scrollTop; P.innerHTML = ({ cuerpo: htmlCuerpo, piezas: htmlPiezas, aspecto: htmlAspecto, datos: htmlDatos }[L.tab])(); P.scrollTop = prev; ultimaFirmaPanel = firmaPanel(); pintarSel(); }
  function refrescarValores() { // actualiza los números y los sliders sin reconstruir el panel (el slider que se arrastra conserva el foco)
    if (L.tab === 'cuerpo') for (const k of PROP_CLAVES) { const r = root.querySelector(`#lbp-${k}`); if (r && document.activeElement !== r || (r && L.arrastrandoSlider !== k)) { r && (r.value = L.E.build.prop[k]); } const o = root.querySelector(`#lbo-${k}`); if (o) o.textContent = f2(L.E.build.prop[k]); }
    if (L.tab === 'piezas' && L.sel.i >= 0) pintarCamposPieza();
  }

  /* ── CUERPO ── */
  function htmlCuerpo() {
    const b = L.E.build, claves = L.avanzado ? PROP_CLAVES : PROP_BASICAS, ant = L.antesBuild.prop;
    const filas = claves.map((k) => { const [a, c] = PROP_RANGOS[k]; return `<div class="lb-fila" data-k="${k}"><label for="lbp-${k}">${PROP_ES[k]}</label><input class="lb-nav" type="range" id="lbp-${k}" data-prop="${k}" min="${a}" max="${c}" step="0.005" value="${b.prop[k]}" aria-valuetext="${f2(b.prop[k])}"><output id="lbo-${k}" for="lbp-${k}">${f2(b.prop[k])}</output><button type="button" class="lb-mini lb-nav" data-reset="${k}" aria-label="Volver ${PROP_ES[k].toLowerCase()} a 1,00" ${Math.abs(b.prop[k] - 1) < 0.0005 ? 'disabled' : ''}>⟲</button></div>`; }).join('');
    const tpl = PLANTILLA_IDS.slice(0, L.avanzado ? 5 : 3).map((id) => `<button type="button" class="lb-chip lb-nav" data-tpl="${id}" title="${esc(PLANTILLAS[id].desc)}">${esc(PLANTILLAS[id].nombre)}</button>`).join('');
    return `<div class="lb-sec">
      <p class="lb-nota">Esto es solo estética: no cambia tus estadísticas. Podés arrastrar las partes del cuerpo en el visor o usar estos deslizadores.</p>
      <div class="lb-sliders">${filas}</div>
      <div class="lb-fila-botones"><button type="button" class="lb-btn lb-nav" id="lbantesbtn" aria-pressed="false" title="Mantené apretado para ver cómo era antes de tus cambios">Ver «antes»</button><button type="button" class="lb-btn lb-nav" id="lbrestab">Cuerpo original</button></div>
      <h4>Plantillas de arranque</h4><div class="lb-chips">${tpl}</div><p class="lb-nota">Una plantilla reemplaza el diseño (podés deshacer).</p></div>`;
  }
  /* ── PIEZAS ── */
  function htmlPiezas() {
    const E = L.E, b = E.build, a = L.sel.ancla, v = E.validacion, cap = v.stats.cap;
    const chips = ANCLAS_USO.map((id) => { const n = b.partes.filter((e) => e.a === id).length; return `<button type="button" class="lb-chip lb-nav ${a === id ? 'on' : ''}" data-ancla="${id}" aria-pressed="${a === id}">${ANCLAS[id].nombre}${n ? ` <b>${n}</b>` : ''}</button>`; }).join('');
    let cat = '<p class="lb-nota">Elegí un ancla en la lista de arriba o tocando un punto del cuerpo en el visor. Después elegí la pieza.</p>';
    if (a) {
      const ps = [...COSMETICAS, ...FUNCIONALES].filter((id) => PARTES[id].anclas.includes(a));
      cat = `<h4>Piezas para ${esc(ANCLAS[a].nombre.toLowerCase())}</h4><div class="lb-cat" role="list">${ps.map((id) => { const d = PARTES[id], tiene = lab().piezas.includes(id), r = E.puedeAgregar(id, a), ya = d.cat === 'funcional' && b.partes.some((e) => e.p === id);
        return `<div class="lb-card ${tiene ? '' : 'bloq'}" role="listitem"><div class="lb-card-t"><b>${esc(d.nombre)}</b><span class="lb-tag ${d.cat === 'funcional' ? 'fun' : 'est'}">${d.cat === 'funcional' ? 'Funcional' : 'Estética'}</span></div><p>${esc(d.desc)}</p><small>${d.tris.low} tri${d.lados === 'par' ? ' · par' : ''}${d.llamadas_extra ? ` · +${d.llamadas_extra} llamada` : ''}${tiene ? '' : ` · 🔒 ${esc(comoSeConsigue(id))}`}</small>
          <button type="button" class="lb-btn lb-nav lb-poner" data-poner="${id}" ${tiene && !ya ? '' : 'disabled'} ${!r.ok && tiene && !ya ? `data-motivo="${esc(r.motivo)}"` : ''} aria-label="Poner ${esc(d.nombre)}${!tiene ? ' (bloqueada)' : ya ? ' (ya la tenés puesta)' : ''}">${ya ? 'Puesta' : tiene ? 'Poner' : 'Bloqueada'}</button></div>`; }).join('')}</div>`;
    }
    const lista = b.partes.length ? b.partes.map((e, i) => `<li class="lb-it ${L.sel.i === i ? 'sel' : ''}"><button type="button" class="lb-it-n lb-nav" data-selp="${i}" aria-pressed="${L.sel.i === i}">${esc(NOMBRE_PIEZA(e.p))} <small>${esc(ANCLAS[e.a].nombre)}${e.sim === 'espejo' ? ' · par' : e.l ? ` · ${e.l === 'izq' ? 'izq.' : 'der.'}` : ''}</small></button><button type="button" class="lb-mini lb-nav" data-quitar="${i}" aria-label="Quitar ${esc(NOMBRE_PIEZA(e.p))}">✕</button></li>`).join('') : '<li class="lb-vacio">Todavía no pusiste ninguna pieza.</li>';
    return `<div class="lb-sec"><div class="lb-ranuras" aria-live="polite">Ranuras de órgano: <b>${cap.usado}</b> de <b>${cap.max}</b> <small>(las piezas funcionales usan 1 cada una; las estéticas, ninguna)</small></div>
      <h4>1 · Ancla</h4><div class="lb-chips" role="group" aria-label="Anclas del cuerpo">${chips}</div>
      <h4>2 · Pieza</h4>${cat}
      <h4>Piezas puestas</h4><ul class="lb-lista" aria-label="Piezas puestas">${lista}</ul>
      <div id="lbeditor">${htmlEditorPieza()}</div></div>`;
  }
  function htmlEditorPieza() {
    const i = L.sel.i, e = L.E.build.partes[i]; if (!e) return '';
    const d = PARTES[e.p], lim = limitesDe(e.p, e.a), ejes = ['x', 'y', 'z'];
    const campo = (tipo, k, val, [mn, mx], paso, uni) => `<div class="lb-fila"><label for="lbc-${tipo}${k}">${tipo === 'pos' ? 'Posición' : 'Giro'} ${ejes[k]}</label><button type="button" class="lb-mini lb-nav" data-paso="${tipo}:${k}:-1" aria-label="Menos">‹</button><input class="lb-nav" type="range" id="lbc-${tipo}${k}" data-campo="${tipo}:${k}" min="${mn}" max="${mx}" step="${paso}" value="${val}"><button type="button" class="lb-mini lb-nav" data-paso="${tipo}:${k}:1" aria-label="Más">›</button><output id="lbc-o${tipo}${k}">${tipo === 'pos' ? f2(val * 100, 1) + ' cm' : Math.round(val) + '°'}</output></div>`;
    const avz = L.avanzado ? [0, 1, 2].map((k) => campo('pos', k, e.t.pos[k], lim.pos[k], 0.002, 'm')).join('') + [0, 1, 2].map((k) => campo('rot', k, e.t.rot[k], lim.rot[k], 1, '°')).join('') : '';
    const mats = d.variantesMat.length > 1 ? `<label class="lb-sel-l">Material <select class="lb-nav" id="lbc-mat">${d.variantesMat.map((m) => `<option value="${m}" ${e.c.mat === m ? 'selected' : ''}>${{ bone: 'Hueso', stone: 'Piedra', metal: 'Metal', marble: 'Mármol', gold: 'Oro', leather: 'Cuero', cloth: 'Tela', flesh: 'Carne', bark: 'Corteza', mirror: 'Espejo', crystal: 'Cristal', dark: 'Oscuro' }[m] || m}</option>`).join('')}</select></label>` : '';
    const sim = d.lados === 'par' ? `<button type="button" class="lb-btn lb-nav" id="lbc-sim" aria-pressed="${e.sim === 'espejo'}">Simetría: ${e.sim === 'espejo' ? 'sí' : 'no'}</button>` : '';
    const lado = ANCLAS[e.a].lados === 2 && e.sim !== 'espejo' ? `<button type="button" class="lb-btn lb-nav" id="lbc-lado">Lado: ${e.l === 'izq' ? 'izquierdo' : 'derecho'}</button>` : '';
    return `<div class="lb-editor"><h4>${esc(d.nombre)} <small>${esc(ANCLAS[e.a].nombre)}</small></h4>
      <p class="lb-nota ${d.cat === 'funcional' ? 'fun' : ''}">${d.cat === 'funcional' ? 'Esta pieza sí cambia tus estadísticas (usa 1 ranura). Su posición y su tamaño son solo estética.' : 'Esta pieza es solo estética: no cambia tus estadísticas.'}</p>
      <div class="lb-modos" role="group" aria-label="Herramienta del visor">${Object.entries(MODOS_ES).map(([k, n]) => `<button type="button" class="lb-chip lb-nav ${L.gizmo === k ? 'on' : ''}" data-gz="${k}" aria-pressed="${L.gizmo === k}">${n}</button>`).join('')}</div>
      <div class="lb-fila"><label for="lbc-esc">Tamaño</label><button type="button" class="lb-mini lb-nav" data-paso="esc:0:-1" aria-label="Más chica">–</button><input class="lb-nav" type="range" id="lbc-esc" data-campo="esc:0" min="${lim.esc[0]}" max="${lim.esc[1]}" step="0.01" value="${e.t.esc}"><button type="button" class="lb-mini lb-nav" data-paso="esc:0:1" aria-label="Más grande">+</button><output id="lbc-oesc0">×${f2(e.t.esc)}</output></div>
      ${avz}
      <div class="lb-fila-botones">${sim}${lado}${mats}<button type="button" class="lb-btn lb-nav lb-peligro" id="lbc-quitar">Quitar pieza</button></div>
      <p class="lb-nota" id="lbc-tope" aria-live="polite"></p></div>`;
  }
  function pintarCamposPieza() {
    const e = L.E.build.partes[L.sel.i]; if (!e) return; const set = (id, v, t) => { const r = root.querySelector('#' + id); if (r && document.activeElement !== r) r.value = v; const o = root.querySelector('#' + t.id); if (o) o.textContent = t.txt; };
    for (let k = 0; k < 3; k++) { set(`lbc-pos${k}`, e.t.pos[k], { id: `lbc-opos${k}`, txt: f2(e.t.pos[k] * 100, 1) + ' cm' }); set(`lbc-rot${k}`, e.t.rot[k], { id: `lbc-orot${k}`, txt: Math.round(e.t.rot[k]) + '°' }); }
    set('lbc-esc', e.t.esc, { id: 'lbc-oesc0', txt: '×' + f2(e.t.esc) });
  }
  function pintarSel() { // barra flotante sobre el visor para la pieza elegida
    const el = $('#lbsel'), e = L.E.build.partes[L.sel.i]; el.hidden = !e || L.tab !== 'piezas'; if (!e) return;
    el.innerHTML = `<b>${esc(NOMBRE_PIEZA(e.p))}</b>${Object.entries(MODOS_ES).map(([k, n]) => `<button type="button" class="lb-chip lb-nav ${L.gizmo === k ? 'on' : ''}" data-gz="${k}" aria-pressed="${L.gizmo === k}">${n}</button>`).join('')}<button type="button" class="lb-chip lb-nav" data-quitar="${L.sel.i}" aria-label="Quitar ${esc(NOMBRE_PIEZA(e.p))}">Quitar</button>`;
  }
  /* ── ASPECTO ── */
  function htmlAspecto() {
    const b = L.E.build, p = b.pal, pal = PALETAS.map(([n, a, c, d]) => `<button type="button" class="lb-pal lb-nav ${p.primario === a && p.emisivo === d ? 'on' : ''}" data-pal="${n}" style="--a:${a};--b:${c};--c:${d}" aria-label="Paleta ${n}" aria-pressed="${p.primario === a && p.emisivo === d}"><i></i><i></i><i></i><span>${n}</span></button>`).join('');
    const pieles = PIELES.map(([n, h]) => `<button type="button" class="lb-piel lb-nav ${b.base.piel === h ? 'on' : ''}" data-piel="${h}" style="--c:${h}" aria-label="Piel ${n}" aria-pressed="${b.base.piel === h}"><span>${n}</span></button>`).join('');
    const cuerpos = PRESETS.map((id) => `<button type="button" class="lb-chip lb-nav ${b.base.preset === id ? 'on' : ''}" data-cuerpo="${id}" aria-pressed="${b.base.preset === id}">${CUERPOS[id]}</button>`).join('');
    const adv = L.avanzado ? `<h4>Colores a mano</h4><div class="lb-colores">${[['primario', 'Principal'], ['secundario', 'Secundario'], ['emisivo', 'Brillo']].map(([k, n]) => `<label>${n}<input class="lb-nav" type="color" data-color="${k}" value="${p[k]}"></label>`).join('')}</div>` : '';
    return `<div class="lb-sec"><p class="lb-nota">Los colores y el acabado son solo estética. El brillo se limita para no deslumbrar.</p>
      <h4>Paleta</h4><div class="lb-pals">${pal}</div><button type="button" class="lb-btn lb-nav" id="lbsugpal">Sugerir otra paleta</button>${adv}
      <h4>Acabado</h4><div class="lb-chips">${ACABADOS.map((a) => `<button type="button" class="lb-chip lb-nav ${p.acabado === a ? 'on' : ''}" data-acab="${a}" aria-pressed="${p.acabado === a}">${esc(FINISHES[a].name)}</button>`).join('')}</div>
      <h4>Tono de piel</h4><div class="lb-pieles">${pieles}</div><h4>Cuerpo base</h4><div class="lb-chips">${cuerpos}</div></div>`;
  }
  /* ── DATOS ── */
  function htmlDatos() {
    const E = L.E, v = E.validacion, S = v.stats, b = E.build, pr = presupuestoDe(b);
    const efectos = S.efectos.length ? S.efectos.map((e) => `<li><b>${esc(e.nombre)}</b>: ${esc(e.desc)}</li>`).join('') : '<li class="lb-vacio">Sin piezas funcionales: tu Híbrido no tiene efectos especiales.</li>';
    const ejes = Object.entries(EJES_ES).map(([k, n]) => `<div class="lb-stat"><span>${n}</span><div class="lb-bar2" role="img" aria-label="${n} ${S.resumen[k]} de 10"><i style="width:${S.resumen[k] * 10}%"></i></div><em>${S.resumen[k]}</em></div>`).join('');
    const msgs = [...v.errores.map((e) => `<li class="mal"><b>${e.codigo}</b> ${esc(e.msg)}</li>`), ...v.avisos.filter((a) => a.codigo !== 'HB-18').map((e) => `<li class="aviso"><b>${e.codigo}</b> ${esc(e.msg)}</li>`)].join('') || '<li class="ok">Todo en orden: el diseño es válido.</li>';
    const texto = explicar(b, E.ctx).map((t) => `<li>${esc(t)}</li>`).join('');
    return `<div class="lb-sec"><h4>Capacidad</h4><p class="lb-ranuras">Ranuras de órgano usadas: <b>${S.cap.usado}</b> de <b>${S.cap.max}</b></p>
      <h4>Efectos reales</h4><ul class="lb-lista2">${efectos}</ul>
      <h4>Ejes <small>(solo orientativo)</small></h4><div class="lb-stats">${ejes}</div><p class="lb-nota">Los ejes de arriba son una guía para comparar, no se usan en el combate. La altura, el ancho y la posición de las piezas no cambian ninguna estadística.</p>
      <h4>Presupuesto de dibujo</h4><p class="lb-nota">Estimado: ${pr.tris.toLocaleString('es')} de ${TOPES_RENDER.tris.toLocaleString('es')} triángulos · ${pr.llamadas} de ${TOPES_RENDER.llamadas} llamadas · ${pr.instancias} piezas dibujadas (una pieza en par cuenta dos).<br><span id="lbreal">${esc(textoReal())}</span></p>
      <h4>Revisión</h4><ul class="lb-lista2 lb-msgs" role="list" aria-live="polite">${msgs}</ul>
      <div class="lb-fila-botones"><button type="button" class="lb-btn lb-nav" id="lbreparar">Reparar</button><button type="button" class="lb-btn lb-nav" id="lbsimetria">Completar simetría</button></div>
      <h4>Qué hace cada cosa</h4><ul class="lb-lista2">${texto}</ul></div>`;
  }

  /* ───────────────── eventos del panel (delegación) ───────────────── */
  const P = $('#lbpanel');
  P.addEventListener('input', (e) => {
    const t = e.target, E = L.E;
    if (t.dataset.prop) { L.arrastrandoSlider = t.dataset.prop; const r = E.setProp(t.dataset.prop, +t.value); const o = root.querySelector('#lbo-' + t.dataset.prop); if (o) o.textContent = f2(r.valor); t.setAttribute('aria-valuetext', f2(r.valor)); if (r.tope) { aviso(r.tope, 'tope'); t.value = r.valor; } return; }
    if (t.dataset.campo) { const [tipo, k] = t.dataset.campo.split(':'), i = L.sel.i; if (!E.build.partes[i]) return; const e0 = E.build.partes[i], patch = tipo === 'esc' ? { esc: +t.value } : { [tipo]: tipo === 'pos' ? e0.t.pos.map((v, n) => (n === +k ? +t.value : v)) : e0.t.rot.map((v, n) => (n === +k ? +t.value : v)) }; const r = E.patch(i, patch); document.querySelector('#lbc-tope') && (root.querySelector('#lbc-tope').textContent = r.motivo || ''); if (r.motivo) aviso(r.motivo, 'tope'); return; }
    if (t.dataset.color) { E.setPal(t.dataset.color, t.value); }
  });
  P.addEventListener('change', (e) => {
    const t = e.target; L.arrastrandoSlider = null;
    if (t.id === 'lbc-mat') { L.E.patch(L.sel.i, { mat: t.value }); pintarPanel(); }
    if (t.dataset.prop) pintarPanelSiCambia();
  });
  P.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled && !b.dataset.motivo) { return; } const E = L.E, d = b.dataset;
    if (d.reset) { E.setProp(d.reset, 1); pintarPanel(); return; }
    if (d.tpl) { const r = sugerir(d.tpl, L.plantillaSemilla++, E.ctx), b0 = r.build; E.cargar({ ...b0, id: E.build.id, nombre: E.build.nombre }, { historia: true }); aviso(`Plantilla «${PLANTILLAS[d.tpl].nombre}»${r.notas.length ? ': ' + r.notas[0] : ''}`, 'ok'); return; }
    if (b.id === 'lbrestab') { E.setProps(L.antesBuild.prop); pintarPanel(); return; }
    if (d.ancla) { L.sel = { ancla: d.ancla, lado: L.sel.lado, i: -1 }; if (L.V) L.V.seleccionar({ ancla: d.ancla, i: -1 }); pintarPanel(); return; }
    if (d.poner) { if (d.motivo && b.disabled) { aviso(d.motivo, 'tope'); return; } const r = E.agregar(d.poner, L.sel.ancla, { l: L.sel.lado }); if (!r.ok) { aviso(r.motivo, 'tope'); b.setAttribute('aria-describedby', 'lbaviso'); return; } L.sel.i = r.i; L.V && L.V.seleccionar({ ancla: L.sel.ancla, i: r.i }); aviso(`${NOMBRE_PIEZA(d.poner)} puesta. Movela con el visor o con los controles.`, 'ok'); pintarPanel(); return; }
    if (d.selp !== undefined) { seleccionarPieza(+d.selp); return; }
    if (d.quitar !== undefined) { quitar(+d.quitar); return; }
    if (d.gz) { L.gizmo = d.gz; L.V && L.V.setGizmo(d.gz); pintarPanel(); return; }
    if (d.paso) { const [tipo, k, s] = d.paso.split(':'), e0 = E.build.partes[L.sel.i]; if (!e0) return; const lim = limitesDe(e0.p, e0.a); let patch; if (tipo === 'esc') patch = { esc: e0.t.esc + 0.05 * +s }; else patch = { [tipo]: (tipo === 'pos' ? e0.t.pos : e0.t.rot).map((v, n) => (n === +k ? v + (tipo === 'pos' ? 0.005 : 5) * +s : v)) }; void lim; const r = E.patch(L.sel.i, patch, 'paso'); root.querySelector('#lbc-tope').textContent = r.motivo || ''; if (r.motivo) aviso(r.motivo, 'tope'); return; }
    if (b.id === 'lbc-sim') { const e0 = E.build.partes[L.sel.i]; E.patch(L.sel.i, { sim: e0.sim === 'espejo' ? 'ninguna' : 'espejo' }); pintarPanel(); return; }
    if (b.id === 'lbc-lado') { const e0 = E.build.partes[L.sel.i]; E.patch(L.sel.i, { l: e0.l === 'izq' ? 'der' : 'izq' }); pintarPanel(); return; }
    if (b.id === 'lbc-quitar') { quitar(L.sel.i); return; }
    if (d.pal) { const x = PALETAS.find((p) => p[0] === d.pal); E.setPaleta({ primario: x[1], secundario: x[2], emisivo: x[3] }); pintarPanel(); return; }
    if (b.id === 'lbsugpal') { const s = sugerirPaleta(`${E.build.id}|${L.plantillaSemilla++}`); E.setPaleta({ primario: s.primario, secundario: s.secundario, emisivo: s.emisivo }); pintarPanel(); return; }
    if (d.piel) { E.setBase('piel', d.piel); pintarPanel(); return; }
    if (d.cuerpo) { E.setBase('preset', d.cuerpo); pintarPanel(); return; }
    if (d.acab) { E.setPaleta({ acabado: d.acab }); pintarPanel(); return; }
    if (b.id === 'lbreparar') { const r = reparar(E.build, E.ctx); E.cargar(r.build, { historia: true }); aviso(r.cambios.length ? r.cambios[0] : 'No hacía falta reparar nada.', 'ok'); pintarPanel(); return; }
    if (b.id === 'lbsimetria') { const r = completarSimetria(E.build, E.ctx); E.cargar(r.build, { historia: true }); aviso(r.cambios.length ? r.cambios[0] : 'Ya era simétrico.', 'ok'); pintarPanel(); }
  });
  function quitar(i) { const e = L.E.build.partes[i]; if (!e) return; const nombre = NOMBRE_PIEZA(e.p); L.E.quitar(i); L.sel.i = -1; L.V && L.V.seleccionar({ ancla: L.sel.ancla, i: -1 }); aviso(`${nombre} quitada.`, 'ok'); pintarPanel(); }
  $('#lbsel').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.gz) { L.gizmo = b.dataset.gz; L.V && L.V.setGizmo(b.dataset.gz); pintarPanel(); } else if (b.dataset.quitar !== undefined) quitar(+b.dataset.quitar); });
  // «antes»: mientras se mantiene apretado el botón, el cuerpo muestra las proporciones de cuando abriste el editor
  const antesOn = (on) => { if (!L.V) return; $('#lbantes').hidden = !on; L.V.setBuild(on ? { ...L.E.build, prop: L.antesBuild.prop } : L.E.build, { inmediato: true }); };
  P.addEventListener('pointerdown', (e) => { if (e.target.closest('#lbantesbtn')) antesOn(true); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) P.addEventListener(ev, (e) => { if (e.target.closest && e.target.closest('#lbantesbtn') || ev !== 'pointerleave') if ($('#lbantes') && !$('#lbantes').hidden) antesOn(false); });
  P.addEventListener('keydown', (e) => { if (e.target.id === 'lbantesbtn' && (e.key === ' ' || e.key === 'Enter')) { antesOn(true); } });
  P.addEventListener('keyup', (e) => { if (e.target.id === 'lbantesbtn' && (e.key === ' ' || e.key === 'Enter')) antesOn(false); });
  const pintarModo = () => { const b = $('#lbmodo'); b.textContent = L.avanzado ? 'Avanzado' : 'Básico'; b.setAttribute('aria-pressed', L.avanzado); b.setAttribute('aria-label', `Modo ${L.avanzado ? 'avanzado' : 'básico'}: tocá para cambiar`); };
  $('#lbmodo').addEventListener('click', () => { L.avanzado = !L.avanzado; lsSet(KEY_MODO, L.avanzado ? 'avanzado' : 'basico'); pintarModo(); pintarPanel(); });
  L.pintarModo = pintarModo;
  $('#lbnombre').addEventListener('input', (e) => L.E.setNombre(e.target.value));
  $('#lbtabs').addEventListener('click', (e) => { const b = e.target.closest('.lb-tab'); if (b) irTab(b.dataset.tab); });
  $('#lbtabs').addEventListener('keydown', (e) => { const ts = [...root.querySelectorAll('.lb-tab')], i = ts.indexOf(document.activeElement); if (i < 0) return; const j = e.key === 'ArrowRight' ? (i + 1) % ts.length : e.key === 'ArrowLeft' ? (i + ts.length - 1) % ts.length : -1; if (j >= 0) { e.preventDefault(); e.stopPropagation(); ts[j].focus(); irTab(ts[j].dataset.tab); } });
  // cámaras
  $('#lbcams').innerHTML = ['frente', 'tres_cuartos', 'perfil', 'espalda', 'cabeza', 'manos', 'pies'].map((k, n) => `<button type="button" class="lb-cam lb-nav" data-cam="${k}" title="Cámara ${n + 1}" aria-label="Cámara ${['frente', '3/4', 'perfil', 'espalda', 'cabeza', 'manos', 'pies'][n]}" aria-pressed="false">${['Frente', '3/4', 'Perfil', 'Espalda', 'Cabeza', 'Manos', 'Pies'][n]}</button>`).join('');
  $('#lbcams').insertAdjacentHTML('beforeend', `<select id="lbcamara" class="lb-nav lb-camara" aria-label="Cámara del editor">${['frente', 'tres_cuartos', 'perfil', 'espalda', 'cabeza', 'manos', 'pies'].map((k, i) => `<option value="${k}">Cámara: ${['Frente', '3/4', 'Perfil', 'Espalda', 'Cabeza', 'Manos', 'Pies'][i]}</option>`).join('')}</select>`);
  $('#lbcamara').addEventListener('change', e => camara(e.target.value));
  $('#lbcams').addEventListener('click', (e) => { const b = e.target.closest('.lb-cam'); if (b) camara(b.dataset.cam); });
  function camara(k) { L.cam = k; $('#lbcamara').value = k; for (const b of root.querySelectorAll('.lb-cam')) b.setAttribute('aria-pressed', b.dataset.cam === k); L.V && L.V.camara(k); }

  /* ───────────────── barra de acciones ───────────────── */
  $('#lbundo').addEventListener('click', () => { L.E.undo(); aviso('Deshecho.', 'ok'); });
  $('#lbredo').addEventListener('click', () => { L.E.redo(); aviso('Rehecho.', 'ok'); });
  $('#lbguardar').addEventListener('click', () => guardar());
  function guardar(silencioso = false) {
    const E = L.E, v = E.validacion; if (!v.ok) { aviso(`Todavía no se puede guardar: ${v.errores[0].msg}`, 'tope'); irTab('datos'); return false; }
    const r = guardarDiseno(lab(), E.paraGuardar()); if (!r.ok) { aviso(r.mensaje, 'tope'); return false; }
    const persistido = Perfil.guardarLaboratorio(elegirActivo(r.lab, r.build.id).lab); if (!persistido.ok) { aviso(persistido.mensaje + ' Conservá este editor abierto y reintentá Guardar.', 'tope'); return false; } E.marcarLimpio(); E.borrarBorrador(); setActivo(E.build); if (!silencioso) aviso('Diseño guardado y elegido como tu Híbrido activo.', 'ok'); return true;
  }
  $('#lbprobar').addEventListener('click', () => probar());
  async function probar() {
    const E = L.E, v = E.validacion; if (!v.ok) { aviso(`Para probar el diseño tiene que ser válido: ${v.errores[0].msg}`, 'tope'); return; }
    E.guardarBorrador(); ssSet(KEY_VOLVER, '1'); setActivo(E.build);
    const act = window.__api && window.__api.probarHibrido; if (!act) { aviso('El Campo de pruebas no está disponible acá.', 'tope'); return; }
    act(codificar(E.build));
  }
  $('#lbcopias').addEventListener('click', () => dialogoCopias());
  $('#lbdisenos').addEventListener('click', () => dialogoDisenos());

  /* ───────────────── diálogos ───────────────── */
  let dlgPrevio = null;
  function dialogo(titulo, html) { const d = $('#lbdialogo'); dlgPrevio = document.activeElement; $('#lbdtitulo').textContent = titulo; $('#lbdcuerpo').innerHTML = html; d.hidden = false; const f = d.querySelector('button, input, textarea'); (f || $('#lbdcerrar')).focus(); }
  function cerrarDialogo() { const d = $('#lbdialogo'); if (d.hidden) return false; d.hidden = true; if (dlgPrevio && dlgPrevio.focus) dlgPrevio.focus(); return true; }
  $('#lbdcerrar').addEventListener('click', cerrarDialogo);
  $('#lbdialogo').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); cerrarDialogo(); } else if (e.key === 'Tab') { const fs = [...$('#lbdialogo').querySelectorAll('button:not(:disabled), input, textarea, select')]; if (!fs.length) return; const a = fs.indexOf(document.activeElement); if (e.shiftKey && a <= 0) { e.preventDefault(); fs[fs.length - 1].focus(); } else if (!e.shiftKey && a === fs.length - 1) { e.preventDefault(); fs[0].focus(); } } });
  function dialogoCopias() {
    const E = L.E, pintar = () => { $('#lbdcuerpo').querySelector('.lb-copias').innerHTML = E.snapshots.length ? E.snapshots.map((s, n) => `<li><span>${esc(s.etiqueta)}</span><button type="button" class="lb-btn lb-nav" data-rest="${n}">Restaurar</button><button type="button" class="lb-mini lb-nav" data-borr="${n}" aria-label="Borrar ${esc(s.etiqueta)}">✕</button></li>`).join('') : '<li class="lb-vacio">Todavía no hay copias.</li>'; pintarBarra(); };
    dialogo('Copias del diseño', `<p class="lb-nota">Guardá una copia antes de probar algo arriesgado; hasta 5 por diseño. Restaurar se puede deshacer.</p><div class="lb-fila-botones"><input class="lb-nav" id="lbsnapn" type="text" maxlength="24" placeholder="Nombre (ej.: antes de las alas)" aria-label="Nombre de la copia"><button type="button" class="lb-btn lb-nav" id="lbsnapok">Guardar copia</button></div><ul class="lb-copias"></ul>`); pintar();
    $('#lbdcuerpo').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.id === 'lbsnapok') { const r = E.crearSnapshot($('#lbsnapn').value); if (!r.ok) aviso(r.motivo, 'tope'); else { $('#lbsnapn').value = ''; aviso('Copia guardada.', 'ok'); } pintar(); } else if (b.dataset.rest) { E.restaurarSnapshot(+b.dataset.rest); cerrarDialogo(); aviso('Copia restaurada (podés deshacer).', 'ok'); } else if (b.dataset.borr) { E.borrarSnapshot(+b.dataset.borr); pintar(); } };
  }
  function dialogoDisenos() {
    const pintar = () => {
      const slots = lab().slots, act = lab().activo;
      $('#lbdcuerpo').innerHTML = `<p class="lb-nota">Tenés ${slots.length} de ${LAB_MAX_DISENOS} diseños. El diseño <b>activo</b> es con el que jugás con tu Híbrido.</p><ul class="lb-disenos">${slots.map((s) => `<li class="${s.id === act ? 'act' : ''}"><div><b>${esc(s.nombre)}</b> <small>${s.partes.length} pieza${s.partes.length === 1 ? '' : 's'}${s.id === act ? ' · activo' : ''}</small></div><div class="lb-fila-botones"><button type="button" class="lb-btn lb-nav" data-abrir="${s.id}">Abrir</button><button type="button" class="lb-btn lb-nav" data-act="${s.id}" ${s.id === act ? 'disabled' : ''}>Usar</button><button type="button" class="lb-btn lb-nav" data-exp="${s.id}">Exportar</button><button type="button" class="lb-btn lb-nav lb-peligro" data-del="${s.id}">Borrar</button></div></li>`).join('') || '<li class="lb-vacio">Todavía no guardaste ningún diseño.</li>'}</ul>
        <div class="lb-fila-botones"><button type="button" class="lb-btn lb-nav" id="lbnuevo" ${slots.length >= LAB_MAX_DISENOS ? 'disabled' : ''}>Diseño nuevo</button><button type="button" class="lb-btn lb-nav" id="lbjugar">Jugar con mi Híbrido</button></div>
        <h4>Importar / exportar</h4><textarea class="lb-nav" id="lbtxt" rows="3" placeholder="Pegá acá un diseño (VORTEX-HUESPED-1:…) o elegí «Exportar»" aria-label="Texto del diseño"></textarea><div class="lb-fila-botones"><button type="button" class="lb-btn lb-nav" id="lbimp">Importar</button></div><p class="lb-nota" id="lbimpmsg" aria-live="polite">Importar nunca te regala piezas: las que no tengas se ven bloqueadas.</p>`;
    };
    dialogo('Mis diseños', ''); pintar();
    $('#lbdcuerpo').onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
      if (d.abrir) { const s = lab().slots.find((x) => x.id === d.abrir); if (s) { L.E.cargar(s); L.antesBuild = JSON.parse(JSON.stringify(L.E.build)); cerrarDialogo(); aviso(`Abriste «${s.nombre}».`, 'ok'); irTab(L.tab); } }
      else if (d.act) { const r = Perfil.guardarLaboratorio(elegirActivo(lab(), d.act).lab); if (r.ok) { const elegido = lab().slots.find(s => s.id === d.act); L.E.cargar(elegido); L.antesBuild = JSON.parse(JSON.stringify(L.E.build)); } pintar(); if (!r.ok) $('#lbimpmsg').textContent = r.mensaje; }
      else if (d.exp) { const s = lab().slots.find((x) => x.id === d.exp); $('#lbtxt').value = exportar(s); $('#lbtxt').select(); $('#lbimpmsg').textContent = 'Copiá este texto para guardarlo o pasárselo a alguien.'; }
      else if (d.del) { const r = borrarDiseno(lab(), d.del); if (r.ok) { const g = Perfil.guardarLaboratorio(r.lab); pintar(); if (!g.ok) $('#lbimpmsg').textContent = g.mensaje; } }
      else if (b.id === 'lbnuevo') { L.E.cargar({ ...defecto(), id: idNuevo(), nombre: 'Mi Híbrido' }); L.antesBuild = JSON.parse(JSON.stringify(L.E.build)); cerrarDialogo(); irTab('cuerpo'); aviso('Diseño nuevo en blanco. Recordá guardarlo.', 'ok'); }
      else if (b.id === 'lbimp') { const r = importar($('#lbtxt').value, lab()); if (r.ok) { const g = Perfil.guardarLaboratorio(r.lab); pintar(); $('#lbimpmsg').textContent = g.ok ? r.mensaje : g.mensaje; } else $('#lbimpmsg').textContent = r.mensaje; }
      else if (b.id === 'lbjugar') { if (!guardar(true)) return; Equipo.char = 'laboratorio'; saveEquipo(); cerrarDialogo(); aviso('Tu Híbrido es ahora tu Huésped para jugar.', 'ok'); }
    };
  }

  /* ───────────────── teclado ───────────────── */
  L.pintarPanel = pintarPanel;
  L.tecla = (e) => {
    if (!L.abierto) return false;
    if (e.code === 'Tab') return true;   // Tab recorre los controles (el juego usa Tab para cambiar de modo: acá no)
    const a = document.activeElement, tipo = a && a.tagName;
    if (!$('#lbdialogo').hidden) { if (e.code === 'Escape') { cerrarDialogo(); e.preventDefault(); return true; } return true; }   // con un diálogo abierto, las teclas son del diálogo
    if (tipo === 'INPUT' && a.type !== 'range' && a.type !== 'color' || tipo === 'TEXTAREA' || tipo === 'SELECT') return true;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? L.E.redo() : L.E.undo(); return true; }
    if (ctrl && e.code === 'KeyY') { e.preventDefault(); L.E.redo(); return true; }
    if (tipo === 'INPUT' && a.type === 'range') { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.code)) return true; }
    if (tipo === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return true;   // el botón enfocado hace su trabajo
    const i = L.sel.i, hay = !!L.E.build.partes[i];
    const cams = { Digit1: 'frente', Digit2: 'tres_cuartos', Digit3: 'perfil', Digit4: 'espalda', Digit5: 'cabeza', Digit6: 'manos', Digit7: 'pies' }; if (cams[e.code] && !ctrl) { camara(cams[e.code]); e.preventDefault(); return true; }
    if (e.code === 'KeyS' && hay && PARTES[L.E.build.partes[i].p].lados === 'par') { const e0 = L.E.build.partes[i]; L.E.patch(i, { sim: e0.sim === 'espejo' ? 'ninguna' : 'espejo' }); pintarPanel(); e.preventDefault(); return true; }
    const gm = { KeyW: 'mover', KeyE: 'girar', KeyR: 'escalar' }[e.code]; if (gm && hay && L.tab === 'piezas') { L.gizmo = gm; L.V && L.V.setGizmo(gm); pintarPanel(); e.preventDefault(); return true; }
    if ((e.code === 'Delete' || e.code === 'Backspace') && hay) { quitar(i); e.preventDefault(); return true; }
    if (e.code === 'Escape' && (L.sel.i >= 0 || L.sel.ancla)) { L.sel = { ancla: null, lado: 'der', i: -1 }; L.V && L.V.seleccionar({}); pintarPanel(); e.preventDefault(); return true; }
    if (hay && L.tab === 'piezas' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.code) && a === $('#lbcanvas')) {
      const paso = e.shiftKey ? 0.02 : 0.005, e0 = L.E.build.partes[i], p = [...e0.t.pos], dx = { ArrowLeft: -1, ArrowRight: 1 }[e.code] || 0, dy = { ArrowUp: 1, ArrowDown: -1 }[e.code] || 0, dz = { PageUp: 1, PageDown: -1 }[e.code] || 0;
      p[0] += dx * paso; p[1] += dy * paso; p[2] += dz * paso; const r = L.E.patch(i, { pos: p }, 'flechas'); if (r.motivo) aviso(r.motivo, 'tope'); e.preventDefault(); return true;
    }
    if (a === $('#lbcanvas') && ['ArrowLeft', 'ArrowRight'].includes(e.code)) { e.preventDefault(); return true; }
    return false;
  };
  $('#lbpista').title = AYUDA_TECLAS;
  $('#lbstage').addEventListener('keydown', () => { /* el foco ya está en el visor: lab.tecla lo atiende vía ui.handleKey */ });

  /* ───────────────── ciclo de vida ───────────────── */
  L.mostrar = async () => {
    L.abierto = true; if (!L.E) iniciarEstado(); else { const act = lab().slots.find((s) => s.id === lab().activo); void act; }
    $('#lbnombre').value = L.E.build.nombre; L.pintarModo(); irTab(L.tab); pintarBarra(); pintarEstado(); pintarMedidor(); camara(L.cam); setActivo(L.E.build);
    if (ssGet(KEY_VOLVER)) ssSet(KEY_VOLVER, null);
    await abrirVisor();
  };
  L.ocultar = () => { L.abierto = false; cerrarDialogo(); if (L.E) L.E.guardarBorrador(); cerrarVisor(); clearTimeout(medT); };
  L.probarVolver = ssGet(KEY_VOLVER) === '1';
  // volver del Campo de pruebas (la página se recarga): al apretar «Empezar» se reabre el Laboratorio con el borrador
  if (L.probarVolver) { const cT = menu.confirmTitle.bind(menu); menu.confirmTitle = function () { cT(); if (L.probarVolver) { L.probarVolver = false; ssSet(KEY_VOLVER, null); this.show('laboratorio', false); } }; }
  void validar; void derivarStats; void decodificar; void reglaObtencion; void FUNCIONALES;
}
export function showLaboratorio(menu) { if (menu.lb) menu.lb.mostrar(); }
export function hideLaboratorio(menu) { if (menu.lb) menu.lb.ocultar(); }
