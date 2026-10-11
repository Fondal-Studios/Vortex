import { Game } from '../src/sim/game.js';
import { makeBot } from '../src/sim/bot.js';
const g = new Game({ mapId: 'm1', seed: 2 }); const p = g.addPlayer(); const think = makeBot(g, p.id, { seed: 2 });
let shots = 0, hits = 0, wcount = [0,0,0,0,0], fireTicks=0, ticks=0;
while (g.state === 'playing' && g.time < 100) {
  const i = think(1/30); if (p.dead) break; g.setInput(p.id, i); g.step(1/30);
  ticks++; if (i.fire) fireTicks++; wcount[p.weapon]++;
  for (const e of g.events) { if (e.t==='shot') shots++; if (e.t==='hit') hits++; }
  g.events.length = 0;
}
console.log({ shots, hits, wcount, fireTicks, ticks, kills: g.stats.kills });
