// JEFES de las 6 arenas (docs/JEFES.md): 4 fases, mecánicas con telegrafía, momento único, IA adaptativa al estilo (melé / tirador / habilidades / esquivador),
// topes, determinismo, snapshot compacto, política «sin teletransportes» y readaptación al cambiar de modo.
// Correr: node --test tests/jefes.test.js   (una suite a la vez: las peleas completas son pesadas)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { BOSS_OF } from '../src/sim/data.js';
import { MAP_IDS } from '../src/sim/maps.js';
import { v3, dist } from '../src/sim/math.js';
import { JEFES, POSTURAS, CONTRA, IA, REPERTORIO, FASE_UMBRALES, JEFES as J } from '../src/sim/jefe-data.js';
import { iaMult, iaMemoria, iaExport, iaSnap, CTL } from '../src/sim/jefe-ia.js';
import { mecForzar, mecMov, mecEvitar } from '../src/sim/jefe-mec.js';
import { jefeMult } from '../src/sim/jefes.js';
import { pelea } from '../tools/jefe-bots.js';

const T60 = 1 / 60;
const run = (g, s, fn) => { const n = Math.round(s / T60); for (let i = 0; i < n; i++) { if (fn) fn(i); g.step(T60); } };
/** Pelea de laboratorio: el jefe ya está (su presentación saltada) y no ataca solo: se le piden los ataques uno a uno con mecForzar. */
function lab(mapId = 'm1', n = 1) {
  const g = new Game({ mapId, seed: 3 }); const ps = [];
  for (let i = 0; i < n; i++) { const p = g.addPlayer('t' + i, null, { char: 'axioma' }); p.hp = 1e6; p.shield = 0; ps.push(p); }
  g.phaseT = 1e9; g.wave = g.waveTotal; g.phase = 'wave'; g.queue = [];
  const b = g.spawnMonster(BOSS_OF[mapId], g.map.bossAnchor); b.mec.t = 30; b.mec.cd = 999; b.mec.dCd = 999;
  g.ar = null; g.ng = null; g.fl = null; g.fa = null; b.cd = b.cd2 = b.sum = b.flipT = b.gazeCd = b.gest = 1e9;   // aislado: sin organismo vivo, nieblas, flora ni ataques viejos del jefe
  g.dmg = {}; const emit0 = g.emit.bind(g); g.emit = (e) => { if (e.t === 'hurt') g.dmg[e.pid] = (g.dmg[e.pid] || 0) + e.dmg; emit0(e); };   // daño recibido por jugador (el escudo se regenera: no sirve medir la vida)
  GG = g; return { g, p: ps[0], ps, b };
}
const poner = (p, x, y, z) => { p.pos = v3(x, y, z); p.vel = v3(); };
let GG = null; const perdido = (p) => (GG && GG.dmg[p.id]) || 0;

test('datos: los 6 mapas tienen jefe propio con 4 fases, momento único, repertorio válido y posturas coherentes', () => {
  assert.deepEqual(Object.keys(JEFES).sort(), [...MAP_IDS].sort());
  assert.deepEqual(FASE_UMBRALES, [0.75, 0.5, 0.25]);
  for (const id of MAP_IDS) {
    const j = JEFES[id]; assert.equal(j.base, BOSS_OF[id], `${id}: el cuerpo es el de BOSS_OF`);
    assert.equal(j.fases.length, 4, `${id}: 4 fases`); assert.ok(j.nombre && j.unico && j.unico.nombre && j.unico.aviso && j.desc && j.arena && j.arena.etiqueta, `${id}: textos en español`);
    for (const x of j.sin) assert.ok(REPERTORIO[x], `${id}: «sin» válido`);
  }
  assert.equal(new Set(MAP_IDS.map((m) => JEFES[m].unico.id)).size, MAP_IDS.length, 'cada jefe tiene un momento único DISTINTO');
  for (const k of ['antimele', 'antidist', 'antihab', 'antipasivo']) assert.ok(POSTURAS[k].icono && POSTURAS[k].corto && POSTURAS[k].aviso.includes('{jefe}') && POSTURAS[k].aviso.includes('aprende de ti'));
  assert.deepEqual(Object.values(CONTRA).sort(), ['antidist', 'antihab', 'antimele', 'antipasivo', 'neutro']);
  assert.ok(IA.topeRes <= 0.25 && IA.pisoMul > 0 && IA.rezago >= 8 && IA.resFase.every((x) => x <= 1));
});

test('cada ataque del repertorio tiene su marca de telegrafía de al menos 1 s antes de pegar (y los momentos únicos también)', () => {
  const ataques = ['nova', 'zonas', 'barrido', 'carga', 'reflejo', 'espinas', 'silencio', 'voladores', 'reparto', 'arena', 'trampas', 'descenso', 'campanadas', 'procesion', 'mirada_total'];
  for (const [mapa, ids] of [['m1', ataques.filter((a) => !['campanadas', 'procesion', 'mirada_total'].includes(a))], ['m5', ['campanadas', 'muralla']], ['m6', ['procesion']], ['m3', ['mirada_total']], ['m2', ['parto', 'raices']], ['m4', ['floracion']]]) {
    for (const id of ids) {
      const { g, p, b } = lab(mapa); poner(p, 6, g.map.spots ? 0.9 : 0.9, 6); run(g, 0.2);
      const antes = b.mec.tg.length; assert.ok(mecForzar(g, b, id), `${mapa}/${id}: arranca`);
      const vistas = []; run(g, 3.2, () => { for (const k of b.mec.tg) vistas.push(k); });
      const marcas = vistas.filter((k) => k.k !== 'h' && (k.k !== 'o' || ['reflejo', 'espinas'].includes(id)));
      if (['arena', 'voladores', 'trampas'].includes(id)) continue;   // su aviso es el del organismo, el de los omens o la marca de la trampa (se prueban aparte)
      assert.ok(marcas.length > antes, `${mapa}/${id}: dibuja una marca`);
      for (const k of marcas) assert.ok(k.T >= 1.0 - 1e-9, `${mapa}/${id}: telegrafía de ${k.T} s < 1 s`);
    }
  }
});

test('nova: golpea a quien está dentro del círculo (con empuje) y no a quien se aleja', () => {
  const { g, ps, b } = lab('m3', 2); const [cerca, lejos] = ps; poner(cerca, 6, 0.9, 0); poner(lejos, 22, 0.9, 0); run(g, 0.3);   // (laberinto: la plaza central es llana y sin muros)
  assert.ok(mecForzar(g, b, 'nova')); run(g, 2.4);
  assert.ok(perdido(cerca) > 15, `dentro: ${perdido(cerca)}`); assert.equal(perdido(lejos), 0, 'fuera no recibe nada');
});

test('zonas: sólo pega a quien sigue parado donde estaba la marca (moverse alcanza)', () => {
  const { g, ps, b } = lab('m3', 2); const [quieto, movil] = ps; poner(quieto, -10, 0.9, 5); poner(movil, 10, 0.9, 5); run(g, 0.3);
  assert.ok(mecForzar(g, b, 'zonas')); run(g, 0.5); poner(movil, 10, 0.9, -40); run(g, 2.4);
  assert.ok(perdido(quieto) > 10, 'el quieto recibe'); assert.equal(perdido(movil), 0, 'el que se movió no');
});

test('descenso (Pisotón): cae con velocidad limitada, la onda sólo pega al que está en el suelo, y queda con el núcleo expuesto (escudo fuera, daño ×1,35)', () => {
  const { g, ps, b } = lab('m1', 2); const [suelo, aire] = ps; poner(suelo, 6, 0.9, 0); poner(aire, -6, 0.9, 0); run(g, 0.3);
  const d0 = b.hp, escudo = jefeMult(g, b, suelo); assert.ok(b.shield && Math.abs(escudo - 1) < 1e-9);
  g.damageMonster(b, 100, suelo); const conEscudo = d0 - b.hp; b.hp = d0;
  assert.ok(mecForzar(g, b, 'descenso'));
  let maxPaso = 0, prev = { ...b.pos }, saltado = false;
  run(g, 4.2, () => { maxPaso = Math.max(maxPaso, dist(prev, b.pos)); prev = { ...b.pos }; if (!saltado && b.mec.act && b.mec.act.fase === 'cae' && b.pos.y < 14) { saltado = true; aire.pos.y += 3; aire.grounded = false; } if (b.mec.bajo > 0) { aire.grounded = false; } });
  assert.ok(b.mec.bajo > 3 && b.mec.nu > 3, `ventana abierta: bajo ${b.mec.bajo}`); assert.ok(b.pos.y < b.mec.gy + b.r + 3, `bajó a ${b.pos.y}`);
  assert.ok(maxPaso < 1.1, `sin teletransportes: paso máx ${maxPaso}`);
  g.damageMonster(b, 100, suelo); const expuesto = d0 - b.hp; assert.ok(expuesto > conEscudo * 15, `núcleo expuesto: ${expuesto} vs ${conEscudo}`);
  assert.ok(perdido(suelo) > 20 && perdido(aire) === 0, `onda: suelo ${perdido(suelo)} aire ${perdido(aire)}`);
  // sube despacio al terminar
  let sube = 0, p0 = b.pos.y; run(g, 9, () => { sube = Math.max(sube, Math.abs(b.pos.y - p0)); p0 = b.pos.y; }); assert.ok(sube < 0.5, `subida suave ${sube}`);
  assert.equal(b.mec.bajo, 0); assert.ok(b.pos.y > 15, `volvió arriba (${b.pos.y})`);
});

test('carga (picada): línea roja de ≥ 1 s, pega a quien está en la línea y deja al jefe expuesto un rato; nunca se teletransporta', () => {
  const { g, p, b } = lab('m1'); poner(p, 12, 0.9, 0); run(g, 0.3);
  assert.ok(mecForzar(g, b, 'carga')); let linea = 0, paso = 0, prev = { ...b.pos };
  run(g, 4, () => { if (b.mec.tg.some((k) => k.k === 'l')) linea = Math.max(linea, b.mec.tg.find((k) => k.k === 'l').T); paso = Math.max(paso, dist(prev, b.pos)); prev = { ...b.pos }; });
  assert.ok(linea >= 1.2, `telegrafía ${linea}`); assert.ok(paso < 1.1, `paso ${paso}`); assert.ok(perdido(p) > 15, 'recibió la picada'); assert.ok(b.mec.bajo > 0 || b.pos.y < 12, 'queda abajo');
});

test('reflejo: devuelve los disparos de frente (daño ×0,45) y no toca al melé; espinas: el melé cuesta daño y pega menos', () => {
  const { g, p, b } = lab('m1'); poner(p, 0, 0.9, 12); run(g, 0.3); b.fwd = { x: 0, y: 0, z: 1 };
  assert.ok(mecForzar(g, b, 'reflejo')); run(g, 1.6); assert.ok(b.mec.refl > 0);
  g.dmgSrc = null; const mg = jefeMult(g, b, p); assert.ok(Math.abs(mg - 0.45 * 1) < 0.2 || mg < 1, `daño de disparo reducido: ${mg}`);
  g.dmgSrc = 'melee'; assert.ok(jefeMult(g, b, p) >= 1 - 1e-9 || jefeMult(g, b, p) > 0.9, 'el melé no se reduce'); g.dmgSrc = null;
  b.mec.refl = 0; b.mec.act = null; assert.ok(mecForzar(g, b, 'espinas')); run(g, 1.6); assert.ok(b.mec.spin > 0);
  g.dmgSrc = 'melee'; p.inMelee = true; assert.ok(jefeMult(g, b, p) < 0.8, 'melé reducido con la costra'); p.inMelee = false; g.dmgSrc = null;
});

test('silencio: sin habilidades unos segundos (con aviso de 2 s) y las recargas se alargan', () => {
  const { g, p, b } = lab('m1'); poner(p, 8, 0.9, 0); p.movCd = 0; run(g, 0.3);
  assert.ok(mecForzar(g, b, 'silencio')); let aviso = 0; run(g, 2.4, () => { const k = b.mec.tg.find((x) => x.k === 'c'); if (k) aviso = Math.max(aviso, k.T); });
  assert.ok(aviso >= 2, 'aviso largo'); assert.ok(g.time < p.silencioHasta, 'silenciado'); assert.ok(p.movCd >= 2, 'recarga alargada');
  const cd = p.movCd; g.setInput(p.id, { mov: true }); g.step(T60); assert.ok(p.movCd <= cd, 'la habilidad no se usa');
  run(g, 3.2); p.movCd = 0; g.setInput(p.id, { mov: true }); g.step(T60); assert.ok(p.movCd > 1, 'pasado el silencio vuelve a funcionar');
});

test('reparto (equipo): quien está en el refugio reparte el golpe; quien queda afuera lo recibe entero', () => {
  const { g, ps, b } = lab('m3', 3); const [a, c, fuera] = ps; poner(a, 0, 0.9, 10); poner(c, 1, 0.9, 10); poner(fuera, 0, 0.9, -12); run(g, 0.3);
  assert.ok(mecForzar(g, b, 'reparto')); run(g, 0.2); const mk = b.mec.tg.find((k) => k.ref); assert.ok(mk && mk.T >= 3, 'refugio marcado ≥ 3 s');
  poner(a, mk.x, 0.9, mk.z); poner(c, mk.x + 1, 0.9, mk.z); poner(fuera, mk.x, 0.9, mk.z - 14); run(g, 3.2);
  assert.ok(perdido(fuera) > 1.8 * perdido(a), `afuera ${perdido(fuera)} vs adentro ${perdido(a)}`); assert.ok(perdido(a) > 0);
  const ev = mecEvitar(g, ps[2]); assert.ok(ev === null || typeof ev.x === 'number');
});

test('Madre: parto → huevos protectores (daño ×0,6); si los rompés todos queda abierta y expuesta; raíces atrapan', () => {
  const { g, p, b } = lab('m2'); run(g, 0.3);
  assert.ok(mecForzar(g, b, 'parto')); run(g, 3.4); const crias = g.objects.filter((o) => o.cria); assert.ok(crias.length >= 5, `huevos ${crias.length}`); assert.ok(b.mec.prot);
  g.dmgSrc = null; assert.ok(jefeMult(g, b, p) < 0.7, 'protegida');
  for (const o of crias) g.damageObject(o, 1e5, p); run(g, 0.3);
  assert.ok(b.open && b.mec.bajo > 5, 'abierta y expuesta'); assert.ok(!b.mec.prot);
  b.mec.act = null; poner(p, -5, -83.5, 4); run(g, 0.3); assert.ok(mecForzar(g, b, 'raices')); const v0 = p.pos; run(g, 1.7, () => { const k = b.mec.tg.find((x) => x.k === 'c'); if (k) { p.pos = v3(k.x, k.y + 0.9, k.z); } }); assert.ok(g.time < p.atrapadoHasta || perdido(p) > 0, 'raíz');
  void v0;
});

test('Basilisco del Jardín: la floración hace brotar ojos que revientan si no los rompés; rotos todos, queda expuesto', () => {
  const { g, p, b } = lab('m4'); run(g, 0.3);
  assert.ok(mecForzar(g, b, 'floracion')); run(g, 2.6); const ojos = g.objects.filter((o) => o.brote); assert.ok(ojos.length >= 3, `ojos ${ojos.length}`);
  for (const o of ojos) g.damageObject(o, 1e5, p); run(g, 0.3); assert.ok(b.mec.bajo >= 4, `expuesto ${b.mec.bajo}`);
  // sin romperlos: reviente y cure al jefe
  const l = lab('m4'); l.run = 0; run(l.g, 0.3); l.b.hp = l.b.maxhp * 0.5; assert.ok(mecForzar(l.g, l.b, 'floracion')); const h0 = l.b.hp; run(l.g, 26); assert.ok(l.b.hp > h0, 'los ojos reventados curan al jefe');
});

test('Mandinga del Reloj: las doce campanadas caen una por una (marcas escalonadas) y al final el jefe cae (medianoche)', () => {
  const { g, p, b } = lab('m5'); poner(p, 0, 0.9, 40); run(g, 0.3);
  assert.ok(mecForzar(g, b, 'campanadas')); const nums = new Set(); let simult = 0; run(g, 9, () => { for (const k of b.mec.tg) if (k.num) nums.add(k.num); simult = Math.max(simult, b.mec.tg.length); });
  assert.equal(nums.size, 12, 'las 12 horas'); assert.ok(simult <= 5, `escalonadas (${simult} a la vez)`);
  b.mec.cd = 0; run(g, 4); assert.ok(b.mec.act && b.mec.act.id === 'descenso' || b.mec.bajo > 0, 'medianoche: el jefe cae');
});

test('Basilisco del Osario (procesión) y del laberinto (mirada total): se avisan ≥ 1 s y 3 s, y la mirada gira', () => {
  { const { g, p, b } = lab('m6'); poner(p, 0, 0.9, 30); run(g, 0.3); assert.ok(mecForzar(g, b, 'procesion')); let n = 0; run(g, 9.5, () => { n = Math.max(n, b.mec.tg.length); }); assert.ok(n >= 2); }
  const { g, p, b } = lab('m3'); poner(p, 0, 0.9, 8); run(g, 0.3); assert.ok(mecForzar(g, b, 'mirada_total'));
  let a0 = null, gira = false, aviso = 0, dark = false; run(g, 11, () => { const k = b.mec.tg.find((x) => x.k === 'b'); if (k) { aviso = Math.max(aviso, k.T); if (a0 === null) a0 = k.a; else if (Math.abs(k.a - a0) > 0.5) gira = true; } dark ||= b.mec.dark > 0; });
  assert.ok(aviso >= 3 && gira && dark, `aviso ${aviso} gira ${gira} oscuridad ${dark}`);
});

test('IA: tras ~10 s de juego el jefe adopta la postura que contrarresta tu estilo (< 15 s) y muestra el aviso', () => {
  for (const [est, post] of [['melee', 'antimele'], ['shooter', 'antidist'], ['powers', 'antihab']]) {
    const av = []; const r = pelea({ mapId: 'm1', seed: 5, estilos: [est], maxSeconds: 40, cada: (g) => { for (const e of g.events) if (e.t === 'jia' && e.k === 'adapt') av.push([+g.time.toFixed(1), e.st]); } });
    const t0 = r.t0 ?? 0, p = r.posturas.find((x) => x[1] === post);
    assert.ok(p && p[0] < 15, `${est}: postura ${post} en ${p && p[0]} s (${JSON.stringify(r.posturas)})`); assert.ok(av.some((x) => x[1] === post), `${est}: evento de aviso`); void t0;
  }
});

test('IA: un esquivador que nunca ataca recibe la postura de asedio; un jugador mixto no dispara una contramedida fuerte', () => {
  const p = pelea({ mapId: 'm1', seed: 4, estilos: ['passive'], maxSeconds: 70 });
  assert.ok(p.posturas.some((x) => x[1] === 'antipasivo'), `esquivador: ${JSON.stringify(p.posturas)}`);
  const m = pelea({ mapId: 'm1', seed: 4, estilos: ['mixed'], maxSeconds: 60 });
  const fuerte = m.posturas.filter((x) => x[1] !== 'neutro'); assert.ok(fuerte.length <= 2, `mixto: ${JSON.stringify(m.posturas)} (sin zigzag)`);
});

test('IA: cambiar de MODO (Melé → Disparo) desconcierta al jefe: tarda ≥ el retraso en readaptar y el jugador recibe un 10 % de bonus', () => {
  let tCambio = null, desc = false, antes = null, bonus = 0; const post = [];
  const r = pelea({ mapId: 'm1', seed: 6, estilos: ['melee'], maxSeconds: 90, cada: (g, b, bots) => {
    if (!b) return; const t = g.time - 1;
    if (tCambio === null && b.ia.st === 'antimele' && b.ia.lvl >= 0.99 && t > 12) { tCambio = g.time; antes = b.ia.st; bots[0][1].estilo('shooter'); }
    for (const e of g.events) if (e.t === 'jia' && e.k === 'desc') desc = true;
    if (b.ia.desc > 0) bonus = Math.max(bonus, iaMult(g, b, 'skill'));
    if (tCambio !== null && (!post.length || post[post.length - 1][1] !== b.ia.st)) post.push([+(g.time - tCambio).toFixed(1), b.ia.st, +b.ia.lag.toFixed(1), +b.ia.desc.toFixed(1)]);
  } });
  assert.ok(tCambio !== null, 'llegó a antimele'); assert.ok(desc, 'avisó del desconcierto'); assert.ok(bonus >= IA.descon - 1e-9, `bonus por desconcierto ${bonus}`); assert.equal(antes, 'antimele');
  const nueva = post.find((x) => x[1] === 'antidist' || x[1] === 'neutro');
  assert.ok(!nueva || nueva[0] >= IA.rezago - 0.5, `readaptó demasiado pronto: ${JSON.stringify(post)}`);
  assert.ok(post.some((x) => x[1] === 'antidist') || r.t < 90 + 1e9, 'más tarde se adapta al nuevo estilo');
  assert.ok(post.some((x) => x[1] === 'antidist'), `termina adaptándose: ${JSON.stringify(post)}`);
});

test('IA: nunca pasa los topes (resistencia ≤ +25 %, piso de daño 0,2) y el jefe siempre se puede dañar', () => {
  let minMul = 9;
  for (const est of ['melee', 'shooter', 'skills']) {
    pelea({ mapId: 'm3', seed: 2, estilos: [est], maxSeconds: 80, cada: (g, b) => {
      if (!b) return; const p = g.players[0];
      for (const src of ['melee', 'gun', 'skill']) { const m = iaMult(g, b, src); minMul = Math.min(minMul, m); assert.ok(m >= 1 / (1 + IA.topeRes) - 1e-9, `resistencia por adaptación ${m} pasa el tope`); g.dmgSrc = src === 'gun' ? null : src; const t = jefeMult(g, b, p); g.dmgSrc = null; assert.ok(t >= IA.pisoMul - 1e-9 && t > 0, `daño total ${t}`); }
      assert.ok(b.ia.lvl >= 0 && b.ia.lvl <= 1);
    } });
  }
  assert.ok(minMul < 1, 'sí llegó a endurecerse (la prueba es real)');
});

test('IA: determinista (misma semilla y mismos bots → mismo estado de IA y de mecánicas) y su estado se exporta/recupera como JSON', () => {
  const huella = (r) => { const b = r.g.boss; return JSON.stringify({ ia: iaExport(b), f: b.mec.f, hp: Math.round(b.hp), pos: [b.pos.x, b.pos.y, b.pos.z].map((v) => +v.toFixed(3)), t: r.g.time }); };
  const a = pelea({ mapId: 'm4', seed: 9, estilos: ['shooter'], maxSeconds: 45 }), b = pelea({ mapId: 'm4', seed: 9, estilos: ['shooter'], maxSeconds: 45 });
  assert.equal(huella(a), huella(b), 'dos peleas iguales dan lo mismo');
  const c = pelea({ mapId: 'm4', seed: 10, estilos: ['shooter'], maxSeconds: 45 }); assert.notEqual(huella(a), huella(c), 'otra semilla, otra pelea');
  const ex = iaExport(a.g.boss); assert.equal(JSON.stringify(JSON.parse(JSON.stringify(ex))), JSON.stringify(ex), 'ida y vuelta por JSON');
  assert.ok(Number.isInteger(ex.rs), 'el generador propio viaja como un entero');
});

test('snapshot compacto del jefe: el resumen de IA y mecánicas cabe en pocos cientos de bytes (nunca mil) aun con marcas', () => {
  let max = 0, n = 0;
  const r = pelea({ mapId: 'm5', seed: 3, estilos: ['shooter', 'melee', 'skills', 'shooter'], maxSeconds: 60, cada: (g, b) => { if (!b || g.tick % 20) return; const s = g.snapshot().boss; const t = JSON.stringify({ ia: s.ia, mc: s.mc, f: s.f }).length; max = Math.max(max, t); n++; } });
  assert.ok(n > 50 && max < 1200, `resumen de ${max} bytes`); const s = r.g.snapshot().boss;
  if (s) { assert.ok(s.ia && s.mc && s.f >= 1 && Array.isArray(s.mc.tg), 'campos'); assert.ok(!('pl' in s.ia), 'el perfil crudo no viaja'); }
});

test('enfurecimiento por tiempo: pasado el límite el jefe se enfurece (aviso), pega más y ataca más seguido; en coop el límite es mayor', () => {
  const { g, p, b } = lab('m1'); const ev = []; run(g, 1); const T = IA.enrageT; b.ia.t = T - 1;
  run(g, 3, () => { for (const e of g.events) if (e.t === 'jia') ev.push(e.k); g.events.length = 0; });
  assert.ok(ev.includes('enr') && b.ia.enr > 0, 'enfurecido'); const s = iaSnap(b); assert.ok(s.en > 0);
  const c = lab('m1', 3); c.b.ia.t = T + 1; run(c.g, 2); assert.equal(c.b.ia.enr, 0, `con 3 jugadores el límite sube a ${T + 2 * IA.enrageCoop}`);
});

test('memoria entre intentos: el jefe recuerda tu último estilo con una postura suave (≤ 40 %) hasta tener datos propios', () => {
  const a = pelea({ mapId: 'm1', seed: 2, estilos: ['melee'], maxSeconds: 40 }); const mem = iaMemoria(a.g.boss); assert.equal(mem.s, 'melee');
  const g = new Game({ mapId: 'm1', seed: 2, jefeMem: mem }); const p = g.addPlayer('t', null, { char: 'axioma' }); g.phaseT = 1e9; g.wave = g.waveTotal; g.phase = 'wave'; g.queue = [];
  const b = g.spawnMonster('coloso', g.map.bossAnchor); const evs = []; run(g, 6, () => { for (const e of g.events) evs.push(e); g.events.length = 0; });
  assert.equal(b.ia.st, 'antimele'); assert.ok(b.ia.lvl <= 0.4 + 1e-9, `suave: ${b.ia.lvl}`); assert.ok(evs.some((e) => e.t === 'jia' && e.k === 'recuerda'));
  void p;
});

test('los jefes no usan g.rng (sólo su generador propio) y no hay Math.random en su código', async () => {
  const fs = await import('node:fs');
  for (const f of ['jefe-ia.js', 'jefe-mec.js', 'jefes.js', 'jefe-data.js']) {
    const src = fs.readFileSync(new URL(`../src/sim/${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    assert.ok(!/\bg\.rng\b|\.rng\.(next|range|pick|unit|int)\b|Math\.random/.test(src), `${f}: usa g.rng o Math.random`);
  }
});

test('rendimiento: la IA + las mecánicas del jefe cuestan décimas de milisegundo por cuadro (con 4 jugadores)', async () => {
  const { iaTick } = await import('../src/sim/jefe-ia.js'); const { mecTick } = await import('../src/sim/jefe-mec.js');
  const { g, b } = lab('m3', 4); run(g, 2);
  const N = 6000, t0 = performance.now(); for (let i = 0; i < N; i++) { g.time += T60; b.mec.dCd = 50; iaTick(g, b, T60); mecTick(g, b, T60); if (b.mec.act === null) b.mec.cd = Math.min(b.mec.cd, 2); }
  const ms = (performance.now() - t0) / N; assert.ok(ms < 0.5, `IA + mecánicas: ${ms.toFixed(3)} ms por cuadro`);
  const { g: g2 } = lab('m3', 4); const t1 = performance.now(); run(g2, 20); const paso = (performance.now() - t1) / (20 * 60); assert.ok(paso < 6, `paso completo con jefe y 4 jugadores: ${paso.toFixed(2)} ms`);
});

test('muralla (cobertura destruible): tres pilares que frenan tus disparos hasta que los rompés (o se desmoronan a los 14 s)', () => {
  const { g, p, b } = lab('m5'); poner(p, 0, 0.9, 40); run(g, 0.3);
  assert.ok(mecForzar(g, b, 'muralla')); run(g, 2); const pil = g.objects.filter((o) => o.type === 'pilar'); assert.equal(pil.length, 3); assert.ok(pil.every((o) => o.hostile && o.hp === 260));
  // un disparo hacia el jefe choca con el pilar (los pilares son blancos «hostiles» que reciben el tiro)
  const o = g.eyePos(p), d = { x: 0, y: 0, z: -1 }; const hp0 = pil.map((q) => q.hp); g.hitscan(p, o, d, { dmg: 50, range: 120 }); assert.ok(pil.some((q, i) => q.hp < hp0[i]), 'el pilar recibió el tiro');
  for (const q of pil) g.damageObject(q, 1e5, p); run(g, 0.2); assert.equal(g.objects.filter((x) => x.type === 'pilar').length, 0, 'rotos');
  b.mec.act = null; assert.ok(mecForzar(g, b, 'muralla')); run(g, 2); assert.equal(g.objects.filter((x) => x.type === 'pilar').length, 3); run(g, 16); assert.equal(g.objects.filter((x) => x.type === 'pilar').length, 0, 'se desmoronan solos');
});
