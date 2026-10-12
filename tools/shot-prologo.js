// Capturas del prólogo «La Estación» (una por escena + extras) y medición de draw calls / triángulos en calidad Baja.
//   node tools/shot-prologo.js [carpeta=shots/prologo] [calidad=low]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const out = process.argv[2] || 'shots/prologo', q = process.argv[3] || 'low'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
await pg.goto(`http://localhost:${srv.port}/?prologo=1&prologo_manual=1&q=${q}&autoq=0&nolock=1`);
await pg.waitForFunction(() => window.__prologo, null, { timeout: 30000 });
const P = (fn, arg) => pg.evaluate(fn, arg);
const adv = (secs, view) => P(({ secs, view }) => { const p = window.__prologo; let r = secs; while (r > 1e-6) { const s = Math.min(1 / 30, r); r -= s; p.step(s); } p.tick(0); if (view) { p.setPlayer(view[0], view[1], view[2], view[3]); p.tick(0); } return p.info(); }, { secs, view });
const info = [];
const shot = async (name, secs, view) => { const i = await adv(secs, view); const st = await P(() => window.__prologo.state()); await pg.screenshot({ path: `${out}/${name}.png` }); info.push({ name, ...i, scene: st.scene, obj: st.objective }); console.log(name, JSON.stringify(i), '|', st.sceneName, '|', st.objective, '|', st.sub); };
await shot('1a-espera', 2.0);
await shot('1b-espera-cartel', 0.1, [3.4, 4.9, 2.0, 0.1]);
await P(() => window.__prologo.skipTo(1)); await shot('2a-tren-llega', 3.0, [3, 4.5, 1.9, 0.05]);
await shot('2b-persona-se-tambalea', 3.0); await shot('2c-cae-inclinada', 2.4); await shot('2d-cae-en-el-aire', 0.9); await shot('2e-en-las-vias', 2.2);
await P(() => window.__prologo.skipTo(2)); await shot('3a-ruptura-inicio', 1.8); await shot('3b-ruptura-membrana', 2.6); await shot('3c-ruptura-tejido', 4.0); await shot('3d-ruptura-final', 2.6);
await P(() => window.__prologo.skipTo(3)); await shot('4a-entidad', 3.4, [2.5, 3.2, 1.35, 0.3]); await shot('4b-espora-y-mano', 3.0, [2.5, 3.2, 1.35, 0.1]); await shot('4c-organismo-listo', 3.2);
await adv(2.5); await shot('4d-blanco', 0.1);
await P(() => window.__prologo.fire()); await shot('4e-disparo-en-vuelo', 0.12); await P(() => window.__prologo.releaseFire());
await shot('4f-impacto', 0.12);
await P(() => window.__prologo.skipTo(4)); await shot('5a-decision', 3.5, [-8, 3.4, Math.PI / 2, 0.05]); await P(() => window.__prologo.setPlayer(-13.8, 2.2, Math.PI / 2, 0.1));
await P(() => window.__prologo.use()); await shot('5b-mecanismo-activado', 0.3);
await shot('5c-umbral-abierto', 2.5, [-18.6, 3.2, Math.PI / 2, 0.05]);
fs.writeFileSync(`${out}/medidas-${q}.json`, JSON.stringify(info, null, 1));
console.log('errores:', errs.length ? errs.slice(0, 8) : 'ninguno');
await b.close(); await srv.close();
