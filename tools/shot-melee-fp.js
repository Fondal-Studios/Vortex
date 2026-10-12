// Capturas del arma fusionada en PRIMERA PERSONA (viewmodel de hostfx-melee.js). Uso: node tools/shot-melee-fp.js [carpeta]
// Para cada Huésped/arma/nivel de la lista: inicia una partida, equipa el arma por la simulación y levanta el melee (mantener V) para ver el arma en la mano.
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/evolucion'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [];
const CASES = [['axioma', 'sable_plasma', 0], ['axioma', 'sable_plasma', 3], ['seraf', 'lanza_sinaptica', 2], ['micelio', 'martillo_sismico', 4]];
for (const [char, mw, evo] of CASES) {
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } }), pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  pg.setDefaultTimeout(120000);
  await pg.addInitScript((c) => { try { localStorage.setItem('cristal.huesped.v1', c); } catch { /* ok */ } }, char);
  await pg.goto(`${base}/?q=low&autoq=0&auto=m1&god=1&skipintro=1&nolock=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 120000 }); await pg.waitForTimeout(1500); await pg.getByText('Entendido').click({ timeout: 5000 }).catch(() => {}); await pg.waitForTimeout(400);
  await pg.evaluate(([m, e]) => { const q = window.__api.session.game.players[0]; q.melee = m; q.evo = e; }, [mw, evo]); await pg.waitForTimeout(600);
  await pg.keyboard.down('KeyV'); await pg.waitForTimeout(1100); await pg.screenshot({ path: `${OUT}/fp-${char}-${mw}-t${evo}-carga.png` });
  await pg.keyboard.up('KeyV'); await pg.waitForTimeout(260); await pg.screenshot({ path: `${OUT}/fp-${char}-${mw}-t${evo}-golpe.png` });
  await ctx.close();
}
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'sin errores JS'); await b.close(); await srv.close();
