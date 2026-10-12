// Capturas y medición de los efectos de los 5 Huéspedes (hostfx.js) con el render real, en calidad Baja por defecto.
// Uso: node tools/shot-hostfx.js [q=low] [salida=shots/hostfx] [filtro,filtro...]   (filtro: parte del nombre, ej. "vesper,melee-seraf")
// Genera una hoja de contacto por efecto (hoja-<nombre>.jpg, 4 instantes), stats-<q>.json con draw calls / partículas y avisa de errores de consola.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const q = process.argv[2] || 'low', out = process.argv[3] || 'shots/hostfx', filter = (process.argv[4] || '').split(',').filter(Boolean);
fs.mkdirSync(out, { recursive: true });
const BF = { cap: 1, cam: 2, sob: 4, fre: 8, flo: 16, met: 32, des: 64, pla: 128, bar: 256 };
// cámara por defecto: 3.ª persona detrás-izquierda; `fixed` ancla la cámara al punto de lanzamiento (habilidades que desplazan al jugador)
const JOBS = [
  { name: 'axioma-impulso', host: 'axioma', id: 'impulso', k: 'mov', push: 30, cam: { yaw: 1.15, dist: 12, lift: 3.4, fwd: 5, fixed: true } },
  { name: 'axioma-espinas', host: 'axioma', id: 'espinas', k: 'esp', cam: { yaw: 0.9, dist: 7, lift: 2.5, fwd: 7, fixed: true } },
  { name: 'axioma-caparazon', host: 'axioma', id: 'caparazon', k: 's3', bf: BF.cap, cam: { yaw: 0.9, dist: 8, lift: 2.4, fwd: 0 } },
  { name: 'axioma-sobrecarga', host: 'axioma', id: 'sobrecarga', k: 'ult', bf: BF.sob, cam: { yaw: 0.9, dist: 10, lift: 3, fwd: 0 } },
  { name: 'vesper-paso', host: 'vesper', id: 'paso', k: 'mov', cam: { yaw: 1.2, dist: 13, lift: 3.4, fwd: 4, fixed: true }, move: 8 },
  { name: 'vesper-camuflaje', host: 'vesper', id: 'camuflaje', k: 'esp', bf: BF.cam, cam: { yaw: 0.9, dist: 8, lift: 2.4, fwd: 0 } },
  { name: 'vesper-marca', host: 'vesper', id: 'marca', k: 's3', mark: [0, 2], cam: { yaw: 0.6, dist: 9, lift: 3, fwd: 8 } },
  { name: 'vesper-frenesi', host: 'vesper', id: 'frenesi', k: 'ult', bf: BF.fre, cam: { yaw: 0.9, dist: 10, lift: 3, fwd: 0 } },
  { name: 'micelio-barrera', host: 'micelio', id: 'barrera', k: 'mov', bf: BF.bar, cam: { yaw: 0.9, dist: 10, lift: 3, fwd: 4, fixed: true } },
  { name: 'micelio-esporas', host: 'micelio', id: 'esporas', k: 'esp', cam: { yaw: 0.8, dist: 13, lift: 4.5, fwd: 6, fixed: true } },
  { name: 'micelio-biomasa', host: 'micelio', id: 'biomasa', k: 's3', cam: { yaw: 0.8, dist: 12, lift: 4, fwd: 4, fixed: true } },
  { name: 'micelio-floracion', host: 'micelio', id: 'floracion', k: 'ult', bf: BF.flo, cam: { yaw: 0.8, dist: 15, lift: 7, fwd: 0, fixed: true } },
  { name: 'umbra-fase', host: 'umbra', id: 'fase', k: 'mov', cam: { yaw: 1.2, dist: 13, lift: 3.4, fwd: -4, fixed: true }, move: -8 },
  { name: 'umbra-singularidad', host: 'umbra', id: 'singularidad', k: 'esp', cam: { yaw: 0.8, dist: 15, lift: 5, fwd: 12, fixed: true } },
  { name: 'umbra-tiempo', host: 'umbra', id: 'tiempo', k: 's3', cam: { yaw: 0.8, dist: 15, lift: 5, fwd: 8, fixed: true } },
  { name: 'umbra-colapso', host: 'umbra', id: 'colapso', k: 'ult', cam: { yaw: 0.8, dist: 20, lift: 7, fwd: 14, fixed: true } },
  { name: 'seraf-planeo', host: 'seraf', id: 'planeo', k: 'mov', bf: BF.pla, push: 14, cam: { yaw: 1.3, dist: 10, lift: 3, fwd: 0, aimAt: 1.6 } },
  { name: 'seraf-pulso', host: 'seraf', id: 'pulso', k: 'esp', cam: { yaw: 0.7, dist: 16, lift: 6, fwd: 3, fixed: true } },
  { name: 'seraf-simbionte', host: 'seraf', id: 'simbionte', k: 's3', sy: true, cam: { yaw: 0.7, dist: 12, lift: 4, fwd: 4, fixed: true } },
  { name: 'seraf-metamorfosis', host: 'seraf', id: 'metamorfosis', k: 'ult', bf: BF.met, cam: { yaw: 0.9, dist: 10, lift: 3, fwd: 0, aimAt: 1.6 } },
  // el mismo estado visto en un ALIADO (3.ª persona, aliado a la derecha del jugador)
  { name: 'aliado-caparazon', host: 'axioma', ally: 'axioma', allyBf: BF.cap, cam: { yaw: 0.2, dist: 14, lift: 3.5, fwd: 3, aimAt: 1.6 }, still: true },
  { name: 'aliado-camuflaje', host: 'axioma', ally: 'vesper', allyBf: BF.cam, cam: { yaw: 0.2, dist: 14, lift: 3.5, fwd: 3, aimAt: 1.6 }, still: true },
  { name: 'aliado-sobrecarga', host: 'axioma', ally: 'axioma', allyBf: BF.sob, cam: { yaw: 0.2, dist: 14, lift: 3.5, fwd: 3, aimAt: 1.6 }, still: true },
  { name: 'aliado-floracion', host: 'axioma', ally: 'micelio', allyBf: BF.flo, cam: { yaw: 0.2, dist: 16, lift: 6, fwd: 3, aimAt: 1.2 }, still: true },
  { name: 'aliado-metamorfosis', host: 'axioma', ally: 'seraf', allyBf: BF.met, cam: { yaw: 0.2, dist: 14, lift: 3.5, fwd: 3, aimAt: 1.6 }, still: true },
  // primera persona: estados propios (viñeta de pantalla)
  { name: 'fp-caparazon', host: 'axioma', bf: BF.cap, fp: true, still: true }, { name: 'fp-sobrecarga', host: 'axioma', bf: BF.sob, fp: true, still: true },
  { name: 'fp-camuflaje', host: 'vesper', bf: BF.cam, fp: true, still: true }, { name: 'fp-frenesi', host: 'vesper', bf: BF.fre, fp: true, still: true },
  { name: 'fp-floracion', host: 'micelio', bf: BF.flo, fp: true, still: true }, { name: 'fp-metamorfosis', host: 'seraf', bf: BF.met, fp: true, still: true },
  { name: 'fp-desfase', host: 'umbra', bf: BF.des, fp: true, still: true },
];
// melee en 1.ª persona: golpes locales (como la tecla V) y por evento de la sim
for (const h of ['axioma', 'vesper', 'micelio', 'umbra', 'seraf']) {
  JOBS.push({ name: `melee-${h}-combo`, host: h, fp: true, melee: [['light', 0], ['light', 1], ['light', 2]], at: [0.5, 0.5, 0.55] });
  JOBS.push({ name: `melee-${h}-pesado`, host: h, fp: true, melee: [['heavy', 0], ['air', 0], ['exec', 0]], at: [0.5, 0.5, 0.5] });
  JOBS.push({ name: `meleemundo-${h}`, host: h, fp: false, ally: h, worldMelee: true, cam: { yaw: 0.5, dist: 7, lift: 2.4, fwd: 2, aimAt: 1.2 } });
}
const srv = await startServer({ port: 0 }); let b = null, pg = null; const base = `http://localhost:${srv.port}`; const errors = [];
const W = +process.env.W || 800, H = +process.env.H || 450;
async function open() { // (re)abre el navegador: con la máquina cargada Chromium a veces se cae a mitad de la tanda
  try { if (b) await b.close(); } catch { /* ya cerrado */ }
  b = await launch(); pg = await b.newPage({ viewport: { width: W, height: H } });
  pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); }); pg.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
  await pg.goto(`${base}/public/hostfx-demo.html?q=${q}`); await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 }); await pg.waitForTimeout(1500);
}
await open();
const report = [];
for (const job of JOBS) {
  if (filter.length && !filter.some((f) => job.name === f || job.name.startsWith(f))) continue;
  for (let intento = 0; intento < 2; intento++) { try {
  const base0 = await pg.evaluate((job) => { const d = window.__demo; d.setup(job.host, { third: !job.fp, ally: job.ally, allyX: job.still ? 5 : undefined, allyZ: job.still ? 7 : undefined });
    d.cam({ on: true, dist: 12, yaw: 0.8, lift: 3.5, aimAt: 1.2, fwd: 0, fixed: false, anchor: null, anchorH: null, ...(job.cam || {}) }); d.bf(job.bf || 0); d.allyBf(job.allyBf || 0); if (job.mark) d.mark(job.mark);
    if (job.sy) d.sy({ x: d.g.players[0].pos.x + 3, y: d.g.players[0].pos.y, z: d.g.players[0].pos.z - 3 }); d.run(0.2, 1 / 10); d.frame(1 / 30, 2); return d.r.gl.info.render.calls; }, job);
  let peak = { calls: 0, tris: 0, part: 0, segs: 0, meshes: 0 }; const files = [], note = (st) => { peak.calls = Math.max(peak.calls, st.calls); peak.tris = Math.max(peak.tris, st.tris); peak.part = Math.max(peak.part, st.part); peak.segs = Math.max(peak.segs, st.segs); peak.meshes = Math.max(peak.meshes, st.meshesVisibles); };
  const shot = async (i) => { const f = `${out}/${job.name}-${i}.jpg`; await pg.screenshot({ path: f, type: 'jpeg', quality: 82, timeout: 120000 }); files.push(f); };
  if (job.melee) {
    let i = 0;
    for (const [kind, idx] of job.melee) {
      await pg.evaluate(([kind, idx, hit]) => { const d = window.__demo; d.run(1.2, 1 / 20); d.local(kind, { hit, idx }); }, [kind, idx, 1]);
      // avanza hasta el golpe: ~46 % de la animación (el hit-stop congela medio instante) y tras él
      for (const t of [job.at[i] * (kind === 'light' ? 0.5 : 0.8), 0.07]) { const st = await pg.evaluate((t) => { const d = window.__demo; d.run(t, 1 / 60); return d.stats(); }, t); note(st); }
      await shot(i++);
    }
    await pg.evaluate(() => window.__demo.run(1.0, 1 / 20)); await shot(i);
  } else if (job.worldMelee) {
    for (const [i, kind] of ['light', 'light', 'heavy', 'exec'].entries()) { await pg.evaluate((kind) => { const d = window.__demo; d.melee(kind, 1, true); d.frame(1 / 60, 1); }, kind); const st = await pg.evaluate(() => { window.__demo.run(0.1, 1 / 60); return window.__demo.stats(); }); note(st); await shot(i); await pg.evaluate(() => window.__demo.run(0.6, 1 / 20)); }
  } else if (job.still) {
    for (const [i, t] of [0.5, 0.6, 0.6, 0.6].entries()) { const st = await pg.evaluate((t) => { window.__demo.run(t, 1 / 20); return window.__demo.stats(); }, t); note(st); await shot(i); }
  } else {
    await pg.evaluate((job) => { const d = window.__demo; if (job.move) { const p = d.g.players[0]; d.cam({ anchor: [p.pos.x, p.pos.y, p.pos.z], anchorH: [p.heading.x, p.heading.y, p.heading.z], fixed: false }); const dir = { x: p.heading.x, z: p.heading.z }; p.pos = { x: p.pos.x + dir.x * job.move, y: p.pos.y, z: p.pos.z + dir.z * job.move }; } d.skill(job.id, job.k); if (job.push) d.push(job.push, 0.35); d.frame(1 / 60, 1); }, job);
    let prev = 0;
    for (const [i, t] of [0.1, 0.3, 0.7, 1.4].entries()) { const st = await pg.evaluate(([dt, step]) => { window.__demo.run(dt, step); return window.__demo.stats(); }, [Math.max(1 / 20, t - prev), 1 / 20]); prev = t; note(st); await shot(i); }
  }
  try { execSync(`montage ${files.join(' ')} -tile 2x2 -geometry ${W}x${H}+3+3 -background '#05030c' ${out}/hoja-${job.name}.jpg`); } catch { /* sin ImageMagick */ }
  report.push({ name: job.name, base: base0, pico: peak.calls, extra: peak.calls - base0, particulas: peak.part, segs: peak.segs, mallas: peak.meshes, tris: peak.tris });
  console.log(job.name, JSON.stringify({ base: base0, pico: peak.calls, extra: peak.calls - base0, part: peak.part, segs: peak.segs, mallas: peak.meshes }));
  break; } catch (err) { console.log('REINTENTO', job.name, String(err.message).split('\n')[0]); await open(); } }
}
fs.writeFileSync(`${out}/stats-${q}.json`, JSON.stringify(report, null, 1));
console.log(errors.length ? 'ERRORES:\n' + errors.slice(0, 8).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
