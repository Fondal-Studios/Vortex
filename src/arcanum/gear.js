// Equipo del Pasajero y de los 4 roles del coop: mochilas, auriculares, visor, hombreras, capa, cristales incrustados.
// Todo se modela en coordenadas «de reposo» de la anatomía MakeHuman (pies en y = 0, la cara mira a +Z), se fusiona por
// hueso y material (pocas draw calls) y se cuelga del hueso correspondiente: se mueve con la animación.
// Materiales: tela (relieve de trama triplanar compartido, src/arcanum/materials.js), metal/goma (PBR con mapa de entorno) y
// cristal (facetado, iridiscente y emisivo, el mismo lenguaje visual que crystalMaterial del juego).
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { fabricMaterial, npcTier, tattooMaterial, gloveSkin, TATTOO_STYLES } from './materials.js';
import { fabricId } from './library.js';

const col = (c) => new T.Color(c);
const TATTOO_ACCENT = { egida: 0xe6ffff, lumen: 0x5dffa4, forja: 0xfff0a8, vigia: 0xffffff, nova: 0xffe27a, umbra: 0xff7ae8, axioma: 0x9fd8ff, vesper: 0xe2b8ff, micelio: 0xe8c25a, seraf: 0xfff0b0 };
const ROLE_LIST = ['vanguardia', 'soporte', 'ingeniero', 'explorador'];

// ------------------------------------------------------------------ material de cristal (acento psicodélico)
/** Cristal facetado: normal por derivadas, luz de borde, iridiscencia de película fina y pulso. Emisivo (no depende de las luces). */
export function crystalAccent(color, tstate, { glow = 1, hue = 0 } = {}) {
  return new T.ShaderMaterial({
    uniforms: { uTime: tstate, uColor: { value: col(color) }, uGlow: { value: glow }, uHue: { value: hue } },
    vertexShader: 'varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = mv.xyz; vP = position; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uTime, uGlow, uHue; uniform vec3 uColor; varying vec3 vV; varying vec3 vP;
      vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
      void main(){
        vec3 n = normalize(cross(dFdx(vV), dFdy(vV))); vec3 v = normalize(-vV); if (dot(n, v) < 0.0) n = -n;
        float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.0);
        float lit = 0.55 + 0.75 * max(dot(n, normalize(vec3(0.4, 0.8, 0.5))), 0.0);
        float irid = fract(dot(n, vec3(0.3, 0.5, 0.2)) * 1.5 + fres * 0.9 + (vP.x + vP.y + vP.z) * 6.0 + uTime * 0.14 + uHue);
        vec3 c = uColor * lit * 1.15;
        c = mix(c, pal(irid) * 1.15, 0.18 + 0.5 * fres);
        c += uColor * uGlow * (0.45 + 0.25 * sin(uTime * 2.4 + vP.y * 14.0));   // pulso interior
        c += vec3(1.0, 0.95, 0.9) * pow(fres, 3.0) * 0.5;                        // filo brillante
        gl_FragColor = vec4(c, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
      }`,
  });
}

// ------------------------------------------------------------------ acumulador de piezas
/** Junta piezas (geometrías + color + material) y las fusiona por (hueso, material). */
class Builder {
  constructor(W) { this.W = W; this.items = []; }
  /** geo en coordenadas de reposo; bone = hueso del que cuelga; mat = 'tela'|'metal'|'goma'|'cristal'; tela = nombre de la tela (relieve). */
  add(bone, mat, geo, color = '#888888', tela = 'lona') {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count, c = new Float32Array(n * 3), f = new Float32Array(n * 2), k = col(color);
    for (let i = 0; i < n; i++) { k.toArray(c, i * 3); f[i * 2] = fabricId(tela); f[i * 2 + 1] = 0.1; }
    g.setAttribute('color', new T.BufferAttribute(c, 3)); g.setAttribute('npcFab', new T.BufferAttribute(f, 2));
    this.items.push({ bone, mat, g });
  }
  /** Pieza del material de tatuaje: conserva uv (tUv, en dm) y tipo (tKind 0 tatuaje · 1 placa · 2 cristal). uvOf(x,y,z) → [u,v] con la posición ya colocada. */
  addTat(bone, geo, kind, uvOf) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); geo.dispose();
    const own = uvOf ? null : g.attributes.tUv;     // sin uvOf: la geometría ya trae tUv (el tubo del antebrazo)
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(own && k === 'tUv')) g.deleteAttribute(k);
    const pa = g.attributes.position, n = pa.count, kd = new Float32Array(n).fill(kind);
    if (!own) { const uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const [u, v] = uvOf(pa.getX(i), pa.getY(i), pa.getZ(i), i); uv[i * 2] = u; uv[i * 2 + 1] = v; } g.setAttribute('tUv', new T.BufferAttribute(uv, 2)); }
    g.setAttribute('tKind', new T.BufferAttribute(kd, 1));
    this.items.push({ bone, mat: 'tatuaje', g });
  }
  /** Fusiona y devuelve { 'hueso|material': BufferGeometry } con origen en el hueso. */
  build(flat = false) {
    const groups = {};
    for (const it of this.items) (groups[it.bone + '|' + it.mat] ||= []).push(it.g);
    const out = {};
    for (const [key, list] of Object.entries(groups)) {
      const g = mergeGeometries(list, false); list.forEach((x) => x.dispose());
      const w = this.W[key.split('|')[0]]; g.translate(-w[0], -w[1], -w[2]); if (flat) g.computeVertexNormals(); out[key] = g;
    }
    return out;
  }
}

// ------------------------------------------------------------------ geometrías base (en el origen; se colocan con xf)
const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler();
/** Aplica posición / rotación (Euler en radianes) / escala. */
function xf(g, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0], s = 1) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); const sc = Array.isArray(s) ? s : [s, s, s];
  g.applyMatrix4(_m.compose(new T.Vector3(x, y, z), _q, new T.Vector3(...sc))); return g;
}
const rbox = (w, h, d, r = 0.012, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
const box = (w, h, d) => new T.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, seg = 10, open = false) => new T.CylinderGeometry(r1, r2, h, seg, 1, open);
/** Cristal alargado de seis caras (bipirámide con cintura), eje Y. */
function shard(h = 0.1, r = 0.025, sides = 6) {
  const pts = [new T.Vector2(0, -h * 0.5), new T.Vector2(r, -h * 0.18), new T.Vector2(r * 0.92, h * 0.2), new T.Vector2(0, h * 0.5)];
  const g = new T.LatheGeometry(pts, sides); g.computeVertexNormals(); return g;
}
const dome = (r, seg = 10) => { const g = new T.SphereGeometry(r, seg, Math.max(3, seg >> 1), 0, Math.PI * 2, 0, Math.PI / 2); return g; };

/** Cinta de tela de ancho `w` y grosor `t` que sigue una trayectoria (puntos en coordenadas de reposo). Las caras miran hacia afuera del eje X. */
function ribbon(points, w = 0.04, t = 0.01, samples = 24) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)), false, 'catmullrom', 0.5), pos = [], idx = [];
  const side = new T.Vector3(1, 0, 0);
  for (let i = 0; i <= samples; i++) {
    const u = i / samples, p = curve.getPoint(u), tg = curve.getTangent(u), n = new T.Vector3().crossVectors(tg, side).normalize().multiplyScalar(t / 2);
    for (const [sx, sn] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) pos.push(p.x + sx * w / 2 + n.x * sn, p.y + n.y * sn, p.z + n.z * sn);
  }
  for (let i = 0; i < samples; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = a + 4, d = b + 4; idx.push(a, c, b, b, c, d); }
  const cap = (base, flip) => { idx.push(base, base + (flip ? 2 : 1), base + (flip ? 1 : 2), base, base + (flip ? 3 : 2), base + (flip ? 2 : 3)); };
  cap(0, true); cap(samples * 4, false);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** Placa curva (sector de anillo elíptico) de altura h: protege el pecho/la espalda. center = ángulo central (π/2 = +Z, delante). */
function plate(R, thick, h, half, center, sx = 1.4, bevel = 0.004) {
  const sh = new T.Shape(), a0 = center - half, a1 = center + half;
  sh.absarc(0, 0, R + thick, a0, a1, false); sh.absarc(0, 0, R, a1, a0, true); sh.closePath();
  const g = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -h / 2); g.rotateX(Math.PI / 2); g.scale(sx, 1, 1); g.computeVertexNormals(); return g;
}

// ------------------------------------------------------------------ piezas comunes
function headphones(b, color, hi) {
  // aro por detrás del cuello y copas apoyadas sobre el pecho (el cable no se modela)
  const seg = hi ? 14 : 8;
  const band = new T.TorusGeometry(0.088, 0.009, 5, seg * 2, Math.PI * 1.15); band.rotateX(Math.PI / 2); band.rotateY(-Math.PI * 0.925);
  b.add('neck02_h', 'goma', xf(band, [0, 1.462, 0.022]), '#17181d');
  for (const s of [-1, 1]) {
    b.add('neck02_h', 'goma', xf(cyl(0.036, 0.04, 0.026, hi ? 14 : 8), [s * 0.1, 1.395, 0.092], [0, 0, Math.PI / 2], 1), '#1a1b21');
    b.add('neck02_h', 'cristal', xf(cyl(0.026, 0.026, 0.006, hi ? 14 : 8), [s * 0.1 + s * 0.015, 1.395, 0.092], [0, 0, Math.PI / 2]), col);
    b.add('neck02_h', 'goma', xf(box(0.01, 0.02, 0.012), [s * 0.1 - s * 0.003, 1.43, 0.09], [0, 0, s * 0.35]), '#17181d');
  }
}
/** Cristal incrustado en el pecho (racimo) y brazaletes. */
function chestCrystal(b, hi, role) {
  const z = 0.158;
  b.add('spine01_h', 'cristal', xf(shard(0.075, 0.019), [0.0, 1.292, z], [0.12, 0, 0]));
  b.add('spine01_h', 'cristal', xf(shard(0.05, 0.013), [-0.026, 1.278, z - 0.008], [0.1, 0, 0.35]));
  b.add('spine01_h', 'cristal', xf(shard(0.045, 0.012), [0.028, 1.275, z - 0.006], [0.1, 0, -0.4]));
  if (hi) b.add('spine01_h', 'metal', xf(cyl(0.034, 0.038, 0.01, 10), [0, 1.285, z - 0.014], [Math.PI / 2 - 0.1, 0, 0]), '#2d3036');
  void role;
}
function bracelets(b, W, hi) {
  for (const s of ['L', 'R']) {
    const w = W[`wrist_${s}_h`], e = W[`lowerarm01_${s}_h`]; const d = new T.Vector3(e[0] - w[0], e[1] - w[1], e[2] - w[2]).normalize();
    const g = new T.TorusGeometry(0.034, 0.0065, 5, hi ? 14 : 8); g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), d));
    b.add(`wrist_${s}_h`, 'cristal', xf(g, [w[0] + d.x * 0.045, w[1] + d.y * 0.045, w[2] + d.z * 0.045]));
  }
}
/** Detalle de las botas: puño de cuero en la caña y tira de cristal en el talón (las zapatillas son la malla MakeHuman). */
function bootDetail(b, W, hi, color) {
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? 1 : -1, kn = new T.Vector3(...W[`lowerleg01_${s}_h`]), an = new T.Vector3(...W[`foot_${s}_h`]), f = W[`foot_${s}_h`];
    const dir = an.clone().sub(kn).normalize(), c = kn.clone().lerp(an, 0.7);   // la caña va por la línea rodilla → tobillo
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir), g = cyl(0.058, 0.052, 0.06, hi ? 14 : 8);
    g.applyQuaternion(q); g.translate(c.x, c.y, c.z); b.add(`lowerleg01_${s}_h`, 'goma', g, '#242020');
    b.add(`foot_${s}_h`, 'cristal', xf(box(0.018, 0.01, 0.04), [f[0] + k * 0.0, f[1] + 0.02, f[2] - 0.06], [0.1, 0, 0]), color);
  }
}

// ------------------------------------------------------------------ mochilas y equipo por rol
const SPINE = 'spine01_h';
function straps(b, color, hi) {
  for (const s of [-1, 1]) {
    // del borde alto de la mochila, por encima del hombro y bajando por el pecho (los puntos siguen la superficie de la ropa + 1 cm)
    const P = [[-0.1, 1.17], [-0.098, 1.3], [-0.085, 1.4], [-0.03, 1.452], [0.04, 1.457], [0.105, 1.448], [0.14, 1.39], [0.165, 1.31], [0.178, 1.22], [0.178, 1.14]];
    b.add(SPINE, 'tela', xf(ribbon(P.map(([z, y]) => [s * 0.092, y, z]), 0.036, 0.012, 28)), color, 'lona');
    if (hi) b.add(SPINE, 'metal', xf(box(0.026, 0.02, 0.01), [s * 0.092, 1.27, 0.176]), '#aeb1b8');                      // hebilla
  }
  b.add(SPINE, 'tela', xf(ribbon([[-0.092, 1.255, 0.172], [-0.03, 1.252, 0.178], [0.03, 1.252, 0.178], [0.092, 1.255, 0.172]], 0.018, 0.008, 6)), color, 'lona'); // tira del pecho
}
function packCivil(b, base, accent, hi) {
  b.add(SPINE, 'tela', xf(rbox(0.285, 0.36, 0.13, 0.03), [0, 1.255, -0.16]), base, 'lona');
  b.add(SPINE, 'tela', xf(rbox(0.2, 0.15, 0.05, 0.016), [0, 1.17, -0.235]), col(base).multiplyScalar(0.8), 'lona');
  b.add(SPINE, 'goma', xf(box(0.215, 0.012, 0.012), [0, 1.092, -0.235]), '#101116');
  b.add(SPINE, 'cristal', xf(box(0.012, 0.075, 0.014), [-0.115, 1.3, -0.228]), accent);                                  // cinta reflectante de cristal
  b.add(SPINE, 'cristal', xf(box(0.012, 0.075, 0.014), [0.115, 1.3, -0.228]), accent);
  if (hi) b.add(SPINE, 'metal', xf(cyl(0.011, 0.011, 0.06, 8), [0, 1.43, -0.17], [0, 0, Math.PI / 2]), '#8e9199'); // asa
  straps(b, '#22252d', hi);
}
function packSoporte(b, base, green, accent, hi) {
  b.add(SPINE, 'tela', xf(rbox(0.31, 0.34, 0.15, 0.04), [0, 1.26, -0.165]), base, 'lino');
  b.add(SPINE, 'tela', xf(rbox(0.12, 0.34, 0.05, 0.02), [0, 1.26, -0.253]), col(base).multiplyScalar(0.82), 'lino');
  // frascos de cristal verde a los costados (el signo de curación)
  for (const s of [-1, 1]) {
    b.add(SPINE, 'goma', xf(cyl(0.032, 0.032, 0.012, 10), [s * 0.12, 1.2, -0.26], [Math.PI / 2, 0, 0]), '#2c3036');
    b.add(SPINE, 'cristal', xf(shard(0.17, 0.034), [s * 0.12, 1.27, -0.262], [0, 0, 0]), green);
    b.add(SPINE, 'goma', xf(cyl(0.026, 0.03, 0.02, 8), [s * 0.12, 1.368, -0.262]), '#2c3036');
  }
  // cruz médica luminosa en el centro
  b.add(SPINE, 'cristal', xf(box(0.034, 0.1, 0.012), [0, 1.27, -0.259]), green); b.add(SPINE, 'cristal', xf(box(0.1, 0.034, 0.012), [0, 1.27, -0.259]), green);
  b.add(SPINE, 'cristal', xf(box(0.04, 0.012, 0.012), [0, 1.43, -0.2]), accent);
  straps(b, accent === undefined ? '#cfd3da' : '#cfd3da', hi);
}
function packIngeniero(b, base, accent, hi) {
  b.add(SPINE, 'tela', xf(rbox(0.3, 0.38, 0.15, 0.025), [0, 1.25, -0.165]), base, 'lona');
  // bolsillos laterales de herramientas
  for (const s of [-1, 1]) { b.add(SPINE, 'tela', xf(rbox(0.07, 0.17, 0.07, 0.014), [s * 0.185, 1.19, -0.17]), col(base).multiplyScalar(0.78), 'lona'); b.add(SPINE, 'metal', xf(cyl(0.011, 0.011, 0.16, 8), [s * 0.185, 1.33, -0.17], [0.12 * s, 0, 0]), '#a9acb4'); }
  // herramientas que asoman: llave inglesa y destornillador
  b.add(SPINE, 'metal', xf(cyl(0.012, 0.012, 0.2, 8), [0.07, 1.4, -0.245], [0, 0, 0.5]), '#b4b7bd'); b.add(SPINE, 'metal', xf(rbox(0.05, 0.03, 0.014, 0.006), [0.145, 1.495, -0.245], [0, 0, 0.5]), '#b4b7bd');
  b.add(SPINE, 'goma', xf(cyl(0.014, 0.014, 0.08, 8), [-0.06, 1.37, -0.245], [0, 0, -0.3]), '#d8892a');
  // mini-torreta plegada encima de la mochila
  b.add(SPINE, 'metal', xf(rbox(0.16, 0.06, 0.1, 0.012), [0, 1.455, -0.175]), '#4a4f58');
  b.add(SPINE, 'metal', xf(cyl(0.012, 0.012, 0.15, 8), [0, 1.49, -0.18], [Math.PI / 2, 0, 0]), '#262a31');
  b.add(SPINE, 'metal', xf(box(0.012, 0.05, 0.012), [-0.06, 1.44, -0.235], [0.5, 0, 0]), '#6c717b'); b.add(SPINE, 'metal', xf(box(0.012, 0.05, 0.012), [0.06, 1.44, -0.235], [0.5, 0, 0]), '#6c717b');
  b.add(SPINE, 'cristal', xf(shard(0.04, 0.014), [0, 1.49, -0.115], [Math.PI / 2, 0, 0]), accent);
  straps(b, '#2b2a28', hi);
}
function packExplorador(b, base, accent, hi) {
  b.add(SPINE, 'tela', xf(rbox(0.24, 0.26, 0.11, 0.03), [0, 1.25, -0.152]), base, 'lona');
  b.add(SPINE, 'tela', xf(cyl(0.05, 0.05, 0.27, 12), [0, 1.098, -0.2], [0, 0, Math.PI / 2]), col(base).multiplyScalar(0.7), 'lona');   // rollo de dormir
  b.add(SPINE, 'goma', xf(cyl(0.052, 0.052, 0.014, 12), [-0.06, 1.098, -0.2], [0, 0, Math.PI / 2]), '#1a1a1c'); b.add(SPINE, 'goma', xf(cyl(0.052, 0.052, 0.014, 12), [0.06, 1.098, -0.2], [0, 0, Math.PI / 2]), '#1a1a1c');
  b.add(SPINE, 'cristal', xf(shard(0.07, 0.016), [0, 1.32, -0.215], [0.15, 0, 0]), accent);
  straps(b, '#2a2822', hi);
}
/** Capa corta del explorador (cuelga de la columna alta; se mece en update). Devuelve nada: va en su propio hueso lógico 'cape'. */
function capeGeo(color, hi) {
  // arco de ±60° por la espalda; el centro del cilindro es el eje del torso (z ≈ 0,03) y la costura de arriba queda en y = 0
  const g = new T.CylinderGeometry(0.255, 0.34, 0.56, hi ? 18 : 9, hi ? 6 : 2, true, Math.PI - 1.05, 2.1);
  g.translate(0, -0.28, 0.03); void color; return g;
}
function vanguardia(b, W, accent, trim, hi) {
  // peto ligero curvo (delante y detrás) con vetas de cristal, hombreras y una cúpula emisora sobre el hombro izquierdo
  b.add(SPINE, 'metal', xf(plate(0.13, 0.026, 0.15, 0.95, Math.PI / 2, 1.3), [0, 1.29, 0.026], [-0.1, 0, 0]), '#4a505b');
  b.add(SPINE, 'metal', xf(plate(0.125, 0.022, 0.07, 0.8, Math.PI / 2, 1.22), [0, 1.19, 0.026], [-0.04, 0, 0]), '#3b4049');
  b.add(SPINE, 'cristal', xf(plate(0.157, 0.006, 0.12, 0.09, Math.PI / 2, 1.3), [0, 1.29, 0.026], [-0.1, 0, 0]), accent);
  b.add(SPINE, 'metal', xf(plate(0.11, 0.022, 0.14, 0.9, -Math.PI / 2, 1.35), [0, 1.3, -0.03]), '#3f444d');
  for (const s of [-1, 1]) {
    const bone = s > 0 ? 'upperarm01_L_h' : 'upperarm01_R_h'; // (L está en +x)
    const ux = s * 0.19;
    b.add(bone, 'metal', xf(dome(0.082, hi ? 14 : 8), [ux + s * 0.012, 1.375, 0.017], [0, 0, -s * 0.5], [1.05, 0.75, 1.1]), '#4d535e');
    b.add(bone, 'metal', xf(cyl(0.085, 0.088, 0.014, hi ? 14 : 8), [ux + s * 0.03, 1.353, 0.017], [0, 0, -s * 0.5]), trim);
    b.add(bone, 'cristal', xf(shard(0.09, 0.02), [ux + s * 0.035, 1.415, 0.017], [0, 0, -s * 0.7]), accent);
    b.add(bone, 'cristal', xf(shard(0.06, 0.014), [ux + s * 0.02, 1.405, 0.058], [0.5, 0, -s * 0.5]), accent);
  }
  b.add('upperarm01_L_h', 'metal', xf(cyl(0.05, 0.056, 0.02, 12), [0.16, 1.452, -0.01], [0, 0, 0.25]), '#2d3037');
  b.add('upperarm01_L_h', 'cristal', xf(dome(0.04, hi ? 14 : 8), [0.158, 1.462, -0.01], [0, 0, 0.25]), accent);
  void W;
}
/** Visor del explorador: banda de cristal que cruza los ojos + antena. */
function visor(b, accent, hi) {
  const seg = hi ? 18 : 10, R = 0.112, cz = 0.04;
  const g = new T.CylinderGeometry(R, R, 0.046, seg, 1, true, -Math.PI * 0.46, Math.PI * 0.92); // arco frontal de ±83° (el frente es +Z)
  xf(g, [0, 1.578, cz]);
  b.add('head_h', 'cristal', g, accent);
  // marco y sujeción en la sien
  b.add('head_h', 'metal', xf(new T.CylinderGeometry(R + 0.006, R + 0.006, 0.012, seg, 1, true, -1.55, 3.1), [0, 1.604, cz]), '#23262d');
  b.add('head_h', 'metal', xf(new T.CylinderGeometry(R + 0.006, R + 0.006, 0.012, seg, 1, true, -1.55, 3.1), [0, 1.552, cz]), '#23262d');
  for (const s of [-1, 1]) b.add('head_h', 'goma', xf(cyl(0.028, 0.028, 0.03, 10), [s * 0.1, 1.575, 0.025], [0, 0, Math.PI / 2]), '#1d1f25');
  b.add('head_h', 'metal', xf(cyl(0.005, 0.004, 0.1, 6), [-0.108, 1.63, 0.01], [0, 0, 0.25]), '#9a9da6');
  b.add('head_h', 'cristal', xf(shard(0.02, 0.007), [-0.1 - 0.0, 1.68, 0.01]), accent);
}
/** Gafas de soldador sobre la frente (ingeniero). */
function goggles(b, accent, hi) {
  for (const s of [-1, 1]) {
    b.add('head_h', 'metal', xf(cyl(0.03, 0.03, 0.026, hi ? 14 : 8), [s * 0.036, 1.668, 0.1], [Math.PI / 2 - 0.5, 0, 0]), '#5b5f68');
    b.add('head_h', 'cristal', xf(cyl(0.022, 0.022, 0.006, hi ? 14 : 8), [s * 0.036, 1.676, 0.114], [Math.PI / 2 - 0.5, 0, 0]), accent);
  }
  b.add('head_h', 'goma', xf(new T.TorusGeometry(0.098, 0.009, 4, hi ? 20 : 10), [0, 1.655, 0.03], [Math.PI / 2 - 0.12, 0, 0]), '#2a2420');
}


// ------------------------------------------------------------------ guantes tácticos + tatuajes de cristal (manos y antebrazos)
const V3 = (a) => new T.Vector3(a[0], a[1], a[2]);
/** Sistema de coordenadas de una mano en la pose de reposo: Z hacia los dedos, Y hacia el dorso, X = Y × Z. */
function handFrame(W, s) {
  const sx = s === 'L' ? 1 : -1, w = V3(W[`wrist_${s}_h`]), e = V3(W[`lowerarm01_${s}_h`]);
  const Z = V3(W[`finger3-2_${s}_h`]).sub(w).normalize(), c = V3(W[`finger5-1_${s}_h`]).sub(V3(W[`finger1-1_${s}_h`]));
  const Y = new T.Vector3().crossVectors(Z, c).normalize(); if (Y.dot(new T.Vector3(sx, 0.6, 0)) < 0) Y.negate();
  Y.addScaledVector(Z, -Y.dot(Z)).normalize();
  const X = new T.Vector3().crossVectors(Y, Z), M = new T.Matrix4().makeBasis(X, Y, Z).setPosition(w), Mi = M.clone().invert();
  const a = w.clone().sub(e), len = a.length(); a.normalize();
  return { s, sx, w, e, X, Y, Z, M, Mi, a, len, loc: (name) => V3(W[`${name}_${s}_h`]).applyMatrix4(Mi) };
}
// Medidas de calibración (m): el antebrazo viste una manga de ~4–5 cm de radio
const HT = { start: 0.03, r0: 0.052, r1: 0.044, hand: 0.018 };
/** Tubo del antebrazo (tatuaje proyectado): del codo a la muñeca, ángulo 0 = dorso. UV: x = arco, y = largo desde el codo, en dm. */
function forearmTube(f, rings, seg) {
  const U = f.Y.clone().addScaledVector(f.a, -f.Y.dot(f.a)).normalize(), S = new T.Vector3().crossVectors(f.a, U);
  const pos = [], uv = [], idx = [], L = f.len - HT.start + 0.004;
  for (let i = 0; i <= rings; i++) { const t = i / rings, r = HT.r0 + (HT.r1 - HT.r0) * t, c = f.e.clone().addScaledVector(f.a, HT.start + L * t);
    for (let j = 0; j <= seg; j++) { const th = -Math.PI + (j / seg) * Math.PI * 2, p = c.clone().addScaledVector(U, Math.cos(th) * r).addScaledVector(S, Math.sin(th) * r);
      pos.push(p.x, p.y, p.z); uv.push(th * 0.045 * 10, (HT.start + L * t) * 10); } }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // las normales deben mirar hacia afuera; si no, se invierte el sentido de los triángulos
  const n = g.attributes.normal, p = g.attributes.position, mid = Math.floor(seg / 4) + (seg + 1);
  const out = new T.Vector3(p.getX(mid), p.getY(mid), p.getZ(mid)).sub(f.e.clone().addScaledVector(f.a, HT.start + L / rings));
  if (new T.Vector3(n.getX(mid), n.getY(mid), n.getZ(mid)).dot(out) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  g.setAttribute('tUv', new T.Float32BufferAttribute(uv, 2));
  return { g, U, S };
}
/**
 * Guantes (dorso, nudillos de cristal, puño con muñequera luminosa) y tatuajes (tubo proyectado en el antebrazo + dorso de la mano).
 * Cuelga de 2 huesos por mano (antebrazo y muñeca) y todo va en el material de tatuaje: 2 mallas por mano. Los dedos se pintan en la piel (gloveSkin).
 */
function gloves(b, W, hi) {
  for (const s of ['L', 'R']) {
    const f = handFrame(W, s), M = f.M, wb = `wrist_${s}_h`, fb = `lowerarm01_${s}_h`;
    const k3 = f.loc('finger3-1'), thumb = f.loc('finger1-1'), seg = hi ? 16 : 10;
    const addLocal = (geo, kind) => { geo.applyMatrix4(M); b.addTat(wb, geo, kind, (px, py, pz) => { const l = new T.Vector3(px, py, pz).applyMatrix4(f.Mi); return [l.x * 10, 2.3 + l.z * 10]; }); };
    // --- tubo del antebrazo con tatuaje proyectado
    const tube = forearmTube(f, hi ? 5 : 3, hi ? 18 : 12); b.addTat(fb, tube.g, 0, null);
    // --- puño táctico (elipse alrededor de la muñeca) + muñequera luminosa de cristal
    const cuff = new T.CylinderGeometry(1, 1, 0.05, seg, 1, true); cuff.rotateX(Math.PI / 2); cuff.scale(0.053, 0.046, 1); cuff.translate(0, 0, -0.022); cuff.computeVertexNormals(); addLocal(cuff, 1);
    const ring = new T.TorusGeometry(1, 0.004, 5, seg * 2); ring.scale(0.054, 0.047, 1); ring.translate(0, 0, -0.047); addLocal(ring, 2);
    
    // cristal de la muñequera: racimo sobre el dorso, apuntando hacia los dedos
    addLocal(xf(shard(0.06, 0.014), [0, 0.05, -0.024], [Math.PI / 2, 0, 0]), 2);
    addLocal(xf(shard(0.036, 0.009), [-0.017, 0.047, -0.02], [Math.PI / 2, 0, 0.35]), 2);
    addLocal(xf(shard(0.036, 0.009), [0.017, 0.047, -0.02], [Math.PI / 2, 0, -0.35]), 2);
    // --- dorso de la mano (placa) + nudillos de cristal sobre las articulaciones reales de los dedos
    const by = k3.y + 0.014;
    addLocal(xf(rbox(0.07, 0.009, 0.062, 0.004, 1), [0, by, k3.z * 0.5]), 1);
    for (const n of [2, 3, 4, 5]) { const kp = f.loc(`finger${n}-1`); addLocal(xf(new T.OctahedronGeometry(0.012, 0), [kp.x, kp.y + 0.015, kp.z + 0.004], [0, 0, 0], [0.9, 0.6, 1.1]), 2); }
    addLocal(xf(rbox(0.07, 0.007, 0.011, 0.003, 1), [0, by - 0.001, k3.z + 0.002]), 1);                     // tira de agarre bajo los nudillos
    addLocal(xf(shard(0.04, 0.012), [thumb.x + (f.sx > 0 ? -0.004 : 0.004), thumb.y + 0.018, thumb.z + 0.012], [Math.PI / 2 - 0.2, 0, 0]), 2); // base del pulgar
    if (hi) { // medium/high: dos cristales más en la muñequera (el resto del detalle es teselado más fino)
      addLocal(xf(shard(0.03, 0.008), [-0.035, 0.036, -0.03], [Math.PI / 2, 0, 0.8]), 2); addLocal(xf(shard(0.03, 0.008), [0.035, 0.036, -0.03], [Math.PI / 2, 0, -0.8]), 2);
    }
  }
}

// ------------------------------------------------------------------ ensamblado
const PACK_COLORS = { civil: '#303846', vanguardia: '#3b414c', soporte: '#cfd5dc', ingeniero: '#8c6e3e', explorador: '#4f4635' };
/**
 * Construye el equipo de una persona y lo cuelga de sus huesos.
 * spec: { role: null|'vanguardia'|'soporte'|'ingeniero'|'explorador', color, quality, extras: ['mochila','auriculares'], tstate, detail }
 * Devuelve { meshes, materials, geometries, cape, update(dt, {speed, t}), dispose() }.
 */
export function buildGear(kit, actor, { role = null, color = 0x66ffee, quality = 'medium', extras = ['mochila', 'auriculares'], tstate, tint = null, char = null } = {}) {
  if (char && !(char in TATTOO_STYLES)) char = null;
  const W = kit.store.boneWorld(), bones = actor.bones, hi = quality !== 'low', tier = npcTier(quality === 'low' ? 1 : quality === 'medium' ? 2 : 3);
  const b = new Builder(W), accent = col(color), soft = accent.clone().lerp(col('#ffffff'), 0.15);
  const base = col(PACK_COLORS[role] || PACK_COLORS.civil);
  if (tint && !role) base.lerp(col(tint), 0.35);
  const trim = '#' + accent.clone().multiplyScalar(0.55).getHexString();
  if (extras.includes('mochila') || role) {
    if (role === 'soporte') packSoporte(b, base.getStyle(), '#5dffa4', soft, hi);
    else if (role === 'ingeniero') packIngeniero(b, base.getStyle(), soft, hi);
    else if (role === 'explorador') packExplorador(b, base.getStyle(), soft, hi);
    else packCivil(b, base.getStyle(), soft, hi);
  }
  if (extras.includes('auriculares') && role !== 'explorador') headphones(b, soft, hi);
  chestCrystal(b, hi, role);
  if (role === 'vanguardia') vanguardia(b, W, soft, trim, hi);
  if (role === 'explorador') visor(b, soft, hi);
  if (role === 'ingeniero') goggles(b, soft, hi);
  if (char) gloves(b, W, hi); else if (hi) bracelets(b, W, hi);
  bootDetail(b, W, hi, soft);

  const geos = b.build(), meshes = [], materials = [], geometries = [];
  const fab = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.02, side: T.DoubleSide }); fabricMaterial(fab, { tier, mode: 'tri', dirt: 0 });
  const metal = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.55 });
  const rubber = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05 });
  const crystal = crystalAccent(color, tstate, { glow: 0.9 });
  const tattoo = char ? tattooMaterial({ style: char, color, accent: TATTOO_ACCENT[char], tstate }) : null;
  const mats = { tela: fab, metal, goma: rubber, cristal: crystal, tatuaje: tattoo };
  materials.push(fab, metal, rubber, crystal); if (tattoo) materials.push(tattoo);
  // dedos/manos de la piel: guante táctico oscuro con yemas y aros luminosos (sin mallas extra)
  const skinMesh = char ? actor.root.getObjectByName('npc-body') : null, WR = (c) => ({ pos: W[`wrist_${c}_h`], dir: V3(W[`finger3-2_${c}_h`]).sub(V3(W[`wrist_${c}_h`])).normalize().toArray() });
  if (skinMesh?.material) gloveSkin(skinMesh.material, { wrists: [WR('L'), WR('R')], color, tstate });
  for (const [key, g] of Object.entries(geos)) {
    const [bone, mat] = key.split('|'), parent = bones[bone]; if (!parent) { g.dispose(); continue; }
    const m = new T.Mesh(g, mats[mat]); m.name = `gear-${bone}-${mat}`; m.frustumCulled = false; parent.add(m); meshes.push(m); geometries.push(g);
    m.castShadow = quality === 'high' && mat !== 'cristal'; // las sombras de la persona (cuerpo) ya las da actor
  }
  // capa corta del explorador: malla propia, colgada de la columna alta; se mece con la velocidad
  let cape = null;
  if (role === 'explorador' && bones[SPINE]) {
    const cg = capeGeo(null, hi), cc = col('#4f4635'), n = cg.attributes.position.count, cArr = new Float32Array(n * 3), fArr = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const y = cg.attributes.position.getY(i), k = cc.clone().lerp(accent.clone().multiplyScalar(0.7), Math.max(0, -y - 0.38) * 3); k.toArray(cArr, i * 3); fArr[i * 2] = fabricId('lana'); fArr[i * 2 + 1] = 0.1; }
    cg.setAttribute('color', new T.BufferAttribute(cArr, 3)); cg.setAttribute('npcFab', new T.BufferAttribute(fArr, 2)); cg.deleteAttribute('uv');
    cape = new T.Group(); const cm = new T.Mesh(cg, fab); cm.frustumCulled = false; cape.add(cm); geometries.push(cg);
    const w = W[SPINE]; cape.position.set(0.0 - w[0], 1.44 - w[1], 0.0 - w[2]); bones[SPINE].add(cape); meshes.push(cm);
    cape.userData.rest = cape.position.clone();
  }
  return {
    meshes, materials, geometries, cape, mats,
    setColor(c) { crystal.uniforms.uColor.value.set(c); if (tattoo) tattoo.uniforms.uColor.value.set(c); if (skinMesh?.material?.userData.glove) skinMesh.material.userData.glove.uGCol.value.set(c); },
    update(dt, { speed = 0, t = 0 } = {}) {
      if (cape) { const k = Math.min(1, speed / 6); cape.rotation.x = -0.1 - 0.5 * k - 0.04 * Math.sin(t * 3.1 + k * 4) * (0.4 + k); cape.rotation.z = 0.04 * Math.sin(t * 2.3); }
    },
    dispose() { for (const m of meshes) m.removeFromParent(); cape?.removeFromParent(); geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); },
  };
}
export { ROLE_LIST };
