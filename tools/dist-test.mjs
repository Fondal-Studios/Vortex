// Prueba del sitio publicado (GitHub Pages): sirve dist/ bajo un subdirectorio (/Shower-psico/) y revisa que cargue sin 404 y que el juego arranque.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { launch } from './browser.js';
const ROOT = path.resolve('dist'), PREFIX = '/Shower-psico/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary' };
const srv = http.createServer((q, r) => {
  let u = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (!u.startsWith(PREFIX)) { r.writeHead(404); return r.end('fuera de prefijo'); }
  u = u.slice(PREFIX.length) || 'index.html'; if (u.endsWith('/')) u += 'index.html'; const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no existe ' + u); }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
await new Promise((res) => srv.listen(0, res)); const port = srv.address().port;
const b = await launch(); const bad = [], errors = [];
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const pg = await ctx.newPage();
pg.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(`http://localhost:${port}`, '')}`); });
pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await pg.goto(`http://localhost:${port}${PREFIX}?q=low`); await pg.waitForTimeout(3000);
await pg.evaluate(() => { const a = window.__api; a.ui.confirmTitle(); a.ui.show('arenas'); });
await pg.waitForTimeout(800);
const bestiary = await pg.evaluate(() => { window.__api.ui.show('bestiary'); return !!document.querySelector('#bview'); }); await pg.waitForTimeout(2500);
await pg.evaluate(() => { window.__api.ui.show('main', false); });
await pg.evaluate(() => document.querySelector('[data-start="m1"]').click()); await pg.waitForTimeout(9000);
const st = await pg.evaluate(() => { const s = window.__api.session; return { playing: !!s, wave: s && s.game && s.game.wave, hud: !document.getElementById('hud').classList.contains('hidden') }; });
await pg.screenshot({ path: '/tmp/dist-movil.jpg', type: 'jpeg', quality: 70 });
console.log('estado', JSON.stringify(st), 'bestiario', bestiary);
console.log('recursos con error:', bad.length ? '\n' + [...new Set(bad)].slice(0, 15).join('\n') : 'ninguno'); console.log('errores JS:', errors.length ? errors.slice(0, 5).join('\n') : 'ninguno');
await b.close(); srv.close();
