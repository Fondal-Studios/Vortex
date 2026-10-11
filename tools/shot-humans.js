// Captura real de public/humans.html con Chromium (WebGL por software).
// Uso:  node tools/shot-humans.js [low|medium|high] [anim] [--q "set=roles&cam=close&..."] [--out shots/x.jpg] [--w 1280 --h 720]
//   · sin opciones extra: Pasajero/a + 4 jugadores en fila → shots/personas.jpg (medium) o personas-<q>.jpg
//   · --q añade parámetros de la demo (ver src/client/humans-demo.js); con frozen=1 la captura es determinista y mucho más rápida.
//   · varias capturas con una sola carga de Chromium: --multi "nombre1:consulta1;nombre2:consulta2"  → shots/<nombre>.jpg
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';

const args = process.argv.slice(2), opt = (k, d = '') => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const q = pos[0] || 'medium', anim = pos[1] || '', extra = opt('q'), W = Number(opt('w', 1280)), H = Number(opt('h', 720));
fs.mkdirSync('shots', { recursive: true });
const jobs = opt('multi') ? opt('multi').split(';').map((s) => { const [n, ...r] = s.split(':'); return { out: `shots/${n}.jpg`, query: r.join(':') }; })
  : [{ out: opt('out') || (q === 'medium' && !anim && !extra ? 'shots/personas.jpg' : `shots/personas-${q}${anim ? '-' + anim : ''}.jpg`), query: extra }];
const srv = await startServer({ port: 0 });
const b = await launch();
const errors = [], warns = [];
let code = 0;
for (const job of jobs) {
  const pg = await b.newPage({ viewport: { width: W, height: H } });
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); else if (m.type() === 'warning') warns.push(m.text()); });
  pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
  pg.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url()));
  pg.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const url = `http://localhost:${srv.port}/public/humans.html?q=${q}${anim ? '&anim=' + anim : ''}&w=${W}&h=${H}${job.query ? '&' + job.query : ''}`;
  await pg.goto(url);
  await pg.waitForFunction(() => window.__humansReady, null, { timeout: 180000 }).catch((e) => errors.push('TIMEOUT ' + e.message));
  await pg.waitForTimeout(Number(process.env.WAIT || (/frozen=1/.test(job.query) ? 300 : 5000)));
  await pg.screenshot({ path: job.out, type: 'jpeg', quality: 88 });
  const stats = await pg.evaluate(() => { const s = window.__humansStats; return s && { ...s, perHuman: s.perHuman?.map((p) => `${p.drawCalls}dc/${p.triangles}tri`) }; }).catch(() => null);
  console.log('captura:', job.out, ' ', url.replace(/^http:\/\/localhost:\d+/, '')); console.log('medidas:', JSON.stringify(stats));
  await pg.close();
}
console.log('errores de consola/página:', errors.length ? '\n  ' + [...new Set(errors)].join('\n  ') : 'ninguno');
console.log('avisos:', warns.length ? '\n  ' + [...new Set(warns)].slice(0, 8).join('\n  ') : 'ninguno');
if (errors.length) code = 1;
await b.close(); srv.close?.();
process.exit(code);
