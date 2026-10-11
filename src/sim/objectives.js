// Objetivos de oleada (ancla, sintonía, núcleo) — puzzles cooperativos con recompensa de equipo. Ver docs/DISENO_DIRECTOR.md
import { dist, clone, madd, clamp, norm, sub } from './math.js';
import { OBJECTIVE_PLAN, OBJECTIVE_INFO, FRAGMENTS, PLAYER, WEAPONS } from './data.js';

export function makeObjective(g, n) {
  const kind = (OBJECTIVE_PLAN[g.mapId] || {})[n];
  if (!kind) return null;
  const info = OBJECTIVE_INFO[kind], sp = g.map.spots, np = g.players.length;
  const o = { type: kind, state: 'active', t: 0, limit: info.limit, prog: 0, title: info.title, desc: info.desc, ids: [], solo: np <= 1, sync: 0 };
  if (kind === 'ancla') o.ids.push(g.addObject('ancla', clone(sp.anchor), { hp: 700, maxhp: 700, r: 7, on: false, objective: true }).id);
  if (kind === 'sintonia') {
    const cnt = np <= 1 ? 2 : Math.min(4, np);
    for (let i = 0; i < cnt; i++) o.ids.push(g.addObject('plate', clone(sp.plates[i]), { r: 2.4, hold: 0, on: false, objective: true }).id);
  }
  if (kind === 'nucleo') {
    const core = g.addObject('core', clone(sp.core), { carrier: 0, objective: true }), altar = g.addObject('altar', clone(sp.altar), { r: 3.4, objective: true });
    o.ids.push(core.id, altar.id); o.d0 = dist(core.pos, altar.pos);
  }
  g.emit({ t: 'objective', ph: 'start', kind, title: info.title, desc: info.desc });
  return o;
}

const objs = (g, o) => o.ids.map((id) => g.objects.find((x) => x.id === id)).filter(Boolean);

export function updateObjective(g, dt) {
  const o = g.objective; if (!o || o.state !== 'active') return;
  o.t += dt;
  const alive = g.alivePlayers();
  if (o.type === 'ancla') {
    const a = objs(g, o)[0]; if (!a) return finish(g, o, false);
    const inside = alive.filter((p) => dist(p.pos, a.pos) < a.r).length; a.on = inside > 0;
    let near = 0; for (const m of g.monsters) if (!m.dead && dist(m.pos, a.pos) < 5) near++;
    a.hp = Math.min(a.maxhp, a.hp - Math.min(near, 8) * 5 * dt + (near ? 0 : 2 * dt));
    o.prog = clamp(o.prog + (inside > 0 ? (1 / 35) * (1 + 0.35 * (inside - 1)) * dt : 0), 0, 1); a.v = o.prog;
    if (a.hp <= 0) return finish(g, o, false);
    if (o.prog >= 1) return finish(g, o, true);
  } else if (o.type === 'sintonia') {
    const plates = objs(g, o);
    for (const pl of plates) { const near = alive.some((p) => dist(p.pos, pl.pos) < pl.r); if (near) pl.hold = o.solo ? 10 : 0.6; else pl.hold = Math.max(0, pl.hold - dt); pl.on = pl.hold > 0; pl.v = clamp(pl.hold / (o.solo ? 10 : 0.6), 0, 1); }
    if (plates.length && plates.every((p) => p.on)) o.sync += dt; else o.sync = Math.max(0, o.sync - dt * 2);
    o.prog = clamp(o.sync / 3, 0, 1); if (o.sync >= 3) return finish(g, o, true);
  } else if (o.type === 'nucleo') {
    const [core, altar] = objs(g, o); if (!core || !altar) return finish(g, o, false);
    if (core.carrier) {
      const c = g.players.find((p) => p.id === core.carrier);
      if (!c || c.dead) { if (c) c.carry = 0; core.carrier = 0; if (c) core.pos = clone(c.pos); }
      else {
        core.pos = madd(c.pos, c.up, 1.3);
        const taker = alive.find((p) => p !== c && !p.carry && p.interactEdge && dist(p.pos, c.pos) < 2.8);
        if (taker) { c.carry = 0; taker.carry = core.id; core.carrier = taker.id; g.emit({ t: 'pass', pid: taker.id }); }
        else if (dist(c.pos, altar.pos) < altar.r) return finish(g, o, true);
      }
    } else {
      const p = alive.find((q) => !q.carry && dist(q.pos, core.pos) < 2.2);
      if (p) { p.carry = core.id; core.carrier = p.id; g.emit({ t: 'pickup', pid: p.id, type: 'core' }); }
    }
    o.prog = clamp(1 - dist(core.pos, altar.pos) / (o.d0 || 1), 0, 1);
  }
  if (o.t > o.limit) finish(g, o, false);
}

function finish(g, o, ok) {
  o.state = ok ? 'done' : 'failed';
  for (const x of objs(g, o)) { if (x.type === 'core') for (const p of g.players) if (p.carry === x.id) p.carry = 0; g.removeObject(x); }
  if (ok) {
    for (const p of g.alivePlayers()) {
      p.hp = Math.min(PLAYER.hp, p.hp + 30); p.shield = PLAYER.shield;
      for (const w of [1, 2, 3]) p.ammo[w] = Math.min(WEAPONS[w].max, p.ammo[w] + Math.ceil(WEAPONS[w].max * 0.3));
      g.dropPickup('hp', madd(p.pos, p.up, 2));
    }
    g.teamBuffUntil = g.time + 30; // +25 % de daño del equipo
    const frag = g.fragments++;
    g.emit({ t: 'objective', ph: 'done', kind: o.type, frag: Math.min(frag, FRAGMENTS.length - 1) });
  } else {
    g.surge(0.3); g.emit({ t: 'objective', ph: 'failed', kind: o.type });
  }
}
