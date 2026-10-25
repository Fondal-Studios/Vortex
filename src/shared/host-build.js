// HOST-BUILD · núcleo de datos del Editor de Huéspedes (Laboratorio, E1). Módulo PURO y COMPARTIDO: lo importan el cliente 3D,
// el servidor y la simulación. Sin DOM, sin Three.js, sin azar oculto (el azar se inyecta), sin red. Contrato: docs/EDITOR_HUESPEDES.md.
//
// ═══════════════════════════ INTERFAZ (qué puede usar el cliente 3D) ═══════════════════════════
//  DATOS (re-exportados de host-build-catalogo.js)
//    ANCLAS, ORDEN_ANCLAS, PARTES (= CATALOGO), ORDEN_PARTES, COSMETICAS, FUNCIONALES, PIEZAS_INICIALES,
//    PROP_ORDEN, PROP_RANGOS, POSE_RANGOS, TOPES_RENDER, MATERIALES_KIT, ACABADOS, PRESETS, CHASIS, RIG, MENSAJES
//  CONSTRUIR / LIMPIAR
//    defecto()                  → build vacía del chasis «Híbrido de Laboratorio» (siempre válida).
//    idNuevo(azar?)             → 'lab-xxxxxxxx'.
//    normalizar(raw)            → build LIMPIA y CANÓNICA (nunca lanza; idempotente: normalizar(normalizar(x)) ≡ normalizar(x)).
//                                  Recorta rangos, cuantiza (prop 0,005 · pos 0,002 m · rot grados enteros · esc 0,01), quita duplicados
//                                  funcionales (HB-14), descarta piezas desconocidas o en ancla ilegal. NO lleva `cap` ni `h`.
//    sellar(build, ctx?)        → normalizar + `cap` y `h` calculados (formato para guardar/mostrar).
//    migrar(raw)                → { build, desde, hasta, futuro }: sube cualquier versión vieja al esquema actual (futuro=true: no tocar).
//  VALIDAR
//    validar(raw, ctx?)         → { ok, build, errores[], avisos[], cap, render, stats, h, bloqueadas[] }.
//                                  `build` es SIEMPRE una build segura (normalizada y sellada). `ok:false` ⇒ hay al menos un error HB-xx
//                                  (cada incidencia: { codigo, sev: 'error'|'recorte'|'aviso', msg (español), ...datos }).
//                                  Quien JUEGA debe usar `usable()`; el editor usa `validar()` para mostrar los mensajes.
//    usable(raw, ctx?)          → { build, ok, defecto, errores, avisos }: si es inválida devuelve defecto() (el servidor NO expulsa).
//    ctx = { evo (0..4, define las ranuras: 1+evo), poseidas (ids que el jugador tiene; omitido = no se comprueba HB-06),
//            manoDerechaOcupada (true por defecto: HB-12), calidad ('low'|'medium'|'high') }
//  LEER
//    instancias(build)          → piezas YA EXPANDIDAS (espejo = 2): { i, p, a, lado: 'c'|'izq'|'der', hueso, t, c, espejada, cat }.
//                                  `t` está en el marco del ANCLA (ver ANCLAS): +x hacia afuera en cada lado; el reflejo izq/der lo hace el renderizador.
//    costeRender(build, calidad?) → { tris, llamadas, materiales[], halos, cadenas, telas, instancias, topes, pctTris, pctLlamadas, excede }
//    derivarStats(build, ctx?)  → { cap:{usado,max,excede}, organos[], efectos[], mult{}, bn{}, resumen{6 ejes}, base:{hp,speed} }.
//                                  ÚNICA fuente de los efectos de combate. Mira SOLO qué piezas funcionales hay (ids) y ctx.evo.
//    huella(build)              → 14 hex sobre el contenido canónico (sin h, cap ni meta; el ORDEN de partes no importa).
//  RED
//    codificar(build)           → 'VB1:' + base64url (≤ 2048 caracteres; una build de 24 piezas ronda los 600).
//    decodificar(texto)         → { ok, build, mensaje }  (nunca lanza; build pasa por normalizar).
//  Los tamaños/posiciones/colores de una pieza son SOLO estética: no entran en derivarStats ni en ninguna fórmula de combate.

import { huella as hashTexto, estable } from '../sim/ledger.js';
import { CHAMP_ORGANS, champOrganSlots } from '../sim/data.js';
import { CAPS, capBn } from '../sim/items.js';
import {
  SCHEMA, VERSION_BUILD, RIG, CHASIS_ID, EDITOR_VERSION, MATERIALES_KIT, ACABADOS, PRESETS, CHASIS, PROP_ORDEN, PROP_RANGOS, PROP_RELACIONES,
  POSE_RANGOS, TOPES_RENDER, ANTI_OCLUSION, BRILLO_EMISIVO_MAX, BUILD_BYTES_MAX, ANCLAS, ORDEN_ANCLAS, PARTES, ORDEN_PARTES, ORGANO_EFECTO, ORGANO_EJES, MENSAJES,
} from './host-build-catalogo.js';

export * from './host-build-catalogo.js';

const ID_RE = /^lab-[a-z0-9]{6,24}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_ENTRADAS = 64;                     // entradas de `partes` que se leen (el resto se descarta con HB-10)
const esObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cero = (n) => (n === 0 ? 0 : n);                       // evita el -0 (que rompería deepEqual aunque JSON lo escriba igual)
const q = (v, den) => cero(Math.round(v * den) / den);            // cuantiza a 1/den (den entero): el cociente de enteros es exacto en decimal
const fmt = (s, d = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (d[k] !== undefined ? String(d[k]) : ''));

/* ───────── incidencias ───────── */
function inc(lista, codigo, sev, datos = {}) { const { msg, ...resto } = datos; lista.push({ codigo, sev, ...resto, msg: fmt(msg || MENSAJES[codigo], datos) }); }

/* ───────── defecto e ids ───────── */
const NOMBRE_DEFECTO = CHASIS.laboratorio.nombre;
const PROP_NEUTRA = Object.freeze(Object.fromEntries(PROP_ORDEN.map((k) => [k, 1])));
const PAL_DEFECTO = Object.freeze({ primario: '#7a3a1c', secundario: '#2b2430', emisivo: '#ff7a22', acabado: 'archivo' });
export function defecto() {
  return {
    schema: SCHEMA, v: VERSION_BUILD, id: 'lab-defecto', nombre: NOMBRE_DEFECTO, rig: RIG, chasis: CHASIS_ID,
    base: { preset: 'jugador3', piel: '#8a5a3c' }, prop: { ...PROP_NEUTRA }, pose: { inclinacion: 0, hombros: 0 }, partes: [],
    pal: { ...PAL_DEFECTO }, meta: { creado: 0, editor: EDITOR_VERSION },
  };
}
export const esDefecto = (b) => !!b && b.id === 'lab-defecto';
export function idNuevo(azar = Math.random) {
  const A = 'abcdefghijklmnopqrstuvwxyz0123456789'; let s = 'lab-';
  for (let i = 0; i < 8; i++) s += A[Math.floor(azar() * A.length) % A.length];
  return s;
}

/* ───────── colores ───────── */
function colorHex(x, def) { if (typeof x === 'string' && HEX_RE.test(x)) return { v: x.toLowerCase(), ok: true }; return { v: def, ok: false }; }
const rgbDe = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const aHex = (c) => '#' + c.map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('');
export const luminancia = (hex) => { const [r, g, b] = rgbDe(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
/** Baja el brillo de un color hasta el máximo permitido (HB-15). */
export function limitarBrillo(hex, max = BRILLO_EMISIVO_MAX) {
  let c = rgbDe(hex), cambio = false;
  for (let i = 0; i < 60 && luminancia(aHex(c)) > max; i++) { c = c.map((n) => Math.floor(n * 0.95)); cambio = true; }
  return { v: aHex(c), cambio };
}

/* ───────── nombre ───────── */
const BASURA = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿<>&"'`]/g;
function limpiarNombre(s) {
  if (typeof s !== 'string') return '';
  let t = s;
  for (let i = 0; i < 4; i++) {
    const prev = t;
    t = Array.from(t.normalize('NFC').replace(BASURA, '').replace(/\s+/g, ' ').trim()).slice(0, 24).join('').trim();
    if (t === prev) break;
  }
  return t;
}

/* ───────── límites efectivos de una pieza en un ancla ───────── */
const inter = (a, b) => { const lo = Math.max(a[0], b[0]), hi = Math.min(a[1], b[1]); return lo <= hi ? [lo, hi] : [clamp(0, b[0], b[1]), clamp(0, b[0], b[1])]; };
export function limitesDe(pieza, ancla) {
  const d = PARTES[pieza], A = ANCLAS[ancla]; if (!d || !A) return null;
  return {
    pos: [0, 1, 2].map((i) => inter(d.limites.pos[i], A.limites.pos[i])),
    rot: [0, 1, 2].map((i) => inter(d.limites.rot[i], A.limites.rot[i])),
    esc: inter(d.limites.esc, A.limites.esc),
  };
}

/* ───────── NORMALIZAR ───────── */
function normalizarInterno(raw, I) {
  const r = esObj(raw) ? raw : {};
  const b = { schema: SCHEMA, v: VERSION_BUILD };

  // HB-02 id y nombre
  if (typeof r.id === 'string' && ID_RE.test(r.id)) b.id = r.id;
  else { b.id = 'lab-' + hashTexto(estable({ n: r.nombre, p: r.partes })).slice(0, 10); inc(I, 'HB-02', 'error', { campo: 'id' }); }
  const nom = limpiarNombre(r.nombre);
  if (!nom) { b.nombre = NOMBRE_DEFECTO; inc(I, 'HB-02', 'error', { campo: 'nombre' }); }
  else { b.nombre = nom; if (typeof r.nombre === 'string' && nom !== r.nombre.trim()) inc(I, 'HB-02', 'aviso', { campo: 'nombre', msg: 'Se limpiaron caracteres no permitidos del nombre.' }); }

  // HB-03 rig y chasis
  if (r.rig !== undefined && r.rig !== RIG) inc(I, 'HB-03', 'error', { campo: 'rig' });
  if (r.chasis !== undefined && r.chasis !== CHASIS_ID) inc(I, 'HB-03', 'error', { campo: 'chasis' });
  b.rig = RIG; b.chasis = CHASIS_ID;

  // base
  const rb = esObj(r.base) ? r.base : {};
  b.base = { preset: PRESETS.includes(rb.preset) ? rb.preset : 'jugador3', piel: colorHex(rb.piel, '#8a5a3c').v };

  // HB-04 proporciones
  const rp = esObj(r.prop) ? r.prop : {}, ajustadas = [];
  b.prop = {};
  for (const k of PROP_ORDEN) {
    const [lo, hi] = PROP_RANGOS[k]; let v = rp[k];
    if (v === undefined || v === null) { b.prop[k] = 1; continue; }
    v = Number(v); if (!Number.isFinite(v)) { b.prop[k] = 1; ajustadas.push(k); continue; }
    const c = clamp(v, lo, hi); if (Math.abs(c - v) > 1e-9) ajustadas.push(k);
    b.prop[k] = clamp(q(c, 200), lo, hi);
  }
  if (ajustadas.length) inc(I, 'HB-04', 'aviso', { campos: ajustadas, msg: `Se ajustaron al rango permitido: ${ajustadas.join(', ')}.` });

  // pose (grados enteros)
  const rpo = esObj(r.pose) ? r.pose : {};
  b.pose = {};
  for (const k of Object.keys(POSE_RANGOS)) { const [lo, hi] = POSE_RANGOS[k]; const v = Number(rpo[k]); b.pose[k] = Number.isFinite(v) ? cero(clamp(Math.round(v), lo, hi)) : 0; }

  // partes
  const lista = Array.isArray(r.partes) ? r.partes : [];
  if (lista.length > MAX_ENTRADAS) inc(I, 'HB-10', 'error', { detalle: `llegaron ${lista.length} piezas y solo se leen ${MAX_ENTRADAS}` });
  b.partes = [];
  const funcVistas = new Set();
  for (const e of lista.slice(0, MAX_ENTRADAS)) {
    if (!esObj(e)) continue;
    const d = typeof e.p === 'string' && Object.prototype.hasOwnProperty.call(PARTES, e.p) ? PARTES[e.p] : null;
    if (!d || d.retirada) { inc(I, 'HB-06', 'error', { pieza: String(e.p).slice(0, 30), motivo: 'desconocida' }); continue; }
    const A = typeof e.a === 'string' && Object.prototype.hasOwnProperty.call(ANCLAS, e.a) ? ANCLAS[e.a] : null;
    if (!A || !d.anclas.includes(e.a)) { inc(I, 'HB-07', 'error', { pieza: d.nombre, ancla: A ? A.nombre : String(e.a).slice(0, 30) }); continue; }
    if (d.cat === 'funcional') { if (funcVistas.has(d.id)) { inc(I, 'HB-14', 'recorte', { pieza: d.nombre }); continue; } funcVistas.add(d.id); }
    let sim = e.sim === 'espejo' ? 'espejo' : 'ninguna';
    if (sim === 'espejo' && d.lados !== 'par') { sim = 'ninguna'; inc(I, 'HB-07', 'recorte', { pieza: d.nombre, msg: `«${d.nombre}» es una pieza única: no se puede espejar.` }); }
    const out = { p: d.id, a: e.a, sim };
    if (A.lados === 2 && sim === 'ninguna') out.l = e.l === 'izq' ? 'izq' : 'der';
    const lim = limitesDe(d.id, e.a), rt = esObj(e.t) ? e.t : {};
    let recorte = false;
    const pos = [0, 1, 2].map((i) => { const v = fin(Number(rt.pos?.[i])) ? Number(rt.pos[i]) : 0; const c = clamp(v, ...lim.pos[i]); if (Math.abs(c - v) > 1e-9) recorte = true; return clamp(q(c, 500), ...lim.pos[i]); });
    const rot = [0, 1, 2].map((i) => { const v = fin(Number(rt.rot?.[i])) ? Number(rt.rot[i]) : 0; const c = clamp(v, ...lim.rot[i]); if (Math.abs(c - v) > 1e-9) recorte = true; return cero(clamp(Math.round(c), ...lim.rot[i])); });
    const ve = fin(Number(rt.esc)) ? Number(rt.esc) : 1, ce = clamp(ve, ...lim.esc); if (Math.abs(ce - ve) > 1e-9) recorte = true;
    const esc = clamp(q(ce, 100), ...lim.esc);
    if (recorte) inc(I, 'HB-08', 'recorte', { pieza: d.nombre });
    out.t = { pos, rot, esc };
    const rc = esObj(e.c) ? e.c : {};
    const mat = d.variantesMat.includes(rc.mat) ? rc.mat : d.variantesMat[0];
    const tinte = typeof rc.tinte === 'string' && HEX_RE.test(rc.tinte) ? rc.tinte.toLowerCase() : null;
    if (rc.tinte !== undefined && rc.tinte !== null && !tinte) inc(I, 'HB-15', 'recorte', { campo: 'tinte' });
    out.c = { mat, tinte };
    b.partes.push(out);
  }

  // HB-15 paleta
  const rl = esObj(r.pal) ? r.pal : {};
  const p1 = colorHex(rl.primario, PAL_DEFECTO.primario), p2 = colorHex(rl.secundario, PAL_DEFECTO.secundario), p3 = colorHex(rl.emisivo, PAL_DEFECTO.emisivo);
  const em = limitarBrillo(p3.v);
  for (const [k, c] of [['primario', p1], ['secundario', p2], ['emisivo', p3]]) if (rl[k] !== undefined && !c.ok) inc(I, 'HB-15', 'recorte', { campo: k });
  if (em.cambio) inc(I, 'HB-15', 'recorte', { campo: 'emisivo', msg: 'El color brillante se oscureció para no deslumbrar.' });
  b.pal = { primario: p1.v, secundario: p2.v, emisivo: em.v, acabado: ACABADOS.includes(rl.acabado) ? rl.acabado : 'archivo' };

  // meta
  const rm = esObj(r.meta) ? r.meta : {};
  b.meta = { creado: fin(Number(rm.creado)) ? clamp(Math.floor(Number(rm.creado)), 0, 4e12) : 0, editor: typeof rm.editor === 'string' && /^[A-Za-z0-9._-]{1,12}$/.test(rm.editor) ? rm.editor : EDITOR_VERSION };
  return b;
}
/** Build limpia y canónica. Nunca lanza. Idempotente. */
export function normalizar(raw) { try { return normalizarInterno(raw, []); } catch { return defecto(); } }

/* ───────── MIGRAR ───────── */
// Cada paso sube el esquema en 1 y NUNCA lanza. v0 = forma de borrador previa a la v1 (nombres antiguos de campos).
const PASOS_BUILD = [
  (o) => {
    if (o.prop === undefined && o.proporciones !== undefined) o.prop = o.proporciones;
    if (o.pal === undefined && o.paleta !== undefined) o.pal = o.paleta;
    if (o.pose === undefined && o.postura !== undefined) o.pose = o.postura;
    const lista = Array.isArray(o.partes) ? o.partes : Array.isArray(o.piezas) ? o.piezas : [];
    o.partes = lista.map((e) => (esObj(e) ? {
      p: e.p ?? e.pieza, a: e.a ?? e.ancla, sim: e.sim ?? (e.simetria === true || e.simetria === 'espejo' ? 'espejo' : 'ninguna'), l: e.l ?? e.lado,
      t: e.t ?? { pos: e.pos, rot: e.rot, esc: e.esc }, c: e.c ?? { mat: e.mat, tinte: e.tinte },
    } : e));
    delete o.proporciones; delete o.paleta; delete o.postura; delete o.piezas;
    return o;
  },
];
const copiaProfunda = (x) => { try { return JSON.parse(JSON.stringify(x)); } catch { return esObj(x) ? { ...x } : {}; } };
export function migrar(raw) {
  if (!esObj(raw)) return { build: {}, desde: 0, hasta: VERSION_BUILD, futuro: false };
  let o = copiaProfunda(raw);
  const desde = Number.isInteger(o.v) && o.v >= 0 ? o.v : 0;
  if (desde > VERSION_BUILD) return { build: o, desde, hasta: desde, futuro: true };
  for (let v = desde; v < VERSION_BUILD; v++) o = PASOS_BUILD[v](o);
  o.v = VERSION_BUILD; if (o.schema === undefined) o.schema = SCHEMA;
  return { build: o, desde, hasta: VERSION_BUILD, futuro: false };
}

/* ───────── EXPANDIR instancias (espejo = 2) ───────── */
export function instancias(build) {
  const out = [], lista = build && Array.isArray(build.partes) ? build.partes : [];
  lista.forEach((e, i) => {
    const d = e && PARTES[e.p], A = e && ANCLAS[e.a]; if (!d || !A) return;
    const mk = (lado, espejada) => ({ i, p: e.p, a: e.a, lado, hueso: A.lados === 2 ? A.huesos[lado] : A.huesos.c, t: e.t, c: e.c, espejada, cat: d.cat });
    if (e.sim === 'espejo') { out.push(mk('der', false), mk('izq', true)); }
    else out.push(mk(A.lados === 2 ? (e.l === 'izq' ? 'izq' : 'der') : 'c', false));
  });
  return out;
}

/* ───────── COSTE DE RENDER ───────── */
export function costeRender(build, calidad = 'low') {
  const ql = calidad === 'medium' || calidad === 'high' ? calidad : 'low';
  let tris = 0, halos = 0, cadenas = 0, telas = 0; const mats = new Set(); const ins = instancias(build);
  for (const x of ins) {
    const d = PARTES[x.p]; tris += d.tris[ql]; halos += d.extra.halo; cadenas += d.extra.cadena; telas += d.extra.tela;
    mats.add(x.c && d.variantesMat.includes(x.c.mat) ? x.c.mat : d.mats[0]); for (const m of d.mats.slice(1)) mats.add(m);
  }
  const llamadas = mats.size + halos + cadenas + telas, T = TOPES_RENDER;
  return {
    tris, llamadas, materiales: [...mats], halos, cadenas, telas, instancias: ins.length, topes: T,
    pctTris: Math.round(tris / T.tris * 1000) / 10, pctLlamadas: Math.round(llamadas / T.llamadas * 1000) / 10,
    excede: tris > T.tris || llamadas > T.llamadas || mats.size > T.materiales || halos > T.halos || cadenas > T.cadenas || telas > T.telas,
  };
}

/* ───────── DERIVAR ESTADÍSTICAS ───────── */
// Entradas permitidas: ids de piezas FUNCIONALES (p) y ctx.evo. Nada más. Prohibido leer prop, t, esc, pos, rot, a, sim, pal, c, base, pose, nombre, meta.
export function derivarStats(build, ctx = {}) {
  const evo = Number.isInteger(ctx && ctx.evo) ? clamp(ctx.evo, 0, 4) : 0;
  const lista = build && Array.isArray(build.partes) ? build.partes : [];
  const set = new Set();
  for (const e of lista) { const d = e && typeof e.p === 'string' && Object.prototype.hasOwnProperty.call(PARTES, e.p) ? PARTES[e.p] : null; if (d && d.cat === 'funcional' && d.organ && CHAMP_ORGANS[d.organ]) set.add(d.organ); }
  const organos = Object.keys(CHAMP_ORGANS).filter((id) => set.has(id));       // orden canónico: el orden de `partes` no cambia nada
  const max = champOrganSlots(evo), cap = { usado: organos.length, max, excede: organos.length > max };
  const mult = {};
  for (const id of organos) Object.assign(mult, ORGANO_EFECTO[id]);
  const bn = {}; for (const k of Object.keys(CAPS)) if (k in mult) bn[k] = mult[k];
  capBn(bn);
  const resumen = { ...CHASIS.laboratorio.resumenBase };
  for (const id of organos) for (const [k, dlt] of Object.entries(ORGANO_EJES[id] || {})) resumen[k] = (resumen[k] || 0) + dlt;
  for (const k of Object.keys(resumen)) resumen[k] = clamp(Math.round(resumen[k]), 0, 10);
  const efectos = organos.map((id) => ({ id, nombre: CHAMP_ORGANS[id].name, desc: CHAMP_ORGANS[id].desc, costeRanuras: 1 }));
  return { cap, organos, efectos, mult, bn, resumen, base: { hp: CHASIS.laboratorio.hp, speed: CHASIS.laboratorio.speed } };
}

/* ───────── HUELLA ───────── */
export function canonico(build) {
  const b = normalizar(build), { meta, ...r } = b; void meta;
  r.partes = [...b.partes].sort((x, y) => { const a = estable(x), c = estable(y); return a < c ? -1 : a > c ? 1 : 0; });
  return r;
}
export const huella = (build) => hashTexto(estable(canonico(build)));
/** Build lista para guardar/mostrar: normalizada + `cap` y `h` derivados. */
export function sellar(build, ctx = {}) { const b = normalizar(build), c = derivarStats(b, ctx).cap; return { ...b, cap: { usado: c.usado, max: c.max }, h: huella(b) }; }

/* ───────── VB1: formato de red compacto ───────── */
const PREFIJO_VB1 = 'VB1:';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function aB64Url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0), rest = bytes.length - i;
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (rest > 1 ? B64[(n >> 6) & 63] : '') + (rest > 2 ? B64[n & 63] : '');
  }
  return s;
}
function deB64Url(s) {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  const out = []; let acc = 0, bits = 0;
  for (const ch of s) { acc = (acc << 6) | B64.indexOf(ch); bits += 6; if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); acc &= (1 << bits) - 1; } }
  return Uint8Array.from(out);
}
const utf8 = (s) => new TextEncoder().encode(s);
const sinUtf8 = (b) => new TextDecoder('utf-8', { fatal: true }).decode(b);
const hexBytes = (h) => rgbDe(h);
const bytesHex = (a) => aHex(a);
const s8 = (n) => (n < 0 ? n + 256 : n);
const u8s = (n) => (n > 127 ? n - 256 : n);

/** build → 'VB1:…'. Cuantiza como normalizar(), así decodificar(codificar(b)) ≡ normalizar(b) (salvo meta). */
export function codificar(build) {
  const b = normalizar(build), o = [];
  o.push(1);                                                          // versión del formato VB1
  const id = b.id.slice(4); o.push(id.length); for (const ch of id) o.push(ch.charCodeAt(0));
  const nom = utf8(b.nombre); o.push(nom.length); o.push(...nom);
  o.push(PRESETS.indexOf(b.base.preset)); o.push(...hexBytes(b.base.piel));
  for (const k of PROP_ORDEN) o.push(Math.round((b.prop[k] - 0.8) * 200));
  o.push(s8(b.pose.inclinacion), s8(b.pose.hombros));
  o.push(...hexBytes(b.pal.primario), ...hexBytes(b.pal.secundario), ...hexBytes(b.pal.emisivo), ACABADOS.indexOf(b.pal.acabado));
  o.push(b.partes.length);
  for (const e of b.partes) {
    const A = ANCLAS[e.a];
    o.push(ORDEN_PARTES.indexOf(e.p));
    o.push((ORDEN_ANCLAS.indexOf(e.a) << 4) | (e.c.tinte ? 4 : 0) | (A.lados === 2 && e.l === 'der' ? 2 : 0) | (e.sim === 'espejo' ? 1 : 0));
    for (const v of e.t.pos) o.push(Math.round(v * 500) + 128);
    for (const v of e.t.rot) o.push(s8(v));
    o.push(Math.round(e.t.esc * 100)); o.push(MATERIALES_KIT.indexOf(e.c.mat));
    if (e.c.tinte) o.push(...hexBytes(e.c.tinte));
  }
  return PREFIJO_VB1 + aB64Url(Uint8Array.from(o));
}

/** 'VB1:…' → { ok, build, mensaje }. Nunca lanza. El resultado pasa por normalizar(). */
export function decodificar(texto) {
  const mal = (mensaje) => ({ ok: false, build: null, mensaje });
  try {
    if (typeof texto !== 'string') return mal('El diseño no es un texto.');
    const t = texto.trim();
    if (!t.startsWith(PREFIJO_VB1)) return mal('Ese texto no es un diseño de Huésped (falta «VB1:»).');
    if (t.length > BUILD_BYTES_MAX) return mal('El diseño es demasiado grande.');
    const by = deB64Url(t.slice(PREFIJO_VB1.length)); if (!by) return mal('El diseño está cortado o dañado.');
    let i = 0;
    const get = () => { if (i >= by.length) throw new RangeError('fin'); return by[i++]; };
    if (get() !== 1) return mal('El diseño es de una versión más nueva del formato.');
    const idl = get(); if (idl < 6 || idl > 24) return mal('El código del diseño no es válido.');
    let id = 'lab-'; for (let k = 0; k < idl; k++) id += String.fromCharCode(get());
    const nl = get(); if (nl > 96) return mal('El nombre del diseño no es válido.');
    const nb = []; for (let k = 0; k < nl; k++) nb.push(get());
    const nombre = sinUtf8(Uint8Array.from(nb));
    const pre = PRESETS[get()]; if (!pre) return mal('El cuerpo base del diseño no existe.');
    const piel = bytesHex([get(), get(), get()]);
    const prop = {}; for (const k of PROP_ORDEN) prop[k] = (get() + 160) / 200;
    const pose = { inclinacion: u8s(get()), hombros: u8s(get()) };
    const pal = { primario: bytesHex([get(), get(), get()]), secundario: bytesHex([get(), get(), get()]), emisivo: bytesHex([get(), get(), get()]) };
    const ac = ACABADOS[get()]; if (!ac) return mal('El acabado del diseño no existe.'); pal.acabado = ac;
    const n = get(); if (n > MAX_ENTRADAS) return mal('El diseño trae demasiadas piezas.');
    const partes = [];
    for (let k = 0; k < n; k++) {
      const p = ORDEN_PARTES[get()], fl = get(), a = ORDEN_ANCLAS[fl >> 4]; if (!p || !a) return mal('El diseño usa una pieza o un ancla que esta versión no conoce.');
      const pos = [(get() - 128) / 500, (get() - 128) / 500, (get() - 128) / 500], rot = [u8s(get()), u8s(get()), u8s(get())], esc = get() / 100, mi = get(), mat = MATERIALES_KIT[mi];
      if (!mat) return mal('El diseño usa un material que esta versión no conoce.');
      const e = { p, a, sim: fl & 1 ? 'espejo' : 'ninguna', t: { pos, rot, esc }, c: { mat, tinte: fl & 4 ? bytesHex([get(), get(), get()]) : null } };
      if (ANCLAS[a].lados === 2 && !(fl & 1)) e.l = fl & 2 ? 'der' : 'izq';
      partes.push(e);
    }
    if (i !== by.length) return mal('El diseño trae datos de más: está dañado.');
    return { ok: true, build: normalizar({ schema: SCHEMA, v: VERSION_BUILD, id, nombre, rig: RIG, chasis: CHASIS_ID, base: { preset: pre, piel }, prop, pose, partes, pal }), mensaje: '' };
  } catch { return mal('El diseño está cortado o dañado.'); }
}

/* ───────── VALIDAR ───────── */
const conjuntoDe = (x) => (x instanceof Set ? x : Array.isArray(x) ? new Set(x) : null);
const ladosChocan = (a, b) => a === b || a === 'c' || b === 'c';
/** Choques entre piezas (HB-09): [{ i, j, detalle }] con los índices de las ENTRADAS de `partes`. `choca_con` y ranuras `ocupa` (por lado). */
export function conflictos(build) {
  const out = [], vistos = new Set(), lista = build && Array.isArray(build.partes) ? build.partes : [];
  const add = (i, j, detalle) => { const k = i < j ? i + ',' + j : j + ',' + i; if (!vistos.has(k)) { vistos.add(k); out.push({ i: Math.min(i, j), j: Math.max(i, j), detalle }); } };
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
    const A = PARTES[lista[i] && lista[i].p], B = PARTES[lista[j] && lista[j].p]; if (!A || !B) continue;
    if (A.choca_con.includes(B.id) || B.choca_con.includes(A.id)) add(i, j, `«${A.nombre}» no se lleva con «${B.nombre}»`);
  }
  const ocupadas = new Map();
  for (const x of instancias(build)) for (const sl of PARTES[x.p].ocupa) {
    const previos = ocupadas.get(sl) || [];
    for (const y of previos) if (y.i !== x.i && ladosChocan(y.lado, x.lado)) add(x.i, y.i, `«${PARTES[x.p].nombre}» y «${PARTES[y.p].nombre}» ocupan el mismo lugar (${sl.replace('.', ' · ')})`);
    previos.push(x); ocupadas.set(sl, previos);
  }
  return out;
}
/** Reglas que NO se arreglan solas al normalizar (HB-05, 09, 10, 11, 12, 13, 16, 17, 06-posesión). */
function reglas(b, ctx, E) {
  const ins = instancias(b), T = TOPES_RENDER, P = b.prop, REL = PROP_RELACIONES;
  // HB-05
  if (Math.abs(P.brazos - P.hombros) > REL.brazosHombrosMax + 1e-9) inc(E, 'HB-05', 'error', { detalle: `brazos y hombros no pueden diferir más de ${REL.brazosHombrosMax}` });
  if (P.altura * P.piernas > REL.alturaPiernasMax + 1e-9) inc(E, 'HB-05', 'error', { detalle: `altura × piernas no puede pasar de ${REL.alturaPiernasMax} (tendrías las piernas fuera del suelo)` });
  if (P.cabeza > REL.cabezaSobreHombrosMax * P.hombros + 1e-9) inc(E, 'HB-05', 'error', { detalle: 'la cabeza no puede ser más de 1,2 veces el ancho de hombros' });
  // HB-06 posesión
  const tiene = conjuntoDe(ctx.poseidas);
  if (tiene) for (const id of new Set(b.partes.map((e) => e.p))) if (!tiene.has(id)) inc(E, 'HB-06', 'error', { pieza: PARTES[id].nombre, id, motivo: 'bloqueada' });
  // HB-09 choques
  for (const c of conflictos(b)) inc(E, 'HB-09', 'error', { detalle: c.detalle, i: c.i, j: c.j });
  // HB-10 cantidades
  if (ins.length > T.instanciasTotal) inc(E, 'HB-10', 'error', { detalle: `hay ${ins.length} piezas dibujadas y el máximo es ${T.instanciasTotal} (una pieza espejada cuenta dos)` });
  const porAncla = {}; for (const x of ins) porAncla[x.a] = (porAncla[x.a] || 0) + 1;
  for (const [a, n] of Object.entries(porAncla)) if (n > T.instanciasPorAncla) inc(E, 'HB-10', 'error', { detalle: `en «${ANCLAS[a].nombre}» hay ${n} piezas y el máximo es ${T.instanciasPorAncla}`, ancla: a });
  // HB-11 presupuesto de render
  const R = costeRender(b, 'low'); const partes = [];
  if (R.tris > T.tris) partes.push(`${R.tris} de ${T.tris} triángulos`);
  if (R.llamadas > T.llamadas) partes.push(`${R.llamadas} de ${T.llamadas} llamadas de dibujo`);
  if (R.materiales.length > T.materiales) partes.push(`${R.materiales.length} de ${T.materiales} materiales`);
  if (R.halos > T.halos) partes.push(`${R.halos} de ${T.halos} halos`);
  if (R.cadenas > T.cadenas) partes.push(`${R.cadenas} de ${T.cadenas} cadenas móviles`);
  if (R.telas > T.telas) partes.push(`${R.telas} de ${T.telas} telas`);
  if (partes.length) inc(E, 'HB-11', 'error', { detalle: partes.join('; ') });
  // HB-12 mano derecha
  if (ctx.manoDerechaOcupada !== false && ins.some((x) => x.a === 'manos' && x.lado === 'der')) inc(E, 'HB-12', 'error', {});
  // HB-13 capacidad
  const S = derivarStats(b, ctx);
  if (S.cap.excede) inc(E, 'HB-13', 'error', { usado: S.cap.usado, max: S.cap.max });
  // HB-16 anti-oclusión
  const AO = ANTI_OCLUSION; let vol = 0, volCabeza = 0, tapa = false;
  for (const x of ins) { const d = PARTES[x.p], v = d.volumen * Math.pow(x.t.esc, 3); vol += v; if (x.a === 'cabeza') { volCabeza += v; if (!d.despeja_cara) tapa = true; } }
  if (vol > AO.volumenCuerpo * AO.razonMax + 1e-12) inc(E, 'HB-16', 'error', { detalle: 'el conjunto de piezas es demasiado voluminoso comparado con el cuerpo' });
  if (volCabeza > AO.cabezaMax + 1e-12) inc(E, 'HB-16', 'error', { detalle: 'hay demasiado volumen sobre la cabeza' });
  if (tapa) inc(E, 'HB-16', 'error', { detalle: 'una pieza taparía la cara' });
  return { render: R, stats: S };
}

/**
 * Valida cualquier cosa que parezca un diseño. NUNCA lanza.
 * → { ok, build (segura y sellada), errores, avisos, cap, render, stats, h, bloqueadas }
 */
export function validar(raw, ctx = {}) {
  const c = esObj(ctx) ? ctx : {}, E = [], avisosInternos = [];
  let b, extra = null;
  try {
    const m = migrar(raw);
    if (!esObj(raw)) { inc(E, 'HB-01', 'error', {}); b = defecto(); }
    else if (m.futuro) { inc(E, 'HB-01', 'error', { msg: MENSAJES['HB-01'] }); b = defecto(); }
    else {
      if (m.build.schema !== undefined && m.build.schema !== SCHEMA) inc(E, 'HB-01', 'error', {});
      b = normalizarInterno(m.build, avisosInternos);
      extra = reglas(b, c, E);
      if (esObj(raw) && typeof raw.h === 'string' && raw.h !== huella(b)) inc(avisosInternos, 'HB-18', 'aviso', {});
      const bytes = codificar(b).length; if (bytes > BUILD_BYTES_MAX) inc(E, 'HB-17', 'error', { bytes, max: BUILD_BYTES_MAX });
    }
  } catch { E.push({ codigo: 'HB-01', sev: 'error', msg: MENSAJES['HB-01'] }); b = defecto(); extra = null; }
  const todas = [...avisosInternos, ...E];
  const errores = todas.filter((x) => x.sev === 'error'), avisos = todas.filter((x) => x.sev !== 'error');
  const S = extra ? extra.stats : derivarStats(b, c), R = extra ? extra.render : costeRender(b, c.calidad);
  const tiene = conjuntoDe(c.poseidas);
  const bloqueadas = tiene ? [...new Set(b.partes.map((e) => e.p))].filter((id) => !tiene.has(id)) : [];
  return { ok: errores.length === 0, build: { ...b, cap: { usado: S.cap.usado, max: S.cap.max }, h: huella(b) }, errores, avisos, cap: S.cap, render: R, stats: S, h: huella(b), bloqueadas };
}

/** Para JUGAR: una build inválida se cambia por la del chasis por defecto (no se expulsa a nadie). */
export function usable(raw, ctx = {}) {
  const r = validar(raw, ctx);
  if (r.ok) return { build: r.build, ok: true, defecto: false, errores: [], avisos: r.avisos, h: r.h };
  const d = defecto();
  return { build: { ...d, cap: { usado: 0, max: derivarStats(d, ctx).cap.max }, h: huella(d) }, ok: false, defecto: true, errores: r.errores, avisos: r.avisos, h: huella(d) };
}

/** Texto en español de las incidencias, para mostrar en una lista. */
export const textosDe = (lista) => (Array.isArray(lista) ? lista.map((x) => `${x.codigo}: ${x.msg}`) : []);
