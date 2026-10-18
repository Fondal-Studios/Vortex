import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../src/sim/game.js';
import { MAP_IDS, MAPS } from '../src/sim/maps.js';
import { v3, dist, madd, norm } from '../src/sim/math.js';
import { PLAYER } from '../src/sim/data.js';
import { iniciarEvento, finOleada } from '../src/sim/eventos.js';
import { NIEBLAS, NIEBLA_IDS, NIEBLA, NIEBLAS_ARENA, NIEBLA_EVENTO, nieblaTemporal, nieblaPorIndice, ngDeforma, ngOculta, ngMonstruoRecibe, CTL } from '../src/sim/nieblas.js';
import { arena, run, hash } from './helpers.js';

// Nieblas tóxicas de colores (src/sim/nieblas.js): datos, determinismo (rng propio), cada efecto, avisos, respiro, eventos, órganos y snapshot.
// Los bots que no se traban y el presupuesto de render están en nieblas-bots.test.js y nieblas-render.test.js.
const enOla = (g, n = 4) => { g.wave = n; g.phase = 'wave'; g.phaseT = 1e9; if (g.ar) g.ar.wave = n; };
/** Partida con un jugador, ola `n`, sin criaturas y sin oleadas automáticas; el organismo y las nieblas fijas apagados salvo lo que se pida. */
function cancha(mapId = 'm1', { seed = 1, ola = 4, fijas = false } = {}) {
  const { g, p } = arena(mapId, { seed });
  enOla(g, ola);
  if (!fijas) g.ng.zonas = g.ng.zonas.filter((z) => z.src !== 'arena');
  return { g, p };
}
const crear = (g, tipo, pos, r = 8, vida = 60) => { const z = nieblaTemporal(g, tipo, pos, r, vida); return z; };
const esperaActiva = (g, z) => { for (let i = 0; i < 60 * 8 && z.ph !== 'activo'; i++) g.step(1 / 60); for (let i = 0; i < 90; i++) g.step(1 / 60); return z; };

test('datos: 6 tipos con nombre, color, descripción y función; avisos largos para las dañinas', () => {
  assert.deepEqual(NIEBLA_IDS.sort(), ['acida', 'ambar', 'blanca', 'cian', 'magenta', 'negra']);
  const idx = NIEBLA_IDS.map((k) => NIEBLAS[k].i).sort(); assert.deepEqual(idx, [0, 1, 2, 3, 4, 5]);
  for (const [k, T] of Object.entries(NIEBLAS)) {
    assert.ok(T.nombre && T.corto && /^#[0-9a-f]{6}$/i.test(T.color) && T.desc.length > 40 && T.icono, k);
    assert.equal(nieblaPorIndice(T.i), T);
    if (T.nocivo) assert.ok(T.aviso >= NIEBLA.avisoMin, `${k}: aviso ≥ ${NIEBLA.avisoMin} s`);
  }
});

test('cada arena tiene 1-2 nieblas temáticas con ancla válida, lejos de la aparición, y entre todas salen los 6 colores', () => {
  const vistos = new Set();
  for (const id of MAP_IDS) {
    const lista = NIEBLAS_ARENA[id]; assert.ok(lista && lista.length >= 1 && lista.length <= 2, `${id}: 1-2 nieblas`);
    const g = new Game({ mapId: id, seed: 1 }); g.addPlayer('t');
    const fijas = g.ng.zonas.filter((z) => z.src === 'arena'); assert.equal(fijas.length, lista.length);
    for (const z of fijas) {
      vistos.add(z.tipo);
      assert.ok(dist(z.pos, g.players[0].pos) > z.r + 4, `${id}/${z.nombre}: no nace encima del jugador`);
      assert.ok(!g.map.outOfBounds(z.pos), `${id}/${z.nombre}: dentro del mapa`);
      assert.ok(z.ciclo >= 30 && z.ciclo <= 50 && z.r >= 6 && z.r <= 11, `${id}/${z.nombre}: ciclo y radio razonables`);
    }
  }
  assert.equal(vistos.size, 6, 'los 6 colores aparecen en alguna arena');
});

test('determinismo: misma semilla = mismas nieblas cada medio segundo; otra semilla = otro compás; g.rng intacto', () => {
  const traza = (seed, off = false) => {
    CTL.off = off; try {
      const { g } = cancha('m4', { seed, ola: 4, fijas: true }); const out = [];
      for (let i = 0; i < 60 * 90; i++) { g.step(1 / 60); if (i % 30 === 0) out.push(JSON.stringify(g.snapshot().ng)); }
      return { out, rng: g.rng.next(), g };
    } finally { CTL.off = false; }
  };
  const a = traza(7), b = traza(7), c = traza(8);
  assert.deepEqual(a.out, b.out, 'misma semilla, mismo estado');
  assert.notDeepEqual(a.out, c.out, 'otra semilla, otro compás');
  assert.ok(a.out.some((s) => s && s !== 'null'), 'hay nieblas en el snapshot');
  assert.equal(a.rng, traza(7, true).rng, 'g.rng queda igual con y sin nieblas (rng propio g.ngRng)');
  const src = fs.readFileSync(new URL('../src/sim/nieblas.js', import.meta.url), 'utf8');
  assert.ok(!/\bg\.rng\b/.test(src) && !/\.evRng|\.arRng/.test(src), 'el código nunca usa g.rng ni el azar de eventos/arenas');
});

test('aviso: toda niebla dañina de arena se ve (aviso) al menos 2 s antes de actuar', () => {
  for (const id of ['m1', 'm4', 'm6']) {
    const { g } = cancha(id, { ola: 5, fijas: true }); const t = new Map(), gaps = [];
    for (let i = 0; i < 60 * 200; i++) {
      g.step(1 / 60);
      for (const e of g.events) if (e.t === 'ng' && e.z) { if (e.ph === 'aviso') t.set(e.z, g.time); else if (e.ph === 'activo' && t.has(e.z)) gaps.push([e.k, g.time - t.get(e.z)]); }
      g.events.length = 0;
    }
    assert.ok(gaps.length >= 2, `${id}: hubo ciclos`);
    for (const [k, gap] of gaps) if (nieblaPorIndice(k).nocivo) assert.ok(gap >= NIEBLA.avisoMin, `${id}: aviso de ${gap.toFixed(2)} s (< ${NIEBLA.avisoMin})`);
  }
});

test('respiro: entre oleadas y en el campo de pruebas las nieblas dañinas duermen y no hacen nada', () => {
  const { g, p } = cancha('m4', { ola: 4, fijas: true });
  const dan = g.ng.zonas.find((z) => NIEBLAS[z.tipo].nocivo); p.pos = madd(dan.pos, dan.u, -1.5);
  g.phase = 'intermission'; g.phaseT = 1e9; p.hp = 100;
  run(g, 60, () => { g.phase = 'intermission'; g.phaseT = 1e9; });
  assert.equal(dan.ph, 'dormida'); assert.equal(p.hp, 100);
  const pr = new Game({ mapId: 'm1', seed: 1, practice: true }); pr.addPlayer('t'); for (let i = 0; i < 600; i++) pr.step(1 / 60);
  assert.ok(pr.ng.zonas.every((z) => z.ph === 'dormida'), 'sin nieblas en el campo de pruebas'); assert.equal(pr.snapshot().ng, null);
});

test('ácida: aviso sin efecto, después quema (sin matar) y frena al jugador y a las criaturas', () => {
  const { g, p } = cancha('m1'); p.pos = v3(-30, 1, 30); p.hp = 100; p.shield = 0;
  const z = crear(g, 'acida', madd(p.pos, p.up, 1.2), 8);
  run(g, 1.5, null); assert.equal(z.ph, 'aviso'); assert.equal(p.hp, 100, 'en el aviso no hace daño'); assert.equal(g.snapshot().ng.d.length, 0);
  esperaActiva(g, z);
  assert.ok(p.hp < 100, 'quema'); assert.ok(g.ng.stats.venenoDado > 0);
  assert.ok(p.ngB.vel <= 0.78 + 1e-9, 'frena al jugador');
  assert.deepEqual(g.snapshot().ng.d[0].slice(0, 3), [p.id, NIEBLAS.acida.i, z.id]);
  p.hp = 9; p.shield = 0; run(g, 30, null); assert.ok(p.hp >= NIEBLA.venenoMin - 1e-6 && !p.dead, 'el veneno nunca mata');
  const m = g.spawnMonster('astilla', madd(z.pos, p.heading, 3), { noElite: true }); m.hp = m.maxhp = 100;
  run(g, 2, null); assert.ok(m.hp < 100, 'quema a la criatura'); assert.ok(g.time < m.slowUntil + 1, 'y la frena');
});

test('cian: cura y da escudo adentro; atrae a las criaturas hacia el centro', () => {
  const { g, p } = cancha('m1'); p.pos = v3(-30, 1, 30); p.hp = 40; p.shield = 0;
  const z = crear(g, 'cian', madd(p.pos, p.up, 1.2), 8); esperaActiva(g, z);
  const h0 = p.hp; run(g, 4, null); assert.ok(p.hp > h0 + 10 && p.shield > 20, 'cura y da escudo');
  assert.ok(g.ng.stats.curado > 0);
  // atracción: una criatura quieta a 1,6 radios del centro se acerca más que la misma sin niebla
  const lejos = (con) => {
    const { g: g2, p: p2 } = cancha('m1'); p2.pos = v3(-30, 1, 80); p2.hp = 1e6;
    const c = madd(v3(-30, 1, 30), v3(0, 1, 0), 1.2); if (con) esperaActiva(g2, crear(g2, 'cian', c, 8));
    const m = g2.spawnMonster('astilla', v3(-30 + 13, 1, 30), { noElite: true }); m.passive = true; const d0 = dist(m.pos, c); run(g2, 3, null); return d0 - dist(m.pos, c);
  };
  assert.ok(lejos(true) > lejos(false) + 1, 'la niebla cian tira de las criaturas');
});

test('magenta: tuerce el rumbo un poco (no con «Reducir efectos»), +15 % de golpe y fantasmas sólo visuales', () => {
  const { g, p } = cancha('m1'); p.pos = v3(-30, 1, 30);
  const z = crear(g, 'magenta', madd(p.pos, p.up, 1.2), 8); esperaActiva(g, z);
  const wish = v3(0, 0, -1); let max = 0;
  for (let i = 0; i < 400; i++) { g.step(1 / 60); const w = ngDeforma(g, p, wish); max = Math.max(max, Math.hypot(w.x - wish.x, w.z - wish.z)); }
  assert.ok(max > 0.05 && max < 0.45, `desvío chico (${max.toFixed(2)})`);
  p.input.soft = true; g.step(1 / 60); assert.deepEqual(ngDeforma(g, p, wish), wish, '«Reducir efectos» lo apaga'); p.input.soft = false;
  assert.ok(Math.abs(p.ngB.dOut - 1.15) < 1e-9);
});

test('ámbar: +30 % de daño hecho y recibido por el jugador y por las criaturas de adentro', () => {
  const { g, p } = cancha('m1'); p.pos = v3(-30, 1, 30); p.shield = 0; p.invulUntil = 0;
  const hp = () => { const h = p.hp; g.hurtPlayer(p, 10); return h - p.hp; };
  p.hp = 100; const normal = hp();
  const z = crear(g, 'ambar', madd(p.pos, p.up, 1.2), 8); esperaActiva(g, z);
  p.hp = 100; p.invulUntil = 0; const frenesi = hp(); assert.ok(Math.abs(frenesi / normal - 1.3) < 0.05, `recibe ×1,3 (${(frenesi / normal).toFixed(2)})`);
  assert.ok(Math.abs(p.ngB.dOut - 1.3) < 1e-9, 'y hace ×1,3');
  const dentro = g.spawnMonster('astilla', madd(z.pos, p.heading, 2), { noElite: true }), fuera = g.spawnMonster('astilla', v3(-30, 1, 80), { noElite: true });
  assert.equal(ngMonstruoRecibe(g, dentro), 1.3); assert.equal(ngMonstruoRecibe(g, fuera), 1);
  dentro.hp = fuera.hp = 1000; dentro.maxhp = fuera.maxhp = 1000; p.pos = v3(200, 1, 200);   // el jugador sale: el daño lo hace el golpe a la criatura
  g.damageMonster(dentro, 100, null, dentro.pos); g.damageMonster(fuera, 100, null, fuera.pos);
  assert.ok(Math.abs((1000 - dentro.hp) / (1000 - fuera.hp) - 1.3) < 0.02);
});

test('blanca: las criaturas lejanas dejan de ver al jugador; las cercanas (≤ 9 m) lo siguen viendo', () => {
  const { g, p } = cancha('m1'); p.pos = v3(-30, 1, 30);
  const z = crear(g, 'blanca', madd(p.pos, p.up, 1.2), 8); esperaActiva(g, z);
  const lejos = g.spawnMonster('astilla', v3(-30, 1, 60), { noElite: true }), cerca = g.spawnMonster('astilla', v3(-30, 1, 38), { noElite: true });
  assert.equal(ngOculta(g, p, lejos), true); assert.equal(ngOculta(g, p, cerca), false);
  const l0 = { ...lejos.pos }; run(g, 2, null); assert.ok(dist(lejos.pos, l0) < 0.01, 'la criatura que no te ve no avanza');
  p.pos = v3(-30, 1, 80); g.step(1 / 60); assert.equal(ngOculta(g, p, lejos), false, 'fuera de la niebla te ve');
});

test('negra: congela la recarga de habilidades y apaga la carga de la definitiva', () => {
  const { g, p } = cancha('m1'); p.pos = v3(-30, 1, 30); p.movCd = 5; p.espCd = 5; p.abilityCd = 5; p.s3Cd = 5; p.ul = 60; p.ultT = 0; p.ultId = '';
  const z = crear(g, 'negra', madd(p.pos, p.up, 1.2), 8); esperaActiva(g, z);
  const antes = [p.movCd, p.espCd, p.abilityCd, p.s3Cd], ul = p.ul; run(g, 3, null);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs([p.movCd, p.espCd, p.abilityCd, p.s3Cd][i] - antes[i]) < 0.05, 'recarga congelada');
  assert.ok(p.ul < ul - 15, 'la definitiva se drena'); assert.ok(g.ng.stats.drenado > 0);
  p.pos = v3(200, 1, 200); run(g, 2, null); assert.ok(p.movCd < antes[0] - 1, 'al salir vuelve a recargar');
});

test('eventos: «Niebla de Almas» usa 3 bancos de niebla blanca y «Marea de Sangre» uno ámbar; terminan con el evento', () => {
  for (const [ev, tipo, n] of [['niebla_almas', 'blanca', 3], ['marea_sangre', 'ambar', 1]]) {
    const { g } = cancha('m3', { ola: 4 }); assert.deepEqual(NIEBLA_EVENTO[ev].tipo, tipo);
    iniciarEvento(g, ev, { aviso: 4 });
    const zs = g.ng.zonas.filter((z) => z.evId === ev); assert.equal(zs.length, n); assert.ok(zs.every((z) => z.tipo === tipo && z.ph === 'aviso'), 'se ven en el aviso del evento');
    run(g, 4.5, null); assert.ok(zs.every((z) => z.ph === 'activo'), 'activas con el evento');
    finOleada(g); run(g, 4, null); assert.ok(zs.every((z) => z.ph === 'dormida'));
    run(g, 3, null); assert.equal(g.ng.zonas.filter((z) => z.evId === ev).length, 0, 'se retiran al apagarse');
  }
});

test('órganos: el pulmón suelta una nube al exhalar (cian en calma, tóxica si el organismo está furioso)', () => {
  const nubes = (mapId, furioso) => {
    const { g } = cancha(mapId, { ola: 4 }); g.ar.t0 = g.time - (furioso ? 200 : 0);
    const vistos = new Set(); for (let i = 0; i < 60 * 40; i++) { g.step(1 / 60); for (const z of g.ng.zonas) if (z.src === 'organo') vistos.add(z.tipo); }
    return [...vistos];
  };
  assert.deepEqual(nubes('m4', false), ['cian']);
  assert.ok(nubes('m4', true).includes('acida')); assert.ok(nubes('m6', true).includes('ambar')); assert.ok(nubes('m2', true).includes('magenta'));
  assert.deepEqual(nubes('m1', true), [], 'm1 no tiene pulmón: no hay nubes de órgano');
});

test('snapshot compacto `ng`: zonas y quién está adentro; null si no hay', () => {
  const { g, p } = cancha('m1'); assert.equal(g.snapshot().ng, null);
  p.pos = v3(-30, 1, 30); const z = crear(g, 'cian', madd(p.pos, p.up, 1.2), 8); esperaActiva(g, z);
  const s = g.snapshot().ng; assert.equal(s.z.length, 1); assert.equal(s.z[0].length, 11); assert.equal(s.z[0][1], NIEBLAS.cian.i); assert.equal(s.z[0][7], 2);
  assert.equal(s.d.length, 1);
  for (let i = 0; i < NIEBLA.maxZonas + 4; i++) nieblaTemporal(g, 'blanca', v3(60 + i * 3, 1, 60), 6, 30);
  assert.ok(g.ng.zonas.length <= NIEBLA.maxZonas, 'tope de zonas'); assert.ok(JSON.stringify(g.snapshot().ng).length < 900, 'snapshot chico');
});

test('con CTL.off no hay nieblas y las partidas son las de antes', () => {
  CTL.off = true; try { const { g } = arena('m4', { seed: 2 }); assert.equal(g.ng, null); run(g, 5, null); assert.equal(g.snapshot().ng, null); } finally { CTL.off = false; }
});

test('el mismo estado de partida con y sin nieblas coincide mientras no haya nadie adentro (no cambian oleadas ni azar)', () => {
  const jugar = (off) => { CTL.off = off; try { const g = new Game({ mapId: 'm5', seed: 11 }); const p = g.addPlayer('t'); p.hp = 1e6; p.pos = v3(-3.75, 0.9, 80); for (let i = 0; i < 60 * 60; i++) { g.setInput(p.id, { mx: 0, mz: 0, dyaw: 0, dpitch: 0 }); g.step(1 / 60); } const s = g.snapshot(); return hash({ ...s, ng: null, events: null }); } finally { CTL.off = false; } };
  assert.equal(jugar(true), jugar(false));
});
