// Apariciones justas: señal previa (omen), nunca encima ni a la espalda del jugador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { dist, dot, norm, sub, project } from '../src/sim/math.js';

test('cada aparición avisa 1,1 s antes y no nace pegada ni a la espalda del jugador', () => {
  const g = new Game({ mapId: 'm1', seed: 11 }); const p = g.addPlayer('t'); p.hp = 1e6; p.shield = 1e6;
  const omens = [], born = []; let behind = 0, total = 0;
  const seen = new Set();
  for (let i = 0; i < 60 * 90; i++) {
    g.step(1 / 60);
    for (const e of g.drainEvents ? g.drainEvents() : []) if (e.t === 'omen') omens.push({ t: g.time, e });
    for (const m of g.monsters) if (!seen.has(m.id)) { seen.add(m.id); born.push({ t: g.time, m, at: { ...m.pos }, d: dist(m.pos, p.pos), h: p.heading, up: p.up, pp: { ...p.pos } }); }
  }
  assert.ok(omens.length >= 5 && born.length >= 5, `hubo apariciones (${omens.length}/${born.length})`);
  for (const o of omens) assert.equal(o.e.in, 1.1);
  for (const b of born) { if (b.m.def.boss || !b.m.omen) continue; total++; assert.ok(b.d > 8, `no nace pegado (${b.d.toFixed(1)})`); const to = norm(project(sub(b.at, b.pp), b.up)); if (dot(to, b.h) < -0.4) behind++; }
  assert.ok(behind / total < 0.2, `casi nada a la espalda (${behind}/${total})`);
});
