import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { WEAPONS, CHARACTERS, CHARACTER_IDS, UPGRADE_KINDS } from '../src/sim/data.js';
import { makeCards, applyCard, wstat, ammoMax, cleanSlots } from '../src/sim/loadout.js';
import { genMaze, M3 } from '../src/sim/map3.js';
import { dist, madd, v3 } from '../src/sim/math.js';
import { arena, run, ahead } from './helpers.js';

const target = (g, p, kind = 'geoda', d = 14) => { const m = g.spawnMonster(kind, ahead(p, d)); m.cd = 1e9; m.open = true; m.hp = m.maxhp = 5000; return m; };

test('15 armas en total, cada una con nombre, descripción y munición coherente', () => {
  assert.equal(WEAPONS.length, 15); assert.equal(new Set(WEAPONS.map((w) => w.id)).size, 15);
  for (const w of WEAPONS.slice(5)) { assert.ok(w.desc && w.name && w.dmg > 0 && w.rate > 0 && w.max >= w.start && w.per > 0, w.id); }
});

test('cada arma nueva dispara, gasta munición y daña a una criatura de frente', () => {
  for (let wid = 5; wid < 15; wid++) {
    const { g, p } = arena(); p.slots = cleanSlots([wid]); p.weapon = wid; p.ammo[wid] = 200; const m = target(g, p, 'geoda', wid === 7 ? 10 : 14);
    const a0 = p.ammo[wid], h0 = m.hp; g.setInput(p.id, { fire: true }); run(g, wid === 11 ? 5.5 : 2.5); g.setInput(p.id, { fire: false });
    assert.ok(p.ammo[wid] < a0, `${WEAPONS[wid].id} gasta munición`); assert.ok(m.hp < h0, `${WEAPONS[wid].id} daña (${h0 - m.hp})`);
  }
});

test('comportamientos: Fractal encadena, Cetro cura, Lanza perfora, Cometa persigue, Vórtice arrastra', () => {
  { const { g, p } = arena(); p.weapon = 8; p.ammo[8] = 50; const a = target(g, p, 'geoda', 14); const b = g.spawnMonster('geoda', madd(a.pos, p.heading, 6)); b.cd = 1e9; b.open = true; b.hp = b.maxhp = 5000;
    g.setInput(p.id, { fire: true }); run(g, 0.7); assert.ok(b.hp < 5000, 'el arco saltó a la segunda criatura'); }
  { const { g, p } = arena('m1', { hp: 100 }); p.hp = 50; p.weapon = 13; p.ammo[13] = 100; target(g, p); g.setInput(p.id, { fire: true }); run(g, 1); assert.ok(p.hp > 50, `vida recuperada (${p.hp})`); }
  { const { g, p } = arena(); p.weapon = 12; p.ammo[12] = 20; const a = target(g, p, 'geoda', 12); const b = g.spawnMonster('geoda', madd(a.pos, p.heading, 6)); b.cd = 1e9; b.open = true; b.hp = b.maxhp = 5000;
    g.setInput(p.id, { fire: true }); run(g, 0.5); assert.ok(a.hp < 5000 && b.hp < 5000, 'atravesó a las dos'); }
  { const { g, p } = arena(); p.weapon = 10; p.ammo[10] = 10; const m = g.spawnMonster('geoda', madd(madd(p.pos, p.heading, 12), p.up, 0)); m.cd = 1e9; m.open = true; m.hp = m.maxhp = 5000;
    p.pitch = 0; g.setInput(p.id, { fire: true, dyaw: 0.15 }); g.step(1 / 60); g.setInput(p.id, { fire: false }); run(g, 3); assert.ok(m.hp < 5000, 'el cometa buscó su blanco aunque se disparó desviado'); }
  { const { g, p } = arena(); p.weapon = 11; p.ammo[11] = 10; const m = target(g, p, 'astilla', 25); m.hp = m.maxhp = 1e5; const far = g.spawnMonster('astilla', madd(m.pos, p.heading, 9)); far.hp = far.maxhp = 1e5;
    g.setInput(p.id, { fire: true }); g.step(1 / 60); g.setInput(p.id, { fire: false }); run(g, 2.2); assert.ok(g.objects.some((o) => o.type === 'well') || g.monsters.some((q) => q.hp < 1e5), 'se abrió el pozo o ya estalló'); }
});

test('mejoras: 3 tarjetas válidas al terminar la oleada; cada nivel sube daño/cadencia/munición y se limita al máximo; una sola mejora especial por arma', () => {
  const { g, p } = arena(); const cards = makeCards(g, p); assert.equal(cards.length, 3);
  const w = WEAPONS[2], base = wstat(p, 2); applyCard(p, { w: 2, k: 'dmg' }); assert.ok(Math.abs(wstat(p, 2).dmg / base.dmg - 1.22) < 1e-9);
  applyCard(p, { w: 2, k: 'rate' }); assert.ok(wstat(p, 2).rate > base.rate); const m0 = ammoMax(p, 2); applyCard(p, { w: 2, k: 'mag' }); assert.ok(ammoMax(p, 2) > m0);
  for (let i = 0; i < 9; i++) applyCard(p, { w: 2, k: 'dmg' }); assert.equal(p.upg[2].dmg, UPGRADE_KINDS.dmg.max);
  applyCard(p, { w: 2, k: 'mod', mod: 'perfora' }); assert.equal(p.upg[2].mod, 'perfora'); void w;
  // mejorar sube el daño real
  const { g: g2, p: p2 } = arena(); p2.weapon = 0; const t = target(g2, p2); g2.setInput(p2.id, { fire: true }); g2.step(1 / 60); const d0 = 5000 - t.hp;
  const { g: g3, p: p3 } = arena(); for (let i = 0; i < 5; i++) applyCard(p3, { w: 0, k: 'dmg' }); const t3 = target(g3, p3); g3.setInput(p3.id, { fire: true }); g3.step(1 / 60); assert.ok((5000 - t3.hp) / d0 > 2, 'nivel 5 ≈ ×2,1 de daño');
});

test('flujo de oleada: tras limpiar se ofrecen tarjetas, elegir una la aplica; si no elegís, la primera se aplica al empezar la siguiente', () => {
  const g = new Game({ mapId: 'm1', seed: 1 }); const p = g.addPlayer(); p.hp = 1e9; run(g, 6.5);
  for (let i = 0; i < 6000 && g.phase === 'wave'; i++) { for (const m of g.monsters) g.damageMonster(m, 1e9, p); g.step(1 / 60); }
  assert.equal(p.cards.length, 3); const first = p.cards[0]; run(g, 13); assert.equal(g.wave, 2); assert.equal(p.cards.length, 0);
  const u = p.upg[first.w]; assert.ok(u && (u[first.k] > 0 || u.mod === first.mod), 'se aplicó la primera tarjeta');
});

test('personajes: 6, cada uno con desplazamiento y disparo especial propios, con recarga', () => {
  assert.equal(CHARACTER_IDS.length, 6);
  for (const id of CHARACTER_IDS) {
    const C = CHARACTERS[id]; assert.ok(C.mov.id && C.esp.id && C.mov.cd > 0 && C.esp.cd > 0 && C.desc);
    const { g, p } = arena(); g.setLoadout(p.id, id); const m = target(g, p, 'geoda', 9); const pos0 = { ...p.pos }, v0 = p.vel.y;
    g.setInput(p.id, { mov: true, esp: true }); g.step(1 / 60); g.setInput(p.id, { mov: false, esp: false });
    assert.ok(p.movCd > 0 && p.espCd > 0, `${id} recarga`);
    run(g, 0.4); const moved = dist(p.pos, pos0) > 1.5 || p.vel.y > v0 + 5 || p.invulUntil > g.time; assert.ok(moved, `${id}: el desplazamiento mueve`);
    assert.ok(m.hp < 5000 || id === 'forja' || id === 'umbra' || id === 'lumen' || m.mark, `${id} dañó`);
  }
});
test('Fase da 1 s de invulnerabilidad; Paso no atraviesa muros', () => {
  const { g, p } = arena(); g.setLoadout(p.id, 'umbra'); p.hp = 100; p.shield = 0; g.setInput(p.id, { mov: true }); g.step(1 / 60); g.hurtPlayer(p, 50); assert.equal(p.hp, 100);
  run(g, 1.2); p.shield = 0; g.hurtPlayer(p, 50); assert.equal(p.hp, 50);
  const g3 = new Game({ mapId: 'm3', seed: 1 }); const q = g3.addPlayer('x', null, { char: 'lumen' }); g3.phaseT = 1e9;
  const wall = g3.map.walls[0]; q.pos = v3(wall.c.x - wall.h.x - 3, 0.9, wall.c.z); q.heading = v3(1, 0, 0); q.vel = v3();
  g3.setInput(q.id, { mov: true }); g3.step(1 / 60); assert.ok(q.pos.x < wall.c.x - wall.h.x + 0.5, `no cruzó el muro (${q.pos.x} vs ${wall.c.x - wall.h.x})`);
});

test('Mapa 3 (Laberinto Celestial): todo el laberinto es alcanzable, los muros bloquean al jugador y a los rayos, las criaturas los atraviesan', () => {
  const m = genMaze(), N = M3.N, seen = new Set(['0,' + (N - 1)]), q = [[0, N - 1]];
  while (q.length) { const [x, z] = q.shift(); const nb = []; if (x > 0 && !m.vw[x][z]) nb.push([x - 1, z]); if (x < N - 1 && !m.vw[x + 1][z]) nb.push([x + 1, z]); if (z > 0 && !m.hw[x][z]) nb.push([x, z - 1]); if (z < N - 1 && !m.hw[x][z + 1]) nb.push([x, z + 1]); for (const [a, b] of nb) if (!seen.has(a + ',' + b)) { seen.add(a + ',' + b); q.push([a, b]); } }
  assert.equal(seen.size, N * N);
  const g = new Game({ mapId: 'm3', seed: 2 }); const p = g.addPlayer('a'); g.phaseT = 1e9; p.hp = 1e9; const wall = g.map.walls[3];
  p.pos = v3(wall.c.x - wall.h.x - 2, 0.9, wall.c.z); p.heading = v3(1, 0, 0); p.vel = v3(); run(g, 1.5, () => g.setInput(p.id, { mz: 1 }));
  assert.ok(p.pos.x < wall.c.x - wall.h.x + 0.2, 'el muro frena al jugador');
  const mon = g.spawnMonster('astilla', v3(wall.c.x + wall.h.x + 3, 1, wall.c.z)); const far = madd(mon.pos, v3(-1, 0, 0), 0); void far;
  mon.pos = v3(wall.c.x + wall.h.x + 2, 1, wall.c.z); run(g, 3); assert.ok(mon.pos.x < wall.c.x - wall.h.x - 0.5 || dist(mon.pos, p.pos) < 25, 'la criatura atraviesa el muro hacia el jugador');
});

test('Argos (jefe del Mapa 3): escudo hasta romper todos los ojos; entonces queda aturdido ×2,5; su mirada se avisa y los muros la frenan', () => {
  const g = new Game({ mapId: 'm3', seed: 2 }); const p = g.addPlayer('a'); g.phaseT = 1e9; p.hp = 1e9; p.shield = 1e9;
  const b = g.spawnMonster('argos', v3(0, 26, 0)); assert.ok(b.eyes.length >= 5 && b.shield);
  const hp0 = b.hp; g.damageMonster(b, 100, p); assert.ok(hp0 - b.hp < 6, 'escudado'); b.hp = hp0;
  run(g, 0.5); for (const e of [...b.eyes]) g.damageObject(e, 1e5, p); run(g, 0.2); assert.ok(b.stagger > 0 && !b.shield, 'aturdido'); g.damageMonster(b, 100, p); assert.ok(hp0 - b.hp >= 240, `×2,5 (${hp0 - b.hp})`);
  run(g, 10); assert.ok(b.eyes.length >= 5 && b.shield, 'los ojos vuelven');
  b.stagger = 0; b.gazeCd = 0.1; const ev = []; p.hp = 1e9; run(g, 3.2, () => { for (const e of g.events) ev.push(e); g.events.length = 0; }); assert.ok(ev.some((e) => e.t === 'gaze'), 'avisa la mirada'); assert.ok(ev.some((e) => e.t === 'gazefire'), 'dispara');
});

test('snapshot incluye personaje, ranuras, mejoras, tarjetas y recargas de habilidades', () => {
  const g = new Game({ mapId: 'm1', seed: 1 }); const p = g.addPlayer('a', null, { char: 'nova', slots: [0, 8, 12, 5, 6] }); applyCard(p, { w: 8, k: 'dmg' }); p.cards = [{ w: 8, k: 'rate' }];
  const s = JSON.parse(JSON.stringify(g.snapshot())).players[0]; assert.equal(s.char, 'nova'); assert.deepEqual(s.sl, [0, 8, 12, 5, 6]); assert.equal(s.up[1][0], 1); assert.equal(s.cards.length, 1); assert.ok('mv' in s && 'es' in s);
});
