// Objetivos de oleada (ancla, sintonía, núcleo) — puzzles cooperativos con recompensa de equipo. Ver docs/DISENO_DIRECTOR.md
import { dist, clone, madd, clamp, norm, sub } from './math.js';
import { OBJECTIVE_PLAN, OBJECTIVE_INFO, FRAGMENTS, PLAYER, WEAPONS } from './data.js';
import { startCultivo, cultivoObjective } from './cultivo.js';
import { desintegrar } from './rezagados.js';
import { ammoMax } from './loadout.js';

export function makeObjective(g, n, step = null) {
  let kind = g.cfg ? (step && step.kind) : (step?.kind || (OBJECTIVE_PLAN[g.mapId] || {})[n]);   // misión declarativa: sólo el objetivo de su etapa (null = etapa sin objetivo)
  if (kind && !OBJECTIVE_INFO[kind]) kind = null;   // un objetivo desconocido jamás puede dejar la etapa sin final
  if (kind && g.map.objectiveFor) kind = g.map.objectiveFor(kind, g); // p. ej. mapa 4: sin puente no hay Núcleo, hay Cultivo
  if (!kind) return null;
  const info = step ? { ...OBJECTIVE_INFO[kind], title: step.title, desc: step.desc } : OBJECTIVE_INFO[kind], sp = g.map.spots, np = g.players.length;
  const o = { type: kind, state: 'active', t: 0, limit: info.limit, prog: 0, title: info.title, desc: info.desc, ids: [], solo: np <= 1, sync: 0 };
  if (kind === 'secuencia') {
    o.stage = 0; o.sync = 0;
    const positions = sp.plates.slice(0, 3);
    const offset = Math.abs((g.seed | 0) + n) % positions.length;
    for (let i = 0; i < positions.length; i++) o.ids.push(g.addObject('plate', clone(positions[(i + offset) % positions.length]), { r: 2.8, hold: 0, on: false, objective: true }).id);
  }
  if (kind === 'resistir') { o.dur = Math.max(10, step?.dur || 60); o.limit = o.dur + 15; }   // cuenta regresiva: se supera al sobrevivir `dur` s
  if (kind === 'caza') o.target = null; // el primer spawn normal ocupa el presupuesto existente
  if (kind === 'ancla') o.ids.push(g.addObject('ancla', clone(sp.anchor), { hp: 700, maxhp: 700, r: 7, on: false, objective: true }).id);
  if (kind === 'sintonia') {
    const cnt = np <= 1 ? 2 : Math.min(4, np);
    for (let i = 0; i < cnt; i++) o.ids.push(g.addObject('plate', clone(sp.plates[i]), { r: 2.4, hold: 0, on: false, objective: true }).id);
  }
  if (kind === 'nucleo') {
    const core = g.addObject('core', clone(sp.core), { carrier: 0, objective: true }), altar = g.addObject('altar', clone(sp.altar), { r: 3.4, objective: true });
    o.ids.push(core.id, altar.id); o.d0 = dist(core.pos, altar.pos);
  }
  if (kind === 'cultivo') startCultivo(g, o);
  g.emit({ t: 'objective', ph: 'start', kind, title: info.title, desc: info.desc });
  return o;
}

const objs = (g, o) => o.ids.map((id) => g.objects.find((x) => x.id === id)).filter(Boolean);

export function updateObjective(g, dt) {
  const o = g.objective; if (!o || o.state !== 'active') return;
  o.t += dt;
  const alive = g.alivePlayers();
  if (o.type === 'secuencia') {
    const terminals = objs(g, o), terminal = terminals[o.stage];
    if (!terminal) return finish(g, o, false);
    if (alive.some((p) => dist(p.pos, terminal.pos) < terminal.r)) o.sync += dt;
    terminal.v = clamp(o.sync / 2, 0, 1);
    if (o.sync >= 2) { terminal.on = true; terminal.v = 1; o.stage++; o.sync = 0; }
    o.prog = clamp((o.stage + o.sync / 2) / terminals.length, 0, 1);
    if (o.stage >= terminals.length) return finish(g, o, true);
  } else if (o.type === 'caza') {
    if (o.prog >= 1) return finish(g, o, true);
    if (o.target != null && !g.monsters.some((m) => m.id === o.target && !m.dead)) return finish(g, o, false);
  } else if (o.type === 'ancla') {
    const a = objs(g, o)[0]; if (!a) return finish(g, o, false);
    const inside = alive.filter((p) => dist(p.pos, a.pos) < a.r).length; a.on = inside > 0;
    let near = 0; for (const m of g.monsters) if (!m.dead && dist(m.pos, a.pos) < 5) near++;
    a.hp = Math.min(a.maxhp, a.hp - Math.min(near, 8) * 5 * dt + (near ? 0 : 2 * dt));
    o.prog = clamp(o.prog + (inside > 0 && (!g.operation || !near) ? (1 / 35) * (1 + 0.35 * (inside - 1)) * dt : 0), 0, 1); a.v = o.prog;
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
  else if (o.type === 'cultivo') { if (cultivoObjective(g, o, dt)) return finish(g, o, true); }
  else if (o.type === 'resistir') { o.prog = clamp(o.t / o.dur, 0, 1); if (o.t >= o.dur) return finish(g, o, true); }
  if (o.t > o.limit) finish(g, o, false);
}

function finish(g, o, ok) {
  o.state = ok ? 'done' : 'failed';
  for (const x of objs(g, o)) { if (x.type === 'core') for (const p of g.players) if (p.carry === x.id) p.carry = 0; g.removeObject(x); }
  if (ok) {
    if (g.operation || o.type === 'caza') {
      g.queue = []; g.omens = [];
      for (const m of g.monsters) if (!m.dead && !m.def.boss) desintegrar(g, m, 'custodio');
    }
    for (const p of g.alivePlayers()) {
      p.hp = Math.min(PLAYER.hp, p.hp + 30); p.shield = PLAYER.shield;
      for (const w of p.slots) {
        if (WEAPONS[w].max === Infinity) continue;
        p.ammo[w] = Math.min(ammoMax(p, w), p.ammo[w] + Math.ceil(WEAPONS[w].max * 0.3));
      }
      g.dropPickup('hp', madd(p.pos, p.up, 2));
    }
    g.teamBuffUntil = g.time + 30; // +25 % de daño del equipo
    if (g.hitos) g.hitos.obj++; for (const p of g.alivePlayers()) if (p.st) p.st.obj++;   // aporte al objetivo (recompensas por contribución)
    for (const q of g.players) q.cores = (q.cores || 0) + 30;
    const frag = g.fragments++;
    g.emit({ t: 'objective', ph: 'done', kind: o.type, frag: Math.min(frag, FRAGMENTS.length - 1) });
  } else {
    if (g.hitos) g.hitos.objFalla++;
    g.emit({ t: 'objective', ph: 'failed', kind: o.type });
    if (g.operation) {
      g.operationFailure = o.type === 'ancla' && o.t <= o.limit ? 'La zona segura fue destruida.' : o.t > o.limit ? 'Se agotó el tiempo del objetivo.' : 'Se perdió el objetivo de la misión.';
      g.state = 'lost'; g.queue = []; g.omens = []; g.emit({ t: 'lost' });
    } else g.surge(0.3);
  }
}
