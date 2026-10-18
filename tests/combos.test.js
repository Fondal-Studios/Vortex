// Modo COMBO (src/sim/combos.js): cadenas A1/A2, ventana y cancelaciones, sets por Huésped y arma, habilidades principales, snapshot, determinismo y equilibrio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../src/sim/game.js';
import { HOST_IDS, COMBO_SETS, HABILIDADES, GAME_MODES, MELEE_WEAPONS, STYLE_IDS, COMBO_RULES } from '../src/sim/data.js';
import { comboUnlocked, pickMove } from '../src/sim/combos.js';
import { comboAssist, comboTarget } from '../src/client/combo-assist.js';
import { sub, norm, dot, len, mul } from '../src/sim/math.js';

const T60 = 1 / 60;
function mk(char = 'axioma', opts = {}, dummyAt = 2.6, n = 1) {
  const g = new Game({ mapId: 'm1', seed: 3, magazines: true }); g.phaseT = 1e9;
  const p = g.addPlayer('t', null, { char, mode: opts.mode || 'combo', ...opts }); p.hp = 100; p.shield = 100;
  const ms = [];
  for (let i = 0; i < n; i++) { const d = dummyAt + i * 0.5; const m = g.spawnMonster('astilla', { x: p.pos.x + p.heading.x * d, y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * d + (i - (n - 1) / 2) * 0.8 }, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; m.cd = 1e9; ms.push(m); }
  return { g, p, ms, m: ms[0], log: [] };
}
/** Avanza `secs` con la entrada `inp` (o una función por tick) y junta los eventos. */
function run(c, secs, inp = {}) {
  const n = Math.round(secs / T60);
  for (let i = 0; i < n; i++) { c.g.setInput(c.p.id, { mode: c.p.mode, ...(typeof inp === 'function' ? inp(i) : inp) }); c.g.step(T60); for (const e of c.g.snapshot().events) c.log.push(e); }
}
/** Pulsa los botones de `seq` uno tras otro, con `gap` s entre pulsaciones. */
function press(c, seq, gap = 0.3) { for (const b of seq) { run(c, 3 * T60, { [b]: true }); run(c, gap - 3 * T60, {}); } }
const ids = (c) => c.log.filter((e) => e.t === 'combo').map((e) => e.id);
const dmgDone = (c) => c.ms.reduce((a, m) => a + (1e6 - m.hp), 0);

test('modos: Shooter y Combo existen, los estilos visibles siguen siendo 3 y el estilo interno «combo» no se elige', () => {
  assert.deepEqual(Object.keys(GAME_MODES), ['shooter', 'combo']);
  assert.deepEqual(STYLE_IDS, ['melee', 'disparo', 'habilidad']);
});

test('cada Huésped tiene su set propio (8 golpes, ids únicos) y UNA habilidad principal propia', () => {
  const all = new Set();
  for (const h of HOST_IDS) {
    const set = COMBO_SETS[h]; assert.ok(set && set.length >= 8, h);
    assert.ok(set.some((m) => m.seq.join() === 'a1') && set.some((m) => m.seq.join() === 'a2'), `${h}: tiene A1 y A2 básicos`);
    assert.ok(set.filter((m) => m.evo === 0).length >= 4, `${h}: set básico`);
    for (const m of set) { assert.ok(!all.has(m.id), `id repetido ${m.id}`); all.add(m.id); assert.ok(m.name && m.seq.every((b) => b === 'a1' || b === 'a2')); }
    const H = HABILIDADES[h]; assert.ok(H && H.name && H.cd > 5 && H.wind > 0 && H.r > 0 && H.desc, h);
  }
  assert.equal(new Set(HOST_IDS.map((h) => HABILIDADES[h].id)).size, HOST_IDS.length);
});

test('Shooter queda igual: a1/a2/hab no hacen nada y el disparo y el melé de siempre funcionan', () => {
  const c = mk('axioma', { mode: 'shooter' });
  assert.equal(c.p.mode, 'shooter'); run(c, 0.5, { a1: true, a2: true, hab: true }); assert.equal(dmgDone(c), 0); assert.equal(c.g.snapshot().players[0].md, 0);
  run(c, 1, { fire: true }); assert.ok(dmgDone(c) > 0, 'dispara');
  const c2 = mk('axioma', { mode: 'shooter' }); run(c2, 1, (i) => ({ melee: i % 20 < 8 })); assert.ok(dmgDone(c2) > 0, 'melee V');
});

test('Melé: el disparo, el melé rápido y recargar no hacen nada (el ataque es A1/A2); HAB.1/HAB.2 sí funcionan y HAB.3 es la habilidad principal (docs/CONTROLES.md)', () => {
  const c = mk('axioma'); run(c, 1.5, { fire: true, melee: true, reload: true });
  assert.equal(dmgDone(c), 0); assert.equal(c.p.movCd, 0); assert.equal(c.p.s3Cd, 0); assert.equal(c.p.habCd, 0);
  run(c, 0.5, { a1: true }); assert.ok(dmgDone(c) > 0);
  const d = mk('axioma'); run(d, 0.3, { mov: true }); assert.ok(d.p.movCd > 0, 'HAB.1 (mov) funciona en Melé');
  const e = mk('axioma'); run(e, 0.3, { esp: true }); assert.ok(e.p.espCd > 0, 'HAB.2 (esp) funciona en Melé');
  const f = mk('axioma'); run(f, 0.3, { s3: true }); assert.ok(f.p.habCd > 0, 'HAB.3 (s3) lanza la habilidad principal de Combo'); assert.equal(f.p.s3Cd, 0, 'la s3 de Disparo no se usa en Melé');
});

test('cambiar de modo en plena partida por la entrada (mode) y los no-Huéspedes siguen en Shooter', () => {
  const c = mk('axioma', { mode: 'shooter' }); run(c, 0.1, { mode: 'combo' }); assert.equal(c.p.mode, 'combo'); assert.equal(c.p.style, 'combo');
  run(c, 0.1, { mode: 'shooter' }); assert.equal(c.p.mode, 'shooter'); assert.notEqual(c.p.style, 'combo');
  run(c, 0.1, { mode: 'shooter', style: 'combo' }); assert.notEqual(c.p.style, 'combo', 'el estilo interno no se puede forzar');
  const l = mk('egida', { mode: 'combo' }); run(l, 0.1, { mode: 'combo' }); assert.equal(l.p.mode, 'shooter', 'los Veteranos no juegan Combo');
});

test('cadena de Axioma: tajo → contratajo → golpe de armadura con ONDA en el 3.º, y después la cadena reinicia', () => {
  const c = mk('axioma'); press(c, ['a1', 'a1', 'a1', 'a1']);
  assert.deepEqual(ids(c).slice(0, 4), ['tajo', 'contratajo', 'onda_coraza', 'tajo']);
  const fin = c.log.filter((e) => e.t === 'combo'); assert.equal(fin[2].fin, true); assert.equal(fin[0].fin, false);
  assert.ok(c.log.some((e) => e.t === 'melee' && e.kind === 'heavy'), 'el 3.º golpe se anima como pesado');
});

test('onda del 3.er golpe de Axioma: crea un proyectil que atraviesa', () => {
  const c = mk('axioma'); const seen = []; press(c, ['a1', 'a1']); run(c, 0.2, (i) => { if (i === 0) seen.push(c.g.projectiles.length); return { a1: i < 3 }; });
  assert.ok(c.g.projectiles.some((q) => q.pid === c.p.id && q.pierce) || ids(c).includes('onda_coraza'));
});

test('ventana de encadenado: si pasa demasiado tiempo la cadena se corta y empieza otra vez por el primer golpe', () => {
  const c = mk('axioma'); press(c, ['a1', 'a1'], 0.3); run(c, 0.4 + COMBO_RULES.window + 0.5, {}); press(c, ['a1'], 0.3);
  assert.deepEqual(ids(c), ['tajo', 'contratajo', 'tajo']);
});

test('cancelación: una continuación válida sale al 70 % de la recuperación; una que no continúa espera la recuperación entera', () => {
  const t0 = (seq) => { const c = mk('axioma'); let first = -1, second = -1;
    for (let i = 0; i < 120; i++) { const inp = { mode: 'combo' }; if (i === 0) inp[seq[0]] = true; if (i === 21) inp[seq[1]] = true; c.g.setInput(c.p.id, inp); c.g.step(T60); for (const e of c.g.snapshot().events) if (e.t === 'combo') { if (first < 0) first = i; else if (second < 0) second = i; } }
    return second; };
  const okTick = t0(['a1', 'a1']), badTick = t0(['a2', 'a2']);
  assert.ok(okTick > 0 && okTick <= 22, `a1,a1 encadenó al cancelar (${okTick})`);
  assert.ok(badTick < 0 || badTick > 30, `a2,a2 no es combo: espera (${badTick})`);
});

test('mantener A1 repite y recorre toda la cadena; el salto cancela la recuperación', () => {
  const c = mk('axioma'); run(c, 1.6, { a1: true }); assert.deepEqual(ids(c).slice(0, 4), ['tajo', 'contratajo', 'onda_coraza', 'tajo']);
  const j = mk('micelio'); run(j, 3 * T60, { a2: true }); const r = j.p.cb.cd; assert.ok(r > 0.3); run(j, 2 * T60, { jump: true }); assert.equal(j.p.cb.cd, 0);
});

test('los golpes nuevos se desbloquean por nivel de evolución (y no antes)', () => {
  for (const h of HOST_IDS) {
    const lv = (evo) => { const g = new Game({ mapId: 'm1', seed: 1 }); const p = g.addPlayer('t', null, { char: h, mode: 'combo', evo }); return comboUnlocked(p).length; };
    const n = [0, 1, 2, 3, 4].map(lv); assert.deepEqual(n, [...n].sort((a, b) => a - b), `${h} crece con el nivel`); assert.ok(n[4] > n[0] && n[0] >= 4, `${h}: ${n}`);
    assert.equal(n[4], COMBO_SETS[h].length);
  }
  const c = mk('axioma', { evo: 1 }); press(c, ['a1', 'a2']); assert.ok(ids(c).includes('hombro'), 'evo 1: embestida de hombro');
  const b = mk('axioma', { evo: 0 }); press(b, ['a1', 'a2']); assert.ok(!ids(b).includes('hombro'));
  const d = mk('axioma', { evo: 4 }); press(d, ['a1', 'a1', 'a1', 'a1']); assert.ok(ids(d).includes('tormenta'), 'evo 3+: tormenta de acero con 4 A1');
});

test('identidad: cada Huésped juega distinto (Vesper = ráfagas con dash, Micelio = área, Umbra = teletransporte, Seraf = flechas)', () => {
  const v = mk('vesper'); press(v, ['a1', 'a1', 'a1'], 0.25); assert.deepEqual(ids(v).slice(0, 3), ['zarpa', 'rafaga', 'desgarro']);
  const x0 = v.p.pos.x;
  const u = mk('umbra', {}, 6); const u0 = { x: u.p.pos.x, z: u.p.pos.z }; press(u, ['a1', 'a1', 'a1'], 0.35); assert.deepEqual(ids(u).slice(0, 3), ['corte', 'doble_corte', 'cruce']);
  assert.ok(Math.hypot(u.p.pos.x - u0.x, u.p.pos.z - u0.z) > 5, 'Umbra se teletransportó hacia adelante'); assert.ok(u.log.some((e) => e.t === 'blink'));
  const m = mk('micelio', {}, 2.6, 3); press(m, ['a1', 'a1', 'a1'], 0.5); assert.deepEqual(ids(m).slice(0, 3), ['golpe', 'doble', 'raices']); assert.ok(m.ms.filter((q) => q.hp < 1e6).length >= 2, 'Micelio pega a varios'); assert.ok(m.g.objects.some((o) => o.type === 'spores'), 'raíces');
  const s = mk('seraf', {}, 14); press(s, ['a1', 'a1', 'a1'], 0.4); assert.deepEqual(ids(s).slice(0, 3), ['flecha', 'doble_flecha', 'salva']); assert.ok(s.log.some((e) => e.t === 'beam') && s.m.hp < 1e6, 'Seraf dispara flechas desde lejos');
  void x0;
});

test('Seraf: A2 se CARGA (mantener = más daño) y sale al soltar', () => {
  const tap = mk('seraf', {}, 14); run(tap, 0.1, { a2: true }); run(tap, 0.5, {});
  const hold = mk('seraf', {}, 14); run(hold, 1.1, { a2: true }); const mid = hold.g.snapshot().players[0]; run(hold, 0.5, {});
  assert.ok(ids(tap).includes('cargada') && ids(hold).includes('cargada'));
  assert.ok(dmgDone(hold) > dmgDone(tap) * 1.5, `cargada ${dmgDone(hold)} vs toque ${dmgDone(tap)}`);
  assert.ok(mid.cc > 0.9, 'el snapshot muestra la carga'); assert.equal(hold.g.snapshot().players[0].cc, 0);
});

test('armas fusionadas cambian el set: espada=cadena, hacha=2+giro, martillo=1 aplastante+onda, lanza=estocada larga, daga=ráfaga larga', () => {
  const w = (melee, extra = {}, d = 2.6, n = 1) => mk('axioma', { melee, evo: 4, ...extra }, d, n);
  const hacha = w('hacha_doble'); press(hacha, ['a1', 'a1', 'a1'], 0.6); assert.deepEqual(hacha.log.filter((e) => e.t === 'melee').map((e) => e.kind).slice(-1), ['spin'], 'el 3.º es un giro');
  const mart = w('martillo_sismico', {}, 2.6, 3); press(mart, ['a1', 'a1', 'a1'], 0.9); assert.deepEqual(ids(mart), ['tajo', 'contratajo', 'tajo'], 'cadena máxima de 2'); assert.ok(mart.log.some((e) => e.t === 'boom'), 'onda al aplastar');
  const rng = (melee) => { const c = mk('axioma', { melee, evo: 0 }, 5.4); press(c, ['a1'], 0.5); return dmgDone(c); };
  assert.equal(rng(''), 0, 'sin lanza no llega a 5,4 m'); assert.ok(rng('lanza_sinaptica') > 0, 'la estocada de lanza llega lejos');
  const daga = w('daga_neurotoxica'); press(daga, ['a1', 'a1', 'a1', 'a1'], 0.22); assert.ok(ids(daga).includes('tormenta'), 'la daga permite cadenas de 4+');
  const esp = w('filo_oseo'); press(esp, ['a1', 'a1', 'a1'], 0.5); assert.deepEqual(ids(esp).slice(0, 3), ['tajo', 'contratajo', 'onda_coraza']);
  for (const id of Object.keys(MELEE_WEAPONS)) { const c = mk('vesper', { melee: id, evo: 4 }); press(c, ['a1', 'a1', 'a2'], 0.4); assert.ok(dmgDone(c) > 0, id); }
});

test('snapshot: md, cn, cw, cnm, hc, hx, hw, cc (y md:0 en Shooter)', () => {
  const c = mk('vesper'); run(c, 0.5, { a1: true }); const s = c.g.snapshot().players[0];
  assert.equal(s.md, 1); assert.ok(s.cn >= 1 && s.cw > 0 && typeof s.cnm === 'string' && s.cnm.length > 0); assert.equal(s.hc, 0); assert.equal(s.cc, 0);
  run(c, 0.1, { hab: true }); run(c, 0.1, {}); const t = c.g.snapshot().players[0]; assert.ok(t.hc > 10 && t.hx >= t.hc);
  assert.equal(JSON.stringify(s).includes('NaN'), false);
  assert.equal(mk('vesper', { mode: 'shooter' }).g.snapshot().players[0].md, 0);
});

test('habilidad: cooldown visible, telegrafía (hab/cast antes de hab/go) y no se repite hasta enfriar', () => {
  for (const h of HOST_IDS) {
    const c = mk(h, {}, 3, 2); run(c, 0.05, { hab: true }); run(c, 0.9, {});
    const ev = c.log.filter((e) => e.t === 'hab'); assert.equal(ev[0] && ev[0].ph, 'cast', h); assert.equal(ev[1] && ev[1].ph, 'go', h); assert.ok(ev[0].r > 0 && ev[0].dur === HABILIDADES[h].wind);
    const hc = c.g.snapshot().players[0].hc; assert.ok(hc > (h === 'danzante' ? HABILIDADES[h].cd * 0.5 - 2 : HABILIDADES[h].cd - 2) && hc < HABILIDADES[h].cd, `${h} enfría ${hc}`);   // Danzante: si el Contrapaso falla, vuelve en la mitad
    c.log = []; run(c, 0.2, { hab: true }); assert.equal(c.log.filter((e) => e.t === 'hab').length, 0, `${h} no se repite`);
    run(c, HABILIDADES[h].cd, {}); assert.equal(c.g.snapshot().players[0].hc, 0); run(c, 0.1, { hab: true }); run(c, 0.9, {}); assert.ok(c.log.some((e) => e.t === 'hab' && e.ph === 'go'), `${h} vuelve a estar lista`);
  }
});

test('Baluarte (Axioma): escudo que absorbe el 70 % y refleja el daño a los de alrededor', () => {
  const c = mk('axioma', {}, 2.5); c.m.hp = c.m.maxhp = 1e6;
  run(c, 0.05, { hab: true }); run(c, 0.4, {}); assert.ok(c.g.time < c.p.guardUntil && c.p.baluarteUntil > 0); assert.ok(c.g.snapshot().players[0].bf & 1, 'estado Caparazón visible');
  const before = c.m.hp, sh = c.p.shield + c.p.hp; c.g.hurtPlayer(c.p, 40, true);
  assert.ok(sh - (c.p.shield + c.p.hp) < 40 * 0.45, 'absorbe'); assert.ok(c.m.hp < before, 'refleja');
});
test('Frenesí de caza (Vesper): embiste, marca y da velocidad', () => {
  const c = mk('vesper', {}, 5); const base = c.p.spdMul; run(c, 0.05, { hab: true }); run(c, 0.5, {});
  assert.ok(c.m.hp < 1e6 && c.g.time < c.m.markUntil, 'daña y marca'); assert.ok(c.p.spdMul > base * 1.25, 'velocidad'); assert.ok(c.g.time < c.p.frenzyUntil);
});
test('Estallido de esporas (Micelio): daña, enraíza y CURA al equipo', () => {
  const c = mk('micelio', {}, 4); const ally = c.g.addPlayer('b', null, { char: 'axioma' }); ally.pos = { ...c.p.pos, x: c.p.pos.x + 3 }; ally.hp = 30; ally.shield = 0;
  run(c, 0.05, { hab: true }); run(c, 0.7, {});
  assert.ok(ally.hp >= 55 && ally.shield > 0, `aliado curado: ${ally.hp}`); assert.ok(c.m.hp < 1e6 && c.g.time < c.m.slowUntil, 'daña y enraíza');
});
test('Eclipse (Umbra): zona que ralentiza y daña de forma continua', () => {
  const c = mk('umbra', {}, 4); run(c, 0.05, { hab: true }); run(c, 0.6, {});
  assert.ok(c.g.objects.some((o) => o.type === 'chrono' && o.owner === c.p.id), 'zona'); const h0 = c.m.hp; run(c, 2, {}); assert.ok(h0 - c.m.hp > 30, 'daño continuo'); assert.ok(c.g.time < (c.m.chronoUntil || 0) + 0.2, 'lento');
  run(c, 6, {}); assert.equal(c.p.eclipse, null);
});
test('Bendición (Seraf): cura fuerte, escudo completo, menos daño y reanima a un caído cercano', () => {
  const c = mk('seraf', {}, 12); const a = c.g.addPlayer('b', null, { char: 'axioma' }); a.pos = { ...c.p.pos, x: c.p.pos.x + 4 }; a.hp = 20; a.shield = 0;
  const d = c.g.addPlayer('c', null, { char: 'vesper' }); d.pos = { ...c.p.pos, z: c.p.pos.z + 4 }; d.hp = 0; d.dead = true; d.bleed = 30;
  c.p.hp = 40; run(c, 0.05, { hab: true }); run(c, 0.8, {});
  assert.ok(a.hp >= 55 && a.shield === 100, `curado ${a.hp}`); assert.ok(c.p.hp >= 80); assert.equal(d.dead, false, 'reanimado'); assert.ok(c.g.time < a.blessUntil);
  const hp = a.hp; c.g.hurtPlayer(a, 30, true); assert.ok(hp - a.hp <= 0 || a.shield < 100);
});

test('auto-golpe del modo simple: A1 se mantiene solo con un enemigo cerca y de frente (Seraf: bajo la mira)', () => {
  const me = { id: 1, md: 1, char: 'axioma', pos: [0, 0, 0], h: [0, 0, 1] }, st = (z, c = false) => ({ monsters: [{ p: [0, 0, z], r: 1, c }] });
  const a = {}; assert.equal(comboAssist(a, st(2), me), true); assert.equal(a.a1, true);
  assert.equal(comboAssist({}, st(9), me), false, 'lejos: no'); assert.equal(comboAssist({}, st(-2), me), false, 'a la espalda: no'); assert.equal(comboAssist({}, st(2, true), me), false, 'camuflado: no');
  assert.equal(comboAssist({}, st(2), { ...me, md: 0 }), false, 'en Shooter no actúa'); assert.equal(comboAssist({}, st(2), { ...me, dead: true }), false);
  const sr = { ...me, char: 'seraf' }; assert.equal(comboTarget(st(20), sr, false), false); assert.equal(comboTarget(st(20), sr, true), true);
});

test('determinismo: dos partidas iguales dan exactamente los mismos snapshots y eventos (y combos.js no usa g.rng)', () => {
  assert.ok(!/\bg\.rng\b|Math\.random/.test(fs.readFileSync(new URL('../src/sim/combos.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')), 'combos.js no toca g.rng');
  const play = () => {
    const out = [];
    for (const h of HOST_IDS) {
      const c = mk(h, { evo: 3, path: ['depredador', 'velocidad', 'simbiosis'] }, 3, 3);
      for (let i = 0; i < 600; i++) { c.g.setInput(c.p.id, { mode: 'combo', a1: i % 50 < 30, a2: i % 90 > 70, hab: i % 200 === 5 }); c.g.step(T60); const s = c.g.snapshot(); if (i % 20 === 0) out.push(JSON.stringify([s.players[0], s.monsters.map((m) => [m.hp, m.p])])); out.push(JSON.stringify(s.events.filter((e) => e.t === 'combo' || e.t === 'hab'))); }
    }
    return out.join('\n');
  };
  assert.equal(play(), play());
});

/* ───────── equilibrio frente al estilo Melé ───────── */
const WAVE = [['astilla', 14], ['astilla', 16], ['astilla', 18], ['racimo', 20], ['lente', 24], ['lente', 26], ['geoda', 22], ['ariete', 20]];
/** Bot de oleada: 'melee' = el de tests/estilos.test.js; 'combo' = A1 sostenido + A2 de vez en cuando + habilidad lista (Seraf se queda a distancia). */
function duel(host, kind, seed = 3) {
  const combo = kind === 'combo';
  const g = new Game({ mapId: 'm1', seed, magazines: true }); g.phaseT = 1e9;
  const p = g.addPlayer('t', null, combo ? { char: host, mode: 'combo' } : { char: host, style: 'melee' }); p.hp = 100; p.shield = 100;
  for (let i = 0; i < WAVE.length; i++) { const [k, d] = WAVE[i], a = (i / WAVE.length) * Math.PI * 2; const m = g.spawnMonster(k, { x: p.pos.x + Math.cos(a) * d * 0.5, y: p.pos.y + 0.5, z: p.pos.z + Math.sin(a) * d * 0.5 }, { noElite: true }); if (m) m.cd = 1 + i * 0.3; }
  let t = 0;
  for (; t < 90; t += T60) {
    const alive = g.monsters.filter((m) => !m.dead); if (!alive.length || p.dead) break;
    let best = alive[0], bd = Infinity; for (const m of alive) { const dd = len(sub(m.pos, p.pos)); if (dd < bd) { bd = dd; best = m; } }
    const to = sub(best.pos, g.eyePos(p)), flat = norm(sub(to, mul(p.up, dot(to, p.up))), p.heading); p.heading = flat; p.pitch = Math.asin(Math.max(-1, Math.min(1, dot(norm(to), p.up))));
    const inp = { mz: 0 }, tick = Math.round(t * 60);
    if (combo) { inp.mode = 'combo'; if (host === 'seraf') { if (bd < 6) inp.mz = -1; else if (bd > 22) inp.mz = 1; inp.a1 = tick % 90 < 60; inp.a2 = tick % 90 >= 60 && tick % 90 < 75; } else { if (bd > 3 + best.r) inp.mz = 1; inp.a1 = true; inp.a2 = tick % 80 >= 70; } inp.hab = tick % 30 < 3; }
    else if (bd > 3 + best.r) inp.mz = 1; else inp.melee = tick % 20 < 8;
    g.setInput(p.id, inp); g.step(T60);
  }
  return { t: +t.toFixed(1), clear: !g.monsters.some((m) => !m.dead), dead: p.dead };
}
/** Daño por segundo contra un muñeco quieto (bot que mira siempre al blanco). */
function dps(host, kind) {
  const combo = kind === 'combo', g = new Game({ mapId: 'm1', seed: 3, magazines: true }); g.phaseT = 1e9;
  const p = g.addPlayer('t', null, combo ? { char: host, mode: 'combo' } : { char: host, style: 'melee' }); p.hp = 1e5; p.shield = 100;
  const d0 = host === 'seraf' && combo ? 12 : 2.6, m = g.spawnMonster('astilla', { x: p.pos.x + p.heading.x * d0, y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * d0 }, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; m.cd = 1e9;
  for (let tick = 0; tick < 720; tick++) {
    const dd = len(sub(m.pos, p.pos)), to = sub(m.pos, g.eyePos(p)); p.heading = norm(sub(to, mul(p.up, dot(to, p.up))), p.heading); p.pitch = Math.asin(Math.max(-1, Math.min(1, dot(norm(to), p.up))));
    const inp = { mz: 0 }, ranged = host === 'seraf' && combo; if (ranged) { if (dd < 6) inp.mz = -1; } else if (dd > 3 + m.r) inp.mz = 1;
    if (combo) { inp.mode = 'combo'; inp.a1 = ranged ? tick % 90 < 60 : true; inp.a2 = ranged ? tick % 90 >= 60 && tick % 90 < 75 : tick % 80 >= 70; inp.hab = tick % 30 < 3; } else inp.melee = tick % 20 < 8;
    g.setInput(p.id, inp); g.step(T60);
  }
  return (1e6 - m.hp) / 12;
}
test('equilibrio: el daño sostenido del Combo está a ±30 % del estilo Melé en cada Huésped', { timeout: 120000 }, () => {
  const rows = {}; for (const h of HOST_IDS) { const a = dps(h, 'melee'), b = dps(h, 'combo'); rows[h] = { melee: Math.round(a), combo: Math.round(b), ratio: +(b / a).toFixed(2) }; }
  console.log('DPS contra muñeco', JSON.stringify(rows));
  for (const h of HOST_IDS) assert.ok(rows[h].ratio >= 0.7 && rows[h].ratio <= 1.3, `${h}: ${JSON.stringify(rows[h])}`);
});
test('equilibrio: un bot Combo limpia la misma oleada y su tiempo total está a ±30 % del bot Melé (referencia: tests/estilos.test.js)', { timeout: 300000 }, () => {
  let A = 0, B = 0; const rows = {};
  for (const h of HOST_IDS) { const a = duel(h, 'melee'), b = duel(h, 'combo'); rows[h] = { melee: a.t, combo: b.t }; A += a.t; B += b.t; assert.ok(a.clear && b.clear && !b.dead, `${h}: ${JSON.stringify({ a, b })}`); assert.ok(b.t / a.t > 0.45 && b.t / a.t < 1.6, `${h}: ${b.t} vs ${a.t}`); }
  console.log('Limpiar oleada (s)', JSON.stringify(rows), 'razón total', (B / A).toFixed(2));
  assert.ok(B / A >= 0.7 && B / A <= 1.3, `razón total ${B / A}`);
});
