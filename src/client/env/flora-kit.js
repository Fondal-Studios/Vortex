// KIT DE VEGETACIÓN PSICODÉLICA (docs/FLORA.md → «Dibujo»): geometría barata de las plantas interactivas y de la decoración (árboles de cristal,
// helechos luminosos, setas gigantes, enredaderas que laten) y el pasto bioluminiscente. Todo se hornea en UNA sola malla fusionada (plantas + decorado,
// aId ≥ 0 = planta con estado; aId = −1 = decorado) y otra para el pasto, así el presupuesto de Baja es chico y fijo (≤ 8 llamadas y ≤ 4 000 triángulos).
// Atributos de cada vértice (ya en coordenadas de MUNDO): position, normal, aC color (rgb), aR dirección de balanceo/apertura, aBase base de la planta,
// aP = (brillo, balanceo, apertura, id de planta), aH altura sobre el suelo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CODIGO } from '../../sim/flora-data.js';

const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const Y = new THREE.Vector3(0, 1, 0);
/** Euler que lleva +y hacia la dirección (x, y, z). */
const rotTo = (x, y, z) => { const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(x, y, z).normalize())); return [e.x, e.y, e.z]; };

/* ───────── primitivas (siempre sin índice, base en y = 0) ───────── */
const ni = (g) => (g.index ? g.toNonIndexed() : g);
const sph = (r, w = 8, h = 5) => ni(new THREE.SphereGeometry(r, w, h));
const dome = (r, w = 8, h = 3) => ni(new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2));
const cyl = (r0, r1, h, n = 5, open = false) => { const g = new THREE.CylinderGeometry(r1, r0, h, n, 1, open); g.translate(0, h / 2, 0); return ni(g); };
const cone = (r, h, n = 5) => { const g = new THREE.ConeGeometry(r, h, n, 1, true); g.translate(0, h / 2, 0); return ni(g); };
const oct = (r) => ni(new THREE.OctahedronGeometry(r, 0));
const ico = (r, d = 0) => ni(new THREE.IcosahedronGeometry(r, d));
const tor = (R, t, n = 4, m = 12) => ni(new THREE.TorusGeometry(R, t, n, m));
/** Hoja / pétalo: tira doblada hacia atrás (segmentos en el largo), base en el origen, apunta a +y. */
function petal(len, wid, segs = 1, bend = 0.5) {
  const g = new THREE.PlaneGeometry(wid, len, 1, segs); g.translate(0, len / 2, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len; p.setZ(i, bend * t * t * len * 0.6); p.setX(i, p.getX(i) * (1 - 0.55 * t * t)); }
  g.computeVertexNormals(); return ni(g);
}
function tube(pts, r, segs = 6, rad = 4) { const c = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))); const g = new THREE.TubeGeometry(c, segs, r, rad, false); return ni(g); }
function strip(len, wid, segs, curl) {   // helecho: tira que se arquea
  const g = new THREE.PlaneGeometry(wid, len, 1, segs); g.translate(0, len / 2, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len; p.setZ(i, curl * t * t * len); p.setY(i, p.getY(i) * (1 - 0.2 * t * t)); p.setX(i, p.getX(i) * (1 - 0.8 * t)); }
  g.computeVertexNormals(); return ni(g);
}

/* ───────── constructor de piezas ───────── */
class Piezas {
  constructor() { this.list = []; }
  /** geo: geometría; p: posición; r: rotación XYZ; s: escala; c: color; g: brillo; w: balanceo; o: apertura; gy: el brillo crece hacia la punta (potencia) */
  add(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], c = [1, 1, 1], g = 0, w = 0, o = 0, gy = 0, dir = null } = {}) {
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));
    this.list.push({ geo, c, g, w, o, gy, dir }); return this;
  }
  /** Fusiona todo con los atributos propios. `M`: matriz local→mundo; `id`: número de planta (o −1); `base`: base en el mundo. Devuelve BufferGeometry. */
  hornear(M, id, base, yaw = 0) {
    const Q = new THREE.Quaternion().setFromRotationMatrix(M), parts = [];
    let ymax = 0.001; for (const q of this.list) { q.geo.computeBoundingBox(); ymax = Math.max(ymax, q.geo.boundingBox.max.y); }
    const sway = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)).applyQuaternion(Q);
    for (const q of this.list) {
      const g = q.geo.clone(), n = g.attributes.position.count, P = g.attributes.position, N = g.attributes.normal;
      const aC = new Float32Array(n * 3), aR = new Float32Array(n * 3), aP = new Float32Array(n * 4), aH = new Float32Array(n), aB = new Float32Array(n * 3);
      const loc = new THREE.Vector3(), rad = new THREE.Vector3(), nor = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        loc.set(P.getX(i), P.getY(i), P.getZ(i)); nor.set(N.getX(i), N.getY(i), N.getZ(i));
        const hy = Math.max(0, loc.y);
        rad.set(loc.x, 0, loc.z); if (rad.lengthSq() < 1e-6) rad.set(0, 0, 0); else rad.normalize();
        const useRad = q.o > 0.001, dir = q.dir ? new THREE.Vector3(...q.dir).applyQuaternion(Q) : useRad ? rad.applyQuaternion(Q) : sway.clone();
        loc.applyMatrix4(M); nor.applyQuaternion(Q).normalize();
        P.setXYZ(i, loc.x, loc.y, loc.z); N.setXYZ(i, nor.x, nor.y, nor.z);
        aC[i * 3] = q.c[0]; aC[i * 3 + 1] = q.c[1]; aC[i * 3 + 2] = q.c[2];
        aR[i * 3] = dir.x; aR[i * 3 + 1] = dir.y; aR[i * 3 + 2] = dir.z;
        const gl = q.gy ? q.g * Math.pow(Math.min(1, hy / ymax), q.gy) : q.g;
        aP[i * 4] = gl; aP[i * 4 + 1] = q.w * Math.min(1, hy / ymax + 0.15); aP[i * 4 + 2] = q.o; aP[i * 4 + 3] = id;
        aH[i] = hy * Math.sqrt(M.elements[4] ** 2 + M.elements[5] ** 2 + M.elements[6] ** 2);
        aB[i * 3] = base.x; aB[i * 3 + 1] = base.y; aB[i * 3 + 2] = base.z;
      }
      const o = new THREE.BufferGeometry(); o.setAttribute('position', P.clone()); o.setAttribute('normal', N.clone());
      o.setAttribute('aC', new THREE.BufferAttribute(aC, 3)); o.setAttribute('aR', new THREE.BufferAttribute(aR, 3)); o.setAttribute('aBase', new THREE.BufferAttribute(aB, 3));
      o.setAttribute('aP', new THREE.BufferAttribute(aP, 4)); o.setAttribute('aH', new THREE.BufferAttribute(aH, 1)); parts.push(o); g.dispose();
    }
    return parts;
  }
}

/* ───────── siluetas de las plantas ───────── */
/** Paleta de una especie: principal (código de color), tallo (verde de la arena) y chispa (casi blanco). */
export function paletaEspecie(S, pal) {
  const main = rgb(CODIGO[S.col]), hoja = rgb(pal.hoja), tallo = mixc(hoja, [0.05, 0.35, 0.2], 0.55);
  return { main, tallo, hoja, chispa: mixc(main, [1, 1, 1], 0.6), oscuro: mixc(main, [0.05, 0.02, 0.08], 0.55) };
}
/** `det`: 0 Baja · 1 Media · 2 Alta. Devuelve las piezas de la especie (coordenadas locales, y = arriba, ~1–2 m de alto). */
export function formaPlanta(forma, S, pal, det) {
  const P = new Piezas(), C = paletaEspecie(S, pal), n = (a, b, c) => [a, b, c][det];
  const ring = (k, f) => { for (let i = 0; i < k; i++) f((i / k) * Math.PI * 2, i); };
  switch (forma) {
    case 'flor': case 'lirio': {
      const k = n(5, 6, 8), esLirio = forma === 'lirio';
      P.add(cyl(0.05, 0.07, 0.95, n(4, 5, 6)), { c: C.tallo, w: 0.35 }).add(petal(0.4, 0.2, 1, 0.3), { p: [0, 0.25, 0], r: [-0.9, 0, 0], c: C.tallo, w: 0.3 }).add(petal(0.4, 0.2, 1, 0.3), { p: [0, 0.35, 0], r: [-0.9, 3.14, 0], c: C.tallo, w: 0.3 });
      P.add(sph(0.13, n(5, 6, 8), n(3, 4, 5)), { p: [0, 0.98, 0], c: C.chispa, g: 1.1, w: 0.4 });
      ring(k, (a) => P.add(petal(esLirio ? 0.55 : 0.5, esLirio ? 0.2 : 0.3, 1, esLirio ? 0.9 : 0.4), { p: [0, 0.95, 0], r: [-(esLirio ? 0.5 : 1.1), a, 0], c: C.main, g: 0.7, w: 0.4, o: 0.9, gy: 1 }));
      if (esLirio) P.add(tor(0.22, 0.02, 3, 10), { p: [0, 1.0, 0], r: [Math.PI / 2, 0, 0], c: C.chispa, g: 1 });
      break; }
    case 'brote':
      P.add(cyl(0.06, 0.09, 0.6, 5), { c: C.tallo, w: 0.3 });
      ring(n(3, 5, 6), (a) => P.add(petal(0.55, 0.3, 1, 0.8), { p: [0, 0.35, 0], r: [-0.9, a, 0], c: mixc(C.tallo, C.main, 0.35), g: 0.35, w: 0.5, o: 0.6 }));
      P.add(sph(0.2, n(5, 7, 9), n(3, 4, 6)), { p: [0, 0.75, 0], c: C.main, g: 1.2, w: 0.3 }); P.add(tor(0.34, 0.03, 3, n(6, 12, 16)), { p: [0, 0.75, 0], r: [Math.PI / 2, 0, 0], c: C.chispa, g: 1, o: 0.5 });
      break;
    case 'fruto':
      ring(n(3, 5, 6), (a, i) => P.add(sph(0.38, n(5, 6, 8), n(3, 4, 5)), { p: [Math.cos(a) * 0.42, 0.35 + (i % 2) * 0.12, Math.sin(a) * 0.42], c: mixc(C.tallo, C.hoja, 0.3), w: 0.4 }));
      ring(n(2, 4, 5), (a, i) => P.add(sph(0.17, n(4, 6, 8), n(3, 4, 5)), { p: [Math.cos(a + 0.5) * 0.5, 0.75 + (i % 2) * 0.2, Math.sin(a + 0.5) * 0.5], c: C.main, g: 1.1, w: 0.5, o: 0.4 }));
      P.add(sph(0.22, n(5, 6, 8), n(3, 4, 5)), { p: [0, 1.05, 0], c: C.chispa, g: 1.3, w: 0.4 });
      break;
    case 'bulbo':
      P.add(sph(0.5, n(6, 8, 10), n(4, 5, 7)), { p: [0, 0.5, 0], s: [1, 1.15, 1], c: mixc(C.main, C.tallo, 0.35), g: 0.55, o: 0.5 });
      P.add(sph(0.22, n(5, 6, 8), n(3, 4, 5)), { p: [0, 0.62, 0], c: C.chispa, g: 1.3 });
      ring(n(5, 6, 8), (a) => P.add(petal(0.8, 0.26, 1, 0.5), { p: [Math.cos(a) * 0.25, 0.85, Math.sin(a) * 0.25], r: [-0.55, a, 0], c: C.tallo, g: 0.2, w: 0.55, o: 0.4 }));
      break;
    case 'hongo':
      P.add(cyl(0.12, 0.2, 0.55, n(5, 6, 8)), { c: mixc(C.hoja, [1, 1, 1], 0.55), w: 0.15 });
      P.add(dome(0.62, n(7, 9, 12), n(3, 4, 5)), { p: [0, 0.5, 0], s: [1, 0.75, 1], c: C.main, g: 0.55, o: 0.8, w: 0.1 });
      ring(n(4, 6, 8), (a, i) => P.add(sph(0.075, 4, 3), { p: [Math.cos(a) * 0.36, 0.78 - (i % 2) * 0.06, Math.sin(a) * 0.36], c: C.chispa, g: 1.4 }));
      break;
    case 'sueno':
      P.add(tube([[0, 0, 0], [0.05, 0.5, 0], [0.22, 0.9, 0], [0.38, 1.0, 0]], 0.04, n(4, 5, 6), 4), { c: C.tallo, w: 0.5 });
      ring(n(5, 6, 8), (a) => P.add(petal(0.5, 0.2, 1, 0.5), { p: [0.38, 1.0, 0], r: [-2.4, a, 0], c: C.main, g: 0.8, w: 0.5, o: 0.9, gy: 1 }));
      P.add(sph(0.12, 5, 3), { p: [0.38, 0.95, 0], c: C.chispa, g: 1.3, w: 0.5 });
      break;
    case 'carnivora': {
      P.add(tube([[0, 0, 0], [0.12, 0.45, 0], [-0.05, 0.9, 0.05], [0, 1.1, 0.1]], 0.1, n(4, 6, 8), 5), { c: C.tallo, w: 0.2 });
      const hy = 1.2, up = dome(0.62, n(7, 9, 12), n(3, 4, 5)), lo = dome(0.62, n(7, 9, 12), n(3, 4, 5)); lo.rotateX(Math.PI);
      P.add(up, { p: [0, hy, 0.1], s: [1, 0.85, 1], c: C.main, g: 0.6, o: 1, dir: [0, 1, 0.25], w: 0.05 });
      P.add(lo, { p: [0, hy, 0.1], s: [1, 0.7, 1], c: mixc(C.main, C.oscuro, 0.45), g: 0.45, o: 1, dir: [0, -1, 0.1], w: 0.05 });
      const k = n(4, 7, 9);
      ring(k, (a) => { const x = Math.cos(a) * 0.56, z = Math.sin(a) * 0.56; P.add(cone(0.05, 0.26, 3), { p: [x, hy, z + 0.1], r: [Math.PI, 0, 0], c: [0.97, 0.95, 0.85], g: 0.5, o: 1, dir: [0, 1, 0.25] }); P.add(cone(0.05, 0.22, 3), { p: [x, hy, z + 0.1], c: [0.97, 0.95, 0.85], g: 0.5, o: 1, dir: [0, -1, 0.1] }); });
      P.add(sph(0.2, 5, 3), { p: [0, hy + 0.05, 0.1], c: C.chispa, g: 1.5, o: 0.3, dir: [0, 0, 1] });
      ring(n(2, 3, 4), (a) => P.add(petal(0.7, 0.3, 1, 0.5), { p: [0, 0.2, 0], r: [-0.9, a, 0], c: C.tallo, w: 0.4 }));
      break; }
    case 'zarza': {
      const k = n(6, 8, 11);
      ring(k, (a, i) => P.add(cone(0.085, 0.8 + (i % 3) * 0.25, n(3, 4, 5)), { p: [Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22], r: rotTo(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55), c: mixc(C.main, C.oscuro, 0.2 + (i % 2) * 0.3), g: 1.3, w: 0.25, gy: 2 }));
      ring(n(3, 4, 5), (a, i) => P.add(tube([[Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1], [Math.cos(a) * 0.55, 0.5 + i * 0.1, Math.sin(a) * 0.55], [Math.cos(a + 0.6) * 0.8, 0.2, Math.sin(a + 0.6) * 0.8]], 0.035, n(3, 4, 5), 3), { c: C.main, g: 0.5, w: 0.3 }));
      P.add(sph(0.14, 4, 3), { p: [0, 0.18, 0], c: C.chispa, g: 1 });
      break; }
    case 'liana':
      ring(n(2, 4, 5), (a, i) => { const L = 1.3 + (i % 2) * 0.4; P.add(tube([[Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15], [Math.cos(a) * 0.5, 0.7, Math.sin(a) * 0.5], [Math.cos(a + 0.7) * 0.4, L, Math.sin(a + 0.7) * 0.4], [Math.cos(a + 1.4) * 0.15, L + 0.35, Math.sin(a + 1.4) * 0.15]], 0.06, n(4, 7, 10), n(3, 4, 4)), { c: mixc(C.tallo, C.main, 0.4), g: 0.9, w: 0.9, o: 0.5, gy: 1.5 }); });
      P.add(tor(0.5, 0.04, 3, n(8, 14, 18)), { p: [0, 0.06, 0], r: [Math.PI / 2, 0, 0], c: C.main, g: 1, o: 0.6 });
      P.add(sph(0.2, 5, 3), { p: [0, 0.15, 0], c: C.chispa, g: 1 });
      break;
    case 'vejiga':
      P.add(cyl(0.05, 0.07, 0.6, 5), { c: C.tallo, w: 0.3 });
      P.add(sph(0.6, n(6, 9, 12), n(4, 6, 8)), { p: [0, 1.0, 0], c: C.main, g: 0.9, o: 1, w: 0.25 });
      ring(n(1, 3, 5), (a) => P.add(tor(0.6, 0.025, 3, n(7, 12, 16)), { p: [0, 1.0, 0], r: [a * 0.5, a, 0], c: C.chispa, g: 1.2, o: 1 }));
      P.add(petal(0.5, 0.2, 1, 0.5), { p: [0, 0.1, 0], r: [-0.9, 0.5, 0], c: C.tallo, w: 0.4 });
      break;
    case 'espejo':
      P.add(cyl(0.05, 0.07, 0.4, 5), { c: C.tallo });
      ring(n(5, 6, 7), (a, i) => P.add(petal(0.95, 0.5, 1, 0.1), { p: [0, 0.4, 0], r: [-0.2 - (i % 2) * 0.15, a, 0], c: mixc([0.8, 0.95, 1], C.main, 0.35), g: 0.8, w: 0.3, o: 0.35, gy: 1.5 }));
      P.add(oct(0.2), { p: [0, 0.95, 0], s: [1, 1.6, 1], c: C.chispa, g: 1.4, w: 0.15 });
      break;
    case 'arbol':
      P.add(cyl(0.2, 0.34, 2.3, n(5, 6, 8)), { c: mixc(C.tallo, [0.25, 0.14, 0.08], 0.6), w: 0.12 });
      [[0, 2.7, 0, 1.15], [0.8, 2.3, 0.2, 0.75], [-0.7, 2.4, -0.3, 0.8]].forEach(([x, y, z, r]) => P.add(sph(r, n(6, 8, 10), n(4, 5, 7)), { p: [x, y, z], c: mixc(C.hoja, C.main, 0.3), g: 0.18, w: 0.7, o: 0.2 }));
      ring(n(4, 5, 7), (a, i) => P.add(cone(0.06, 0.55 + (i % 2) * 0.25, 4), { p: [Math.cos(a) * 0.8, 2.15 - (i % 2) * 0.3, Math.sin(a) * 0.8], r: [Math.PI, 0, 0], c: C.main, g: 1.2, w: 0.2, gy: 1 }));
      break;
    case 'arbusto':
      [[0, 0.45, 0, 0.55], [0.5, 0.35, 0.2, 0.4], [-0.45, 0.4, -0.2, 0.45], [0.1, 0.35, -0.5, 0.38]].slice(0, n(3, 4, 4)).forEach(([x, y, z, r]) => P.add(sph(r, n(5, 6, 8), n(3, 4, 5)), { p: [x, y, z], c: mixc(C.oscuro, C.tallo, 0.4), g: 0.15, w: 0.4 }));
      ring(n(4, 7, 10), (a, i) => P.add(sph(0.085, 4, 3), { p: [Math.cos(a) * 0.55, 0.55 + (i % 3) * 0.14, Math.sin(a) * 0.55], c: i % 2 ? C.main : C.chispa, g: 1.6, w: 0.5, o: 0.3 }));
      break;
    case 'cardo':
      P.add(cyl(0.05, 0.08, 0.6, 5), { c: C.tallo, w: 0.2 });
      P.add(sph(0.3, n(6, 7, 9), n(4, 5, 6)), { p: [0, 0.85, 0], c: C.oscuro, g: 0.5, o: 1 });
      ring(n(7, 10, 14), (a, i) => { const el = i % 2 ? 0.45 : -0.1, d = [Math.cos(a) * Math.cos(el), Math.sin(el) + 0.2, Math.sin(a) * Math.cos(el)]; P.add(cone(0.05, 0.42, 3), { p: [d[0] * 0.25, 0.85 + d[1] * 0.25, d[2] * 0.25], r: rotTo(...d), c: C.main, g: 1.4, o: 1, gy: 1.5 }); });
      break;
    default:
      P.add(cyl(0.06, 0.08, 0.8, 5), { c: C.tallo }).add(sph(0.2, 5, 3), { p: [0, 0.9, 0], c: C.main, g: 1 });
  }
  return P;
}

/* ───────── decorado (sin estado): árboles de cristal, helechos, setas gigantes, enredaderas que laten ───────── */
export function formaDeco(tipo, pal, det, rnd) {
  const P = new Piezas(), A = rgb(pal.a), B = rgb(pal.b), H = rgb(pal.hoja), n = (a, b, c) => [a, b, c][det];
  const k = (x) => x * (0.8 + 0.4 * rnd());
  switch (tipo) {
    case 'cristal': {   // racimo de prismas de cristal que brillan en la punta
      const m = n(3, 4, 5);
      for (let i = 0; i < m; i++) { const a = rnd() * 6.28, h = k(i === 0 ? 2.4 : 1.4), t = i === 0 ? 0 : 0.35 + rnd() * 0.25; P.add(oct(0.28), { p: [Math.cos(a) * 0.35 * (i > 0), 0, Math.sin(a) * 0.35 * (i > 0)], r: [Math.sin(a) * t, 0, -Math.cos(a) * t], s: [1, h / 0.28 / 1.2, 1], c: i % 2 ? mixc(B, [1, 1, 1], 0.25) : mixc(A, [1, 1, 1], 0.25), g: 1.1, w: 0.1, gy: 1.2 }); }
      break; }
    case 'helecho': {
      const m = n(5, 6, 8);
      for (let i = 0; i < m; i++) P.add(strip(k(1.2), 0.34, n(2, 3, 4), 0.5), { r: [-0.35 - rnd() * 0.3, (i / m) * Math.PI * 2 + rnd() * 0.3, 0], c: mixc(H, A, 0.25 + 0.3 * rnd()), g: 0.75, w: 0.9, gy: 1.4 });
      P.add(sph(0.07, 4, 3), { p: [0, 0.05, 0], c: [1, 1, 1], g: 1 });
      break; }
    case 'seta': {
      const r = k(0.9);
      P.add(cyl(0.2, 0.3, r * 1.1, n(5, 6, 8)), { c: mixc(H, [1, 1, 1], 0.6), w: 0.1 });
      P.add(dome(r, n(7, 9, 12), n(3, 4, 5)), { p: [0, r * 1.05, 0], s: [1, 0.7, 1], c: mixc(B, A, rnd()), g: 0.6, w: 0.08 });
      for (let i = 0; i < n(3, 5, 7); i++) { const a = rnd() * 6.28, d = rnd() * r * 0.6; P.add(sph(0.09, 4, 3), { p: [Math.cos(a) * d, r * 1.05 + 0.7 * Math.sqrt(Math.max(0, r * r - d * d)) * 0.7, Math.sin(a) * d], c: [1, 1, 1], g: 1.4 }); }
      break; }
    case 'enredadera': {   // arco de savia luminosa que late
      const w = k(1.4), h = k(0.9), a = rnd() * 6.28, dx = Math.cos(a), dz = Math.sin(a);
      P.add(tube([[-dx * w / 2, 0, -dz * w / 2], [-dx * w / 3, h, -dz * w / 3], [dx * w / 3, h * 1.05, dz * w / 3], [dx * w / 2, 0, dz * w / 2]], 0.06, n(6, 8, 12), 4), { c: mixc(H, B, 0.45), g: 1.3, w: 0.2, gy: 0.6 });
      break; }
    case 'hueso': {   // árbol de hueso (Osario): tronco blanco con ramas curvas
      P.add(cyl(0.12, 0.22, k(2.2), n(4, 5, 6)), { c: mixc(H, [1, 1, 1], 0.5), w: 0.1 });
      for (let i = 0; i < n(3, 4, 5); i++) { const a = (i / 4) * 6.28 + rnd(); P.add(tube([[0, 1.5, 0], [Math.cos(a) * 0.5, 2.0, Math.sin(a) * 0.5], [Math.cos(a) * 0.9, 2.1, Math.sin(a) * 0.9]], 0.05, 3, 3), { c: [0.93, 0.9, 0.8], g: 0.3, w: 0.4 }); P.add(sph(0.1, 4, 3), { p: [Math.cos(a) * 0.9, 2.1, Math.sin(a) * 0.9], c: B, g: 1.3, w: 0.4 }); }
      break; }
    default:
      P.add(oct(0.4), { c: A, g: 1 });
  }
  return P;
}
/** Qué decorado lleva cada arena (tipo, cantidad en Media; Baja ≈ ×0,6, Alta ≈ ×1,6). */
export const DECO_ARENA = {
  m1: [['cristal', 5], ['helecho', 5], ['enredadera', 4], ['seta', 2]],
  m2: [['cristal', 7], ['helecho', 2], ['enredadera', 4]],
  m3: [['helecho', 7], ['cristal', 3], ['enredadera', 5]],
  m4: [['seta', 6], ['enredadera', 6], ['helecho', 4]],
  m5: [['helecho', 4], ['enredadera', 4], ['cristal', 4], ['seta', 2]],
  m6: [['hueso', 5], ['seta', 4], ['enredadera', 3], ['helecho', 2]],
};

/* ───────── pasto bioluminiscente: manojos de 3 hojas (1 triángulo cada una), con la punta en `aT = 1` ───────── */
export function pastoGeometria(manojos, rnd, pal, mundoUp, tamanio = 0.75) {
  const A = rgb(pal.a), H = rgb(pal.hoja), pos = [], base = [], tip = [], up = [], col = [], ph = [];
  const t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  for (const m of manojos) {
    const u = new THREE.Vector3(...m.u); t1.set(1, 0, 0); if (Math.abs(u.x) > 0.9) t1.set(0, 0, 1); t1.cross(u).normalize(); t2.crossVectors(u, t1);
    for (let b = 0; b < 3; b++) {
      const a = rnd() * 6.28, off = rnd() * 0.35, h = (0.35 + rnd() * 0.45) * tamanio, w = 0.07 + rnd() * 0.05, lean = 0.15 + rnd() * 0.25;
      const cx = Math.cos(a) * off, cz = Math.sin(a) * off, B = [m.p[0] + t1.x * cx + t2.x * cz, m.p[1] + t1.y * cx + t2.y * cz, m.p[2] + t1.z * cx + t2.z * cz];
      const sx = Math.cos(a + 1.57) * w, sz = Math.sin(a + 1.57) * w, lx = Math.cos(a) * lean, lz = Math.sin(a) * lean;
      const side = (s) => [B[0] + t1.x * sx * s + t2.x * sz * s, B[1] + t1.y * sx * s + t2.y * sz * s, B[2] + t1.z * sx * s + t2.z * sz * s];
      const T = [B[0] + u.x * h + t1.x * lx + t2.x * lz, B[1] + u.y * h + t1.y * lx + t2.y * lz, B[2] + u.z * h + t1.z * lx + t2.z * lz];
      const L = side(1), R = side(-1), hue = rnd();
      for (const [v, tt] of [[L, 0], [R, 0], [T, 1]]) { pos.push(...v); base.push(...B); tip.push(tt, h, rnd() * 6.28); up.push(u.x, u.y, u.z); const c = mixc(mixc(H, A, hue * 0.6), [1, 1, 1], tt * 0.25); col.push(c[0], c[1], c[2]); ph.push(hue); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('aBase', new THREE.BufferAttribute(new Float32Array(base), 3));
  g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(tip), 3)); g.setAttribute('aU', new THREE.BufferAttribute(new Float32Array(up), 3)); g.setAttribute('aC', new THREE.BufferAttribute(new Float32Array(col), 3));
  void mundoUp; return g;
}
export { Piezas, Y, mixc, rgb, mergeGeometries };
