// EH-00 · SPIKE del Laboratorio (docs/EDITOR_HUESPEDES.md §3.1): ¿la escala de hueso por segmento (src/client/lab-prop.js) convive con el mezclador de animación,
// twoBoneIK, las cadenas de muelles y la tela del kit?  21 clips × 10 combinaciones EXTREMAS de proporciones.
// Mide: matrices con NaN, cizalla (no-ortogonalidad de las matrices de mundo de los huesos), planta del pie respecto al suelo (con la elevación compensada),
// IK de dos huesos (gesto «ping»: la muñeca llega al objetivo o a su alcance), y que cadenas/tela se mantengan finitas y acotadas. Guarda capturas en 4 cámaras.
// Uso: node tools/lab-spike.mjs [carpeta de salida=shots/editor/spike] [huésped=axioma]   ·  escribe <carpeta>/informe.json
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';

const OUT = process.argv[2] || 'shots/editor/spike', HOST = process.argv[3] || 'axioma';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }), br = await launch(), ctx = await br.newContext({ viewport: { width: 480, height: 480 } }), pg = await ctx.newPage();
const errores = []; pg.on('pageerror', (e) => errores.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
await pg.goto(`http://localhost:${srv.port}/huesped-arte.html?frozen=1&w=480&h=480&q=low&char=${HOST}&t=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });

const informe = await pg.evaluate(async ({ OUT }) => {
  const LP = await import('/src/client/lab-prop.js'), HU = await import('/src/client/humans.js');
  const THREE = window.__THREE, body = window.__body, gl = window.__gl, scene = window.__scene, cam = window.__cam, person = body.person, ak = body.kit, object = body.object;
  const holder = object.children[0], W = ak.W && Object.fromEntries(Object.entries(ak.W).map(([k, v]) => [k, [v.x, v.y, v.z]]));
  const R = LP.PROP_RANGOS, mn = (k) => R[k][0], mx = (k) => R[k][1], neutra = { ...LP.PROP_NEUTRA };
  const mk = (o) => ({ ...neutra, ...o });
  const COMBOS = [
    ['todo-mínimo', Object.fromEntries(LP.PROP_CLAVES.map((k) => [k, mn(k)]))],
    ['todo-máximo', Object.fromEntries(LP.PROP_CLAVES.map((k) => [k, mx(k)]))],
    ['alto+piernas-máx', mk({ altura: mx('altura'), piernas: mx('piernas') })],
    ['brazos-máx+hombros-mín', mk({ brazos: mx('brazos'), hombros: mn('hombros') })],
    ['cabeza-máx+hombros-mín', mk({ cabeza: mx('cabeza'), hombros: mn('hombros') })],
    ['manos-máx+pies-máx', mk({ manos: mx('manos'), pies: mx('pies') })],
    ['torso-mín+piernas-máx', mk({ torso: mn('torso'), piernas: mx('piernas') })],
    ['ancho-máx+altura-mín', mk({ ancho: mx('ancho'), altura: mn('altura') })],
    ['alternado-A', mk({ altura: mx('altura'), ancho: mn('ancho'), hombros: mx('hombros'), torso: mn('torso'), brazos: mx('brazos'), piernas: mn('piernas'), cabeza: mx('cabeza'), manos: mn('manos'), pies: mx('pies') })],
    ['alternado-B', mk({ altura: mn('altura'), ancho: mx('ancho'), hombros: mn('hombros'), torso: mx('torso'), brazos: mn('brazos'), piernas: mx('piernas'), cabeza: mn('cabeza'), manos: mx('manos'), pies: mn('pies') })],
  ];
  const CLIPS = HU.CLIP_NAMES;
  const bonesAll = ak.skeleton.bones, skinned = []; scene.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  const bodyMesh = skinned.find((m) => m.name === 'kit-cuerpo');
  const tmp = new THREE.Vector3(), c = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], pos = new THREE.Vector3();
  const finite = (arr) => { for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return false; return true; };
  let curProp = neutra;
  function setProp(prop) {
    curProp = prop; const r = LP.aplicarProporciones(person.bones, prop, W);
    holder.scale.set(r.x, r.y, r.z); holder.position.set(0, r.lift * r.y, 0); object.updateMatrixWorld(true); return r;
  }
  function medir() { // un cuadro: devuelve { nan, shear, minY }
    let nan = 0, shear = 0, maxScale = 0, minScale = 9;
    for (const b of bonesAll) {
      const e = b.matrixWorld.elements; if (!finite(e)) nan++;
      c[0].set(e[0], e[1], e[2]); c[1].set(e[4], e[5], e[6]); c[2].set(e[8], e[9], e[10]);
      const l = c.map((v) => v.length()); maxScale = Math.max(maxScale, ...l); minScale = Math.min(minScale, ...l);
      if (l[0] > 1e-6 && l[1] > 1e-6 && l[2] > 1e-6) for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) shear = Math.max(shear, Math.abs(c[i].dot(c[j])) / (l[i] * l[j]));
    }
    gl.render(scene, cam); // actualiza skeleton.boneMatrices
    for (const m of skinned) if (!finite(m.skeleton.boneMatrices)) nan++;
    let minY = 9; if (bodyMesh) { bodyMesh.updateWorldMatrix(true, false); for (let i = 0; i < bodyMesh.geometry.attributes.position.count; i += 16) { bodyMesh.getVertexPosition(i, pos); pos.applyMatrix4(bodyMesh.matrixWorld); if (!Number.isFinite(pos.y)) nan++; else minY = Math.min(minY, pos.y); } }
    return { nan, shear, minY, maxScale, minScale };
  }
  function cadenasFinitas() { let ok = true, maxR = 0; scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.geometry && o.geometry.attributes.position && o.name === 'kit-tela') { const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i++) { if (!Number.isFinite(a[i])) ok = false; else maxR = Math.max(maxR, Math.abs(a[i])); } } });
    for (const b of bonesAll) { b.getWorldPosition(tmp); if (!Number.isFinite(tmp.x + tmp.y + tmp.z)) ok = false; maxR = Math.max(maxR, tmp.length()); } return { ok, maxR }; }
  const out = { host: ak && body.stats(), combos: [], clips: CLIPS, resumen: {} };
  const t0 = performance.now();
  // línea de base: planta del pie por clip con proporciones neutras (mismo instante de cada clip)
  const base = {};
  async function correr(clip, nombre, n = 8, dt = 0.15) {
    person.play(clip, { fade: 0, restart: true }); person.update(0.05, { speed: ['walk'].includes(clip) ? 1.2 : ['jog'].includes(clip) ? 3 : clip === 'sprint' ? 6.5 : 0 }); // arranca limpio
    const r = { nan: 0, shear: 0, minY: 9, maxY: -9, cad: true };
    for (let i = 0; i < n; i++) {
      const sp = clip === 'walk' ? 1.2 : clip === 'jog' ? 3 : clip === 'sprint' ? 6.5 : 0;
      person.update(dt, { speed: sp, moveDir: { x: 0, z: 1 } }); object.updateWorldMatrix(true, true); holder.position.y = LP.elevacionViva(person.bones, curProp, holder) * holder.scale.y; object.updateWorldMatrix(true, true); ak.update(dt, i * dt, { object, speed: sp });
      const m = medir(); r.nan += m.nan; r.shear = Math.max(r.shear, m.shear); r.minY = Math.min(r.minY, m.minY); r.maxY = Math.max(r.maxY, m.minY);
      const cf = cadenasFinitas(); if (!cf.ok) r.nan++; if (cf.maxR > 6) r.cad = false;
    }
    return r;
  }
  setProp(neutra);
  for (const clip of CLIPS) base[clip] = await correr(clip, 'base');
  out.base = base;
  for (const [nombre, prop] of COMBOS) {
    const p = LP.limitarProp(prop), r = setProp(p), fila = { nombre, prop: p, lift: +r.lift.toFixed(4), reglas: LP.errorProp(p), nan: 0, shearMax: 0, dSueloMax: 0, dSueloPeor: '', clipsConProblema: [], cadenasAcotadas: true };
    for (const clip of CLIPS) {
      const m = await correr(clip, nombre);
      fila.nan += m.nan; fila.shearMax = Math.max(fila.shearMax, m.shear); if (!m.cad) fila.cadenasAcotadas = false;
      // planta del pie respecto a la línea base (en metros de mundo; la escala del contenedor ya cuenta)
      const d = Math.abs(m.minY - base[clip].minY * 1); const esperado = 0; void esperado;
      if (['idle', 'spellIdle', 'aimIdle', 'talk', 'crouch'].includes(clip)) { if (d > fila.dSueloMax) { fila.dSueloMax = d; fila.dSueloPeor = clip; } }
      if (m.nan) fila.clipsConProblema.push(clip);
    }
    out.combos.push(fila);
  }
  // IK de dos huesos: gesto «ping» con el brazo derecho (twoBoneIK) en las combinaciones extremas
  out.ik = [];
  for (const [nombre, prop] of [['neutra', neutra], ...COMBOS]) {
    const r = setProp(prop); person.play('idle', { fade: 0, restart: true }); person.update(0.05, { speed: 0 });
    person.object.updateWorldMatrix(true, true); const sh = person.bones.upperarm01_R_h.getWorldPosition(new THREE.Vector3());
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(holder.matrixWorld), tgt = sh.clone().addScaledVector(fwd, 0.45).add(new THREE.Vector3(0, 0.05, 0));
    person.gesture('ping', { target: tgt, time: 5 });
    for (let i = 0; i < 40; i++) { person.update(0.05, { speed: 0 }); object.updateWorldMatrix(true, true); }
    const w = person.bones.wrist_R_h.getWorldPosition(new THREE.Vector3()), upper = person.bones.upperarm01_R_h.getWorldPosition(new THREE.Vector3()), low = person.bones.lowerarm01_R_h.getWorldPosition(new THREE.Vector3());
    const reach = upper.distanceTo(low) + low.distanceTo(w), dir = tgt.clone().sub(sh).normalize(), exp = sh.clone().addScaledVector(dir, Math.min(0.58 * holder.scale.y, reach * 0.995)), dist = w.distanceTo(exp), dTgt = tgt.distanceTo(upper);
    out.ik.push({ nombre, distAlObjetivo: +dist.toFixed(4), alcance: +reach.toFixed(3), objetivoAlHombro: +dTgt.toFixed(3), finito: Number.isFinite(dist), lift: +r.lift.toFixed(3) });
    person.gesture(null);
  }
  // Cadenas/tela con la escala del segmento que las sostiene dentro de ±10 %: Axioma tiene capa (tela) en spine y cadenas (halo de espadas)
  out.cadenasMs = performance.now() - t0;
  // Capturas: 3 combinaciones extremas × 4 cámaras (frente, 3/4, perfil, espalda)
  const CAMS = { frente: [0, 1.1, 5.4], q34: [2.6, 1.45, 3.9], perfil: [4.4, 1.2, 0.3], espalda: [0.9, 1.3, -4.4] };
  out.capturas = [];
  window.__capturas = {};
  for (const [nombre, prop] of [COMBOS[0], COMBOS[1], COMBOS[8], ['neutra', neutra]]) {
    setProp(prop); person.play('idle', { fade: 0, restart: true }); for (let i = 0; i < 12; i++) { person.update(0.05, { speed: 0 }); object.updateWorldMatrix(true, true); ak.update(0.05, i * 0.05, { object }); }
    for (const [cn, cp] of Object.entries(CAMS)) { cam.position.set(cp[0], cp[1], cp[2]); cam.lookAt(0, 1.0, 0); cam.fov = 30; cam.updateProjectionMatrix(); gl.render(scene, cam); window.__capturas[`${nombre}-${cn}`] = gl.domElement.toDataURL('image/jpeg', 0.85); out.capturas.push(`${nombre}-${cn}`); }
  }
  void OUT; return out;
}, { OUT });

const caps = await pg.evaluate(() => window.__capturas);
for (const [k, v] of Object.entries(caps)) fs.writeFileSync(`${OUT}/${k.replace(/[^a-z0-9+-áéíóúñ]/gi, '_')}.jpg`, Buffer.from(v.split(',')[1], 'base64'));
informe.errores = errores;
fs.writeFileSync(`${OUT}/informe.json`, JSON.stringify(informe, null, 1));
const resumen = informe.combos.map((f) => `${f.nombre.padEnd(26)} NaN=${f.nan} cizalla=${f.shearMax.toFixed(4)} elevación=${f.lift} dSuelo=${(f.dSueloMax * 100).toFixed(1)}cm(${f.dSueloPeor}) cadenas=${f.cadenasAcotadas ? 'ok' : 'NO'} reglas=${f.reglas.length}`);
console.log(resumen.join('\n')); console.log('IK:', JSON.stringify(informe.ik)); console.log('errores de consola:', errores.length, errores.slice(0, 5));
await br.close(); await srv.close();
