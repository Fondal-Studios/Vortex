import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const srv = await startServer({ port: 0 }), br = await launch(), pg = await (await br.newContext({ viewport: { width: 480, height: 480 } })).newPage();
pg.on('pageerror', (e) => console.log('ERR', e.message));
await pg.goto(`http://localhost:${srv.port}/huesped-arte.html?frozen=1&w=480&h=480&q=low&char=axioma&t=1`, { waitUntil: 'domcontentloaded' });
await pg.waitForFunction(() => window.__ready);
const res = await pg.evaluate(async () => {
  const LP = await import('/src/client/lab-prop.js'); const body = window.__body, person = body.person, ak = body.kit, object = body.object, holder = object.children[0], gl = window.__gl, scene = window.__scene, cam = window.__cam;
  const out = {};
  const shot = (n) => { cam.position.set(0, 1.1, 5.4); cam.lookAt(0, 1.0, 0); gl.render(scene, cam); out[n] = gl.domElement.toDataURL('image/jpeg', 0.85); };
  const step = (prop, secs, dt) => { for (let t = 0; t < secs; t += dt) { const r = LP.aplicarProporciones(person.bones, prop); holder.scale.set(r.x, r.y, r.z); person.update(dt, { speed: 0 }); object.updateWorldMatrix(true, true); holder.position.y = LP.elevacionViva(person.bones, prop, holder) * holder.scale.y; object.updateWorldMatrix(true, true); ak.update(dt, t, { object }); } };
  const mn = Object.fromEntries(LP.PROP_CLAVES.map((k) => [k, LP.PROP_RANGOS[k][0]]));
  step(LP.PROP_NEUTRA, 2, 1 / 30); shot('a_neutra');
  step(mn, 0.1, 1 / 30); shot('b_min_0.1s'); step(mn, 2, 1 / 30); shot('c_min_2s');
  return out;
});
for (const [k, v] of Object.entries(res)) fs.writeFileSync(`/tmp/claude-0/-home-user/4714e0e1-9d6d-5a05-870c-820a59c72dd7/scratchpad/${k}.jpg`, Buffer.from(v.split(',')[1], 'base64'));
await br.close(); await srv.close();
