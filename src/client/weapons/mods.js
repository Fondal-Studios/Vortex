// Mejoras visibles: applyUpgrades(group, upg) agrega piezas a CUALQUIER modelo de arma.
//   upg = { dmg: 0-5, rate: 0-5, mag: 0-4, mod: null | 'perfora' | 'explosiva' | 'cadena' | 'vampirica' }
// Costo: 1 malla fusionada + 1 material compartido (sin PointLights). Volver a llamar reemplaza lo anterior.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OUT } from '../shaders.js';

// Anclas por arma: r = radio de los anillos, z0 = z de la boca, top = altura del lomo, side = x del costado izquierdo, rz = z del receptor
const ANCH = [
  { r: 0.045, top: 0.075, side: 0.028, rz: 0.0 }, { r: 0.058, top: 0.1, side: 0.034, rz: 0.0 }, { r: 0.062, top: 0.098, side: 0.038, rz: 0.0 }, { r: 0.085, top: 0.14, side: 0.075, rz: 0.0 }, { r: 0.058, top: 0.1, side: 0.036, rz: 0.0 },
  { r: 0.05, top: 0.075, side: 0.028, rz: 0.0 }, { r: 0.07, top: 0.09, side: 0.046, rz: 0.0 }, { r: 0.1, top: 0.14, side: 0.04, rz: 0.0 }, { r: 0.05, top: 0.08, side: 0.034, rz: 0.0 }, { r: 0.08, top: 0.1, side: 0.04, rz: 0.0 },
  { r: 0.07, top: 0.1, side: 0.044, rz: 0.0 }, { r: 0.09, top: 0.1, side: 0.04, rz: 0.0 }, { r: 0.056, top: 0.1, side: 0.036, rz: 0.0 }, { r: 0.04, top: 0.065, side: 0.028, rz: 0.0 }, { r: 0.09, top: 0.105, side: 0.06, rz: 0.0 },
];
const RED = 0xff4a20, ORANGE = 0xff9a30, CYAN = 0x40f0ff, YELLOW = 0xffe060, VIOLET = 0xc070ff;

let MAT = null;
function material() {
  if (MAT) return MAT;
  MAT = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute vec3 color; attribute vec3 aCen; attribute vec4 aAnim; // spin, freq pulso, latido, fase
      uniform float uTime; varying vec3 vC; varying vec3 vView; varying float vP;
      void main(){ vec3 p = position - aCen; float a = uTime * aAnim.x; float c = cos(a), s = sin(a); p.xy = mat2(c, -s, s, c) * p.xy;
        p *= 1.0 + aAnim.z * 0.28 * sin(uTime * 6.0 + aAnim.w);
        vP = aAnim.y > 0.0 ? 0.55 + 0.45 * (aAnim.y > 20.0 ? step(0.5, fract(sin(floor(uTime * aAnim.y * 0.25 + aAnim.w) * 91.7) * 43758.5)) : sin(uTime * aAnim.y + aAnim.w)) : 1.0;
        vC = color; vec4 mv = modelViewMatrix * vec4(p + aCen, 1.0); vView = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying vec3 vView; varying float vP;
      void main(){ vec3 n = normalize(cross(dFdx(vView), dFdy(vView))); vec3 v = normalize(-vView); if (dot(n, v) < 0.0) n = -n;
        float nv = clamp(dot(n, v), 0.0, 1.0); vec3 col = vC * (0.55 + 0.9 * nv) * (0.8 + 0.7 * vP) + vec3(1.0) * pow(1.0 - nv, 3.0) * 0.25 * vP;
        col = 1.0 - exp(-col * 1.5); gl_FragColor = vec4(col, 1.0);
        //LIN
      }`,
  });
  MAT.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('//LIN', OUT.linear ? 'gl_FragColor.rgb = pow(max(gl_FragColor.rgb, vec3(0.0)), vec3(2.2));' : ''); };
  MAT.customProgramCacheKey = () => 'wmods' + (OUT.linear ? 'L' : 'S');
  return MAT;
}

/** Acumulador de geometrías con atributos de animación. */
class Bag {
  constructor() { this.g = []; }
  add(geo, pos, { rot = [0, 0, 0], scale = [1, 1, 1], color = 0xffffff, cen = null, spin = 0, freq = 0, beat = 0, phase = 0 } = {}) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()); g.deleteAttribute('uv'); g.applyMatrix4(m);
    const n = g.attributes.position.count, col = new THREE.Color(color), C = cen || pos;
    const ca = new Float32Array(n * 3), cc = new Float32Array(n * 3), aa = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { ca.set([col.r, col.g, col.b], i * 3); cc.set(C, i * 3); aa.set([spin, freq, beat, phase], i * 4); }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); g.setAttribute('aCen', new THREE.BufferAttribute(cc, 3)); g.setAttribute('aAnim', new THREE.BufferAttribute(aa, 4));
    this.g.push(g); return this;
  }
  mesh() { if (!this.g.length) return null; const geo = mergeGeometries(this.g, false); this.g.forEach((x) => x.dispose()); const m = new THREE.Mesh(geo, material()); m.frustumCulled = false; m.name = 'mejoras'; m.onBeforeRender = () => { MAT.uniforms.uTime.value = performance.now() / 1000; }; return m; }
}
const GEO = {
  tet: new THREE.TetrahedronGeometry(1, 0), oct: new THREE.OctahedronGeometry(1, 0), ico: new THREE.IcosahedronGeometry(1, 0), box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(-Math.PI / 2), cone: new THREE.CylinderGeometry(0.0, 1, 1, 8).rotateX(-Math.PI / 2), // cone: punta hacia -Z
  tor: new THREE.TorusGeometry(1, 0.07, 5, 24), sph: new THREE.SphereGeometry(1, 10, 6),
};

/** Aplica (o reemplaza) las mejoras visibles sobre un grupo de arma. Devuelve el grupo. */
export function applyUpgrades(group, upg = {}) {
  const old = group.userData._upgMesh;
  if (old) { group.remove(old); old.geometry.dispose(); group.userData._upgMesh = null; }
  const u = { dmg: clamp(upg.dmg | 0, 0, 5), rate: clamp(upg.rate | 0, 0, 5), mag: clamp(upg.mag | 0, 0, 4), mod: upg.mod || null };
  group.userData.upg = u;
  if (!u.dmg && !u.rate && !u.mag && !u.mod) return group;
  const A = ANCH[(group.userData.index | 0) % ANCH.length], mz = group.userData.muzzle || [0, 0.04, -0.6], mx = mz[0], my = mz[1], mzz = mz[2], bag = new Bag();

  // dmg: aletas/cristales rojo-naranja sobre el lomo, de la boca hacia atrás; crecen con el nivel; desde 3, alas laterales
  for (let i = 0; i < u.dmg; i++) {
    const z = mzz * 0.15 + 0.12 - i * (-mzz * 0.7 / 5), s = 0.012 + 0.004 * u.dmg + i * 0.0015, col = i % 2 ? RED : ORANGE;
    bag.add(GEO.tet, [0, A.top + s * 0.7, z], { scale: [s * 0.8, s * 1.9, s * 1.5], color: col, beat: u.dmg >= 5 ? 0.15 : 0, phase: i });
    if (u.dmg >= 3) for (const sx of [-1, 1]) bag.add(GEO.oct, [sx * (A.side + 0.012), A.top - 0.02, z], { scale: [s * 0.35, s * 1.2, s * 1.1], color: RED, rot: [0, 0, sx * 0.6] });
  }
  // rate: anillos de aceleración girando en la boca; más anillos, más brillo y más vueltas
  for (let i = 0; i < u.rate; i++) {
    const z = mzz + 0.1 + i * 0.065, r = A.r * (1.05 + i * 0.045), col = [YELLOW, CYAN, YELLOW, CYAN, 0xffffff][i], cen = [mx, my, z], sp = (i % 2 ? -1 : 1) * (3 + i * 2.2);
    bag.add(GEO.tor, [mx, my, z], { scale: [r, r, r * 2.0], color: col, cen, spin: sp, freq: 3 + i });
    for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2; bag.add(GEO.box, [mx + Math.cos(a) * r, my + Math.sin(a) * r, z], { scale: [0.012 + i * 0.002, 0.012 + i * 0.002, 0.026], rot: [0, 0, a], color: 0xffffff, cen, spin: sp, freq: 3 + i }); }
  }
  // mag: celdas de energía en el costado izquierdo (visible desde la cámara) y un bastidor
  for (let i = 0; i < u.mag; i++) {
    const z = 0.05 - i * 0.075, x = -(A.side + 0.02);
    bag.add(GEO.cyl, [x, A.top - 0.035, z], { scale: [0.017, 0.017, 0.055], color: i % 2 ? VIOLET : CYAN, rot: [0, Math.PI / 2, 0], freq: 2.5, phase: i * 1.3 });
    bag.add(GEO.box, [x, A.top - 0.035, z + 0.03], { scale: [0.012, 0.045, 0.01], color: 0x303040 });
  }
  if (u.mag) bag.add(GEO.box, [-(A.side + 0.0185), A.top - 0.0625, 0.05 - (u.mag - 1) * 0.0375], { scale: [0.006, 0.006, 0.075 * u.mag + 0.02], color: 0x303040 });
  if (u.mag >= 3) bag.add(GEO.cyl, [0, -0.215, 0.045], { scale: [0.04, 0.04, 0.09], color: CYAN, rot: [0, 0, 0], freq: 2, rear: 0 });
  // mod: emblema distintivo sobre la boca
  const ez = mzz + 0.12, ey = A.top + 0.055;
  if (u.mod === 'perfora') { bag.add(GEO.cone, [0, ey, ez - 0.09], { scale: [0.022, 0.022, 0.2], color: CYAN, freq: 4 }); for (const sx of [-1, 1]) bag.add(GEO.tet, [sx * 0.026, ey, ez + 0.01], { scale: [0.012, 0.03, 0.05], rot: [0, 0, sx * 0.5], color: 0xffffff }); }
  else if (u.mod === 'explosiva') { bag.add(GEO.cyl, [0, ey, ez], { scale: [0.03, 0.03, 0.09], color: ORANGE, freq: 6 }); bag.add(GEO.sph, [0, ey, ez - 0.045], { scale: [0.03, 0.03, 0.03], color: YELLOW, freq: 6 }); bag.add(GEO.sph, [0, ey, ez + 0.045], { scale: [0.03, 0.03, 0.03], color: RED, freq: 6 }); bag.add(GEO.tor, [0, ey, ez], { scale: [0.04, 0.04, 0.04], color: 0xffffff, spin: 3, cen: [0, ey, ez] }); }
  else if (u.mod === 'cadena') { for (let k = 0; k < 3; k++) { const ph = k * 2.3, pts = []; for (let j = 0; j <= 5; j++) pts.push([(j % 2 ? 1 : -1) * 0.013 * (k + 1) * 0.6, ey + 0.012 + (k - 1) * 0.02, ez - 0.07 + j * 0.028]); for (let j = 0; j < 5; j++) { const a = pts[j], b = pts[j + 1], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], dz = b[2] - a[2], dx = b[0] - a[0]; bag.add(GEO.box, mid, { scale: [0.004, 0.004, Math.hypot(dz, dx)], rot: [0, -Math.atan2(dx, dz), 0], color: k % 2 ? 0xffffff : CYAN, freq: 28, phase: ph + j }); } } for (const sx of [-1, 1]) bag.add(GEO.oct, [sx * 0.028, ey, ez], { scale: [0.008, 0.016, 0.008], color: CYAN }); }
  else if (u.mod === 'vampirica') { bag.add(GEO.ico, [0, ey, ez], { scale: [0.026, 0.034, 0.026], color: RED, beat: 1, freq: 3.5, cen: [0, ey, ez] }); for (const sx of [-1, 1]) bag.add(GEO.tet, [sx * 0.032, ey - 0.012, ez], { scale: [0.008, 0.026, 0.01], rot: [0, 0, sx * 0.9], color: 0x801020 }); }

  const mesh = bag.mesh(); if (mesh) { group.add(mesh); group.userData._upgMesh = mesh; }
  return group;
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
