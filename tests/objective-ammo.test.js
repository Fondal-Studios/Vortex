import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { WEAPONS } from '../src/sim/data.js';
import { ammoMax, upgOf } from '../src/sim/loadout.js';
import { makeObjective, updateObjective } from '../src/sim/objectives.js';

for (const char of ['vesper', 'micelio']) {
  test(`objetivo: repone el arsenal equipado de ${char}, conserva munición infinita y respeta mejoras`, () => {
    const g = new Game({ mapId: 'm1', seed: 7 });
    const p = g.addPlayer('recompensa', null, { char });
    const finite = p.slots.filter((w) => Number.isFinite(WEAPONS[w].max));
    const boosted = finite[0];
    upgOf(p, boosted).mag = 2;
    p.ammo = WEAPONS.map((w) => w.max === Infinity ? Infinity : 0);
    p.ammo[boosted] = ammoMax(p, boosted) - 1;
    const before = p.ammo.slice();
    g.objective = makeObjective(g, 2);
    p.pos = { ...g.objects.find((o) => o.id === g.objective.ids[0]).pos };
    g.objective.prog = 0.999;
    updateObjective(g, 1);
    assert.equal(g.objective.state, 'done');
    for (let w = 0; w < WEAPONS.length; w++) {
      const expected = finite.includes(w)
        ? Math.min(ammoMax(p, w), before[w] + Math.ceil(WEAPONS[w].max * 0.3))
        : before[w];
      assert.equal(p.ammo[w], expected, `${char}: munición del arma ${w}`);
    }
  });
}
