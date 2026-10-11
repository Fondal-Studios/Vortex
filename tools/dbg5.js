import { Game } from '../src/sim/game.js';
import { makeBot } from '../src/sim/bot.js';
const [mapId, seed, skill] = [process.argv[2], +process.argv[3], +process.argv[4]||1];
const g = new Game({ mapId, seed }); const p = g.addPlayer(); const think = makeBot(g, p.id, { seed, skill });
let next = 400;
while (g.state === 'playing' && g.time < 1500) {
  g.setInput(p.id, think(1/30)); g.step(1/30); g.events.length = 0;
  if (g.time > next) { next += 100; const b = g.boss; console.log('t', g.time|0, 'wave', g.wave, 'p', p.pos.x|0, p.pos.y|0, p.pos.z|0, 'hp', p.hp|0, 'ammo', p.ammo.join(), 'boss', b && [b.hp|0, b.open, b.state, b.dead].join(), 'mons', g.monsters.map(m=>m.kind).join(',')); }
}
