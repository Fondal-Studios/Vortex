// PERFIL DEL LABORATORIO (EH-12, docs/EDITOR_HUESPEDES.md §3.5). Módulo PURO: sin DOM ni almacenamiento (perfil.js lo usa y guarda).
//   perfil.lab = { v: 1, activo: 'lab-…' | null, slots: [diseño × hasta 8], piezas: [ids que el jugador posee], prog: { partidas, victorias, bajas }, rec: [matchId ya contados] }
// · Nada se vende: las piezas se GANAN JUGANDO. Cada desbloqueo cuelga de un RECIBO del ledger de recompensas (src/sim/ledger.js):
//   el ledger ya impide cobrar dos veces un mismo matchId (AC-09); además `rec` recuerda los matchId contados aquí, así que reintentos y recargas no duplican nada.
// · Exportar/importar: texto «VORTEX-HUESPED-1:» + base64 con huella. IMPORTAR NUNCA OTORGA PIEZAS: las que no tengas quedan «bloqueadas».
// · El esquema del perfil sube 1 → 2 (src/sim/perfil-esquema.js) con `limpiarLab` como paso de migración: un perfil viejo abre sin perder nada.
import { matchIdValido } from './ledger.js';
import { normalizar, validar, usable, huella, idNuevo, ORDEN_PARTES, PARTES, PIEZAS_INICIALES } from '../shared/host-build.js';

export const LAB_V = 1;
export const LAB_MAX_DISENOS = 8;
export const LAB_MAX_SNAPSHOTS = 5;
export const LAB_REC_MAX = 50;
export const PREFIJO_HUESPED = 'VORTEX-HUESPED-1:';
export const ESQUEMA_HUESPED = 1;
const nn = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

/* ───────── piezas ───────── */
/** Cómo se consigue cada pieza: 'inicial' | 'victorias:N' | 'bajas:N' | 'partidas:N' | 'esencia:<recurso>' (= haber hecho crecer ese órgano en una partida). */
export function reglaObtencion(texto) {
  const m = /^(inicial|victorias|bajas|partidas|esencia)(?::(\w+))?$/.exec(String(texto || ''));
  if (!m) return null;
  return m[1] === 'inicial' ? { tipo: 'inicial' } : m[1] === 'esencia' ? { tipo: 'esencia', recurso: m[2] || '' } : { tipo: m[1], n: Math.max(1, parseInt(m[2], 10) || 1) };
}
/** Texto en español de cómo conseguir una pieza (para la interfaz). */
export function comoSeConsigue(id) {
  const d = PARTES[id], r = d && reglaObtencion(d.obtencion); if (!r) return '';
  return r.tipo === 'inicial' ? 'La tenés desde el principio.' : r.tipo === 'victorias' ? `Ganá ${r.n} ${r.n === 1 ? 'misión' : 'misiones'}.` : r.tipo === 'bajas' ? `Derrotá ${r.n} criaturas jugando.` : r.tipo === 'partidas' ? `Jugá ${r.n} partidas.` : `Hacé crecer el órgano «${d.nombre}» durante una partida (se compra con esencias de ${r.recurso}).`;
}

/* ───────── limpieza del perfil ───────── */
const limpiarProg = (p) => { const o = p && typeof p === 'object' ? p : {}; return { partidas: nn(o.partidas, 1e6), victorias: nn(o.victorias, 1e6), bajas: nn(o.bajas, 1e8) }; };
const limpiarPiezas = (a) => { const s = new Set(PIEZAS_INICIALES); if (Array.isArray(a)) for (const id of a) if (typeof id === 'string' && Object.hasOwn(PARTES, id)) s.add(id); return ORDEN_PARTES.filter((id) => s.has(id)); };
/** Un diseño guardado: build normalizada + h + snapshots (hasta 5 builds completas, sin snapshots propios). */
function limpiarDiseno(raw) {
  const b = normalizar(raw), out = { ...b, h: huella(b) };
  const snaps = raw && Array.isArray(raw.snap) ? raw.snap.slice(0, LAB_MAX_SNAPSHOTS) : [];
  out.snap = snaps.filter((s) => s && typeof s === 'object').map((s) => { const n = normalizar(s); return { ...n, h: huella(n), etiqueta: typeof s.etiqueta === 'string' ? s.etiqueta.replace(/[\u0000-\u001f<>&"'`]/g, '').trim().slice(0, 24) : '' }; });
  return out;
}
/** Sanea `perfil.lab` venga de donde venga (disco, copia de seguridad, cuenta). Nunca lanza. Idempotente. */
export function limpiarLab(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const slots = [], ids = new Set();
  for (const s of Array.isArray(o.slots) ? o.slots.slice(0, 64) : []) {
    if (!s || typeof s !== 'object' || slots.length >= LAB_MAX_DISENOS) continue;
    const d = limpiarDiseno(s); if (ids.has(d.id)) continue;
    ids.add(d.id); slots.push(d);
  }
  const rec = []; if (Array.isArray(o.rec)) for (const r of o.rec) if (matchIdValido(r) && !rec.includes(r)) rec.push(r);
  return { v: LAB_V, activo: typeof o.activo === 'string' && ids.has(o.activo) ? o.activo : null, slots, piezas: limpiarPiezas(o.piezas), prog: limpiarProg(o.prog), rec: rec.slice(-LAB_REC_MAX) };
}

/* ───────── diseños ───────── */
const ok = (lab, extra = {}) => ({ ok: true, lab, mensaje: '', ...extra });
const mal = (lab, mensaje) => ({ ok: false, lab, mensaje });
/** Guarda (o reemplaza por id) un diseño. Debe ser estructuralmente válido; poseer las piezas NO se exige para guardar (sí para jugar). */
export function guardarDiseno(lab0, build) {
  const lab = limpiarLab(lab0), r = validar(build, { evo: 4 });
  if (!r.ok) return mal(lab, r.errores[0].msg);
  const d = limpiarDiseno({ ...r.build, snap: build && build.snap }), i = lab.slots.findIndex((s) => s.id === d.id);
  if (i >= 0) lab.slots[i] = d;
  else if (lab.slots.length >= LAB_MAX_DISENOS) return mal(lab, `Ya tenés ${LAB_MAX_DISENOS} diseños: borrá uno para guardar otro.`);
  else lab.slots.push(d);
  if (!lab.activo) lab.activo = d.id;
  return ok(limpiarLab(lab), { build: d });
}
export function borrarDiseno(lab0, id) {
  const lab = limpiarLab(lab0), n = lab.slots.length; lab.slots = lab.slots.filter((s) => s.id !== id);
  if (lab.slots.length === n) return mal(lab, 'Ese diseño no existe.');
  if (lab.activo === id) lab.activo = null;
  return ok(lab);
}
export function elegirActivo(lab0, id) {
  const lab = limpiarLab(lab0); if (id !== null && !lab.slots.some((s) => s.id === id)) return mal(lab, 'Ese diseño no existe.');
  lab.activo = id; return ok(lab);
}
export function disenoActivo(lab0) { const lab = limpiarLab(lab0); return lab.slots.find((s) => s.id === lab.activo) || null; }
/** El diseño con el que se JUEGA: validado contra lo que el jugador posee y su evolución. Si no se puede, el chasis por defecto (y por qué). */
export function disenoParaJugar(lab0, evo = 0) {
  const lab = limpiarLab(lab0), d = lab.slots.find((s) => s.id === lab.activo);
  if (!d) return { build: null, defecto: true, errores: [], bloqueadas: [] };
  const u = usable(d, { evo, poseidas: lab.piezas });
  return { build: u.ok ? u.build : null, defecto: !u.ok, errores: u.errores, bloqueadas: validar(d, { evo, poseidas: lab.piezas }).bloqueadas };
}

/* ───────── desbloqueo de piezas por recibos ───────── */
/** Piezas que se desbloquean con este progreso. `organos` = órganos de campeón que el jugador tenía al terminar la partida. */
export function piezasGanadas(prog, organos = []) {
  const out = [];
  for (const id of ORDEN_PARTES) {
    const r = reglaObtencion(PARTES[id].obtencion); if (!r) continue;
    const logrado = r.tipo === 'inicial' || (r.tipo === 'victorias' && prog.victorias >= r.n) || (r.tipo === 'bajas' && prog.bajas >= r.n) || (r.tipo === 'partidas' && prog.partidas >= r.n)
      || (r.tipo === 'esencia' && PARTES[id].organ && organos.includes(PARTES[id].organ));
    if (logrado) out.push(id);
  }
  return out;
}
/**
 * Cuenta un recibo del ledger { id, won, … } y desbloquea lo que corresponda. IDEMPOTENTE: el mismo matchId no suma dos veces.
 * extra = { kills, organos }. → { lab, nuevas[] (piezas recién ganadas), duplicado }
 */
export function otorgarPorRecibo(lab0, recibo, extra = {}) {
  const lab = limpiarLab(lab0);
  if (!recibo || typeof recibo !== 'object' || !matchIdValido(recibo.id)) return { lab, nuevas: [], duplicado: false, invalido: true };
  if (lab.rec.includes(recibo.id)) return { lab, nuevas: [], duplicado: true };
  lab.rec = [...lab.rec, recibo.id].slice(-LAB_REC_MAX);
  lab.prog = { partidas: nn(lab.prog.partidas + 1, 1e6), victorias: nn(lab.prog.victorias + (recibo.won === true ? 1 : 0), 1e6), bajas: nn(lab.prog.bajas + nn(extra.kills ?? recibo.kills, 1e5), 1e8) };
  const antes = new Set(lab.piezas), organos = Array.isArray(extra.organos) ? extra.organos.filter((x) => typeof x === 'string') : [];
  lab.piezas = limpiarPiezas([...lab.piezas, ...piezasGanadas(lab.prog, organos)]);
  return { lab, nuevas: lab.piezas.filter((id) => !antes.has(id)), duplicado: false };
}

/* ───────── exportar / importar ───────── */
const aB64 = (s) => { const b = new TextEncoder().encode(s); let t = ''; for (const x of b) t += String.fromCharCode(x); return btoa(t); };
const deB64 = (s) => { const t = atob(s); return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(t, (c) => c.charCodeAt(0))); };
/** Texto para copiar y pegar: PREFIJO + base64 de { app, esq, at, h, build }. `h` = huella del contenido del diseño. */
export function exportar(build, ahora = Date.now()) {
  const b = normalizar(build);
  return PREFIJO_HUESPED + aB64(JSON.stringify({ app: 'vortex', esq: ESQUEMA_HUESPED, at: Math.max(0, Math.floor(ahora) || 0), h: huella(b), build: b }));
}
/**
 * Lee un texto exportado. NO modifica el perfil. → { ok, build, bloqueadas[], mensaje }
 * Rechaza texto cortado, editado (la huella no coincide), de una versión más nueva o estructuralmente inválido.
 * `lab.piezas` solo sirve para MARCAR cuáles quedan bloqueadas: importar nunca regala nada.
 */
export function leerExportado(texto, lab0 = null) {
  const lab = limpiarLab(lab0), t = String(texto || '').trim();
  const mal2 = (mensaje) => ({ ok: false, build: null, bloqueadas: [], mensaje });
  if (!t.startsWith(PREFIJO_HUESPED)) return mal2('Ese texto no es un diseño de Huésped de Vortex. Pegalo completo, sin cortar.');
  if (t.length > 20000) return mal2('El texto es demasiado largo para ser un diseño.');
  let d; try { d = JSON.parse(deB64(t.slice(PREFIJO_HUESPED.length).replace(/\s+/g, ''))); } catch { return mal2('El diseño está incompleto o dañado. Probá copiarlo de nuevo.'); }
  if (!d || d.app !== 'vortex' || !d.build || typeof d.build !== 'object') return mal2('El texto no trae un diseño válido.');
  if (!Number.isInteger(d.esq) || d.esq > ESQUEMA_HUESPED) return mal2('Ese diseño es de una versión más nueva del juego. Actualizá el juego primero.');
  const r = validar(d.build, { evo: 4 });
  if (d.h !== huella(r.build)) return mal2('El diseño no coincide con su huella (se cortó o se editó). No se usó.');
  if (!r.ok) return mal2(r.errores[0].msg);
  return { ok: true, build: r.build, bloqueadas: [...new Set(r.build.partes.map((e) => e.p))].filter((id) => !lab.piezas.includes(id)), mensaje: '' };
}
/**
 * Importa un diseño EXPORTADO como diseño nuevo (con id propio para no pisar uno existente). NO otorga piezas.
 * azar se inyecta (pruebas). → { ok, lab, build, bloqueadas, mensaje }
 */
export function importar(texto, lab0, azar = Math.random) {
  const lab = limpiarLab(lab0), l = leerExportado(texto, lab); if (!l.ok) return { ok: false, lab, build: null, bloqueadas: [], mensaje: l.mensaje };
  let id = l.build.id; if (lab.slots.some((s) => s.id === id)) { do id = idNuevo(azar); while (lab.slots.some((s) => s.id === id)); }
  const g = guardarDiseno(lab, { ...l.build, id });
  if (!g.ok) return { ok: false, lab, build: null, bloqueadas: [], mensaje: g.mensaje };
  return { ok: true, lab: g.lab, build: g.build, bloqueadas: l.bloqueadas, mensaje: l.bloqueadas.length ? `Importado. Tenés ${l.bloqueadas.length} pieza(s) bloqueada(s): se ven, pero no podés jugar con ellas hasta conseguirlas.` : 'Diseño importado.' };
}
