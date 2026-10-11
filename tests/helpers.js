import { Game } from '../src/sim/game.js';
import { v3, madd, add, sub, mul, norm } from '../src/sim/math.js';

/** Partida de 1 jugador sin oleadas (sólo lo que el test spawnea) y jugador casi invulnerable. */
export function arena(mapId = 'm1', { seed = 1, hp = 1e6 } = {}) {
  const g = new Game({ mapId, seed });
  const p = g.addPlayer('t');
  g.phaseT = 1e9; // sin oleadas automáticas
  p.hp = hp; p.shield = 100;
  return { g, p };
}
export const run = (g, seconds, fn, dt = 1 / 60) => {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) { if (fn) fn(i * dt, i); g.step(dt); }
};
/** Punto a `d` unidades delante del jugador (en su plano tangente). */
export const ahead = (p, d, lift = 0) => madd(madd(p.pos, p.heading, d), p.up, lift);
export const sum = (a) => a.reduce((x, y) => x + y, 0);
export function hash(snap) {
  const s = JSON.stringify({ ...snap, events: undefined });
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export { v3, madd, add, sub, mul, norm };
