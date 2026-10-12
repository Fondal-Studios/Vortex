// Capturas de la evolución visual. Uso: node tools/shot-evolucion.js [carpeta] [armas|hosts|ui|todo]
//   armas → hoja de contacto de las 20 armas (tier 0 y tier 4) + escalera de tiers de varias armas, y mide llamadas de dibujo / triángulos (Baja)
//   hosts → los 5 Huéspedes en tier 0 y tier 4 (con arma equipada) + escalera 0..4
//   ui    → pantalla «Evolución» en 4 tamaños
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/evolucion', WHAT = process.argv[3] || 'todo'; fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [];
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } }), pg = await ctx.newPage();
pg.on('pageerror', (e) => errors.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await pg.goto(`${base}/public/hero-view.html?char=egida&q=low&frozen=1`, { waitUntil: 'domcontentloaded' });
await pg.setViewportSize({ width: 1600, height: 1000 });

/** hoja de contacto genérica: items = [{ make(THREE) → {group, update, info?}, label, frame:[cy, h] }] */
async function sheet(file, kind, cols, cell) {
  const res = await pg.evaluate(async ({ kind, cols, cell }) => {
    const THREE = await import('three'), M = await import('/src/client/melee-models.js'), V = await import('/src/client/huespedes-view.js'); let E = null; try { E = await import('/src/client/huespedes-evo.js'); } catch { /* aún no existe */ }
    const ids = M.MELEE_MODEL_IDS, hosts = Object.keys(V.HOST_COLORS), items = [];
    if (kind === 'armas0' || kind === 'armas4') ids.forEach((id) => items.push({ id, tier: kind === 'armas0' ? 0 : 4 }));
    if (kind === 'escalera') for (const id of ['filo_oseo', 'martillo_sismico', 'lanza_sinaptica', 'daga_neurotoxica', 'latigo']) for (let t = 0; t <= 4; t++) items.push({ id, tier: t });
    if (kind === 'hosts') for (const h of hosts) for (const t of [0, 4]) items.push({ host: h, tier: t });
    if (kind === 'hostsladder') for (const h of hosts) for (let t = 0; t <= 4; t++) items.push({ host: h, tier: t });
    const rows = Math.ceil(items.length / cols), W = cols * cell.w, H = rows * cell.h;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.style.cssText = 'position:fixed;left:0;top:0;width:' + W + 'px;height:' + H + 'px;z-index:9'; document.body.appendChild(cv);
    const gl = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); gl.setPixelRatio(1); gl.setSize(W, H, false); gl.setScissorTest(true); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.15;
    const out = [], WEAP = { axioma: 'sable_plasma', vesper: 'colmillo', micelio: 'martillo_sismico', umbra: 'pica_cristal', seraf: 'lanza_sinaptica' };
    gl.setClearColor(0x120a26, 1); gl.setScissor(0, 0, W, H); gl.setViewport(0, 0, W, H); gl.clear();
    let worst = { calls: 0, tris: 0, id: '' };
    for (let i = 0; i < items.length; i++) {
      const it = items[i], col = i % cols, row = Math.floor(i / cols), x = col * cell.w, y = H - (row + 1) * cell.h;
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, cell.w / cell.h, 0.05, 50);
      scene.add(new THREE.HemisphereLight(0xdde4ff, 0x3a1f55, 2.2)); const key = new THREE.DirectionalLight(0xfff1e0, 3.4); key.position.set(2.5, 3, 4); const rim = new THREE.DirectionalLight(0x9acaff, 2.6); rim.position.set(-3, 2, -3); scene.add(key, rim);
      let obj, frame;
      if (it.id) { const m = M.buildMelee(THREE, it.id, { tier: it.tier, quality: 'low', color: V.HOST_COLORS.axioma }); obj = m; m.group.rotation.y = -0.5; const bb = new THREE.Box3().setFromObject(m.group), hh = bb.max.y - bb.min.y; frame = [(bb.max.y + bb.min.y) / 2, Math.max(hh * 1.1, 0.6)]; }
      else { const h = E ? E.buildHostEvo(THREE, it.host, { evo: it.tier, quality: 'low', melee: it.tier >= 0 ? WEAP[it.host] : null }) : V.buildHost(THREE, it.host, 'low'); obj = h; h.group.rotation.y = -0.45; const bb = new THREE.Box3().setFromObject(h.group.children[0]), hh = bb.max.y - bb.min.y; frame = [(bb.max.y + bb.min.y) / 2, hh * 1.18]; }
      obj.update(0.05, 1.3 + i * 0.1); obj.update(0.05, 1.4 + i * 0.1); scene.add(obj.group);
      const d = (frame[1] / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.05; cam.position.set(0, frame[0] + 0.05, d); cam.lookAt(0, frame[0], 0);
      gl.setViewport(x, y, cell.w, cell.h); gl.setScissor(x, y, cell.w, cell.h); gl.setClearColor(0x1a1030 + (i % 2) * 0x050308, 1); gl.clear(); gl.info.reset(); gl.render(scene, cam);
      const calls = gl.info.render.calls, tris = gl.info.render.triangles; if (calls > worst.calls) worst = { ...worst, calls, id: it.id || it.host + it.tier }; worst.tris = Math.max(worst.tris, tris);
      out.push({ id: it.id || it.host, tier: it.tier, calls, tris });
    }
    return { out, W, H, worst };
  }, { kind, cols, cell });
  await pg.setViewportSize({ width: res.W, height: res.H }); await pg.waitForTimeout(300); await pg.screenshot({ path: `${OUT}/${file}.png`, clip: { x: 0, y: 0, width: res.W, height: res.H } });
  await pg.evaluate(() => { document.querySelectorAll('canvas[style*="z-index: 9"]').forEach((c) => c.remove()); });
  return res;
}
const report = {};
if (WHAT === 'ui' || WHAT === 'todo') {
  const VPS = [['844x390', 844, 390, true], ['667x375', 667, 375, true], ['390x844', 390, 844, true], ['1280x720', 1280, 720, false]];
  for (const [vn, w, h, touch] of VPS) {
    const c2 = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), p2 = await c2.newPage();
    p2.on('pageerror', (e) => errors.push(`${vn}: ${e.message}`)); p2.on('console', (m) => { if (m.type() === 'error') errors.push(`${vn}: ${m.text()}`); });
    await p2.addInitScript(() => { try { if (!localStorage.getItem('cristal.perfil.v1')) localStorage.setItem('cristal.perfil.v1', JSON.stringify({ cores: 150, evo: { axioma: 2, seraf: 4 }, melee: { axioma: 'sable_plasma' }, owned: ['sable_plasma', 'hacha_quitina'] })); } catch { /* ok */ } });
    p2.setDefaultTimeout(120000); await p2.goto(`${base}/?q=low&autoq=0`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await p2.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 }); await p2.waitForTimeout(800); await p2.evaluate(() => window.__api.ui.confirmTitle());
    await p2.evaluate(() => window.__api.ui.show('evolucion')); await p2.waitForTimeout(2200);
    await p2.screenshot({ path: `${OUT}/ui-${vn}-axioma.png` });
    await p2.evaluate(() => { const u = window.__api.ui.ev; u.select('seraf'); u.selectTab('lanza'); }); await p2.waitForTimeout(1500);
    await p2.screenshot({ path: `${OUT}/ui-${vn}-seraf-lanzas.png` });
    await c2.close();
  }
}
if (WHAT === 'armas' || WHAT === 'todo') {
  await pg.setViewportSize({ width: 1500, height: 960 });
  report.armas0 = await sheet('armas-tier0', 'armas0', 5, { w: 300, h: 240 });
  report.armas4 = await sheet('armas-tier4', 'armas4', 5, { w: 300, h: 240 });
  report.escalera = await sheet('armas-escalera', 'escalera', 5, { w: 300, h: 240 });
}
if (WHAT === 'hosts' || WHAT === 'todo') {
  await pg.setViewportSize({ width: 1500, height: 1000 });
  report.hosts = await sheet('hosts-tier0y4', 'hosts', 6, { w: 250, h: 330 });
  report.hostsladder = await sheet('hosts-escalera', 'hostsladder', 5, { w: 280, h: 330 });
}
for (const [k, r] of Object.entries(report)) console.log(k, 'peor:', JSON.stringify(r.worst), 'máx. llamadas', Math.max(...r.out.map((o) => o.calls)), 'máx. triángulos', Math.max(...r.out.map((o) => o.tris)));
fs.writeFileSync(`${OUT}/medidas.json`, JSON.stringify(report, null, 1));
console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'sin errores JS'); await b.close(); await srv.close();
