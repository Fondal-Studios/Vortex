// AC-07 · «Sonido de impacto solo si hay colisión confirmada; atacar al aire no reproduce hit.»
// Harness mínimo: la simulación REAL + combo-fx REAL + un renderer y un audio falsos que cuentan llamadas.
//   · Atacar al aire (cuerpo a cuerpo, combos encadenados/cancelados, flechas de Seraf, disparos, habilidades de área) → 0 sonidos de impacto y 0 efectos de impacto.
//   · Atacar con acierto → el impacto suena (una vez por golpe confirmado) y sólo entonces hay destello, hit-stop y empuje de cámara.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Game } from '../src/sim/game.js';
import { createComboFx } from '../src/client/combo-fx.js';
import { sonarImpacto, contactoConfirmado, hayMeleeConfirmado } from '../src/client/impacto.js';

const T60 = 1 / 60;

function audioFalso() {
  const c = { comboHit: 0, hit: 0, boom: 0, meleeHit: 0, whoosh: 0, whooshMax: 0 };
  return {
    c,
    comboHit() { c.comboHit++; },
    hit() { c.hit++; },
    boom() { c.boom++; },
    melee(host, kind, at, hit) { if (kind === 'hit' || kind === 'exec' || hit > 0) c.meleeHit++; else c.whoosh++; },
    get impactos() { return c.comboHit + c.hit + c.boom + c.meleeHit; },
  };
}
function renderFalso() {
  const calls = { shake: 0, flash: 0, sparks: 0, ring: 0, fov: 0 }, K = { fov: 0, p: 0 }, noop = () => {};
  const fx = { combat: { reduced: false, K, addShake() { calls.shake++; } }, flash() { calls.flash++; }, sparks() { calls.sparks++; }, ring() { calls.ring++; }, spray: noop, line: noop };
  return { calls, K, r: { scene: new THREE.Scene(), fx, ents: { mon: new Map() }, hostfx: null, third: true, t: 0, camera: new THREE.PerspectiveCamera() } };
}
function mundo(char, { blancos = 0, mode = 'combo' } = {}) {
  const g = new Game({ mapId: 'm1', seed: 3, magazines: true }); g.phaseT = 1e9;
  const p = g.addPlayer('t', null, { char, mode, evo: 4 }); p.hp = 100; p.shield = 100; p.godmode = true;
  for (let i = 0; i < blancos; i++) { const m = g.spawnMonster('astilla', { x: p.pos.x + p.heading.x * (2.4 + i * 0.5), y: p.pos.y + 0.5, z: p.pos.z + p.heading.z * (2.4 + i * 0.5) + (i - 1) * 0.8 }, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; m.cd = 1e9; }
  return { g, p };
}
/** Corre `n` cuadros; `guion(i)` da la entrada. Aplica los eventos a combo-fx y al despachador de impactos (como hace main.js). */
function correr(char, o, n, guion) {
  const { g, p } = mundo(char, o), { r, calls, K } = renderFalso(), cfx = createComboFx(r), snd = audioFalso();
  cfx.setSound(snd); let freeze = 0, golpesConfirmados = 0, dañoEv = 0, boomsSinBlanco = 0;
  for (let i = 0; i < n; i++) {
    g.setInput(p.id, { mode: o && o.mode || 'combo', ...guion(i) }); g.step(T60); const s = g.snapshot(), me = s.players[0]; r.t += T60;
    const cubre = hayMeleeConfirmado(s.events);
    for (const e of s.events) {
      if (e.t === (o && o.mode === 'shooter' ? 'melee' : 'combo') && e.hit > 0) golpesConfirmados++;   // en Combo el golpe es `combo` (con `melee` de acompañante)
      if (e.t === 'hit' || e.t === 'arhit') dañoEv++; if (e.t === 'boom' && e.hit === 0) boomsSinBlanco++;
      sonarImpacto(snd, e, cubre);   // main.js: hit / arhit / boom / orbburst
    }
    cfx.ingest(s, me); const cx = cfx.frameFor(me.id, T60, me, s); cfx.update(T60, s, me); if (cx) freeze = Math.max(freeze, cx.freeze);
  }
  return { snd, calls, K, freeze, golpesConfirmados, dañoEv, boomsSinBlanco, g, p };
}
const ráfaga = (i) => ({ a1: i % 14 < 3, a2: i % 40 === 20 });   // A1 en ráfagas (encadena y cancela golpes) y A2 de vez en cuando
const sinEfectos = (R, msg) => {
  // el único sonido de golpe tolerado es el de un daño confirmado por la simulación (p. ej. una flecha que pega en el Corazón de la arena: `arhit`)
  assert.equal(R.snd.c.comboHit + R.snd.c.meleeHit, 0, `${msg}: sonó impacto de golpe ${JSON.stringify(R.snd.c)}`);
  assert.equal(R.snd.impactos, R.dañoEv, `${msg}: sonó impacto sin daño confirmado ${JSON.stringify(R.snd.c)}`);
  assert.deepEqual([R.calls.shake, R.calls.flash, R.calls.sparks, R.calls.ring, R.K.fov, R.freeze], [0, 0, 0, 0, 0, 0], `${msg}: efectos de impacto ${JSON.stringify(R.calls)}`);
};

test('atacar al aire con cada Huésped en Combo (golpes encadenados y cancelados): 0 sonidos de impacto y 0 efectos de impacto', () => {
  for (const char of ['axioma', 'vesper', 'micelio', 'umbra', 'seraf', 'danzante', 'singular', 'colmena']) {
    const R = correr(char, { blancos: 0 }, 600, ráfaga);
    assert.equal(R.golpesConfirmados, 0, `${char}: la simulación no debe confirmar golpes`);
    assert.ok(R.snd.c.whoosh > 0, `${char}: el barrido sí suena (whoosh)`);
    sinEfectos(R, char);
  }
});

test('flechas de Seraf (a distancia) que no impactan: ni sonido de impacto, ni destello, ni hit-stop, ni empuje de cámara', () => {
  const R = correr('seraf', { blancos: 0 }, 900, (i) => ({ a1: i % 30 < 20, a2: i % 90 === 45 }));
  assert.equal(R.dañoEv, 0); sinEfectos(R, 'seraf');
});

test('melé del modo Shooter (botón MELEE) al aire: sólo el barrido corto', () => {
  for (const char of ['axioma', 'vesper', 'micelio', 'umbra', 'seraf']) {
    const R = correr(char, { blancos: 0, mode: 'shooter' }, 600, (i) => ({ melee: i % 50 < 4 }));
    sinEfectos(R, `shooter ${char}`);
  }
});

test('disparos que fallan: sin evento `hit`, sin sonido de impacto; con un blanco delante sí hay `hit` y suena una vez por daño aplicado', () => {
  const vacio = correr('axioma', { blancos: 0, mode: 'shooter' }, 120, () => ({ fire: true }));
  assert.equal(vacio.dañoEv, 0); assert.equal(vacio.snd.c.hit, 0, 'un disparo al aire no suena a golpe');
  const { g, p } = mundo('axioma', { mode: 'shooter' }); const m = g.spawnMonster('geoda', { x: p.pos.x + p.heading.x * 8, y: p.pos.y, z: p.pos.z + p.heading.z * 8 }); m.cd = 1e9; m.hp = m.maxhp = 5000;
  const snd = audioFalso(); let daño = 0; g.setInput(p.id, { mode: 'shooter', fire: true });
  for (let i = 0; i < 90; i++) { g.step(T60); for (const e of g.snapshot().events) { if (e.t === 'hit') daño++; sonarImpacto(snd, e); } }
  assert.ok(daño > 0 && snd.c.hit === daño, `un sonido por daño confirmado (${snd.c.hit} / ${daño})`);
});

test('atacar con acierto: el impacto SÍ suena y los efectos aparecen (exactamente un comboHit por golpe confirmado)', () => {
  const R = correr('axioma', { blancos: 3 }, 600, ráfaga);
  assert.ok(R.golpesConfirmados > 0, 'hubo golpes confirmados por la simulación');
  assert.ok(R.snd.c.comboHit > 0 && R.calls.sparks > 0 && R.calls.shake > 0 && R.freeze > 0, JSON.stringify([R.snd.c, R.calls, R.freeze]));
  assert.ok(R.snd.c.comboHit <= R.golpesConfirmados, `nunca más impactos que golpes confirmados (${R.snd.c.comboHit} > ${R.golpesConfirmados})`);
  // un solo golpe contra un solo blanco: exactamente un comboHit
  const U = correr('axioma', { blancos: 1 }, 90, (i) => ({ a1: i < 3 }));
  assert.equal(U.golpesConfirmados, 1); assert.equal(U.snd.c.comboHit, 1, `un golpe = un impacto (${JSON.stringify(U.snd.c)})`);
});

test('flechas de Seraf que SÍ pegan: suena el impacto (la simulación confirma el daño)', () => {
  const R = correr('seraf', { blancos: 3 }, 600, (i) => ({ a1: i % 30 < 20, a2: i % 90 === 45 }));
  assert.ok(R.golpesConfirmados > 0 && R.snd.c.comboHit > 0, JSON.stringify([R.golpesConfirmados, R.snd.c]));
});

test('habilidades de área: sin blancos emiten boom con hit:0 y no suenan a impacto; con blancos suenan', () => {
  for (const char of ['axioma', 'vesper', 'micelio', 'umbra', 'seraf', 'danzante', 'singular', 'colmena']) {
    for (const mode of ['combo', 'shooter']) {
      const sin = correr(char, { blancos: 0, mode }, 400, (i) => ({ hab: i % 120 === 10, esp: i % 150 === 30, s3: i % 170 === 50, mov: i % 190 === 70, a1: i % 60 < 3, a2: i % 100 === 90, melee: i % 80 < 3 }));
      assert.equal(sin.snd.c.boom + sin.snd.c.hit, 0, `${char}/${mode}: habilidad de área sin blancos sonó a impacto ${JSON.stringify(sin.snd.c)}`);
    }
  }
  const con = correr('axioma', { blancos: 3 }, 400, (i) => ({ hab: i % 120 === 10, a1: i % 60 < 3 }));
  assert.ok(con.snd.c.hit + con.snd.c.boom > 0, 'con blancos sí suena');
});

test('despachador sonarImpacto: sólo contacto confirmado', () => {
  const s = audioFalso();
  assert.equal(sonarImpacto(s, { t: 'hit', p: [0, 0, 0], d: 10 }), true);
  assert.equal(sonarImpacto(s, { t: 'hit', p: [0, 0, 0], d: 0 }), false);
  assert.equal(sonarImpacto(s, { t: 'arhit', p: [0, 0, 0], d: 5 }), true);
  assert.equal(sonarImpacto(s, { t: 'boom', p: [0, 0, 0], r: 5, hit: 0 }), false, 'área sin blancos');
  assert.equal(sonarImpacto(s, { t: 'boom', p: [0, 0, 0], r: 5, hit: 2 }), true);
  assert.equal(sonarImpacto(s, { t: 'boom', p: [0, 0, 0], r: 5 }), true, 'explosión de proyectil (la colisión es el propio evento)');
  assert.equal(sonarImpacto(s, { t: 'orbburst', p: [0, 0, 0], n: 3, hit: 0 }), false);
  assert.equal(sonarImpacto(s, { t: 'shot' }), false); assert.equal(sonarImpacto(null, { t: 'hit', d: 1 }), false);
  assert.equal(contactoConfirmado({ t: 'melee', kind: 'light', hit: 0 }), false); assert.equal(contactoConfirmado({ t: 'melee', kind: 'light', hit: 1 }), true);
  assert.deepEqual([s.c.hit, s.c.boom], [2, 1 + 1]);
});

test('P0: un melee o combo sin hit explícito no acredita contacto', () => {
  for (const t of ['melee', 'combo']) {
    assert.equal(contactoConfirmado({ t }), false);
    assert.equal(contactoConfirmado({ t, hit: null }), false);
    assert.equal(contactoConfirmado({ t, hit: 0 }), false);
    assert.equal(contactoConfirmado({ t, hit: -1 }), false);
    assert.equal(contactoConfirmado({ t, hit: Number.NaN }), false);
    assert.equal(contactoConfirmado({ t, hit: 1 }), true);
  }
});
