import { Game } from '../src/sim/game.js';
import { makeBot } from '../src/sim/bot.js';
const [mapId, seed] = [process.argv[2], +process.argv[3]];
const g = new Game({ mapId, seed }); const p = g.addPlayer(); const think = makeBot(g, p.id, { seed });
let last = 0, lastLeft = -1, lt = 0;
while (g.state === 'playing' && g.time < 600) {
  g.setInput(p.id, think(1/30)); g.step(1/30); g.events.length = 0;
  const left = g.queue.length + g.monsters.length;
  if (left !== lastLeft) { lastLeft = left; lt = g.time; }
  if (g.time - lt > 25 && g.time - last > 25) {
    last = g.time;
    console.log('t', g.time.toFixed(0), 'wave', g.wave, 'queue', g.queue.length, 'player', p.pos.x.toFixed(1), p.pos.y.toFixed(1), p.pos.z.toFixed(1), 'hp', p.hp|0, 'ammo', p.ammo.join());
    for (const m of g.monsters) console.log('  ', m.kind, m.state, 'pos', m.pos.x.toFixed(1), m.pos.y.toFixed(1), m.pos.z.toFixed(1), 'd', (Math.hypot(m.pos.x-p.pos.x,m.pos.y-p.pos.y,m.pos.z-p.pos.z)).toFixed(1), 'hp', m.hp|0, 'cloak', m.cloak, 'open', m.open);
  }
}
