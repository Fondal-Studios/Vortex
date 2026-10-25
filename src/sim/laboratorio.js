// LABORATORIO en la simulación (EH-05, docs/EDITOR_HUESPEDES.md §3.2–3.3). Módulo puro, sin DOM.
// Une el diseño del jugador (CustomHostBuild, src/shared/host-build.js) con el chasis `CHARACTERS.laboratorio`.
//
// REGLAS DE ORO (cada una tiene su prueba en tests/lab-sim.test.js):
//  1. La simulación solo lee de un diseño QUÉ ÓRGANOS DE CAMPEÓN tiene (ids de piezas funcionales). Nada de prop/t/esc/pos/rot/a/sim/pal/c/base/pose.
//  2. El tamaño visual NUNCA entra en un cálculo de combate. La hitbox es única (PLAYER.radius) y hp/speed del chasis son 1.
//  3. Un diseño ilegal NO expulsa a nadie: se juega con el chasis por defecto (sin órganos) y se deja un aviso en español.
//  4. El poder máximo de un diseño es el de un oficial con los MISMOS órganos: se cargan con loadOrgans/organError (ranuras 1 + evo).
//  5. El servidor es la autoridad: `labDe` valida y recalcula todo; lo que declare el cliente (cap, h, stats) se descarta.
import { usable, derivarStats, codificar, decodificar, huella, defecto, BUILD_BYTES_MAX } from '../shared/host-build.js';
import { loadOrgans } from './organos.js';
import { capBn } from './items.js';
import { ERRORES } from './red.js';

export const CHASIS_LAB = 'laboratorio';
export const LAB_MAX_CHARS = BUILD_BYTES_MAX;      // un diseño en la red no pasa de 2 KB (HB-17)

/**
 * Lo que llega (texto VB1 de la red, u objeto de diseño del perfil) → resultado seguro.
 * → { hay (se mandó algo), build (válida; si no, la por defecto), vb1, h, ok, defecto, aviso (español o ''), organos[] }
 */
export function labDe(raw, ctx = {}) {
  const c = { evo: Number.isInteger(ctx && ctx.evo) ? ctx.evo : 0, poseidas: ctx && ctx.poseidas };
  if (raw === undefined || raw === null || raw === '') return { hay: false, build: null, vb1: '', h: '', ok: true, defecto: true, aviso: '', organos: [] };
  let crudo = raw, aviso = '';
  if (typeof raw === 'string') {
    if (raw.length > LAB_MAX_CHARS) return conAviso(c, 'el diseño es demasiado grande');
    const d = decodificar(raw);
    if (!d.ok) return conAviso(c, d.mensaje);
    crudo = d.build;
  } else if (typeof raw !== 'object') return conAviso(c, 'formato desconocido');
  const u = usable(crudo, c);
  if (!u.ok) return conAviso(c, u.errores[0] ? u.errores[0].msg : 'no es válido');
  const S = derivarStats(u.build, c);
  return { hay: true, build: u.build, vb1: codificar(u.build), h: u.h, ok: true, defecto: false, aviso, organos: S.organos };
}
function conAviso(c, motivo) {
  const d = defecto(), b = { ...d, cap: { usado: 0, max: derivarStats(d, c).cap.max }, h: huella(d) };
  return { hay: true, build: b, vb1: '', h: b.h, ok: false, defecto: true, aviso: `${ERRORES.lab} (${String(motivo).replace(/\s+/g, ' ').slice(0, 120)})`, organos: [] };
}

/**
 * Aplica un diseño a un jugador de la partida (llamar justo después de initHost, en lugar de cargar `corg` del perfil).
 * Deja: p.corg (SOLO los órganos del diseño), p.lb (índice del diseño en g.labs, 1..4; 0 = aspecto por defecto), p.lbAviso, p.labH.
 */
export function applyLab(p, raw, g = null) {
  const r = labDe(raw, { evo: p.evo | 0 });
  p.corg = []; p.lb = 0; p.lbAviso = r.aviso; p.labH = r.defecto ? '' : r.h;
  if (r.organos.length) loadOrgans(p, { corg: r.organos });      // mismas reglas que un oficial: organError (ranuras 1 + evo)
  if (p.bn) capBn(p.bn);
  if (g && r.hay && !r.defecto) {
    g.labs = g.labs || [];
    let i = g.labs.findIndex((l) => l.h === r.h);
    if (i < 0) { g.labs.push({ h: r.h, vb1: r.vb1 }); i = g.labs.length - 1; }
    p.lb = i + 1;
  }
  return r;
}
/** Recorta p.bn a CAPS al final de la cadena de bonos (bendiciones, maestría, equipo): el laboratorio NUNCA pasa de los topes. */
export function capLab(p) { if (p && p.char === CHASIS_LAB && p.bn) capBn(p.bn); }
/** Quita el diseño (el jugador cambió de Huésped). */
export function clearLab(p) { p.lb = 0; p.lbAviso = ''; p.labH = ''; }

/** Lista de diseños de la partida para mandar a los clientes: [{ i (= `lb` del snapshot), h, vb1 }]. */
export const labsDeRed = (g) => (g && Array.isArray(g.labs) ? g.labs.map((l, k) => ({ i: k + 1, h: l.h, vb1: l.vb1 })) : []);
