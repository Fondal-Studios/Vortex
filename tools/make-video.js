// Video de demo: renderiza el juego CUADRO A CUADRO con reloj virtual (sale fluido aunque el render sea lento),
// registra los eventos de sonido para sintetizar la banda sonora y mezcla todo con ffmpeg.
//   node tools/make-video.js [--only id,id] [--fps 30] [--scale 1] [--workers 3] [--quality high] [--short]
import fs from 'node:fs'; import path from 'node:path';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const FPS = +arg('fps', 30), W = Math.round(1280 * +arg('scale', 1)), H = Math.round(720 * +arg('scale', 1)), WORKERS = +arg('workers', 3), Q = arg('quality', 'high'), SHORT = !!arg('short', false);
const ONLY = arg('only', '') ? String(arg('only', '')).split(',') : null; const OUT = '/tmp/claude-0/vid'; fs.mkdirSync(OUT, { recursive: true });
const sec = (s) => Math.round(s * FPS * (SHORT ? 0.15 : 1));

// ───────── guion del video ─────────
const BEAST = [['astilla', 'idle'], ['geoda', 'open'], ['prisma', 'wind'], ['lente', 'aim'], ['cuarzo', 'cast'], ['espejo', 'strike'], ['racimo', 'fuse'], ['graviton', 'charge'], ['obelisco', 'charge'], ['aurora', 'cast'], ['ariete', 'wind'], ['espiral', 'pull'], ['coloso', 'wind'], ['madre', 'open']];
const NAMES = { astilla: ['ASTILLA', 'corredor'], geoda: ['GEODA', 'tanque'], prisma: ['PRISMA', 'volador'], lente: ['LENTE', 'a distancia'], cuarzo: ['CUARZO', 'invocador'], espejo: ['ESPEJO', 'emboscador'], racimo: ['RACIMO', 'explosivo'], graviton: ['GRAVITÓN', 'control'], obelisco: ['OBELISCO', 'francotirador'], aurora: ['AURORA', 'sanadora'], ariete: ['ARIETE', 'embestidor'], espiral: ['ESPIRAL', 'atractor'], coloso: ['COLOSO PRISMÁTICO', 'jefe'], madre: ['MADRE GEODA', 'jefe'] };
const game = (extra) => `/?cap=1&q=${Q}&autoq=0&${extra}`;
const JOBS = [
  { id: '01-titulo', frames: sec(13), url: game('seed=3'), script: { 0: `ui.show('title')`, [sec(4.2)]: `ui.act('ok')`, [sec(7)]: `ui.act('down')`, [sec(8)]: `ui.act('down')`, [sec(9)]: `ui.act('down')`, [sec(10)]: `ui.act('up')`, [sec(10.7)]: `ui.act('up')`, [sec(11.5)]: `ui.act('up')` } },
  { id: '02-historia', frames: sec(34), url: game('seed=3'), script: { 0: `ui.act('ok'); ui.go('story')`, [sec(1.5)]: `document.getElementById('campaign').click()` } },
  { id: '03-isla', frames: sec(15), url: game('auto=m1&bot=1&god=1&wave=3&seed=11&skill=1.6'), title: ['CAPÍTULO 1', 'VACÍO DE ISLAS'] },
  { id: '04-coloso', frames: sec(11), url: game('auto=m1&bot=1&god=1&wave=7&seed=5&skill=1.6&look=boss'), title: ['JEFE', 'COLOSO PRISMÁTICO'] },
  { id: '05-fractal', frames: sec(14), url: game('auto=m2&bot=1&god=1&wave=4&seed=8&skill=1.6'), title: ['CAPÍTULO 2', 'CÁMARA FRACTAL'] },
  { id: '06-madre', frames: sec(10), url: game('auto=m2&bot=1&god=1&wave=7&seed=9&skill=1.6&look=boss'), title: ['JEFE', 'MADRE GEODA'] },
  ...BEAST.map(([k, s], i) => ({ id: `07-bestiario-${String(i).padStart(2, '0')}-${k}`, frames: sec(k === 'coloso' || k === 'madre' ? 2.6 : 1.9), viewer: `k=${k}&s=${s}&turn=1&v=0.7&big=1&cap=1&q=${Q}&dist=${k === 'coloso' || k === 'madre' ? 11 : 5.4}&cy=0.35`, beast: k })),
  { id: '08-final', frames: sec(6), url: '/public/endcard.html', endcard: true },
];

// ───────── ejecución ─────────
async function runJob(b, srvPort, job) {
  const dir = path.join(OUT, job.id); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const pg = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const url = job.viewer ? `/public/viewer.html?${job.viewer}` : job.url;
  await pg.goto(`http://localhost:${srvPort}${url}`); await pg.waitForTimeout(job.endcard ? 500 : 1500);
  if (job.viewer) await pg.evaluate(([n, r]) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:6vw;bottom:9vh;font-family:system-ui;color:#fff;text-shadow:0 0 12px #000'; d.innerHTML = `<div style="font-size:3.2vw;font-weight:200;letter-spacing:.3em">${n}</div><div style="font-size:1.3vw;letter-spacing:.3em;color:#7fb2ff;text-transform:uppercase">${r}</div>`; document.body.appendChild(d); }, NAMES[job.beast]);
  if (job.title) await pg.evaluate(([a, b2]) => { const d = document.createElement('div'); d.id = 'captitle'; d.style.cssText = 'position:fixed;left:6vw;top:11vh;z-index:40;font-family:"SF Pro Display","Helvetica Neue",Inter,system-ui,sans-serif;color:#fff;text-shadow:0 0 14px #000;animation:ct 4.5s ease both'; d.innerHTML = `<div style="font-size:1.2vw;letter-spacing:.5em;color:#7fb2ff">${a}</div><div style="font-size:3.6vw;font-weight:200;letter-spacing:.28em">${b2}</div>`; const st = document.createElement('style'); st.textContent = '@keyframes ct{0%{opacity:0;transform:translateX(-30px)}12%,80%{opacity:1;transform:none}100%{opacity:0}}'; document.head.append(st, d); }, job.title);
  const dtMs = 1000 / FPS; let vms = 0; const t0 = Date.now();
  for (let f = 0; f < job.frames; f++) {
    const code = job.script && job.script[f]; if (code) await pg.evaluate(`(() => { const ui = window.__ui; ${code} })()`);
    await pg.evaluate(([step, v, viewer]) => {
      for (const a of document.getAnimations()) { if (a.__t0 === undefined) a.__t0 = v - (a.currentTime || 0); a.pause(); a.currentTime = Math.max(0, v - a.__t0); }
      if (window.__step) window.__step(step); else if (window.__vframe) window.__vframe(step);
    }, [dtMs, vms, !!job.viewer]);
    await pg.screenshot({ path: path.join(dir, String(f).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 90 });
    vms += dtMs;
    if (f % 30 === 0) process.stdout.write(`[${job.id}] ${f}/${job.frames} (${((Date.now() - t0) / (f + 1) / 1000).toFixed(1)} s/cuadro)\n`);
  }
  const log = await pg.evaluate(() => window.__evlog || []); fs.writeFileSync(path.join(dir, 'events.json'), JSON.stringify(log));
  await pg.close(); return { id: job.id, frames: job.frames, errs };
}

const jobs = JOBS.filter((j) => !ONLY || ONLY.some((o) => j.id.includes(o)));
const srv = await startServer({ port: 0 }); const queue = [...jobs]; const results = [];
async function worker() { const b = await launch(); try { while (queue.length) { const j = queue.shift(); results.push(await runJob(b, srv.port, j)); } } finally { await b.close(); } }
await Promise.all(Array.from({ length: Math.min(WORKERS, jobs.length) }, worker));
await srv.close();
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ fps: FPS, w: W, h: H, jobs: JOBS.map((j) => ({ id: j.id, frames: j.frames })) }));
console.log('listo:', results.map((r) => `${r.id}:${r.frames}${r.errs.length ? ' ERR ' + r.errs[0] : ''}`).join('\n  '));
