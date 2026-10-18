// DANZANTE — el duelista acrobático (docs/HUESPEDES.md → «Danzante»). Su mecánica propia vive acá; huespedes.js y combos.js sólo la llaman en puntos concretos.
//   · PARADA y ESQUIVA PERFECTAS: ventanas muy cortas. Si algo te golpea dentro de la ventana, el golpe se ANULA entero, se devuelve ×3 en área y quedás en RÉPLICA
//     (+35 % de daño 4 s). Si la ventana se acaba sin recibir nada, la habilidad se recarga en la mitad de tiempo (fallar barato, acertar caro).
//   · COMPÁS (sólo modo Combo): cada golpe pulsado A TIEMPO (entre el 60 % de la recuperación del golpe anterior y 0,2 s después de que termine) suma 1 de compás (0..5);
//     pulsar fuera de tiempo, o dejar que se enfríe, lo vuelve a 0. Cada punto da +4 % de daño y −2,5 % de recuperación; con 3 o más las armas de cadena corta ganan un golpe
//     más en la cadena. «Mantener» el botón NO da compás: hay que tocar con ritmo.
// Todo determinista y sin DOM: NO usa g.rng. Sin importar huespedes.js (evita ciclos): todo lo que necesita llega por parámetro.
import { add, sub, mul, madd, dot, cross, len, dist, norm, clone } from './math.js';
import { PLAYER } from './data.js';

const r2 = (n) => Math.round(n * 100) / 100;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];
const flat = (p) => norm(sub(p.heading, mul(p.up, dot(p.heading, p.up))), p.heading);
const has = (p, id) => !!(p.path && p.path.includes(id));
export const isDz = (p) => !!p && p.char === 'danzante';

/** Constantes de balance de la Danzante (un solo lugar). */
export const DZ = { parry: 0.4, dodge: 0.34, hab: 0.65, rep: 4, repMul: 1.35, reflect: 3, minReflect: 48, radius: 5.6, auto: 0.7, danzaDps: 22, danzaR: 6.5,
  compasMax: 5, dmgPer: 0.04, recPer: 0.025, beatFrom: 0.6, beatLate: 0.2 };

/** Bits de `bf` (estados visibles en el snapshot). Los bits 0..8 son de los demás Huéspedes: éstos empiezan en el 12 a propósito. */
export const DZ_BF = { parada: 1 << 12, esquiva: 1 << 13, replica: 1 << 14, danza: 1 << 15, compasShift: 16 };

/** Reinicia el estado (initCombo lo llama al elegir/cambiar de Huésped). */
export function dzInit(p) { Object.assign(p, { pryUntil: 0, dgUntil: 0, rplUntil: 0, autoAt: 0, pryOpen: false, pryHit: false, pryKind: '', dgOpen: false, dgHit: false, compas: 0 }); }

/* ───────── ventanas de parada / esquiva ───────── */
/** Abre una ventana de 'parada' o 'esquiva' (dur en s; por defecto las de DZ). from = 'hab' si viene de la habilidad principal (para devolverle el enfriamiento si falla). */
export function dzOpen(g, p, kind, dur, from = '') {
  if (kind === 'esquiva') { p.dgUntil = Math.max(p.dgUntil || 0, g.time + (dur ?? (DZ.dodge + (has(p, 'velocidad') ? 0.1 : 0)))); p.dgOpen = true; p.dgHit = false; return; }
  p.pryUntil = Math.max(p.pryUntil || 0, g.time + (dur ?? DZ.parry) * (has(p, 'coraza') ? 1.4 : 1)); p.pryOpen = true; p.pryHit = false; p.pryKind = from;
}

/** Daño que está por recibir la Danzante. Devuelve 0 si lo para o esquiva; null si no hace nada (sigue el cálculo normal). */
export function dzGuard(g, p, dmg) {
  const t = g.time;
  if (t < (p.dgUntil || 0)) { perfect(g, p, 'esquiva', dmg); return 0; }
  if (t < (p.pryUntil || 0)) { perfect(g, p, 'parada', dmg); return 0; }
  if (p.ultId === 'danza' && t >= (p.autoAt || 0)) { p.autoAt = t + (has(p, 'apoteosis') ? 0.4 : DZ.auto); perfect(g, p, 'parada', dmg); return 0; }
  return null;
}

/** El golpe perfecto: anula, devuelve en área, abre la Réplica y suma compás. */
function perfect(g, p, kind, dmg) {
  const t = g.time, ev = p.evo | 0, R = DZ.radius * (kind === 'esquiva' ? 1.15 : 1) * (has(p, 'artilleria') ? 1.5 : 1);
  const base = Math.max(DZ.minReflect, dmg * DZ.reflect) * (1 + 0.1 * ev) * (has(p, 'simbiosis') ? 1.5 : 1);
  const s0 = g.dmgSrc; g.dmgSrc = 'skill'; let n = 0;
  try {
    for (const m of g.monsters) {
      if (m.dead || dist(m.pos, p.pos) > R + m.r) continue;
      g.damageMonster(m, base, p, m.pos); n++;
      if (!m.dead) { m.slowUntil = Math.max(m.slowUntil || 0, t + 1.5); if (!m.def.boss) m.vel = madd(m.vel, norm(sub(m.pos, p.pos)), 16); }
    }
    if (has(p, 'anomalia')) g.explode(clone(p.pos), 5, 0, 60, p, false);
  } finally { g.dmgSrc = s0; }
  p.rplUntil = t + DZ.rep + (has(p, 'depredador') ? 2 : 0);
  p.shield = Math.min(PLAYER.shield, p.shield + 14); p.ul = Math.min(100, p.ul + 10);
  if (p.mode === 'combo') { p.compas = Math.min(DZ.compasMax, (p.compas | 0) + 2); p.habCd = Math.max(0, p.habCd - 2); }
  if (kind === 'parada') p.pryHit = true; else p.dgHit = true;
  p.pryUntil = 0; p.dgUntil = 0; p.invulUntil = Math.max(p.invulUntil, t + 0.25);   // un respiro para que no entren los demás golpes del mismo instante
  g.emit({ t: 'parry', pid: p.id, k: kind, p: a3(p.pos), r: r2(R), n });
}

/* ───────── paso por tick ───────── */
export function dzTick(g, p, dt) {
  const t = g.time;
  if (p.pryOpen && t >= (p.pryUntil || 0)) {   // la ventana se cerró: si nadie golpeó, la habilidad vuelve en la mitad de tiempo
    p.pryOpen = false;
    if (!p.pryHit) { if (p.pryKind === 'hab') p.habCd = Math.min(p.habCd, (p.habMax || 9) * 0.5); else if (p.pryKind !== 'combo') p.espCd = Math.min(p.espCd, 4.5); }
  }
  if (p.dgOpen && t >= (p.dgUntil || 0)) { p.dgOpen = false; if (!p.dgHit) p.movCd = Math.min(p.movCd, 2.5); }
  if (p.mode !== 'combo' || !p.cb || p.cb.win <= 0) p.compas = 0;
  if (p.ultId === 'danza') {   // remolino de cintas: daño continuo a lo cercano
    const s0 = g.dmgSrc; g.dmgSrc = 'skill';
    try { for (const m of g.monsters) { if (m.dead || dist(m.pos, p.pos) > DZ.danzaR + m.r) continue; m.slowUntil = Math.max(m.slowUntil || 0, t + 0.3); m.hp -= DZ.danzaDps * dt * (1 + 0.1 * (p.evo | 0)); m.hurt = Math.max(m.hurt, 0.05); if (m.hp <= 0) g.killMonster(m, p); } } finally { g.dmgSrc = s0; }
  }
}
/** Multiplicador de velocidad (Danza Macabra). */
export const dzSpd = (g, p) => (p.ultId === 'danza' ? 1.25 : 1);
/** Multiplicador de daño que hace la Danzante (Réplica: melee y habilidades). */
export const dzOut = (g, p, src) => (g.time < (p.rplUntil || 0) && (src === 'melee' || src === 'skill') ? DZ.repMul : 1);
/** Bits visibles de `bf`. */
export function dzBits(g, p) {
  const t = g.time; let b = 0;
  if (t < (p.pryUntil || 0)) b |= DZ_BF.parada; if (t < (p.dgUntil || 0)) b |= DZ_BF.esquiva; if (t < (p.rplUntil || 0)) b |= DZ_BF.replica; if (p.ultId === 'danza') b |= DZ_BF.danza;
  return b | (Math.min(DZ.compasMax, p.compas | 0) << DZ_BF.compasShift);
}

/* ───────── habilidades (modo Shooter) y principal (modo Combo) ───────── */
export function dzPirueta(g, p) {
  const h = flat(p), mx = p.input.mx || 0, mz = p.input.mz || 0;
  const w = !mx && !mz ? mul(h, -1) : norm(add(mul(h, mz), mul(cross(h, p.up), mx)), h);
  p.ext = madd(p.ext, w, 36); dzOpen(g, p, 'esquiva'); return true;
}
export function dzParada(g, p) { dzOpen(g, p, 'parada'); return true; }
/** Lazo de cintas: abanico de listones. No gasta nada si no hay a quién enredar. */
export function dzCintas(g, p) {
  const o = g.eyePos(p), d = norm(g.aimDir(p)), t = g.time, list = [];
  for (const m of g.monsters) { if (m.dead) continue; const to = sub(m.pos, o), l = len(to); if (l > 12 + m.r) continue; if (dot(norm(to), d) < 0.35 && l > m.r + 1.5) continue; list.push([m, l]); }
  if (!list.length) return false;
  list.sort((a, b) => a[1] - b[1]);
  for (const [m] of list.slice(0, 6)) {
    g.damageMonster(m, 42 * (1 + 0.08 * (p.evo | 0)), p, m.pos);
    if (m.dead) continue;
    m.slowUntil = Math.max(m.slowUntil || 0, t + 3); m.markUntil = t + 5; m.markMul = Math.max(m.markMul || 1, 1.2);
    if (!m.def.boss) m.vel = madd(m.vel, norm(sub(p.pos, m.pos)), 16);
    g.emit({ t: 'arc', o: a3(madd(o, d, 0.4)), to: a3(m.pos), c: 'cinta' });
  }
  return true;
}
/** Contrapaso (habilidad principal del Combo): guardia perfecta larga. */
export function dzContrapaso(g, p) { dzOpen(g, p, 'parada', DZ.hab, 'hab'); }

/* ───────── compás (modo Combo) ───────── */
/** Se llama antes de resolver cada golpe: ¿se pulsó a tiempo? Actualiza p.compas y marca la hora del golpe. */
export function dzBeat(g, p) {
  if (!isDz(p)) return;
  const cb = p.cb, t = g.time;
  if (cb.t0 != null && cb.pt != null && cb.pt > cb.t0 && cb.rec > 0) {
    const el = cb.pt - cb.t0;
    if (el >= cb.rec * DZ.beatFrom - 0.02 && el <= cb.rec + DZ.beatLate) p.compas = Math.min(DZ.compasMax, (p.compas | 0) + (has(p, 'resonancia') ? 2 : 1));
    else p.compas = 0;
  } else p.compas = 0;
  cb.t0 = t;
}
export const dzDmg = (p) => (isDz(p) ? 1 + DZ.dmgPer * (p.compas | 0) : 1);
export const dzRec = (p) => (isDz(p) ? 1 - DZ.recPer * (p.compas | 0) : 1);
/** Golpes extra de cadena con buen ritmo (armas de cadena corta). */
export const dzChain = (p) => (isDz(p) && (p.compas | 0) >= 3 ? 1 : 0);
