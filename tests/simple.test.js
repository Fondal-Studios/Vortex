// Modo simple: quien no sabe jugar shooters sólo mueve y mira; el juego dispara solo con un enemigo en la mira y golpea solo de cerca.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from '../server/server.js';
import { browserAvailable } from '../tools/browser.js';
const hasChromium = browserAvailable();
const simWait = (pg, secs) => pg.evaluate((d) => new Promise((r) => { const g = window.__api.session.game, t0 = g.time; const iv = setInterval(() => { if (g.time - t0 >= d) { clearInterval(iv); r(); } }, 30); }), secs);

test('modo simple: dispara solo al enemigo en la mira y golpea solo de cerca; apagado no hace nada', { skip: !hasChromium, timeout: 120000 }, async () => {
  const { launch } = await import('../tools/browser.js');
  const srv = await startServer({ port: 0 }); const b = await launch(); const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  try {
    await pg.goto(`http://localhost:${srv.port}/?auto=m1&nolock=1&skipintro=1&god=1&seed=2&q=low&autoq=0`); await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game);
    await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Entendido/.test(x.textContent)); if (b) b.click(); });
    const put = (d) => pg.evaluate((d) => { const g = window.__api.session.game, p = g.players[0]; g.queue = []; g.omens = []; for (const m of g.monsters) m.dead = true; g.phaseT = 1e9; const h = p.heading, m = g.spawnMonster('astilla', { x: p.pos.x + h.x * d, y: p.pos.y, z: p.pos.z + h.z * d }); m.passive = true; m.hp = m.maxhp = 1e5; m.cd = 1e9; return m.id; }, d);
    const hp = (id) => pg.evaluate((id) => { const m = window.__api.session.game.monsters.find((q) => q.id === id); return m ? m.hp : 0; }, id);
    await pg.evaluate(() => window.__api.setSetting && window.__api.setSetting('simple', true));
    const far = await put(14); await simWait(pg, 2); assert.ok(await hp(far) < 1e5 - 20, 'enemigo lejano en la mira: disparó solo');
    const near = await put(2.4); await simWait(pg, 2.5); const ev = await pg.evaluate(() => window.__api.session.game.players[0].cmb); assert.ok(await hp(near) < 1e5 - 20 && ev >= 0, 'enemigo pegado: golpeó solo');
    await pg.evaluate(() => window.__api.setSetting('simple', false)); const off = await put(14); await simWait(pg, 2); assert.equal(await hp(off), 1e5, 'con el modo simple apagado no dispara solo');
    assert.deepEqual(errs, []);
  } finally { await b.close(); await srv.close(); }
});
