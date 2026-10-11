import { Game } from '../src/sim/game.js';
import { makeBot } from '../src/sim/bot.js';
const g = new Game({ mapId: 'm1', seed: 1 }); const p = g.addPlayer(); const think = makeBot(g, p.id, { seed: 1 });
const orig = g.playerFell.bind(g);
g.playerFell = (q) => { console.log('FELL t', g.time.toFixed(1), 'pos', q.pos.x.toFixed(1), q.pos.y.toFixed(1), q.pos.z.toFixed(1), 'vel', q.vel.x.toFixed(1), q.vel.y.toFixed(1), q.vel.z.toFixed(1), 'flip', g.time<q.flipUntil); orig(q); };
while (g.state === 'playing' && g.time < 110) { g.setInput(p.id, think(1/30)); g.step(1/30); g.events.length = 0; }
