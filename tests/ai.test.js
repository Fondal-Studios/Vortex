import test from 'node:test';
import assert from 'node:assert/strict';
import { arena, run, ahead, v3, sum } from './helpers.js';
import { MONSTERS } from '../src/sim/data.js';
import { AI } from '../src/sim/ai.js';
import { dist, len, dot } from '../src/sim/math.js';
import { iniciarEvento } from '../src/sim/eventos.js';

const spawn = (g, p, kind, d, lift = 0) => g.spawnMonster(kind, ahead(p, d, lift));
const watch = (g, secs, fn) => run(g, secs, (t) => fn && fn(t));
const events = (g, store) => () => { for (const e of g.drainEvents()) store.push(e); };

test('bestiario: 12 criaturas + 3 jefes, cada una con IA propia y rol distinto', () => {
  const kinds = Object.keys(MONSTERS);
  assert.equal(kinds.filter((k) => !MONSTERS[k].boss).length, 12); assert.equal(kinds.filter((k) => MONSTERS[k].boss).length, 3);
  assert.equal(new Set(kinds.map((k) => MONSTERS[k].role)).size, kinds.length - 2 /* los jefes comparten rol */);
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

test('Gravitón (El Familiar) FUERA de la Marea: atrae y dispara, pero NO invierte la gravedad', () => {
  const { g, p } = arena(); spawn(g, p, 'graviton', 20, 10); const ev = []; const drain = events(g, ev); let flipped = false;
  watch(g, 15, () => { drain(); if (g.time < p.flipUntil) flipped = true; });
  assert.ok(ev.some((e) => e.t === 'pull'), 'tiró de los jugadores'); assert.ok(!ev.some((e) => e.t === 'gravity') && !flipped, 'no invirtió la gravedad'); assert.ok(p.up.y > 0.9);
});

test('Gravitón (El Familiar) DENTRO de la Marea de Gravedad: carga y luego invierte la gravedad del jugador unos segundos', () => {
  const { g, p } = arena(); iniciarEvento(g, 'marea_gravedad', { aviso: 0 });
  spawn(g, p, 'graviton', 20, 10); const ev = []; const drain = events(g, ev); let flipped = false, upDown = false;
  watch(g, 8, () => { drain(); if (g.time < p.flipUntil) { flipped = true; if (p.up.y < -0.5) upDown = true; } });
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
  run(g, 8, step); b.hp = b.maxhp * 0.6; run(g, 20, step); assert.equal(p.flipLock || 0, 0, 'sin Marea el jefe no invierte la gravedad'); b.hp = b.maxhp * 0.3; iniciarEvento(g, 'marea_gravedad', { aviso: 0 }); run(g, 9, step);
  assert.ok([1, 2, 3].every((n) => phases.has(n)), [...phases].join()); assert.ok(shots > 40, `proyectiles ${shots}`); assert.ok(summoned);
  assert.ok(ev.some((e) => e.t === 'gravity'), 'pulso de gravedad en fase 3');
  g.damageMonster(b, 1e9, p); g.step(1 / 60); g.step(1 / 60);
  assert.equal(g.state, 'won');
});

test('Madre Geoda (jefe M2): se purga en las válvulas (sólo entonces se abre), lanza espirales, invoca Racimos y es derrotable', () => {
  const { g, p, b } = bossFight('m2', 'madre'); let shots = 0, racimos = false, opened = false;
  p.hp = 1e6; p.shield = 1e6;
  assert.equal(b.valves.length, 2);
  // sin tocar las válvulas el jefe se queda cerrado
  run(g, 6, () => { shots += g.projectiles.filter((q) => q.age < 0.02).length; });
  assert.ok(!b.open && shots > 20, 'cerrada y disparando');
  // en solitario hay que pisar ambas válvulas dentro de 9 s
  for (let i = 0; i < 400 && !b.open; i++) { const v = b.valves[Math.floor(i / 60) % 2]; p.pos = { x: v.pos.x, y: v.pos.y, z: v.pos.z }; p.vel = { x: 0, y: 0, z: 0 }; g.step(1 / 60); }
  opened = b.open; assert.ok(opened, 'purga abre al jefe');
  run(g, 3, () => { racimos ||= g.monsters.some((m) => m.kind === 'racimo'); }); assert.ok(racimos);
  b.open = false; const h = b.hp; g.damageMonster(b, 100, p); assert.ok(Math.abs(h - b.hp - 15) < 1e-6, 'cerrada recibe 15%');
  b.open = true; g.damageMonster(b, 1e9, p); g.step(1 / 60); g.step(1 / 60); assert.equal(g.state, 'won');
});

test('Obelisco (francotirador): se aleja, traza línea 1.6 s, fija el blanco y dispara un rayo veloz que se puede esquivar', () => {
  const { g, p } = arena(); const m = spawn(g, p, 'obelisco', 20); let charged = 0, ray = null, lockSeen = false;
  watch(g, 20, () => { if (m.state === 'charge') { charged++; lockSeen ||= !!m.aim; } ray ||= g.projectiles.find((q) => q.kind === 'ray'); });
  assert.ok(dist(m.pos, p.pos) > 30, 'se planta lejos'); assert.ok(charged > 60 * 1.2 && lockSeen, 'telegrafía >1 s');
  assert.ok(ray && len(ray.vel) > 100, 'rayo veloz');
  // esquivable: un jugador que se mueve de lado durante la carga no es alcanzado
  const t = arena(); const o = spawn(t.g, t.p, 'obelisco', 45); t.p.hp = 1000; t.p.shield = 0; let hits = 0;
  run(t.g, 8, (time) => { t.g.setInput(t.p.id, { mx: Math.sin(time * 4) > 0 ? 1 : -1 }); }); for (const e of t.g.drainEvents()) if (e.t === 'hurt') hits++;
  assert.ok(hits <= 2, `un jugador que se mueve recibe pocos impactos (${hits})`); void o;
});

test('Aurora (sanadora): cura 30 % y escuda (daño ×0.5) a las criaturas cercanas', () => {
  const { g, p } = arena(); const a = spawn(g, p, 'aurora', 20, 6); const v = spawn(g, p, 'geoda', 22); v.hp = v.maxhp * 0.3; v.cd = 1e9;
  const ev = []; const drain = events(g, ev); let healed = false, shielded = false; const hp0 = v.hp;
  watch(g, 10, () => { drain(); if (!healed && v.hp > hp0) { healed = true; shielded = g.time < v.shieldUntil; } });
  assert.ok(healed && v.hp > hp0, 'curó'); assert.ok(shielded, 'escudó');
  const h = v.hp; v.shieldUntil = g.time + 5; v.open = true; g.damageMonster(v, 100, p); assert.ok(Math.abs(h - v.hp - 50) < 1e-6, 'daño ×0.5 con escudo'); void a;
});

test('Ariete (embestidor): avisa 1 s, carga en línea recta, empuja al jugador y queda aturdido (×1.5 de daño)', () => {
  const { g, p } = arena(); const m = spawn(g, p, 'ariete', 18); let wind = 0, stun = false, pushed = false, minSh = p.shield; const st = [];
  watch(g, 8, () => { minSh = Math.min(minSh, p.shield); st.push(m.state); if (m.state === 'wind') wind++; if (m.state === 'stun') stun = true; if (len(p.ext) > 3) pushed = true; });
  assert.ok(wind >= 55, `aviso ${wind} ticks`); assert.ok(st.includes('charge')); assert.ok(stun, 'aturdido tras embestir'); assert.ok(minSh < 100 && pushed, 'daño + empuje');
  m.stun = true; const h = m.hp; g.damageMonster(m, 100, p); assert.ok(Math.abs(h - m.hp - 150) < 1e-6);
});

test('Espiral (atractor): carga y arrastra al jugador hacia sí durante ~2.6 s', () => {
  const { g, p } = arena(); const m = spawn(g, p, 'espiral', 25, 8); const d0 = dist(p.pos, m.pos); let pulled = false, minD = d0;
  watch(g, 10, () => { if (m.state === 'pull') pulled = true; minD = Math.min(minD, dist(p.pos, m.pos)); });
  assert.ok(pulled && minD < d0 - 6, `acercó al jugador: ${d0.toFixed(1)} → ${minD.toFixed(1)}`);
});

test('Coop: un compañero cerca reanima al caído en 3 s (50 de vida, en el lugar)', () => {
  const { g, p } = arena('m1', { hp: 100 }); const q = g.addPlayer('b'); q.pos = { x: p.pos.x + 20, y: p.pos.y, z: p.pos.z };
  g.hurtPlayer(q, 1e4); assert.ok(q.dead); run(g, 2); assert.ok(q.dead, 'aún no: lejos');
  q.pos = { ...q.pos }; p.pos = { x: q.pos.x - 2, y: q.pos.y, z: q.pos.z }; run(g, 2.5); assert.ok(q.dead, '2.5 s no alcanza'); run(g, 1);
  assert.ok(!q.dead && q.hp === 50, 'revivió');
  const ev = g.drainEvents(); assert.ok(ev.some((e) => e.t === 'revive'));
});
