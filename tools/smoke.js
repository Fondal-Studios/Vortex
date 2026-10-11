import { Game } from '../src/sim/game.js';
for (const mapId of ['m1','m2']) {
  const g = new Game({ mapId, seed: 3 }); const p = g.addPlayer();
  for (let i = 0; i < 30*40; i++) { g.setInput(p.id, { mz: 1, fire: true }); g.step(1/30); }
  const s = g.snapshot();
  console.log(mapId, s.wave, s.monsters.length, s.players[0].hp, JSON.stringify(s.players[0].pos));
}
