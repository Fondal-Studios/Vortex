import * as THREE from 'three';
import { cfg } from '../quality.js';
import { shellMaterial, uTide, uTime } from '../shaders.js';
import { addMotes } from './common.js';
import { rng } from './noise.js';
import { trackPx, crystalGeo, crystalMat, mushroomGeo, mushroomMat, rootGeo, rootMat, mistLayer, particleMat, particleGeo, debrisGeo, softTex, raysTex, dc } from './props.js';
import { rockPBR } from './rock.js';
import { hillGeometry, hillMat, medusaGeo, medusaMat, veilGeo, veilMat, heart } from './flesh.js';
import { shaftMat } from './sky.js';

// Entorno del Mapa 2 · Cámara Fractal: el interior de un corazón-geoda. Paredes de carne y cristal con venas que laten,
// colinas-tumor y colinas-geoda, flora y fauna bioluminiscente, velos, esporas, y un núcleo de luz en el centro (donde flota el jefe).
// La marea (cero-G) hace flotar y brillar los escombros y las esporas.
const HAZE = 0x2a0f34, HD = 0.00005;
const FLORA = [0x5fffd2, 0xff6ad5, 0xffc15a, 0x9a86ff];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

export function buildMap2(r, map) {
  const root = r.mapRoot, q = cfg(), R = map.R, rd = rng(2077), deco = q.decor;
  r.hemi.intensity = 0.75; r.sun.intensity = 0.55; r.rim.intensity = 0.4; r.scene.environmentIntensity = 0.25;
  r.sky = null; trackPx(r);

  // ── cascarón vivo ──
  r.shellMat = shellMaterial(0.35, q.shellIters);
  root.add(new THREE.Mesh(new THREE.SphereGeometry(R, deco ? 96 : 56, deco ? 56 : 32), r.shellMat));

  // ── colinas: tumores y geodas (los sólidos de la sim) ──
  const hills = map.solids.filter((s) => s.type === 'sph').map((s) => ({ c: s.c, r: s.r }));
  const hm = new THREE.Mesh(hillGeometry(hills, R, deco ? 1.3 : 0.7), hillMat(deco ? 4 : 3)); hm.frustumCulled = false; root.add(hm);

  // ── colocación sobre el cascarón (evita colinas y el polo de aparición) ──
  const spawn = new THREE.Vector3(0, -1, 0);
  const onShell = () => { for (let k = 0; k < 40; k++) { const d = new THREE.Vector3(rd() * 2 - 1, rd() * 2 - 1, rd() * 2 - 1); if (d.lengthSq() > 1 || d.lengthSq() < 0.05) continue; d.normalize();
    const p = d.clone().multiplyScalar(R); if (p.distanceTo(spawn.clone().multiplyScalar(R)) < 9) continue; if (hills.some((h) => p.distanceTo(new THREE.Vector3(h.c.x, h.c.y, h.c.z)) < h.r + 2)) continue; return d; } return null; };
  const orient = (m, i, pos, up, sx, sy, sz, spin = 0) => { _q.setFromUnitVectors(_up, up); if (spin) { _q2.setFromAxisAngle(up, spin); _q.premultiply(_q2); } _m.compose(pos, _q, _s.set(sx, sy, sz)); m.setMatrixAt(i, _m); };
  const inst = (geo, mat, list, setup) => { if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length); im.frustumCulled = false; list.forEach((it, i) => { setup(im, i, it); }); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; root.add(im); return im; };
  const colorOf = (i) => dc(FLORA[i % FLORA.length]);

  // hongos y bulbos en grupos
  const mush = [];
  for (let g = 0; g < (deco ? 70 : 24); g++) { const d = onShell(); if (!d) continue; const tan = new THREE.Vector3().crossVectors(d, _up).normalize(), tan2 = new THREE.Vector3().crossVectors(d, tan), col = Math.floor(rd() * 4), n = 3 + Math.floor(rd() * 4);
    for (let j = 0; j < n; j++) { const off = tan.clone().multiplyScalar((rd() - 0.5) * 6).addScaledVector(tan2, (rd() - 0.5) * 6); mush.push({ pos: d.clone().multiplyScalar(R - 0.1).add(off), up: d.clone().negate(), s: 1.2 + rd() * 2.6, col, sp: rd() * 6 }); } }
  inst(mushroomGeo(), mushroomMat({ haze: HAZE, hazeDens: HD }), mush, (im, i, it) => { const pr = it.pos.clone().normalize().multiplyScalar(R - 0.1); orient(im, i, pr, it.up, it.s, it.s, it.s, it.sp); im.setColorAt(i, colorOf(it.col)); });

  // zarcillos que ondulan
  if (deco) {
    const ten = []; for (let i = 0; i < 240; i++) { const d = onShell(); if (!d) continue; ten.push({ d, len: 3 + rd() * 8, w: 0.8 + rd() * 1.2, col: rd() < 0.5 ? 1 : Math.floor(rd() * 4), sp: rd() * 6 }); }
    inst(rootGeo(), rootMat({ haze: HAZE, hazeDens: HD, lo: [0.16, 0.03, 0.10], hi: [0.55, 0.16, 0.30] }), ten, (im, i, it) => { orient(im, i, it.d.clone().multiplyScalar(R - 0.2), it.d.clone(), it.len * it.w, it.len, it.len * it.w, it.sp); im.setColorAt(i, colorOf(it.col)); });
  }

  // cristales: racimos en el suelo y en las colinas
  const cr = [];
  const addCluster = (base, n, up, h0, w0, col) => { for (let j = 0; j < n; j++) { const d = up.clone().add(new THREE.Vector3(rd() - 0.5, rd() - 0.5, rd() - 0.5).multiplyScalar(0.7)).normalize(); cr.push({ pos: base.clone().add(new THREE.Vector3(rd() - 0.5, rd() - 0.5, rd() - 0.5).multiplyScalar(w0 * 2)), up: d, h: h0 * (0.5 + rd()), w: w0 * (0.6 + rd() * 0.8), col }); } };
  for (let g = 0; g < (deco ? 55 : 22); g++) { const d = onShell(); if (!d) continue; addCluster(d.clone().multiplyScalar(R - 0.4), 3 + Math.floor(rd() * 3), d.clone().negate(), 4 + rd() * 5, 0.9 + rd(), Math.floor(rd() * 4)); }
  hills.forEach((h, i) => { const c = new THREE.Vector3(h.c.x, h.c.y, h.c.z), toC = c.clone().negate().normalize(); const n = i % 2 ? (deco ? 9 : 4) : (deco ? 5 : 2);
    for (let k = 0; k < n; k++) { const dir = toC.clone().add(new THREE.Vector3(rd() - 0.5, rd() - 0.5, rd() - 0.5).multiplyScalar(i % 2 ? 1.3 : 0.9)).normalize(); addCluster(c.clone().addScaledVector(dir, h.r - 0.3), 2 + Math.floor(rd() * 3), dir, i % 2 ? 3.5 : 1.8, i % 2 ? 0.9 : 0.5, i % 2 ? (k % 2 ? 0 : 1) : 2); } });
  inst(crystalGeo(), crystalMat({ haze: HAZE, hazeDens: HD, core: true }), cr, (im, i, it) => { orient(im, i, it.pos, it.up, it.w, it.h, it.w); im.setColorAt(i, colorOf(it.col)); });

  // velos (membranas colgantes)
  if (deco) {
    const vl = []; for (let i = 0; i < 12; i++) { const d = onShell(); if (!d) continue; vl.push({ d, w: 9 + rd() * 10, h: 13 + rd() * 14, col: rd() < 0.5 ? 1 : 0, sp: rd() * 6.28 }); }
    inst(veilGeo(), veilMat(), vl, (im, i, it) => { orient(im, i, it.d.clone().multiplyScalar(R - 0.2), it.d.clone().negate(), it.w, it.h, 1, it.sp); im.setColorAt(i, dc(it.col ? 0xff6aa8 : 0x5ad8ff)); });
  }

  // medusas a la deriva
  const nj = deco ? 26 : 8, jl = [];
  for (let i = 0; i < nj; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(26 + rd() * 44); jl.push({ pos: v, s: 1.4 + rd() * 2.2, col: [0x5ff0ff, 0xff6ad0, 0xa890ff, 0xb6ff7a][i % 4], tilt: new THREE.Vector3().randomDirection() }); }
  inst(medusaGeo(), medusaMat(), jl, (im, i, it) => { orient(im, i, it.pos, it.tilt.clone().lerp(it.pos.clone().normalize().negate(), 0.7).normalize(), it.s, it.s, it.s); im.setColorAt(i, dc(it.col)); });

  // niebla de esporas: jirones cálidos y fríos que dan profundidad a la cámara
  { const ml = []; for (let j = 0; j < (deco ? 70 : 24); j++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(16 + rd() * 62); ml.push({ p: v, s: 14 + rd() * 26, col: [0xd0407a, 0x30b8c8, 0x7a46d0, 0xff8a50][j % 4] }); }
    mistLayer(r, ml, { alpha: 0.07, near: 8, far: 200 }); }
  // esporas (siempre) y motas brillantes (sólo se encienden con la marea)
  const sp = new THREE.Points(particleGeo(deco ? 800 : 220, () => { const v = new THREE.Vector3().randomDirection().multiplyScalar(80 * Math.cbrt(rd())); return [v.x, v.y, v.z]; }, 4), particleMat({ color: 0xb8ffd8, size: 0.34, mode: 1, amp: 5, alpha: 0.7 })); sp.frustumCulled = false; root.add(sp);
  let motes = null;
  if (deco) { motes = new THREE.Points(particleGeo(240, () => { const v = new THREE.Vector3().randomDirection().multiplyScalar(78 * Math.cbrt(rd())); return [v.x, v.y, v.z]; }, 9), particleMat({ color: 0xffd8f0, size: 0.8, mode: 1, amp: 9, alpha: 0 })); motes.frustumCulled = false; root.add(motes); }

  // escombros de cristal y roca que flotan (con la marea giran y brillan)
  const fl = [];
  if (deco) {
    const nd = 24, dm = new THREE.InstancedMesh(debrisGeo(2, 5), rockPBR({ tint: [1.6, 0.7, 1.3], envMap: r.envTex, attr: false, accent: 0xff6aa8, haze: HAZE, hazeDens: HD, octaves: 3 }), nd); dm.frustumCulled = false; if (q.shadows) { dm.castShadow = true; dm.receiveShadow = true; }
    for (let i = 0; i < nd; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(20 + rd() * 52); fl.push({ mesh: dm, i, p: v, s: 0.8 + rd() * rd() * 4, ax: new THREE.Vector3(rd() - 0.5, rd(), rd() - 0.5).normalize(), sp: (rd() - 0.5) * 0.4, ph: rd() * 6.28 }); } root.add(dm);
    const nc = 16, cm = new THREE.InstancedMesh(crystalGeo(), crystalMat({ haze: HAZE, hazeDens: HD, core: true, glow: 1.2 }), nc); cm.frustumCulled = false;
    for (let i = 0; i < nc; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(22 + rd() * 50); fl.push({ mesh: cm, i, p: v, s: 1.2 + rd() * 2.2, sy: 1.8 + rd() * 1.6, ax: new THREE.Vector3(rd() - 0.5, 1, rd() - 0.5).normalize(), sp: (rd() - 0.5) * 0.5, ph: rd() * 6.28, crys: true }); cm.setColorAt(i, colorOf(i)); }
    cm.instanceColor.needsUpdate = true; root.add(cm);
  }
  const fm = [...new Set(fl.map((x) => x.mesh))]; let tt = 0; const qq = new THREE.Quaternion(), mm = new THREE.Matrix4(), ps = new THREE.Vector3(), sc = new THREE.Vector3();

  // ── el núcleo: foco de luz que late ──
  const core = new THREE.Group(); root.add(core);
  const spr = (tex, col, order) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); s.renderOrder = order; core.add(s); return s; };
  const halo = spr(r.shared('env.soft', softTex), 0xff9a60, 5), halo2 = spr(r.shared('env.soft', softTex), 0xffd8b0, 6), rays = deco ? spr(r.shared('env.rays', raysTex), 0xffb888, 5) : null;
  let light = null; if (q.lights >= 3) { light = new THREE.PointLight(0xffa878, 100, 0, 1); core.add(light); }
  if (deco) { // lanzas de luz que salen del núcleo hacia las paredes
    const pg = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(pg, shaftMat(i % 3 ? 0xff9a70 : 0xffc8a0)), d = new THREE.Vector3().randomDirection(), u = m.material.uniforms; u.uAxis.value.copy(d); u.uCenter.value.copy(d).multiplyScalar(46); u.uLen.value = 92; u.uWid.value = 5 + rd() * 8; u.uPh.value = rd() * 10; u.uK.value = 1.6 + rd(); m.frustumCulled = false; m.renderOrder = 4; root.add(m); }
  }

  // ── marea de cero-G: estado (del juego si está a mano; si no, por el aviso del cascarón) ──
  let zeroT = 0, prevWarn = false;
  const sunV = new THREE.Vector3();
  r.dyn.push((dt, t) => {
    let zero = false, warn = r.shellMat.uniforms.uWarn.value > 0.5;
    try { const g = window.__api && window.__api.session && window.__api.session.game; if (g && g.map && g.map.id === 'm2' && typeof g.time === 'number') { const gm = g.map.zeroG ? g.map : map, fx = gm.fx(g.time); zero = !!gm.zeroG(g.time); warn = !!fx.warn; zeroT = 0; prevWarn = warn; } // la marea ahora es un evento de oleada: se lee del mapa de la partida
      else { if (prevWarn && !warn) zeroT = map.tide.zeroEnd - map.tide.zeroAt; prevWarn = warn; if (zeroT > 0) { zeroT -= dt; zero = true; } } } catch { /* sin acceso al juego: sólo por el aviso */ }
    const target = zero ? 1 : warn ? 0.35 : 0; uTide.value += (target - uTide.value) * Math.min(1, dt * 2.2);
    sp.material.uniforms.uK.value = uTide.value; if (motes) { motes.material.uniforms.uAlpha.value = uTide.value * 0.9; motes.material.uniforms.uK.value = uTide.value; motes.visible = uTide.value > 0.03; }
    // luz del núcleo (late) y su dirección como "sol" de los modelos
    const b = heart(t), k = 0.75 + 0.5 * b + uTide.value * 0.2;
    halo.scale.setScalar(34 * k); halo2.scale.setScalar(12 * k); halo.material.opacity = 0.45 + 0.35 * b; halo2.material.opacity = 0.55 + 0.4 * b;
    if (rays) { rays.scale.setScalar(110 * (0.8 + 0.35 * b)); rays.material.opacity = 0.18 + 0.2 * b; rays.material.rotation = t * 0.03; }
    if (light) light.intensity = 90 + 110 * b + uTide.value * 40;
    const c = r.camera.position; if (c.lengthSq() > 1) { sunV.copy(c).normalize().negate(); r.sunDir = sunV.clone(); if (!r.sun.castShadow) r.sun.position.copy(sunV).multiplyScalar(100); }
    r.hemi.intensity = 0.7 + 0.2 * b;
    // escombros: se mecen siempre; con la marea la deriva se acelera
    tt += dt * (1 + uTide.value * 2.4);
    for (const f of fl) { qq.setFromAxisAngle(f.ax, tt * f.sp * 2 + f.ph); ps.set(f.p.x + Math.sin(tt * 0.11 + f.ph) * 3, f.p.y + Math.sin(tt * 0.23 + f.ph) * 2.2, f.p.z + Math.cos(tt * 0.09 + f.ph) * 3);
      sc.set(f.s, f.crys ? f.s * f.sy : f.s, f.s); mm.compose(ps, qq, sc); f.mesh.setMatrixAt(f.i, mm); }
    for (const f of fm) f.instanceMatrix.needsUpdate = true;
  });
  addMotes(r, root, deco ? 120 : 60, 20);
}
