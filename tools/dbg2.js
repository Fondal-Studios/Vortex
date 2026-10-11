import { Game } from '../src/sim/game.js';
import { makeBot } from '../src/sim/bot.js';
const [mapId, seed] = [process.argv[2], +process.argv[3]];
const g = new Game({ mapId, seed }); const p = g.addPlayer(); const think = makeBot(g, p.id, { seed });
let acc = {}, nextLog = 10;
while (g.state === 'playing' && g.time < 600) {
  g.setInput(p.id, think(1/30)); g.step(1/30);
  for (const e of g.events) if (e.t === 'hurt') {
    // atribuir al más cercano
    let k = 'void/otro', bd = 4.5;
    for (const m of g.monsters) { const d = Math.hypot(m.pos.x-p.pos.x,m.pos.y-p.pos.y,m.pos.z-p.pos.z); if (d < bd) { bd = d; k = m.kind; } }
    if (k === 'void/otro' && g.projectiles.some(q=>q.owner==='m')) k = 'proyectil';
    acc[k] = (acc[k]||0) + e.dmg;
  }
  g.events.length = 0;
  if (g.time > nextLog) { nextLog += 4; console.log('t', g.time|0, 'w', g.wave, 'hp', p.hp|0, 'sh', p.shield|0, 'alive', g.monsters.length, JSON.stringify(Object.fromEntries(Object.entries(acc).map(([a,b])=>[a,b|0])))); acc = {}; }
}
console.log(g.state);
