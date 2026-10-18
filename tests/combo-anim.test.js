// Golpes del modo Combo que se ven y se sienten (src/client/combo-anim.js + combo-fx.js): tabla ANIM_GOLPE completa, pose determinista y continua,
// el hit-stop / la cámara lenta son SÓLO visuales (la simulación sigue idéntica) y las opciones de «Reducir efectos».
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Game } from '../src/sim/game.js';
import { COMBO_SETS, HOST_IDS } from '../src/sim/data.js';
import { ANIM_GOLPE, ANIM_HAB, ARQUETIPOS, SLOTS, StrikePose, animDe, animHab, golpesSinAnim } from '../src/client/combo-anim.js';
import { createComboFx } from '../src/client/combo-fx.js';

const T60 = 1 / 60, ORIGINALES = ['axioma', 'vesper', 'micelio', 'umbra', 'seraf'];

test('ANIM_GOLPE cubre TODOS los golpes de COMBO_SETS de los 5 Huéspedes originales (si falta uno, este test falla)', () => {
  for (const id of ORIGINALES) {
    assert.ok(COMBO_SETS[id] && COMBO_SETS[id].length >= 8, `${id}: sin set de golpes`);
    assert.deepEqual(golpesSinAnim(id), [], `${id}: golpes sin animación propia en ANIM_GOLPE`);
    for (const mv of COMBO_SETS[id]) {
      const d = ANIM_GOLPE[id][mv.id]; assert.ok(d, `${id}/${mv.id}`);
      assert.ok(ARQUETIPOS.includes(d.a), `${id}/${mv.id}: arquetipo «${d.a}» inexistente`);
      assert.ok(d.peso > 0 && d.hs >= 0 && d.hs <= 7, `${id}/${mv.id}: peso/hit-stop fuera de rango`);
    }
    assert.ok(ARQUETIPOS.includes(ANIM_HAB[id].cast) && ARQUETIPOS.includes(ANIM_HAB[id].go), `${id}: habilidad sin pose`);
  }
});

test('los Huéspedes nuevos (y cualquier golpe sin entrada) caen en el respaldo por TIPO de golpe: nunca sin animación', () => {
  for (const id of HOST_IDS) for (const mv of COMBO_SETS[id] || []) {
    const d = animDe(id, mv.id, { n: mv.seq.length });
    assert.ok(ARQUETIPOS.includes(d.a), `${id}/${mv.id}: el respaldo dio «${d.a}»`);
    assert.ok(d.peso > 0 && typeof d.av === 'number');
  }
  // por tipo (Huésped inventado): giro, estocada, salto, corte, flecha, martillo
  const por = (mv) => animDe('inventado', 'x', { mv }).a;
  assert.equal(por({ kind: 'spin' }), 'giro'); assert.equal(por({ kind: 'lunge', dash: 6 }), 'estocada'); assert.equal(por({ kind: 'lunge', dash: 14, jump: 9 }), 'salto');
  assert.equal(por({ blink: 5, line: true }), 'corte'); assert.equal(por({ ranged: true }), 'arco'); assert.equal(por({ ranged: true, charge: true }), 'carga'); assert.equal(por({ kind: 'air' }), 'martillo');
  assert.equal(por({}), 'tajo'); assert.equal(animDe('axioma', 'plunge').a, 'caida'); assert.ok(animHab('inventado', 'cast').a);
  assert.ok(animDe('axioma', 'onda_coraza', { fin: true, n: 3 }).peso >= 1.9, 'el remate pesa más');
  assert.ok(animDe('axioma', 'tajo', { fin: true }).hs > animDe('axioma', 'tajo').hs, 'el remate frena más');
});

test('StrikePose: el contacto ocurre UNA vez, cada golpe vuelve al reposo y encadenar no da saltos', () => {
  for (const id of ORIGINALES) for (const mv of COMBO_SETS[id]) {
    const P = new StrikePose(), d = animDe(id, mv.id); let contactos = 0, t = 0;
    P.trigger(d, { reach: 1 });
    for (let i = 0; i < 240 && !P.done; i++) { if (P.step(T60)) { contactos++; assert.ok(Math.abs(P.time - P.arq.hit) < 0.03, `${id}/${mv.id}: contacto a destiempo`); } t += T60; for (const v of P.cur) assert.ok(Number.isFinite(v)); }
    assert.equal(contactos, 1, `${id}/${mv.id}: contactos`); assert.ok(P.done && P.w === 0, `${id}/${mv.id}: no volvió al reposo`); assert.ok(t < 1.6, `${id}/${mv.id}: dura ${t.toFixed(2)} s`);
    assert.ok(P.cur.every((v) => v === 0), `${id}/${mv.id}: reposo no es neutro`);
  }
  // encadenar: la pose del primer cuadro del golpe 2 está a un paso razonable de la última del golpe 1 (cancelación fluida)
  const P = new StrikePose(); P.trigger(animDe('axioma', 'tajo')); for (let i = 0; i < 12; i++) P.step(T60);
  const antes = new Float32Array(P.cur); P.trigger(animDe('axioma', 'contratajo')); P.step(T60);
  const salto = Math.max(...SLOTS.map((_, i) => Math.abs(P.cur[i] - antes[i]))); assert.ok(salto < 0.45, `salto de pose al encadenar: ${salto}`);
  // el giro completo (Axioma «tormenta») termina en una vuelta entera y vuelve a 0 sin desenrollarse
  const S = new StrikePose(); S.trigger(animDe('axioma', 'tormenta')); let maxBy = 0, lastBy = 0; for (let i = 0; i < 200 && !S.done; i++) { S.step(T60); maxBy = Math.max(maxBy, Math.abs(S.off.yaw)); const dy = Math.abs(S.off.yaw - lastBy); assert.ok(dy < 1.2 || Math.abs(dy - Math.PI * 2) < 1e-3, 'el giro es continuo (el último salto de 2π es la vuelta entera: se ve igual)'); lastBy = S.off.yaw; }
  assert.ok(maxBy > 6, 'da la vuelta entera'); assert.equal(S.off.yaw, 0);
});

/* ───── hit-stop / cámara lenta no tocan la simulación ───── */
function mundo(char = 'axioma') {
  const g = new Game({ mapId: 'm1', seed: 3, magazines: true }); g.phaseT = 1e9;
  const p = g.addPlayer('t', null, { char, mode: 'combo', evo: 4 }); p.hp = 100; p.shield = 100; p.godmode = true;
  const ms = []; for (let i = 0; i < 3; i++) { const m = g.spawnMonster('astilla', { x: p.pos.x + p.heading.x * (2.4 + i * 0.5), y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * (2.4 + i * 0.5) + (i - 1) * 0.8 }, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; m.cd = 1e9; ms.push(m); }
  return { g, p, ms };
}
function renderFalso(opts = {}) {
  const calls = { shake: 0, fov: 0, flash: 0, sparks: 0, ring: 0 }, K = { fov: 0, p: 0, sh: 0 };
  const noop = () => {}, fx = { combat: { reduced: !!opts.reducido, K, addShake() { calls.shake++; } }, flash() { calls.flash++; }, sparks() { calls.sparks++; }, ring() { calls.ring++; }, spray: noop, line: noop };
  return { calls, K, r: { scene: new THREE.Scene(), fx, ents: { mon: new Map() }, hostfx: null, third: true, t: 0, camera: new THREE.PerspectiveCamera() } };
}
const guion = (i) => ({ a1: i % 14 < 3, a2: i % 40 === 20 });   // A1 en ráfagas y A2 de vez en cuando

test('hit-stop, cámara lenta y efectos son SÓLO visuales: la simulación (snapshot) queda idéntica con y sin combo-fx', () => {
  const run = (conFx) => {
    const { g, p } = mundo(); const { r } = renderFalso(); const cfx = conFx ? createComboFx(r) : null; const trazas = []; let congelado = 0, lento = 0;
    for (let i = 0; i < 600; i++) {
      g.setInput(p.id, { mode: 'combo', ...guion(i) }); g.step(T60); const s = g.snapshot();
      if (cfx) {
        const me = s.players[0]; r.t += T60; cfx.ingest(s, me); const cx = cfx.frameFor(me.id, T60, me, s); cfx.update(T60, s, me);
        if (cx && cx.freeze > 0) congelado++; if (cfx.timeScale() < 1) lento++;
        if (i === 599) { assert.ok(congelado > 0, 'hubo hit-stop'); assert.ok(lento > 0, 'hubo cámara lenta en un remate'); }
      }
      if (i % 25 === 0) trazas.push(JSON.stringify({ t: s.t, pl: s.players.map((q) => [q.pos, q.hp, q.cn, q.cmb, q.kills]), mo: s.monsters.map((m) => [m.id, m.p, m.hp]) }));
    }
    return trazas.join('\n') + JSON.stringify(g.snapshot().players[0]);
  };
  assert.equal(run(true), run(false));
});

test('«Reducir efectos»: completos → hit-stop + sacudida + FOV; reducidos → la mitad y sin cámara lenta; sin movimiento → nada de cámara', () => {
  const sets = { 0: {}, 1: { fx: '1' }, 2: { reducido: true } }, res = {};
  const viejo = globalThis.localStorage;
  for (const [nivel, o] of Object.entries(sets)) {
    globalThis.localStorage = { getItem: (k) => (k === 'cristal.reduceFx' && o.fx ? o.fx : null), setItem() {} };
    const { g, p } = mundo(), { r, calls, K } = renderFalso(o), cfx = createComboFx(r); let freeze = 0, lento = false;
    assert.equal(cfx.level, +nivel);
    for (let i = 0; i < 480; i++) { g.setInput(p.id, { mode: 'combo', ...guion(i) }); g.step(T60); const s = g.snapshot(), me = s.players[0]; r.t += T60; cfx.ingest(s, me); const cx = cfx.frameFor(me.id, T60, me, s); cfx.update(T60, s, me); if (cx) freeze = Math.max(freeze, cx.freeze); if (cfx.timeScale() < 1) lento = true; }
    res[nivel] = { freeze, lento, shake: calls.shake, fov: K.fov, flash: calls.flash, sparks: calls.sparks };
  }
  globalThis.localStorage = viejo;
  assert.ok(res[0].freeze > 0 && res[0].shake > 0 && res[0].lento, 'completos: hit-stop, sacudida y cámara lenta');
  assert.ok(res[1].shake > 0 && !res[1].lento && res[1].freeze <= res[0].freeze, 'reducidos: sin cámara lenta y menos hit-stop');
  assert.equal(res[2].shake, 0, 'sin movimiento: cero sacudida'); assert.equal(res[2].freeze, 0, 'sin movimiento: cero hit-stop'); assert.ok(!res[2].lento && res[2].fov === 0);
  assert.ok(res[2].sparks > 0, 'los destellos siguen (sólo se quita el movimiento)');
});
