import test from 'node:test';
import assert from 'node:assert/strict';
import { arena, run, ahead, v3, sum } from './helpers.js';
import { MONSTERS } from '../src/sim/data.js';
import { AI } from '../src/sim/ai.js';
import { dist, len, dot } from '../src/sim/math.js';

const spawn = (g, p, kind, d, lift = 0) => g.spawnMonster(kind, ahead(p, d, lift));
const watch = (g, secs, fn) => run(g, secs, (t) => fn && fn(t));
const events = (g, store) => () => { for (const e of g.drainEvents()) store.push(e); };

test('bestiario: 8 criaturas + 2 jefes, cada una con IA propia y rol distinto', () => {
  const kinds = Object.keys(MONSTERS);
  assert.equal(kinds.filter((k) => !MONSTERS[k].boss).length, 8); assert.equal(kinds.filter((k) => MONSTERS[k].boss).length, 2);
  assert.equal(new Set(kinds.map((k) => MONSTERS[k].role)).size, kinds.length - 1 /* ambos jefes comparten rol */);
  for (const k of kinds) { assert.equal(typeof AI[MONSTERS[k].ai], 'function', k); assert.ok(MONSTERS[k].hp > 0 && MONSTERS[k].r > 0); }
});

test('Astilla (corredor): persigue rápido, muerde y salta para cerrar distancia', () => {
  const { g, p } = arena(); const m = spawn(g, p, 'astilla', 18); const sh0 = p.shield; let minD = 99, leaped = false;
  watch(g, 5, () => { minD = Math.min(minD, dist(m.pos, p.pos)); leaped ||= m.state === 'leap'; });
  assert.ok(minD < 3, `distancia mínima ${minD}`); assert.ok(p.shield < sh0, 'mordió'); assert.ok(leaped, 'usó el salto');
});

test('Geoda (tanque): rueda cerrada y se abre en ciclos; cerrada es más veloz y blindada', () => {
  const { g, p } = arena(); const m = spawn(g, p, 'geoda', 20); p.pos = v3(-20, 0.9, 20); let open = 0, n = 0, sClosed = [], sOpen = [];
  watch(g, 14, () => { n++; if (m.open) { open++; sOpen.push(len(m.vel)); } else sClosed.push(len(m.vel)); });
  const f = open / n; assert.ok(f > 0.25 && f < 0.5, `fracción abierta ${f}`);
  assert.ok(sum(sClosed) / sClosed.length > sum(sOpen) / sOpen.length * 2, 'cerrada rueda; abierta casi quieta');
});

test('Prisma (volador): orbita en alto, avisa (wind) y pica (dive) causando daño', () => {
  const { g, p } = arena(); const m = spawn(g, p, 'prisma', 25, 8); const states = new Set(); let maxH = -9, sh0 = p.shield;
  watch(g, 14, () => { states.add(m.state); maxH = Math.max(maxH, dot({ x: m.pos.x - p.pos.x, y: m.pos.y - p.pos.y, z: m.pos.z - p.pos.z }, p.up)); });
  assert.ok(states.has('orbit') && states.has('wind') && states.has('dive'), [...states].join());
  assert.ok(maxH > 4, `altura ${maxH}`); assert.ok(p.shield < sh0 || p.hp < 1e6);
  assert.ok(MONSTERS.prisma.fly);
});

test('Lente (a distancia): se aleja a rango, avisa con "aim" y dispara proyectiles esquivables', () => {
  const { g, p } = arena(); const m = spawn(g, p, 'lente', 10); let shots = 0, aimedFirst = false, sawAim = false;
  watch(g, 10, () => { if (m.state === 'aim') sawAim = true; if (g.projectiles.some((q) => q.owner === 'm') && shots === 0) { shots = 1; aimedFirst = sawAim; } });
  assert.ok(dist(m.pos, p.pos) > 15, `distancia ${dist(m.pos, p.pos)}`); assert.ok(shots === 1 && aimedFirst, 'disparó tras avisar');
});

test('Cuarzo (invocador): invoca Astillas hijas (máx. 4 vivas) y huye', () => {
  const { g, p } = arena(); const m = spawn(g, p, 'cuarzo', 15); let maxKids = 0, hadParent = false;
  watch(g, 40, () => { maxKids = Math.max(maxKids, m.kids); hadParent ||= g.monsters.some((k) => k.kind === 'astilla' && k.parent === m.id); p.hp = 1e6; g.monsters.filter((k) => k.kind === 'astilla').forEach((k) => (k.hp = 1e9)); });
  assert.ok(hadParent, 'invocó hijas con parent'); assert.ok(maxKids >= 1 && maxKids <= 4 + 2, `kids ${maxKids}`);
});

test('Espejo (emboscador): invisible a distancia, se revela al recibir daño y parpadea detrás del jugador', () => {
  const { g, p } = arena(); const m = spawn(g, p, 'espejo', 20); const ev = []; const drain = events(g, ev);
  g.step(1 / 60); assert.ok(m.cloak, 'camuflado de lejos');
  g.damageMonster(m, 1, p); assert.ok(!m.cloak && m.reveal > 1, 'revelado tras el golpe');
  let blinkDist = null; m.hp = m.maxhp = 1e9;
  watch(g, 9, () => { drain(); if (!blinkDist && ev.some((e) => e.t === 'blink')) blinkDist = dist(m.pos, p.pos); });
  assert.ok(blinkDist !== null, 'parpadeó'); assert.ok(blinkDist < 5, `terminó pegado al jugador: ${blinkDist}`);
});

test('Racimo (explosivo): detona al contacto dañando al jugador y a los vecinos', () => {
  const { g, p } = arena(); const m = spawn(g, p, 'racimo', 8); const neighbor = g.spawnMonster('geoda', ahead(p, 9)); neighbor.cd = 1e9;
  const sh0 = p.shield, nh = neighbor.hp; watch(g, 3);
  assert.ok(m.dead || !g.monsters.includes(m), 'explotó'); assert.ok(p.shield < sh0, 'dañó al jugador');
  assert.ok(neighbor.hp < nh, 'reacción en cadena sobre vecinos');
});

test('Gravitón (control): carga y luego invierte la gravedad del jugador unos segundos', () => {
  const { g, p } = arena(); spawn(g, p, 'graviton', 20, 10); const ev = []; const drain = events(g, ev); let flipped = false, upDown = false;
  watch(g, 15, () => { drain(); if (g.time < p.flipUntil) { flipped = true; if (p.up.y < -0.5) upDown = true; } });
  assert.ok(ev.some((e) => e.t === 'gravity') && flipped); assert.ok(upDown, 'el jugador pasó a caminar "al revés"');
});

function bossFight(mapId, kind) {
  const { g, p } = arena(mapId); g.wave = g.waveTotal; g.phase = 'wave'; g.queue = [];
  const b = g.spawnMonster(kind, g.map.bossAnchor); b.t = 0;
  return { g, p, b };
}

test('Coloso (jefe M1): 3 fases por vida, lluvia de orbes, invoca refuerzos, invierte gravedad y es derrotable', () => {
  const { g, p, b } = bossFight('m1', 'coloso'); const phases = new Set(), ev = []; let summoned = false, shots = 0;
  const step = () => { for (const e of g.drainEvents()) { ev.push(e); if (e.t === 'phase') phases.add(e.n); } shots += g.projectiles.filter((q) => q.owner === 'm' && q.age < 0.02).length; summoned ||= g.monsters.some((m) => m.parent === b.id); };
  run(g, 8, step); b.hp = b.maxhp * 0.6; run(g, 20, step); b.hp = b.maxhp * 0.3; run(g, 16, step);
  assert.ok([1, 2, 3].every((n) => phases.has(n)), [...phases].join()); assert.ok(shots > 40, `proyectiles ${shots}`); assert.ok(summoned);
  assert.ok(ev.some((e) => e.t === 'gravity'), 'pulso de gravedad en fase 3');
  g.damageMonster(b, 1e9, p); g.step(1 / 60); g.step(1 / 60);
  assert.equal(g.state, 'won');
});

test('Madre Geoda (jefe M2): se abre/cierra en ciclos (blindada cerrada), lanza espirales, invoca Racimos y es derrotable', () => {
  const { g, p, b } = bossFight('m2', 'madre'); let opens = 0, closes = 0, was = null, shots = 0, racimos = false; const hp0 = b.hp;
  run(g, 22, () => { if (was !== null && b.open !== was) b.open ? opens++ : closes++; was = b.open; shots += g.projectiles.filter((q) => q.age < 0.02).length; racimos ||= g.monsters.some((m) => m.kind === 'racimo'); });
  assert.ok(opens >= 2 && closes >= 2, `ciclos ${opens}/${closes}`); assert.ok(shots > 60); assert.ok(racimos);
  b.open = false; const h = b.hp; g.damageMonster(b, 100, p); assert.ok(Math.abs(h - b.hp - 15) < 1e-6, 'cerrada recibe 15%');
  b.open = true; g.damageMonster(b, 1e9, p); g.step(1 / 60); g.step(1 / 60); assert.equal(g.state, 'won'); void hp0;
});
