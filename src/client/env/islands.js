import * as THREE from 'three';
import { cfg } from '../quality.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, fbm3, vnoise3 } from './noise.js';
import { rockPBR, rockLite } from './rock.js';
import { crystalGeo, crystalMat, mushroomGeo, mushroomMat, rootGeo, rootMat, fallMat, dc, debrisGeo } from './props.js';

// Islas del Mapa 1: roca modelada (acantilados, estratos, estalactitas), placa jugable con borde luminoso,
// y decorado instanciado (cristales, hongos, raíces, cascadas de luz, escombros flotantes).
// Todo lo jugable (radio, altura, grosor) sale de map.islands: el dibujo coincide con los sólidos de sim/maps.js.

export const ACCENTS = [0x2ee6c8, 0xff4fb8, 0xffb347, 0x8f6bff, 0xa5ff5a, 0x4fb4ff, 0x7fffe8];
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Perfil de roca de una isla: radio en función del ángulo y de la profundidad s (0 = borde jugable). */
function profile(is, k) {
  const R = is.r, thick = is.top - is.y0, rnd = rng(k * 977 + 13), depth = R * (1.4 + rnd() * 0.35), L = thick + depth;
  const dirY = is.hang ? 1 : -1, lipY = is.hang ? is.y0 : is.top, seed = k * 7.31;
  const rad = (th, s) => {
    const u = s <= thick ? 0 : Math.min(1, (s - thick) / depth);
    const base = s <= thick ? R * (1 - 0.03 * s / thick) : R * 0.97 * Math.pow(Math.max(0, 1 - u), 0.72);
    const cx = Math.cos(th), sz = Math.sin(th), f = Math.max(0.6, R * 0.07);
    const n = fbm3(cx * f + seed, s * 0.1, sz * f + seed * 0.5, 4) - 0.5, st = vnoise3(cx * R * 0.22 + seed, s * 0.22, sz * R * 0.22) - 0.5;
    const amp = s <= thick ? 0.05 * (s / thick) : (0.05 + 0.42 * sstep(0, 0.5, u)) * (0.4 + 0.6 * Math.sqrt(Math.max(0, 1 - u)));
    let r = base * (1 + 2 * n * amp + st * 1.1 * amp);
    if (s <= thick) r = Math.max(r, base * 0.985); // arriba: el dibujo nunca se mete dentro del sólido
    return Math.max(r, 0.02 * R);
  };
  const point = (th, s) => { const r = rad(th, s); return new THREE.Vector3(is.x + r * Math.cos(th), lipY + dirY * s, is.z + r * Math.sin(th)); };
  const normal = (th, s) => { const e = 0.5, rs = (rad(th, s + e) - rad(th, Math.max(0, s - e))) / (s > e ? 2 * e : e + s); return new THREE.Vector3(Math.cos(th), -dirY * rs, Math.sin(th)).normalize(); };
  return { R, thick, depth, L, dirY, lipY, rad, point, normal };
}

function rockGeometry(is, k, P, seg, rings, accent) {
  const n = seg * (rings + 1), pos = new Float32Array(n * 3);
  for (let j = 0; j <= rings; j++) {
    const s = P.L * Math.pow(j / rings, 1.45);
    for (let i = 0; i < seg; i++) {
      const th = (i / seg) * Math.PI * 2, r = j === rings ? 0.015 * P.R : P.rad(th, s), o = (j * seg + i) * 3;
      pos[o] = is.x + r * Math.cos(th); pos[o + 1] = P.lipY + P.dirY * s; pos[o + 2] = is.z + r * Math.sin(th);
    }
  }
  const idx = [];
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * seg + i, b = j * seg + (i + 1) % seg, c = (j + 1) * seg + i, d = (j + 1) * seg + (i + 1) % seg; idx.push(a, c, b, b, c, d); }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  { // ¿normales hacia afuera? si no, invertir el orden de los triángulos
    const nm = g.attributes.normal, i0 = seg * 2 + 1, th = (1 / seg) * Math.PI * 2; if (nm.getX(i0) * Math.cos(th) + nm.getZ(i0) * Math.sin(th) < 0) { for (let q = 0; q < idx.length; q += 3) { const t = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  }
  // tapa jugable (abanico), normal ±Y
  const cs = seg, cp = new Float32Array((cs + 1) * 3), cn = new Float32Array((cs + 1) * 3), ci = [], ny = -P.dirY;
  cp.set([is.x, P.lipY, is.z], 0); cn.set([0, ny, 0], 0);
  for (let i = 0; i < cs; i++) { const th = (i / cs) * Math.PI * 2; cp.set([is.x + P.R * Math.cos(th), P.lipY, is.z + P.R * Math.sin(th)], (i + 1) * 3); cn.set([0, ny, 0], (i + 1) * 3); const a = i + 1, b = ((i + 1) % cs) + 1; if (ny > 0) ci.push(0, b, a); else ci.push(0, a, b); }
  const cap = new THREE.BufferGeometry(); cap.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cap.setAttribute('normal', new THREE.BufferAttribute(cn, 3)); cap.setIndex(ci);
  for (const q of [g, cap]) {
    const c = q.attributes.position.count, aa = new Float32Array(c * 3), ai = new Float32Array(c * 4);
    for (let i = 0; i < c; i++) { aa.set([accent.r, accent.g, accent.b], i * 3); ai.set([is.x, is.z, is.r, 0], i * 4); }
    q.setAttribute('aAcc', new THREE.BufferAttribute(aa, 3)); q.setAttribute('aIsl', new THREE.BufferAttribute(ai, 4));
  }
  return [g, cap];
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
const place = (mesh, i, pos, dir, sx, sy, sz) => { _q.setFromUnitVectors(_up, dir); _m.compose(pos, _q, _s.set(sx, sy, sz)); mesh.setMatrixAt(i, _m); };

export function buildIslands(r, map, { haze, hazeDens, sun }) {
  const root = r.mapRoot, q = cfg(), pbr = !!q.post, rd = rng(4242);
  const seg = q.decor ? (q.shadows ? 96 : 72) : 28, rings = q.decor ? 34 : 9;
  const geos = [], P = map.islands.map((is, k) => profile(is, k));
  map.islands.forEach((is, k) => {
    const acc = pbr ? new THREE.Color(ACCENTS[k % ACCENTS.length]) : dc(ACCENTS[k % ACCENTS.length]);
    geos.push(...rockGeometry(is, k, P[k], seg, rings, acc));
  });
  const mat = pbr ? rockPBR({ envMap: r.envTex, haze, hazeDens, octaves: q.shadows ? 4 : 3 }) : rockLite({ haze, hazeDens, sun });
  const body = new THREE.Mesh(mergeGeometries(geos, false), mat); body.frustumCulled = false;
  if (q.shadows) { body.castShadow = true; body.receiveShadow = true; } else if (pbr) body.receiveShadow = false;
  root.add(body);

  const cMat = crystalMat({ haze, hazeDens, sun }), cGeo = crystalGeo();
  const crystals = [], mush = [], roots = [];
  map.islands.forEach((is, k) => {
    const p = P[k], acc = ACCENTS[k % ACCENTS.length], up = -p.dirY, sz = Math.max(0.7, is.r / 22);
    // postes de borde: lo jugable se lee de lejos (siempre, también en Baja)
    const posts = is.r > 20 ? 14 : 9;
    for (let i = 0; i < posts; i++) { const th = (i + 0.5) / posts * Math.PI * 2, e = new THREE.Vector3(is.x + Math.cos(th) * (p.R - 0.35), p.lipY, is.z + Math.sin(th) * (p.R - 0.35)); crystals.push({ pos: e, dir: new THREE.Vector3(0, up, 0), w: 0.42, h: 1.1 + (i % 3) * 0.28, col: acc, k: 1 }); }
    const rim = q.decor ? 5 : 2;
    for (let i = 0; i < rim; i++) { // racimos que asoman por el borde
      const th = rd() * Math.PI * 2, o = new THREE.Vector3(Math.cos(th), 0, Math.sin(th)), base = new THREE.Vector3(is.x + o.x * (p.R + 0.1), p.lipY, is.z + o.z * (p.R + 0.1));
      for (let j = 0; j < 3; j++) { const d = new THREE.Vector3(0, up, 0).addScaledVector(o, 0.5 + rd() * 0.5).addScaledVector(new THREE.Vector3(-o.z, 0, o.x), (rd() - 0.5) * 0.6).normalize();
        crystals.push({ pos: base.clone().addScaledVector(o, rd() * 0.5), dir: d, w: (0.35 + rd() * 0.5) * sz, h: (1.2 + rd() * 2.2) * sz, col: acc, k: 0 }); }
    }
    if (!q.decor) return;
    const nCl = Math.round(7 + is.r * 0.35);
    for (let i = 0; i < nCl; i++) { // geodas en el acantilado y la panza
      const th = rd() * Math.PI * 2, s = 0.5 + rd() * (p.thick + p.depth * 0.55), pt = p.point(th, s), n = p.normal(th, s);
      const m = 2 + Math.floor(rd() * 3), col = rd() < 0.7 ? acc : ACCENTS[(k + 2 + Math.floor(rd() * 3)) % ACCENTS.length];
      for (let j = 0; j < m; j++) { const d = n.clone().add(new THREE.Vector3(rd() - 0.5, rd() - 0.5, rd() - 0.5).multiplyScalar(0.9)); if (p.dirY < 0) d.y += 0.15; d.normalize();
        crystals.push({ pos: pt.clone().addScaledVector(n, -0.25).add(new THREE.Vector3((rd() - 0.5) * 0.7, (rd() - 0.5) * 0.7, (rd() - 0.5) * 0.7)), dir: d, w: (0.25 + rd() * 0.6) * sz, h: (0.8 + rd() * 2.8) * sz, col, k: 0 }); }
    }
    const nm = Math.round(10 + is.r * 0.6), comp = [0xff7ad9, 0x7affd8, 0xffd27a, 0x9d8bff];
    for (let i = 0; i < nm; i++) { // hongos en la franja del borde y al pie de las repisas
      const th = rd() * Math.PI * 2, rr = p.R * (0.84 + 0.13 * rd()), c = rd() < 0.55 ? acc : comp[Math.floor(rd() * 4)];
      mush.push({ pos: new THREE.Vector3(is.x + Math.cos(th) * rr, p.lipY, is.z + Math.sin(th) * rr), dir: new THREE.Vector3(0, up, 0), s: 0.5 + rd() * 0.8, col: c });
    }
    if (!is.hang) for (let i = 0; i < Math.round(8 + is.r * 0.5); i++) { // raíces colgando del borde
      const th = rd() * Math.PI * 2, s = 0.3 + rd() * (p.thick - 0.5), pt = p.point(th, s), len = 2.5 + rd() * 7 * sz;
      roots.push({ pos: pt.addScaledVector(p.normal(th, s), -0.1), th, len, w: 0.7 + rd() * 1.2, col: rd() < 0.6 ? acc : comp[Math.floor(rd() * 4)] });
    }
  });
  if (crystals.length) {
    const im = new THREE.InstancedMesh(cGeo, cMat, crystals.length); im.frustumCulled = false;
    crystals.forEach((c, i) => { place(im, i, c.pos, c.dir, c.w, c.h, c.w); im.setColorAt(i, dc(c.col)); });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; if (q.shadows) { im.castShadow = false; } root.add(im);
  }
  if (mush.length) {
    const im = new THREE.InstancedMesh(mushroomGeo(), mushroomMat({ haze, hazeDens }), mush.length); im.frustumCulled = false;
    mush.forEach((c, i) => { place(im, i, c.pos, c.dir, c.s, c.s, c.s); im.setColorAt(i, dc(c.col)); });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; root.add(im);
  }
  if (roots.length) {
    const im = new THREE.InstancedMesh(rootGeo(), rootMat({ haze, hazeDens }), roots.length); im.frustumCulled = false;
    const o3 = new THREE.Object3D();
    roots.forEach((c, i) => { o3.position.copy(c.pos); o3.rotation.set(0, -c.th, 0); o3.scale.set(c.len * c.w, c.len, c.len * c.w); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); im.setColorAt(i, dc(c.col)); });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; root.add(im);
  }
  if (!q.decor) return { P };

  // cascadas de luz y polvo que caen al vacío
  const wr = rng(99), pl = new THREE.PlaneGeometry(1, 1);
  map.islands.forEach((is, k) => {
    if (is.hang || k === 0 && false) return; const n = k === 0 ? 3 : 1;
    for (let j = 0; j < n; j++) {
      const th = wr() * Math.PI * 2 + k, H = 38 + wr() * 30, W = 1.6 + wr() * 1.8, mt = fallMat(ACCENTS[k % ACCENTS.length], 0.8 + wr() * 0.5), g = new THREE.Group();
      for (const a of [0, Math.PI / 2]) { const m = new THREE.Mesh(pl, mt); m.scale.set(W, H, 1); m.rotation.y = a; m.renderOrder = 2; g.add(m); }
      g.position.set(is.x + Math.cos(th) * (is.r + 0.6), is.top - H / 2 - 0.2, is.z + Math.sin(th) * (is.r + 0.6)); root.add(g);
    }
  });

  // escombros de roca y cristales flotantes (mecen y giran: se actualizan a mano, son pocos)
  const nd = 34, dmesh = new THREE.InstancedMesh(debrisGeo(2, 3), rockPBR({ envMap: r.envTex, attr: false, accent: 0x66b4ff, haze, hazeDens, octaves: 3 }), nd), fl = [];
  dmesh.frustumCulled = false; if (q.shadows) { dmesh.castShadow = true; dmesh.receiveShadow = true; }
  const dr = rng(2024);
  for (let i = 0; i < nd; i++) {
    let x, y, z, tries = 0;
    do { const a = dr() * Math.PI * 2, d = 36 + dr() * 130; x = Math.cos(a) * d; z = Math.sin(a) * d; y = -48 + dr() * 90; tries++; }
    while (tries < 20 && map.islands.some((is, kk) => Math.hypot(x - is.x, z - is.z) < is.r + 7 && y > is.y0 - 9 - is.r * 0.9 && y < is.top + 14));
    fl.push({ mesh: dmesh, i, x, y, z, s: 1 + dr() * dr() * 6, ax: new THREE.Vector3(dr() - 0.5, dr(), dr() - 0.5).normalize(), sp: (dr() - 0.5) * 0.3, ph: dr() * 6.28, amp: 0.4 + dr() * 1.2 });
  }
  root.add(dmesh);
  const nc = 26, cmesh = new THREE.InstancedMesh(cGeo, cMat, nc); cmesh.frustumCulled = false;
  for (let i = 0; i < nc; i++) {
    const a = dr() * Math.PI * 2, d = 80 + dr() * 160; const s = 2 + dr() * 5;
    fl.push({ mesh: cmesh, i, x: Math.cos(a) * d, y: -50 + dr() * 130, z: Math.sin(a) * d, s, sy: 1.8 + dr() * 1.6, ax: new THREE.Vector3(dr() - 0.5, 1, dr() - 0.5).normalize(), sp: (dr() - 0.5) * 0.4, ph: dr() * 6.28, amp: 0.6 + dr(), crys: true });
    cmesh.setColorAt(i, dc(ACCENTS[i % ACCENTS.length]));
  }
  cmesh.instanceColor.needsUpdate = true; root.add(cmesh);
  const qq = new THREE.Quaternion(), mm = new THREE.Matrix4(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
  r.dyn.push((dt, t) => {
    for (const f of fl) { qq.setFromAxisAngle(f.ax, t * f.sp + f.ph); ps.set(f.x + Math.sin(t * 0.13 + f.ph) * f.amp * 2, f.y + Math.sin(t * 0.4 + f.ph) * f.amp, f.z + Math.cos(t * 0.11 + f.ph) * f.amp * 2);
      sc.set(f.s, f.crys ? f.s * f.sy : f.s, f.s); mm.compose(ps, qq, sc); f.mesh.setMatrixAt(f.i, mm); }
    dmesh.instanceMatrix.needsUpdate = true; cmesh.instanceMatrix.needsUpdate = true;
  });
  return { P };
}
