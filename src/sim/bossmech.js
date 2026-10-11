// Mecánicas independientes de los jefes: Coloso = reflejar el Rayo del Vacío; Madre = purgar válvulas + romper huevos.
import { dist, clone, norm, sub, clamp, madd } from './math.js';
import { BOSS_MECH } from './data.js';

/* ───────── Coloso Prismático ───────── */
export function initColoso(g, m) {
  m.shield = true; m.mech = null; m.stagger = 0; m.rayCd = 9; m.ray = null;
  const n = clamp(g.players.length + 1, 3, 4);
  m.res = g.map.spots.resonators(n).map((p) => g.addObject('resonator', p, { r: 2.8, state: 'ok', downT: 0, boss: true }));
}
/** Devuelve { skip } = true si el jefe no debe atacar este cuadro (aturdido). */
export function updateColoso(g, m, dt) {
  const ph = m.phase || 1;
  for (const r of m.res) if (r.state === 'down') { r.downT -= dt; if (r.downT <= 0) r.state = 'ok'; }
  if (m.stagger > 0) {
    m.stagger -= dt; m.mech = 'stagger';
    if (m.stagger <= 0) { m.mech = null; m.shield = true; m.rayCd = BOSS_MECH.rayCd[ph]; g.emit({ t: 'shield', id: m.id }); }
    return { skip: true };
  }
  if (m.ray) {
    m.ray.t -= dt; m.mech = 'ray';
    const first = g.objects.find((o) => o.id === m.ray.ids[0]); if (first) m.aim = norm(sub(first.pos, m.pos));
    if (m.ray.t <= 0) resolveRay(g, m, ph);
    return { skip: false };
  }
  m.mech = null; m.rayCd -= dt;
  if (m.rayCd <= 0) startRay(g, m, ph);
  return { skip: false };
}
function startRay(g, m, ph) {
  const ok = m.res.filter((r) => r.state === 'ok');
  if (!ok.length) { m.rayCd = 3; return; }
  const cnt = ph >= 2 ? Math.min(2, ok.length) : 1, pick = [];
  const pool = ok.slice(); while (pick.length < cnt && pool.length) pick.push(pool.splice(Math.floor(g.rng.next() * pool.length), 1)[0]);
  for (const r of pick) r.state = 'targeted';
  m.ray = { t: BOSS_MECH.rayT, ids: pick.map((r) => r.id) }; m.aim = norm(sub(pick[0].pos, m.pos));
  g.emit({ t: 'ray', id: m.id, targets: pick.map((r) => [r.pos.x, r.pos.y, r.pos.z]) });
}
function resolveRay(g, m, ph) {
  let tuned = 0; const ids = m.ray.ids;
  for (const id of ids) {
    const r = g.objects.find((o) => o.id === id); if (!r) continue;
    if (g.alivePlayers().some((p) => dist(p.pos, r.pos) < r.r)) { tuned++; r.state = 'ok'; g.emit({ t: 'reflect', from: [r.pos.x, r.pos.y, r.pos.z], to: [m.pos.x, m.pos.y, m.pos.z] }); }
    else { r.state = 'down'; r.downT = 20; g.explode(r.pos, 5, 45, 0, null, true); }
  }
  m.ray = null;
  if (tuned > 0) { m.shield = false; m.stagger = 6 * tuned + (tuned === ids.length ? 2 : 0); m.mech = 'stagger'; g.emit({ t: 'stagger', id: m.id, secs: m.stagger }); }
  else { m.mech = null; m.rayCd = BOSS_MECH.rayCd[ph]; }
}

/* ───────── Madre Geoda ───────── */
export function initMadre(g, m) {
  m.pressure = 0.2; m.open = false; m.openT = 0; m.ventT = 0; m.gest = 12; m.gestAnim = 0; m.rage = 0; m.justOpened = false;
  m.valves = g.map.spots.valves.map((p) => g.addObject('valve', p, { r: 3.4, hold: 0, on: false, cool: 0, boss: true }));
}
export function updateMadre(g, m, dt) {
  const ph = m.phase || 1, solo = g.players.length <= 1, alive = g.alivePlayers();
  m.justOpened = false;
  for (const v of m.valves) {
    if (v.cool > 0) { v.cool -= dt; v.on = false; v.hold = 0; continue; }
    if (alive.some((p) => dist(p.pos, v.pos) < v.r)) v.hold = solo ? 9 : 0.8; else v.hold = Math.max(0, v.hold - dt);
    v.on = v.hold > 0; v.v = clamp(v.hold / (solo ? 9 : 0.8), 0, 1);
  }
  const both = m.valves.every((v) => v.on);
  if (!m.open) {
    m.pressure = Math.min(1, m.pressure + dt * 0.04 * (ph >= 3 ? 1.3 : 1));
    if (both) m.ventT += dt; else m.ventT = Math.max(0, m.ventT - dt * 2);
    if (m.ventT >= 2.5) { m.open = true; m.openT = 9; m.pressure = 0; m.ventT = 0; m.justOpened = true; for (const v of m.valves) { v.cool = 5; v.on = false; v.hold = 0; } g.emit({ t: 'purge', id: m.id }); }
    m.rage = m.pressure >= 1 ? m.rage + dt : 0;
  } else { m.openT -= dt; if (m.openT <= 0) m.open = false; }
  m.gest -= dt; if (m.gestAnim > 0) m.gestAnim -= dt;
  if (m.gest <= 0) { layEggs(g, m); m.gest = ph >= 3 ? 13 : 18; m.gestAnim = 1.2; }
  m.vis = m.open ? 'open' : m.ventT > 0.2 ? 'vent' : m.gestAnim > 0 ? 'gestate' : 'fire';
}
function layEggs(g, m) {
  const alive = g.alivePlayers(); if (!alive.length) return;
  for (let i = 0; i < 3; i++) {
    const ref = alive[Math.floor(g.rng.next() * alive.length)];
    const pos = g.map.spawnGround(g.rng, ref.pos);
    g.addObject('sac', pos, { hp: 70, maxhp: 70, hatch: 12, hostile: true, r: 1.5, parent: m.id });
  }
  g.emit({ t: 'gestate', id: m.id });
}
export function bossDeath(g) { for (const o of [...g.objects]) if (o.boss || o.type === 'sac') g.removeObject(o); }
