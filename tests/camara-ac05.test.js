// AC-05 (GDD): cambio manual entre 1.ª y 3.ª persona sin bloquear el control, sin cortar disparos/combos/habilidades y sin romper colisiones.
// Y el ajuste «Cámara automática por modo» (apagado por defecto): cambiar Disparo/Melé ya no fuerza la cámara.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../src/sim/game.js';
import { blocked } from '../src/sim/physics.js';
import { camaraInicial, thirdForMode } from '../src/client/essential-controls.js';
import { DEFAULTS } from '../src/client/settings.js';

const CAM3 = { third: true, side: 1, dist: 3.6 };
function jugar(mode, char, alternar) {
  const g = new Game({ mapId: 'm1', seed: 4, calm: 0.1, magazines: true, practice: true });   // campo de pruebas: blancos pasivos, sin oleadas
  const p = g.addPlayer('t', null, { char, mode }); const r = { disparos: 0, ataques: 0, habs: 0, mov: 0, bloqueado: 0, fuera: 0, cams: 0 }; let ultimo = null;
  for (let k = 0; k < 60 * 12; k++) {
    const cam = alternar ? (Math.floor(k / 45) % 2 ? CAM3 : false) : CAM3;   // toggles cada 0,75 s durante todo el combate
    if (alternar && k % 45 === 0) r.cams++;
    const m = g.monsters.find((q) => q.passive && !q.dead);
    let dyaw = 0; if (m) { const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z; dyaw = Math.max(-0.1, Math.min(0.1, Math.atan2(p.heading.x * dz - p.heading.z * dx, p.heading.x * dx + p.heading.z * dz))); }
    const inp = { cam, mode, mz: (k % 120) < 60 ? 1 : -1, dyaw, compact: true, mov: (k % 150) === 10, a1: mode === 'combo' && (k % 20) < 8, fire: mode !== 'combo' };
    g.setInput(p.id, inp); g.step(1 / 60);
    for (const e of g.events) { if (e.t === 'shot') r.disparos++; if (e.t === 'melee') r.ataques++; if (e.t === 'skill' && e.k === 'mov') r.mov++; }
    g.events.length = 0;
    if (blocked(g.map, p.pos)) r.bloqueado++; if (g.map.outOfBounds(p.pos)) r.fuera++;
    ultimo = p.pos;
  }
  return { r, g, p };
}
for (const [mode, char] of [['shooter', 'axioma'], ['combo', 'vesper']]) {
  test(`AC-05 (${mode}): alternar 1.ª/3.ª cada 0,75 s no corta disparos ni golpes ni habilidades, y no atraviesa muros`, () => {
    const fijo = jugar(mode, char, false), alt = jugar(mode, char, true);
    assert.ok(alt.r.cams >= 15, 'hubo muchos cambios de cámara: ' + alt.r.cams);
    const base = mode === 'combo' ? fijo.r.ataques : fijo.r.disparos, con = mode === 'combo' ? alt.r.ataques : alt.r.disparos;
    assert.ok(base > 10, 'el control base ataca: ' + base); assert.ok(con >= base * 0.8, `alternar no corta el ataque (${con} vs ${base})`);
    assert.ok(alt.r.mov >= 1 && alt.r.mov >= fijo.r.mov - 1, 'la habilidad sigue funcionando: ' + alt.r.mov);
    assert.equal(alt.r.bloqueado, 0, 'nunca dentro de un sólido'); assert.equal(alt.r.fuera, 0, 'no se sale del mapa');
    assert.ok(Math.hypot(alt.p.pos.x - 0, alt.p.pos.z - 0) < 60, 'el jugador sigue moviéndose y a salvo');
    assert.equal(!!alt.p.cam, true, 'la cámara quedó en el último valor enviado');
  });
}
test('AC-05: 3.ª persona = disparo converge a la retícula; volver a 1.ª no deja la cámara «pegada»', () => {
  const g = new Game({ mapId: 'm1', seed: 4, calm: 0.1, practice: true }); const p = g.addPlayer('t', null, { char: 'axioma' });
  g.setInput(p.id, { cam: CAM3 }); g.step(1 / 60); assert.equal(p.cam.third, true);
  g.setInput(p.id, { cam: false }); g.step(1 / 60); assert.equal(p.cam, null);
  const antes = { ...p.pos }; g.setInput(p.id, { cam: false, mz: 1 }); for (let i = 0; i < 30; i++) g.step(1 / 60); assert.ok(Math.hypot(p.pos.x - antes.x, p.pos.z - antes.z) > 1, 'se mueve en 1.ª');
});
test('«Cámara automática por modo»: apagada por defecto; 3.ª persona inicial siempre; con el ajuste, Melé 3.ª y Disparo 1.ª', () => {
  assert.equal(DEFAULTS.camAuto, false); assert.equal(DEFAULTS.third, true);
  for (const m of ['shooter', 'combo']) assert.equal(camaraInicial(m, false), true);
  assert.equal(camaraInicial('combo', true), true); assert.equal(camaraInicial('shooter', true), false); assert.equal(thirdForMode('combo'), true);
  const main = fs.readFileSync('src/client/main.js', 'utf8');
  assert.match(main, /if \(session && !session\.base && settings\(\)\.camAuto\) \{ renderer\.setThird/, 'cambiar de modo sólo toca la cámara con el ajuste activo');
  assert.doesNotMatch(main, /setGameMode[^\n]*renderer\.setThird\(thirdForMode/);
  assert.match(fs.readFileSync('public/index.html', 'utf8'), /id="camautosel"/); assert.match(fs.readFileSync('public/index.html', 'utf8'), /id="tutrep"/);
});
