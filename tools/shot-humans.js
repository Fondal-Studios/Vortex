// Captura real de public/humans.html con Chromium (WebGL por software): Pasajero/a + 4 jugadores en fila.
// Uso: node tools/shot-humans.js [low|medium|high] [animación-forzada]   → shots/personas.jpg (o personas-<q>.jpg)
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';

const q = process.argv[2] || 'medium', anim = process.argv[3] || '';
fs.mkdirSync('shots', { recursive: true });
const out = q === 'medium' && !anim ? 'shots/personas.jpg' : `shots/personas-${q}${anim ? '-' + anim : ''}.jpg`;
const srv = await startServer({ port: 0 });
const b = await launch();
const errors = [], warns = [];
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); else if (m.type() === 'warning') warns.push(m.text()); });
pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
pg.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url()));
pg.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
await pg.goto(`http://localhost:${srv.port}/public/humans.html?q=${q}${anim ? '&anim=' + anim : ''}`);
await pg.waitForFunction(() => window.__humansReady, null, { timeout: 120000 }).catch((e) => errors.push('TIMEOUT ' + e.message));
await pg.waitForTimeout(Number(process.env.WAIT || 5000));
await pg.screenshot({ path: out, type: 'jpeg', quality: 85 });
const stats = await pg.evaluate(() => window.__humansStats).catch(() => null);
console.log('captura:', out); console.log('medidas:', JSON.stringify(stats));
console.log('errores de consola/página:', errors.length ? '\n  ' + errors.join('\n  ') : 'ninguno');
console.log('avisos:', warns.length ? '\n  ' + [...new Set(warns)].slice(0, 8).join('\n  ') : 'ninguno');
await b.close(); srv.close?.();
process.exit(errors.length ? 1 : 0);
