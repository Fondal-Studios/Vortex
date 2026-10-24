// RITMO DE EVOLUCIÓN, PODER POR NIVEL y TARJETAS POR ESTILO (docs/EVOLUCION.md → «Ritmo», «Poder por nivel», «Tarjetas»).
// Metas medibles (con bots; los números salen de bots, no de personas):
//   · primera partida (rango 1): como mucho nivel 2 al terminar la campaña del mapa 1, con los tres estilos;
//   · el nivel 3 pide rango 3 y el 4 pide rango 6 (ni sobrando núcleos se saltan);
//   · un bot que evoluciona todo lo que puede llega al nivel 4 recién tras varias partidas;
//   · cada nivel pega, resiste y corre más (multiplicadores de EVO_POWER) para los 8 Huéspedes;
//   · las tarjetas: ≥ 1 acorde al estilo por mano y ≥ 40 % de las ofertas, 3–4 por mano, sin crashes, deterministas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { arena, run, ahead } from './helpers.js';
import { Game } from '../src/sim/game.js';
import { HOST_IDS, EVO_COST, EVO_RANK_REQ, EVO_POWER, EVO_PATHS, evoSemilla, CORES } from '../src/sim/data.js';
import { evolve, evoBloqueo, hostOut, evoMeleeMul, hostDamageIn, cdMul } from '../src/sim/huespedes.js';
import { makeCards, applyCard, relanzar, cardText } from '../src/sim/loadout.js';
import { TARJETAS, CLASES, claseDe, esRelevante, estiloDe, aplicarTarjeta, REROLL_COSTO, MANO, cu } from '../src/sim/tarjetas.js';
import { campana, partidasEncadenadas } from '../tools/evo-ritmo.js';

const mk = (id, opts = {}) => { const { g, p } = arena(); g.setLoadout(p.id, id); Object.assign(p, opts); return { g, p }; };
const dummy = (g, p) => { const m = g.spawnMonster('astilla', ahead(p, 4)); m.cd = 1e9; m.hp = m.maxhp = 1e6; m.passive = true; return m; };

/* ───────── tablas ───────── */
test('costos y requisitos: costos crecientes, rango mínimo creciente, nada gratis', () => {
  assert.deepEqual(EVO_COST, [0, 90, 240, 520, 1100]);
  for (let i = 2; i <= 4; i++) assert.ok(EVO_COST[i] > EVO_COST[i - 1] * 1.9, `cada nivel cuesta más del doble que el anterior (${i})`);
  assert.deepEqual(EVO_RANK_REQ, [0, 1, 1, 3, 6]);
  for (const k of ['dmg', 'skill', 'take', 'spd', 'cd', 'ult', 'area']) { assert.equal(EVO_POWER[k].length, 5); assert.equal(EVO_POWER[k][0], 1, `nivel 0 no cambia ${k}`); }
  for (let i = 1; i <= 4; i++) { assert.ok(EVO_POWER.dmg[i] > EVO_POWER.dmg[i - 1] && EVO_POWER.skill[i] > EVO_POWER.skill[i - 1] && EVO_POWER.take[i] < EVO_POWER.take[i - 1] && EVO_POWER.cd[i] < EVO_POWER.cd[i - 1] && EVO_POWER.area[i] > EVO_POWER.area[i - 1], `nivel ${i} es mejor que el anterior`); }
  assert.equal(evoSemilla(1), 0, 'sin rango no hay semilla'); assert.ok(evoSemilla(10) <= 60 && evoSemilla(10) > evoSemilla(3), 'la semilla crece con el rango y tiene tope');
  assert.ok(evoSemilla(10) < EVO_COST[1], 'la semilla nunca paga ni el primer nivel');
});

test('rango de maestría: bloquea la evolución aunque sobren núcleos, y la pantalla sabe por qué (evb / evr)', () => {
  const { g, p } = mk('axioma'); p.cores = 99999; p.mastery = 1;
  assert.equal(evoBloqueo(p), ''); assert.equal(evolve(g, p), true); assert.equal(evolve(g, p), true);   // niveles 1 y 2 piden rango 1
  assert.equal(p.evo, 2); assert.equal(evoBloqueo(p), 'rango');
  let s = g.snapshot().players[0]; assert.equal(s.evb, 'rango'); assert.equal(s.evr, 3); assert.equal(s.mr, 1);
  assert.equal(evolve(g, p), false); assert.equal(p.evo, 2, 'con rango 1 el nivel 3 no se compra');
  g.setInput(p.id, { evo: 1 }); g.step(1 / 60); g.setInput(p.id, { evo: 0 }); g.step(1 / 60); assert.equal(p.evo, 2, 'ni por la entrada del jugador');
  p.mastery = 2; assert.equal(evoBloqueo(p), 'rango', 'rango 2 no alcanza para el 3'); p.mastery = 3; assert.equal(evoBloqueo(p), ''); assert.equal(evolve(g, p), true);
  assert.equal(evoBloqueo(p), 'rango', 'el 4 pide rango 6'); p.mastery = 5; assert.equal(evolve(g, p), false); p.mastery = 6; assert.equal(evolve(g, p), true); assert.equal(p.evo, 4); assert.equal(evoBloqueo(p), 'max');
  const q = mk('axioma').p; q.cores = 0; q.mastery = 1; assert.equal(evoBloqueo(q), 'nucleos');
  s = g.snapshot().players[0]; assert.equal(s.evo, 4);
});

test('el rango se fija al EMPEZAR la partida: addPlayer(maestria) lo aplica y regala la semilla', () => {
  const g = new Game({ mapId: 'm1', seed: 1 });
  const a = g.addPlayer('a', null, { char: 'axioma', maestria: 1 }), b = g.addPlayer('b', null, { char: 'axioma', maestria: 8 });
  assert.equal(a.mastery, 1); assert.equal(a.cores, 0); assert.equal(b.mastery, 8); assert.equal(b.cores, evoSemilla(8));
  const c = g.addPlayer('c', null, { char: 'axioma', maestria: 8, cores: 500 }); assert.equal(c.cores, 500, 'una cifra mayor (núcleos que traés) no se pisa');
});

/* ───────── poder por nivel ───────── */
test('poder por nivel: más daño (melee, disparo y habilidades), menos daño recibido y más velocidad en CADA nivel, con los 8 Huéspedes', () => {
  for (const id of HOST_IDS) {
    const { g, p } = mk(id); const m = dummy(g, p); let prev = null;
    for (let e = 0; e <= 4; e++) {
      p.evo = e; p.path = Array(e).fill('x');   // sin caminos: sólo el poder del NIVEL
      const out = {}; for (const src of ['melee', 'gun', 'skill']) { g.dmgSrc = src; p.inMelee = src === 'melee'; out[src] = hostOut(g, p, m); }
      g.dmgSrc = null; p.inMelee = false;
      const take = hostDamageIn(g, p, 100);
      if (prev) { for (const src of ['melee', 'gun', 'skill']) assert.ok(out[src] > prev.out[src] * 1.02, `${id} nivel ${e}: ${src} ${prev.out[src].toFixed(3)} → ${out[src].toFixed(3)}`); assert.ok(take < prev.take - 0.5, `${id} nivel ${e}: recibís menos (${prev.take.toFixed(1)} → ${take.toFixed(1)})`); }
      prev = { out, take };
    }
    p.evo = 4; g.dmgSrc = 'skill'; const sk4 = hostOut(g, p, m); g.dmgSrc = 'melee'; p.inMelee = true; const me4 = hostOut(g, p, m); g.dmgSrc = null; p.inMelee = false;
    assert.ok(sk4 >= EVO_POWER.dmg[4] * EVO_POWER.skill[4] * 0.99, `${id}: la habilidad nivel 4 pega al menos ${EVO_POWER.dmg[4] * EVO_POWER.skill[4]}×`);
    assert.ok(me4 > 1.2, `${id}: el melee nivel 4 pega bastante más`);
  }
});

test('poder por nivel: velocidad, recarga de habilidades y carga de la definitiva mejoran con el nivel', () => {
  const vel = (e) => { const { g, p } = mk('axioma'); p.evo = e; p.path = Array(e).fill('x'); g.step(1 / 60); return p.spdMul; };
  assert.ok(vel(4) > vel(0) * 1.07 && vel(2) > vel(1) && vel(1) > vel(0), `velocidad ${vel(0)} → ${vel(4)}`);
  const cd = (e) => { const { g, p } = mk('axioma'); p.evo = e; p.path = Array(e).fill('x'); g.setInput(p.id, { s3: true }); g.step(1 / 60); g.setInput(p.id, { s3: false }); g.step(1 / 60); return p.s3Cd; };
  assert.ok(cd(4) < cd(0) * 0.8, `HAB.3 recarga ${cd(0).toFixed(1)} → ${cd(4).toFixed(1)}`);
  const carga = (e) => { const { g, p } = mk('axioma'); p.evo = e; p.path = Array(e).fill('x'); const m = dummy(g, p); g.damageMonster(m, 800, p); return p.ul; };
  assert.ok(carga(4) > carga(0) * 1.3, `la definitiva carga más rápido (${carga(0).toFixed(1)} → ${carga(4).toFixed(1)})`);
});

test('poder por nivel: lo que suman los CAMINOS acumulado en melé llega a ≈ +20 / +45 / +80 / +130 % (Depredador → Velocidad → Simbiosis → Apoteosis)', () => {
  const { g, p } = mk('axioma'); const m = dummy(g, p); const camino = ['depredador', 'velocidad', 'simbiosis', 'apoteosis'];
  const total = (e) => { p.evo = e; p.path = camino.slice(0, e); g.dmgSrc = 'melee'; p.inMelee = true; const k = hostOut(g, p, m) * evoMeleeMul(p); g.dmgSrc = null; p.inMelee = false; return k; };
  const base = total(0); const rel = [1, 2, 3, 4].map((e) => total(e) / base);
  console.log('# melé acumulado por nivel (Depredador→Velocidad→Simbiosis→Apoteosis):', rel.map((x) => `+${Math.round((x - 1) * 100)} %`).join(' / '));
  assert.ok(rel[0] > 1.15 && rel[0] < 1.4 && rel[1] > 1.35 && rel[1] < 1.6 && rel[2] > 1.7 && rel[2] < 2 && rel[3] > 2.05 && rel[3] < 2.5, `acumulado ${rel.map((x) => x.toFixed(2))}`);
});

test('efectos de nivel de las habilidades: nivel 2 ralentiza, 3 estalla, 4 devuelve recarga; la definitiva se transforma en 3 y 4', () => {
  const caso = (e) => {
    const { g, p } = mk('axioma'); p.evo = e; p.path = Array(e).fill('x'); const m = g.spawnMonster('astilla', ahead(p, 3)); m.cd = 1e9; m.passive = true; m.hp = m.maxhp = 1e6;
    p.hp = 40; p.shield = 0; p.espCd = 20; p.movCd = 20; p.s3Cd = 0;
    g.setInput(p.id, { s3: true }); g.step(1 / 60); g.setInput(p.id, { s3: false }); g.step(1 / 60);
    return { lento: (m.slowUntil || 0) > g.time, dano: 1e6 - m.hp, espCd: p.espCd };
  };
  assert.equal(caso(1).lento, false); assert.equal(caso(2).lento, true, 'nivel 2: ralentiza lo cercano');
  assert.equal(caso(2).dano, 0); assert.ok(caso(3).dano > 0, 'nivel 3: la habilidad estalla'); assert.ok(caso(4).dano > caso(3).dano, 'y más en el 4');
  assert.ok(caso(4).espCd < 20 * 0.9 && caso(3).espCd > 19, 'nivel 4 devuelve recarga a las otras habilidades');
  const ult = (e) => { const { g, p } = mk('axioma'); p.evo = e; p.path = Array(e).fill('x'); p.hp = 30; p.shield = 0; const m = g.spawnMonster('astilla', ahead(p, 5)); m.cd = 1e9; m.passive = true; m.hp = m.maxhp = 1e6; p.ul = 100; g.setInput(p.id, { ult: true }); g.step(1 / 60); g.setInput(p.id, { ult: false }); g.step(1 / 60); return { hp: p.hp, shield: p.shield, dano: 1e6 - m.hp, dur: p.ultT }; };
  assert.ok(ult(2).hp < 31 && ult(3).hp > 55 && ult(3).shield > 90, 'nivel 3: la definitiva te cura y escuda'); assert.equal(ult(3).dano, 0); assert.ok(ult(4).dano > 100, 'nivel 4: estalla al activarse');
  assert.ok(ult(4).dur > ult(2).dur * 1.2, 'y dura más');
});

/* ───────── ritmo ───────── */
test('RITMO: en la PRIMERA partida (rango 1) nadie pasa del nivel 2 en la campaña del mapa 1, con los 3 estilos y varias semillas', { timeout: 600000 }, () => {
  const filas = [];
  for (const estilo of ['melee', 'disparo', 'habilidad']) for (const seed of [3, 4]) {
    const r = campana({ mapId: 'm1', seed, char: estilo === 'habilidad' ? 'singular' : 'axioma', estilo, mastery: 1 });
    filas.push(`${estilo}/${seed}: ${r.state} nivel ${r.evo} (${r.tiers.map((t) => `n${t.tier}@o${t.wave}`).join(' ')}) núcleos ${r.cores}`);
    assert.ok(r.evo <= 2, `${estilo} seed ${seed}: llegó al nivel ${r.evo} en la primera partida`);
    assert.ok(r.cores < EVO_COST[1] + EVO_COST[2] + EVO_COST[3] + EVO_COST[4], `${estilo} ${seed}: los núcleos de una campaña (${r.cores}) no alcanzan para la forma final`);
  }
  console.log('# primera partida:\n#   ' + filas.join('\n#   '));
  // un jugador MUY flojo no pasa del nivel 1
  const flojo = campana({ mapId: 'm1', seed: 3, char: 'axioma', estilo: 'disparo', skill: 0.4, mastery: 1, maxSeconds: 1500 });
  assert.ok(flojo.evo <= 2, `jugador flojo: nivel ${flojo.evo}`);
});

test('RITMO: aun con rango altísimo, el nivel 4 NO sale en la primera campaña (el costo solo ya lo impide)', { timeout: 300000 }, () => {
  const r = campana({ mapId: 'm1', seed: 3, char: 'axioma', estilo: 'disparo', mastery: 10 });
  assert.ok(r.evo <= 3, `nivel ${r.evo}`); assert.ok(r.cores < EVO_COST[1] + EVO_COST[2] + EVO_COST[3] + EVO_COST[4], `núcleos de una campaña ${r.cores} < ${EVO_COST[1] + EVO_COST[2] + EVO_COST[3] + EVO_COST[4]}`);
});

test('RITMO: un bot que evoluciona todo lo que puede llega al 3 en la 2.ª partida y al 4 recién en la 4.ª (se conserva el progreso entre partidas)', { timeout: 900000 }, () => {
  const f = partidasEncadenadas({ n: 4, estilo: 'melee', char: 'axioma', seed: 3 });
  console.log('# partidas encadenadas (melé, axioma):'); for (const x of f) console.log('#   ' + JSON.stringify(x));
  assert.ok(f[0].nivelAlSalir <= 2, 'tras la 1.ª partida, como mucho nivel 2');
  assert.ok(f[1].nivelAlEntrar <= 3 && f[1].nivelAlSalir >= 3, 'en la 2.ª se llega al nivel 3');
  assert.ok(f.slice(0, 3).every((x) => x.nivelAlSalir <= 3), 'el nivel 4 no sale antes de la 4.ª partida (pide rango 6)');
  assert.equal(f[3].nivelAlEntrar, 4, 'en la 4.ª partida se entra con la forma final (rango ≥ 6)');
  assert.ok(f.every((x, i) => i === 0 || x.nivelAlEntrar >= f[i - 1].nivelAlSalir), 'el nivel se conserva entre partidas');
});

test('RITMO: es determinista (misma semilla, mismos niveles y núcleos)', { timeout: 300000 }, () => {
  const a = campana({ mapId: 'm1', seed: 5, char: 'vesper', estilo: 'habilidad', mastery: 3 }), b = campana({ mapId: 'm1', seed: 5, char: 'vesper', estilo: 'habilidad', mastery: 3 });
  assert.deepEqual(a.tiers, b.tiers); assert.equal(a.cores, b.cores); assert.equal(a.time, b.time);
});

test('núcleos por rendimiento: élites, jefes, multi-kills y oleadas sin recibir daño pagan más', () => {
  assert.ok(CORES.eliteMul >= 3 && CORES.boss >= 150 && CORES.flawless > 0 && CORES.multi > 0);
  const { g, p } = mk('axioma'); const base = (kind, elite) => { const q = mk('axioma'); const m = q.g.spawnMonster(kind, ahead(q.p, 4), { noElite: !elite }); if (elite) m.elite = true; q.p.cores = 0; q.g.killMonster(m, q.p); return q.p.cores; };
  assert.ok(base('astilla', true) >= base('astilla', false) * 2.5, 'una élite vale ≥ 2,5× una común');
  void g; void p;
});

test('núcleos por rendimiento: la oleada sin recibir daño da el bono (flawless)', { timeout: 120000 }, () => {
  const jugar = (golpeado) => {
    const g = new Game({ mapId: 'm1', seed: 2 }); const p = g.addPlayer('t', null, { char: 'axioma' }); p.hp = 1e6;
    g.phaseT = 0; for (let i = 0; i < 6; i++) g.step(1 / 60);   // arranca la oleada 1
    g.queue = []; g.omens = []; for (const m of g.monsters) m.dead = true; g.objective = null; g.mision = null;
    if (golpeado) g.hurtPlayer(p, 5);
    const c0 = p.cores; for (let i = 0; i < 20 && g.phase === 'wave'; i++) g.step(1 / 60);
    return { c: p.cores - c0, fase: g.phase };
  };
  const a = jugar(false), b = jugar(true);
  assert.equal(a.fase, 'intermission'); assert.equal(b.fase, 'intermission');
  assert.ok(a.c - b.c >= CORES.flawless * 0.99, `bono sin daño: ${a.c} vs ${b.c}`);
});

/* ───────── tarjetas ───────── */
const manos = (p, g, n = 200) => { const out = []; for (let i = 0; i < n; i++) { out.push(makeCards(g, p, { flawless: i % 5 === 0 })); } return out; };
const preparar = (estilo, extra = {}) => { const { g, p } = mk('axioma'); p.style = estilo === 'combo' ? '' : estilo; if (estilo === 'combo') p.mode = 'combo'; Object.assign(p, extra); return { g, p }; };

test('tarjetas: cada mano tiene 3–4 cartas, al menos una acorde al estilo y ≥ 40 % de las ofertas son del estilo (Disparo, Melé, Habilidades y Combo)', () => {
  for (const estilo of ['disparo', 'melee', 'habilidad', 'combo']) {
    const { g, p } = preparar(estilo); const est = estiloDe(p); let rel = 0, tot = 0;
    for (const mano of manos(p, g)) {
      assert.ok(mano.length >= MANO.base && mano.length <= MANO.max, `${estilo}: ${mano.length} tarjetas`);
      const r = mano.filter((c) => esRelevante(c, est)).length; assert.ok(r >= 1, `${estilo}: mano sin ninguna del estilo ${JSON.stringify(mano)}`); rel += r; tot += mano.length;
      for (const c of mano) assert.ok(c.w >= 0 && c.k, 'toda tarjeta trae arma (para dibujarla) y tipo');
    }
    console.log(`# tarjetas ${estilo}: ${Math.round(100 * rel / tot)} % acordes al estilo`);
    assert.ok(rel / tot >= 0.4, `${estilo}: sólo ${Math.round(100 * rel / tot)} % acordes`);
  }
});

test('tarjetas: la mano mezcla clases (no se encajona) y conecta con el árbol de combos y el arma fusionada', () => {
  const { g, p } = preparar('combo'); const vistas = new Set(), ids = new Set();
  for (const mano of manos(p, g, 300)) for (const c of mano) { vistas.add(claseDe(c)); if (c.id) ids.add(c.id); }
  for (const cl of ['disparo', 'melee', 'habilidad', 'huesped']) assert.ok(vistas.has(cl), `se ofrece alguna de ${cl}`);
  for (const id of ['filo', 'ventana', 'area', 'remate', 'reflejos', 'arma']) assert.ok(ids.has(id), `Melé ofrece ${id}`);
  const { g: g2, p: p2 } = preparar('disparo'); const ids2 = new Set(); for (const mano of manos(p2, g2, 300)) for (const c of mano) if (c.id) ids2.add(c.id);
  assert.ok(!ids2.has('ventana') && !ids2.has('arma'), 'Cadena fluida y Dominio del arma sólo se ofrecen en el modo Combo (si no, serían tarjetas muertas)');
});

test('tarjetas: usar mucho una fuente de daño (melee / gun / skill) inclina la tarjeta libre hacia ella, sin eliminar el resto', () => {
  const frec = (dmgBy) => { const { g, p } = preparar('disparo'); p.dmgBy = dmgBy; let n = { melee: 0, otras: 0 }; for (const mano of manos(p, g, 400)) for (const c of mano) { if (claseDe(c) === 'melee') n.melee++; else n.otras++; } return n.melee / (n.melee + n.otras); };
  const poco = frec({ melee: 0, gun: 1000, skill: 0 }), mucho = frec({ melee: 1000, gun: 0, skill: 0 });
  assert.ok(mucho > poco * 1.4, `con daño melé ${mucho.toFixed(2)} vs sin ${poco.toFixed(2)}`); assert.ok(poco > 0.02, 'diversidad: siempre aparece algo de melé');
});

test('tarjetas: determinista con la misma semilla y toda tarjeta se aplica sin romper; topes respetados', () => {
  const a = preparar('melee'), b = preparar('melee');   // mismo mapa y semilla → mismas manos
  const ja = JSON.stringify(manos(a.p, a.g, 20)), jb = JSON.stringify(manos(b.p, b.g, 20)); assert.equal(ja, jb);
  const { g, p } = preparar('combo');
  for (const [id, T] of Object.entries(TARJETAS)) {
    for (let i = 0; i < T.max * 3; i++) applyCard(p, { w: p.slots[0], k: T.k, id, r: i % 3 }, g);
    assert.ok(Math.abs(cu(p, id) - T.max) < 1e-9, `${id} se frena en el tope ${T.max}`);
    assert.ok(cardText({ w: p.slots[0], k: T.k, id }).length > 2);
  }
  for (const k of ['dmg', 'rate', 'mag']) applyCard(p, { w: p.slots[1], k }, g);
  assert.ok(CLASES.includes(claseDe({ k: 'organ', t: 'c' })));
  for (const id of Object.keys(TARJETAS)) assert.equal(typeof TARJETAS[id].d(1), 'string');
  const snap = g.snapshot().players[0]; assert.ok(snap.cuu && typeof snap.cuu === 'object'); assert.ok('rr' in snap);
});

test('tarjetas: cada una cambia el juego de verdad (daño melé, habilidades, resistencia, escudo, velocidad, definitiva)', () => {
  const nuevo = () => { const q = mk('axioma'); q.p.mode = 'combo'; return q; };
  const con = (id, n = 4) => { const { g, p } = nuevo(); for (let i = 0; i < n; i++) applyCard(p, { w: p.slots[0], k: TARJETAS[id].k, id, r: 0 }, g); return { g, p }; };
  const m0 = (() => { const { g, p } = nuevo(); return { g, p, m: dummy(g, p) }; })();
  const out = (x, src) => { x.g.dmgSrc = src; x.p.inMelee = src === 'melee'; const k = hostOut(x.g, x.p, x.m); x.g.dmgSrc = null; x.p.inMelee = false; return k; };
  const base = { melee: out(m0, 'melee'), skill: out(m0, 'skill') };
  const f = con('filo'); f.m = dummy(f.g, f.p); assert.ok(out(f, 'melee') > base.melee * 1.25, 'Filo afinado'); assert.ok(Math.abs(out(f, 'skill') - base.skill) < 1e-9, 'Filo no toca habilidades');
  const pt = con('potencia'); pt.m = dummy(pt.g, pt.p); assert.ok(out(pt, 'skill') > base.skill * 1.3, 'Potencia arcana'); assert.ok(Math.abs(out(pt, 'melee') - base.melee) < 1e-9);
  const dano = (x) => { x.p.hp = 100; x.p.shield = 0; return hostDamageIn(x.g, x.p, 100); };
  assert.ok(dano(con('coraza')) < dano(nuevo()) * 0.88, 'Piel dura');
  const vel = (x) => { x.g.step(1 / 60); return x.p.spdMul; }; assert.ok(vel(con('ligereza')) > vel(nuevo()) * 1.08, 'Paso ligero');
  assert.ok(cdMul(con('enfria').p) < cdMul(nuevo().p) * 0.8, 'Foco');
  const reg = (x) => { x.p.shield = 0; x.p.lastHurt = -99; x.g.step(1 / 60); const s0 = x.p.shield; run(x.g, 1); return x.p.shield - s0; }; assert.ok(reg(con('escudo')) > reg(nuevo()) * 1.5, 'Escudo vivo');
  const ul = (x) => { const m = dummy(x.g, x.p); x.g.damageMonster(m, 500, x.p); return x.p.ul; }; assert.ok(ul(con('ulti')) > ul(nuevo()) * 1.3, 'Definitiva voraz');
  const kh = (x) => { x.p.hp = 10; const m = x.g.spawnMonster('astilla', ahead(x.p, 4)); x.g.killMonster(m, x.p); return x.p.hp - 10; }; assert.ok(kh(con('vigor')) > kh(nuevo()) + 1.5, 'Vigor');
});

test('tarjetas de melé conectan con el árbol de combos: ventana, alcance, remate y cadena del arma modifican los efectos del modo Combo', async () => {
  const { comboUnlocked } = await import('../src/sim/combos.js');
  const { g, p } = mk('axioma'); p.mode = 'combo'; g.setMode?.(p.id, 'combo'); p.mode = 'combo';
  const n0 = comboUnlocked(p).length;
  for (let i = 0; i < 4; i++) applyCard(p, { w: p.slots[0], k: 'melee', id: 'arma', r: 0 }, g);
  assert.ok(comboUnlocked(p).length >= n0, 'más cadena no quita golpes');
  // el remate letal sube el daño del remate de una cadena (se mide en un duelo de dos hits)
  const dano = (id, n) => { const q = mk('axioma'); q.p.mode = 'combo'; q.p.evo = 0; for (let i = 0; i < n; i++) applyCard(q.p, { w: q.p.slots[0], k: 'melee', id, r: 0 }, q.g); const m = dummy(q.g, q.p); q.g.setInput(q.p.id, { a1: true }); run(q.g, 0.05); q.g.setInput(q.p.id, { a1: false }); run(q.g, 0.5); q.g.setInput(q.p.id, { a1: true }); run(q.g, 0.05); q.g.setInput(q.p.id, { a1: false }); run(q.g, 1.2); return 1e6 - m.hp; };
  assert.ok(dano('filo', 4) > dano('filo', 0) * 1.2, 'con Filo afinado la cadena pega más');
});

test('tarjetas: relanzar cuesta núcleos crecientes, cambia la mano y se corta al terminar el escalón', () => {
  const { g, p } = preparar('melee'); g.phase = 'intermission'; p.cores = 1000; p.cards = makeCards(g, p); const costos = [];
  for (let i = 0; i < REROLL_COSTO.length; i++) { const c0 = p.cores; assert.equal(relanzar(g, p), true, `relanzar #${i + 1}`); costos.push(c0 - p.cores); assert.ok(p.cards.length >= 3); }
  assert.deepEqual(costos, REROLL_COSTO); assert.equal(relanzar(g, p), false, 'no se puede relanzar más veces');
  const q = preparar('melee'); q.g.phase = 'intermission'; q.p.cores = REROLL_COSTO[0] - 1; q.p.cards = makeCards(q.g, q.p); assert.equal(relanzar(q.g, q.p), false, 'sin núcleos no se relanza');
  // por la entrada del jugador
  const r = preparar('disparo'); r.g.phase = 'intermission'; r.p.cores = 100; r.p.cards = makeCards(r.g, r.p); r.g.setInput(r.p.id, { reroll: true }); r.g.step(1 / 60); assert.equal(r.p.cores, 100 - REROLL_COSTO[0]); r.g.setInput(r.p.id, { reroll: false });
  r.g.step(1 / 60); assert.equal(r.p.cores, 100 - REROLL_COSTO[0], 'un solo toque cobra una sola vez');
});

test('tarjetas: composición medida con bots de cada estilo en una campaña (≥ 40 % acordes, nunca una mano sin ninguna)', { timeout: 600000 }, () => {
  for (const estilo of ['melee', 'disparo', 'habilidad']) {
    const r = campana({ mapId: 'm1', seed: 3, char: 'axioma', estilo, mastery: 1, pick: 'estilo', politica: 'nunca' });
    let rel = 0, tot = 0, min = 9; for (const o of r.ofertas) { rel += o.rel; tot += o.n; min = Math.min(min, o.rel); assert.ok(o.n >= 3 && o.n <= 4); }
    console.log(`# bot ${estilo}: ${r.ofertas.length} manos, ${Math.round(100 * rel / tot)} % acordes, mínimo por mano ${min}`);
    assert.ok(r.ofertas.length >= 5); assert.ok(min >= 1, `${estilo}: hubo una mano sin tarjeta del estilo`); assert.ok(rel / tot >= 0.4, `${estilo}: ${Math.round(100 * rel / tot)} %`);
  }
});
void EVO_PATHS;
