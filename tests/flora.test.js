import test from 'node:test';
import assert from 'node:assert/strict';
import { arena, run, v3, madd } from './helpers.js';
import { Game } from '../src/sim/game.js';
import { MAPS, MAP_IDS } from '../src/sim/maps.js';
import { LIMITS, PLAYER } from '../src/sim/data.js';
import { dist } from '../src/sim/math.js';
import { ESPECIES, ESP_IDS, ARENA_FLORA, FLORA, CODIGO, FN, HITOS, HERB_TOPE, herbMods, hitosCumplidos, floraBriefing, MAT_FLORA } from '../src/sim/flora-data.js';
import { layoutFlora, sitioLibre, danarPlanta, flVel, flRecibe, flSnap, floraAlimento, floraElemento, CTL, tickFlora } from '../src/sim/flora.js';
import { nieblaTemporal } from '../src/sim/nieblas.js';
import { ITEMS, SETS, RECETAS, PLANOS_JARDIN, MATERIALES, MATERIAL_IDS, FLORA_MAT_IDS, TODOS_MAT_IDS, CONSUMIBLES } from '../src/sim/items.js';
import { playMatch } from '../tools/bots-report.js';

// Flora interactiva (docs/FLORA.md). Correr de a una suite: node --test tests/flora.test.js
const T = 1 / 60;
const mk = (mapId = 'm1', seed = 3, opts = {}) => { const { g, p } = arena(mapId, { seed, ...opts }); return { g, p }; };
const planta = (g, id) => g.fl.p.find((q) => q.id === id && q.st !== 4);
/** Deja sólo la planta pedida activa (las demás marchitas para siempre) y pone al Huésped sobre ella. */
function solo(g, p, id, off = 0) {
  const pl = planta(g, id);
  for (const q of g.fl.p) if (q !== pl && q.st !== 4) { q.st = 3; q.t = 0; q.reb = 1e9; }
  pl.st = 1; pl.t = 0; pl.cd = 0; pl.hp = pl.max;
  poner(p, pl, off); return pl;
}
const poner = (p, pl, off = 0) => { const t = Math.abs(pl.u.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0); const side = { x: pl.u.y * t.z - pl.u.z * t.y, y: pl.u.z * t.x - pl.u.x * t.z, z: pl.u.x * t.y - pl.u.y * t.x }; const l = Math.hypot(side.x, side.y, side.z); p.pos = madd(madd(pl.pos, pl.u, 0.9), side, off / l); p.vel = v3(); };
const pasos = (g, p, pl, secs, off = 0, fn) => run(g, secs, (t, i) => { poner(p, pl, off); if (fn) fn(t, i); });
const vida = (p) => p.hp + p.shield;
const evs = (g, a) => g.events.filter((e) => e.t === 'flora' && (!a || e.a === a));

test('catálogo: ≥ 15 especies (3 por arena + raras), las tres funciones, código de color, aviso ≥ 1 s y textos completos', () => {
  assert.ok(ESP_IDS.length >= 15, `hay ${ESP_IDS.length}`);
  const idx = ESP_IDS.map((id) => ESPECIES[id].i).sort((a, b) => a - b); assert.deepEqual(idx, ESP_IDS.map((_, k) => k), 'los índices del snapshot son 0..n-1 sin huecos');
  for (const m of MAP_IDS) { assert.equal(Object.keys(ARENA_FLORA[m]).length, 3, `${m}: 3 especies`); for (const id of Object.keys(ARENA_FLORA[m])) assert.equal(ESPECIES[id].mapa, m, id); }
  assert.deepEqual([...new Set(ESP_IDS.map((i) => ESPECIES[i].fn))].sort(), Object.keys(FN).sort());
  const AYUDA = ['verde', 'cian', 'dorado'], DANO = ['rojo', 'magenta'], VENENO = ['violeta', 'acido'];
  for (const id of ESP_IDS) {
    const S = ESPECIES[id]; assert.ok(CODIGO[S.col], id);
    if (S.fn === 'cura') assert.ok(AYUDA.includes(S.col) || S.col === 'violeta', `${id}: ayuda en verde/cian/dorado (el Loto del Eclipse es violeta por su cielo)`);
    if (S.fn === 'ofensiva') assert.ok(DANO.includes(S.col), `${id}: daño en rojo/magenta`);
    if (S.fn === 'toxica') assert.ok(VENENO.includes(S.col) || S.col === 'cian' || S.col === 'rojo', `${id}`);
    for (const k of ['desc', 'folk', 'tele', 'contra', 'nombre']) assert.ok(S[k] && S[k].length > 8, `${id}: falta ${k}`);
    if (S.p.tel) assert.ok(S.p.tel >= FLORA.telMin, `${id}: aviso ${S.p.tel} < 1 s`);
    assert.ok(MAT_FLORA.includes(S.cos.mat) && S.cos.n[0] >= 1 && S.cos.n[1] >= S.cos.n[0], id);
    assert.ok(S.hp > 0 && S.r > 0 && (S.rara || S.rebrota > 0), id);
  }
  const tipos = new Set(ESP_IDS.map((i) => ESPECIES[i].tipo));
  for (const t of ['cura', 'escudo', 'energia', 'muerde', 'zarza', 'explosiva', 'liana', 'hongo', 'narcotica', 'espejo', 'savia', 'brasas']) assert.ok(tipos.has(t), `falta el comportamiento ${t}`);
  assert.equal(ESP_IDS.filter((i) => ESPECIES[i].rara).length, 4, '4 raras (evento ×2, misión, jefe)');
  for (const m of MAP_IDS) { const b = floraBriefing(m); assert.ok(b.length === 2 && b[0].includes('Flora de la arena') && b[1].includes('raras')); }
});

test('colocación: ≥ 20 plantas por arena, nunca más de LIMITS.flora, sitios libres, lejos de apariciones y objetivos, y sin sólidos nuevos', () => {
  for (const mapId of MAP_IDS) for (const seed of [1, 2, 3, 7, 11]) {
    const g = new Game({ mapId, seed }); g.addPlayer('t');
    const L = layoutFlora(g.map, seed), total = Object.values(ARENA_FLORA[mapId]).reduce((a, b) => a + b, 0);
    assert.ok(L.plants.length >= 20 && L.plants.length >= total - 3, `${mapId}/${seed}: ${L.plants.length} de ${total}`);
    assert.ok(g.fl.p.length <= LIMITS.flora && g.fl.p.length <= FLORA.maxActivas, 'tope de entidades');
    for (const q of L.plants) {
      assert.ok(sitioLibre(g.map, q.pos, q.u, null, false, []), `${mapId}/${seed} ${q.sp}: sitio no libre`);
      for (let i = 0; i < 4; i++) {
        const d = dist(q.pos, g.map.playerSpawn(i)), min = ESPECIES[q.sp].fn === 'ofensiva' ? FLORA.distSpawn : 6;
        assert.ok(d >= min - 1e-6, `${mapId}/${seed} ${q.sp} a ${d.toFixed(1)} m de la aparición ${i}`);
      }
      const sp = g.map.spots || {}, claves = [sp.anchor, sp.core, sp.altar, ...(sp.plates || []), ...(sp.valves || [])].filter(Boolean);
      for (const c of claves) assert.ok(dist(q.pos, c) >= (ESPECIES[q.sp].fn === 'ofensiva' ? FLORA.distClave : 5) - 1e-6, `${mapId} ${q.sp}: pegada a un objetivo`);
    }
    for (let i = 0; i < L.plants.length; i++) for (let j = i + 1; j < L.plants.length; j++) assert.ok(dist(L.plants[i].pos, L.plants[j].pos) >= FLORA.sepMin - 1e-6, 'separación');
  }
  CTL.off = true; const sin = new Game({ mapId: 'm4', seed: 1 }); CTL.off = false; const con = new Game({ mapId: 'm4', seed: 1 });
  assert.equal(sin.fl, null); assert.equal(sin.map.solids.length, con.map.solids.length, 'las plantas no son sólidos: no tapan caminos');
});

test('determinismo: misma semilla = mismas plantas y mismo estado; otra semilla = otro jardín; g.rng no se toca', () => {
  const a = new Game({ mapId: 'm5', seed: 9 }), b = new Game({ mapId: 'm5', seed: 9 }), c = new Game({ mapId: 'm5', seed: 10 });
  for (const g of [a, b, c]) { g.addPlayer('t'); g.phaseT = 1e9; }
  for (let i = 0; i < 900; i++) { a.step(T); b.step(T); c.step(T); }
  assert.equal(JSON.stringify(flSnap(a)), JSON.stringify(flSnap(b)));
  assert.notEqual(JSON.stringify(a.fl.L.plants.map((q) => q.pos)), JSON.stringify(c.fl.L.plants.map((q) => q.pos)));
  CTL.off = true; const d = new Game({ mapId: 'm5', seed: 9 }); CTL.off = false; d.addPlayer('t'); d.phaseT = 1e9;
  for (let i = 0; i < 900; i++) d.step(T);
  assert.equal(a.rng.next(), d.rng.next(), 'la flora no consume g.rng');
});

test('curativas: la flor cura al acercarte si estás herido, no se encadena (enfriamiento) y rebrota; sana no se come sola', () => {
  const { g, p } = mk('m1', 3, { hp: 100 }); const pl = solo(g, p, 'flor_luz');
  p.hp = 100; p.shield = 100; pasos(g, p, pl, 1); assert.equal(pl.st, 1, 'si estás sano, no se gasta');
  p.hp = 40; p.shield = 0; pasos(g, p, pl, 0.5);
  assert.ok(p.hp >= 57 && p.hp <= 59 && p.shield >= 13, `curó ${p.hp}/${p.shield}`); assert.equal(pl.st, 3, 'queda marchita');
  const o = g.fl.p.find((q) => q.id === 'flor_luz' && q !== pl); o.pos = madd(pl.pos, pl.u, 0.0); o.st = 1; o.t = 0; p.hp = 30; p.shield = 0;
  pasos(g, p, o, 1); assert.equal(o.st, 1, 'no se come otra en menos de 4 s'); pasos(g, p, o, 4); assert.equal(o.st, 3);
  // rebrota: marchita → brote → madura
  let visto = []; run(g, 70, () => { if (!visto.includes(pl.st)) visto.push(pl.st); }); assert.deepEqual(visto.slice(0, 3), [3, 0, 1], `estados ${visto}`);
});

test('curativas: escudo del Coro (−20 % de daño 6 s), fruto de eco (definitiva + recargas) y bulbo vital (cura lenta con reserva)', () => {
  let { g, p } = mk('m3', 3); let pl = solo(g, p, 'brote_coro'); p.shield = 10; p.hp = 60;
  pasos(g, p, pl, 0.4); assert.ok(p.shield >= 50, `escudo ${p.shield}`); assert.ok(flRecibe(g, p) < 1 && Math.abs(flRecibe(g, p) - 0.8) < 1e-9);
  const antes = vida(p); g.hurtPlayer(p, 20); const conEscudo = antes - vida(p);
  run(g, 7, null); assert.equal(flRecibe(g, p), 1); p.shield = 100; p.hp = 100; const a2 = vida(p); g.hurtPlayer(p, 20); const sin = a2 - vida(p); assert.ok(Math.abs(conEscudo / sin - 0.8) < 0.01, `el daño bajó 20 % (${conEscudo} vs ${sin})`);
  ({ g, p } = mk('m2', 3)); pl = solo(g, p, 'fruto_eco'); p.ultCd = 50; p.ultRefundBudget = 10; p.abilityCd = 10; p.movCd = 4; pasos(g, p, pl, 0.4);
  assert.ok(p.ultCd < 48 && p.ultCd > 46 && p.abilityCd <= 4.1 && p.movCd <= 1.7, `ul ${p.ultCd} cd ${p.abilityCd}/${p.movCd}`);
  ({ g, p } = mk('m4', 3)); pl = solo(g, p, 'bulbo_vital'); p.hp = 50; p.shield = 100; const r0 = pl.res;
  pasos(g, p, pl, 5); assert.ok(p.hp > 55 && p.hp < 70, `cura lenta ${p.hp}`); assert.ok(pl.res < r0 && pl.st === 1);
  p.hp = 20; p.shield = 0; const h20 = p.hp; pasos(g, p, pl, 40, 0, () => { if (p.hp > 99) p.hp = 20; }); assert.equal(pl.st, 3, 'se agota y se marchita'); assert.ok(g.fl.stats.curado >= 55, 'curó toda su reserva');
});

test('ofensivas: la carnívora avisa ≥ 1 s y después muerde (Huésped y criatura); la liana atrapa; la zarza hiere pasado el aviso; todas se pueden esquivar', () => {
  let { g, p } = mk('m4', 3); let pl = solo(g, p, 'boca_jardin'); poner(p, pl, 1.5);
  const v0 = vida(p); pasos(g, p, pl, 0.4, 1.5); assert.equal(pl.st, 2, 'armando'); assert.ok(evs(g, 'arma').length >= 1 && evs(g, 'arma')[0].tel >= 1);
  pasos(g, p, pl, 0.6, 1.5); assert.equal(vida(p), v0, 'sin daño durante el aviso'); pasos(g, p, pl, 0.7, 1.5); assert.ok(v0 - vida(p) >= 10 && v0 - vida(p) <= 20, `mordisco ${v0 - vida(p)}`);
  assert.equal(pl.st, 1); assert.ok(evs(g, 'muerde').length === 1);
  // esquivar: salir del radio durante el aviso
  ({ g, p } = mk('m4', 3)); pl = solo(g, p, 'boca_jardin'); const w0 = vida(p);
  pasos(g, p, pl, 0.3, 1.5); assert.equal(pl.st, 2); pasos(g, p, pl, 1.2, 9); assert.equal(vida(p), w0, 'si te vas durante el aviso no te toca');
  // criatura: la mordida la daña igual
  ({ g, p } = mk('m4', 3)); pl = solo(g, p, 'boca_jardin'); p.pos = madd(pl.pos, pl.u, 40);
  const m = g.spawnMonster('lente', madd(pl.pos, pl.u, 1.4), { noElite: true }); m.speedMul = 0; m.vel = v3(); const h0 = m.hp;
  run(g, 2.2, () => { m.pos = madd(pl.pos, pl.u, m.r); m.vel = v3(); }); assert.ok(h0 - m.hp >= 40, `la criatura perdió ${h0 - m.hp}`);
  // liana
  ({ g, p } = mk('m1', 3)); pl = solo(g, p, 'liana_ancla'); const l0 = vida(p);
  pasos(g, p, pl, 1.6, 1.5); assert.ok(flVel(g, p) < 0.2, `vel ${flVel(g, p)}`); assert.ok(l0 - vida(p) >= 5); run(g, 2, null); assert.equal(flVel(g, p), 1, 'se suelta');
  // zarza: cruzarla rápido no duele; quedarse sí
  ({ g, p } = mk('m2', 3)); pl = solo(g, p, 'zarza_cristal'); const z0 = vida(p);
  pasos(g, p, pl, 0.3, 0); assert.equal(vida(p), z0, 'cruce rápido: sin daño'); assert.ok(flVel(g, p) < 0.6, 'pero frena');
  pasos(g, p, pl, 1.6, 0); assert.ok(z0 - vida(p) >= 6, `zarza ${z0 - vida(p)}`);
});

test('tóxicas: hongo y flor del sueño sueltan nube con aviso; el veneno nunca baja de 8 de vida; la savia frena; el espejo devuelve el disparo', () => {
  let { g, p } = mk('m1', 3); let pl = solo(g, p, 'hongo_anima'); p.hp = 14; p.shield = 0;
  pasos(g, p, pl, 0.5, 1.5, () => { p.shield = 0; }); assert.equal(pl.st, 2); assert.equal(g.fl.nubes.length, 0, 'todavía avisando'); pasos(g, p, pl, 1.0, 1.5, () => { p.shield = 0; }); assert.equal(g.fl.nubes.length, 1, 'la nube salió');
  pasos(g, p, pl, 8, 1.5, () => { p.shield = 0; }); assert.ok(p.hp >= FLORA.venenoMin - 1e-6 && p.hp < 14, `veneno hasta ${p.hp}`);
  ({ g, p } = mk('m1', 3)); pl = solo(g, p, 'hongo_anima'); p.pos = madd(pl.pos, pl.u, 40);
  const m = g.spawnMonster('astilla', madd(pl.pos, pl.u, 1), { noElite: true }); m.speedMul = 0; const h0 = m.hp;
  run(g, 3.5, () => { m.pos = madd(pl.pos, pl.u, m.r + 0.3); m.vel = v3(); m.hp = Math.max(m.hp, 1); }); assert.ok(g.fl.nubes.length >= 1);
  ({ g, p } = mk('m3', 3)); pl = solo(g, p, 'flor_sueno'); poner(p, pl, 5); pasos(g, p, pl, 1.6, 5); assert.ok(g.fl.nubes.some((n) => n.tipo === 'sueno'));
  const n = g.fl.nubes[0]; p.pos = madd(n.pos, n.u, 0.3); run(g, 0.5, () => { p.pos = madd(n.pos, n.u, 0.3); p.vel = v3(); }); assert.ok(Math.abs(flVel(g, p) - 0.5) < 1e-9, `sueño ${flVel(g, p)}`);
  ({ g, p } = mk('m4', 3)); pl = solo(g, p, 'arbol_savia'); pasos(g, p, pl, 0.4, 2); assert.ok(Math.abs(flVel(g, p) - 0.6) < 1e-9, 'savia 60 %'); h0 + 0;
  ({ g, p } = mk('m2', 3)); pl = solo(g, p, 'planta_espejo'); p.pos = madd(pl.pos, pl.u, 30);
  const pr = g.addProjectile({ owner: 'm', kind: 'bolt', pos: madd(pl.pos, pl.u, 4), vel: madd(v3(), pl.u, -20), dmg: 10, r: 0.3, life: 3 });
  run(g, 0.5, null); assert.equal(pr.owner, 'p', 'el disparo enemigo vuelve'); assert.ok(pl.usos < 4 && pl.hp < pl.max, 'cada reflejo la agrieta');
});

test('explosiva: un golpe la arma, avisa 1,1 s y estalla dañando a Huésped, criaturas y plantas vecinas; no estalla si no la tocan', () => {
  const { g, p } = mk('m3', 3); const pl = solo(g, p, 'vejiga_silbido'); poner(p, pl, 3); const v0 = vida(p);
  pasos(g, p, pl, 3, 3); assert.equal(pl.st, 1, 'a 3 m no pasa nada'); assert.equal(vida(p), v0);
  danarPlanta(g, pl, 5, p); assert.equal(pl.st, 2); pasos(g, p, pl, 0.8, 3); assert.equal(vida(p), v0, 'avisando'); const veci = g.fl.p.find((q) => q.id === 'brote_coro' && q.st !== 4);
  veci.st = 1; veci.pos = madd(pl.pos, pl.u, 0); veci.hp = veci.max;
  pasos(g, p, pl, 0.6, 3); assert.ok(v0 - vida(p) >= 10, `estalló ${v0 - vida(p)}`); assert.equal(pl.st, 3); assert.ok(veci.hp < veci.max || veci.st === 3, 'daña a las vecinas');
});

test('cadenas del entorno: el fuego prende y se propaga, el hielo congela y rompe, la niebla ácida marchita y la cian hace florecer', () => {
  let { g, p } = mk('m5', 3); const ar = solo(g, p, 'arbusto_brasas'); p.pos = madd(ar.pos, ar.u, 40);
  const hi = g.fl.p.find((q) => q.id === 'hiedra_espina'); hi.st = 1; hi.hp = hi.max; hi.pos = madd(ar.pos, { x: ar.u.z, y: 0, z: -ar.u.x }, 2.5);
  danarPlanta(g, ar, 2, p, 'fuego'); assert.ok(ar.burn > g.time, 'arde'); run(g, 7, null);
  assert.ok(hi.burn > 0 || hi.st === 3, 'el fuego se propagó a la hiedra'); assert.equal(ar.st, 3, 'queda ceniza (marchita)'); assert.ok(g.fl.stats.fuego >= 2);
  // fuego sobre criaturas
  ({ g, p } = mk('m5', 3)); const a2 = solo(g, p, 'arbusto_brasas'); p.pos = madd(a2.pos, a2.u, 40);
  const m = g.spawnMonster('geoda', madd(a2.pos, a2.u, 2.3), { noElite: true }); m.speedMul = 0; const h0 = m.hp; danarPlanta(g, a2, 2, p, 'fuego');
  run(g, 3, () => { m.pos = madd(a2.pos, a2.u, m.r); m.vel = v3(); }); assert.ok(h0 - m.hp > 20, 'las criaturas se queman');
  // hielo
  ({ g, p } = mk('m4', 3)); const b = solo(g, p, 'boca_jardin'); p.pos = madd(b.pos, b.u, 40); danarPlanta(g, b, 3, p, 'hielo'); assert.ok(b.frz > g.time);
  const m2 = g.spawnMonster('astilla', madd(b.pos, b.u, 1), { noElite: true }); m2.speedMul = 0; run(g, 2, () => { m2.pos = madd(b.pos, b.u, m2.r); m2.vel = v3(); m2.hp = 1e6; });
  assert.equal(b.st, 1, 'congelada: no muerde'); danarPlanta(g, b, 12, p); assert.equal(b.frz, 0, 'el golpe rompe el hielo'); assert.ok(b.hp <= b.max / 2 + 1e-6, 'y le saca la mitad de la vida'); danarPlanta(g, b, 1e3, p); assert.equal(b.st, 3); assert.ok(p.bag.some((x) => x.id.startsWith('mat:')), 'y suelta botín');
  // niebla ácida marchita / cian florece
  ({ g, p } = mk('m3', 3)); const f = solo(g, p, 'brote_coro'); p.pos = madd(f.pos, f.u, 40); f.hp = f.max; nieblaTemporal(g, 'acida', madd(f.pos, f.u, 1.6), 8, 60);
  run(g, 9, null); assert.equal(f.st, 3, 'la niebla ácida marchita');
  ({ g, p } = mk('m3', 3)); const f2 = solo(g, p, 'brote_coro'); p.pos = madd(f2.pos, f2.u, 40); f2.st = 3; f2.t = 0; f2.reb = 30; nieblaTemporal(g, 'cian', madd(f2.pos, f2.u, 1.6), 8, 60);
  run(g, 14, null); assert.notEqual(f2.st, 3, 'la niebla cian la hace florecer antes de tiempo');
  // fauna: un rastro de fuego de una forma quema; la planta es alimento
  ({ g, p } = mk('m5', 3)); const a3 = solo(g, p, 'arbusto_brasas'); p.pos = madd(a3.pos, a3.u, 40); assert.equal(floraElemento(g, a3.pos, 3, 'fuego', p), 1); assert.ok(a3.burn > g.time);
  const fr = g.fl.p.find((q) => q.id === 'fruto_hora' && q.st !== 4); fr.st = 1; assert.ok(floraAlimento(g, fr.pos, 2)); assert.ok(floraAlimento(g, fr.pos, 2, true)); assert.equal(fr.st, 3);
});

test('órganos vivos y eventos: la Boca llena y la lluvia aceleran el crecimiento; el pulmón tóxico marchita', () => {
  const { g, p } = mk('m1', 3); g.wave = 2; g.ar.wave = 2; g.ar.t0 = g.time; solo(g, p, 'flor_luz'); const pl = planta(g, 'flor_luz'); pl.st = 0; pl.t = 0; p.pos = madd(pl.pos, pl.u, 40);
  const bo = g.ar.L.org.findIndex((o) => o.k === 'boca'); pl.pos = madd(g.ar.L.org[bo].pos, v3(0, 0, 0), 1); pl.pos.y = g.ar.L.org[bo].pos.y;
  g.ar.org[bo].zone = 30; run(g, 0.5, () => { g.ar.org[bo].zone = 30; }); assert.ok(pl.gm >= 2, `riego ${pl.gm}`);
  g.ev = { id: 'lluvia_astillas', ph: 'activo', since: g.time, t: 5, d: 5, dur: 16, marks: [], zona: null }; run(g, 0.3, null); assert.ok(pl.gm >= 2);
  const m6 = mk('m6', 3); m6.g.wave = 5; m6.g.phase = 'wave'; m6.g.phaseT = 1e9; const dummy = m6.g.spawnMonster('geoda', v3(0, 0, 36), { noElite: true }); dummy.passive = true; dummy.speedMul = 0; m6.g.step(T); m6.g.ar.t0 -= 200; const q = solo(m6.g, m6.p, 'lirio_osario'); m6.p.pos = madd(q.pos, q.u, 40); const pu = m6.g.ar.L.org.findIndex((o) => o.k === 'pulmon'); q.pos = madd(m6.g.ar.L.org[pu].pos, v3(0, 0, 0), 0.5); q.pos.y = m6.g.ar.L.org[pu].pos.y;
  for (let i = 0; i < 900; i++) { dummy.hp = dummy.maxhp; dummy.pos = v3(0, 0, 36); dummy.vel = v3(); m6.g.ar.sed = false; m6.g.ar.org[pu].roto = false; m6.g.ar.org[pu].brT = 9; m6.p.hp = 1e6; m6.g.step(T); if (q.st === 3) break; }
  assert.equal(m6.g.ar.ph, 'furioso');
  assert.equal(q.st, 3, 'el aliento tóxico del Respiradero la marchita');
});

test('cosecha y botín: USAR cosecha una planta madura (materiales vegetales, la planta rebrota); destruirla da menos; las peligrosas avisan antes', () => {
  let { g, p } = mk('m1', 3); let pl = solo(g, p, 'flor_luz'); p.hp = 100; p.shield = 100;
  g.setInput(p.id, { interact: true }); pasos(g, p, pl, 0.3); g.setInput(p.id, { interact: false });
  const b = p.bag.find((x) => x.id.startsWith('mat:')); assert.ok(b && b.id === 'mat:petalo' && b.n >= 1 && b.q >= 0 && b.q <= 3, JSON.stringify(p.bag)); assert.equal(pl.st, 3); assert.equal(g.fl.stats.cosechas, 1);
  assert.ok(evs(g, 'cosecha').length === 1);
  ({ g, p } = mk('m4', 3)); pl = solo(g, p, 'boca_jardin'); p.hp = 1e6; g.setInput(p.id, { interact: true }); pasos(g, p, pl, 0.3, 1.5); g.setInput(p.id, { interact: false });
  assert.ok(p.bag.some((x) => x.id === 'mat:raiz_hierro'), 'cosechó la raíz-hierro'); assert.equal(pl.st, 2, 'pero la despertó: aviso antes de morder');
  ({ g, p } = mk('m4', 3)); pl = solo(g, p, 'bulbo_vital'); assert.equal(danarPlanta(g, pl, 1e4, p), 0, 'las plantas que curan no reciben tus disparos'); assert.equal(pl.st, 1);
  pl = solo(g, p, 'arbol_savia'); danarPlanta(g, pl, 1e4, p); assert.ok(p.bag.some((x) => x.id === 'mat:resina'), 'destruida: botín'); assert.equal(pl.st, 3); assert.ok(pl.reb > pl.sp.rebrota * 1.2, 'rebrota más tarde');
  for (const x of p.bag) assert.ok(TODOS_MAT_IDS.includes(x.id.slice(4)) || !x.id.startsWith('mat:'));
});

test('plantas raras: sólo con la Aurora, el Eclipse, una misión opcional o el jefe; máximo 4; duran 80 s; Perfectas y con semilla/plano', () => {
  const { g, p } = mk('m4', 3); g.fl.p.forEach((q) => { if (q.st !== 4) { q.st = 3; q.reb = 1e9; } });
  run(g, 1, null); assert.equal(g.fl.p.filter((q) => q.rare && q.st !== 4).length, 0, 'sin evento no hay raras');
  g.ev = { id: 'eclipse', ph: 'activo', since: 5, t: 0, d: 0, dur: 24, marks: [], zona: null }; run(g, 0.3, null);
  const rs = () => g.fl.p.filter((q) => q.rare && q.st !== 4); assert.ok(rs().length >= 1 && rs().every((q) => q.id === 'loto_eclipse'), 'loto del Eclipse'); assert.ok(g.fl.dirty || evs(g, 'rara').length >= 1);
  g.stats.misDone = 1; run(g, 0.3, null); assert.ok(rs().some((q) => q.id === 'retono_pacto'));
  assert.ok(rs().length <= FLORA.maxRaras);
  const r = rs()[0]; assert.ok(r.life - g.time <= FLORA.rareVida + 0.1);
  for (const q of rs()) { q.st = 1; poner(p, q); p.hp = 1e6; p.shield = 100; p.bag = []; g.setInput(p.id, { interact: true }); run(g, 0.3, () => poner(p, q)); g.setInput(p.id, { interact: false }); if (q.sp.fn === 'ofensiva') continue;
    const m = p.bag.find((x) => x.id.startsWith('mat:')); assert.ok(m && m.q >= 2, `${q.id}: calidad ${m && m.q}`); assert.ok(p.bag.some((x) => x.id.startsWith('semilla:')) && p.bag.some((x) => x.id.startsWith('plano:') && PLANOS_JARDIN.includes(x.id.slice(6)))); break; }
  run(g, FLORA.rareVida + 5, null); assert.equal(rs().length, 0, 'se marchitan para siempre');
  const j = mk('m6', 3); j.g.fl.p.forEach((q) => { if (q.st !== 4) { q.st = 3; q.reb = 1e9; } }); j.g.wave = j.g.waveTotal; j.g.phase = 'wave'; j.g.step(T);
  assert.ok(j.g.fl.p.some((q) => q.rare && q.id === 'corona_jefe' && q.st !== 4), 'la Corona del Jefe brota con el jefe');
});

test('enemigos: pisotean y disparan a las plantas curativas', () => {
  let { g, p } = mk('m1', 3); let pl = solo(g, p, 'flor_luz'); p.hp = 100; p.shield = 100; p.pos = madd(pl.pos, pl.u, 40);
  const m = g.spawnMonster('geoda', madd(pl.pos, pl.u, 2.3), { noElite: true }); m.speedMul = 0; run(g, 4, () => { m.pos = madd(pl.pos, pl.u, m.r); m.vel = v3(); m.hp = 1e6; });
  assert.equal(pl.st, 3, 'una criatura encima la destruye'); assert.equal(g.fl.stats.destruidas, 1);
  ({ g, p } = mk('m1', 3)); pl = solo(g, p, 'flor_luz'); p.pos = madd(pl.pos, pl.u, 40);
  g.addProjectile({ owner: 'm', kind: 'bolt', pos: madd(pl.pos, pl.u, 4), vel: madd(v3(), pl.u, -20), dmg: 40, r: 0.3, life: 3 }); run(g, 0.6, null); assert.equal(pl.st, 3, 'el disparo enemigo la rompe');
});

test('armas y golpes: el rayo, la explosión y el cuerpo a cuerpo dañan plantas sin frenar el disparo; el hielo del Glaciar las congela', () => {
  const { g, p } = mk('m2', 3); const pl = solo(g, p, 'zarza_cristal'); p.pos = madd(pl.pos, pl.u, 8);
  const w = { dmg: 22, range: 100, pellets: 1 }, o = madd(p.pos, p.up, 0.6), d = { x: (pl.pos.x + pl.u.x * 0.7 - o.x), y: (pl.pos.y + pl.u.y * 0.7 - o.y), z: (pl.pos.z + pl.u.z * 0.7 - o.z) }; const l = Math.hypot(d.x, d.y, d.z); d.x /= l; d.y /= l; d.z /= l;
  const end = g.hitscan(p, o, d, w); assert.ok(pl.hp < pl.max, 'el rayo pegó'); assert.ok(Math.hypot(end.x - o.x, end.y - o.y, end.z - o.z) > 5);
  pl.hp = pl.max; g.explode(madd(pl.pos, pl.u, 0.7), 4, 0, 40, p); assert.ok(pl.hp < pl.max, 'la explosión también');
  pl.hp = pl.max; g.hitscan(p, o, d, { dmg: 3, range: 100, pellets: 1, slow: 3, id: 'glaciar' }); assert.ok(pl.frz > g.time, 'el Glaciar congela');
});

test('límites: nubes ≤ 6, raras ≤ 4, entidades ≤ LIMITS.flora aun con mucho fuego y explosiones; sin NaN', () => {
  const { g, p } = mk('m6', 5); g.wave = 3;
  for (let k = 0; k < 20; k++) { const pl = g.fl.p[k % g.fl.p.length]; if (pl.st !== 4) { danarPlanta(g, pl, 1, p, 'fuego'); danarPlanta(g, pl, 1, p); } }
  run(g, 20, (t) => { if (Math.floor(t * 10) % 5 === 0) for (const pl of g.fl.p) if (pl.st === 1 && pl.sp.tipo === 'hongo') pl.st = 2; });
  assert.ok(g.fl.p.length <= LIMITS.flora && g.fl.nubes.length <= FLORA.nubesMax);
  for (const pl of g.fl.p) { assert.ok(Number.isFinite(pl.hp) && pl.hp <= pl.max + 1e-6 && pl.hp >= -1e-6 || pl.st === 3, pl.id); }
});

test('snapshot compacto: estado corto por planta, layout sólo cada ~1,5 s, nada en el campo de pruebas', () => {
  const { g } = mk('m2', 3); const a = g.snapshot().fl; assert.ok(a.l && a.l.length === g.fl.p.length && a.s.length === a.l.length); g.step(T); const b = g.snapshot().fl; assert.equal(b.l, undefined, 'sin layout otra vez');
  assert.ok(JSON.stringify(b).length < 1800, `pesa ${JSON.stringify(b).length} B`); assert.ok(JSON.stringify(a).length < 4000);
  for (const s of a.s) assert.equal(s.length, 4); run(g, 2, null); assert.ok(g.snapshot().fl.l, 'el layout se repite');
  const pr = new Game({ mapId: 'm1', seed: 1, practice: true }); pr.addPlayer('t'); assert.equal(pr.snapshot().fl, null);
});

test('Herbario: los hitos dan mejoras pequeñas y con tope; ids falsos se ignoran; el servidor sólo acepta hitos reales', () => {
  assert.deepEqual(herbMods(['no_existe', 7, null]), { cura: 0, resis: 0, cos: 0, calidad: 0 });
  const todo = herbMods(Object.keys(HITOS)); for (const k of Object.keys(HERB_TOPE)) assert.ok(todo[k] <= HERB_TOPE[k] + 1e-9, k); assert.ok(todo.cura <= 0.15 && todo.resis <= 0.15);
  const vistas = Object.fromEntries(ESP_IDS.map((i) => [i, 1])); const hs = hitosCumplidos({ vistas, cosechas: { flor_luz: 50 } });
  assert.ok(hs.includes('desc22') && hs.includes('cos40') && hs.includes('rara4'));
  const { g, p } = mk('m4', 3, { hp: 100 }); assert.deepEqual(p.herb, { cura: 0, resis: 0, cos: 0, calidad: 0 });
  const q = g.addPlayer('b', null, { herb: ['desc8', 'falso'] }); assert.ok(Math.abs(q.herb.cura - 0.04) < 1e-9 && Math.abs(q.herb.resis - 0.05) < 1e-9);
  const mordisco = (herb) => { const { g: g2, p } = mk('m4', 3); p.herb = herbMods(herb); const pl = solo(g2, p, 'boca_jardin'); poner(p, pl, 1.5); p.shield = 100; const v = vida(p); pasos(g2, p, pl, 2.4, 1.5); return v - vida(p); };
  const d0 = mordisco([]), d1 = mordisco(['desc8', 'desc14', 'desc22']); assert.ok(d0 > 9 && Math.abs(d1 / d0 - 0.85) < 0.02, `resistencia ${d1} / ${d0}`);
});

test('materiales, recetas, planos, sets y consumibles de jardín: contrato de INVENTARIO intacto', () => {
  assert.equal(MATERIAL_IDS.length, 7, 'el botín general sigue con los 7 orgánicos'); assert.equal(FLORA_MAT_IDS.length, 8);
  for (const m of FLORA_MAT_IDS) { assert.ok(MATERIALES[m] && MATERIALES[m].calidades.length === 4 && MATERIALES[m].name && MATERIALES[m].glow); }
  assert.ok(PLANOS_JARDIN.length >= 12);
  for (const id of PLANOS_JARDIN) { const R = RECETAS[id], it = ITEMS[id]; assert.ok(!it.host && it.r >= 1 && it.r <= 2, id); assert.ok(R.mats.some((x) => x.mat === it.mat), 'usa su material base'); assert.ok(R.mats.filter((x) => FLORA_MAT_IDS.includes(x.mat)).length >= 2, `${id}: lleva materiales vegetales`); assert.ok(R.cores <= 220); }
  assert.ok(SETS.savia.jardin && SETS.flor_luz.jardin && SETS.savia.items.length === 5);
  for (const m of FLORA_MAT_IDS) assert.ok(ESP_IDS.some((i) => ESPECIES[i].cos.mat === m), `${m} sale de alguna planta`);
  for (const id of Object.keys(CONSUMIBLES)) { const C = CONSUMIBLES[id]; assert.ok(C.mats.every((x) => TODOS_MAT_IDS.includes(x.mat) && x.cal <= 2) && C.cores > 0 && C.da, id); }
  assert.ok(Object.keys(CONSUMIBLES).filter((i) => i.startsWith('semilla_')).length === ESP_IDS.filter((i) => !ESPECIES[i].rara).length, 'semilla de cada planta común; las raras no se fabrican');
});

/* ───────── perfil (Herbario, semillas, Forja de jardín) ───────── */
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const abrir = async (obj) => { mem.clear(); if (obj !== undefined) mem.set('cristal.perfil.v1', typeof obj === 'string' ? obj : JSON.stringify(obj)); return import('../src/client/perfil.js?' + Math.random()); };
test('perfil: un perfil viejo se abre con Herbario y semillas vacíos; descubrir especies da hitos; cerrarPartida guarda materiales vegetales y semillas', async () => {
  const P = await abrir({ ver: 2, cores: 90, materiales: { hueso: [1, 0, 0, 0] } });
  const p = P.perfil(); assert.deepEqual(p.herbario, { vistas: {}, cosechas: {}, hitos: [] }); assert.deepEqual(p.flora, { semillas: {}, cebos: 0 }); assert.equal(p.materiales.hueso[0], 1);
  for (const m of FLORA_MAT_IDS) assert.deepEqual(p.materiales[m], [0, 0, 0, 0]);
  assert.equal(P.verPlanta('flor_luz').nuevo, true); assert.equal(P.verPlanta('flor_luz').nuevo, false); assert.equal(P.verPlanta('no_existe').nuevo, false);
  P.verPlanta('liana_ancla'); const r = P.verPlanta('hongo_anima'); assert.deepEqual(r.hitos, ['desc3']); assert.deepEqual(P.paraPartida('axioma').herb, ['desc3']);
  assert.deepEqual(P.cosechaPlanta('flor_luz'), []);
  P.cerrarPartida('axioma', { bag: [], pt: [0, 0] }, { bag: [{ id: 'mat:petalo', q: 3, n: 2 }, { id: 'mat:fibra', q: 1, n: 1 }, { id: 'semilla:flor_luz', q: 0, n: 1 }, { id: 'mat:inventado', q: 1, n: 1 }, { id: 'semilla:xx', q: 0, n: 1 }] });
  assert.equal(P.perfil().materiales.petalo[3], 2); assert.equal(P.perfil().materiales.fibra[1], 1); assert.equal(P.perfil().flora.semillas.flor_luz, 1); assert.equal(P.perfil().flora.semillas.xx, undefined);
  const roto = await abrir({ ver: 2, herbario: { vistas: { flor_luz: 3, mentira: 5 }, cosechas: 'x', hitos: ['desc22'] }, flora: { semillas: { flor_luz: 500, fantasma: 2 }, cebos: 'a' } });
  assert.deepEqual(Object.keys(roto.perfil().herbario.vistas), ['flor_luz']); assert.deepEqual(roto.perfil().herbario.hitos, []); assert.equal(roto.perfil().flora.semillas.flor_luz, 99); assert.equal(roto.perfil().flora.cebos, 0);
});
test('Forja de jardín (perfil): consumibles con materiales vegetales y núcleos; botiquín orgánico (tope 5) y cebo; el set de jardín se forja con su plano', async () => {
  const P = await abrir({ ver: 2, cores: 500, materiales: { savia: [0, 9, 0, 0], fibra: [9, 0, 0, 0], nectar: [0, 4, 0, 0], polen: [4, 0, 0, 0], raiz: [0, 0, 5, 0], resina: [0, 3, 0, 0], petalo: [0, 3, 0, 0] }, consum: { botiquin: 4 } });
  assert.equal(P.forjarConsumible('botiquin_organico').ok, true); assert.equal(P.perfil().consum.botiquin, 5); assert.equal(P.forjarConsumible('botiquin_organico').ok, false, 'tope de 5');
  assert.equal(P.forjarConsumible('cebo_fauna').ok, true); assert.equal(P.perfil().flora.cebos, 1); assert.equal(P.usarCebo(), true); assert.equal(P.usarCebo(), false);
  assert.equal(P.forjarConsumible('semilla_flor_luz').ok, true); assert.equal(P.perfil().flora.semillas.flor_luz, 1); assert.equal(P.perfil().materiales.petalo[1], 1);
  assert.equal(P.forjarConsumible('semilla_flor_luz').ok, false, 'sin pétalos suficientes'); assert.equal(P.forjarConsumible('semilla_nada').ok, false);
});
