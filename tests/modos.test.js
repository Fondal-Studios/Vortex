// Modos Disparo ↔ Melé en partida (src/sim/modos.js, docs/CONTROLES.md → «Tabla Huésped × modo × slot»):
// los 3 slots de habilidad existen en los dos modos para los 8 Huéspedes, el cambio de modo es por la entrada (determinista),
// y el balance no se rompe (HAB.1/HAB.2 en Melé no suman el ×1,5 de la principal).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { HOST_IDS, CHARACTERS, HABILIDADES, STYLES } from '../src/sim/data.js';
import { MODOS, SLOTS_MELE, MODO_K, fuentes, habSlots, enrutar } from '../src/sim/modos.js';

const T60 = 1 / 60;
function mk(char, mode, seed = 3) {
  const g = new Game({ mapId: 'm1', seed, magazines: true }); g.phaseT = 1e9;
  const p = g.addPlayer('t', null, { char, mode }); p.hp = 100; p.shield = 100;
  return { g, p };
}
function run(c, secs, inp = {}) { for (let i = 0; i < Math.round(secs / T60); i++) { c.g.setInput(c.p.id, { mode: c.p.mode, ...inp }); c.g.step(T60); } }

test('modos: nombres para el jugador (Disparo / Melé) y los 8 Huéspedes tienen su fila en la tabla', () => {
  assert.equal(MODOS.shooter.nombre, 'Disparo'); assert.equal(MODOS.combo.nombre, 'Melé');
  assert.equal(HOST_IDS.length, 8);
  for (const h of HOST_IDS) assert.ok(SLOTS_MELE[h], `${h} sin fila en SLOTS_MELE`);
});

test('las TRES habilidades existen en los dos modos para cada Huésped, sin repetir y con nombre', () => {
  for (const h of HOST_IDS) for (const modo of ['shooter', 'combo']) {
    const s = habSlots(h, modo); assert.equal(s.length, 3, `${h} ${modo}`);
    assert.equal(new Set(s.map((x) => x.src)).size, 3, `${h} ${modo}: fuentes repetidas ${s.map((x) => x.src)}`);
    assert.equal(new Set(s.map((x) => x.id)).size, 3, `${h} ${modo}: ids repetidos`);
    for (const x of s) assert.ok(x.name && x.cd > 0, `${h} ${modo} slot ${x.slot}`);
  }
});

test('Disparo: HAB.1/2/3 = mov/esp/s3 de siempre · Melé: HAB.3 = la habilidad principal de Combo', () => {
  for (const h of HOST_IDS) {
    assert.deepEqual(fuentes(h, 'shooter'), ['mov', 'esp', 's3']);
    const m = habSlots(h, 'combo'); assert.equal(m[2].src, 'hab'); assert.equal(m[2].id, HABILIDADES[h].id, `${h}: HAB.3 de Melé`);
    assert.equal(m[0].id, CHARACTERS[h].mov.id, `${h}: HAB.1 igual en los dos modos`);
  }
  // los tres que repetían la principal usan la s3 de Disparo en el slot 2
  for (const h of ['colmena', 'danzante', 'singular']) assert.equal(habSlots(h, 'combo')[1].src, 's3', h);
  for (const h of ['axioma', 'vesper', 'micelio', 'umbra', 'seraf']) assert.equal(habSlots(h, 'combo')[1].src, 'esp', h);
});

test('enrutar: la misma entrada (mov/esp/s3) cambia de significado según el modo, de forma pura', () => {
  assert.deepEqual(enrutar('axioma', 'shooter', { s3: true }), { mov: false, esp: false, s3: true, hab: false });
  assert.deepEqual(enrutar('axioma', 'combo', { s3: true }), { mov: false, esp: false, s3: false, hab: true });
  assert.deepEqual(enrutar('danzante', 'combo', { esp: true }), { mov: false, esp: false, s3: true, hab: false });
  assert.deepEqual(enrutar('danzante', 'combo', { s3: true, mov: true }), { mov: true, esp: false, s3: false, hab: true });
  assert.equal(enrutar('axioma', 'combo', {}, true).hab, true, 'hab directo (bots y pruebas) se respeta');
});

test('cada Huésped lanza sus 3 habilidades en Disparo y en Melé con las mismas teclas (HAB.1/2/3)', () => {
  for (const h of HOST_IDS) {
    for (const modo of ['shooter', 'combo']) {
      const fu = fuentes(h, modo), cds = { mov: (p) => p.movCd, esp: (p) => p.espCd, s3: (p) => p.s3Cd, hab: (p) => p.habCd };
      for (let slot = 0; slot < 3; slot++) {
        const c = mk(h, modo); const inp = { mov: slot === 0, esp: slot === 1, s3: slot === 2 };
        // la Colmena puede necesitar un blanco para algunas; con un enemigo delante todas gastan enfriamiento
        c.g.spawnMonster('astilla', { x: c.p.pos.x + c.p.heading.x * 5, y: c.p.pos.y + 0.5, z: c.p.pos.z + c.p.heading.z * 5 }, { noElite: true });
        run(c, 0.4, inp);
        assert.ok(cds[fu[slot]](c.p) > 0, `${h} ${modo} HAB.${slot + 1} (${fu[slot]}) no gastó enfriamiento`);
      }
    }
  }
});

test('cambio de modo al instante por la entrada y recordado en la simulación; sin tocar el estado del otro modo', () => {
  const c = mk('vesper', 'shooter'); assert.equal(c.p.mode, 'shooter');
  run(c, 0.1, { mode: 'combo' }); assert.equal(c.p.mode, 'combo'); assert.equal(c.g.snapshot().players[0].md, 1);
  run(c, 0.1, { mode: 'shooter' }); assert.equal(c.p.mode, 'shooter'); assert.equal(c.g.snapshot().players[0].md, 0);
  // en Disparo, disparar sigue funcionando justo después de volver
  const m = c.g.spawnMonster('astilla', { x: c.p.pos.x + c.p.heading.x * 6, y: c.p.pos.y + 0.5, z: c.p.pos.z + c.p.heading.z * 6 }, { noElite: true }); m.passive = true; const hp = m.hp;
  run(c, 1, { fire: true }); assert.ok(m.hp < hp, 'dispara después de volver a Disparo');
});

test('determinismo: dos partidas con los mismos cambios de modo y habilidades dan el mismo snapshot', () => {
  const sim = () => {
    const c = mk('micelio', 'shooter', 9); for (let t = 0; t < 300; t++) {
      const modo = t % 100 < 50 ? 'shooter' : 'combo';
      c.g.setInput(c.p.id, { mode: modo, mov: t % 70 === 3, esp: t % 90 === 5, s3: t % 110 === 7, a1: modo === 'combo' && t % 12 < 3, fire: modo === 'shooter' }); c.g.step(T60);
    }
    return JSON.stringify(c.g.snapshot().players[0]);
  };
  assert.equal(sim(), sim());
});

test('balance: en Melé HAB.1/HAB.2 NO suman el ×1,5 de habilidad del estilo Combo (≈ ×1,0 como en Disparo) y la principal sí', () => {
  assert.ok(Math.abs(STYLES.combo.mul.skill * MODO_K - 1) < 0.02, 'MODO_K compensa el ×1,5');
  const dmg = (modo, inp, hab = false) => {
    const c = mk('axioma', modo, 5); const ms = []; for (let i = 0; i < 3; i++) { const m = c.g.spawnMonster('geoda', { x: c.p.pos.x + c.p.heading.x * 5, y: c.p.pos.y + 0.5, z: c.p.pos.z + c.p.heading.z * 5 + (i - 1) * 1.2 }, { noElite: true }); m.passive = true; m.hp = m.maxhp = 1e6; ms.push(m); }
    run(c, 0.9, inp); return ms.reduce((a, m) => a + (1e6 - m.hp), 0);
  };
  const dis = dmg('shooter', { esp: true }), mele = dmg('combo', { esp: true });
  assert.ok(dis > 0 && mele > 0, `daño ${dis} / ${mele}`);
  assert.ok(Math.abs(mele / dis - 1) < 0.2, `HAB.2 en Melé (${mele.toFixed(0)}) ≈ HAB.2 en Disparo (${dis.toFixed(0)})`);
  const prin = dmg('combo', { s3: true }); assert.ok(prin > 0, 'la principal de Melé hace daño');
});
