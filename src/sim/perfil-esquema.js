// ESQUEMA Y COPIA DE SEGURIDAD DEL PERFIL (Sprint 1, AC-09). Módulo PURO: sin DOM ni almacenamiento.
//  · `esq` = versión del esquema de GUARDADO (ledger de recompensas, cola de pendientes, copias). No confundir con `ver`, que lleva el onboarding (src/sim/desbloqueos.js).
//  · migrarEsquema(): lleva cualquier perfil viejo (sin esq, con `inv`, con núcleos como texto…) al esquema actual SIN perder nada.
//  · empaquetar()/desempaquetar(): la copia que el jugador descarga o pega (texto con huella para detectar cortes o ediciones).
import { limpiarLedger, limpiarCola, huella, estable } from './ledger.js';
import { limpiarLab } from './laboratorio-perfil.js';   // Laboratorio (docs/EDITOR_HUESPEDES.md §3.5)

export const ESQUEMA = 2;
export const PREFIJO_COPIA = 'VORTEX-COPIA-1:';

/** Pasos de migración: cada uno sube el esquema en 1. `desde` = esquema que traía el perfil. */
const PASOS = [
  // 0 → 1: perfiles anteriores al ledger. `inv` era el nombre viejo de `inventario`; los núcleos podían venir como texto; aparece el ledger de recompensas.
  (o) => {
    if (o.inventario === undefined && Array.isArray(o.inv)) o.inventario = o.inv;
    if (typeof o.cores === 'string') { const n = Math.floor(Number(o.cores)); o.cores = Number.isFinite(n) && n >= 0 ? n : 0; }
    o.ledger = limpiarLedger(o.ledger);
    return o;
  },
  // 1 → 2: aparece el Laboratorio (perfil.lab). Un perfil sin `lab` recibe el vacío (con las piezas iniciales); uno con `lab` se sanea. No se pierde nada.
  (o) => { o.lab = limpiarLab(o.lab); return o; },
];

/**
 * Devuelve { perfil, desde, hasta, futuro }. Nunca lanza: algo que no sea un objeto se toma como perfil vacío.
 * `futuro` = el perfil lo guardó una versión MÁS NUEVA del juego: se conserva tal cual y no hay que sobrescribirlo.
 */
export function migrarEsquema(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
  const desde = Number.isInteger(o.esq) && o.esq >= 0 ? o.esq : 0;
  if (desde > ESQUEMA) return { perfil: o, desde, hasta: desde, futuro: true };
  let p = o;
  for (let v = desde; v < ESQUEMA; v++) p = PASOS[v](p);
  p.esq = ESQUEMA; p.ledger = limpiarLedger(p.ledger); p.lab = limpiarLab(p.lab);
  return { perfil: p, desde, hasta: ESQUEMA, futuro: false };
}

/* ───────── copia de seguridad ───────── */
const aB64 = (s) => (typeof Buffer !== 'undefined' ? Buffer.from(s, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(s))));
const deB64 = (s) => (typeof Buffer !== 'undefined' ? Buffer.from(s, 'base64').toString('utf8') : decodeURIComponent(escape(atob(s))));

/** Texto de la copia: PREFIJO + base64 de { app, esq, at, h, perfil, cola }. `h` es la huella del contenido. */
export function empaquetar(perfil, cola = [], ahora = Date.now()) {
  const cuerpo = { perfil, cola: limpiarCola(cola) };
  return PREFIJO_COPIA + aB64(JSON.stringify({ app: 'vortex', esq: ESQUEMA, at: ahora, h: huella(estable(cuerpo)), ...cuerpo }));
}
/** Lee una copia. → { ok: true, perfil, cola, at } o { ok: false, mensaje (español) }. Rechaza texto cortado, editado o de una versión más nueva. */
export function desempaquetar(texto) {
  const t = String(texto || '').trim();
  if (!t.startsWith(PREFIJO_COPIA)) return { ok: false, mensaje: 'Ese texto no es una copia de Vortex. Pegá el texto completo, sin cortar.' };
  let d; try { d = JSON.parse(deB64(t.slice(PREFIJO_COPIA.length).replace(/\s+/g, ''))); } catch { return { ok: false, mensaje: 'La copia está incompleta o dañada. Probá copiarla de nuevo.' }; }
  if (!d || d.app !== 'vortex' || !d.perfil || typeof d.perfil !== 'object') return { ok: false, mensaje: 'La copia no tiene un perfil válido.' };
  if (!Number.isInteger(d.esq) || d.esq > ESQUEMA) return { ok: false, mensaje: 'La copia es de una versión más nueva del juego. Actualizá el juego primero.' };
  if (d.h !== huella(estable({ perfil: d.perfil, cola: limpiarCola(d.cola) }))) return { ok: false, mensaje: 'La copia no coincide con su huella (se cortó o se editó). No se usó.' };
  return { ok: true, perfil: d.perfil, cola: limpiarCola(d.cola), at: +d.at || 0 };
}
