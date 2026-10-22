import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { ROLES, ROLE_IDS, OBJECTIVE_PLAN, BOSS_MECH, PLAYER } from '../src/sim/data.js';
import { dist, madd, v3 } from '../src/sim/math.js';
import { run } from './helpers.js';

/** Partida sin oleadas automáticas con `n` jugadores; el objetivo `kind` ya creado a mano. */
function room(mapId, n = 1, role = null) {
  const g = new Game({ mapId, seed: 3 }); g.phaseT = 1e9;
  const ps = []; for (let i = 0; i < n; i++) { const p = g.addPlayer('p' + i, role); p.hp = 1e6; p.shield = 100; ps.push(p); }
  return { g, ps };
}
import { makeObjective } from '../src/sim/objectives.js';
function withObjective(g, kind) { OBJECTIVE_PLAN[g.mapId][99] = kind; g.phase = 'wave'; g.queue = []; g.objective = makeObjective(g, 99); delete OBJECTIVE_PLAN[g.mapId][99]; return g.objective; }
const stand = (p, pos) => { p.pos = { ...pos }; p.vel = v3(); };

test('roles: 4 roles distintos, cada uno con habilidad y recarga; se asignan por orden o por elección', () => {
  assert.deepEqual(ROLE_IDS, ['vanguardia', 'soporte', 'ingeniero', 'explorador']);
  for (const r of ROLE_IDS) assert.ok(ROLES[r].cd > 5 && ROLES[r].ability && ROLES[r].desc);
  const g = new Game({ mapId: 'm1' });
  const roles = [g.addPlayer('a'), g.addPlayer('b'), g.addPlayer('c', 'explorador'), g.addPlayer('d', 'inventado')].map((p) => p.role);
  assert.deepEqual(roles.slice(0, 3), ['vanguardia', 'explorador', 'explorador']); // por defecto: Axioma, Vesper (equipos de sus Huéspedes)
  assert.ok(ROLE_IDS.includes(roles[3]));
  g.setRole(g.players[0].id, 'ingeniero'); assert.equal(g.players[0].role, 'ingeniero');
});

test('habilidad Vanguardia: la cúpula reduce 40 % el daño adentro y destruye proyectiles enemigos; entra en recarga', () => {
  const { g, ps: [p] } = room('m1', 1, 'vanguardia'); g.phaseT = 1e9;
  g.setInput(p.id, { ability: true }); g.step(1 / 60); g.setInput(p.id, { ability: false });
  assert.ok(g.objects.some((o) => o.type === 'dome'), 'hay cúpula'); assert.ok(p.abilityCd > 20, 'recarga');
  const sh = p.shield; g.hurtPlayer(p, 10); assert.ok(Math.abs((sh - p.shield) - 10 * 0.6 * 0.92) < 0.01, `daño reducido: ${sh - p.shield}`);
  g.setInput(p.id, { ability: true }); g.step(1 / 60); assert.equal(g.objects.filter((o) => o.type === 'dome').length, 1, 'en recarga no hay otra');
  run(g, 7); assert.ok(!g.objects.some((o) => o.type === 'dome'), 'la cúpula dura ~6 s');
});

test('habilidad Soporte: cura a los cercanos y reanima al instante a un caído a ≤ 4 u', () => {
  const { g, ps: [a, b] } = room('m1', 2); a.role = 'soporte'; b.hp = 20; b.shield = 0; b.pos = madd(a.pos, a.heading, 3);
  g.hurtPlayer(b, 0); g.setInput(a.id, { ability: true }); g.step(1 / 60);
  assert.ok(b.hp >= 60 && b.shield >= 99, 'curó y repuso escudo');
  const c = g.addPlayer('c'); c.pos = madd(a.pos, a.heading, 2); c.dead = true; c.bleed = 20; a.abilityCd = 0; g.setInput(a.id, { ability: false }); g.step(1 / 60);
  g.setInput(a.id, { ability: true }); g.step(1 / 60); assert.ok(!c.dead, 'reanimado al instante');
});

test('habilidad Ingeniero: torreta que dispara sola a las criaturas y desaparece; Explorador: marca (+30 % de daño)', () => {
  const { g, ps: [e] } = room('m1', 1, 'ingeniero'); e.role = 'ingeniero';
  const m = g.spawnMonster('geoda', madd(e.pos, e.heading, 14)); m.open = true; m.cd = 1e9; const hp0 = m.hp;
  g.setInput(e.id, { ability: true }); g.step(1 / 60); g.setInput(e.id, { ability: false });
  assert.ok(g.objects.some((o) => o.type === 'turret')); run(g, 4); assert.ok(m.hp < hp0, 'la torreta dañó a la criatura');
  run(g, 20); assert.ok(!g.objects.some((o) => o.type === 'turret'), 'la torreta expira');
  const { g: g2, ps: [x] } = room('m1', 1, 'explorador'); const t = g2.spawnMonster('geoda', madd(x.pos, x.heading, 10)); t.open = true; t.cd = 1e9;
  const h0 = t.hp; g2.damageMonster(t, 100, x); const plain = h0 - t.hp; t.hp = h0;
  g2.setInput(x.id, { ability: true }); g2.step(1 / 60); assert.ok(g2.time < t.markUntil, 'marcada'); t.hp = h0; t.open = true; g2.damageMonster(t, 100, x);
  assert.ok(Math.abs((h0 - t.hp) / plain - 1.3) < 0.01, `marca = ×1,3 (${(h0 - t.hp) / plain})`);
});

test('objetivo Ancla: se carga sólo con alguien adentro, las criaturas la roen, se cumple y premia al equipo', () => {
  const { g, ps: [p] } = room('m1'); const o = withObjective(g, 'ancla'); const a = g.objects.find((x) => x.type === 'ancla');
  run(g, 5); assert.equal(Math.round(o.prog * 100), 0, 'sin nadie adentro no carga');
  p.hp = 50; stand(p, a.pos); run(g, 40, () => stand(p, a.pos));
  assert.equal(o.state, 'done'); assert.ok(p.hp >= 79, 'recompensa de vida'); assert.ok(g.teamBuffUntil > g.time, '+25 % de daño de equipo'); assert.equal(g.fragments, 1);
  assert.ok(!g.objects.some((x) => x.type === 'ancla'), 'el objeto desaparece');
});
test('objetivo Ancla: si las criaturas la destruyen o se acaba el tiempo, falla y el Vórtice se enfurece', () => {
  const { g } = room('m1'); const o = withObjective(g, 'ancla'); const a = g.objects.find((x) => x.type === 'ancla');
  g.damageObject(a, 1e5, null); run(g, 1); assert.equal(o.state, 'failed');
  const { g: g2 } = room('m1'); const o2 = withObjective(g2, 'ancla'); run(g2, o2.limit + 2); assert.equal(o2.state, 'failed');
});

test('objetivo Sintonía (coop): hay que pisar TODAS las placas a la vez 3 s; con una sola no avanza', () => {
  const { g, ps } = room('m2', 2); const o = withObjective(g, 'sintonia'); const pl = g.objects.filter((x) => x.type === 'plate');
  assert.equal(pl.length, 2); assert.ok(dist(pl[0].pos, pl[1].pos) > 30, 'placas lejanas');
  run(g, 5, () => stand(ps[0], pl[0].pos)); assert.ok(o.prog < 0.05, 'una placa sola no sintoniza');
  run(g, 5, () => { stand(ps[0], pl[0].pos); stand(ps[1], pl[1].pos); }); assert.equal(o.state, 'done');
});
test('objetivo Sintonía (solo): la placa queda viva tras salir y se puede resolver corriendo de una a otra', () => {
  const { g, ps: [p] } = room('m2'); const o = withObjective(g, 'sintonia'); const pl = g.objects.filter((x) => x.type === 'plate'); assert.equal(pl.length, 2);
  run(g, 0.5, () => stand(p, pl[0].pos)); run(g, 3.6, () => stand(p, pl[1].pos)); assert.equal(o.state, 'done');
});

test('objetivo Núcleo: se recoge, se lleva (−25 % de velocidad, sin disparar), se pasa con E y se entrega en el altar', () => {
  const { g, ps: [a, b] } = room('m1', 2); const o = withObjective(g, 'nucleo'); const core = g.objects.find((x) => x.type === 'core'), altar = g.objects.find((x) => x.type === 'altar');
  stand(b, { x: 0, y: 0.9, z: 25 }); stand(a, core.pos); g.step(1 / 60); assert.equal(a.carry, core.id);
  g.setInput(a.id, { fire: true, mz: 1 }); g.step(1 / 60); assert.ok(!g.projectiles.some((q) => q.owner === a.id), 'cargando no dispara');
  stand(b, madd(a.pos, a.heading, 1.5)); g.setInput(b.id, { interact: true }); g.step(1 / 60); g.setInput(b.id, { interact: false });
  assert.equal(b.carry, core.id); assert.equal(a.carry, 0, 'se pasó el núcleo');
  stand(b, altar.pos); g.step(1 / 60); assert.equal(o.state, 'done'); assert.equal(b.carry, 0);
});

test('Coloso: el Rayo del Vacío marca un pilar; si alguien lo sintoniza, el escudo estalla y el jefe queda aturdido recibiendo más daño', () => {
  const { g, ps: [p] } = room('m1'); const b = g.spawnMonster('coloso', v3(0, 34, 0)); b.rayCd = 0.1;
  assert.ok(b.shield && b.res.length >= 3);
  const hp0 = b.hp; g.damageMonster(b, 100, p); const shielded = hp0 - b.hp; assert.ok(shielded <= 100 * BOSS_MECH.shield + 0.01, `escudo ${shielded}`);
  b.hp = hp0; run(g, 0.5); assert.ok(b.ray, 'el rayo se prepara'); const tgt = g.objects.find((o) => o.id === b.ray.ids[0]); assert.equal(tgt.state, 'targeted');
  const ev = []; run(g, 4.5, () => { stand(p, tgt.pos); for (const e of g.events) ev.push(e); g.events.length = 0; });
  assert.ok(b.stagger > 0 && !b.shield, 'aturdido sin escudo'); assert.ok(ev.some((e) => e.t === 'reflect'));
  b.hp = hp0; g.damageMonster(b, 100, p); assert.ok(hp0 - b.hp >= 100 * BOSS_MECH.stagger - 1, `aturdido ×2,5: ${hp0 - b.hp}`);
});
test('Coloso: si nadie sintoniza el pilar marcado, el pilar cae y el escudo sigue', () => {
  const { g, ps: [p] } = room('m1'); p.pos = { x: 0, y: 0.9, z: 0 }; const b = g.spawnMonster('coloso', v3(0, 34, 0)); b.rayCd = 0.1;
  run(g, 5, () => stand(p, { x: 0, y: 0.9, z: 0 })); assert.ok(b.shield && !b.stagger); assert.ok(b.res.some((r) => r.state === 'down'), 'un pilar cayó');
});

test('Director: con estrés alto espacia las apariciones y suelta botiquines de alivio; con calma mete especiales', () => {
  const { g, ps: [p] } = room('m1'); g.director.stress = 0.9;
  assert.ok(g.director.gapScale() > 1.7); g.director.sinceRelief = 99; assert.equal(g.director.wantsRelief(), true); assert.equal(g.director.wantsRelief(), false);
  g.director.stress = 0.05; g.director.sinceSpecial = 99; assert.equal(g.director.wantsSurge(), true);
  p.hp = 10; g.director.dmg = 200; run(g, 6); assert.ok(g.director.stress > 0.3, 'el estrés sube con daño y poca vida');
});

test('Ping: marca lo que apuntás (enemigo / objeto / punto), dura ~7 s y viaja en el snapshot', () => {
  const { g, ps: [p] } = room('m1'); const m = g.spawnMonster('geoda', madd(p.pos, p.heading, 15)); m.cd = 1e9;
  g.setInput(p.id, { ping: true }); g.step(1 / 60); g.setInput(p.id, { ping: false }); g.step(1 / 60);
  const s = g.snapshot(); assert.equal(s.pings.length, 1); assert.equal(s.pings[0].k, 'enemy'); run(g, 8); assert.equal(g.snapshot().pings.length, 0);
});

test('Caídos: se desangran (25 s); un compañero cerca los reanima en 3 s (Soporte 1,5 s); si nadie llega quedan fuera hasta la próxima oleada', () => {
  const { g, ps: [a, b] } = room('m1', 2); a.role = 'vanguardia'; b.role = 'vanguardia';
  b.hp = 5; b.shield = 0; g.hurtPlayer(b, 100); assert.ok(b.dead && b.bleed > 20);
  g.setInput(a.id, { interact: true }); stand(a, b.pos); run(g, 2.6, () => stand(a, b.pos)); assert.ok(b.dead, 'a los 2,6 s aún no');
  run(g, 0.6, () => stand(a, b.pos)); assert.ok(!b.dead, 'reanimado a los 3 s');
  b.hp = 5; b.shield = 0; g.hurtPlayer(b, 100); a.role = 'soporte'; run(g, 1.6, () => stand(a, b.pos)); assert.ok(!b.dead, 'Soporte: 1,5 s');
  b.hp = 5; b.shield = 0; g.hurtPlayer(b, 100); stand(a, { x: 0, y: 0.9, z: 40 }); run(g, PLAYER.bleed + 1, () => stand(a, { x: 0, y: 0.9, z: 40 })); assert.ok(b.dead && b.lost, 'se perdió');
});

test('snapshot del director: roles, objetos, objetivo, pings y estado del jefe viajan al cliente (JSON)', () => {
  const { g, ps: [p] } = room('m1'); withObjective(g, 'sintonia'); p.carry = 0;
  const s = JSON.parse(JSON.stringify(g.snapshot()));
  assert.ok(s.players[0].role && 'ab' in s.players[0] && 'bleed' in s.players[0]); assert.ok(s.objs.length >= 2 && s.objs[0].t === 'plate'); assert.equal(s.obj.type, 'sintonia'); assert.ok(s.dir && 'stress' in s.dir);
});
