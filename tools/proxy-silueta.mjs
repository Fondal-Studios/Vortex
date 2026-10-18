// Hoja de siluetas: arriba el modelo real, abajo el proxy horneado (mismo tamaño). Y los triángulos de cada uno.
//   node tools/proxy-silueta.mjs <salida.png> [todas=0]
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
import fs from 'node:fs';
const [out, all = '0'] = process.argv.slice(2);
const KINDS = ['astilla', 'geoda', 'prisma', 'lente', 'cuarzo', 'espejo', 'racimo', 'graviton', 'obelisco', 'aurora', 'ariete', 'espiral', ...(all === '1' ? ['coloso', 'madre', 'argos'] : [])];
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: 400, height: 300 } });
const errs = []; pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await pg.goto(`http://localhost:${srv.port}/?auto=m1&bot=1&god=1&wave=1&seed=3&q=low&autoq=0&skipintro=1`);
await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 400000 });
const res = await pg.evaluate(async (KINDS) => {
  const THREE = await import('three'); const { buildMonster } = await import('/src/client/models.js'); const { bakeProxyGeometry, proxyMaterial } = await import('/src/client/proxy-lod.js');
  const W = 220 * KINDS.length, H = 520, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true }); r.setSize(W, H, false); r.setClearColor(0x1a1630);
  const sc = new THREE.Scene(); sc.add(new THREE.AmbientLight(0xffffff, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 2.5); dl.position.set(3, 5, 4); sc.add(dl);
  const cam = new THREE.OrthographicCamera(0, W, H, 0, -50, 50); const info = {};
  const look = new THREE.Vector3(0, 0, 1); KINDS.forEach((k, i) => {
    const real = buildMonster(k); for (let j = 0; j < 12; j++) real.tick(0.05, { id: 1, s: 'run', o: 0, c: 0, hp: 1, sd: 0, st: 0, a: 0 }, j * 0.05, { look, speed: 0.6, dist: 12 });
    real.object.rotation.y = 0.6; real.object.scale.setScalar(70); real.object.position.set(i * 220 + 110, 330, 0); sc.add(real.object);
    const g = bakeProxyGeometry(k), m = new THREE.Mesh(g, proxyMaterial()); m.rotation.y = 0.6; m.scale.setScalar(70); m.position.set(i * 220 + 110, 80, 0); sc.add(m);
    let rt = 0; real.object.traverse((o) => { if (o.isMesh && o.geometry) rt += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    info[k] = { real: Math.round(rt), proxy: g ? g.index.count / 3 : null };
  });
  r.render(sc, cam); return { info, png: cv.toDataURL('image/png') };
}, KINDS);
fs.writeFileSync(out, Buffer.from(res.png.split(',')[1], 'base64'));
console.log(JSON.stringify(res.info), errs.slice(0, 4)); await b.close(); await srv.close();
