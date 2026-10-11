import { Game } from '../src/sim/game.js';
import { makeBot } from '../src/sim/bot.js';
export function playMatch({ mapId, seed, players = 1, skill = +process.env.SKILL || 1, maxSeconds = 1500, dt = 1 / 60, difficulty = 1 }) {
  const g = new Game({ mapId, seed, difficulty });
  const bots = [];
  for (let i = 0; i < players; i++) { const p = g.addPlayer('bot' + i); bots.push([p.id, makeBot(g, p.id, { seed: seed + i, skill })]); }
  let waveAt = {}, lastProgress = 0, lastLeft = -1, stall = 0, maxStall = 0, hpLost = 0;
  const t0 = performance.now();
  while (g.state === 'playing' && g.time < maxSeconds) {
    for (const [id, think] of bots) g.setInput(id, think(dt));
    g.step(dt);
    if (!(g.wave in waveAt)) waveAt[g.wave] = +g.time.toFixed(1);
    const left = g.queue.length + g.monsters.length + (g.boss && !g.boss.dead ? Math.round(g.boss.hp / 20) : 0);
    if (left !== lastLeft || g.phase === 'intermission') { lastLeft = left; lastProgress = g.time; }
    maxStall = Math.max(maxStall, g.time - lastProgress);
    for (const p of g.players) if (!Number.isFinite(p.pos.x)) throw new Error('NaN en jugador');
    g.events.length = 0;
  }
  return { state: g.state, wave: g.wave, time: +g.time.toFixed(1), waveAt, maxStall: +maxStall.toFixed(1), kills: g.stats.kills, maxAlive: g.stats.maxAlive, cpuMs: +(performance.now() - t0).toFixed(0), hp: g.players.map((p) => p.hp), g };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const mapId of ['m1', 'm2']) for (const seed of [1, 2, 3, 4, 5, 6]) {
    const r = playMatch({ mapId, seed, players: +process.env.PLAYERS || 1, difficulty: +process.env.DIFF || 1 });
    const { g, ...rest } = r;
    console.log(mapId, 'seed', seed, JSON.stringify(rest));
  }
}
