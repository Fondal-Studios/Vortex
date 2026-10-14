// Tres estilos de combate (melé, disparo, habilidades): cada Huésped debe poder limpiar la misma oleada con cualquiera,
// y ninguno debe ser mucho mejor que otro (equilibrio). Bot simple por estilo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { HOST_IDS, STYLES } from '../src/sim/data.js';
import { v3, sub, norm, dot, len, mul, add } from '../src/sim/math.js';

const WAVE = [['astilla', 14], ['astilla', 16], ['astilla', 18], ['racimo', 20], ['lente', 24], ['lente', 26], ['geoda', 22], ['ariete', 20]];
function duel(host, style, seed = 3) {
  const g = new Game({ mapId: 'm1', seed, magazines: true }); g.phaseT = 1e9;
  const p = g.addPlayer('t', null, { char: host, style }); p.hp = 100; p.shield = 100;
  for (let i = 0; i < WAVE.length; i++) { const [k, d] = WAVE[i], a = (i / WAVE.length) * Math.PI * 2; const m = g.spawnMonster(k, { x: p.pos.x + Math.cos(a) * d * 0.5, y: p.pos.y + 0.5, z: p.pos.z + Math.sin(a) * d * 0.5 }, { noElite: true }); if (m) m.cd = 1 + i * 0.3; }
  let t = 0, lost = 0; const T = 90;
  for (; t < T; t += 1 / 60) {
    const alive = g.monsters.filter((m) => !m.dead); if (!alive.length || p.dead) break;
    let best = alive[0], bd = Infinity; for (const m of alive) { const dd = len(sub(m.pos, p.pos)); if (dd < bd) { bd = dd; best = m; } }
    const to = sub(best.pos, g.eyePos(p)), flat = norm(sub(to, mul(p.up, dot(to, p.up))), p.heading); p.heading = flat; p.pitch = Math.asin(Math.max(-1, Math.min(1, dot(norm(to), p.up))));
    const inp = { mz: 0, fire: false, melee: false, mov: false, esp: false, s3: false, ult: false };
    const tick = Math.round(t * 60);
    if (style === 'melee') { if (bd > 3 + best.r) inp.mz = 1; else inp.melee = tick % 20 < 8; }
    else if (style === 'disparo') { inp.fire = true; if (bd < 6) inp.mz = -1; }
    else { inp.fire = tick % 2 === 0; inp.esp = tick % 30 < 3; inp.s3 = tick % 30 >= 10 && tick % 30 < 13; inp.mov = bd < 8 && tick % 40 < 3; inp.ult = tick % 50 < 3; if (bd < 6) inp.mz = -1; }
    g.setInput(p.id, inp); g.step(1 / 60);
  }
  lost = 100 + 100 - p.hp - p.shield;
  return { t: +t.toFixed(1), clear: !g.monsters.some((m) => !m.dead), dead: p.dead, lost: Math.round(lost) };
}

test('estilos: los 3 existen con descripción', () => { for (const k of ['melee', 'disparo', 'habilidad']) assert.ok(STYLES[k] && STYLES[k].name && STYLES[k].desc); });

test('equilibrio: con cada Huésped, los 3 estilos limpian la misma oleada y ninguno tarda más del doble que otro', { timeout: 300000 }, () => {
  const rows = {};
  for (const h of HOST_IDS) {
    rows[h] = {}; for (const st of ['melee', 'disparo', 'habilidad']) rows[h][st] = duel(h, st);
    for (const st of ['melee', 'disparo', 'habilidad']) assert.ok(rows[h][st].clear && !rows[h][st].dead, `${h} con ${st}: ${JSON.stringify(rows[h][st])}`);
    const ts = Object.values(rows[h]).map((r) => r.t); assert.ok(Math.max(...ts) / Math.min(...ts) < 2, `${h}: tiempos ${JSON.stringify(rows[h])}`);
  }
  const avg = (st) => HOST_IDS.reduce((a, h) => a + rows[h][st].t, 0) / HOST_IDS.length;
  const A = { melee: avg('melee'), disparo: avg('disparo'), habilidad: avg('habilidad') };
  console.log('tiempos medios por estilo (s)', JSON.stringify(A)); console.log(JSON.stringify(rows));
  assert.ok(Math.max(...Object.values(A)) / Math.min(...Object.values(A)) < 1.5, 'en promedio los estilos rinden parecido');
});
