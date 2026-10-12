// Capturas de las 12 habilidades de héroes + las 4 de equipo (skillfx.js) con el juego real.
// Uso: node tools/shot-heroes-fx.mjs [q=low] [salida=shots/gate/heroes] [filtro: egida:mov,umbra:esp,team:vanguardia ...]
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const q = process.argv[2] || 'low', out = process.argv[3] || 'shots/gate/heroes', filter = (process.argv[4] || '').split(',').filter(Boolean);
fs.mkdirSync(out, { recursive: true });
const HEROES = ['egida', 'lumen', 'forja', 'vigia', 'nova', 'umbra'];
const JOBS = [];
for (const h of HEROES) for (const k of ['mov', 'esp']) JOBS.push({ name: `${h}-${k}`, hero: h, kind: k });
for (const [role, hero] of [['vanguardia', 'egida'], ['soporte', 'lumen'], ['ingeniero', 'forja'], ['explorador', 'vigia']]) JOBS.push({ name: `equipo-${role}`, hero, kind: 'team' });
const TIMES = { default: [[0.07, 1 / 30], [0.2, 1 / 20], [0.45, 1 / 12], [0.9, 1 / 8]] };
const CAMS = { // yaw: ángulo alrededor del héroe (0 = detrás) · fixed: cámara quieta (para habilidades que lo desplazan) · fwd: mira hacia adelante
  'egida-mov': { yaw: 1.15, dist: 13, lift: 3.4, fwd: 6, fixed: true }, 'egida-esp': { yaw: 0.85, dist: 12, lift: 4, fwd: 8, fixed: true }, 'lumen-mov': { yaw: 1.2, dist: 17, lift: 4.5, fwd: 7, fixed: true }, 'lumen-esp': { yaw: 0.7, dist: 11, lift: 3.5, fwd: 6, fixed: true },
  'forja-mov': { yaw: 1.2, dist: 11, lift: 5, fwd: 0, aimAt: 5, fixed: true }, 'forja-esp': { yaw: 0.7, dist: 14, lift: 4, fwd: 12, fixed: true }, 'vigia-mov': { yaw: 1.25, dist: 11, lift: 2.6, fwd: 5, fixed: true }, 'vigia-esp': { yaw: 0.7, dist: 11, lift: 3, fwd: 14, fixed: true },
  'nova-mov': { yaw: 1.2, dist: 14, lift: 5, fwd: 2, aimAt: 7, fixed: true }, 'nova-esp': { yaw: 0.9, dist: 10, lift: 2.6, fwd: 9, fixed: true }, 'umbra-mov': { yaw: 1.2, dist: 13, lift: 3.4, fwd: -4, fixed: true }, 'umbra-esp': { yaw: 0.8, dist: 14, lift: 4.5, fwd: 12, fixed: true },
  'equipo-vanguardia': { yaw: 0.8, dist: 15, lift: 5, fwd: 0, fixed: true }, 'equipo-soporte': { yaw: 0.8, dist: 16, lift: 5.5, fwd: 3, fixed: true }, 'equipo-ingeniero': { yaw: 0.8, dist: 11, lift: 3.5, fwd: 0, fixed: true }, 'equipo-explorador': { yaw: 0.8, dist: 24, lift: 10, fwd: 8, fixed: true },
};
const srv = await startServer({ port: 0 }); const b = await launch(); const base = `http://localhost:${srv.port}`; const errors = [];
const W = +process.env.W || 800, H = +process.env.H || 450;
const pg = await b.newPage({ viewport: { width: W, height: H } });
pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); }); pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
const FP = process.env.FP === '1';
await pg.goto(`${base}/public/skillfx-demo.html?q=${q}${FP ? '&third=0' : ''}`); await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 }); await pg.waitForTimeout(1500);
const report = [];
for (const job of JOBS) {
  if (filter.length && !filter.some((f) => job.name.includes(f.replace(':', '-')))) continue;
  const cam = CAMS[job.name] || {};
  await pg.evaluate(({ hero, cam, FP }) => { const d = window.__demo; d.setup(hero); d.cam({ on: !FP, dist: 12, yaw: 0.8, lift: 3.5, aimAt: 1.2, fwd: 0, ...cam, fixed: FP ? false : cam.fixed }); d.run(0.2, 1 / 10); }, { hero: job.hero, cam, FP });
  await pg.evaluate((kind) => window.__demo.cast(kind), job.kind);
  let prev = 0, peak = null; const files = [];
  for (const [i, [t, step]] of TIMES.default.entries()) {
    const st = await pg.evaluate(([dt, step]) => { window.__demo.run(dt, step); return window.__demo.stats(); }, [Math.max(step, t - prev), step]); prev = t;
    if (!peak || st.fx.add + st.fx.smoke > peak.fx.add + peak.fx.smoke) peak = st;
    const f = `${out}/${FP ? 'fp-' : ''}${job.name}-${i}.jpg`; await pg.screenshot({ path: f, type: 'jpeg', quality: 82 }); files.push(f);
  }
  try { execSync(`montage ${files.join(' ')} -tile 2x2 -geometry ${W}x${H}+3+3 -background '#05030c' ${out}/hoja-${FP ? 'fp-' : ''}${job.name}.jpg`); } catch { /* sin ImageMagick */ }
  report.push({ name: job.name, peak });
  console.log(job.name, JSON.stringify(peak));
}
fs.writeFileSync(`${out}/stats-${q}.json`, JSON.stringify(report, null, 1));
console.log(errors.length ? 'ERRORES:\n' + errors.slice(0, 8).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
