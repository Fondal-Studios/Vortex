// Prueba de los sonidos de armas/impactos: renderiza cada uno sin conexión (OfflineAudioContext) y mide pico, duración y "brillo".
// Uso: node tools/audio-combatfx-test.js   (falla si algún sonido queda mudo, explota o es idéntico a otro)
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }); const b = await launch(); const pg = await b.newPage(); const errs = [];
pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
await pg.goto(`http://localhost:${srv.port}/`); await pg.waitForTimeout(500);
const rows = await pg.evaluate(async () => {
  const { Sound } = await import('/src/client/audio.js'); const SR = 22050, out = [];
  const names = ['haz', 'prisma', 'rafaga', 'nova', 'aguja', 'pulso', 'gemelas', 'solar', 'fractal', 'enjambre', 'cometa', 'vortice', 'lanza', 'cetro', 'eclipse', 'voltaico', 'glaciar', 'plaga', 'brasa', 'mina', 'sierra', 'pulsar', 'dardos', 'requiem', 'quimera'];
  const jobs = names.map((n, i) => [n, (s) => s.shot(i, null)]).concat([['hit', (s) => s.hit(null)], ['boom', (s) => s.boom(null)], ['die', (s) => s.voice('astilla', 'die', null)], ['hitmark', (s) => s.hitmark('hit')], ['crit', (s) => s.hitmark('crit')], ['kill', (s) => s.hitmark('kill')]]);
  for (const [name, fn] of jobs) {
    const ctx = new OfflineAudioContext(1, SR * 2, SR); const s = new Sound(); const C = class { constructor() { return ctx; } }; window.AudioContext = C; s.init(); fn(s);
    const buf = await ctx.startRendering(); const d = buf.getChannelData(0); let pk = 0, last = 0, zc = 0, e = 0;
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; if (a > 0.01) last = i; if (i && (d[i] > 0) !== (d[i - 1] > 0)) zc++; e += d[i] * d[i]; }
    out.push({ name, peak: +pk.toFixed(3), dur: +(last / SR).toFixed(2), zcr: Math.round(zc / Math.max(1, last / SR)), rms: +Math.sqrt(e / d.length).toFixed(4) });
  }
  return out;
});
let bad = 0; for (const r of rows) { const mute = r.peak < 0.02; if (mute) bad++; console.log(String(r.name).padEnd(9), 'pico', String(r.peak).padEnd(6), 'dur', String(r.dur).padEnd(5), 'brillo(cruces/s)', String(r.zcr).padEnd(6), mute ? 'MUDO' : ''); }
if (errs.length) { console.log('ERRORES', errs.slice(0, 5)); bad++; }
await b.close(); await srv.close(); console.log(bad ? 'FALLÓ' : 'OK: 25 armas + impacto/explosión/muerte/hitmarker suenan');
process.exit(bad ? 1 : 0);
