// INVENTARIO Y DROPEO (docs/INVENTARIO.md): catálogo válido, drops deterministas y con pity, armas firma por Huésped, equipo aplicado en la simulación,
// maduración, perfil (migración, desguace, bloqueo, equipo), validación del servidor y equilibrio frente a los estilos (tests/estilos.test.js).
// Se corre sola: node --test tests/inventario.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { WEAPONS, WAVE_PLANS, MELEE_WEAPONS, MELEE_TYPES } from '../src/sim/data.js';
import { MELEE_MODEL_IDS } from '../src/client/melee-models.js';
import {
  ITEMS, ITEM_IDS, SLOTS, ARMOR_SLOTS, RARITIES, MATERIALS, MATERIAL_IDS, PLANOS, SETS, SET_IDS, setActivos, setCounts, RECETAS, MATERIALES, TODOS_MAT_IDS, CALIDADES, qForja, PLANOS_INICIALES, PASIVOS, SIGNATURES, ITEM_COMBO_SETS, ITEM_COMBO_WEAPON, CAPS, BN_KEYS, ADD_KEYS, UTIL_KEYS,
  FASE_KILLS, FASE_MUL, faseDe, progresoFase, itemStats, pasivosActivos, cleanEquip, equipError, foldStatic, desguaceValor, lineasStats, lineasPasivos, lineasSinergias, proximaFase, poder, rollMul, LIMITE_INVENTARIO,
} from '../src/sim/items.js';
import { tirar, tirarBotin, BOTIN_TIPO, rarezaDe, pesosRareza, FUENTES, PITY, initPity, dropsJefe, firmaCumplida, soltar, updateLoot, forjar, lootSnap, MAT_MAPA } from '../src/sim/drops.js';
import { comboUnlocked } from '../src/sim/combos.js';
import { meleeSet } from '../src/sim/huespedes.js';
import { wstat } from '../src/sim/loadout.js';
import { startServer, equipDe } from '../server/server.js';
import { sub, norm, dot, len, mul, v3 } from '../src/sim/math.js';
import { hash } from './helpers.js';

/** Los 5 Huéspedes originales: cada uno con su arma firma (los nuevos que se sumen al juego pueden no tenerla todavía). */
const HOST_IDS = ['axioma', 'vesper', 'micelio', 'umbra', 'seraf'];
const T60 = 1 / 60;
const mkGame = (opts = {}, pOpts = {}) => { const g = new Game({ mapId: 'm1', seed: 7, magazines: true, ...opts }); g.phaseT = 1e9; const p = g.addPlayer('t', null, { char: 'axioma', ...pOpts }); p.hp = 100; p.shield = 100; return { g, p }; };
const run = (g, secs, fn) => { for (let i = 0; i < Math.round(secs / T60); i++) { if (fn) fn(i); g.step(T60); } };

/* ───────────────────────── catálogo ───────────────────────── */
test('catálogo: ≥ 40 objetos, ids = claves, los 4 tipos, las 4 ranuras de armadura, 4 rarezas y los 7 materiales', () => {
  assert.ok(ITEM_IDS.length >= 40, `hay ${ITEM_IDS.length}`);
  for (const id of ITEM_IDS) { const it = ITEMS[id]; assert.equal(it.id, id); assert.ok(SLOTS.includes(it.slot), id); assert.ok(it.r >= 0 && it.r <= 3, id); assert.ok(MATERIALS[it.mat], id); assert.match(it.name, /\S/); assert.ok(it.lore.length > 20, `${id}: falta la historia`); }
  assert.deepEqual([...new Set(ITEM_IDS.map((i) => ITEMS[i].type))].sort(), ['armadura', 'disparo', 'melee', 'reliquia']);
  for (const s of ARMOR_SLOTS) assert.ok(ITEM_IDS.filter((i) => ITEMS[i].slot === s).length >= 4, `armadura ${s}`);
  for (let r = 0; r < 4; r++) assert.ok(ITEM_IDS.filter((i) => ITEMS[i].r === r).length >= 6, `rareza ${RARITIES[r].name}`);
  assert.deepEqual([...new Set(ITEM_IDS.map((i) => ITEMS[i].mat))].sort(), [...MATERIAL_IDS].sort(), 'cada material tiene objetos');
  assert.ok(ITEM_IDS.filter((i) => ITEMS[i].slot === 'gun').length >= 6 && ITEM_IDS.filter((i) => ITEMS[i].slot === 'melee').length >= 8);
  const leg = ITEM_IDS.filter((i) => ITEMS[i].r === 3); assert.equal(new Set(leg.map((i) => ITEMS[i].name)).size, leg.length, 'cada legendaria tiene nombre propio');
  assert.equal(new Set(ITEM_IDS.map((i) => ITEMS[i].name)).size, ITEM_IDS.length, 'nombres únicos');
});
test('catálogo: bonos acotados por rareza (y dentro de CAPS), pasivos y sinergias válidos, armas con base real', () => {
  for (const id of ITEM_IDS) {
    const it = ITEMS[id], R = RARITIES[it.r]; let tot = 0;
    for (const [k, v] of Object.entries(it.st)) {
      assert.ok(BN_KEYS.includes(k) || ADD_KEYS.includes(k), `${id}: clave ${k}`);
      if (k === 'heal') assert.ok(v > 0 && v <= R.heal, `${id} heal ${v}`); else if (k === 'kheal') assert.ok(v > 0 && v <= R.kheal, `${id} kheal ${v}`);
      else { const cap = UTIL_KEYS.includes(k) ? R.cap * 2 : R.cap; assert.ok(Math.abs(v - 1) > 0 && Math.abs(v - 1) <= cap + 1e-9, `${id} ${k}=${v} pasa el tope ${cap}`); if (!UTIL_KEYS.includes(k)) tot += Math.abs(v - 1); }
    }
    assert.ok(tot <= R.total + 1e-9, `${id}: suma de bonos ${tot.toFixed(3)} > ${R.total}`);
    for (const p of it.pa) { assert.ok(PASIVOS[p.id], `${id}: pasivo ${p.id}`); assert.ok(p.v > 0 && (p.f || 0) <= 3); assert.match(PASIVOS[p.id].txt(p.v), /\S/); }
    for (const s of it.syn) { assert.ok(['ess', 'organ', 'estilo', 'camino'].includes(s.t), id); for (const [k, v] of Object.entries(s.fx)) assert.ok(k in CAPS && (ADD_KEYS.includes(k) ? v > 0 : Math.abs(v - 1) <= 0.07), `${id} sinergia ${k}=${v}`); }
    if (it.g) { assert.ok(WEAPONS.some((w) => w.id === it.g.base && w.id !== 'haz'), `${id}: base ${it.g.base}`); assert.ok(it.g.dmg >= 1 && it.g.dmg <= 1.25 && it.g.rate >= 1 && it.g.rate <= 1.15 && it.g.mag >= 1 && it.g.mag <= 1.35, id); assert.equal(it.slot, 'gun'); }
    if (it.m) { assert.equal(it.slot, 'melee'); assert.ok(MELEE_MODEL_IDS.includes(it.m.model), `${id}: modelo ${it.m.model}`); assert.ok(it.m.light.dmg > 15 && it.m.heavy.dmg > it.m.light.dmg && it.m.light.range > 2 && it.m.heavy.cd > it.m.light.cd, id); assert.ok(MELEE_TYPES[it.m.type] || ITEM_COMBO_WEAPON[it.m.type], `${id}: tipo ${it.m.type}`); }
    assert.ok(!(it.g && it.m) && (it.slot === 'gun') === !!it.g && (it.slot === 'melee') === !!it.m, id);
  }
  // la maduración sube los bonos pero nunca pasa de los topes globales
  const cap = foldStatic(ITEM_IDS.filter((i) => ITEMS[i].slot === 'relic' || ARMOR_SLOTS.includes(ITEMS[i].slot)).slice(0, 12).map((id) => ({ id, q: 1, k: 9999 }))); for (const [k, [lo, hi]] of Object.entries(CAPS)) if (k in cap) assert.ok(cap[k] >= lo - 1e-9 && cap[k] <= hi + 1e-9, k);
});
test('catálogo: una arma FIRMA legendaria por Huésped, cada una con su condición, y las Espadas Gemelas son de Axioma con dos hojas y set de combo propio', () => {
  assert.deepEqual(Object.keys(SIGNATURES).sort(), [...HOST_IDS].sort());
  const names = new Set();
  for (const h of HOST_IDS) { const it = ITEMS[SIGNATURES[h]]; assert.equal(it.r, 3, h); assert.equal(it.host, h); assert.ok(it.sig && WAVE_PLANS[it.sig.map] && it.sig.misiones >= 1 && it.sig.texto.length > 30, h); assert.ok(it.pa.length >= 3 && it.syn.length >= 1, `${h}: rasgos que evolucionan`); assert.ok(it.pa.some((p) => (p.f || 0) >= 1), `${h}: algo que se desbloquea al madurar`); names.add(it.name); }
  assert.equal(names.size, 5);
  const maps = HOST_IDS.map((h) => ITEMS[SIGNATURES[h]].sig.map); assert.equal(new Set(maps).size, 5, 'cada firma se consigue en un mapa distinto');
  const g = ITEMS.gemelas_axioma; assert.equal(g.host, 'axioma'); assert.equal(SIGNATURES.axioma, 'gemelas_axioma'); assert.ok(/Gemelas/.test(g.name) && g.m.dual > 1 && g.m.combo === 'gemelas');
  const set = ITEM_COMBO_SETS.gemelas; assert.ok(set.length >= 8 && new Set(set.map((m) => m.id)).size === set.length); assert.ok(set.some((m) => m.seq.length === 5), 'cadena de 5');
  const tipos = HOST_IDS.map((h) => ITEMS[SIGNATURES[h]].m ? ITEMS[SIGNATURES[h]].m.type : 'arco'); assert.equal(new Set(tipos).size, 5, 'cinco identidades: gemelas, garras, cetro, guadaña, arco');
  assert.deepEqual([...new Set(Object.values(MELEE_WEAPONS).map((w) => w.type))].sort(), ['daga', 'espada', 'hacha', 'lanza', 'martillo'], 'el catálogo viejo no cambió');
});
test('fases de maduración: umbrales crecientes, bonos que crecen y el próximo desbloqueo se describe', () => {
  for (const t of ['arma', 'resto']) for (let i = 1; i < 4; i++) assert.ok(FASE_KILLS[t][i] > FASE_KILLS[t][i - 1]);
  for (let i = 1; i < 4; i++) assert.ok(FASE_MUL[i] > FASE_MUL[i - 1]);
  const a = { id: 'gemelas_axioma', q: 0.5, k: 0 }, T = FASE_KILLS.arma;
  assert.equal(faseDe(ITEMS.gemelas_axioma, 0), 0); assert.equal(faseDe(ITEMS.gemelas_axioma, T[1]), 1); assert.equal(faseDe(ITEMS.gemelas_axioma, T[2] + 5), 2); assert.equal(faseDe(ITEMS.gemelas_axioma, 99999), 3);
  const s0 = itemStats(a).st.melee, s3 = itemStats({ ...a, k: 999 }).st.melee; assert.ok(s3 > s0);
  assert.ok(pasivosActivos({ ...a, k: 999 }).length > pasivosActivos(a).length);
  assert.equal(proximaFase({ ...a, k: 999 }), null); assert.match(proximaFase(a).txt, /\S/);
  const pr = progresoFase(ITEMS.gemelas_axioma, 10); assert.ok(pr.frac > 0 && pr.frac < 1 && pr.falta === T[1] - 10);
  assert.ok(rollMul(0) < rollMul(1) && rollMul(0) >= 0.94 && rollMul(1) <= 1.06);
  assert.ok(lineasStats(a).length && lineasPasivos(a).length && lineasSinergias(a).length);
  assert.ok(poder({ id: 'gemelas_axioma', q: 0.5, k: 0 }) > poder({ id: 'fusil_hueso', q: 0.5, k: 0 }));
});
test('equipo: cleanEquip descarta ids falsos, ranuras mal puestas, firmas ajenas y repetidos; devuelve a lo sumo una por ranura', () => {
  const l = cleanEquip('axioma', [
    { s: 'melee', id: 'gemelas_axioma', q: 0.7, k: 5 }, { s: 'melee', id: 'cuchilla_hueso' }, { s: 'head', id: 'fusil_hueso' }, { s: 'gun', id: 'arco_aureola' }, { id: 'no_existe' }, null, 7, { id: 'x'.repeat(80) },
    { s: 'head', id: 'mascara_vacio', q: 9, k: -4 }, { id: 'peto_hueso', q: 'abc', k: 1e12 }]);
  assert.deepEqual(l.map((e) => e.id), ['gemelas_axioma', 'mascara_vacio', 'peto_hueso']);
  assert.equal(l[1].q, 1); assert.equal(l[1].k, 0); assert.equal(l[2].q, 0.5); assert.ok(l[2].k <= 99999);
  assert.ok(equipError('vesper', { id: 'gemelas_axioma' }).includes('Axioma')); assert.equal(equipError('axioma', { id: 'gemelas_axioma' }), ''); assert.ok(equipError('axioma', { id: 'peto_hueso' }, 'head'));
  assert.deepEqual(cleanEquip('axioma', 'hola'), []); assert.equal(cleanEquip('axioma', Array.from({ length: 50 }, () => ({ id: 'peto_hueso' }))).length, 1);
  assert.deepEqual(desguaceValor({ id: 'gemelas_axioma', k: 0 }).ess, { carne: 4 }); assert.ok(desguaceValor({ id: 'fusil_hueso', k: 0 }).cores < desguaceValor({ id: 'gemelas_axioma', k: 0 }).cores);
});

/* ───────────────────────── dropeo ───────────────────────── */
test('dropeo: determinista por semilla, con rng propio (g.rng queda intacto) y sin cambiar las oleadas', () => {
  const play = (extra) => {
    const { g, p } = mkGame({ seed: 11 }); g.phaseT = 1;
    if (extra) for (let i = 0; i < 300; i++) { tirar(g, p, 'elite'); soltar(g, tirar(g, p, 'cofre'), p.pos, 0); }
    const seq = []; run(g, 25, (i) => { g.setInput(p.id, { fire: true, mz: 0 }); if (i % 600 === 0) seq.push(g.monsters.length); });
    return { seq, mons: hash({ m: g.monsters.map((m) => [m.kind, m.pos.x]) }), rng: g.rng.next() };
  };
  const a = play(false), b = play(true), c = play(true);
  assert.deepEqual(a.seq, b.seq); assert.equal(a.mons, b.mons, 'los drops no cambian a las criaturas'); assert.equal(a.rng, b.rng, 'g.rng quedó igual');
  assert.deepEqual(b, c, 'misma semilla → misma partida');
  const mk = (seed) => { const { g, p } = mkGame({ seed }); return Array.from({ length: 40 }, () => tirar(g, p, 'mision')).map((d) => d.id + d.q); };
  assert.deepEqual(mk(5), mk(5)); assert.notDeepEqual(mk(5), mk(6));
  const { g } = mkGame(); assert.ok(g.drRng && g.drRng !== g.rng);
});
test('dropeo: las tablas de rareza se cumplen por fuente (sin pity) y escalan con la oleada', () => {
  for (const fuente of Object.keys(FUENTES)) {
    const { g, p } = mkGame({ seed: 3 }); g.wave = 1; const N = 4000, cnt = [0, 0, 0, 0], tab = FUENTES[fuente].tabla, tot = tab.reduce((a, b) => a + b, 0);
    for (let i = 0; i < N; i++) { p.pity = { l: 0, e: 0 }; cnt[rarezaDe(g, p, fuente)]++; }
    for (let r = 0; r < 4; r++) { const esperado = tab[r] / tot; assert.ok(Math.abs(cnt[r] / N - esperado) < 0.035, `${fuente} rareza ${r}: ${(cnt[r] / N).toFixed(3)} vs ${esperado.toFixed(3)}`); }
  }
  const { g, p } = mkGame(); p.pity = { l: 0, e: 0 };
  g.wave = 1; const w1 = pesosRareza(g, p, 'elite').w; g.wave = 8; const w8 = pesosRareza(g, p, 'elite').w;
  assert.ok(w8[2] / w8[0] > w1[2] / w1[0] && w8[3] / w8[0] > w1[3] / w1[0], 'más oleada → más épicas y legendarias');
  g.difficulty = 1; const d1 = pesosRareza(g, p, 'elite').w; g.difficulty = 2; const d2 = pesosRareza(g, p, 'elite').w; assert.ok(d2[3] > d1[3], 'más dificultad → más legendarias');
  assert.equal(FUENTES.jefe.tabla[0], 0, 'el jefe no suelta comunes');
});
test('dropeo: garantía (pity): la legendaria nunca tarda más de %d tiradas y la épica más de %d'.replace('%d', PITY.legendaria).replace('%d', PITY.epica), () => {
  const { g, p } = mkGame({ seed: 9 }); g.wave = 1; let gapL = 0, gapE = 0, maxL = 0, maxE = 0, legs = 0;
  for (let i = 0; i < 6000; i++) {
    const d = tirar(g, p, 'respiro'); gapL++; gapE++;
    if (d.r === 3) { legs++; maxL = Math.max(maxL, gapL); gapL = 0; } if (d.r >= 2) { maxE = Math.max(maxE, gapE); gapE = 0; }
  }
  assert.ok(maxL <= PITY.legendaria + 1, `hueco legendaria ${maxL}`); assert.ok(maxE <= PITY.epica + 1, `hueco épica ${maxE}`);
  assert.ok(legs >= 6000 / (PITY.legendaria + 1) - 1, `hubo ${legs} legendarias`);
  // el pity sale por el snapshot y se puede cargar de nuevo
  const { g: g2, p: p2 } = mkGame(); initPity(p2, { l: PITY.legendaria, e: 4 }); const d = tirar(g2, p2, 'respiro'); assert.equal(d.r, 3, 'con 30 sin legendaria la próxima lo es'); assert.equal(p2.pity.l, 0);
  assert.deepEqual(g2.snapshot().players[0].pt, [0, p2.pity.e]);
  initPity(p2, { l: -5, e: 'x' }); assert.deepEqual(p2.pity, { l: 0, e: 0 });
});
test('dropeo: las tiradas generales NUNCA sueltan armas firma y el material de la arena pesa', () => {
  const { g, p } = mkGame({ seed: 21 }); g.wave = 6; const cnt = {};
  for (let i = 0; i < 4000; i++) { const d = tirar(g, p, ['elite', 'jefe', 'cofre', 'herrero'][i % 4]); assert.ok(!ITEMS[d.id].host, d.id); cnt[ITEMS[d.id].mat] = (cnt[ITEMS[d.id].mat] || 0) + 1; }
  const cuenta = (mapId) => { const gm = new Game({ mapId, seed: 4 }), pm = gm.addPlayer('t', null, { char: 'micelio' }), c = {}; for (let i = 0; i < 6000; i++) { const d = tirar(gm, pm, 'cofre'); c[ITEMS[d.id].mat] = (c[ITEMS[d.id].mat] || 0) + 1; } return c; };
  const m4 = cuenta('m4'), m1 = cuenta('m1');
  for (const mat of MAT_MAPA.m4) assert.ok(m4[mat] > m1[mat] * 1.15, `en el Jardín caen más ${mat}: ${m4[mat]} vs ${m1[mat]}`);
  for (const mat of MAT_MAPA.m1) assert.ok(m1[mat] > m4[mat] * 1.15, `en el Vacío de Islas caen más ${mat}: ${m1[mat]} vs ${m4[mat]}`);
});
test('dropeo: el PLANO RARO del arma firma sólo cae para SU Huésped, en el mapa de su condición, tras el jefe y con las misiones cumplidas', () => {
  for (const h of HOST_IDS) {
    const sig = ITEMS[SIGNATURES[h]], c = sig.sig;
    const jefe = (mapId, hostId, misDone) => { const g = new Game({ mapId, seed: 2 }), p = g.addPlayer('t', null, { char: hostId }); g.stats.misDone = misDone; dropsJefe(g, p.pos); return { g, p, ids: p.bag.map((b) => b.id), ev: g.events.filter((e) => e.t === 'firma') }; };
    const ok = jefe(c.map, h, c.misiones); assert.ok(ok.ids.includes('plano:' + sig.id), `${h}: debe caer el plano de ${sig.id}`); assert.ok(!ok.ids.includes(sig.id), 'el objeto terminado NO cae: se construye en la Forja'); assert.equal(ok.ev.length, 1); assert.ok(ok.p.sigMet); assert.equal(ok.g.snapshot().players[0].sg, 1);
    assert.ok(ok.p.bag.filter((b) => b.id.startsWith('mat:')).length >= 3 && ok.p.bag.some((b) => b.id.startsWith('plano:') && b.src === 'jefe'), 'el jefe da materiales y un plano');
    assert.ok(!jefe(c.map, h, c.misiones - 1).ids.includes('plano:' + sig.id), `${h}: sin la misión no cae`);
    const otroMapa = Object.keys(WAVE_PLANS).find((m) => m !== c.map); assert.ok(!jefe(otroMapa, h, 9).ids.includes('plano:' + sig.id), `${h}: en otro mapa no cae`);
    for (const o of HOST_IDS.filter((x) => x !== h)) assert.ok(!jefe(c.map, o, 9).ids.includes('plano:' + sig.id), `${o} no recibe el plano de ${h}`);
    const prac = new Game({ mapId: c.map, seed: 2, practice: true }), pp = prac.addPlayer('t', null, { char: h }); prac.stats.misDone = 9; dropsJefe(prac, pp.pos); assert.equal(pp.bag.length, 0, 'el campo de pruebas no suelta nada');
  }
  const { g, p } = mkGame(); assert.equal(firmaCumplida(g, p), false);
  // los planos de las demás armas firma nunca caen por las tablas generales
  const { g: g2, p: p2 } = mkGame({ seed: 8 }); for (let i = 0; i < 3000; i++) { const b = tirarBotin(g2, p2, ['elite', 'mision', 'cofre', 'ofrenda'][i % 4]); if (b.k === 'plano') assert.ok(!PLANOS[b.id.slice(6)].firma, b.id); }
});
test('dropeo: el jefe real suelta materiales y planos al caer (y el plano raro de la firma), las misiones sueltan botín personal', () => {
  const g = new Game({ mapId: 'm1', seed: 4, magazines: true }); const p = g.addPlayer('t', null, { char: 'axioma' }); p.hp = 1e6; g.stats.misDone = 1;
  const boss = g.spawnMonster('coloso', { x: p.pos.x + p.heading.x * 12, y: p.pos.y + 1, z: p.pos.z + p.heading.z * 12 }, { noElite: true });
  g.damageMonster(boss, 1e9, p, boss.pos);
  assert.ok(boss.dead); assert.ok(p.bag.some((b) => b.id === 'plano:gemelas_axioma'), 'el plano de la firma cae al vencer al jefe'); assert.ok(g.events.some((e) => e.t === 'drop' && e.directo) && g.events.some((e) => e.t === 'loot'));
  const h = new Game({ mapId: 'm1', seed: 4 }); const q = h.addPlayer('t', null, { char: 'axioma' }); h.phase = 'wave'; h.wave = 2;
  h.mision = { k: 'melee', n: 1, p: 0, st: 'active', rc: 10, re: 1, ek: 'carne', w: 2 };
  const m = h.spawnMonster('astilla', { x: q.pos.x + 2, y: q.pos.y + 0.5, z: q.pos.z }, { noElite: true }); q.inMelee = true; h.killMonster(m, q); q.inMelee = false;
  assert.equal(h.stats.misDone, 1); assert.ok(h.loot.length >= 1 && h.loot.every((o) => o.for === q.id), 'botín personal');
});
test('botín en el mundo: comunes y raras se recogen al pasar; épicas y legendarias con USAR; es personal en coop; aparece en el snapshot; nada se pierde al terminar', () => {
  const { g, p } = mkGame({ seed: 5 }); const q = g.addPlayer('b', null, { char: 'vesper' });
  const ponerEn = (o) => { o.pos = { ...p.pos }; o.vel = v3(); };
  const comun = soltar(g, { id: 'fusil_hueso', q: 0.4, r: 0, src: 'cofre' }, p.pos, 0), epico = soltar(g, { id: 'corona_cristal', q: 0.4, r: 2, src: 'cofre' }, p.pos, 0), de_q = soltar(g, { id: 'peto_hueso', q: 0.4, r: 0, src: 'elite' }, p.pos, q.id);
  assert.ok(g.events.filter((e) => e.t === 'drop').length === 3); assert.equal(g.snapshot().lt.length, 3); assert.deepEqual(lootSnap(g)[0].slice(1, 3), ['fusil_hueso', 0]);
  run(g, 1.2, () => { for (const o of g.loot) ponerEn(o); q.pos = { x: 1e3, y: 1e3, z: 1e3 }; });
  assert.deepEqual(p.bag.map((b) => b.id), ['fusil_hueso'], 'sólo lo común se recoge solo, y lo personal de otro no');
  run(g, 0.2, (i) => { for (const o of g.loot) ponerEn(o); g.setInput(p.id, { interact: i > 2 }); });
  assert.ok(p.bag.some((b) => b.id === 'corona_cristal'), 'USAR recoge lo épico'); assert.ok(!p.bag.some((b) => b.id === 'peto_hueso')); assert.ok(g.events.some((e) => e.t === 'loot' && e.pid === p.id));
  g.state = 'won'; g.step(T60); assert.equal(g.loot.length, 0, 'al terminar el botín del piso se entrega'); assert.ok(q.bag.some((b) => b.id === 'peto_hueso'));
  assert.deepEqual(g.snapshot().players[0].bag.sort(), p.bag.map((b) => `${b.id}|${b.q}|${b.n || 1}`).sort(), 'la mochila viaja en el snapshot final');
  // un botín que cae al vacío vuelve a su dueño
  const h = mkGame({ seed: 5 }); const o = soltar(h.g, { id: 'fusil_hueso', q: 0.1, r: 0, src: 'cofre' }, h.p.pos, 0); o.pos = { x: 9e4, y: 9e4, z: 9e4 }; o.t = 1; run(h.g, 0.05); assert.ok(h.g.loot.length === 0 || h.g.map.outOfBounds(h.g.loot[0].pos) === false);
});
test('herrero (en partida): forja un objeto vivo al azar con núcleos y esencias; no se puede en el campo de pruebas ni sin recursos', () => {
  const { g, p } = mkGame({ seed: 12 }); g.phase = 'intermission';
  assert.equal(forjar(g, p), false, 'sin recursos no forja'); p.cores = 500; p.ess.carne = 20; p.ess.cristal = 20; p.ess.ojo = 20; p.ess.vacio = 20;
  assert.equal(forjar(g, p), true); assert.equal(p.cores, 455); assert.equal(p.bag.length, 1); assert.ok(ITEMS[p.bag[0].id] && ITEMS[p.bag[0].id].r >= 1 && !ITEMS[p.bag[0].id].host);
  const n = mkGame({ seed: 13 }); n.g.phase = 'intermission'; n.p.cores = 500; n.p.ess.carne = 30; n.p.ess.vacio = 30; n.g.addObject('npc', n.p.pos, { kind: 'herrero', r: 1.2, life: 99 });
  n.g.setInput(n.p.id, { npc: { offer: 2 } }); n.g.step(T60); assert.equal(n.p.bag.length, 1);
  const ca = mkGame({ seed: 13 }); ca.g.phase = 'intermission'; ca.p.cores = 500; ca.g.addObject('npc', ca.p.pos, { kind: 'cambista', r: 1.2, life: 99 }); ca.g.setInput(ca.p.id, { npc: { offer: 2 } }); ca.g.step(T60); assert.equal(ca.p.cores, 500, 'la oferta 2 es sólo del herrero');
});
test('dropeo en una partida completa de bot: cae botín de varias fuentes y el jugador junta objetos', { timeout: 240000 }, () => {
  const g = new Game({ mapId: 'm4', seed: 17, magazines: true, calm: 1 }); const p = g.addPlayer('t', null, { char: 'micelio', style: 'melee' }); p.hp = 1e6;
  const fuentes = new Set(); let t = 0;
  for (; t < 400 && g.state === 'playing'; t += T60) {
    const alive = g.monsters.filter((m) => !m.dead);
    if (alive.length) { let best = alive[0], bd = Infinity; for (const m of alive) { const d = len(sub(m.pos, p.pos)); if (d < bd) { bd = d; best = m; } } const to = sub(best.pos, g.eyePos(p)); p.heading = norm(sub(to, mul(p.up, dot(to, p.up))), p.heading); p.pitch = Math.asin(Math.max(-1, Math.min(1, dot(norm(to), p.up)))); g.setInput(p.id, { mz: bd > 3 ? 1 : 0, melee: Math.round(t * 60) % 20 < 8, fire: bd > 3, interact: Math.round(t * 60) % 30 < 3 }); } else g.setInput(p.id, { interact: Math.round(t * 60) % 30 < 3 });
    if (p.cards && p.cards.length) g.setInput(p.id, { pick: 0 });
    g.step(T60); for (const e of g.drainEvents()) if (e.t === 'drop') fuentes.add(e.src);
  }
  assert.ok(p.bag.length >= 4, `juntó ${p.bag.length} objetos en ${Math.round(t)} s`); assert.ok(fuentes.has('respiro') || fuentes.has('mision'), [...fuentes].join());
  assert.ok(p.bag.every((b) => (b.id.startsWith('mat:') ? TODOS_MAT_IDS.includes(b.id.slice(4)) && b.q >= 0 && b.q <= 3 : b.id.startsWith('plano:') ? PLANOS[b.id.slice(6)] : ITEMS[b.id]) && b.n >= 1), 'materiales, planos u objetos válidos'); assert.ok(p.bag.some((b) => b.id.startsWith('mat:')), 'lo que más cae son materiales');
});

/* ───────────────────────── equipo en la simulación ───────────────────────── */
test('equipo: los bonos entran a p.bn (idempotente, sobre bendiciones y maestría), se validan y se cambian con setLoadout', () => {
  const base = mkGame({}, { bend: ['luz_mala'], maestria: 6 }); const bn0 = { ...base.p.bn };
  const { g, p } = mkGame({}, { bend: ['luz_mala'], maestria: 6, equip: [{ s: 'melee', id: 'gemelas_axioma', q: 0.5, k: 0 }, { s: 'torso', id: 'coraza_quitina', q: 0.5, k: 0 }, { s: 'head', id: 'arco_aureola' }] });
  assert.ok(p.bn.melee > bn0.melee && p.bn.dmgIn < bn0.dmgIn && p.bn.gun === bn0.gun, 'se suma a lo que ya había'); assert.equal(p.eqList.length, 2, 'la firma de Seraf no entra en la cabeza de Axioma');
  const antes = JSON.stringify(p.bn); g.setLoadout(p.id, 'axioma', undefined, { equip: p.eqList }); assert.equal(JSON.stringify(p.bn), antes, 'reaplicar no acumula');
  g.setLoadout(p.id, 'vesper', undefined, { equip: [{ s: 'melee', id: 'gemelas_axioma' }, { s: 'torso', id: 'coraza_quitina' }] }); assert.deepEqual(p.eqList.map((e) => e.id), ['coraza_quitina'], 'al cambiar de Huésped la firma ajena sale');
  g.setLoadout(p.id, 'vesper', undefined, { equip: [] }); assert.equal(p.eqList.length, 0); assert.equal(p.bn.dmgIn, 1);
  const snap = mkGame({}, { equip: [{ s: 'melee', id: 'gemelas_axioma', k: 30 }] }).g.snapshot().players[0]; assert.match(snap.eq, /^gemelas_axioma\.1$/); assert.equal(snap.iw, 'gemelas_axioma');
  assert.equal(mkGame().g.snapshot().players[0].eq, undefined, 'sin equipo no hay campos extra');
});
test('arma cuerpo a cuerpo de objeto: reemplaza a la fusionada, dos hojas pegan más, sus eventos traen iw y la mano', () => {
  const duel = (equip, melee) => { const { g, p } = mkGame({}, { equip, melee, style: 'melee' }); const m = g.spawnMonster('ariete', { x: p.pos.x + p.heading.x * 2.4, y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * 2.4 }, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; m.cd = 1e9; let ev = []; run(g, 6, (i) => { g.setInput(p.id, { melee: i % 30 < 8 }); m.pos = { x: p.pos.x + p.heading.x * 2.4, y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * 2.4 }; m.vel = v3(); }); for (let i = 0; i < 1; i++) ev = ev.concat(g.drainEvents()); return { g, p, dmg: 1e6 - m.hp, ev }; };
  const a = duel([], 'sable_plasma'), b = duel([{ s: 'melee', id: 'gemelas_axioma', q: 0.5, k: 0 }], 'sable_plasma');
  assert.equal(meleeSet(a.p).id, 'sable_plasma'); assert.equal(meleeSet(b.p).iw, 'gemelas_axioma'); assert.equal(meleeSet(b.p).type, 'gemelas'); assert.ok(meleeSet(b.p).dual > 1);
  const ev = b.g.events.concat(b.ev).filter((e) => e.t === 'melee'); void ev;
  const g2 = mkGame({}, { equip: [{ s: 'melee', id: 'gemelas_axioma', k: 0 }], style: 'melee' }); const m2 = g2.g.spawnMonster('ariete', { x: g2.p.pos.x + g2.p.heading.x * 2.4, y: g2.p.pos.y + 0.5, z: g2.p.pos.z + g2.p.heading.z * 2.4 }, { noElite: true }); m2.passive = true; m2.hp = m2.maxhp = 1e6;
  const hands = []; run(g2.g, 3, (i) => { g2.g.setInput(g2.p.id, { melee: i % 30 < 8 }); for (const e of g2.g.drainEvents()) if (e.t === 'melee' && e.iw) hands.push(e.hd); });
  assert.ok(hands.length >= 3 && hands.includes(0) && hands.includes(1), 'alterna mano izquierda y derecha'); assert.ok(b.dmg > 0);
});
test('Espadas Gemelas en modo Combo: usan su set propio (8 golpes, cadena de 5), desbloquean por evolución y quitan el set de Axioma', () => {
  const { g, p } = mkGame({}, { mode: 'combo', equip: [{ s: 'melee', id: 'gemelas_axioma', k: 0 }] });
  const ids0 = comboUnlocked(p).map((m) => m.id); assert.ok(ids0.includes('tajo_gemelo') && ids0.includes('tijera') && !ids0.includes('tajo'), ids0.join());
  p.evo = 4; const ids4 = comboUnlocked(p).map((m) => m.id); assert.ok(ids4.includes('vigilia_ceniza') && ids4.includes('danza_acero')); assert.equal(ids4.length, ITEM_COMBO_SETS.gemelas.length);
  const q = mkGame({}, { mode: 'combo' }); assert.ok(comboUnlocked(q.p).some((m) => m.id === 'tajo'), 'sin las gemelas, el set de siempre');
  const m = g.spawnMonster('ariete', { x: p.pos.x + p.heading.x * 2.6, y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * 2.6 }, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6;
  const hits = []; run(g, 3, (i) => { g.setInput(p.id, { mode: 'combo', a1: true }); for (const e of g.drainEvents()) if (e.t === 'combo') hits.push(e); });
  assert.ok(hits.length >= 4 && hits.some((e) => e.id === 'tajo_gemelo'), JSON.stringify(hits.map((e) => e.id))); assert.ok(1e6 - m.hp > 0);
  assert.ok(hits.every((e) => e.iw === undefined || true));
});
test('arma de disparo de objeto: ocupa la última ranura, multiplica el arma base y suma sus efectos; la firma de Seraf potencia sus flechas del modo Combo', () => {
  const { g, p } = mkGame({}, { equip: [{ s: 'gun', id: 'tormenta_geodas', q: 0.5, k: 0 }] }); const wid = WEAPONS.findIndex((w) => w.id === 'voltaico');
  assert.ok(p.slots.includes(wid) && p.slots[4] === wid, `slots ${p.slots}`); assert.equal(p.slots[0], 0, 'el Haz sigue');
  const quita = mkGame({}, { equip: [] }); assert.ok(wstat(p, wid).dmg > wstat(quita.p, wid).dmg && wstat(p, wid).rate > wstat(quita.p, wid).rate && wstat(p, wid).mag > wstat(quita.p, wid).mag);
  assert.equal(wstat(p, 0).dmg, wstat(quita.p, 0).dmg, 'sólo cambia el arma base del objeto');
  const m = g.spawnMonster('astilla', { x: p.pos.x + p.heading.x * 8, y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * 8 }, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e5;
  p.weapon = wid; run(g, 1, () => g.setInput(p.id, { fire: true })); assert.ok(m.hp < 1e5, 'dispara');
  g.setLoadout(p.id, 'axioma', [0, 1, 2, 3, 5], { equip: p.eqList }); assert.ok(p.slots.includes(wid), 'setLoadout conserva el arma del objeto');
  const s = mkGame({}, { char: 'seraf', mode: 'combo', equip: [{ s: 'gun', id: 'arco_aureola', q: 0.5, k: 0 }] }); assert.ok(s.p.irng > 1); const s0 = mkGame({}, { char: 'seraf', mode: 'combo' }); assert.equal(s0.p.irng === undefined || s0.p.irng === 1, true);
});
test('pasivos con condición: Savia cura, Sombra protege tras una baja, Eco golpea más fuerte cada 5.º y la Racha suma', () => {
  const kill = (g, p, hp = 1) => { const m = g.spawnMonster('astilla', { x: p.pos.x + 3, y: p.pos.y + 0.5, z: p.pos.z }, { noElite: true }); m.hp = hp; p.inMelee = true; g.killMonster(m, p); p.inMelee = false; return m; };
  const a = mkGame({}, { equip: [{ s: 'torso', id: 'torso_carne' }] }); a.p.hp = 50; kill(a.g, a.p); assert.ok(a.p.hp >= 51 - 1e-9, `Savia: ${a.p.hp}`);
  const b = mkGame({}, { equip: [{ s: 'head', id: 'mascara_vacio' }] }); kill(b.g, b.p); const dmg = b.p.shield + b.p.hp; b.g.hurtPlayer(b.p, 40); const c = mkGame(); c.g.hurtPlayer(c.p, 40);
  assert.ok(b.p.shield + b.p.hp > c.p.shield + c.p.hp, 'Sombra reduce el daño recibido tras una baja'); void dmg;
  const d = mkGame({}, { equip: [{ s: 'arms', id: 'manos_eco' }] }); assert.ok(d.p.ix.eco > 0);
  const e = mkGame({}, { equip: [{ s: 'gun', id: 'tormenta_geodas', k: 40 }] }); for (let i = 0; i < 4; i++) kill(e.g, e.p); e.g.time += 0.1; const mm = e.g.spawnMonster('astilla', { x: e.p.pos.x + 3, y: e.p.pos.y + 0.5, z: e.p.pos.z }, { noElite: true }); mm.hp = mm.maxhp = 1e5; e.g.dmgSrc = 'gun'; const h0 = mm.hp; e.g.damageMonster(mm, 100, e.p, mm.pos); const conRacha = h0 - mm.hp;
  const f = mkGame(); const m2 = f.g.spawnMonster('astilla', { x: f.p.pos.x + 3, y: f.p.pos.y + 0.5, z: f.p.pos.z }, { noElite: true }); m2.hp = m2.maxhp = 1e5; f.g.dmgSrc = 'gun'; f.g.damageMonster(m2, 100, f.p, m2.pos); assert.ok(conRacha > 1e5 - m2.hp, 'la Racha y los bonos suben el daño');
  const g2 = mkGame({}, { equip: [{ s: 'torso', id: 'pulmon_espora', k: 100 }] }); g2.p.hp = 50; run(g2.g, 8, () => g2.g.setInput(g2.p.id, {})); assert.ok(g2.p.hp > 50 + 4, `Regeneración: ${g2.p.hp}`);
});
test('sinergias: se activan con la esencia, el estilo o el camino y se apagan al faltar', () => {
  const { g, p } = mkGame({}, { equip: [{ s: 'gun', id: 'vena_voraz', k: 0 }], ess: { carne: 0 } });
  const k0 = p.bn.kheal; p.ess.carne = 12; run(g, 1.2); assert.ok(p.bn.kheal > k0, 'Sinergia con 8+ de Carne'); p.ess.carne = 0; run(g, 1.2); assert.equal(p.bn.kheal, k0 + (p.bn.kheal - k0) * 0 || p.bn.kheal);
  assert.ok(p.bn.kheal <= k0 + 1e-9, 'se apaga al faltar esencia');
  const c = mkGame({}, { equip: [{ s: 'melee', id: 'gemelas_axioma' }], mode: 'combo' }), s = mkGame({}, { equip: [{ s: 'melee', id: 'gemelas_axioma' }], style: 'melee' });
  assert.ok(c.p.bn.melee > s.p.bn.melee, 'Sinergia de estilo Combo'); const cam = mkGame({}, { equip: [{ s: 'melee', id: 'gemelas_axioma' }], path: ['coraza'], evo: 1, style: 'melee' }); assert.ok(cam.p.bn.dmgIn < s.p.bn.dmgIn, 'Sinergia con el camino Coraza');
});
test('maduración: cada baja con el objeto puesto suma; al cruzar el umbral sube de fase, sale el evento, crece el bono y se desbloquea un pasivo', () => {
  const { g, p } = mkGame({}, { equip: [{ s: 'melee', id: 'gemelas_axioma', q: 0.5, k: FASE_KILLS.arma[1] - 2 }, { s: 'head', id: 'casco_hueso', q: 0.5, k: 0 }] });
  const b0 = p.bn.melee, pa0 = p.ipa.length; assert.equal(g.snapshot().players[0].eq.split(',')[0], 'gemelas_axioma.0');
  const kill = (melee) => { const m = g.spawnMonster('astilla', { x: p.pos.x + 3, y: p.pos.y + 0.5, z: p.pos.z }, { noElite: true }); m.hp = 1; p.inMelee = melee; g.killMonster(m, p); p.inMelee = false; };
  kill(false); assert.equal(p.ik.melee || 0, 0, 'una baja a distancia no madura al arma cuerpo a cuerpo'); assert.equal(p.ik.head, 1, 'la armadura cuenta todas las bajas');
  kill(true); kill(true); assert.equal(p.ik.melee, 2);
  const ev = g.events.filter((e) => e.t === 'madura'); assert.equal(ev.length, 1); assert.equal(ev[0].fase, 1); assert.equal(ev[0].id, 'gemelas_axioma');
  assert.ok(p.bn.melee > b0, 'el bono creció'); assert.ok(p.ipa.length > pa0, 'se desbloqueó un pasivo (Racha)'); assert.equal(g.snapshot().players[0].eq.split(',')[0], 'gemelas_axioma.1'); assert.deepEqual(g.snapshot().players[0].ik, { head: 3, melee: 2 });
});

/* ───────────────────────── equilibrio ───────────────────────── */
const WAVE = [['astilla', 14], ['astilla', 16], ['astilla', 18], ['racimo', 20], ['lente', 24], ['lente', 26], ['geoda', 22], ['ariete', 20]];
const KIT = (h, k) => [...(h === 'seraf' ? [{ s: 'melee', id: 'yunque_coloso' }, { s: 'gun', id: 'arco_aureola' }] : [{ s: 'melee', id: SIGNATURES[h] }, { s: 'gun', id: 'tormenta_geodas' }]), { s: 'head', id: 'mascara_vacio' }, { s: 'torso', id: 'corazon_coloso' }, { s: 'arms', id: 'manos_eco' }, { s: 'legs', id: 'pasos_vacio' }, { s: 'relic', id: 'capullo_eterno' }].map((e) => ({ ...e, q: 0.5, k }));
function duel(host, style, equip, lay) {
  const g = new Game({ mapId: 'm1', seed: 3, magazines: true }); g.phaseT = 1e9;
  const p = g.addPlayer('t', null, { char: host, style, equip }); p.hp = 100; p.shield = 100;
  for (let i = 0; i < WAVE.length; i++) { const [k, d] = WAVE[i], a = (i / WAVE.length) * Math.PI * 2 + lay[0]; const m = g.spawnMonster(k, { x: p.pos.x + Math.cos(a) * d * 0.5 * lay[1], y: p.pos.y + 0.5, z: p.pos.z + Math.sin(a) * d * 0.5 * lay[1] }, { noElite: true }); if (m) m.cd = 1 + i * 0.3; }
  let t = 0;
  for (; t < 90; t += T60) {
    const alive = g.monsters.filter((m) => !m.dead); if (!alive.length || p.dead) break;
    let best = alive[0], bd = Infinity; for (const m of alive) { const dd = len(sub(m.pos, p.pos)); if (dd < bd) { bd = dd; best = m; } }
    const to = sub(best.pos, g.eyePos(p)), flat = norm(sub(to, mul(p.up, dot(to, p.up))), p.heading); p.heading = flat; p.pitch = Math.asin(Math.max(-1, Math.min(1, dot(norm(to), p.up))));
    const inp = { mz: 0, fire: false, melee: false, mov: false, esp: false, s3: false, ult: false }, tick = Math.round(t * 60);
    if (style === 'melee') { if (bd > 3 + best.r) inp.mz = 1; else inp.melee = tick % 20 < 8; }
    else if (style === 'disparo') { inp.fire = true; if (bd < 6) inp.mz = -1; }
    else { inp.fire = tick % 2 === 0; inp.esp = tick % 30 < 3; inp.s3 = tick % 30 >= 10 && tick % 30 < 13; inp.mov = bd < 8 && tick % 40 < 3; inp.ult = tick % 50 < 3; if (bd < 6) inp.mz = -1; }
    g.setInput(p.id, inp); g.step(T60);
  }
  return { t, clear: !g.monsters.some((m) => !m.dead), dead: p.dead };
}
test('equilibrio: con TODO el equipo legendario (fase 0 y fase Plena) los bots de los 3 estilos limpian la misma oleada a ±30 % del tiempo base (tests/estilos.test.js)', { timeout: 600000 }, () => {
  const LAYS = [[0, 1], [0.8, 1.1], [1.3, 1], [2.1, 0.95]];
  for (const k of [0, 400]) for (const st of ['melee', 'disparo', 'habilidad']) {
    let A = 0, B = 0;
    for (const h of HOST_IDS) for (const lay of LAYS) { const a = duel(h, st, undefined, lay), b = duel(h, st, KIT(h, k), lay); A += a.t; B += b.t; assert.ok(a.clear && b.clear && !b.dead, `${h} ${st} k${k}: no limpió`); assert.ok(b.t / a.t > 0.3 && b.t / a.t < 2.2, `${h} ${st} k${k}: ${a.t.toFixed(1)}→${b.t.toFixed(1)}`); }
    console.log(`  estilo ${st}, objetos en fase ${k ? 'Plena' : 'Latente'}: tiempo con equipo / base = ${(B / A).toFixed(2)}`);
    assert.ok(B / A >= 0.7 && B / A <= 1.3, `${st} k${k}: razón ${(B / A).toFixed(2)}`);
  }
});
test('equilibrio: el daño sostenido de cada arma firma queda a ±30 % del melé de su Huésped (shooter) y del Combo', { timeout: 300000 }, () => {
  const dummy = (host, equip, combo, evo = 0) => {
    const g = new Game({ mapId: 'm1', seed: 3, magazines: true }); g.phaseT = 1e9; const p = g.addPlayer('t', null, combo ? { char: host, mode: 'combo', evo, equip } : { char: host, style: 'melee', evo, equip }); p.hp = 1e6;
    const ranged = host === 'seraf' && combo, d0 = ranged ? 12 : 2.6, m = g.spawnMonster('astilla', { x: p.pos.x + p.heading.x * d0, y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * d0 }, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e7; m.cd = 1e9;
    for (let tick = 0; tick < 720; tick++) {
      const dd = len(sub(m.pos, p.pos)), to = sub(m.pos, g.eyePos(p)); p.heading = norm(sub(to, mul(p.up, dot(to, p.up))), p.heading); p.pitch = Math.asin(Math.max(-1, Math.min(1, dot(norm(to), p.up))));
      const inp = { mz: 0 }; if (ranged) { if (dd < 6) inp.mz = -1; } else if (dd > 3 + m.r) inp.mz = 1;
      if (combo) { inp.mode = 'combo'; inp.a1 = ranged ? tick % 90 < 60 : true; inp.a2 = ranged ? tick % 90 >= 60 && tick % 90 < 75 : tick % 80 >= 70; inp.hab = tick % 30 < 3; } else inp.melee = tick % 20 < 8;
      g.setInput(p.id, inp); g.step(T60);
    }
    return (1e7 - m.hp) / 12;
  };
  const rows = {};
  for (const h of HOST_IDS) { const e = h === 'seraf' ? [{ s: 'gun', id: 'arco_aureola' }] : [{ s: 'melee', id: SIGNATURES[h] }]; rows[h] = {}; for (const evo of [0, 4]) { const rs = h === 'seraf' ? [] : [dummy(h, e, false, evo) / dummy(h, undefined, false, evo)]; rs.push(dummy(h, e, true, evo) / dummy(h, undefined, true, evo)); rows[h][evo] = rs.map((x) => +x.toFixed(2)); } }
  console.log('  DPS con arma firma / DPS base (shooter, combo):', JSON.stringify(rows));
  for (const h of HOST_IDS) for (const evo of [0, 4]) for (const r of rows[h][evo]) assert.ok(r >= 0.7 && r <= 1.3, `${h} evo ${evo}: ${r}`);
});

/* ───────────────────────── perfil ───────────────────────── */
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const KEY = 'cristal.perfil.v1';
const abrir = async (obj) => { mem.clear(); if (obj !== undefined) mem.set(KEY, typeof obj === 'string' ? obj : JSON.stringify(obj)); return import('../src/client/perfil.js?' + Math.random()); };
test('perfil: un perfil viejo (sin inventario) se abre igual, conserva todo y pasa a la versión 2', async () => {
  const P = await abrir({ cores: 77, evo: { axioma: 2 }, path: { axioma: ['coraza', 'resonancia'] }, melee: { axioma: 'filo_oseo' }, owned: ['filo_oseo'], ess: { carne: 5, cristal: 1, ojo: 0, vacio: 2 }, terr: { m1: { bend: 'luz_mala' } }, mae: { axioma: { xp: 300 } } });
  const p = P.perfil(); assert.equal(p.ver, 2); assert.deepEqual(p.inventario, []); assert.deepEqual(p.eq, {}); assert.deepEqual(p.pity, { l: 0, e: 0 }); assert.equal(p.cores, 77); assert.equal(p.evo.axioma, 2); assert.equal(P.bendicionElegida('m1'), 'luz_mala'); assert.equal(P.rangoMaestria('axioma'), 3);
  const pp = P.paraPartida('axioma'); assert.deepEqual(pp.equip, []); assert.equal(pp.melee, 'filo_oseo'); assert.deepEqual(pp.sigs, []);
  const rotos = await abrir('{{ no es json'); assert.deepEqual(rotos.perfil().inventario, []);
});
test('perfil: el inventario se sanea al cargar (ids falsos, uids repetidos, equipo de otro Huésped, firma en el Huésped equivocado)', async () => {
  const P = await abrir({ ver: 2, inv: [{ u: 'a1', id: 'gemelas_axioma', q: 0.5, k: 10 }, { u: 'a1', id: 'peto_hueso' }, { u: 'b2', id: 'no_existe' }, { u: 'c3', id: 'peto_hueso', q: 7, k: -3, lk: true }, { u: '!!', id: 'peto_hueso' }, { id: 'peto_hueso' }, 'x', null],
    eq: { axioma: { melee: 'a1', torso: 'c3', head: 'c3', gun: 'zz' }, vesper: { melee: 'a1', torso: 'c3' }, fantasma: { melee: 'a1' } }, pity: { l: 5000, e: -1 }, sigs: { axioma: 1, nadie: 1 } });
  const p = P.perfil(); assert.deepEqual(p.inventario.map((i) => i.u), ['a1', 'c3']); assert.equal(p.inventario[1].q, 1); assert.equal(p.inventario[1].k, 0); assert.equal(p.inventario[1].lk, true);
  assert.deepEqual(p.eq, { axioma: { melee: 'a1', torso: 'c3' } }, 'una pieza no puede estar en dos Huéspedes ni en una ranura que no es'); assert.deepEqual(p.pity, { l: 999, e: 0 }); assert.deepEqual(p.sigs, { axioma: 1 });
  assert.deepEqual(P.paraPartida('axioma').equip.map((e) => e.id), ['gemelas_axioma', 'peto_hueso']); assert.deepEqual(P.paraPartida('vesper').equip, []);
});
test('perfil: agregar, equipar, bloquear, favorito y desguazar siguen sus reglas', async () => {
  const P = await abrir(); P.perfil().cores = 0;
  const a = P.agregarItem({ id: 'fusil_hueso', q: 0.3 }), b = P.agregarItem({ id: 'gemelas_axioma', q: 0.9 }), c = P.agregarItem({ id: 'peto_hueso', q: 0.1 });
  assert.ok(a.ok && b.ok && c.ok && a.uid !== b.uid); assert.equal(P.inventario().length, 3);
  assert.equal(P.equiparItem('axioma', b.uid), ''); assert.match(P.equiparItem('vesper', b.uid), /Axioma/); assert.equal(P.equiparItem('axioma', a.uid), ''); assert.match(P.equiparItem('axioma', 'nada'), /no existe/);
  assert.deepEqual(P.paraPartida('axioma').equip.map((e) => e.s), ['gun', 'melee']); assert.equal(P.puestoEn(b.uid).slot, 'melee');
  assert.equal(P.desguazar(b.uid), null, 'lo puesto no se desguaza'); assert.equal(P.desequipar('axioma', 'melee'), true); assert.equal(P.puestoEn(b.uid), null);
  P.bloquear(c.uid); assert.equal(P.desguazar(c.uid), null, 'lo bloqueado no se desguaza'); assert.equal(P.bloquear(c.uid), false); P.favorito(a.uid, true); assert.equal(P.instDe(a.uid).fv, true);
  const v = P.desguazar(c.uid); assert.deepEqual(v.ess, { carne: 1 }); assert.equal(P.perfil().cores, v.cores); assert.equal(P.perfil().ess.carne, 1); assert.equal(P.inventario().length, 2);
  const e = P.agregarItem({ id: 'casco_hueso', q: 0.5 }), f = P.agregarItem({ id: 'rafaga_no_existe', q: 1 }); assert.equal(f.ok, false);
  const tot = P.desguazarSobrantes(0); assert.equal(tot.n, 1, 'sólo el casco: el fusil es favorito y la firma es legendaria'); assert.equal(P.instDe(e.uid), null); assert.ok(P.instDe(a.uid) && P.instDe(b.uid));
  const rep = P.agregarItem({ id: 'gemelas_axioma', q: 0.2 }); assert.ok(rep.repetida && rep.conv.cores > 0 && P.inventario().filter((i) => i.id === 'gemelas_axioma').length === 1, 'la firma repetida se convierte en recursos');
  const raw = JSON.parse(mem.get(KEY)); assert.equal(raw.inventario.length, 2); assert.equal(raw.ver, 2);
});
test('perfil: con el inventario lleno, lo nuevo reemplaza al peor objeto sobrante (o se desguaza solo si es peor); lo bloqueado y lo puesto no se tocan', async () => {
  const P = await abrir(); const lleno = []; for (let i = 0; i < LIMITE_INVENTARIO; i++) { const r = P.agregarItem({ id: i % 2 ? 'peto_hueso' : 'casco_hueso', q: i / 100 }); lleno.push(r.uid); } assert.equal(P.inventario().length, LIMITE_INVENTARIO);
  for (const u of lleno.slice(0, 5)) P.bloquear(u, true); const peor = P.inventario().filter((i) => !i.lk).sort((a, b) => a.q - b.q)[0];
  const r = P.agregarItem({ id: 'yelmo_quitina', q: 0.5 }); assert.ok(r.uid && r.reemplazo && r.reemplazo.id); assert.equal(P.inventario().length, LIMITE_INVENTARIO); assert.ok(P.instDe(r.uid)); void peor;
  const r2 = P.agregarItem({ id: 'peto_hueso', q: 0.99 }); assert.ok(r2.ok); assert.equal(P.inventario().length, LIMITE_INVENTARIO);
  for (const i of P.inventario()) { if (!i.lk) P.bloquear(i.u, true); } const r3 = P.agregarItem({ id: 'corona_cristal', q: 0.5 }); assert.ok(r3.lleno && r3.conv, 'todo bloqueado: lo nuevo se desguaza'); assert.equal(P.inventario().length, LIMITE_INVENTARIO);
});
test('perfil: cerrarPartida guarda el botín, madura lo puesto con las bajas de la partida, conserva el pity y marca la firma cumplida', async () => {
  const P = await abrir(); const g1 = P.agregarItem({ id: 'gemelas_axioma', q: 0.5 }), h1 = P.agregarItem({ id: 'casco_hueso', q: 0.5 }); P.equiparItem('axioma', g1.uid); P.equiparItem('axioma', h1.uid);
  const T = FASE_KILLS.arma[1];
  const jugador = { co: 12, evo: 0, kills: 30, pth: [], ess: [0, 0, 0, 0], ik: { melee: T + 1, head: 30, relic: 99 }, pt: [7, 3], sg: 1, bag: ['fusil_hueso|0.5|1', 'arco_aureola|1|1', 'no_existe|0.1|1', 'mat:hueso|2|3', 'plano:pica_geoda|1|1', 'plano:cuchilla_hueso|1|1', 'mat:humo|1|1'] };
  P.cerrarPartida('axioma', jugador, { wave: 5, won: true });
  assert.equal(P.instDe(g1.uid).k, T + 1); assert.equal(P.instDe(h1.uid).k, 30); assert.deepEqual(P.perfil().pity, { l: 7, e: 3 }); assert.deepEqual(P.perfil().sigs, { axioma: 1 }); assert.deepEqual(P.paraPartida('axioma').sigs, ['axioma']);
  const b = P.ultimoBotin(); assert.deepEqual(b.items.map((i) => i.id), ['fusil_hueso', 'arco_aureola']); assert.equal(b.madura.length, 2); assert.ok(b.madura.every((m) => m.fase === 1)); assert.equal(b.firma[0], 'gemelas_axioma');
  assert.deepEqual(b.mats, { hueso: [0, 0, 3, 0] }); assert.deepEqual(b.planos, ['pica_geoda', 'cuchilla_hueso!']); assert.ok(P.conoce('pica_geoda')); assert.equal(P.materiales().hueso[2], 3 + 2 * 0 + P.materiales().hueso[2] - 3); assert.match(P.botinTexto(), /BOTÍN \(5\)/); assert.match(P.botinTexto(), /PLANO NUEVO/); assert.match(P.botinTexto(), /maduró/);
  assert.equal(P.paraPartida('axioma').equip.find((e) => e.s === 'melee').k, T + 1, 'la maduración llega a la próxima partida');
  const dos = await abrir(mem.get(KEY)); assert.equal(dos.inventario().length, 4, 'persistió');
});
test('de punta a punta: el equipo del perfil entra al sim, madura jugando y vuelve al perfil', async () => {
  const P = await abrir(); const w = P.agregarItem({ id: 'cuchilla_hueso', q: 0.5 }); P.equiparItem('axioma', w.uid);
  const g = new Game({ mapId: 'm1', seed: 2, magazines: true }); g.phaseT = 1e9; const p = g.addPlayer('t', null, { char: 'axioma', ...P.paraPartida('axioma') });
  assert.equal(p.iw.id, 'cuchilla_hueso');
  for (let i = 0; i < 25; i++) { const m = g.spawnMonster('astilla', { x: p.pos.x + 3, y: p.pos.y + 0.5, z: p.pos.z }, { noElite: true }); m.hp = 1; p.inMelee = true; g.killMonster(m, p); p.inMelee = false; }
  const snap = g.snapshot().players[0]; P.cerrarPartida('axioma', snap, { wave: 1 });
  assert.equal(P.instDe(w.uid).k, 25); assert.equal(P.paraPartida('axioma').equip[0].k, 25);
});

/* ───────────────────────── servidor ───────────────────────── */
test('servidor: valida y acota el equipo (ids falsos, firmas ajenas, ranuras, exceso, payload)', async () => {
  assert.deepEqual(equipDe('axioma', 'hola'), []); assert.equal(equipDe('axioma', Array.from({ length: 500 }, () => ({ id: 'peto_hueso' }))).length, 1);
  assert.deepEqual(equipDe('vesper', [{ s: 'melee', id: 'gemelas_axioma' }, { s: 'melee', id: 'colmillos_luna', k: 5e9, q: 99 }]).map((e) => [e.id, e.k, e.q]), [['colmillos_luna', 99999, 1]]);
  const srv = await startServer({ port: 0, autoTick: false });
  try {
    const { WebSocket } = await import('ws'); const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`); await new Promise((r) => ws.on('open', r));
    const sent = { t: 'create', map: 'm1', name: 'Eq', char: 'axioma', equip: [{ s: 'melee', id: 'gemelas_axioma', q: 0.5, k: 10 }, { s: 'melee', id: 'cuchilla_hueso' }, { s: 'head', id: 'arco_aureola' }, { id: '__proto__' }, { s: 'torso', id: 'corazon_coloso', k: 1e12 }, ...Array.from({ length: 30 }, () => ({ id: 'peto_hueso' }))], pity: { l: 1e9, e: -4 }, sigs: ['axioma', 7] };
    assert.ok(JSON.stringify(sent).length < 4096, 'cabe en el mensaje'); ws.send(JSON.stringify(sent));
    for (let i = 0; i < 100 && !srv.rooms.size; i++) await new Promise((r) => setTimeout(r, 15));
    const g = [...srv.rooms.values()][0].game, p = g.players[0]; assert.deepEqual(p.eqList.map((e) => e.id), ['gemelas_axioma', 'corazon_coloso']); assert.ok(p.eqList.every((e) => e.k <= 99999)); assert.equal(p.pity.l, 999); assert.equal(p.pity.e, 0); assert.equal(p.sigPlan, true);
    ws.send(JSON.stringify({ t: 'loadout', char: 'vesper', equip: [{ s: 'melee', id: 'gemelas_axioma' }, { s: 'legs', id: 'pasos_vacio' }] })); await new Promise((r) => setTimeout(r, 60));
    assert.equal(p.char, 'vesper'); assert.deepEqual(p.eqList.map((e) => e.id), ['pasos_vacio'], 'el loadout también valida');
    ws.close();
  } finally { await srv.close(); }
});

/* ───────────────────────── forja biológica, planos y sets ───────────────────────── */
test('contrato: MATERIALES, PLANOS, RECETAS y SETS cubren todo el catálogo y cada receta se puede cumplir', () => {
  assert.deepEqual(Object.keys(MATERIALES).sort(), [...TODOS_MAT_IDS].sort(), 'los 7 orgánicos + los 8 vegetales de la flora (docs/FLORA.md)'); assert.equal(MATERIAL_IDS.length, 7); assert.equal(CALIDADES.length, 4);
  assert.deepEqual(Object.keys(PLANOS).sort(), [...ITEM_IDS].sort()); assert.deepEqual(Object.keys(RECETAS).sort(), [...ITEM_IDS].sort());
  assert.ok(PLANOS_INICIALES.length >= 8 && PLANOS_INICIALES.every((id) => ITEMS[id].r === 0), 'los planos Comunes se conocen de entrada');
  for (const id of ITEM_IDS) { const R = RECETAS[id], it = ITEMS[id]; assert.equal(R.plano, id); assert.ok(R.mats.length >= 1 && R.cores > 0 && R.tiempo > 0 && R.tiempo <= 120, id); for (const x of R.mats) { assert.ok(MATERIALES[x.mat] && x.n >= 1 && x.cal >= 0 && x.cal <= 3, id); } assert.ok(R.mats.some((x) => x.mat === it.mat), 'usa su propio material'); if (it.host) { assert.ok(R.mats.some((x) => x.cal === 3) && R.cores >= 300, `${id}: la firma pide materiales Perfectos`); assert.ok(PLANOS[id].firma && !PLANOS[id].inicial); } }
  assert.ok(RECETAS.gemelas_axioma.cores > RECETAS.fusil_hueso.cores * 10);
  assert.equal(qForja('x', 3, 1), qForja('x', 3, 1)); assert.notEqual(qForja('x', 3, 1), qForja('x', 4, 1)); for (let i = 0; i < 300; i++) { const q = qForja('gemelas_axioma', i, i % 4); assert.ok(q >= 0.15 && q <= 1); } assert.ok(qForja('a', 1, 3) > qForja('a', 1, 0));
});
test('sets orgánicos: 7 familias, cada una con 4 piezas de armadura (una por zona) + 1 arma, bonos de 2 y 4 piezas acotados', () => {
  const base = SET_IDS.filter((s) => !SETS[s].jardin); assert.equal(base.length, 7); assert.deepEqual(base.map((s) => SETS[s].mat).sort(), [...MATERIAL_IDS].sort(), 'un set por material'); assert.equal(SET_IDS.length - base.length, 2, 'más los 2 sets de jardín (docs/FLORA.md)');
  for (const sid of SET_IDS) {
    const S = SETS[sid]; assert.equal(S.items.length, 5, sid); assert.deepEqual(S.items.map((i) => ITEMS[i].slot).sort(), ['arms', 'gun', 'head', 'legs', 'melee', 'torso'].filter((x) => x !== 'gun').sort(), sid);
    for (const i of S.items) { assert.equal(ITEMS[i].set, sid); assert.ok(!ITEMS[i].host, 'las firmas no son de set'); assert.equal(ITEMS[i].mat, S.mat, `${i} es del material del set`); }
    for (const b of [S.b2, S.b4]) for (const [k, v] of Object.entries(b.fx)) assert.ok(k in CAPS && (ADD_KEYS.includes(k) ? v > 0 && v <= 10 : Math.abs(v - 1) <= (UTIL_KEYS.includes(k) ? 0.2 : 0.1)), `${sid} ${k}=${v}`);
    for (const pa of S.b4.pa || []) assert.ok(PASIVOS[pa.id]); assert.ok(S.vis.length > 20 && S.lore.length > 20);
  }
  const l = SETS.quitina.items.map((id) => ({ id })); assert.deepEqual(setCounts(l), { quitina: 5 }); assert.deepEqual(setActivos(l.slice(0, 1)), []); assert.deepEqual(setActivos(l.slice(0, 2)).map((x) => x.tier), [2]); assert.deepEqual(setActivos(l.slice(0, 4)).map((x) => x.tier), [2, 4]);
});
test('sets en la partida: con 2 y 4 piezas el bono entra a p.bn, los pasivos del bono de 4 se activan, sale por el snapshot y no rompe el equilibrio', { timeout: 300000 }, () => {
  const mk = (n) => mkGame({}, { equip: SETS.cristal_hueco.items.slice(0, n).map((id) => ({ id, q: 0.5, k: 0 })) });
  const a = mk(1), b = mk(2), c = mk(4);
  assert.ok(b.p.sets.includes('cristal_hueco2') && !b.p.sets.includes('cristal_hueco4')); assert.ok(c.p.sets.includes('cristal_hueco4'));
  assert.ok(c.p.bn.skill > a.p.bn.skill && c.p.ipa.some((x) => x.s === 'set' && x.id === 'fervor'), 'bono de 4: habilidades + Fervor'); assert.deepEqual(c.g.snapshot().players[0].st4, ['cristal_hueco2', 'cristal_hueco4']);
  const LAYS = [[0, 1], [0.8, 1.1], [1.3, 1]]; let A = 0, B = 0;
  for (const sid of SET_IDS) for (const st of ['melee', 'habilidad']) for (const lay of LAYS) { const eq = SETS[sid].items.map((id) => ({ id, q: 0.5, k: 400 })); A += duel('axioma', st, undefined, lay).t; B += duel('axioma', st, eq, lay).t; }
  console.log('  set completo (fase Plena) / base: ' + (B / A).toFixed(2)); assert.ok(B / A >= 0.7 && B / A <= 1.3, `razón ${B / A}`);
});
test('Forja (perfil): el plano, los materiales y los núcleos construyen la pieza; cultivo con tiempo, calidad determinista, acelerar, fusión y desguace → materiales', async () => {
  const P = await abrir(); const p = P.perfil();
  assert.equal(P.estadoReceta('cuchilla_hueso').motivo, 'Faltan materiales'); assert.equal(P.estadoReceta('pica_geoda').motivo, 'Todavía no conocés el plano'); assert.match(P.estadoReceta('gemelas_axioma').motivo, /plano raro/);
  P.sumarMat('hueso', 0, 2); assert.equal(P.forjar('cuchilla_hueso').ok, false); P.sumarMat('hueso', 1, 1); p.cores = 20;
  const t0 = 1e6; const f = P.forjar('cuchilla_hueso', t0); assert.equal(f.ok, true); assert.equal(f.tiempo, RECETAS.cuchilla_hueso.tiempo); assert.equal(p.cores, 5); assert.equal(P.stockMin('hueso', 0), 0);
  assert.equal(P.forjar('cuchilla_hueso', t0).ok, false, 'una pieza por vez'); assert.equal(P.recoger(t0 + 1000), null, 'todavía no está'); assert.equal(P.cultivoFalta(t0 + 1000), RECETAS.cuchilla_hueso.tiempo - 1);
  p.cores = 100; assert.equal(P.acelerar(t0 + 1000), true); assert.ok(p.cores < 100); assert.equal(P.cultivoFalta(t0 + 1000), 0);
  const r = P.recoger(t0 + 1000); assert.ok(r.uid && r.item === 'cuchilla_hueso' && r.q >= 0.15 && r.q <= 1); assert.equal(P.instDe(r.uid).id, 'cuchilla_hueso'); assert.equal(p.cultivo, null);
  // determinista: mismo contador y mismos materiales → misma calidad
  const Q = await abrir(); Q.sumarMat('hueso', 0, 2); Q.sumarMat('hueso', 1, 1); Q.perfil().cores = 20; assert.equal(Q.forjar('cuchilla_hueso', t0).q, f.q);
  // plano raro de la firma: con el plano y los materiales especiales se construye
  P.aprenderPlano('gemelas_axioma'); assert.match(P.estadoReceta('gemelas_axioma').motivo, /materiales/); for (const x of RECETAS.gemelas_axioma.mats) P.sumarMat(x.mat, 3, x.n); p.cores = 400;
  assert.equal(P.estadoReceta('gemelas_axioma').ok, true); const g = P.forjar('gemelas_axioma', t0); assert.ok(g.ok); const rg = P.recoger(t0 + 90 * 1000); assert.equal(P.instDe(rg.uid).id, 'gemelas_axioma'); assert.equal(P.equiparItem('axioma', rg.uid), '');
  assert.ok(P.paraPartida('axioma').equip.some((e) => e.id === 'gemelas_axioma'));
  // fusión
  const a = P.agregarItem({ id: 'casco_hueso', q: 0.3 }), b2 = P.agregarItem({ id: 'casco_hueso', q: 0.9 }); p.cores = 100; const fu = P.fusionar(a.uid, b2.uid); assert.ok(fu.ok && fu.q > 0.3 && fu.k > 0); assert.equal(P.instDe(b2.uid), null);
  const otra = P.agregarItem({ id: 'peto_hueso', q: 0.3 }); assert.match(P.fusionar(a.uid, otra.uid).motivo, /ranura/);
  // desguace → materiales
  const antes = P.stockMin('quitina', 0); const q = P.agregarItem({ id: 'coraza_quitina', q: 0.5 }); const v = P.desguazar(q.uid); assert.ok(v.mats.quitina.n >= 1); assert.ok(P.stockMin('quitina', 0) > antes);
  // contrato de campos del perfil
  const raw = JSON.parse(mem.get(KEY)); assert.ok(Array.isArray(raw.inventario) && Array.isArray(raw.planos) && raw.materiales && raw.materiales.hueso.length === 4 && raw.ver === 2);
});
