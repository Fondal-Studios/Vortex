// Prueba en Chromium real de los efectos de los 5 Huéspedes (src/client/hostfx.js + hostfx-melee.js): dispara TODAS las habilidades, los estados (campo bf),
// el simbionte, las marcas y los golpes melee (por evento y por la tecla V) y comprueba: cero errores de consola, presupuesto de draw calls por efecto
// (≤ 12 extra), sin geometrías nuevas por cuadro (pools) y que todo se apaga solo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer } from '../server/server.js';

const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));
const SKILLS = {
  axioma: [['mov', 'impulso'], ['esp', 'espinas'], ['s3', 'caparazon'], ['ult', 'sobrecarga']],
  vesper: [['mov', 'paso'], ['esp', 'camuflaje'], ['s3', 'marca'], ['ult', 'frenesi']],
  micelio: [['mov', 'barrera'], ['esp', 'esporas'], ['s3', 'biomasa'], ['ult', 'floracion']],
  umbra: [['mov', 'fase'], ['esp', 'singularidad'], ['s3', 'tiempo'], ['ult', 'colapso']],
  seraf: [['mov', 'planeo'], ['esp', 'pulso'], ['s3', 'simbionte'], ['ult', 'metamorfosis']],
};
const BUDGET = 12; // draw calls extra por efecto

test('hostfx: las 20 habilidades, los estados y el melee de los 5 Huéspedes corren sin errores y dentro de presupuesto', { skip: !hasChromium, timeout: 280000 }, async () => {
  const { launch } = await import('../tools/browser.js');
  const srv = await startServer({ port: 0 }); const b = await launch(); const pg = await b.newPage({ viewport: { width: 640, height: 360 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
  try {
    await pg.goto(`http://localhost:${srv.port}/public/hostfx-demo.html?q=low`);
    await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    const report = [];
    let geoAfterWarm = null;
    for (const [host, list] of Object.entries(SKILLS)) {
      for (const [k, id] of list) {
        const r = await pg.evaluate(([host, k, id]) => {
          // medición A/B: la misma secuencia SIN y CON el efecto; el costo del efecto = máxima diferencia de draw calls cuadro a cuadro
          const d = window.__demo; const trial = (withFx) => {
            d.setup(host, { third: true }); d.cam({ yaw: 0.8, dist: 12, lift: 4, fwd: 4, fixed: false }); d.run(0.2, 1 / 10); d.frame(1 / 30, 2);
            if (withFx) d.skill(id, k); d.push(10, 0.3); const calls = [], part = []; for (let i = 0; i < 40; i++) { d.frame(1 / 20, 1); calls.push(d.r.gl.info.render.calls); part.push((d.r.fx.add.live || 0) + (d.r.fx.smoke.live || 0)); }
            return { calls, part, geos: d.r.gl.info.memory.geometries, loops: d.stats().loops };
          };
          const A = trial(false), B = trial(true); let extra = 0; for (let i = 0; i < 40; i++) extra = Math.max(extra, B.calls[i] - A.calls[i]);
          return { base: Math.max(...A.calls), pk: Math.max(...A.calls) + extra, part: Math.max(...B.part), bad: Number.isFinite(d.r.camera.position.x) ? 0 : 1, geos: B.geos, left: B.loops };
        }, [host, k, id]);
        assert.equal(r.bad, 0, `${id}: la cámara quedó en NaN`);
        assert.ok(r.pk - r.base <= BUDGET, `${host}/${id}: ${r.pk - r.base} draw calls extra (máx ${BUDGET})`);
        assert.ok(r.part <= 150, `${id}: ${r.part} partículas vivas en Baja (máx 150)`);
        report.push({ host, id, extra: r.pk - r.base, part: r.part });
        if (geoAfterWarm === null && host === 'axioma') geoAfterWarm = r.geos;
      }
    }
    // estados persistentes (bf) para uno mismo y para un aliado, en 3.ª y 1.ª persona
    const st = await pg.evaluate(() => {
      const out = {}; const d = window.__demo;
      for (const [name, bit, host] of [['caparazon', 1, 'axioma'], ['camuflaje', 2, 'vesper'], ['sobrecarga', 4, 'axioma'], ['frenesi', 8, 'vesper'], ['floracion', 16, 'micelio'], ['metamorfosis', 32, 'seraf'], ['desfase', 64, 'umbra'], ['planeo', 128, 'seraf'], ['barrera', 256, 'micelio']]) {
        for (const third of [true, false]) {
          const trial = (mask) => { d.setup(host, { third, ally: host }); d.cam({ yaw: 0.3, dist: 12, lift: 4, fwd: 3 }); d.frame(1 / 30, 3); d.bf(mask); d.allyBf(mask); let pk = 0; for (let i = 0; i < 25; i++) { d.frame(1 / 20, 1); pk = Math.max(pk, d.r.gl.info.render.calls); } return { pk, vis: d.stats().meshesVisibles }; };
          const off = trial(0), on = trial(bit); d.bf(0); d.allyBf(0); for (let i = 0; i < 25; i++) d.frame(1 / 20, 1); const after = d.stats().meshesVisibles;
          out[`${name}-${third ? '3p' : '1p'}`] = { extra: on.pk - off.pk, on: on.vis, off: after };
        }
      }
      // simbionte + marcas
      d.setup('seraf', { third: true }); d.frame(1 / 30, 3); const p0 = d.g.players[0]; d.sy({ x: p0.pos.x + 3, y: p0.pos.y, z: p0.pos.z - 3 }); d.allySy({ x: p0.pos.x + 6, y: p0.pos.y, z: p0.pos.z - 9 }); d.mark([0, 1, 2]); for (let i = 0; i < 20; i++) d.frame(1 / 20, 1);
      out.simbiontes = d.stats().meshesVisibles; d.sy(null); d.allySy(null); d.mark([]); for (let i = 0; i < 10; i++) d.frame(1 / 20, 1); out.simbiontesOff = d.stats().meshesVisibles;
      return out;
    });
    for (const [k, v] of Object.entries(st)) if (typeof v === 'object') { assert.ok(v.extra <= BUDGET * 2, `estado ${k}: ${v.extra} draw calls extra (propio + aliado, máx ${BUDGET * 2})`); assert.ok(v.on > v.off, `estado ${k}: no se ve al activarse (${v.on} → ${v.off})`); }
    assert.ok(st.simbiontes > st.simbiontesOff, 'el simbionte y las marcas aparecen y se van');
    // melee: por evento de la sim (todos los tipos, todos los Huéspedes) y por la tecla V
    const me = await pg.evaluate(() => {
      const d = window.__demo, out = {};
      for (const host of ['axioma', 'vesper', 'micelio', 'umbra', 'seraf']) {
        d.setup(host, { third: false, ally: host }); d.run(0.3, 1 / 10); const base = d.r.gl.info.render.calls; let pk = 0;
        for (const kind of ['light', 'light', 'light', 'heavy', 'air', 'exec']) { d.melee(kind, kind === 'light' ? 1 : 2); d.frame(1 / 60, 1); d.melee('light', 1, true); for (let i = 0; i < 30; i++) { d.frame(1 / 60, 1); pk = Math.max(pk, d.r.gl.info.render.calls); } }
        out[host] = { extra: pk - base, calls: d.r.hostfx.melee.stats() };
        // golpe local con la tecla V (predicción): toque corto = ligero; el evento de la sim llega después y se fusiona
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' })); d.frame(1 / 60, 4); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV' }));
        const sw = d.r.hostfx.melee.swing; out[host].tecla = sw ? sw.kind : null; d.frame(1 / 60, 10); d.melee('light', 1); d.frame(1 / 60, 3); out[host].fusion = d.r.hostfx.melee.swing ? d.r.hostfx.melee.swing.predicted : null;
        d.run(1.5, 1 / 20); out[host].apagado = d.r.hostfx.melee.engage;
      }
      return out;
    });
    for (const [h, v] of Object.entries(me)) {
      assert.ok(v.extra <= BUDGET + 4, `melee ${h}: ${v.extra} draw calls extra`);
      assert.equal(v.tecla, 'light', `melee ${h}: la tecla V (toque corto) debía iniciar un golpe ligero local`);
      assert.equal(v.apagado, 0, `melee ${h}: el viewmodel melee no se apagó`);
    }
    // sin geometrías nuevas por cuadro: repetir los efectos no debe aumentar las geometrías de la GPU
    const g2 = await pg.evaluate(() => { const d = window.__demo; d.setup('axioma', { third: true }); for (let i = 0; i < 3; i++) { d.skill('impulso', 'mov'); d.skill('espinas', 'esp'); d.frame(1 / 20, 20); } return d.r.gl.info.memory.geometries; });
    assert.ok(g2 <= geoAfterWarm + 40, `geometrías creciendo (${geoAfterWarm} → ${g2}): ¿se crean mallas por evento?`);
    console.log('hostfx draw calls extra por efecto:', JSON.stringify(report.map((x) => `${x.id}:${x.extra}`)), '| estados:', JSON.stringify(Object.fromEntries(Object.entries(st).filter(([, v]) => typeof v === 'object').map(([k, v]) => [k, v.extra]))), '| melee:', JSON.stringify(Object.fromEntries(Object.entries(me).map(([k, v]) => [k, v.extra]))));
    assert.deepEqual(errs, [], 'sin errores de consola/JS: ' + errs.join(' | '));
  } finally { await b.close(); await srv.close(); }
});
