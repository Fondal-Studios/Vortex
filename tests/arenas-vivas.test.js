import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { MAPS, MAP_IDS } from '../src/sim/maps.js';
import { ARENA, ARENAS_VIVAS } from '../src/sim/data.js';
import { layoutArena, centroOrgano, calcFase, danarOrgano, arMelee, CTL } from '../src/sim/arenas-vivas.js';
import { makeBot } from '../src/sim/bot.js';
import { v3, dist, norm, sub, dot, makeRng } from '../src/sim/math.js';

// ARENAS VIVAS (src/sim/arenas-vivas.js, docs/MUNDO_VIVO.md): datos, fases, determinismo, daño y curación, avisos, y que ningún órgano
// bloquee apariciones ni caminos. Los bots y el presupuesto de render están en tests/arenas-vivas-bots.test.js y tests/arenas-vivas-render.test.js.
const DT = 1 / 60;
const IDLE = { mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 };
/** Partida sin oleadas automáticas, con un jugador casi invulnerable y una criatura pasiva lejana (para que la oleada no se dé por terminada). */
function mk(mapId, { seed = 1, hp = 1e6 } = {}) {
  const g = new Game({ mapId, seed }), p = g.addPlayer('t'); p.hp = hp; p.shield = 100; g.phaseT = 1e9;
  return { g, p };
}
const run = (g, s, fn) => { const n = Math.round(s / DT); for (let i = 0; i < n; i++) { if (fn) fn(i * DT, i); g.step(DT); } };
/** Fuerza «oleada n en curso desde hace t segundos» (o el respiro). */
function forzar(g, { wave = 3, t = 60, intermission = false } = {}) {
  g.queue = []; g.omens = []; g.wave = wave; g.phase = intermission ? 'intermission' : 'wave'; g.phaseT = 1e9;
  if (intermission) for (const p of g.players) p.cards = [{ w: 0, k: 'dmg' }];   // «eligiendo mejora»: en solitario el respiro espera
  if (!g.monsters.some((m) => m.passive)) { const m = g.spawnMonster('geoda', v3(0, 1.4, 0), { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e9; const q = g.players[0]; m.pos = v3(q.pos.x + 3, q.pos.y + 0.5, q.pos.z); m.dead = false; }
  g.step(DT); g.ar.t0 = g.time - t; g.step(DT);
}
const ev = (g, t) => g.events.filter((e) => e.t === t);
/** Punto a `dx,dz` del órgano y `h` m sobre el piso (respeta la «arriba» de cada mapa: en m2 el piso es el cascarón). */
const sobre = (o, dx = 0, dz = 0, h = 0.9) => v3(o.pos.x + o.u.x * h + dx, o.pos.y + o.u.y * h, o.pos.z + o.u.z * h + dz);
const aimAt = (g, p, target) => { const to = sub(target, g.eyePos(p)), flat = norm(sub(to, { x: p.up.x * dot(to, p.up), y: p.up.y * dot(to, p.up), z: p.up.z * dot(to, p.up) }), p.heading); p.heading = flat; p.pitch = Math.asin(Math.max(-1, Math.min(1, dot(norm(to), p.up)))); };

/* ───────── datos: cada arena es un organismo distinto ───────── */
test('datos: las 6 arenas tienen organismo con nombre, folclore, paleta y 3 órganos; todo distinto entre sí', () => {
  assert.deepEqual(Object.keys(ARENAS_VIVAS).sort(), [...MAP_IDS].sort());
  const nombres = new Set(), colores = new Set(), motivos = new Set(), pares = new Set();
  for (const id of MAP_IDS) {
    const d = ARENAS_VIVAS[id];
    assert.ok(d.nombre && d.folclore.length > 60, id + ' nombre y folclore');
    for (const k of ['despierto', 'furioso', 'ofrenda', 'roto', 'renace']) assert.ok(d.frases[k] && /[a-záéíóú]/i.test(d.frases[k]), `${id}: frase «${k}»`);
    assert.match(d.color, /^#[0-9a-f]{6}$/i); assert.match(d.color2, /^#[0-9a-f]{6}$/i);
    assert.equal(d.org.length, 3, id + ': 3 órganos');
    assert.equal(d.org[0].k, 'corazon', id + ': el primero es el corazón');
    assert.ok(d.org[0].hp > 0, 'el corazón se puede dañar');
    nombres.add(d.nombre); colores.add(d.color.toLowerCase()); colores.add(d.color2.toLowerCase()); motivos.add(d.motivo); pares.add(d.org.slice(1).map((o) => o.k).sort().join('+'));
    for (const o of d.org) {
      assert.ok(['corazon', 'boca', 'raiz', 'pulmon', 'vena'].includes(o.k)); assert.ok(o.nombre && o.info, 'cada órgano explica qué hace');
      if (o.atk) { assert.ok(['golpe', 'pulso', 'barrido', 'giro'].includes(o.atk.tipo)); assert.ok(Math.max(o.atk.tel, ARENA.telMin) >= 1, 'aviso de ≥ 1 s'); assert.ok(o.atk.dmg > 0 && o.atk.cd > 0); }
      if (o.k === 'boca' || o.k === 'vena') assert.ok(['cura', 'escudo', 'danio', 'veloz'].includes(o.bene), 'beneficio ' + o.bene);
    }
    assert.ok(d.org.some((o) => o.atk) || d.org.some((o) => o.k === 'pulmon'), id + ': tiene una cara de amenaza');
    assert.ok(d.org.some((o) => ['boca', 'vena', 'pulmon'].includes(o.k)), id + ': tiene una cara de ayuda');
  }
  assert.equal(nombres.size, 6); assert.equal(colores.size, 12, 'paletas todas distintas'); assert.equal(motivos.size, 6, 'siluetas distintas'); assert.equal(pares.size, 6, 'cada arena combina órganos distintos');
  assert.ok(ARENA.telMin >= 1, 'regla: ningún aviso menor a 1 s');
});

/* ───────── fases ligadas a la oleada y al tiempo ───────── */
test('fases: calma → dormido; oleada 1 duerme 25 s; luego despierto y furioso según oleada y tiempo; jefe furioso rápido; respiro = ofrenda', () => {
  const g = { practice: false, wave: 0, phase: 'intermission', time: 0, waveTotal: 7 }, A = { t0: 0, sed: false };
  assert.equal(calcFase(g, A), 'dormido');
  Object.assign(g, { wave: 1, phase: 'wave', time: 10 }); A.t0 = 0; assert.equal(calcFase(g, A), 'dormido');
  g.time = 26; assert.equal(calcFase(g, A), 'despierto'); g.time = 400; assert.equal(calcFase(g, A), 'despierto', 'la oleada 1 nunca se enfurece');
  g.wave = 2; A.t0 = 0; g.time = 49; assert.equal(calcFase(g, A), 'despierto'); g.time = 51; assert.equal(calcFase(g, A), 'furioso');
  g.wave = 3; g.time = 20; assert.equal(calcFase(g, A), 'despierto'); g.time = 29; assert.equal(calcFase(g, A), 'furioso');
  g.wave = 5; g.time = 13; assert.equal(calcFase(g, A), 'despierto'); g.time = 15; assert.equal(calcFase(g, A), 'furioso');
  g.wave = 7; g.time = 7; assert.equal(calcFase(g, A), 'despierto'); g.time = 9; assert.equal(calcFase(g, A), 'furioso');
  A.sed = true; assert.equal(calcFase(g, A), 'dormido', 'con el corazón roto vuelve a dormirse');
  g.phase = 'intermission'; assert.equal(calcFase(g, A), 'ofrenda', 'el respiro es la ofrenda aunque el corazón esté roto');
  assert.equal(calcFase({ ...g, practice: true }, A), 'dormido', 'el campo de pruebas no ataca');
});
test('fases en partida real: el organismo avisa con eventos y el snapshot trae el estado compacto', () => {
  const { g } = mk('m1'); const fases = [];
  forzar(g, { wave: 3, t: 0 }); fases.push(g.ar.ph);
  g.ar.t0 = g.time - 40; run(g, 0.1); fases.push(g.ar.ph);
  g.phase = 'intermission'; run(g, 0.1); fases.push(g.ar.ph);
  assert.deepEqual(fases, ['despierto', 'furioso', 'ofrenda']);
  const evs = g.events.filter((e) => e.t === 'ar').map((e) => e.ph); assert.deepEqual(evs, ['despierto', 'furioso', 'ofrenda'], JSON.stringify(evs));
  const s = JSON.parse(JSON.stringify(g.snapshot())), a = s.ar;
  assert.equal(a.ph, 'ofrenda'); assert.equal(a.o.length, 3); assert.ok(Array.isArray(a.tl));
  assert.ok(JSON.stringify(a).length < 700, 'compacto: ' + JSON.stringify(a).length);
});
test('el interruptor CTL.off apaga las arenas vivas sin romper nada', () => {
  CTL.off = true; try { const { g } = mk('m5'); run(g, 3); assert.equal(g.ar, null); assert.equal(g.snapshot().ar, null); } finally { CTL.off = false; }
});

/* ───────── determinismo y rng propio ───────── */
test('determinismo: misma semilla ⇒ mismo estado de arena en cada instante; semilla distinta ⇒ otro ritmo', () => {
  const trace = (seed) => {
    const g = new Game({ mapId: 'm4', seed }), p = g.addPlayer('b'), bot = makeBot(g, p.id, { seed, skill: 1.2 }); const out = [];
    for (let i = 0; i < 60 * 150; i++) { g.setInput(p.id, bot(DT)); g.step(DT); g.events.length = 0; if (i % 30 === 0) out.push(JSON.stringify(g.snapshot().ar)); }
    return out;
  };
  const a = trace(5), b = trace(5), c = trace(6);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  assert.ok(a.some((s) => JSON.parse(s).tl.length > 0), 'en 150 s hubo avisos de ataque');
});
test('rng propio: las arenas nunca tocan g.rng (la secuencia de oleadas es la misma con y sin ellas)', () => {
  const sig = (off) => {
    CTL.off = off; try {
      const g = new Game({ mapId: 'm5', seed: 9 }), p = g.addPlayer('t'); p.hp = 1e9; run(g, 20);
      assert.equal(!!g.ar, !off); return [g.rng.next(), g.monsters.map((m) => m.kind + Math.round(m.pos.x * 10)).join(), g.stats.spawned];
    } finally { CTL.off = false; }
  };
  assert.deepEqual(sig(false), sig(true));
  const g = new Game({ mapId: 'm5', seed: 9 }); assert.notEqual(g.arRng, g.rng);
});

/* ───────── daño y curación ───────── */
test('corazón: dañarlo lo rompe, adormece al organismo hasta la próxima oleada y da botín; vuelve con el 60 %', () => {
  const { g, p } = mk('m1'); forzar(g, { wave: 3, t: 60 }); run(g, 1);
  assert.equal(g.ar.ph, 'furioso'); const cores0 = p.cores || 0, picks0 = g.pickups.length;
  danarOrgano(g, 0, g.ar.org[0].max * 0.5, p); assert.ok(!g.ar.org[0].roto && g.ar.org[0].hp > 0, 'a medias');
  danarOrgano(g, 0, 1e9, p); run(g, 0.1);
  assert.ok(g.ar.org[0].roto && g.ar.sed && g.ar.ph === 'dormido', 'roto ⇒ dormido'); assert.equal(g.ar.tl.length, 0, 'se cancelan los avisos');
  assert.ok(g.events.some((e) => e.t === 'ar' && e.ph === 'roto')); assert.ok((p.cores || 0) > cores0, 'núcleos'); assert.ok(g.pickups.length > picks0, 'botiquín');
  run(g, 20); assert.equal(g.ar.ph, 'dormido', 'sigue dormido la oleada entera'); assert.equal(g.ar.tl.length, 0, 'y no ataca');
  g.wave = 4; run(g, 0.1); assert.ok(!g.ar.org[0].roto && !g.ar.sed); assert.ok(g.ar.org[0].hp >= g.ar.org[0].max * 0.59, 'vuelve con 60 %');
});
test('corazón: el rayo del arma, las explosiones y el cuerpo a cuerpo lo dañan', () => {
  const { g, p } = mk('m1'); forzar(g, { wave: 2, t: 0 }); const C = centroOrgano(g.ar.L.org[0]);
  p.pos = v3(0, 0.9, -8); p.vel = v3(); aimAt(g, p, C);
  const hp0 = g.ar.org[0].hp; g.setInput(p.id, { ...IDLE, fire: true }); run(g, 1.5); g.setInput(p.id, IDLE);
  assert.ok(g.ar.org[0].hp < hp0, 'el disparo daña al corazón');
  const h1 = g.ar.org[0].hp; g.explode(C, 3, 0, 100, p, false); assert.ok(g.ar.org[0].hp < h1, 'la explosión lo daña');
  const h2 = g.ar.org[0].hp; const n = arMelee(g, v3(C.x, C.y, C.z + 2.5), 3.4, v3(0, 0, -1), 0.5, 60, p); assert.equal(n, 1); assert.ok(g.ar.org[0].hp < h2, 'el golpe cuerpo a cuerpo lo daña');
  assert.ok(ev(g, 'arhit').length >= 3);
});
test('los órganos reciben el disparo pero NO frenan el rayo ni el proyectil: no tapan a las criaturas', () => {
  const { g, p } = mk('m1'); forzar(g, { wave: 2, t: 0 }); const C = centroOrgano(g.ar.L.org[0]);
  p.pos = v3(C.x, 0.9, C.z + 9); p.heading = v3(0, 0, -1); p.pitch = 0; p.vel = v3(); p.up = v3(0, 1, 0);
  const m = g.spawnMonster('geoda', v3(C.x, g.eyePos(p).y + 0.0, C.z - 8), { noElite: true }); m.passive = true; m.open = true; m.hp = m.maxhp = 1e6; m.pos = v3(C.x, g.eyePos(p).y, C.z - 8);
  g.ar.org[0].hp = g.ar.org[0].max; // el corazón (y=3,4 m) queda entre el jugador y la criatura sólo si se apunta alto: se apunta al corazón y a la criatura a la vez con el rayo
  aimAt(g, p, v3(C.x, C.y, C.z)); const dir = g.aimDir(p), o = g.eyePos(p); const monAlineada = v3(C.x + dir.x * 8, C.y + dir.y * 8, C.z + dir.z * 8); m.pos = monAlineada;
  const hp0 = m.hp, h0 = g.ar.org[0].hp; g.setInput(p.id, { ...IDLE, fire: true }); run(g, 0.5); g.setInput(p.id, IDLE);
  assert.ok(g.ar.org[0].hp < h0, 'el corazón recibe'); assert.ok(m.hp < hp0, 'la criatura de atrás también (el órgano no frena el rayo)'); void o;
});
test('Núcleo de Eco (m2): sólo recibe todo el daño cuando el Fuelle inspira', () => {
  const { g, p } = mk('m2'); forzar(g, { wave: 2, t: 0 }); const A = g.ar, ip = A.L.org.findIndex((o) => o.k === 'pulmon');
  A.org[ip].mode = 0; const a0 = A.org[0].hp; danarOrgano(g, 0, 100, p); const abierto = a0 - A.org[0].hp;
  A.org[ip].mode = 2; const b0 = A.org[0].hp; danarOrgano(g, 0, 100, p); const cerrado = b0 - A.org[0].hp;
  assert.ok(abierto > cerrado * 2.5, `${abierto} vs ${cerrado}`);
});
test('Corazón Calcificado (m6): roto vuelve solo a los 26 s (el Osario no descansa)', () => {
  const { g, p } = mk('m6'); forzar(g, { wave: 3, t: 60 }); danarOrgano(g, 0, 1e9, p); run(g, 1); assert.ok(g.ar.org[0].roto);
  run(g, 24); assert.ok(g.ar.org[0].roto, 'aún roto a los 25 s'); run(g, 3);
  assert.ok(!g.ar.org[0].roto && !g.ar.sed, 'vuelve'); assert.ok(g.events.some((e) => e.t === 'ar' && e.ph === 'renace'));
});
test('Madre Raíz (m4): el corazón se regenera rápido si lo dejás de dañar', () => {
  const { g, p } = mk('m4'); forzar(g, { wave: 2, t: 0 }); danarOrgano(g, 0, g.ar.org[0].max * 0.5, p); const h0 = g.ar.org[0].hp; run(g, 10); assert.ok(g.ar.org[0].hp > h0 + g.ar.org[0].max * 0.1, 'regenera');
});

const BENE = { m1: ['linterna', 'escudo'], m2: ['iris', 'danio'], m3: ['coro', 'cura'] };
for (const [mapId, [oid, bene]] of Object.entries(BENE)) {
  test(`${mapId}: la Boca (${bene}) se alimenta con bajas cercanas, abre su zona y ayuda a quien reclama su luz`, () => {
    const { g, p } = mk(mapId); forzar(g, { wave: 2, t: 10 }); const A = g.ar, i = A.L.org.findIndex((o) => o.id === oid), o = A.L.org[i];
    p.pos = sobre(o, 1); p.vel = v3(); p.up = o.u; p.hp = 50; p.shield = 20;
    assert.equal(A.org[i].zone, 0); const lejos = g.spawnMonster('astilla', sobre(o, 60, 0, 1.4), { noElite: true }); g.killMonster(lejos, p); assert.equal(A.org[i].fed, 0, 'una baja lejana no alimenta');
    let n = 0; while (A.org[i].zone <= 0 && n++ < 20) { const m = g.spawnMonster('astilla', sobre(o, 2, 1, 1.4), { noElite: true }); g.killMonster(m, p); }
    assert.ok(A.org[i].zone > 0 && n >= 4 && n <= 6, `se abre tras ${n} bajas`); assert.ok(g.events.some((e) => e.t === 'arofrenda'));
    const hp0 = p.hp, sh0 = p.shield; let dmgMul = 1; run(g, 2, () => { p.pos = sobre(o, 1); dmgMul = Math.max(dmgMul, p.arB ? p.arB.dmg : 1); });
    if (bene === 'cura') assert.ok(p.hp > hp0 + 5, 'cura'); if (bene === 'escudo') assert.ok(p.shield > sh0 + 20, 'escudo'); if (bene === 'danio') assert.ok(dmgMul > 1.2, 'daño extra ' + dmgMul);
    // fuera de la luz no hay beneficio
    p.pos = sobre(o, o.r + 15); g.step(DT); assert.equal(p.arB.dmg, 1);
    // defender: las criaturas dentro apagan la zona más rápido
    const z0 = A.org[i].zone; run(g, 3); const sin = z0 - A.org[i].zone;
    for (let k = 0; k < 5; k++) { const m = g.spawnMonster('geoda', sobre(o, 1 + k * 0.1, 0, 1.4), { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e9; }
    const z1 = A.org[i].zone; run(g, 3); assert.ok(z1 - A.org[i].zone > sin * 1.5, 'con enemigos dentro se apaga más rápido');
  });
}
test('Boca en ofrenda: el respiro la abre sola (sin alimentarla) y ayuda al máximo', () => {
  const { g, p } = mk('m3'); forzar(g, { wave: 2, t: 10, intermission: true }); const A = g.ar, i = A.L.org.findIndex((o) => o.k === 'boca'), o = A.L.org[i];
  p.pos = v3(o.pos.x, 0.9, o.pos.z); p.hp = 40; run(g, 2); assert.equal(g.snapshot().ar.o[i][3], 99); assert.ok(p.hp > 40 + 10, 'cura más fuerte que en oleada');
});
const VENAS = { m1: ['corriente', 'veloz'], m5: ['adoquin', 'veloz'], m6: ['costillar', 'danio'] };
for (const [mapId, [oid, bene]] of Object.entries(VENAS)) {
  test(`${mapId}: la Vena de luz (${bene}) da su beneficio sólo a quien pisa el carril`, () => {
    const { g, p } = mk(mapId); forzar(g, { wave: 2, t: 10 }); const o = g.ar.L.org.find((q) => q.id === oid);
    p.pos = v3(o.pos.x, 0.9, o.pos.z); p.vel = v3(); g.step(DT); assert.ok(bene === 'veloz' ? p.arB.vel > 1.2 : p.arB.dmg > 1.2, 'beneficio dentro');
    p.pos = v3(o.pos.x + 12, 0.9, o.pos.z); g.step(DT); assert.equal(p.arB.vel, 1); assert.equal(p.arB.dmg, 1);
    if (bene === 'veloz') { // y se nota en la marcha real
      const dir = norm(sub(o.B, o.A)), perp = v3(-dir.z, 0, dir.x);
      const v = (off) => { const q = mk(mapId); forzar(q.g, { wave: 2, t: 10 }); const a = v3(o.A.x + dir.x * 0.3 * o.L + perp.x * off, 0.9, o.A.z + dir.z * 0.3 * o.L + perp.z * off); q.p.pos = a; q.p.heading = dir; q.p.vel = v3(); q.g.setInput(q.p.id, { ...IDLE, mz: 1 }); run(q.g, 0.6); return dist(q.p.pos, a); };
      assert.ok(v(0) > v(12) * 1.15, 'corre más sobre el carril');
    }
  });
}

/* ───────── amenazas con aviso y contrajuego ───────── */
test('amenazas: cada ataque avisa ≥ 1,2 s, golpea donde estabas y se esquiva moviéndose (golpe de la Madre Raíz, m4)', () => {
  for (const quedarse of [true, false]) {
    const { g, p } = mk('m4'); forzar(g, { wave: 3, t: 60 }); const o = g.ar.L.org.find((q) => q.id === 'zarcillo'); p.pos = v3(o.pos.x, 0.9, o.pos.z - 6); p.shield = 0; p.hp = 100; p.vel = v3();
    let T = null, n = 0; while (!T && n++ < 60 * 40) { run(g, DT); T = g.ar.tl.find((q) => q.i === g.ar.L.org.indexOf(o)); if (T) break; }
    assert.ok(T, 'apareció el aviso'); assert.ok(T.at - T.born >= 1.2, 'aviso ' + (T.at - T.born)); assert.equal(T.tipo, 'golpe');
    const c = T.c; g.events.length = 0; assert.equal(p.hp, 100);
    if (!quedarse) p.pos = v3(c.x + 9, 0.9, c.z);
    run(g, (T.at - g.time) + 0.3);
    const hurt = ev(g, 'hurt').length > 0 || p.hp < 100;
    if (quedarse) assert.ok(hurt, 'quedarse quieto duele'); else assert.ok(!hurt, 'moverse lo esquiva');
    assert.ok(ev(g, 'boom').length > 0);
  }
});
test('amenazas: el golpe también hiere a las criaturas (llevarlas a la raíz es contrajuego)', () => {
  const { g, p } = mk('m4'); forzar(g, { wave: 3, t: 60 }); const o = g.ar.L.org.find((q) => q.id === 'zarcillo'); p.pos = v3(o.pos.x, 0.9, o.pos.z - 6);
  let T = null; for (let n = 0; !T && n < 60 * 40; n++) { run(g, DT); T = g.ar.tl[0]; }
  const m = g.spawnMonster('astilla', v3(T.c.x, 1.4, T.c.z), { noElite: true }); m.passive = true; const hp0 = m.hp; p.pos = v3(T.c.x + 9, 0.9, T.c.z); run(g, T.at - g.time + 0.2); assert.ok(m.dead || m.hp < hp0);
});
test('amenazas: las bajas que causa la arena se le acreditan al jugador más cercano (no se pierden núcleos ni puntaje)', () => {
  const { g, p } = mk('m4'); forzar(g, { wave: 3, t: 60 }); const o = g.ar.L.org.find((q) => q.id === 'zarcillo'); p.pos = v3(o.pos.x, 0.9, o.pos.z - 6);
  let T = null; for (let n = 0; !T && n < 60 * 40; n++) { run(g, DT); T = g.ar.tl[0]; }
  const m = g.spawnMonster('astilla', v3(T.c.x, 1.4, T.c.z), { noElite: true }); m.passive = true; m.hp = 1; const k0 = p.kills; p.pos = v3(T.c.x + 9, 0.9, T.c.z);
  run(g, T.at - g.time + 0.2, () => { p.pos = v3(T.c.x + 9, 0.9, T.c.z); }); assert.ok(m.dead, 'murió en el círculo'); assert.equal(p.kills, k0 + 1, 'se le acredita la baja');
});
test('amenazas: el pulso (m1) golpea dentro del anillo y no afuera; el aviso es el anillo', () => {
  for (const dentro of [true, false]) {
    const { g, p } = mk('m1'); forzar(g, { wave: 3, t: 60 }); const o = g.ar.L.org[0]; p.shield = 0; p.hp = 100;
    const donde = dentro ? v3(o.pos.x + 4, 0.9, o.pos.z + 3) : v3(o.pos.x - 14, 0.9, o.pos.z); p.pos = donde; p.vel = v3();
    let T = null; for (let n = 0; !T && n < 60 * 30; n++) { p.pos = donde; run(g, DT); T = g.ar.tl[0]; }
    assert.ok(T && T.tipo === 'pulso' && T.at - T.born >= 1.2); g.events.length = 0; run(g, T.at - g.time + 0.2, () => { p.pos = donde; });
    assert.equal(ev(g, 'hurt').length > 0, dentro);
  }
});
test('amenazas: el barrido de sonido (m3) es una línea; cubrirse o salirse de ella lo evita, y los muros la cortan', () => {
  // el haz apunta a donde estabas al empezar el aviso: quedarse duele, correr de costado lo esquiva
  const hit = (costado) => { const { g, p } = mk('m3'); forzar(g, { wave: 3, t: 60 }); p.shield = 0; p.hp = 100; p.vel = v3();
    let T = null; for (let n = 0; !T && n < 60 * 40; n++) { p.pos = v3(0, 0.9, 0); run(g, DT); T = g.ar.tl[0]; } assert.ok(T && T.tipo === 'barrido' && T.at - T.born >= 1.2); g.events.length = 0;
    run(g, T.at - g.time + 0.1, () => { p.pos = v3(costado, 0.9, 0); }); return { hurt: ev(g, 'hurt').length > 0, len: T.r }; };
  const quieto = hit(0), esquiva = hit(9);
  assert.ok(quieto.hurt, 'en la línea duele'); assert.ok(!esquiva.hurt, 'a 9 m de costado no duele'); assert.ok(quieto.len > 20, 'el haz es largo');
});
test('amenazas: la manecilla (m5) gira, avisa 1,8 s, barre la plaza abierta y las coberturas la frenan', () => {
  // en la plaza abierta: el haz es largo y quien se queda en su camino recibe el golpe
  { const { g, p } = mk('m5'); forzar(g, { wave: 3, t: 60 }); p.shield = 0; p.hp = 100; const donde = v3(10, 0.9, -4);
    let T = null; for (let n = 0; !T && n < 60 * 40; n++) { p.pos = donde; run(g, DT); T = g.ar.tl.find((q) => q.tipo === 'giro'); }
    assert.ok(T && T.at - T.born >= 1.8 - 1e-6 && T.r > 20, 'largo en campo abierto: ' + (T && T.r)); g.events.length = 0;
    run(g, T.at - g.time + 0.3, () => { p.pos = donde; }); assert.ok(ev(g, 'hurt').length > 0, 'en el camino del haz duele'); }
  // detrás del quiosco (cobertura alta) en línea recta con la fuente: el haz se corta y no duele
  { const { g, p } = mk('m5'); forzar(g, { wave: 3, t: 60 }); const o = g.ar.L.org.find((q) => q.id === 'manecilla'); p.shield = 0; p.hp = 100;
    const K = v3(13, 0, -25), d = norm(sub(K, v3(o.pos.x, 0, o.pos.z))), detras = v3(K.x + d.x * 3.5, 0.9, K.z + d.z * 3.5);
    let T = null; for (let n = 0; !T && n < 60 * 40; n++) { p.pos = detras; run(g, DT); T = g.ar.tl.find((q) => q.tipo === 'giro'); }
    const dd = dist(v3(o.pos.x, 0, o.pos.z), v3(detras.x, 0, detras.z));
    assert.ok(T.r > 15 && T.r < dd - 0.5, `el haz se corta en la cobertura (${T.r.toFixed(1)} entre 15 y ${dd.toFixed(1)})`);
    g.events.length = 0; run(g, T.at - g.time + 0.3, () => { p.pos = detras; }); assert.equal(ev(g, 'hurt').length, 0, 'cubierto: no duele');
    const dir0 = { ...T.dir0 }; run(g, 0.9); const d1 = g.ar.tl[0] ? g.ar.tl[0].dir : null; assert.ok(d1 && dist(d1, dir0) > 0.3, 'la línea gira'); assert.ok(ev(g, 'arfire').length >= 1); }
});
test('amenazas: sin amenaza en dormido ni en ofrenda; en despierto ataca a menor cadencia que en furioso', () => {
  const cuenta = (fase) => {
    const { g, p } = mk('m4'); forzar(g, fase === 'ofrenda' ? { wave: 3, t: 5, intermission: true } : { wave: fase === 'dormido' ? 1 : 3, t: fase === 'despierto' ? 5 : fase === 'dormido' ? 2 : 60 });
    const o = g.ar.L.org.find((q) => q.id === 'zarcillo'), seen = new Set();
    run(g, 100, () => { p.pos = v3(o.pos.x, 0.9, o.pos.z - 6); if (fase === 'despierto') g.ar.t0 = g.time - 5; if (fase === 'furioso') g.ar.t0 = g.time - 60; if (fase === 'dormido') g.ar.t0 = g.time - 2; for (const T of g.ar.tl) seen.add(T.born); });
    assert.equal(g.ar.ph, fase); return seen.size;
  };
  assert.equal(cuenta('dormido'), 0); assert.equal(cuenta('ofrenda'), 0);
  const d = cuenta('despierto'), f = cuenta('furioso'); assert.ok(d >= 1 && f > d, `despierto ${d} < furioso ${f}`);
});
test('amenazas: nunca más de ARENA.maxTel avisos a la vez y siempre ≥ 1,2 s de aviso, en las 6 arenas durante 4 minutos', () => {
  for (const id of MAP_IDS) {
    const { g, p } = mk(id); forzar(g, { wave: 5, t: 60 }); const L = g.ar.L.org.filter((o) => o.atk || o.k === 'pulmon'); let max = 0, min = 99, total = 0;
    run(g, 240, () => { const o = L[Math.floor(g.time / 7) % L.length]; p.pos = sobre(o, 0, -6); p.hp = 1e6; g.ar.t0 = Math.min(g.ar.t0, g.time - 60); max = Math.max(max, g.ar.tl.length); for (const T of g.ar.tl) { min = Math.min(min, T.tel); total++; } });
    assert.ok(max <= ARENA.maxTel, id + ' avisos simultáneos ' + max); if (total) assert.ok(min >= 1.2 - 1e-9, id + ' aviso mínimo ' + min);
  }
});
for (const [mapId, oid] of [['m2', 'fuelle'], ['m4', 'esporas'], ['m6', 'respiradero']]) {
  test(`${mapId}: el Pulmón cambia la bruma — sana en calma, daña (con aviso al retener el aire) cuando el organismo está furioso`, () => {
    const medir = (fase) => {
      const { g, p } = mk(mapId); forzar(g, fase === 'furioso' ? { wave: 3, t: 60 } : { wave: 2, t: 0 }); const o = g.ar.L.org.find((q) => q.id === oid), i = g.ar.L.org.indexOf(o);
      p.pos = sobre(o); p.up = o.u; p.shield = 0; p.hp = 60; let avisoPrevio = false, mode2 = 0, hurts = 0;
      run(g, 40, () => { p.pos = sobre(o); if (g.ar.org[i].mode === 1) avisoPrevio = true; if (g.ar.org[i].mode === 2) mode2++; hurts += ev(g, 'hurt').length; g.events.length = 0; });
      return { hp: p.hp, avisoPrevio, mode2, hurts };
    };
    const calm = medir('despierto'), furia = medir('furioso');
    assert.ok(calm.mode2 > 0 && furia.avisoPrevio, 'el ciclo respira: inspira, retiene y exhala'); assert.ok(calm.hp > 60 && calm.hurts === 0, 'en calma sana: ' + JSON.stringify(calm)); assert.ok(furia.hurts > 0, 'furioso daña: ' + JSON.stringify(furia));
  });
}
test('amenazas: romper una raíz o un pulmón los apaga hasta la próxima oleada', () => {
  const { g, p } = mk('m4'); forzar(g, { wave: 3, t: 60 }); const o = g.ar.L.org.find((q) => q.id === 'zarcillo'), i = g.ar.L.org.indexOf(o); p.pos = v3(o.pos.x, 0.9, o.pos.z - 6);
  danarOrgano(g, i, 1e9, p); const antes = g.stats.spawned; let avisos = 0; run(g, 60, () => { p.pos = v3(o.pos.x, 0.9, o.pos.z - 6); avisos += g.ar.tl.filter((T) => T.i === i).length; }); assert.equal(avisos, 0); void antes;
  g.wave = 4; run(g, 0.1); assert.ok(!g.ar.org[i].roto);
});

/* ───────── ningún órgano bloquea apariciones ni caminos ───────── */
function puntos(o) { return o.k === 'vena' ? Array.from({ length: 9 }, (_, k) => v3(o.A.x + (o.B.x - o.A.x) * k / 8, 0, o.A.z + (o.B.z - o.A.z) * k / 8)) : [o.pos]; }
test('órganos: no son sólidos, no tapan apariciones ni puntos de objetivo y están dentro de la arena', () => {
  for (const id of MAP_IDS) {
    const g = new Game({ mapId: id, seed: 2 }), m = g.map, n0 = m.solids.length; g.addPlayer('t'); run(g, 5);
    assert.equal(m.solids.length, n0, id + ': las arenas vivas no agregan sólidos');
    const L = layoutArena(m), sp = m.spots, spawns = [0, 1, 2, 3].map((i) => m.playerSpawn(i)), objetivos = [sp.anchor, sp.core, sp.altar, ...sp.plates].filter(Boolean);
    for (const o of L.org) for (const q of puntos(o)) {
      const base = { x: q.x, y: 0, z: q.z };
      for (const s of spawns) assert.ok(Math.hypot(q.x - s.x, q.y - s.y, q.z - s.z) > (o.k === 'vena' ? 6 : 12), `${id}/${o.id}: lejos de la aparición`);
      for (const t of objetivos) assert.ok(dist(base, { x: t.x, y: 0, z: t.z }) > (o.k === 'vena' ? 2 : 5), `${id}/${o.id}: no encima de un objetivo`);
      if (id === 'm1') assert.ok(Math.hypot(q.x, q.z) < m.islands[0].r - 2, 'm1: dentro de la isla central');
      if (id === 'm4') { const hub = { x: 0, z: 0, r: 24 }; assert.ok(Math.hypot(q.x - hub.x, q.z - hub.z) < hub.r - 2, 'm4: dentro del Corazón'); }
      if (id === 'm3') for (const w of m.walls) assert.ok(!(Math.abs(q.x - w.c.x) < w.h.x + 1 && Math.abs(q.z - w.c.z) < w.h.z + 1), 'm3: no dentro de un muro');
      if (id === 'm5' || id === 'm6') {
        assert.ok(m.rooms.some((r) => q.x > r.x0 && q.x < r.x1 && q.z > r.z0 && q.z < r.z1), id + ': dentro de la arena');
        if (!(o.cover || o.h > 2.5)) assert.ok(m.walkable(q.x, q.z, 0.4), `${id}/${o.id}: en suelo libre de coberturas`);
      }
    }
    if (id === 'm2') for (const o of L.org) { assert.ok(Math.abs(Math.hypot(o.pos.x, o.pos.y, o.pos.z) - (m.R - 0.9)) < 1e-6, 'sobre el cascarón'); for (const h of m.hills) void h; for (const s of m.solids.filter((q) => q.type === 'sph')) assert.ok(dist(o.pos, s.c) > s.r + 3.5, 'm2: libre de colinas'); }
  }
});
test('órganos: con las arenas activas y furiosas se sigue llegando caminando (física real) a todos los objetivos de m5 y m6', () => {
  for (const id of ['m5', 'm6']) {
    const { g, p } = mk(id); forzar(g, { wave: 3, t: 60 }); const m = g.map, sp = m.spots; g.monsters.length = 0; p.hp = 1e9;
    for (const tgt of [sp.anchor, sp.core, sp.altar, ...sp.plates, m.playerSpawn(0)]) {
      let t = 0, ok = false;
      while (t < 80) {
        if (Math.hypot(tgt.x - p.pos.x, tgt.z - p.pos.z) < 2.2) { ok = true; break; }
        const st = m.navStep(p.pos, tgt); assert.notEqual(st, 'none'); const w = st || tgt, wx = w.x - p.pos.x, wz = w.z - p.pos.z, l = Math.hypot(wx, wz) || 1;
        p.heading = v3(wx / l, 0, wz / l); g.setInput(p.id, { ...IDLE, mz: 1 }); g.step(DT); g.events.length = 0; t += DT; g.ar.t0 = Math.min(g.ar.t0, g.time - 60);
      }
      assert.ok(ok, `${id}: no llegó a ${JSON.stringify(tgt)} con las arenas activas`);
    }
  }
});
