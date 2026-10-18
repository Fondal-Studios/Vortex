// PROXY DE LEJOS con la SILUETA de cada criatura (en vez de una esfera genérica).
// Se «hornea» UNA vez por especie: se construye el modelo real, se asienta en pose de marcha, se funde todo en una sola malla
// estática, se simplifica (agrupando vértices en una rejilla) y se sombrea con colores de vértice. Cuesta 1 llamada de dibujo
// y unos cientos de triángulos por criatura, sin animación ni shaders propios.
import * as THREE from 'three';
import { buildMonster, COLORS } from './models.js';

const MAX_TRIS = 320;      // presupuesto por especie
const LIGHT = new THREE.Vector3(0.35, 0.8, 0.5).normalize();

/** Material único y barato para todos los proxies (el color va en los vértices). */
let sharedMat = null;
export function proxyMaterial() { return sharedMat || (sharedMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); }

/** Pose de asentamiento: unos cuantos pasos de animación a velocidad de marcha. */
function settle(b) {
  const look = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < 12; i++) b.tick(0.05, { id: 1, s: 'run', o: 0, c: 0, hp: 1, sd: 0, st: 0, a: 0 }, i * 0.05, { look, speed: 0.6, dist: 12 });
}

/** Recoge triángulos (posición + color) de todas las mallas visibles del modelo, en el espacio del pivote. */
function collect(b) {
  b.object.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(b.object.matrixWorld).invert();
  const pos = [], col = [], base = new THREE.Color(COLORS[b.kind] || 0xffffff);
  const v = new THREE.Vector3(), m = new THREE.Matrix4(), c = new THREE.Color();
  b.object.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const mt = o.material; if (!mt || Array.isArray(mt) || o.visible === false) return;
    if (mt.blending === THREE.AdditiveBlending || (mt.transparent && mt.opacity < 0.25)) return; // auras y brillos: no son silueta
    if (o.isSkinnedMesh) o.skeleton.update();
    m.multiplyMatrices(inv, o.matrixWorld);
    const g = o.geometry, P = g.attributes.position, C = g.attributes.color, idx = g.index;
    const tint = mt.color && mt.color.isColor ? mt.color : null;
    const n = idx ? idx.count : P.count;
    for (let i = 0; i < n; i++) {
      const k = idx ? idx.getX(i) : i;
      if (o.isSkinnedMesh) o.getVertexPosition(k, v); else v.fromBufferAttribute(P, k);
      v.applyMatrix4(m); pos.push(v.x, v.y, v.z);
      if (C) c.setRGB(C.getX(k), C.getY(k), C.getZ(k)); else if (tint) c.copy(tint); else c.copy(base).multiplyScalar(0.55);
      // las partes brillantes (ojos, núcleo) conservan el color de la especie
      if (mt.emissive && mt.emissive.isColor && mt.emissive.getHex() > 0 && (mt.emissiveIntensity || 1) > 0.8) c.copy(base).lerp(new THREE.Color(0xffffff), 0.25);
      c.lerp(base, 0.5); col.push(c.r, c.g, c.b); // los colores de los shaders no se ven en el horneado: se tiñe con el de la especie
    }
  });
  return { pos, col };
}

/** Simplifica por agrupación en rejilla hasta caber en el presupuesto de triángulos. */
function cluster(pos, col, maxTris) {
  const nv = pos.length / 3, box = new THREE.Box3();
  for (let i = 0; i < nv; i++) box.expandByPoint(new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
  const size = box.getSize(new THREE.Vector3()), diag = Math.max(size.length(), 1e-3);
  let cell = diag / 40, out = null;
  for (let it = 0; it < 12; it++, cell *= 1.22) {
    const map = new Map(), vp = [], vc = [], cnt = [], remap = new Int32Array(nv);
    for (let i = 0; i < nv; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], key = Math.round(x / cell) + ',' + Math.round(y / cell) + ',' + Math.round(z / cell);
      let id = map.get(key);
      if (id === undefined) { id = vp.length / 3; map.set(key, id); vp.push(0, 0, 0); vc.push(0, 0, 0); cnt.push(0); }
      vp[id * 3] += x; vp[id * 3 + 1] += y; vp[id * 3 + 2] += z; vc[id * 3] += col[i * 3]; vc[id * 3 + 1] += col[i * 3 + 1]; vc[id * 3 + 2] += col[i * 3 + 2]; cnt[id]++; remap[i] = id;
    }
    for (let j = 0; j < cnt.length; j++) for (let a = 0; a < 3; a++) { vp[j * 3 + a] /= cnt[j]; vc[j * 3 + a] /= cnt[j]; }
    const seen = new Set(), tri = [];
    for (let i = 0; i + 2 < nv; i += 3) {
      const a = remap[i], b = remap[i + 1], d = remap[i + 2]; if (a === b || b === d || a === d) continue;
      const key = [a, b, d].sort((p, q) => p - q).join('_'); if (seen.has(key)) continue; seen.add(key); tri.push(a, b, d);
    }
    out = { vp, vc, tri }; if (tri.length / 3 <= maxTris) break;
  }
  return out;
}

/** Geometría de silueta para una especie (null si el modelo no aporta nada). Libera el modelo temporal. */
export function bakeProxyGeometry(kind, maxTris = MAX_TRIS) {
  const b = buildMonster(kind); b.kind = kind;
  let geo = null;
  try {
    settle(b);
    const { pos, col } = collect(b);
    if (pos.length >= 9) {
      const r = cluster(pos, col, maxTris);
      if (r && r.tri.length >= 9) {
        geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(r.vp, 3));
        geo.setIndex(r.tri); geo.computeVertexNormals();
        const N = geo.attributes.normal, cs = new Float32Array(r.vc.length), n = new THREE.Vector3();
        for (let i = 0; i < N.count; i++) {
          n.fromBufferAttribute(N, i); const l = 0.5 + 0.5 * Math.max(0, n.dot(LIGHT)) + 0.12 * n.y; // luz de relleno horneada
          const k = Math.min(1.5, l) * 1.15; cs[i * 3] = Math.min(1, r.vc[i * 3] * k + 0.05); cs[i * 3 + 1] = Math.min(1, r.vc[i * 3 + 1] * k + 0.05); cs[i * 3 + 2] = Math.min(1, r.vc[i * 3 + 2] * k + 0.05);
        }
        geo.setAttribute('color', new THREE.BufferAttribute(cs, 3));
        geo.computeBoundingSphere(); geo.userData.proxyOf = kind;
      }
    }
  } finally {
    b.object.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    (b.mats || []).forEach((m) => m && m.dispose && m.dispose());
  }
  return geo;
}
