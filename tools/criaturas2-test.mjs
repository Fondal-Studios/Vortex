// PRUEBA de criaturas-2 (Gravitón, Obelisco, Aurora, Ariete, Espiral, Coloso, Madre): construye cada modelo en Baja/Media/Alta, recorre todos los
// estados del sim con vida alta/baja/escudo/aturdido, y comprueba: sin excepciones, sin NaN en matrices ni uniformes, y el presupuesto de la
// calidad Baja (normales ≤ 40 draw calls y ≤ 15k triángulos; jefes ≤ 70 dc y ≤ 20k tris) medido con gl.info.render del propio visor.
// Uso: node tools/criaturas2-test.mjs        (≈1 min con GL por software; un solo Chromium)
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }); const b = await launch();
const pg = await b.newPage({ viewport: { width: 480, height: 360 } });
const errs = []; pg.on('console', (m) => { if (['error'].includes(m.type())) errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
await pg.goto(`http://localhost:${srv.port}/public/viewer.html?k=astilla&q=low&cap=1`);
await pg.waitForFunction(() => window.__viewerReady, null, { timeout: 120000 });
const STATES = {
  graviton: ['idle', 'charge'], obelisco: ['idle', 'charge'], aurora: ['idle', 'cast'], ariete: ['idle', 'wind', 'charge', 'stun'], espiral: ['idle', 'charge', 'pull'],
  coloso: ['idle', 'wind', 'ray', 'stagger'], madre: ['fire', 'vent', 'gestate', 'open'],
};
const res = await pg.evaluate(async (STATES) => {
  const THREE = await import('three'); const { buildMonster } = await import('/src/client/models.js'); const Q = await import('/src/client/quality.js'); const { kit } = await import('/src/client/organism.js');
  const out = []; const bad = [];
  const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500); cam.position.set(0, 0, 9);
  const gl = new THREE.WebGLRenderer({ antialias: false }); gl.setSize(240, 180); scene.add(new THREE.HemisphereLight(0xffffff, 0x333355, 1.5));
  for (const q of ['low', 'medium', 'high']) {
    Q.setCurrent(q);
    for (const [k, states] of Object.entries(STATES)) {
      let e; try { e = buildMonster(k); } catch (err) { bad.push(`${q} ${k} build: ${err.message}`); continue; }
      const boss = k === 'coloso' || k === 'madre'; e.object.scale.setScalar(boss ? 0.55 : 1.2); scene.add(e.object);
      let t = 0;
      try {
        for (const s of states) for (const hp of [1, 0.5, 0.15]) for (const extra of [{}, { sd: true }, { st: true }]) {
          const st = { id: 7, s, o: s === 'open', c: false, hp, sd: !!extra.sd, st: !!extra.st, a: [0, -0.5, 0.86], pr: hp < 0.6 ? 0.9 : 0.2 };
          kit.setWound(e.mats, 1 - hp);
          for (let i = 0; i < 18; i++) { t += 1 / 30; e.object.updateMatrixWorld(); const look = cam.position.clone(); e.object.worldToLocal(look); e.tick(1 / 30, st, t, { look: look.normalize(), speed: i % 5 ? 0.6 : 0, dist: 20 }); }
        }
      } catch (err) { bad.push(`${q} ${k} tick: ${err.message}`); }
      // sanidad numérica
      e.object.updateMatrixWorld(true); let nanM = 0;
      e.object.traverse((o) => { if (o.matrixWorld.elements.some((v) => !Number.isFinite(v))) nanM++; if (o.isMesh && o.material && o.material.userData && o.material.userData.u) for (const [n, u] of Object.entries(o.material.userData.u)) if (typeof u.value === 'number' && !Number.isFinite(u.value)) nanM++; });
      if (nanM) bad.push(`${q} ${k}: ${nanM} NaN`);
      // coste: estado de ataque con la cámara al frente
      const st = { id: 7, s: states[states.length - 1], o: states[states.length - 1] === 'open', hp: 1, sd: true, st: false, a: [0, -0.5, 0.86], pr: 0.5 };
      e.tick(1 / 30, st, t + 1, { look: new THREE.Vector3(0, 0, 1), speed: 0, dist: 20 }); gl.info.reset(); gl.render(scene, cam);
      out.push({ q, k, calls: gl.info.render.calls, tris: gl.info.render.triangles });
      scene.remove(e.object);
    }
  }
  return { out, bad };
}, STATES);
let fail = 0;
for (const r of res.out) {
  const boss = r.k === 'coloso' || r.k === 'madre'; const maxC = boss ? 70 : 40, maxT = boss ? 20000 : 15000;
  const over = r.q === 'low' && (r.calls > maxC || r.tris > maxT); if (over) fail++;
  console.log(`${over ? 'FALLA' : 'ok   '} ${r.q.padEnd(6)} ${r.k.padEnd(9)} ${String(r.calls).padStart(3)} dc  ${String(r.tris).padStart(6)} tris${r.q === 'low' ? `  (límite ${maxC} dc / ${maxT})` : ''}`);
}
for (const m of res.bad) { console.log('FALLA', m); fail++; }
for (const m of errs.slice(0, 5)) { console.log('consola:', m); fail++; }
console.log(fail ? `\n${fail} problema(s)` : '\nTodo bien: sin excepciones, sin NaN, presupuesto Baja respetado.');
await b.close(); await srv.close(); process.exit(fail ? 1 : 0);
