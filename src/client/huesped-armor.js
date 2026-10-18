// KIT DE ARMADURA / MUTACIÓN de los Huéspedes (docs/HUESPEDES_ARTE.md). Un solo cuerpo = humano de ARCANUM (humans.js) + piezas PROCEDURALES
// de alto detalle ancladas a los HUESOS de su esqueleto, fundidas por material en pocas mallas con esqueleto (≈ 1 llamada de dibujo por material).
//
//   const ak = createArmorKit(human, kit, { quality: 'low'|'medium'|'high', scale });       // human = createHuman(...) ya listo (human.ready)
//   ak.both(() => {                                                                           // «both» dibuja el lado IZQUIERDO (+x) y lo espeja al derecho
//     ak.add('metal', G.plate(PTS, 0.02, 0.006), 'upperarm01', { color: 0x3a3a40 });          // pieza en el espacio del modelo (pose de enlace, +Z = adelante, y = 0 pies)
//     ak.add('ember', G.tube([ak.P('upperarm01'), ...], 0.004, 0.004), 'upperarm01');          // costura de brasa (se enciende con uBeat)
//   });
//   ak.finish();                                                                              // crea las mallas (SkinnedMesh) y oculta la ropa humana
//   cada cuadro: ak.update(dt, t, { object, speed });
//
// Coordenadas: todo se escribe en el MARCO DEL MODELO en pose de enlace (A-pose): huesos en `ak.P(nombre)`; los huesos de enlace NO tienen rotación,
// así que una pieza «a la altura del codo» sólo necesita su posición absoluta. Cada pieza se une al hueso que la mueve (skinIndex rígido).
// Materiales: PBR con texturas Poly Haven (metal oxidado, oro, hueso, cuero, corteza, roca) proyectadas en caja (UV por cara) + costuras emisivas.
// Huesos extra (`ak.bone`, `ak.chain`): cadenas con física ligera de muelles (cola, plumas, colgajos) — mallas rígidas que siguen a esos huesos.
// Tela suelta (`ak.cloth`): rejilla de Verlet (capa, velos) con colisión contra cápsulas del cuerpo; es una malla aparte (1 llamada).
import * as T from 'three';
import { mergeGeometries, mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { phTextures, PH_BASE } from './ph.js';
import { uBeat } from './shaders.js';
import { uClar } from './quality.js';

const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ───────────────────────────────────────────────────────────── ruido (hueso, roca, corteza)
const h3 = (x, y, z) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); };
const sm = (t) => t * t * (3 - 2 * t);
export function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), fx), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), fx), fy), l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), fx), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), fx), fy), fz);
}
export const fbm = (x, y, z, o = 3) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f, z * f); a *= 0.5; f *= 2.03; } return s; };
export function rng(seed = 1) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ───────────────────────────────────────────────────────────── transformaciones
const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(1, 1, 1);
/** Transforma la geometría (la MUTA y la devuelve): escala → rotación (rx,ry,rz en radianes, orden XYZ) → posición. s = número o [sx,sy,sz]; q = Quaternion alternativo. */
export function X(g, { p = [0, 0, 0], r = [0, 0, 0], s = 1, q = null } = {}) {
  const sc = typeof s === 'number' ? [s, s, s] : s;
  _m.compose(_p.set(p[0], p[1], p[2]), q || _q.setFromEuler(_e.set(r[0], r[1], r[2], 'XYZ')), _s.set(sc[0], sc[1], sc[2]));
  return g.applyMatrix4(_m);
}
/** Espeja en x (cara izquierda → derecha), corrigiendo el sentido de los triángulos. */
export function mirrorX(g) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) pos.setX(i, -pos.getX(i));
  if (nor) for (let i = 0; i < nor.count; i++) nor.setX(i, -nor.getX(i));
  if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } }
  else for (const at of Object.values(g.attributes)) { const n = at.itemSize, a = at.array; for (let i = 0; i < at.count; i += 3) for (let k = 0; k < n; k++) { const t = a[(i + 1) * n + k]; a[(i + 1) * n + k] = a[(i + 2) * n + k]; a[(i + 2) * n + k] = t; } }
  return g;
}

// ───────────────────────────────────────────────────────────── primitivas de geometría (todas con origen propio; ver cada una)
const smooth = (g) => { g.computeVertexNormals(); return g; };
const creased = (g, deg = 42) => { if (g.index) g = g.toNonIndexed(); g.deleteAttribute('normal'); g.deleteAttribute('uv'); return toCreasedNormals(g, (deg * Math.PI) / 180); };
const asIndexed = (g, tol = 1e-4) => { if (g.index) return g; for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); return mergeVertices(g, tol); };
export const G = {
  /** Caja redondeada (bisel r). Centrada en el origen. */
  box: (w, h, d, r = Math.min(w, h, d) * 0.18, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-4)),
  /** Cilindro (rt arriba, rb abajo), centrado. */
  cyl: (rt, rb, h, seg = 8, cap = true) => new T.CylinderGeometry(rt, rb, h, seg, 1, !cap),
  /** Cono: BASE en el origen y PUNTA hacia +Y (a una altura h). */
  cone: (r, h, seg = 6) => new T.ConeGeometry(r, h, seg, 1).translate(0, h / 2, 0),
  sphere: (r, ws = 12, hs = 8) => new T.SphereGeometry(r, ws, hs),
  /** Toro en el plano XZ (anillo alrededor del eje Y). */
  torus: (R, r, rs = 6, ts = 20) => new T.TorusGeometry(R, r, rs, ts).rotateX(Math.PI / 2),
  /** Revolución alrededor de Y: pts = [[radio, y], …] (de abajo hacia arriba). */
  lathe(pts, seg = 20, phi0 = 0, phiLen = TAU, crease = 0) {
    const g = new T.LatheGeometry(pts.map((p) => new T.Vector2(p[0], p[1])), seg, phi0, phiLen);
    if (crease) { g.deleteAttribute('uv'); g.deleteAttribute('normal'); return toCreasedNormals(g, (crease * Math.PI) / 180); } return smooth(g);
  },
  /** Placa con bisel: polígono 2D (x,y) extruido en z (espesor `depth`, centrado), con bisel `bevel` y normales con arista dura a `crease` grados. */
  plate(pts, depth = 0.02, bevel = 0.006, { crease = 38, bsegs = 1 } = {}) {
    const sh = new T.Shape(pts.map((p) => new T.Vector2(p[0], p[1])));
    const g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: bsegs, curveSegments: 4, steps: 1 });
    g.translate(0, 0, -(depth - bevel * 2) / 2); g.deleteAttribute('uv');
    return toCreasedNormals(g, (crease * Math.PI) / 180);
  },
  /** Tubo con radio que varía (r0 → r1 a lo largo), sección con aristas (ridges, ridgeAmp), torsión y tapas. pts = puntos de la curva (Catmull-Rom). */
  tube(pts, r0 = 0.01, r1 = 0.003, { radial = 6, tubular = 12, ridges = 0, ridgeAmp = 0.25, twist = 0, sx = 1, sz = 1, curve = null, closeStart = true, ease = 1 } = {}) {
    const c = curve || new T.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : V(p[0], p[1], p[2]))), false, 'centripetal');
    const fr = c.computeFrenetFrames(tubular, false), pos = [], idx = [];
    for (let i = 0; i <= tubular; i++) {
      const t = i / tubular, P = c.getPointAt(t), N = fr.normals[i], B = fr.binormals[i], r = r0 + (r1 - r0) * Math.pow(t, ease);
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * TAU, k = 1 + (ridges ? ridgeAmp * Math.cos(ridges * a + twist * t) : 0), cx = Math.cos(a) * r * k * sx, cz = Math.sin(a) * r * k * sz;
        pos.push(P.x + N.x * cx + B.x * cz, P.y + N.y * cx + B.y * cz, P.z + N.z * cx + B.z * cz);
      }
    }
    for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + ((j + 1) % radial), cc = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial); idx.push(a, cc, b, b, cc, d); }
    const tip = c.getPointAt(1), t0 = c.getPointAt(0), ti = pos.length / 3; pos.push(tip.x, tip.y, tip.z, t0.x, t0.y, t0.z);
    for (let j = 0; j < radial; j++) { const a = tubular * radial + j, b = tubular * radial + ((j + 1) % radial); idx.push(ti, b, a); if (closeStart) idx.push(ti + 1, j, (j + 1) % radial); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return smooth(g);
  },
  /** Espina / cuerno curvo: base en el origen, punta hacia +Y a `len`, curvada `bend` (m) hacia +Z. Con aristas opcionales. */
  spike(len = 0.1, r = 0.015, bend = 0, o = {}) {
    const pts = [V(0, 0, 0), V(0, len * 0.35, bend * 0.2), V(0, len * 0.7, bend * 0.6), V(0, len, bend)];
    return G.tube(pts, r, o.tip ?? 0.0005, { radial: o.radial ?? 5, tubular: o.tubular ?? 6, ridges: o.ridges ?? 0, ridgeAmp: o.ridgeAmp ?? 0.2, twist: o.twist ?? 0, ease: o.ease ?? 0.8, sx: o.sx ?? 1, sz: o.sz ?? 1 });
  },
  /** Piedra / hueso / corteza: icosfera desplazada con ruido. o: { detail, amp, freq, s:[x,y,z], seed, flat (aplana abajo) }. */
  rock(r = 0.05, { detail = 2, amp = 0.35, freq = 3, s = [1, 1, 1], seed = 0, crack = 0 } = {}) {
    const g = asIndexed(new T.IcosahedronGeometry(r, detail), r * 0.01), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / r, y = p.getY(i) / r, z = p.getZ(i) / r;
      let n = fbm(x * freq + seed * 7.1, y * freq + seed * 3.3, z * freq + seed * 5.7, 3) - 0.5;
      if (crack) n -= crack * Math.pow(1 - Math.abs(vnoise(x * freq * 1.7 + seed, y * freq * 1.7, z * freq * 1.7) - 0.5) * 2, 6);
      const k = 1 + n * amp * 2; p.setXYZ(i, x * r * k * s[0], y * r * k * s[1], z * r * k * s[2]);
    }
    return smooth(g);
  },
  /** Aro / banda alrededor de Y (brazalete, anillo de cintura): radio medio R, alto h, espesor t, elíptico (sx, sz). */
  band(R = 0.06, h = 0.03, t = 0.008, { seg = 20, sx = 1, sz = 1, bevel = 0.35, y0 = 0, simple = false } = {}) {
    const b = t * bevel, hh = h / 2, pts = simple ? [[R - t, -hh], [R, -hh], [R, hh], [R - t, hh], [R - t, -hh]] : [[R - t, -hh + b], [R - t + b * 0.4, -hh], [R - b * 0.4, -hh], [R, -hh + b], [R, hh - b], [R - b * 0.4, hh], [R - t + b * 0.4, hh], [R - t, hh - b], [R - t, -hh + b]];
    const g = G.lathe(pts, seg); g.scale(sx, 1, sz); return g.translate(0, y0, 0);
  },
  /** Hoja plana afilada: largo `len` en +Y desde el origen, ancho w, grosor th, con lomo central. */
  blade(len = 0.5, w = 0.05, th = 0.01, { tipLean = 0, curve = 0, n = 8 } = {}) {
    const hs = n, pos = [], idx = [], hw = (t) => w * (t < 0.12 ? 0.55 + t * 3.7 : 1 - Math.pow((t - 0.12) / 0.88, 1.6)) / 2 * 1; void hs;
    for (let i = 0; i <= n; i++) { const t = i / n, y = t * len, z = curve * t * t * len, x0 = hw(t), tl = tipLean * t * t * w;
      pos.push(-x0 + tl, y, z, 0, y, z + th / 2 * (1 - t * 0.6), x0 + tl, y, z, 0, y, z - th / 2 * (1 - t * 0.6)); }
    for (let i = 0; i < n; i++) { const a = i * 4, b = a + 4; idx.push(a, a + 1, b, b, a + 1, b + 1, a + 1, a + 2, b + 1, b + 1, a + 2, b + 2, a + 3, a, b + 3, b + 3, a, b, a + 2, a + 3, b + 2, b + 2, a + 3, b + 3); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return toCreasedNormals(g.toNonIndexed(), 0.9);
  },
  /** Cristal / esquirla: prisma hexagonal con punta, base en el origen y punta en +Y. */
  shard(len = 0.1, r = 0.02, seg = 5) {
    const g = new T.CylinderGeometry(0, r, len, seg, 1).translate(0, len / 2, 0), g2 = new T.CylinderGeometry(r, r * 0.9, len * 0.5, seg, 1).translate(0, -len * 0.25 + len * 0.0, 0);
    return toCreasedNormals(mergeGeometries([g.toNonIndexed(), g2.toNonIndexed()].map((q) => { q.deleteAttribute('uv'); return q; })), 0.5);
  },
  /** Cinta plana a lo largo de una curva (filigrana, tiras de tela rígida, bordes). */
  ribbon(pts, w = 0.02, th = 0.004, { tubular = 10 } = {}) { return G.tube(pts, w / 2, w / 2, { radial: 4, tubular, sx: 1, sz: th / w, closeStart: true, ease: 1 }); },
  /** Envuelve una geometría en torno al eje Y (radio R): una placa plana (plano XY, z = espesor) pasa a abrazar un cilindro centrado en el origen,
   *  con su centro en +Z a distancia R. Sirve para hombreras, brazales, petos, grebas. Muta y devuelve. */
  bend(g, R) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = x / R, rr = R + z; p.setXYZ(i, Math.sin(a) * rr, p.getY(i), Math.cos(a) * rr); }
    return creased(g);
  },
  /** Como `bend` pero sobre una elipse (semiejes rx en x, rz en z): para cascos, petos y cinturas que no son redondos. Muta y devuelve. */
  wrapE(g, rx, rz) {
    const p = g.attributes.position, R = (rx + rz) / 2;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = x / R, sa = Math.sin(a), ca = Math.cos(a), nx = sa / rx, nz = ca / rz, nl = Math.hypot(nx, nz) || 1; p.setXYZ(i, rx * sa + (nx / nl) * z, p.getY(i), rz * ca + (nz / nl) * z); }
    return creased(g);
  },
  /** Desplaza vértices con una función (x,y,z) → [x,y,z]. */
  warp(g, fn) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const r = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, r[0], r[1], r[2]); } g.computeVertexNormals(); return g; },
  /** Remaches: puntos [[x,y,z],…] con semiesferas pequeñas (todas fusionadas). */
  rivets(points, r = 0.006, n = 5) { return mergeGeometries(points.map((q) => { const s = new T.SphereGeometry(r, n, Math.max(3, n - 2), 0, TAU, 0, Math.PI * 0.55); s.translate(q[0], q[1], q[2]); s.deleteAttribute('uv'); return s.toNonIndexed(); })); },
  /** Une geometrías ya transformadas (sin atributos extra) en una sola. */
  merge(list) { const out = list.filter(Boolean).map((g) => { const c = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(c.attributes)) if (k !== 'position' && k !== 'normal') c.deleteAttribute(k); if (!c.attributes.normal) c.computeVertexNormals(); return c; }); return mergeGeometries(out); },
};

// ───────────────────────────────────────────────────────────── materiales
function patchMat(m, { sat = 1, gain = 1, cavity = 0, key = '' } = {}) {
  m.userData.k = { sat, gain, cavity };
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float l_ = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = mix(vec3(l_), diffuseColor.rgb, ${sat.toFixed(3)}) * ${gain.toFixed(3)}; }`);
  };
  m.customProgramCacheKey = () => `huesped-${key}-${sat}-${gain}`;
  return m;
}
/** Piel espectral del cuerpo humano: oscura, con borde de luz (fresnel) y grietas de brasa que respiran (se ven entre las placas). */
const uTimeG = { value: 0 };
function spectralMaterial(color, rim, ember, belly = 0) {
  const m = new T.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2, emissive: 0x000000 });
  const u = { uRim: { value: new T.Color(rim) }, uEmber: { value: new T.Color(ember) }, uBeat, uK: { value: 1 }, uBelly: { value: belly }, uTime: uTimeG, uClar };
  m.userData.u = u;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = 'varying vec3 vRest;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vRest = position;');
    s.fragmentShader = 'varying vec3 vRest; uniform vec3 uRim, uEmber; uniform float uBeat, uK, uBelly, uTime, uClar;\n' + s.fragmentShader
      .replace('#include <common>', `#include <common>
        float h_(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float n_(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h_(i), h_(i + vec3(1,0,0)), f.x), mix(h_(i + vec3(0,1,0)), h_(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h_(i + vec3(0,0,1)), h_(i + vec3(1,0,1)), f.x), mix(h_(i + vec3(0,1,1)), h_(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.4);
          float c1 = abs(n_(vRest * 30.0) - 0.5) * 2.0, c2 = abs(n_(vRest * 14.0 + 4.0) - 0.5) * 2.0;
          float crack = smoothstep(0.07, 0.0, min(c1, c2 * 1.3)) * smoothstep(0.35, 0.65, n_(vRest * 4.0 + 9.0)) * (0.65 + 0.7 * uBeat);
          float belly = smoothstep(1.0, 1.06, vRest.y) * smoothstep(1.215, 1.15, vRest.y) * smoothstep(0.12, 0.05, abs(vRest.x)) * uBelly;
          totalEmissiveRadiance += uRim * fr * (1.3 + 1.0 * uClar) * uK + uEmber * (crack * 1.6 + belly * (1.1 + 0.7 * uBeat) * (0.6 + 0.8 * n_(vRest * 12.0 + uTime * 0.6))) * uK; }`);
  };
  m.customProgramCacheKey = () => 'huesped-espectral';
  return m;
}

const TEX = {
  metal: { id: 'rusty_metal_02', k: 1.9, color: 0x8a8a98, metalness: 0.9, roughness: 0.62, normalScale: 1.1, sat: 0.12, gain: 0.8 },
  gold: { id: 'metal_plate', k: 2.4, color: 0xf0c060, metalness: 1, roughness: 0.8, normalScale: 0.7, sat: 1, gain: 1.05 },
  bone: { id: 'rock_boulder_cracked', k: 1.6, color: 0xd8c8a6, metalness: 0, roughness: 0.9, normalScale: 0.9, sat: 0.2, gain: 1.15 },
  leather: { id: 'brown_leather', k: 3.2, color: 0x7a5a48, metalness: 0, roughness: 1, normalScale: 0.8, sat: 0.7, gain: 0.7 },
  bark: { id: 'bark_brown_02', k: 1.7, color: 0xa88a6a, metalness: 0, roughness: 1, normalScale: 1.2, sat: 0.6, gain: 0.7 },
  stone: { id: 'rock_boulder_cracked', k: 1.3, color: 0x9a96a6, metalness: 0, roughness: 1, normalScale: 1.3, sat: 0.2, gain: 1.1 },
  cloth: { id: 'rough_linen', k: 3.0, color: 0x3a2a30, metalness: 0, roughness: 0.95, rmap: false, env: 0.3, normalScale: 0.6, sat: 0.4, gain: 0.7, side: T.DoubleSide },
  marble: { id: 'marble_01', k: 1.2, color: 0xfff6e8, metalness: 0, roughness: 0.55, normalScale: 0.3, sat: 0.5, gain: 1.25 },
};

/** Normal del metal con líneas de panel y remaches (se dibuja encima de la normal fotográfica de Poly Haven): da aspecto de superficie dura. Cacheado. */
let panelNormalP = null;
function panelNormal() {
  if (panelNormalP) return panelNormalP;
  panelNormalP = new Promise((res) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); g.drawImage(img, 0, 0, N, N);
        const R = rng(3), groove = (x, y, w, h, vert) => { // surco: dos paredes con normales opuestas
          g.globalAlpha = 0.9;
          if (vert) { g.fillStyle = 'rgb(196,128,235)'; g.fillRect(x, y, 3, h); g.fillStyle = 'rgb(60,128,235)'; g.fillRect(x + 3, y, 3, h); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(x + 6, y, 2, h); }
          else { g.fillStyle = 'rgb(128,60,235)'; g.fillRect(x, y, w, 3); g.fillStyle = 'rgb(128,196,235)'; g.fillRect(x, y + 3, w, 3); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(x, y + 6, w, 2); }
          g.globalAlpha = 1;
        };
        const xs = [0, 0.27, 0.58, 0.83], ys = [0, 0.19, 0.52, 0.78];
        for (const x of xs) groove(Math.round(x * N), 0, 6, N, true);
        for (const y of ys) groove(0, Math.round(y * N), N, 6, false);
        for (let i = 0; i < 26; i++) { const x = Math.round(xs[Math.floor(R() * 4)] * N) + (R() < 0.5 ? 26 : -22), y = Math.round(ys[Math.floor(R() * 4)] * N) + (R() < 0.5 ? 26 : -22); // remaches
          const gr = g.createRadialGradient(x - 2, y - 2, 0, x, y, 8); gr.addColorStop(0, 'rgba(176,176,255,1)'); gr.addColorStop(0.6, 'rgba(100,100,235,0.9)'); gr.addColorStop(1, 'rgba(128,128,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); }
        const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; t.colorSpace = T.NoColorSpace; res(t);
      } catch (e) { res(null); }
    };
    img.onerror = () => res(null); img.src = `${PH_BASE}rusty_metal_02/rusty_metal_02_nor_gl_1k.jpg`;
  });
  return panelNormalP;
}

// ───────────────────────────────────────────────────────────── el kit
const BONE_LIST_SIDE = /_(L|R)$/;
export function createArmorKit(human, kit, opts = {}) {
  const quality = opts.quality || 'medium', Q = quality === 'low' ? 0.5 : quality === 'high' ? 1.25 : 1, low = quality === 'low';
  const root = human.object, bones = human.bones;
  let body = null; root.traverse((o) => { if (o.isSkinnedMesh && o.name === 'npc-body') body = o; });
  if (!body) throw new Error('armor-kit: no hay cuerpo con esqueleto');
  const skel0 = body.skeleton, bindMatrix = body.bindMatrix.clone(), parent = body.parent;
  const W = kit.store.boneWorld(), Wv = {}; for (const k of Object.keys(W)) Wv[k] = V(...W[k]);
  const extraBones = [], extraInv = [], boneIdx = new Map(skel0.bones.map((b, i) => [b.name, i])), boneByName = new Map(skel0.bones.map((b) => [b.name, b]));
  const buckets = new Map(), mats = {}, disposables = [], updaters = [], clothes = [], chains = [];
  const uTimeK = { value: 0 }, dbg = [];
  let side = null, finished = false, objectRef = null;

  // — materiales (se crean a demanda por clave)
  const accent = new T.Color(opts.accent ?? 0xff7a2a);
  function material(key) {
    if (mats[key]) return mats[key];
    let m;
    if (TEX[key]) {
      const d = TEX[key], t = phTextures(d.id, { repeat: 1 });
      m = patchMat(new T.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: d.rmap === false ? null : t.roughnessMap, color: opts.tint?.[key] ?? d.color, metalness: d.metalness, roughness: d.roughness, normalScale: new T.Vector2(d.normalScale, d.normalScale), vertexColors: true, side: d.side || T.FrontSide, envMapIntensity: d.env ?? (key === 'gold' ? 1.5 : key === 'metal' ? 1.25 : 1) }), { sat: d.sat, gain: d.gain, key });
      m.userData.uvk = d.k;
      if (key === 'cloth') { // el borde (dobladillo) puede brillar como brasa: atributo aE por vértice
        const base = m.onBeforeCompile, uEC = { value: new T.Color(opts.accent ?? 0xff7a22) };
        m.onBeforeCompile = (s) => { base(s); s.uniforms.uEC = uEC; s.uniforms.uBeat = uBeat; s.vertexShader = 'attribute float aE; varying float vE;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vE = aE;'); s.fragmentShader = 'varying float vE; uniform vec3 uEC; uniform float uBeat;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += uEC * vE * (1.2 + 0.9 * uBeat);'); };
        m.customProgramCacheKey = () => 'huesped-tela-brasa';
      }
      if (key === 'metal' && !opts.noPanels) panelNormal().then((tx) => { if (tx) { m.normalMap = tx; m.needsUpdate = true; } });
    } else if (key === 'ember') { m = new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false }); }
    else if (key === 'light') { m = new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false }); }
    else if (key === 'spirit') { m = new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }); }
    else if (key === 'crystal') { // cristal: el color del vértice también es la luz interior (se enciende con uBeat)
      m = new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.14, metalness: 0.1, transparent: true, opacity: 0.9, envMapIntensity: 1.5 });
      const u = { uCE: { value: 0.6 } }; m.userData.u = u; m.onBeforeCompile = (s) => { s.uniforms.uCE = u.uCE; s.fragmentShader = 'uniform float uCE;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uCE;'); }; m.customProgramCacheKey = () => 'huesped-cristal';
    }
    else if (key === 'flesh') { m = new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.36, metalness: 0.04, emissive: 0x501018, emissiveIntensity: 0.5, envMapIntensity: 1.2 }); }
    else if (key === 'mirror') { m = new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 1, roughness: 0.07, envMapIntensity: 2.0 }); }
    else if (key === 'dark') { m = new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.4, metalness: 0.3 }); }
    else if (key === 'body') { m = spectralMaterial(opts.skin ?? 0x14121c, opts.rim ?? 0x6ab8ff, opts.crack ?? 0xff6a1a, opts.belly ?? 0); }
    else throw new Error('material desconocido: ' + key);
    m.name = 'kit-' + key; mats[key] = m; disposables.push(m); return m;
  }
  const BOX = new Set(Object.keys(TEX)); // estos reciben UV por proyección en caja

  // — huesos
  const fullName = (n) => (/_h$/.test(n) ? n : BONE_LIST_SIDE.test(n) ? n + '_h' : side && boneIdx.has(`${n}_${side}_h`) ? `${n}_${side}_h` : `${n}_h`);
  const designName = (n) => (/_h$/.test(n) ? n : BONE_LIST_SIDE.test(n) ? n : side ? `${n}_L` : n); // en `both` siempre se diseña con el lado izquierdo
  /** Posición (en el modelo, pose de enlace) de un hueso o de un hueso extra. En `both` se lee el lado izquierdo (+x). */
  function P(n) {
    if (extraPos.has(n)) return extraPos.get(n).clone();
    const cands = /_h$/.test(n) ? [n] : [side ? `${n}_L_h` : null, `${n}_h`, BONE_LIST_SIDE.test(n) ? `${n}_h` : null].filter(Boolean);
    for (const c of cands) if (Wv[c]) return Wv[c].clone();
    throw new Error('hueso sin posición: ' + n);
  }
  /** Mismo punto, espejado en x cuando se dibuja el lado derecho dentro de `both`. */
  const mx = (v) => (side === 'R' ? V(-v.x, v.y, v.z) : v.clone());
  const extraPos = new Map();
  /** Hueso extra hijo de `parentName`, en `pos` (modelo, pose de enlace). Devuelve el hueso (Bone). Se anima desde fuera (rotación). */
  function bone(name, parentName, pos) {
    pos = mx(pos); const pn = extraBoneMap.has(parentName) ? parentName : fullName(parentName), par = boneByName.get(pn) || extraBoneMap.get(pn); if (!par) throw new Error('hueso padre desconocido: ' + parentName);
    const pp = Wv[pn] || extraPos.get(pn), b = new T.Bone(); b.name = name; b.position.copy(pos).sub(pp); par.add(b);
    extraBones.push(b); extraBoneMap.set(name, b); extraPos.set(name, pos.clone()); extraInv.push(new T.Matrix4().makeTranslation(-pos.x, -pos.y, -pos.z)); boneIdx.set(name, skel0.bones.length + extraBones.length - 1);
    return b;
  }
  const extraBoneMap = new Map();
  const worldOf = (name) => extraBoneMap.get(name) || boneByName.get(name);
  const resolve = (n) => (extraBoneMap.has(n) ? n : fullName(n));

  // — acumulación de piezas
  function bucket(key) { let b = buckets.get(key); if (!b) buckets.set(key, (b = { key, geoms: [] })); return b; }
  /** Añade una pieza (geometría en el espacio del modelo) a un material y a un hueso. opts.color = hex | [r,g,b] | fn(x,y,z,nx,ny,nz) → hex. En `both` se espeja sola. */
  function add(matKey, geo, boneName, o = {}) {
    if (finished) throw new Error('armor-kit: ya terminado');
    if (replaced) { const fz = resolve(boneName); if (replaced.has(slotOfBone(fz))) { replacedTris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; return geo; } }   // el equipo (items-vis.js) sustituye lo de esta zona
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
    if (side === 'R') mirrorX(g);
    const fn = resolve(boneName), bi = boneIdx.get(fn); if (bi == null) throw new Error('hueso desconocido: ' + fn);
    const n = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = new T.Color(), col = new Float32Array(n * 3), pos = g.attributes.position, nor = g.attributes.normal, cf = typeof o.color === 'function';
    if (!cf) { const k = o.color ?? 0xffffff; if (Array.isArray(k)) c.setRGB(k[0], k[1], k[2]); else c.set(k); }
    for (let i = 0; i < n; i++) {
      if (cf) c.set(o.color(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i)));
      const sh = o.shade ? o.shade(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i)) : 1;
      col[i * 3] = c.r * sh; col[i * 3 + 1] = c.g * sh; col[i * 3 + 2] = c.b * sh;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
    dbg.push([matKey, boneName, n / 3]); bucket(matKey).geoms.push(g); return g;
  }
  /** SUSTITUCIÓN POR EQUIPO (docs/INVENTARIO.md): mientras esté activa, las piezas que el diseño base agregaría a huesos de estas zonas ('head' | 'torso' | 'arms' | 'legs') NO se dibujan:
   *  la armadura equipada ocupa su lugar y el presupuesto de triángulos no crece. `keepAll()` la desactiva (las piezas del equipo se agregan después). */
  let replaced = null, replacedTris = 0;
  const slotOfBone = (fn) => (/^(head|neck|jaw)/.test(fn) ? 'head' : /^(spine|clavicle|pelvis|breast)/.test(fn) ? 'torso' : /^(upperarm|lowerarm|wrist|hand|shoulder|finger|metacarpal|thumb)/.test(fn) ? 'arms' : /^(upperleg|lowerleg|foot|ball|toe)/.test(fn) ? 'legs' : '');
  const replaceSlots = (set) => { replaced = set && set.size ? new Set(set) : null; replacedTris = 0; };
  const keepAll = () => { replaced = null; };
  /** Ejecuta fn() una vez para el lado izquierdo (+x) y otra para el derecho (espejado): dentro, `add` y `P` usan el lado actual. */
  function both(fn) { for (const s of ['L', 'R']) { side = s; fn(s); } side = null; }
  /** Sólo un lado (L o R) sin espejo automático del otro. */
  function one(s, fn) { side = s === 'R' ? 'R' : 'L'; fn(); side = null; }

  /** Marco de un segmento a→b: matriz con Y a lo largo del segmento, Z lo más «adelante» posible. Sirve para colocar piezas modeladas con eje Y = hueso. */
  function frame(a, b) {
    const y = b.clone().sub(a), len = y.length(); y.normalize(); let z = V(0, 0, 1).addScaledVector(y, -y.z); if (z.lengthSq() < 1e-4) z = V(0, 1, 0).addScaledVector(y, -y.y); z.normalize(); const x = new T.Vector3().crossVectors(y, z);
    const m = new T.Matrix4().makeBasis(x, y, z); m.setPosition(a); return { m, len, dir: y, a: a.clone(), b: b.clone() };
  }
  /** Coloca g (modelada con Y = eje del segmento, origen en el inicio, z = adelante, x = lateral) sobre el segmento a→b en la fracción t. Muta y devuelve g. */
  function onSeg(g, a, b, t = 0, { off = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
    const f = frame(a, b); X(g, { p: off, r, s }); const m = f.m.clone(); m.setPosition(a.clone().lerp(b, t)); return g.applyMatrix4(m);
  }

  // — cadenas con física de muelles (huesos extra)
  /** Cadena de huesos: pts = posiciones (modelo, enlace) desde la raíz hacia la punta; parentName = hueso del esqueleto que la sostiene. Devuelve {bones, update…}. */
  function chain(name, parentName, pts, { stiff = 0.25, damp = 0.92, gravity = 6, sway = 0 } = {}) {
    const bs = []; let par = parentName;
    pts.forEach((p, i) => { const nm = `${name}${side ? '_' + side : ''}${i}`; bs.push(bone(nm, par, p)); par = nm; });
    const base = worldOf(resolve(parentName)), rest = pts.map((p) => mx(p));
    const c = { name, bones: bs, pts: rest, stiff, damp, gravity, sway, p: null, v: null, parentBone: base, seed: Math.random() * 10 };
    chains.push(c); return c;
  }
  const _a = V(), _b = V(), _c = V(), _d = V(), _M = new T.Matrix4();
  const qP = new T.Quaternion(), qR = new T.Quaternion(), qW = new T.Quaternion(), qL = new T.Quaternion(), qPar = new T.Quaternion();
  function stepChain(c, dt, t, wscale, gravW) {
    const n = c.bones.length; if (n < 1) return;
    const base = c.parentBone; base.updateWorldMatrix(true, false);
    const pw = Wv[base.name] || extraPos.get(base.name), bm = base.matrixWorld, tgt = c.tgt || (c.tgt = c.pts.map(() => V()));
    for (let i = 0; i < n; i++) tgt[i].copy(c.pts[i]).sub(pw).applyMatrix4(bm);
    if (!c.p) { c.p = tgt.map((v) => v.clone()); c.v = tgt.map(() => V()); c.l = []; for (let i = 0; i < n - 1; i++) c.l.push(c.pts[i].distanceTo(c.pts[i + 1])); }
    qP.setFromRotationMatrix(_M.extractRotation(bm)); const K = c.stiff * 100, damp = Math.pow(c.damp, dt * 60);
    c.p[0].copy(tgt[0]);
    for (let i = 1; i < n; i++) {
      const p = c.p[i], v = c.v[i], f = i / n;
      v.addScaledVector(_b.copy(tgt[i]).sub(p), K * dt); v.addScaledVector(gravW, c.gravity * dt * f);
      if (c.sway) v.addScaledVector(_c.set(Math.sin(t * 1.3 + c.seed + i * 0.6), 0.1 * Math.sin(t * 1.9 + i), Math.cos(t * 1.1 + c.seed + i * 0.4)).applyQuaternion(qP), c.sway * dt * f);
      v.multiplyScalar(damp); p.addScaledVector(v, dt);
    }
    for (let it = 0; it < 2; it++) for (let i = 1; i < n; i++) { _d.copy(c.p[i]).sub(c.p[i - 1]); const l = _d.length() || 1e-5, tl = c.l[i - 1] * wscale; c.p[i].copy(c.p[i - 1]).addScaledVector(_d, tl / l); }
    qPar.copy(qP);
    for (let i = 0; i < n; i++) {
      const a = i === n - 1 ? n - 2 : i, bI = a + 1; if (a < 0) break;
      _a.copy(c.pts[bI]).sub(c.pts[a]).normalize().applyQuaternion(qP); _b.copy(c.p[bI]).sub(c.p[a]).normalize();
      qW.setFromUnitVectors(_a, _b).multiply(qP); qL.copy(qPar).invert().multiply(qW); c.bones[i].quaternion.copy(qL); qPar.copy(qW);
    }
  }

  // — tela suelta (capas, velos)
  /** Rejilla de tela: top = [{bone, p:Vector3 (modelo, enlace)}…] (una por columna, ancla), dir = dirección de caída en el enlace (Vector3), lens = largo por columna, rows. Devuelve {mesh, ...}. */
  function cloth({ top, dir = V(0, -1, 0), lens, rows = 9, material: mk = 'cloth', color = 0xffffff, hem = null, thick = 0, gravity = 9, stiff = 0.04, drag = 0.985, bulge = 0, uvk = 2.2, wave = 0, ember = 0 }) {
    top = top.map((q) => ({ fb: resolve(q.bone), p: mx(q.p) })); dir = side === 'R' ? V(-dir.x, dir.y, dir.z) : dir;
    const cols = top.length, np = cols * rows, pos = new Float32Array(np * 3), col = new Float32Array(np * 3), uv = new Float32Array(np * 2), idx = [];
    const c0 = new T.Color(color), c1 = new T.Color(hem ?? color);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const k = i * cols + j, f = i / (rows - 1), cc = c0.clone().lerp(c1, Math.pow(f, 2.2));
      col[k * 3] = cc.r; col[k * 3 + 1] = cc.g; col[k * 3 + 2] = cc.b; uv[k * 2] = j / (cols - 1) * uvk; uv[k * 2 + 1] = f * (lens[j] || 0.5) * uvk * 1.4;
    }
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + 1, cc = a + cols, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
    const aE = new Float32Array(np); if (ember) for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const f = i / (rows - 1); aE[i * cols + j] = ember * Math.pow(Math.max(0, f - 0.78) / 0.22, 2.4) * (0.55 + 0.45 * Math.sin(j * 2.7 + i)); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('aE', new T.BufferAttribute(aE, 1)); geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(idx);
    const m = material(mk); const mesh = new T.Mesh(geo, m); mesh.frustumCulled = false; mesh.name = 'kit-tela';
    const cl = { mesh, geo, cols, rows, top, lens, dir: dir.clone().normalize(), p: null, pp: null, rest: [], gravity, stiff, drag, anchors: [], bulge, caps: [] };
    // posiciones de enlace de cada partícula y longitudes de reposo
    cl.bind = []; for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const f = i / (rows - 1); cl.bind.push(top[j].p.clone().addScaledVector(cl.dir, f * lens[j])     .addScaledVector(V(0, 0, 1), bulge * Math.sin(f * Math.PI) + wave * Math.sin(j * 2.1 + i * 0.4) * Math.min(1, f * 3))); }
    clothes.push(cl); extraRoots.push(mesh); disposables.push(geo); return cl;
  }
  const extraRoots = [];
  /** Cápsulas de colisión (modelo, enlace) por hueso: [{bone, a:Vector3, b:Vector3, r}] — la tela y las cadenas no las atraviesan. */
  const capsules = [];
  function collider(boneName, a, b, r) { capsules.push({ bone: resolve(boneName), a: mx(a), b: mx(b), r }); }
  const _wa = V(), _wb = V(), _wc = V(), _wd = V();
  function stepCloth(cl, dt, wscale, gravW) {
    const { rows, cols } = cl, n = rows * cols;
    if (!cl.p) { cl.p = new Array(n); cl.pp = new Array(n); for (let k = 0; k < n; k++) { cl.p[k] = V(); cl.pp[k] = V(); } cl.first = true; cl.rl = []; for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols; j++) cl.rl.push(cl.bind[i * cols + j].distanceTo(cl.bind[(i + 1) * cols + j])); cl.rr = []; for (let i = 0; i < rows; i++) for (let j = 0; j < cols - 1; j++) cl.rr.push(cl.bind[i * cols + j].distanceTo(cl.bind[i * cols + j + 1])); cl.lastO = null; }
    // posiciones rígidas (enlace transformado por el hueso del ancla de su columna)
    const ro = cl.rigid || (cl.rigid = new Array(n).fill(0).map(() => V()));
    for (let j = 0; j < cols; j++) { const bn = worldOf(cl.top[j].fb); bn.updateWorldMatrix(true, false); const pw = Wv[bn.name] || extraPos.get(bn.name);
      for (let i = 0; i < rows; i++) ro[i * cols + j].copy(cl.bind[i * cols + j]).sub(pw).applyMatrix4(bn.matrixWorld); }
    if (cl.first) { for (let k = 0; k < n; k++) { cl.p[k].copy(ro[k]); cl.pp[k].copy(ro[k]); } cl.first = false; }
    const g = gravW, d2 = dt * dt;
    for (let k = 0; k < n; k++) {
      if (k < cols) { cl.pp[k].copy(cl.p[k]); cl.p[k].copy(ro[k]); continue; }
      const p = cl.p[k], pp = cl.pp[k]; _wa.copy(p).sub(pp).multiplyScalar(cl.drag); pp.copy(p); p.add(_wa).addScaledVector(g, cl.gravity * d2); // inercia + gravedad
      p.addScaledVector(_wb.copy(ro[k]).sub(p), cl.stiff); // vuelve un poco a su sitio (forma)
    }
    for (let it = 0; it < 3; it++) {
      let q = 0; for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols; j++) { const a = cl.p[i * cols + j], b = cl.p[(i + 1) * cols + j], rl = cl.rl[q++] * wscale; _wa.copy(b).sub(a); const l = _wa.length() || 1e-5, k = (l - rl) / l; if (i === 0) b.addScaledVector(_wa, -k); else { a.addScaledVector(_wa, k * 0.5); b.addScaledVector(_wa, -k * 0.5); } }
      q = 0; for (let i = 1; i < rows; i++) for (let j = 0; j < cols - 1; j++) { const a = cl.p[i * cols + j], b = cl.p[i * cols + j + 1], rl = cl.rr[i * (cols - 1) + j] * wscale; _wa.copy(b).sub(a); const l = _wa.length() || 1e-5, k = clamp((l - rl) / l, -0.6, 0.6) * 0.35; a.addScaledVector(_wa, k); b.addScaledVector(_wa, -k); }
      for (const c of capsules) { // colisión con el cuerpo
        const bn = worldOf(c.bone); if (!bn) continue; const pw = Wv[bn.name]; _wa.copy(c.a).sub(pw).applyMatrix4(bn.matrixWorld); _wb.copy(c.b).sub(pw).applyMatrix4(bn.matrixWorld); const rr = c.r * wscale;
        for (let k = cols; k < n; k++) { const p = cl.p[k]; _wc.copy(_wb).sub(_wa); const t = clamp(_wd.copy(p).sub(_wa).dot(_wc) / (_wc.lengthSq() || 1), 0, 1); _wd.copy(_wa).addScaledVector(_wc, t); _wc.copy(p).sub(_wd); const l = _wc.length(); if (l < rr) p.copy(_wd).addScaledVector(_wc, rr / (l || 1e-5)); }
      }
    }
    // a coordenadas del objeto (el mesh cuelga de `object`)
    const inv = cl.inv || (cl.inv = new T.Matrix4()); if (objectRef) inv.copy(objectRef.matrixWorld).invert();
    const a = cl.geo.attributes.position.array; for (let k = 0; k < n; k++) { _wa.copy(cl.p[k]).applyMatrix4(inv); a[k * 3] = _wa.x; a[k * 3 + 1] = _wa.y; a[k * 3 + 2] = _wa.z; }
    cl.geo.attributes.position.needsUpdate = true; cl.geo.computeVertexNormals();
  }

  // — luces sueltas: halos y partículas (no esqueléticas); cuelgan de un hueso
  const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; })();
  disposables.push(haloTex);
  const attached = [];
  /** Grupo (no esquelético) enganchado a un hueso en la posición `pos` (modelo, enlace): para sprites, órganos, partículas. */
  function mount(boneName, pos) { const b = worldOf(resolve(boneName)); if (!b) return null; pos = mx(pos); const g = new T.Group(), pw = Wv[b.name] || extraPos.get(b.name); g.position.copy(pos).sub(pw); b.add(g); attached.push(g); return g; }
  function halo(boneName, pos, color, size = 0.3, opacity = 0.5) {
    const g = mount(boneName, pos); if (!g) return null; const sp = new T.Sprite(new T.SpriteMaterial({ map: haloTex, color, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity, toneMapped: false })); sp.scale.setScalar(size); g.add(sp); disposables.push(sp.material);
    sp.userData = { size, opacity }; pulses.push(sp); return sp;
  }
  const pulses = [];
  /** Partículas (brasas) que suben alrededor del cuerpo: 1 llamada. */
  function embers(color = 0xff8a30, n = 48, { radius = 0.45, height = 2.0, size = 5 } = {}) {
    const g = new T.BufferGeometry(), seeds = new Float32Array(n), p = new Float32Array(n * 3); for (let i = 0; i < n; i++) seeds[i] = (i + 0.5) / n;
    g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('aS', new T.BufferAttribute(seeds, 1));
    const m = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uT: uTimeK, uC: { value: new T.Color(color) }, uBeat, uR: { value: radius }, uH: { value: height }, uS: { value: size } },
      vertexShader: `attribute float aS; uniform float uT, uBeat, uR, uH, uS; varying float vA;
        void main(){ float h = fract(aS * 7.31 + uT * (0.08 + 0.1 * fract(aS * 3.1))), a = aS * 40.0 + uT * (0.4 + fract(aS * 5.3) * 0.5), r = uR * (0.55 + 0.6 * fract(aS * 9.7));
          vec3 p = vec3(cos(a) * r + 0.06 * sin(uT * 2.0 + aS * 50.0), h * uH, sin(a) * r); vA = sin(h * 3.1416) * (0.55 + 0.45 * uBeat);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (1.5 + 3.5 * fract(aS * 13.7)) * uS * (1.0 / max(0.4, -mv.z)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform vec3 uC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uC * 1.8, smoothstep(0.5, 0.0, d) * vA); }' });
    const pts = new T.Points(g, m); pts.frustumCulled = false; pts.name = 'kit-brasas'; extraRoots.push(pts); disposables.push(g, m); return pts;
  }

  // ───────────────────────────────────────── terminar: fusionar por material y crear las mallas
  const origMeshes = []; root.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine) origMeshes.push(o); });
  const meshes = [];
  const bodyMesh = { m: null };
  function finish({ hideHuman = true, bodyGeometry = null } = {}) {
    if (finished) return; finished = true;
    const allBones = [...skel0.bones, ...extraBones], inv = [...skel0.boneInverses, ...extraInv];
    const skel = new T.Skeleton(allBones, inv); skel.name = 'kit-esqueleto';
    // cuerpo espectral (esqueleto propio: el humano original se oculta)
    if (bodyGeometry) {
      const m = new T.SkinnedMesh(bodyGeometry, material('body')); m.name = 'kit-cuerpo'; m.frustumCulled = false; parent.add(m); m.bind(skel, bindMatrix); meshes.push(m); bodyMesh.m = m;
    }
    for (const [key, b] of buckets) {
      if (!b.geoms.length) continue;
      const box = BOX.has(key), k = box ? material(key).userData.uvk : 1;
      const parts = b.geoms.map((g0) => {
        let g = g0; if (box) {
          g = g0.index ? g0.toNonIndexed() : g0; const p = g.attributes.position, nrm = g.attributes.normal, uv = new Float32Array(p.count * 2);
          for (let i = 0; i < p.count; i += 3) { // por triángulo: eje dominante de la normal de la cara
            const ax = Math.abs(nrm.getX(i) + nrm.getX(i + 1) + nrm.getX(i + 2)), ay = Math.abs(nrm.getY(i) + nrm.getY(i + 1) + nrm.getY(i + 2)), az = Math.abs(nrm.getZ(i) + nrm.getZ(i + 1) + nrm.getZ(i + 2));
            for (let v = 0; v < 3; v++) { const x = p.getX(i + v) * k, y = p.getY(i + v) * k, z = p.getZ(i + v) * k; let u, w; if (ax >= ay && ax >= az) { u = z; w = y; } else if (ay >= az) { u = x; w = z; } else { u = x; w = y; } uv[(i + v) * 2] = u; uv[(i + v) * 2 + 1] = w; }
          }
          g.setAttribute('uv', new T.BufferAttribute(uv, 2));
        } else if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        return g;
      });
      const merged = mergeGeometries(parts, false); if (!merged) { console.warn('armor-kit: no se pudo fusionar', key); continue; }
      b.geoms.forEach((g) => g.dispose()); disposables.push(merged);
      const mesh = new T.SkinnedMesh(merged, material(key)); mesh.name = 'kit-' + key; mesh.frustumCulled = false; mesh.castShadow = !low && key !== 'ember' && key !== 'light' && key !== 'spirit'; parent.add(mesh); mesh.bind(skel, bindMatrix); meshes.push(mesh);
      if (key === 'spirit') mesh.renderOrder = 4; if (key === 'crystal') mesh.renderOrder = 3;
    }
    if (hideHuman) for (const o of origMeshes) o.visible = false;
    ak.skeleton = skel; ak.ready = true;
  }

  // ───────────────────────────────────────── cuadro
  const _sc = V(), _gv = V();
  function update(dt, t, ctx = {}) {
    dt = Math.min(dt, 1 / 20); uTimeK.value = t; uTimeG.value = t;
    const obj = ctx.object || objectRef; if (obj) { objectRef = obj; obj.updateWorldMatrix(true, false); }
    const b = uBeat.value, k = ctx.glow ?? 1;
    const em = mats.ember; if (em) em.color.setScalar((1.15 + 0.55 * b) * k);
    const li = mats.light; if (li) li.color.setScalar((0.95 + 0.55 * b) * k);
    const fl = mats.flesh; if (fl) fl.emissiveIntensity = (0.35 + 0.5 * b) * k;
    const cr = mats.crystal; if (cr) cr.userData.u.uCE.value = (0.45 + 0.5 * b) * k;
    const sp = mats.spirit; if (sp) { sp.opacity = (0.55 + 0.1 * Math.sin(t * 9) + 0.1 * b) * k; sp.color.setScalar(0.62); }
    const bm = mats.body; if (bm) { bm.userData.u.uK.value = k; }
    for (const h of pulses) { h.material.opacity = h.userData.opacity * (0.7 + 0.5 * b) * k; }
    const wscale = obj ? _sc.setFromMatrixScale(obj.matrixWorld).x : 1;
    _gv.set(0, -1, 0); if (obj) _gv.transformDirection(obj.matrixWorld);
    // objeto.matrixWorld ya incluye la orientación (arriba = gravedad del jugador): «abajo» del cuerpo = −Y local en el mundo
    root.updateWorldMatrix(true, true);
    for (const c of chains) stepChain(c, dt, t, wscale, _gv);
    for (const cl of clothes) stepCloth(cl, dt, wscale, _gv);
    for (const f of updaters) f(dt, t, ctx);
  }
  /** Registra una función que se llama en cada cuadro: fn(dt, t, ctx). */
  const onUpdate = (fn) => updaters.push(fn);
  function stats() { let tris = 0; for (const m of meshes) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; for (const c of clothes) tris += c.geo.index.count / 3; return { calls: meshes.length + clothes.length, tris: Math.round(tris), meshes: meshes.map((m) => [m.name, Math.round((m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3)]) }; }
  function dispose() {
    for (const m of meshes) m.removeFromParent(); for (const g of attached) g.removeFromParent(); for (const m of extraRoots) m.removeFromParent();
    for (const d of disposables) d.dispose && d.dispose(); for (const b of extraBones) b.removeFromParent(); if (ak.skeleton) ak.skeleton.dispose();
  }
  const ak = { replaceSlots, keepAll, get replacedTris() { return replacedTris; }, dbg, T, Q, low, quality, W: Wv, P, add, both, one, bone, chain, cloth, collider, frame, onSeg, mount, halo, embers, finish, update, onUpdate, stats, dispose, material, mats, extraRoots, bones, body, skel0, bindMatrix, parent, ready: false, accent,
    /** Segmentos «a nivel de calidad»: s(8) → 8 (alta), 5 (baja). */
    s: (n, min = 3) => Math.max(min, Math.round(n * Q)),
    setObject: (o) => { objectRef = o; } };
  return ak;
}
