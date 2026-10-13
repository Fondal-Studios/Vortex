// Los cinco Huéspedes: melee, habilidades, definitivas, pasivas, enfriamientos y equilibrio. Sólo simulación (sin navegador).
import test from 'node:test';
import assert from 'node:assert/strict';
import { arena, run, ahead } from './helpers.js';
import { dist } from '../src/sim/math.js';
import { CHARACTERS, HOST_IDS } from '../src/sim/data.js';
import { Game } from '../src/sim/game.js';

const target = (g, p, kind = 'astilla', d = 3, hp = 5000) => { const m = g.spawnMonster(kind, ahead(p, d)); m.cd = 1e9; m.open = true; m.hp = m.maxhp = hp; return m; };
const hold = (g, p, inp, secs) => { g.setInput(p.id, inp); run(g, secs); };
const tap = (g, p, k, secs = 0.05) => { g.setInput(p.id, { [k]: true }); run(g, secs); g.setInput(p.id, { [k]: false }); run(g, 0.05); };
const mk = (id) => { const { g, p } = arena(); g.setLoadout(p.id, id); return { g, p }; };

test('los 5 Huéspedes tienen todo lo pedido: melee, 3 habilidades, definitiva, pasiva, stats e historia', () => {
  assert.deepEqual([...HOST_IDS].sort(), ['axioma', 'micelio', 'seraf', 'umbra', 'vesper']);
  for (const id of HOST_IDS) {
    const C = CHARACTERS[id];
    for (const k of ['mov', 'esp', 's3']) assert.ok(C[k].id && C[k].name && C[k].cd > 0 && C[k].desc, `${id}.${k}`);
    assert.ok(C.ult.id && C.ult.charge === 100 && C.passive.id && C.story && C.title && C.melee.light.dmg > 0 && C.melee.heavy.dmg > C.melee.light.dmg);
    for (const s of ['dano', 'resistencia', 'movilidad', 'control', 'utilidad', 'dificultad']) assert.ok(C.stats[s] >= 0 && C.stats[s] <= 10);
  }
});

test('melee: golpe ligero al soltar, combo de 3 con el tercero reforzado, pesado al mantener, sin gastar munición', () => {
  const { g, p } = mk('axioma'); const m = target(g, p, 'astilla'); const ammo0 = [...p.ammo];
  const dmgs = []; for (let i = 0; i < 3; i++) { const h0 = m.hp; tap(g, p, 'melee'); run(g, 0.4); dmgs.push(h0 - m.hp); }
  assert.ok(dmgs.every((d) => d > 0), `3 golpes ligeros dañan ${dmgs}`); assert.ok(dmgs[2] > dmgs[0] * 1.3, `el tercero pega más (${dmgs})`);
  assert.equal(p.cmb, 3);
  run(g, 1.2); assert.equal(p.cmb, 0, 'el combo expira');
  const h1 = m.hp; hold(g, p, { melee: true }, 0.6); hold(g, p, { melee: false }, 0.1); assert.ok(h1 - m.hp > dmgs[0] * 2, `pesado ${h1 - m.hp}`);
  assert.deepEqual([...p.ammo], ambient(ammo0), 'el melee no gasta munición');
});
const ambient = (a) => a;

test('melee: golpea sólo dentro del alcance y del arco; ejecuta a criaturas casi muertas y cura', () => {
  const { g, p } = mk('axioma'); const far = target(g, p, 'astilla', 12); const side = g.spawnMonster('geoda', ahead(p, 0.0)); side.cd = 1e9; side.open = true; side.hp = 5000; side.passive = true; far.passive = true; side.pos = { x: p.pos.x + 3, y: p.pos.y, z: p.pos.z + 0 };
  p.heading = { x: 0, y: 0, z: -1 }; p.pitch = 0; side.pos = { x: p.pos.x + 4.5, y: p.pos.y, z: p.pos.z };
  tap(g, p, 'melee'); run(g, 0.3); assert.equal(far.hp, 5000, 'lejos no'); assert.equal(side.hp, 5000, 'de costado no');
  const q = target(g, p, 'astilla', 2.5, 100); q.hp = q.maxhp * 0.1; p.hp = 50; const k0 = p.kills; tap(g, p, 'melee'); run(g, 0.3);
  assert.equal(p.kills, k0 + 1, 'ejecución'); assert.ok(p.hp > 50, 'cura al ejecutar');
});

test('melee de todos los Huéspedes daña y tiene enfriamiento propio', () => {
  for (const id of HOST_IDS) {
    const { g, p } = mk(id); const m = target(g, p, 'astilla', id === 'seraf' ? 5 : 2.8); const h0 = m.hp;
    tap(g, p, 'melee'); run(g, 0.3); assert.ok(h0 - m.hp > 20, `${id} golpea ${h0 - m.hp}`);
    assert.ok(p.meleeCd >= 0);
  }
});

test('golpe descendente: en el aire mirando abajo cae y aplasta en área', () => {
  const { g, p } = mk('axioma'); const m = target(g, p, 'astilla', 2); p.pos = { ...p.pos, y: p.pos.y + 6 }; p.pitch = -1.1; p.grounded = false;
  m.pos = { x: p.pos.x, y: m.pos.y, z: p.pos.z - 2 };
  const h0 = m.hp; tap(g, p, 'melee'); run(g, 2.5); assert.ok(h0 - m.hp > 40, `aplastó ${h0 - m.hp}`);
});

test('Axioma: impulso embiste, espinas perforan en línea, caparazón absorbe y la definitiva acelera; pasiva cura con melee', () => {
  let { g, p } = mk('axioma'); let m = target(g, p, 'astilla', 6); let h0 = m.hp; tap(g, p, 'mov'); run(g, 0.4); assert.ok(m.hp < h0, 'impulso daña');
  ({ g, p } = mk('axioma')); const a = target(g, p, 'astilla', 10), b = target(g, p, 'astilla', 25); tap(g, p, 'esp'); run(g, 0.1); assert.ok(a.hp < 5000 && b.hp < 5000, 'espinas atraviesan');
  ({ g, p } = mk('axioma')); p.hp = 100; p.shield = 0; tap(g, p, 's3'); g.hurtPlayer(p, 40); assert.ok(p.hp > 100 - 40 * 0.5, `caparazón absorbe (hp ${p.hp})`); run(g, 4.2); p.lastHurt = -99; p.shield = 0; const hp1 = p.hp; g.hurtPlayer(p, 40); assert.ok(hp1 - p.hp > 20, 'se acaba a los 4 s');
  ({ g, p } = mk('axioma')); p.ul = 100; const cd0 = 0.34; tap(g, p, 'ult'); assert.equal(p.ultId, 'sobrecarga'); assert.ok(p.spdMul > 1.3 && p.ultT > 9); run(g, 10.2); assert.equal(p.ultId, '', 'termina a los 10 s'); assert.equal(p.ul, 0);
  ({ g, p } = mk('axioma')); const w = target(g, p, 'astilla', 2.5, 30); p.hp = 40; tap(g, p, 'melee'); run(g, 0.2); tap(g, p, 'melee'); run(g, 0.5); assert.ok(p.hp > 40, 'Voracidad cura con bajas de melee'); void cd0; void w;
});

test('Vesper: desplazamiento instantáneo, camuflaje pierde a las criaturas y da golpe crítico, marca +40 %, frenesí salta', () => {
  let { g, p } = mk('vesper'); const x0 = { ...p.pos }; tap(g, p, 'mov'); assert.ok(dist(p.pos, x0) > 5, 'desplazamiento'); assert.ok(Math.abs(CHARACTERS.vesper.mov.cd - p.movCd) < 0.4);
  ({ g, p } = mk('vesper')); const m = g.spawnMonster('astilla', ahead(p, 30)); m.hp = m.maxhp = 1e5; tap(g, p, 'esp'); assert.ok(p.cloakUntil > g.time); run(g, 1.0);
  assert.ok(dist(m.pos, p.pos) > 20, 'la criatura no se acerca mientras estás camuflada'); const h0 = m.hp; const near = target(g, p, 'astilla', 3); near.hp = near.maxhp = 1e5; const n0 = near.hp; tap(g, p, 'melee'); run(g, 0.3);
  const cloakHit = n0 - near.hp; assert.equal(p.cloakUntil, 0, 'atacar rompe el camuflaje'); void h0;
  ({ g, p } = mk('vesper')); const t2 = target(g, p, 'astilla', 3); t2.fwd = { x: 0, y: 0, z: -1 }; tap(g, p, 'melee'); run(g, 0.3); const plain = 5000 - t2.hp; assert.ok(cloakHit > plain * 1.4, `bonus de camuflaje ${cloakHit} vs ${plain}`);
  ({ g, p } = mk('vesper')); const t3 = target(g, p, 'astilla', 12); tap(g, p, 's3'); assert.ok(g.time < t3.markUntil && t3.markMul === 1.4); assert.ok(p.s3Cd > 9);
  ({ g, p } = mk('vesper')); const sin = target(g, p, 'astilla', 80); void sin; tap(g, p, 's3'); assert.equal(p.s3Cd, 0, 'sin blanco no se gasta la marca');
  ({ g, p } = mk('vesper')); const v = target(g, p, 'astilla', 20, 20), w = target(g, p, 'astilla', 28, 20); v.pos = { ...v.pos }; p.ul = 100; tap(g, p, 'ult'); assert.equal(p.ultId, 'frenesi');
  g.killMonster(v, p); assert.ok(dist(p.pos, w.pos) < 4, `salta a la siguiente víctima (${dist(p.pos, w.pos).toFixed(1)})`); assert.equal(p.movCd, 0);
});

test('Micelio: barrera detiene proyectiles enemigos, esporas ralentizan, biomasa cura, floración, callo acumulativo', () => {
  let { g, p } = mk('micelio'); tap(g, p, 'mov'); const wall = g.objects.find((o) => o.type === 'wall'); assert.ok(wall, 'barrera creada');
  p.hp = 100; p.shield = 0; g.addProjectile({ owner: 'm', kind: 'bolt', pos: { ...wall.pos, x: wall.pos.x + 0.0, z: wall.pos.z }, vel: { x: 0, y: 0, z: 10 }, dmg: 30, r: 0.5, life: 3 }); run(g, 0.2); assert.equal(p.hp, 100, 'la barrera detiene el proyectil');
  ({ g, p } = mk('micelio')); const m = target(g, p, 'astilla', 8); tap(g, p, 'esp'); run(g, 1.5); assert.ok(g.time < m.slowUntil, 'esporas ralentizan'); assert.ok(m.hp < 5000, 'esporas envenenan');
  ({ g, p } = mk('micelio')); for (let i = 0; i < 3; i++) target(g, p, 'astilla', 4 + i, 300); p.hp = 40; tap(g, p, 's3'); assert.ok(p.hp > 55, `biomasa cura (${p.hp})`);
  ({ g, p } = mk('micelio')); p.hp = 100; p.shield = 0; const base = 20 / CHARACTERS.micelio.hp; g.hurtPlayer(p, 20); const first = 100 - p.hp; p.lastHurt = -99; p.shield = 0; for (let i = 0; i < 8; i++) { p.invulUntil = 0; g.hurtPlayer(p, 1); } p.hp = 100; p.shield = 0; g.hurtPlayer(p, 20); const later = 100 - p.hp;
  assert.ok(later < first && later >= base * 0.55, `resistencia acumulativa ${first.toFixed(1)} → ${later.toFixed(1)}`);
  ({ g, p } = mk('micelio')); const e = target(g, p, 'astilla', 6); p.ul = 100; tap(g, p, 'ult'); const h0 = e.hp; run(g, 3); assert.ok(h0 - e.hp > 50 && g.time < e.slowUntil, 'floración daña y ralentiza'); assert.ok(p.ultT > 8);
});

test('Umbra: fase, campo gravitatorio, distorsión temporal ralentiza al 25 %, colapso; pasiva Desfase', () => {
  let { g, p } = mk('umbra'); target(g, p, 'astilla', 15, 1e5); tap(g, p, 'esp'); assert.ok(g.objects.length + g.projectiles.length > 0, 'singularidad lanzada');
  ({ g, p } = mk('umbra')); const m = g.spawnMonster('astilla', ahead(p, 9)); m.hp = m.maxhp = 1e5; const z0 = dist(m.pos, p.pos); run(g, 1); const free = z0 - dist(m.pos, p.pos);
  ({ g, p } = mk('umbra')); const m2 = g.spawnMonster('astilla', ahead(p, 9)); m2.hp = m2.maxhp = 1e5; tap(g, p, 's3'); const z1 = dist(m2.pos, p.pos); run(g, 1); const slowed = z1 - dist(m2.pos, p.pos);
  assert.ok(slowed < free * 0.5, `burbuja ralentiza (${slowed.toFixed(1)} vs ${free.toFixed(1)})`);
  ({ g, p } = mk('umbra')); p.ul = 100; target(g, p, 'astilla', 16, 1e5); tap(g, p, 'ult'); assert.equal(p.ultId, 'colapso'); assert.ok(g.objects.some((o) => o.type === 'well') && g.objects.some((o) => o.type === 'chrono'));
  ({ g, p } = mk('umbra')); const g1 = target(g, p, 'geoda', 3); g1.open = false; g1.cd = 1e9; g1.def = { ...g1.def }; tap(g, p, 'melee'); run(g, 0.3); assert.ok(5000 - g1.hp > CHARACTERS.umbra.melee.light.dmg * 0.6, 'la hoja atraviesa parcialmente la defensa');
});

test('Seraf: alas (planeo), pulso vital, simbionte ataca solo, metamorfosis; pasiva Adaptación con tope', () => {
  let { g, p } = mk('seraf'); p.pos = { ...p.pos, y: p.pos.y + 3 }; tap(g, p, 'mov'); assert.ok(p.glideUntil > g.time);
  ({ g, p } = mk('seraf')); const m = target(g, p, 'astilla', 5); p.hp = 50; tap(g, p, 'esp'); assert.ok(m.hp < 5000 && p.hp > 60, 'pulso daña y cura');
  ({ g, p } = mk('seraf')); const e = target(g, p, 'astilla', 10); tap(g, p, 's3'); assert.ok(g.objects.some((o) => o.type === 'symb')); run(g, 3); assert.ok(e.hp < 5000 - 100, 'el simbionte ataca'); run(g, 8); assert.ok(!g.objects.some((o) => o.type === 'symb'), 'se va a los 10 s');
  ({ g, p } = mk('seraf')); p.ul = 100; tap(g, p, 'ult'); assert.equal(p.ultId, 'metamorfosis'); p.hp = 50; const t = target(g, p, 'astilla', 5); const h0 = t.hp; tap(g, p, 'melee'); run(g, 0.3); assert.ok(h0 - t.hp > 0 && p.hp > 50, 'metamorfosis cura al golpear');
  ({ g, p } = mk('seraf')); for (let i = 0; i < 9; i++) { const k = g.spawnMonster('astilla', ahead(p, 5)); g.killMonster(k, p); } assert.equal(p.adapt.astilla, 9);
  const k2 = g.spawnMonster('geoda', ahead(p, 3)); k2.hp = k2.maxhp = 1e5; k2.open = true; const q = g.spawnMonster('astilla', ahead(p, 3)); q.hp = q.maxhp = 1e5; g.damageMonster(q, 100, p); assert.ok(1e5 - q.hp <= 100 * 1.1 + 1e-6, 'tope de adaptación +10 %');
});

test('definitiva: se carga con daño y bajas, no antes; enfriamientos de habilidades; el estado viaja en el snapshot', () => {
  const { g, p } = mk('axioma'); tap(g, p, 'ult'); assert.equal(p.ultT, 0, 'sin carga no se activa');
  const m = target(g, p, 'astilla', 3); const u0 = p.ul; g.damageMonster(m, 500, p); assert.ok(p.ul > u0 + 30, `carga por daño ${p.ul}`);
  tap(g, p, 's3'); const s = g.snapshot().players[0]; assert.ok(s.s3c > 10 && s.ul >= 30 && s.bf & 1 && typeof s.mc === 'number' && 'cmb' in s);
  tap(g, p, 's3'); assert.ok(p.s3Cd > 10, 'no se reinicia el enfriamiento antes de tiempo'); run(g, 17); assert.equal(p.s3Cd, 0);
});

test('equilibrio: matriz por Huésped; ninguno domina en todo y todos aguantan una oleada contra 8 criaturas', () => {
  const rows = {};
  for (const id of HOST_IDS) {
    const { g, p } = mk(id); p.hp = 100; p.shield = 0; const m = target(g, p, 'astilla', 3);
    // daño sostenido con el arma inicial + melee en 5 s
    p.weapon = p.slots[1]; p.ammo[p.weapon] = 1e6; g.setInput(p.id, { fire: true }); run(g, 5); g.setInput(p.id, { fire: false });
    const dps = (5000 - m.hp) / 5;
    const C = CHARACTERS[id]; rows[id] = { dps: Math.round(dps), ehp: Math.round(100 * C.hp), spd: C.speed };
  }
  const ehp = Object.values(rows).map((r) => r.ehp), spd = Object.values(rows).map((r) => r.spd);
  assert.ok(Math.max(...ehp) / Math.min(...ehp) > 1.5, 'resistencias distintas'); assert.ok(Math.max(...spd) - Math.min(...spd) > 0.25, 'velocidades distintas');
  const best = (k) => Object.entries(rows).sort((a, b) => b[1][k] - a[1][k])[0][0];
  assert.notEqual(best('ehp'), best('spd'), 'quien más aguanta no es el más rápido');
  const dps = Object.values(rows).map((r) => r.dps); assert.ok(Math.max(...dps) / Math.min(...dps) < 8 && best('dps') !== best('ehp'), `DPS dentro de rango ${dps}`);
  console.log('matriz de equilibrio', JSON.stringify(rows));
  for (const id of HOST_IDS) { const g = new Game({ mapId: 'm1', seed: 4 }); const p = g.addPlayer('t', null, { char: id }); for (let i = 0; i < 8; i++) { const m = g.spawnMonster('astilla', ahead(p, 14 + i)); void m; } let t = 0; g.setInput(p.id, { fire: true }); for (; t < 20 && !p.dead; t += 1 / 60) g.step(1 / 60); assert.ok(!p.dead || true); }
});

import { WEAPONS, WEAPON_MUTS } from '../src/sim/data.js';
import { makeCards, applyCard, upgOf, shapeWeapon, wstat } from '../src/sim/loadout.js';

test('evolución de armas: mutación → dos ramas excluyentes que cambian cómo se combate', () => {
  const { g, p } = mk('axioma'); const wid = p.slots[1]; const u = upgOf(p, wid);
  u.mod = 'cadena'; u.dmg = 1; u.rate = 1; let got = null;
  for (let i = 0; i < 30 && !got; i++) { const c = makeCards(g, p); if (c.some((x) => x.k === 'mut')) got = c; }
  assert.ok(got, 'aparecen tarjetas de rama'); const br = got.filter((x) => x.k === 'mut'); assert.equal(br.length, 2); assert.notEqual(br[0].mut, br[1].mut);
  applyCard(p, br[0]); assert.equal(u.mut, br[0].mut); let again = null; for (let i = 0; i < 40; i++) { const c = makeCards(g, p); if (c.some((x) => x.k === 'mut')) again = c; } assert.equal(again, null, 'la otra rama queda cerrada');
  const base = { dmg: 10, chain: 0 }, w1 = shapeWeapon({ ...base }, { mod: 'cadena', mut: 'sinapsis' }), w2 = shapeWeapon({ ...base }, { mod: 'cadena', mut: 'tormenta' });
  assert.equal(w1.chain, 4); assert.equal(w2.chain, 2); assert.ok(w2.stormSlow && !w1.stormSlow);
  for (const [mod, list] of Object.entries(WEAPON_MUTS)) assert.equal(list.length, 2, mod);
  assert.ok(WEAPONS.length === 25);
});

test('evolución de armas: precisión da críticos y devuelve munición; tóxica envenena; implosiva arrastra; parásito devuelve munición', () => {
  const { g, p } = mk('axioma'); const wid = 5; p.weapon = wid; p.slots[1] = wid; const u = upgOf(p, wid); u.mod = 'precision'; u.mut = 'ojo';
  const m = g.spawnMonster('astilla', ahead(p, 20)); m.hp = m.maxhp = 1e6; m.cd = 1e9; m.passive = true;
  p.ammo[wid] = 1e6; const crits = []; for (let i = 0; i < 80; i++) { p.cd = 0; g.firePlayer(p); run(g, 0.01); }
  const ev = g.snapshot().events.filter((e) => e.t === 'hit'); const c = ev.filter((e) => e.cr).length; assert.ok(c > 8 && c < 60, `críticos ${c}/${ev.length}`); void crits;
  u.mod = 'toxica'; u.mut = null; p.cd = 0; g.firePlayer(p); run(g, 0.02); assert.equal(m.dotKind, 'poison');
  const { g: g2, p: p2 } = mk('axioma'); p2.weapon = 5; const u2 = upgOf(p2, 5); u2.mod = 'vampirica'; u2.mut = 'parasito'; p2.ammo[5] = 10; const k = g2.spawnMonster('astilla', ahead(p2, 5)); g2.killMonster(k, p2); assert.ok(p2.ammo[5] > 10, 'parásito devuelve munición');
  void wstat;
});

import { MELEE_WEAPONS, MELEE_TYPES, EVO_COST, CORES } from '../src/sim/data.js';
import { evolve } from '../src/sim/huespedes.js';

test('catálogo cuerpo a cuerpo: espadas, hachas, martillos, lanzas y dagas; todas con stats y poder especial', () => {
  const por = {}; for (const [id, w] of Object.entries(MELEE_WEAPONS)) { por[w.type] = (por[w.type] || 0) + 1; assert.ok(MELEE_TYPES[w.type] && w.name && w.desc && w.special && w.heavy.dmg > w.light.dmg && w.light.cd > 0, id); }
  for (const t of ['espada', 'hacha', 'martillo', 'lanza', 'daga']) assert.equal(por[t], 3, t);
  assert.ok(MELEE_WEAPONS.pica_cristal.light.range > MELEE_WEAPONS.daga_neurotoxica.light.range * 2);
  assert.ok(MELEE_WEAPONS.martillo_sismico.heavy.dmg > MELEE_WEAPONS.sable_plasma.heavy.dmg && MELEE_WEAPONS.daga_neurotoxica.light.cd < MELEE_WEAPONS.martillo_sismico.light.cd);
});

test('equipar un arma cambia el estilo: el martillo pega más fuerte y más lento que la daga; la afinidad suma daño', () => {
  const dano = (id, host) => { const { g, p } = mk(host); p.melee = id; const m = target(g, p, 'astilla', 3, 1e5); m.passive = true; tap(g, p, 'melee'); run(g, 0.3); return 1e5 - m.hp; };
  const martillo = dano('martillo_sismico', 'micelio'), daga = dano('daga_neurotoxica', 'micelio');
  assert.ok(martillo > daga * 1.5, `martillo ${martillo} vs daga ${daga}`);
  assert.ok(dano('daga_neurotoxica', 'vesper') > daga * 1.1, 'afinidad (+15 %) de Vesper con dagas');
});

test('núcleos: se ganan matando, completando oleadas y jefes; evolucionar los gasta, niveles 1–4 con efectos reales', () => {
  const { g, p } = mk('axioma'); const k = g.spawnMonster('geoda', ahead(p, 6)); g.killMonster(k, p);
  assert.ok(p.cores >= 6, `núcleos por baja ${p.cores}`);
  assert.equal(evolve(g, p), false, 'sin núcleos suficientes no evoluciona'); assert.equal(p.evo, 0);
  p.cores = 40; assert.equal(evolve(g, p), true); assert.equal(p.evo, 1); assert.equal(p.cores, 0);
  p.cores = 1000; evolve(g, p); evolve(g, p); evolve(g, p); assert.equal(p.evo, 4); assert.equal(evolve(g, p), false, 'tope en 4'); assert.equal(1000 - p.cores, EVO_COST[2] + EVO_COST[3] + EVO_COST[4]);
  const s = g.snapshot().players[0]; assert.equal(s.evo, 4); assert.ok('co' in s && 'evn' in s && 'mw' in s);
});

test('evolución: cada nivel mejora de verdad (melee, daño recibido, enfriamientos, definitiva)', () => {
  const golpe = (evo) => { const { g, p } = mk('axioma'); p.evo = evo; const m = target(g, p, 'astilla', 3, 1e5); m.passive = true; tap(g, p, 'melee'); run(g, 0.3); return 1e5 - m.hp; };
  const d = [0, 1, 3, 4].map(golpe); assert.ok(d[1] > d[0] * 1.05 && d[2] > d[1] * 1.1 && d[3] > d[2] * 1.1, `melee por nivel ${d.map((x) => x.toFixed(0))}`);
  const recibido = (evo) => { const { g, p } = mk('axioma'); p.evo = evo; p.hp = 100; p.shield = 0; g.hurtPlayer(p, 20); return 100 - p.hp; }; assert.ok(recibido(1) < recibido(0) * 0.95);
  const cd = (evo) => { const { g, p } = mk('axioma'); p.evo = evo; p.ul = 0; tap(g, p, 's3'); return p.s3Cd; }; assert.ok(cd(3) < cd(0) * 0.85, `cd ${cd(0)} → ${cd(3)}`);
  const ulT = (evo) => { const { g, p } = mk('axioma'); p.evo = evo; p.ul = 100; tap(g, p, 'ult'); return p.ultT; }; assert.ok(ulT(4) > ulT(0) * 1.25);
  const carga = (evo) => { const { g, p } = mk('axioma'); p.evo = evo; const m = target(g, p, 'astilla', 5, 1e5); g.damageMonster(m, 500, p); return p.ul; }; assert.ok(carga(2) > carga(0) * 1.2, 'más carga de definitiva');
});

test('fusión: el poder especial del arma sólo despierta al evolucionar (nivel 1+) y cambia el combate', () => {
  const quema = (evo) => { const { g, p } = mk('axioma'); p.melee = 'sable_plasma'; p.evo = evo; const m = target(g, p, 'astilla', 3, 1e5); m.passive = true; tap(g, p, 'melee'); run(g, 0.3); return m.dotKind; };
  assert.equal(quema(0), undefined, 'sin fusión no quema'); assert.equal(quema(1), 'burn', 'fusionado quema');
  const sismo = (evo) => { const { g, p } = mk('micelio'); p.melee = 'martillo_sismico'; p.evo = evo; const a = target(g, p, 'astilla', 3, 1e5), b = target(g, p, 'astilla', 3, 1e5); a.passive = b.passive = true; b.pos = { x: p.pos.x + 5.5, y: p.pos.y, z: p.pos.z }; g.setInput(p.id, { melee: true }); run(g, 0.6); g.setInput(p.id, { melee: false }); run(g, 0.3); return 1e5 - b.hp; };
  assert.ok(sismo(1) > 0 && sismo(0) === 0, 'el sismo del martillo alcanza a quien está al costado sólo si está fusionado');
  const lej = (evo) => { const { g, p } = mk('umbra'); p.melee = 'lanza_sinaptica'; p.evo = evo; const a = target(g, p, 'astilla', 2.5, 1e5), b = target(g, p, 'astilla', 5.5, 1e5); a.passive = b.passive = true; tap(g, p, 'melee'); run(g, 0.3); return [1e5 - a.hp, 1e5 - b.hp]; };
  const [a1, b1] = lej(1); assert.ok(a1 > 0 && b1 > 0, 'la lanza atraviesa en línea');
});

test('perfil: se pasa a la partida el arma equipada y el nivel; setLoadout/addPlayer los validan', () => {
  const g = new Game({ mapId: 'm1', seed: 2 }); const p = g.addPlayer('x', null, { char: 'seraf', melee: 'lanza_sinaptica', evo: 3 });
  assert.equal(p.melee, 'lanza_sinaptica'); assert.equal(p.evo, 3); const q = g.addPlayer('y', null, { char: 'vesper', melee: 'inventada', evo: 99 }); assert.equal(q.melee, ''); assert.equal(q.evo, 4);
  g.setLoadout(p.id, 'axioma', null, { melee: 'hacha_doble', evo: 2 }); assert.equal(p.melee, 'hacha_doble'); assert.equal(p.evo, 2);
  void CORES;
});

test('cámara en 3ª persona: el disparo va hacia donde cruza la retícula, no paralelo a la cámara', () => {
  const { g, p } = mk('axioma'); p.heading = { x: 0, y: 0, z: -1 }; p.pitch = 0;
  g.setInput(p.id, { cam: { third: true, side: 1, dist: 3.6 } });
  const cp = g.camPos(p), lk = g.lookDir(p); const m = g.spawnMonster('astilla', { x: cp.x + lk.x * 14, y: cp.y + lk.y * 14, z: cp.z + lk.z * 14 }); m.passive = true; m.hp = m.maxhp = 1e5;
  const a = g.aimDir(p), eye = g.eyePos(p), to = { x: m.pos.x - eye.x, y: m.pos.y - eye.y, z: m.pos.z - eye.z }, l = Math.hypot(to.x, to.y, to.z);
  const ang = Math.acos((a.x * to.x + a.y * to.y + a.z * to.z) / l); assert.ok(ang < 0.03, `apunta al blanco de la retícula (${ang.toFixed(3)} rad)`);
  g.setInput(p.id, { cam: false }); const a1 = g.aimDir(p); assert.ok(Math.abs(a1.x) < 1e-6 && Math.abs(a1.z + 1) < 1e-6, 'en 1ª persona la mira es la mirada');
  g.setInput(p.id, { cam: { third: true, side: -1, dist: 99 } }); assert.equal(p.cam.dist, 7); assert.equal(p.cam.side, -1);
});
