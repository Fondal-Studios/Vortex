// El limbo vivo: élites con afijos, linajes de armas y NPCs del respiro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { AFFIXES, AFFIX_IDS, LINEAGE, MONSTERS } from '../src/sim/data.js';
import { makeCards, applyCard, upgOf, wstat } from '../src/sim/loadout.js';
import { buyOrgan } from '../src/sim/organos.js';
import { NPC_INFO } from '../src/sim/npcs.js';
import { arena, run, ahead } from './helpers.js';
import { dist } from '../src/sim/math.js';

const elite = (g, p, kind, affix, d = 6) => { const m = g.spawnMonster(kind, ahead(p, d), { affix, noElite: true }); m.elite = true; m.affix = affix; m.cd = 1e9; m.hp = m.maxhp = 1000; return m; };

test('afijos: seis, con nombre y descripción; cada uno cambia la pelea de verdad', () => {
  assert.equal(AFFIX_IDS.length, 6); for (const a of AFFIX_IDS) assert.ok(AFFIXES[a].name && AFFIXES[a].desc);
  const { g, p } = arena(); p.weapon = 2; p.ammo[2] = 1e6;
  const hit = (affix) => { const m = elite(g, p, 'geoda', affix); m.open = true; m.passive = true; g.damageMonster(m, 100, p, m.pos); return 1000 - m.hp; };
  assert.ok(hit('blindado') < hit('veloz') * 0.7, 'Blindado recibe 40 % menos');
  const v = elite(g, p, 'astilla', 'veloz'); assert.ok(v.speedMul > 1.3, 'Veloz');
  const e = elite(g, p, 'racimo', 'explosivo', 3); p.hp = 100; p.shield = 0; g.killMonster(e, p); assert.ok(p.hp < 100, 'Explosivo estalla y lastima');
  const w = elite(g, p, 'lente', 'llorón'); w.passive = true; const n0 = g.monsters.length; g.damageMonster(w, 10, p, w.pos); assert.ok(g.monsters.length > n0, 'Llorón invoca ánimas');
  const s = elite(g, p, 'geoda', 'espectral'); s.open = true; s.passive = true; run(g, 0.1); s.ghostUntil = g.time + 1; const h0 = s.hp; g.damageMonster(s, 100, p, s.pos); assert.ok(h0 - s.hp < 10, 'Espectral intangible casi no recibe daño');
  const snap = g.snapshot().monsters.find((m) => m.af === 'llorón'); assert.ok(snap, 'el afijo viaja en el snapshot');
});

test('afijos: aparecen en élites reales a partir de la oleada 3', () => {
  const g = new Game({ mapId: 'm1', seed: 9 }); g.addPlayer('t'); g.phaseT = 1e9; g.wave = 8; let n = 0, con = 0;
  for (let i = 0; i < 80; i++) { const m = g.spawnMonster('astilla', { x: 20 + i * 0.2, y: 1, z: 20 }); if (m && m.elite) { n++; if (m.affix) con++; } }
  assert.ok(n > 3 && con === n, `élites con afijo ${con}/${n}`);
  void MONSTERS;
});

test('linajes: con nivel 3, mutación y órgano se ofrecen DOS formas excluyentes; cada una cambia el arma', () => {
  const { g, p } = arena(); const w = p.slots[1]; const u = upgOf(p, w); u.dmg = 2; u.rate = 1; u.mod = 'cadena'; p.ess = { carne: 50, cristal: 50, ojo: 50, vacio: 50 }; buyOrgan(g, p, 'w', w, 'glandula_osea');
  let got = null; for (let i = 0; i < 40 && !got; i++) { const c = makeCards(g, p); if (c.some((x) => x.k === 'forma')) got = c; }
  assert.ok(got, 'aparece el linaje'); const fs = got.filter((x) => x.k === 'forma'); assert.equal(fs.length, 2); assert.deepEqual(fs.map((x) => x.forma).sort(), Object.keys(LINEAGE.forms).sort());
  const base = wstat(p, w); applyCard(p, fs.find((x) => x.forma === 'alba'), g); assert.equal(u.forma, 'alba'); assert.ok(wstat(p, w).dmg > base.dmg * 1.2);
  let again = null; for (let i = 0; i < 40; i++) { const c = makeCards(g, p); if (c.some((x) => x.k === 'forma' && x.w === w)) again = c; } assert.equal(again, null, 'la otra forma queda cerrada');
  const { g: g2, p: q } = arena(); const u2 = upgOf(q, w); u2.forma = 'ocaso'; assert.ok(wstat(q, w).rate > 1.35, 'Ocaso: +40 % de cadencia');
  q.weapon = w; q.ammo[w] = 1e6; const m = g2.spawnMonster('astilla', ahead(q, 12)); m.hp = m.maxhp = 1e5; m.passive = true; q.cd = 0; g2.firePlayer(q); run(g2, 0.05); assert.ok(g2.time < m.markUntil, 'Ocaso marca a la criatura');
});

test('NPCs: aparece uno en el respiro, rota por oleada, desaparece al empezar la siguiente y sus tratos funcionan', () => {
  const { g, p } = arena(); g.phase = 'intermission'; g.wave = 1; g.phaseT = 30; g.monsters = []; g.queue = []; g.omens = []; g.phaseT = 0; g.objective = null;
  run(g, 0.2); g.phase = 'wave'; g.wave = 1; g.queue = []; g.monsters = [];
  // forzar un fin de oleada natural
  g.phaseT = 1e9; g.wave = 1; g.waveTotal = 7; g.phase = 'wave'; g.objective = null; run(g, 1.5);
  const n = g.objects.find((o) => o.type === 'npc'); assert.ok(n, 'hay un NPC en el respiro'); assert.ok(NPC_INFO[n.kind].offers.length === 2); assert.ok(dist(n.pos, p.pos) < 10);
  assert.equal(g.snapshot().objs.find((o) => o.t === 'npc').nk, n.kind);
  // tratos por tipo
  const tratar = (kind, setup, offer) => { n.kind = kind; setup(); g.setInput(p.id, { npc: { offer } }); run(g, 0.1); g.setInput(p.id, { npc: null }); run(g, 0.1); };
  p.cores = 40; p.ess = { carne: 9, cristal: 0, ojo: 0, vacio: 0 }; tratar('cambista', () => {}, 0); assert.equal(p.cores, 10); assert.ok(p.ess.cristal + p.ess.ojo + p.ess.vacio === 4, 'esencias de la que menos tenés');
  p.ess = { carne: 0, cristal: 0, ojo: 12, vacio: 0 }; p.cores = 0; tratar('cambista', () => {}, 1); assert.equal(p.cores, 25); assert.equal(p.ess.ojo, 6);
  p.hp = 20; p.ess.carne = 5; tratar('sanadora', () => {}, 0); assert.equal(p.hp, 100); assert.equal(p.ess.carne, 2);
  p.ess.cristal = 5; tratar('sanadora', () => {}, 1); assert.equal(p.blessWave, g.wave + 1);
  p.cores = 30; p.cards = []; tratar('herrero', () => { n.rerolled = false; }, 0); assert.ok(p.cards.length > 0, 'el herrero resortea las tarjetas'); assert.equal(p.cores, 20);
  tratar('herrero', () => {}, 0); assert.equal(p.cores, 20, 'sólo una vez por respiro');
  p.ess = { carne: 30, cristal: 30, ojo: 30, vacio: 30 }; p.cores = 40; tratar('herrero', () => {}, 1); assert.ok(p.cards.every((c) => c.k === 'organ') && p.cards.length === 3, 'tarjetas de órgano');
  // lejos no hay trato
  p.pos = { x: p.pos.x + 40, y: p.pos.y, z: p.pos.z }; p.cores = 100; const c0 = p.cores; tratar('cambista', () => {}, 0); assert.equal(p.cores, c0, 'hay que estar cerca');
  // al empezar la siguiente oleada se va
  g.startWave(2, [['astilla']]); assert.ok(!g.objects.some((o) => o.type === 'npc'));
});
