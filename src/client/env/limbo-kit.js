// Kit visual de las ARENAS DEL LIMBO (mapas 5 y 6): escenarios de ARCANUM que llegaron muertos al limbo.
// «Realismo espiritual» (docs/CONCEPTO_ARTE.md): materia real con texturas fotográficas (piedra, estuco, adoquín, losas,
// hueso), paleta lavada casi monocroma (hueso, ceniza, azul noche) y la psicodelia CONTENIDA en el cielo (geometría
// sagrada lenta), las grietas por donde entra la luz del más allá y las raíces/venas que reclaman la arquitectura.
//
// Texturas: public/assets/arcanum/ (adoquín, losas, estuco, sillar y bóveda de ARCANUM — horneadas a partir de «Rock020»
// de ambientCG, CC0; ver docs/ASSETS.md) y Poly Haven (ph.js, CC0). Si falta un archivo, el material queda con su color.
//
// Piezas (todas baratas: una llamada de dibujo por material, nada de luces puntuales en Baja):
//   deadMaterial()  MeshStandardMaterial «muerto»: desaturado, polvo pálido en las caras de arriba, suciedad al pie y
//                   GRIETAS DE LUZ en espacio mundo que laten despacio (uTime) — sin geometría extra.
//   glassMaterial() vidrio oscuro; el color de vértice dice cuánto «brilla» (ventanas de los que añoran).
//   Batch           junta geometrías por material (UV en espacio mundo + color por vértice) → una malla por material.
//   limboSky()      cielo: noche ceniza, nebulosa lavada, sol muerto (eclipse), skyline muerto y GEOMETRÍA SAGRADA lenta.
//   crackStrips()   grietas del piso con luz del más allá (tiras aditivas).
//   rootsMesh()     raíces/venas luminosas que trepan muros y columnas (pulso que viaja por la raíz).
//   floaters()      objetos suspendidos que flotan y giran (gravedad rota leve).
//   leveZone()      columna de motas que suben + glifo en el piso: zona de gravedad rota (map.zones 'leve').
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cfg } from '../quality.js';
import { uTime, finish } from '../shaders.js';
import { NOISE } from './glsl.js';
import { dc, particleGeo, particleMat } from './props.js';
import { phTextures } from '../ph.js';
import { rng } from './noise.js';

export const ARC_BASE = '/public/assets/arcanum/';
const loader = new THREE.TextureLoader(), texCache = new Map();
function ltex(url, srgb) {
  let t = texCache.get(url); if (t) return t;
  t = loader.load(url, undefined, undefined, () => { /* sin archivo: queda el color */ });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; texCache.set(url, t); return t;
}
/** Juego de texturas de ARCANUM (col / nrm / arm = oclusión·rugosidad·metal). */
export function arcTextures(name) {
  const p = ARC_BASE + name + '_';
  const arm = ltex(p + 'arm.jpg', false);
  return { map: ltex(p + 'col.jpg', true), normalMap: ltex(p + 'nrm.jpg', false), roughnessMap: arm, aoMap: arm };
}

/* ───────── material «muerto» ───────── */
const CRACK_GLSL = /* glsl */`
uniform float uTime, uSat, uDustK, uGrime, uCrack, uCrackY0, uCrackY1, uHue; uniform vec3 uTint, uDust, uCrackCol;
vec3 limboHue(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a), sa = sin(a); return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca); }
varying vec3 vLWP; varying vec3 vLWN;
${NOISE}
float limboCrack(vec3 p, float aa){
  float n1 = vnoise(p * 0.5 + 3.0) + 0.3 * vnoise(p * 1.7 + 7.0);
  float net = abs(n1 - 0.66);
  float fw = max(fwidth(net), 1e-4);
  float line = 1.0 - smoothstep(0.0, max(0.010, 1.3 * fw), net);        // grieta fina: ~1 cm en el mundo o ~1 píxel de lejos
  float gate = smoothstep(0.5, 0.68, vnoise(p * 0.11 + 21.0)) * smoothstep(uCrackY0 - 0.5, uCrackY0 + 0.5, p.y) * (1.0 - smoothstep(uCrackY1 - 2.0, uCrackY1, p.y));
  return line * gate * (1.0 - smoothstep(0.6, 2.5, fw * 60.0));          // muy lejos se apagan (no titilan)
}
`;
/**
 * Material PBR «muerto». tex: nombre de ARCANUM ('cobble','flag','stucco','vault','ashlar') o de Poly Haven ('ph:marble_01').
 * o: { color, sat (0 gris … 1 original), tint, dust, dustK, grime, crack (0..1), crackCol, crackY: [y0, y1], scale (UV/m), rough, metal, vcol, envI }
 */
export function deadMaterial(tex, o = {}) {
  const T = !tex ? {} : tex.startsWith('ph:') ? phTextures(tex.slice(3)) : arcTextures(tex);
  const mat = new THREE.MeshStandardMaterial({
    ...T, color: o.color ?? 0xffffff, roughness: o.rough ?? 1, metalness: o.metal ?? 0, vertexColors: o.vcol !== false,
    normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1), envMapIntensity: o.envI ?? 0.6, aoMapIntensity: 0.8,
  });
  const U = {
    uTime, uSat: { value: o.sat ?? 0.75 }, uTint: { value: new THREE.Color(o.tint ?? 0xffffff) }, uDust: { value: new THREE.Color(o.dust ?? 0xd9d4c8) },
    uDustK: { value: o.dustK ?? 0.35 }, uGrime: { value: o.grime ?? 0.45 }, uCrack: { value: o.crack ?? 0.6 }, uCrackCol: { value: new THREE.Color(o.crackCol ?? 0x9fe8ff) },
    uHue: { value: o.hue ?? 1 }, uCrackY0: { value: (o.crackY || [-5, 60])[0] }, uCrackY1: { value: (o.crackY || [-5, 60])[1] },
  };
  mat.userData.U = U;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vLWP; varying vec3 vLWN;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 lwp = vec4(transformed, 1.0); vec3 lwn = objectNormal;
      #ifdef USE_INSTANCING
        lwp = instanceMatrix * lwp; lwn = mat3(instanceMatrix) * lwn;
      #endif
      vLWP = (modelMatrix * lwp).xyz; vLWN = normalize(mat3(modelMatrix) * lwn);`);
    sh.fragmentShader = CRACK_GLSL + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, uSat) * uTint;
          float up = smoothstep(0.55, 0.95, vLWN.y), dn = vnoise(vLWP * 1.7) * 0.6 + vnoise(vLWP * 0.21) * 0.6;
          diffuseColor.rgb = mix(diffuseColor.rgb, uDust, up * uDustK * clamp(dn, 0.0, 1.0));
          diffuseColor.rgb *= mix(1.0 - uGrime, 1.0, smoothstep(0.0, 1.8, vLWP.y) * (1.0 - up) + up);
          diffuseColor.rgb *= 0.86 + 0.28 * vnoise(vLWP * 0.09 + 4.0); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uCrack > 0.0) { float aa = length(fwidth(vLWP)) * 1.2; float c = limboCrack(vLWP, aa) * uCrack;
          float flow = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 1.1 - vLWP.y * 0.45 + vnoise(vLWP * 0.3) * 9.0), 3.0);
          vec3 cc = limboHue(uCrackCol, uHue * (uTime * 0.15 + vnoise(vLWP * 0.04) * 5.0)); cc = max(cc, vec3(0.0));
          diffuseColor.rgb *= 1.0 - 0.6 * c; totalEmissiveRadiance += cc * c * (0.6 + 2.6 * flow); }`);
  };
  mat.customProgramCacheKey = () => 'limbo-dead';
  return mat;
}
/** Vidrio oscuro: refleja el cielo; el color de vértice (r,g,b) es el brillo de la ventana (negro = apagada). */
export function glassMaterial(o = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: o.color ?? 0x0b0d12, roughness: 0.16, metalness: 0.2, vertexColors: true, envMapIntensity: 1.1 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '')   // el color de vértice NO tiñe el vidrio
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          totalEmissiveRadiance += vColor.rgb * (0.85 + 0.15 * sin(uTime * 0.7 + vColor.r * 40.0));
        #endif`);
  };
  mat.customProgramCacheKey = () => 'limbo-glass';
  return mat;
}
/** Material que sólo emite (llamas frías, núcleos de faroles): aditivo, sin luz. */
export function glowMaterial(o = {}) {
  return new THREE.MeshBasicMaterial({ color: o.color ?? 0xffffff, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: o.opacity ?? 1 });
}

/* ───────── lotes: UV en espacio mundo + color por vértice ───────── */
/** Proyección de caja: cada cara toma (x,z), (z,y) o (x,y) del mundo según su normal. `s` = repeticiones por metro. */
export function worldUV(g, s = 0.25, off = [0, 0]) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let u, v; if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u * s + off[0]; uv[i * 2 + 1] = v * s + off[1];
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
const COL = new THREE.Color();
/** Ubica una geometría: posición, rotación (x,y,z) y escala. Devuelve la misma geometría. */
export function put(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  g.applyMatrix4(m); return g;
}
export class Batch {
  constructor(scale = 0.25) { this.list = []; this.scale = scale; }
  /** col: color hex (o THREE.Color) por vértice; uvS: repeticiones por metro (null = UV propias de la geometría). */
  add(g, col = 0xffffff, uvS) {
    g = g.index ? g.toNonIndexed() : g; if (!g.attributes.normal) g.computeVertexNormals();
    if (uvS !== null) worldUV(g, uvS ?? this.scale); else if (!g.attributes.uv) worldUV(g, this.scale);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const c = col && col.isColor ? col : COL.setHex(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); this.list.push(g); return g;
  }
  get size() { return this.list.length; }
  /** Une todo en una malla con `mat`. */
  build(mat, { shadows = false, name = '' } = {}) {
    if (!this.list.length) return null;
    const g = mergeGeometries(this.list, false); this.list.forEach((x) => x.dispose()); this.list = [];
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.name = name; m.matrixAutoUpdate = false;
    if (shadows) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  }
}
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (r0, r1, h, seg = 8, open = false) => new THREE.CylinderGeometry(r0, r1, h, seg, 1, open);

/* ───────── perfiles de ARCANUM (copiados de /duelo-arcano/src/world/praga-build.js, «profileBar»/«gableGeo»/«roofPrism») ───────── */
/** Barra con perfil (z = hacia afuera, y = arriba) extruida a lo largo de x (centrada), longitud len. [ARCANUM praga-build.js] */
export function profileBar(prof, len, seg = 2) {
  const s = new THREE.Shape(prof.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -len / 2); g.rotateY(-Math.PI / 2);
  return g;
}
export const CORNICE = [[0, 0], [0.07, 0], [0.07, 0.05], [0.12, 0.08], [0.16, 0.16], [0.26, 0.2], [0.3, 0.27], [0.4, 0.3], [0.46, 0.36], [0.46, 0.46], [0, 0.46]];
export const STRING = [[0, 0], [0.1, 0], [0.13, 0.04], [0.13, 0.12], [0.08, 0.16], [0.08, 0.2], [0, 0.2]];
/** Frontón barroco (volutas) o escalonado, ancho w, alto h, base y = 0, espesor d. [ARCANUM praga-build.js] */
export function gableGeo(w, h, stepped, d = 0.4) {
  const s = new THREE.Shape(); const a = w / 2;
  s.moveTo(-a, 0);
  if (stepped) {
    const n = 3;
    for (let i = 0; i < n; i++) { const x0 = -a + i * a / (n + 0.4), y1 = h * ((i + 1) / (n + 0.5)); s.lineTo(x0, y1); s.lineTo(x0 + a / (n + 0.4), y1); }
    s.lineTo(-a * 0.18, h * 0.92); s.quadraticCurveTo(0, h * 1.08, a * 0.18, h * 0.92);
    for (let i = n - 1; i >= 0; i--) { const x0 = a - i * a / (n + 0.4), y1 = h * ((i + 1) / (n + 0.5)); s.lineTo(x0 - a / (n + 0.4), y1); s.lineTo(x0, y1); }
  } else {
    s.lineTo(-a, h * 0.18);
    s.bezierCurveTo(-a * 0.55, h * 0.2, -a * 0.9, h * 0.62, -a * 0.42, h * 0.62);
    s.lineTo(-a * 0.42, h * 0.72);
    s.bezierCurveTo(-a * 0.3, h * 0.8, -a * 0.25, h * 0.95, 0, h);
    s.bezierCurveTo(a * 0.25, h * 0.95, a * 0.3, h * 0.8, a * 0.42, h * 0.72);
    s.lineTo(a * 0.42, h * 0.62);
    s.bezierCurveTo(a * 0.9, h * 0.62, a * 0.55, h * 0.2, a, h * 0.18);
  }
  s.lineTo(a, 0); s.lineTo(-a, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 5 });
  g.translate(0, 0, -d / 2);
  return g;
}
/** Tejado a dos aguas (prisma) de ancho w, alto h y largo d, cumbrera a lo largo de x. [ARCANUM praga-build.js, simplificado] */
export function roofGeo(w, h, d) {
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(0, h); s.lineTo(d / 2, 0); s.lineTo(-d / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2); return g;
}
/** Arco de medio punto (anillo) de radio r, grosor t, profundidad d; base en y=0, centrado en x. [idea: ARCANUM geom.js archOutline] */
export function archGeo(r, t, d, seg = 10) {
  const s = new THREE.Shape(); s.absarc(0, 0, r + t, 0, Math.PI, false); s.lineTo(-r, 0); s.absarc(0, 0, r, Math.PI, 0, true); s.lineTo(r + t, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: seg }); g.translate(0, 0, -d / 2); return g;
}

/* ───────── cielo del limbo ───────── */
/**
 * Cielo: noche ceniza con nebulosa lavada, estrellas escasas, un SOL MUERTO (disco negro con corona pálida), el skyline
 * de una ciudad muerta (opcional) y, en el cenit, GEOMETRÍA SAGRADA (flor de la vida + cubo de Metatrón) que gira muy
 * despacio y cambia de tono apenas: la única psicodelia del cielo.
 * o: { sun: Vector3, skyline: 0|1, hue: 0..1, glyph: intensidad, zen, hor }
 */
export function limboSky(r, root, o = {}) {
  const q = cfg(), sun = (o.sun || new THREE.Vector3(-0.5, 0.18, -0.85)).clone().normalize();
  const mat = finish(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, defines: { FBM_OCT: q.decor ? 4 : 3 },
    uniforms: { uTime, uSun: { value: sun }, uSky: { value: o.skyline ?? 0 }, uHue: { value: o.hue ?? 0 }, uGlyph: { value: o.glyph ?? 1 },
      uZen: { value: dc(o.zen ?? 0x05070d) }, uHor: { value: dc(o.hor ?? 0x2a3040) }, uGlow: { value: dc(o.glow ?? 0x9fe8ff) } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform float uTime, uSky, uHue, uGlyph; uniform vec3 uSun, uZen, uHor, uGlow; varying vec3 vDir; ${NOISE}
      vec3 hueRot(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a), sa = sin(a); return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca); }
      float ring(vec2 p, vec2 c, float R, float w){ return 1.0 - smoothstep(0.0, w, abs(length(p - c) - R)); }
      float seg(vec2 p, vec2 a, vec2 b, float w){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return 1.0 - smoothstep(0.0, w, length(pa - ba * h)); }
      float sacred(vec2 p, float w){ // flor de la vida (7 círculos) + anillo + cubo de Metatrón (hexágono y estrella)
        float s = ring(p, vec2(0.0), 1.0, w) * 0.9; vec2 v[6];
        for (int i = 0; i < 6; i++) { float a = float(i) * 1.0471976; v[i] = vec2(cos(a), sin(a)); s = max(s, ring(p, v[i], 1.0, w) * 0.7); }
        s = max(s, ring(p, vec2(0.0), 2.0, w * 1.4)); s = max(s, ring(p, vec2(0.0), 2.12, w * 0.8) * 0.6);
        for (int i = 0; i < 6; i++) { vec2 a = v[i] * 2.0, b = v[int(mod(float(i) + 1.0, 6.0))] * 2.0, c = v[int(mod(float(i) + 2.0, 6.0))] * 2.0;
          s = max(s, seg(p, a, b, w) * 0.55); s = max(s, seg(p, a, c, w) * 0.4); s = max(s, seg(p, a, vec2(0.0), w) * 0.3); }
        return s; }
      void main(){
        vec3 d = normalize(vDir); float up = d.y, t = uTime;
        vec3 col = mix(uHor, uZen, smoothstep(-0.02, 0.6, up));
        col = mix(col, uHor * 0.5, smoothstep(0.0, -0.3, up));
        // nebulosas ALUCINADAS: dominio deformado, colores que giran despacio (violeta, magenta, turquesa, oro)
        vec3 qd = d * 1.5 + vec3(0.0, t * 0.006, 0.0);
        float w = fbm(qd * 1.3 + 3.0), n = fbm(qd * 1.9 + 2.2 * vec3(w, w * 0.5, -w) + t * 0.01), n2 = fbm(qd * 3.6 - 1.4 * vec3(w) + 7.0);
        float dens = smoothstep(0.38, 0.85, n) * smoothstep(-0.12, 0.2, up);
        vec3 neb = 0.5 + 0.5 * cos(6.28318 * (w * 1.3 + n2 * 0.6 + uHue + t * 0.01 + vec3(0.0, 0.33, 0.67)));
        neb = mix(neb, neb * neb * 1.6, 0.5);
        col += neb * dens * 0.55 + neb * smoothstep(0.55, 0.9, n2) * dens * 0.6;
        col += mix(uGlow, vec3(1.0, 0.35, 0.85), 0.5 + 0.5 * sin(atan(d.z, d.x) * 2.0 + t * 0.05)) * pow(1.0 - abs(up), 7.0) * 0.55; // resplandor del horizonte
        // auroras: cortinas que ondulan
        float az = atan(d.z, d.x);
        float cur = sin(az * 7.0 + sin(az * 3.0 + t * 0.07) * 2.5 + t * 0.05) * 0.5 + 0.5;
        float aur = pow(cur, 6.0) * smoothstep(0.05, 0.22, up) * (1.0 - smoothstep(0.35, 0.65, up)) * (0.5 + 0.5 * vnoise(vec3(az * 6.0, up * 30.0 - t * 0.4, 1.0)));
        col += mix(vec3(0.2, 1.0, 0.75), vec3(0.75, 0.35, 1.0), smoothstep(0.1, 0.5, up)) * aur * 0.7;
        // estrellas
        vec3 sp = d * 220.0, si = floor(sp), sf = fract(sp) - 0.5; float h = hash13(si);
        col += (0.6 + 0.4 * cos(6.28318 * (h * 3.0 + vec3(0.0, 0.33, 0.67)))) * step(0.975, h) * (1.0 - smoothstep(0.0, 0.32, length(sf))) * (0.45 + 0.45 * sin(t * (1.0 + h * 3.0) + h * 50.0)) * smoothstep(0.0, 0.2, up) * 1.3;
        // sol muerto: disco negro con corona IRISADA y rayos lentos
        float sd = acos(clamp(dot(d, uSun), -1.0, 1.0));
        float corona = exp(-max(sd - 0.075, 0.0) * 18.0) * smoothstep(0.072, 0.08, sd);
        float rays = 0.5 + 0.5 * sin(atan(dot(d, normalize(cross(uSun, vec3(0.0, 1.0, 0.0)))), dot(d, vec3(0.0, 1.0, 0.0))) * 14.0 + t * 0.05);
        vec3 irid = 0.55 + 0.45 * cos(6.28318 * (sd * 6.0 - t * 0.05 + vec3(0.0, 0.33, 0.67)));
        col += mix(vec3(1.0, 0.95, 0.85), irid, 0.6) * corona * (1.0 + 0.8 * rays) * 1.4 + irid * exp(-sd * 2.6) * 0.25;
        col *= 1.0 - (1.0 - smoothstep(0.066, 0.072, sd)) * 0.97;
        // geometría sagrada en el cenit: dos capas que giran en sentidos opuestos, con color que corre por las líneas
        if (up > 0.05) {
          vec2 p = d.xz / (up + 0.35) * 2.3; float a = t * 0.015, ca = cos(a), sa = sin(a); vec2 p1 = mat2(ca, -sa, sa, ca) * p, p2 = mat2(ca, sa, -sa, ca) * p * 0.5;
          float ww = max(fwidth(p.x) + fwidth(p.y), 0.004) * 1.4;
          float s1 = sacred(p1, ww), s2 = sacred(p2, ww * 0.6) * 0.7;
          float g = max(s1, s2) * smoothstep(0.05, 0.45, up) * uGlyph;
          vec3 gc = 0.55 + 0.45 * cos(6.28318 * (length(p) * 0.18 - t * 0.04 + uHue + vec3(0.0, 0.33, 0.67)));
          col += mix(gc, uGlow, 0.25) * g * (0.75 + 0.35 * sin(t * 0.4 + length(p) * 2.0));
        }
        // skyline de una ciudad muerta (siluetas con alguna ventana fría)
        if (uSky > 0.5) {
          float az = atan(d.z, d.x) * 28.0, cell = floor(az), fr = fract(az);
          float hb = 0.03 + 0.06 * hash13(vec3(cell, 1.0, 7.0)) + 0.1 * step(0.93, hash13(vec3(cell, 4.0, 1.0)));
          float roofv = hb - abs(fr - 0.5) * 0.04 * step(0.5, hash13(vec3(cell, 9.0, 2.0)));
          float bld = 1.0 - smoothstep(roofv - 0.002, roofv + 0.002, up);
          vec2 wv = vec2(fr * 9.0, up * 160.0); float win = step(0.9, hash13(vec3(floor(wv) + vec2(cell * 13.0, 0.0), 3.0))) * step(0.25, fract(wv.x)) * step(0.3, fract(wv.y));
          vec3 wc = 0.55 + 0.45 * cos(6.28318 * (hash13(vec3(floor(wv), cell)) + vec3(0.0, 0.33, 0.67)));
          col = mix(col, vec3(0.03, 0.025, 0.05) + wc * win * 0.8, bld * smoothstep(-0.1, 0.0, up));
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat); m.frustumCulled = false; m.renderOrder = -10; root.add(m);
  r.dyn.push(() => m.position.copy(r.camera.position));
  return m;
}

/* ───────── grietas del piso con luz del más allá ───────── */
/** Tiras finas y quebradas que salen de `from` (lista de {x,z,n,len,y}), aditivas, con pulsos que corren hacia afuera. */
export function crackStrips(root, list, { color = 0x9fe8ff, seed = 3, width = 0.09, avoid = null } = {}) {
  const rd = rng(seed), pos = [], aT = [], idx = [];
  const addStrip = (pts, w) => {
    const base = pos.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], dx = q[0] - o[0], dz = q[2] - o[2], l = Math.hypot(dx, dz) || 1;
      const ww = w * (1 - i / pts.length * 0.7), nx = -dz / l * ww, nz = dx / l * ww;
      pos.push(p[0] + nx, p[1], p[2] + nz, p[0] - nx, p[1], p[2] - nz); aT.push(p[3], 0, p[3], 1);
      if (i < pts.length - 1) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
  };
  for (const c of list) {
    for (let b = 0; b < (c.n || 5); b++) {
      let a = (c.a0 ?? 0) + (b / (c.n || 5)) * (c.spread ?? Math.PI * 2) + (rd() - 0.5) * 0.5, x = c.x, z = c.z, t = 0;
      const pts = [[x, c.y ?? 0.03, z, 0]], L = (c.len || 8) * (0.6 + rd() * 0.6), st = 0.55;
      for (let s = 0; s < L / st; s++) {
        a += (rd() - 0.5) * 0.7; x += Math.cos(a) * st; z += Math.sin(a) * st; t += st;
        if (avoid && !avoid(x, z)) break;
        pts.push([x, c.y ?? 0.03, z, t]);
        if (rd() < 0.08 && pts.length > 3) { const sub = [[x, c.y ?? 0.03, z, t]]; let a2 = a + (rd() < 0.5 ? 1 : -1) * (0.6 + rd() * 0.6), x2 = x, z2 = z, t2 = t; for (let k = 0; k < 5 + rd() * 6; k++) { a2 += (rd() - 0.5) * 0.8; x2 += Math.cos(a2) * st; z2 += Math.sin(a2) * st; t2 += st; if (avoid && !avoid(x2, z2)) break; sub.push([x2, c.y ?? 0.03, z2, t2]); } if (sub.length > 2) addStrip(sub, width * 0.6); }
      }
      if (pts.length > 2) addStrip(pts, width);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 2)); g.setIndex(idx);
  const mat = finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uTime, uCol: { value: dc(color) } },
    vertexShader: `attribute vec2 aT; varying vec2 vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec2 vT;
      void main(){ float edge = 1.0 - abs(vT.y - 0.5) * 2.0; float core = pow(edge, 3.0);
        float pulse = pow(0.5 + 0.5 * sin(vT.x * 0.9 - uTime * 1.6), 6.0);
        float fade = exp(-vT.x * 0.12);
        vec3 c = mix(uCol, 0.55 + 0.45 * cos(6.28318 * (vT.x * 0.04 - uTime * 0.05 + vec3(0.0, 0.33, 0.67))), 0.65);
        gl_FragColor = vec4(c * (core * (0.7 + 3.0 * pulse) + edge * 0.25) * (0.45 + 0.55 * fade), 1.0); }`,
  }));
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 2; root.add(m); return m;
}

/* ───────── raíces/venas luminosas ───────── */
/** curves: [[THREE.Vector3...]]; radio r0→r1. Corteza ceniza con una vena de luz que late y viaja hacia la punta. */
export function rootsMesh(root, curves, { r0 = 0.16, r1 = 0.03, color = 0x9fe8ff, bark = 0x2a2b2e, seg = 5, sun = new THREE.Vector3(0.3, 1, 0.2) } = {}) {
  const geos = [];
  curves.forEach((pts, k) => {
    const cv = new THREE.CatmullRomCurve3(pts), n = Math.max(6, Math.round(cv.getLength() * 1.6));
    const g = new THREE.TubeGeometry(cv, n, 1, seg, false), p = g.attributes.position, uv = g.attributes.uv;
    // afinar hacia la punta: TubeGeometry crea radio 1; se escala alrededor de la curva
    const pts2 = cv.getSpacedPoints(n);
    for (let i = 0; i < p.count; i++) { const t = uv.getX(i), j = Math.round(t * n), c = pts2[j], rr = r0 + (r1 - r0) * t; p.setXYZ(i, c.x + (p.getX(i) - c.x) * rr, c.y + (p.getY(i) - c.y) * rr, c.z + (p.getZ(i) - c.z) * rr); }
    const kk = new Float32Array(p.count).fill(k * 0.137 % 1); g.setAttribute('aK', new THREE.BufferAttribute(kk, 1));
    g.computeVertexNormals(); geos.push(g);
  });
  if (!geos.length) return null;
  const g = mergeGeometries(geos, false); geos.forEach((x) => x.dispose());
  const mat = finish(new THREE.ShaderMaterial({
    uniforms: { uTime, uCol: { value: dc(color) }, uBark: { value: dc(bark) }, uSun: { value: sun.clone().normalize() } }, defines: { FBM_OCT: 2 },
    vertexShader: `attribute float aK; varying vec2 vUv; varying float vK; varying vec3 vN; varying vec3 vW; void main(){ vUv = uv; vK = aK; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uCol, uBark, uSun; varying vec2 vUv; varying float vK; varying vec3 vN; varying vec3 vW; ${NOISE}
      void main(){ vec3 n = normalize(vN), V = normalize(cameraPosition - vW);
        float lam = 0.35 + 0.65 * max(dot(n, uSun), 0.0), grain = vnoise(vec3(vUv.x * 60.0, vUv.y * 6.0, vK * 9.0));
        vec3 col = uBark * (0.6 + 0.6 * grain) * lam;
        float vein = smoothstep(0.8, 1.0, sin(vUv.y * 6.2832 + vUv.x * 3.0) * 0.5 + 0.5);
        float pulse = pow(0.5 + 0.5 * sin(vUv.x * 14.0 - uTime * 1.1 + vK * 30.0), 10.0);
        float fr = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        vec3 vc = mix(uCol, 0.55 + 0.45 * cos(6.28318 * (vUv.x * 0.6 + vK - uTime * 0.04 + vec3(0.0, 0.33, 0.67))), 0.6);
        col += vc * (vein * (0.35 + 2.4 * pulse) + fr * 0.25 * (0.4 + pulse)) * (0.6 + 0.4 * vUv.x);
        gl_FragColor = vec4(col, 1.0); }`,
  }));
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; root.add(m); return m;
}
/** Una raíz que trepa: sale del piso en (x,z), sube por la cara de un muro con normal (nx,nz) zigzagueando hasta `h`. */
export function climbCurve(x, z, nx, nz, h, rd, { out = 0.1, wander = 0.45 } = {}) {
  const pts = [], tx = -nz, tz = nx; let u = 0;
  pts.push(new THREE.Vector3(x + nx * 1.6 + tx * (rd() - 0.5), 0.0, z + nz * 1.6 + tz * (rd() - 0.5)));
  pts.push(new THREE.Vector3(x + nx * 0.5, 0.15, z + nz * 0.5));
  for (let y = 0.6; y < h; y += 1.1 + rd() * 0.8) { u += (rd() - 0.5) * wander; pts.push(new THREE.Vector3(x + tx * u + nx * out, y, z + tz * u + nz * out)); }
  return pts;
}

/* ───────── objetos suspendidos (gravedad rota) ───────── */
/** items: [{p: Vector3, s, rot: Euler, amp, spd, spin}]; flotan (seno) y giran despacio. Actualiza a 30 Hz. */
export function floaters(r, root, geo, mat, items, { name = 'flotantes' } = {}) {
  if (!items.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, items.length); im.name = name; im.frustumCulled = false;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const write = (t) => {
    items.forEach((it, i) => { E.set(it.rot.x + t * it.spin.x, it.rot.y + t * it.spin.y, it.rot.z + t * it.spin.z); Q.setFromEuler(E); P.copy(it.p); P.y += Math.sin(t * it.spd + it.ph) * it.amp; S.setScalar(it.s); if (it.sv) S.multiply(it.sv); M.compose(P, Q, S); im.setMatrixAt(i, M); });
    im.instanceMatrix.needsUpdate = true;
  };
  write(0); let acc = 0; r.dyn.push((dt, t) => { acc += dt; if (acc < 1 / 30) return; acc = 0; write(t); });
  root.add(im); return im;
}
export function floatItem(rd, p, s, { amp = 0.4, spd = 0.5, spin = 0.25, sv = null } = {}) {
  return { p, s, sv, rot: new THREE.Euler(rd() * 6.28, rd() * 6.28, rd() * 6.28), amp: amp * (0.5 + rd()), spd: spd * (0.6 + rd() * 0.8), ph: rd() * 6.28, spin: new THREE.Vector3((rd() - 0.5) * spin, (rd() - 0.5) * spin, (rd() - 0.5) * spin) };
}

/* ───────── zona de gravedad rota (visual) ───────── */
/** Motas que suben despacio en el cilindro + un glifo circular en el piso (anillo de runas que gira). */
export function leveZone(r, root, z, { color = 0xbfe9ff, count = 160 } = {}) {
  const q = cfg(), n = Math.round(count * (q.decor ? 1.6 : 1));
  const g = particleGeo(n, (i, rd) => { const a = rd() * 6.283, rr = Math.sqrt(rd()) * z.r; return [z.x + Math.cos(a) * rr, rd() * 2, z.z + Math.sin(a) * rr]; }, 41);
  const pts = new THREE.Points(g, particleMat({ color, size: 0.09, mode: 0, speed: 0.035, height: 22, amp: 0.6, alpha: 0.75 })); pts.frustumCulled = false; root.add(pts);
  const ring = new THREE.Mesh(new THREE.RingGeometry(z.r - 0.9, z.r, 96, 1), finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    uniforms: { uTime, uCol: { value: dc(color) }, uR: { value: z.r } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uR; uniform vec3 uCol; varying vec2 vP; ${NOISE}
      void main(){ float rr = length(vP), a = atan(vP.y, vP.x) + uTime * 0.05; float band = (rr - (uR - 0.9)) / 0.9;
        float edge = smoothstep(0.0, 0.12, band) * (1.0 - smoothstep(0.85, 1.0, band));
        float rune = step(0.55, hash13(vec3(floor(a * 18.0), 1.0, 2.0))) * step(0.2, fract(a * 18.0)) * step(fract(a * 18.0), 0.8) * smoothstep(0.25, 0.4, band) * (1.0 - smoothstep(0.6, 0.75, band));
        float lines = (1.0 - smoothstep(0.0, 0.08, abs(band - 0.12))) + (1.0 - smoothstep(0.0, 0.08, abs(band - 0.9)));
        float pulse = 0.55 + 0.45 * sin(uTime * 0.8 - a * 2.0);
        vec3 rc = mix(uCol, 0.55 + 0.45 * cos(6.28318 * (a * 0.16 + uTime * 0.07 + vec3(0.0, 0.33, 0.67))), 0.7);
        gl_FragColor = vec4(rc * (rune * 1.4 + lines * 1.1) * edge * pulse, 1.0); }`,
  })));
  ring.rotation.x = -Math.PI / 2; ring.position.set(z.x, 0.04, z.z); root.add(ring);
  return { pts, ring };
}

/** Halos de luz (sprites aditivos) para núcleos de faroles, velas y portales. list: [{p, s, col}] */
export function halos(r, root, list, tex) {
  const g = new THREE.Group(); root.add(g);
  for (const h of list) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: h.col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: h.o ?? 0.6 })); sp.position.copy(h.p); sp.scale.setScalar(h.s); g.add(sp); }
  return g;
}
/** Halos instanciados (UNA llamada de dibujo): billboards aditivos con su color y tamaño, titilan despacio. */
export function haloField(root, list, { tex } = {}) {
  if (!list.length) return null;
  const n = list.length, g = new THREE.InstancedBufferGeometry(); const base = new THREE.PlaneGeometry(1, 1);
  g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const P = new Float32Array(n * 4), C = new Float32Array(n * 3);
  list.forEach((h, i) => { P.set([h.p.x, h.p.y, h.p.z, h.s], i * 4); const c = new THREE.Color(h.col); C.set([c.r * (h.o ?? 0.6), c.g * (h.o ?? 0.6), c.b * (h.o ?? 0.6)], i * 3); });
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(P, 4)); g.setAttribute('aC', new THREE.InstancedBufferAttribute(C, 3)); g.instanceCount = n;
  const mat = finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime, uTex: { value: tex } },
    vertexShader: `attribute vec4 aP; attribute vec3 aC; uniform float uTime; varying vec2 vUv; varying vec3 vC;
      void main(){ vUv = uv; vC = aC * (0.85 + 0.15 * sin(uTime * 2.3 + aP.x * 3.1 + aP.z)); vec4 mv = viewMatrix * vec4(aP.xyz, 1.0); mv.xy += position.xy * aP.w; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uTex; varying vec2 vUv; varying vec3 vC; void main(){ float a = texture2D(uTex, vUv).a; gl_FragColor = vec4(vC * a, 1.0); }`,
  }));
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 4; root.add(m); return m;
}

/* ───────── rayos de luz (conos verticales aditivos, todos en UNA malla) ───────── */
/** list: [{x, z, top, r0 (arriba), r1 (abajo), k, col}]: luz que cae del cielo; polvo que se mueve adentro; se apaga cerca de la cámara. */
export function lightShafts(root, list, { color = 0xdcefff, tilt = new THREE.Vector3(0.18, 1, 0.1) } = {}) {
  const geos = [], ax = tilt.clone().normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax);
  list.forEach((s, i) => {
    const h = s.top, g = new THREE.CylinderGeometry(s.r0, s.r1, h, 20, 1, true); g.translate(0, h / 2, 0); g.applyQuaternion(q); g.translate(s.x, 0, s.z);
    g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(s.k ?? 1), 1));
    g.setAttribute('aI', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(i), 1));
    const c = dc(s.col ?? color), ca = new Float32Array(g.attributes.position.count * 3); for (let j = 0; j < ca.length; j += 3) { ca[j] = c.r; ca[j + 1] = c.g; ca[j + 2] = c.b; } g.setAttribute('aC', new THREE.BufferAttribute(ca, 3)); geos.push(g);
  });
  const g = mergeGeometries(geos, false); geos.forEach((x) => x.dispose());
  const mat = finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, defines: { FBM_OCT: 2 },
    uniforms: { uTime, uCol: { value: dc(color) } },
    vertexShader: `attribute float aK, aI; attribute vec3 aC; varying vec3 vC; varying float vK, vI, vH; varying vec3 vW, vN; void main(){ vC = aC; vK = aK; vI = aI; vH = uv.y; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec3 vC; varying float vK, vI, vH; varying vec3 vW, vN; ${NOISE}
      void main(){ vec3 V = normalize(cameraPosition - vW); float face = abs(dot(normalize(vN), V));
        float d = length(cameraPosition - vW);
        float ang = atan(vN.z, vN.x);
        float streak = 0.35 + 0.65 * vnoise(vec3(ang * 3.0 + vI * 5.0, vW.y * 0.04 - uTime * 0.05, vI));
        float dust = 0.7 + 0.3 * vnoise(vec3(vW.x * 0.8, vW.y * 0.3 - uTime * 0.35, vW.z * 0.8 + vI * 7.0));
        float a = pow(face, 4.0) * (0.2 + 0.8 * vH * vH) * smoothstep(0.0, 0.05, vH) * (1.0 - smoothstep(0.92, 1.0, vH)) * smoothstep(1.5, 6.0, d) * streak * dust * vK;
        vec3 o = vC * a * 0.3; if (!(o.r < 10.0 && o.g < 10.0 && o.b < 10.0 && o.r >= 0.0)) o = vec3(0.0); gl_FragColor = vec4(min(o, vec3(1.0)), 1.0); }`,
  }));
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 3; root.add(m); return m;
}

/* ───────── charcos de luz en el piso (luz de faroles, ventanas y portales sin luces reales) ───────── */
/** list: [{x, z, r, col, k}] → discos aditivos con caída suave, UNA llamada. Laten apenas. */
export function lightPools(root, list, { y = 0.03 } = {}) {
  if (!list.length) return null;
  const n = list.length, base = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const P = new Float32Array(n * 4), C = new Float32Array(n * 3);
  list.forEach((h, i) => { P.set([h.x, y + i * 0.0005, h.z, h.r], i * 4); const c = new THREE.Color(h.col); C.set([c.r * (h.k ?? 1), c.g * (h.k ?? 1), c.b * (h.k ?? 1)], i * 3); });
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(P, 4)); g.setAttribute('aC', new THREE.InstancedBufferAttribute(C, 3)); g.instanceCount = n;
  const mat = finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, uniforms: { uTime },
    vertexShader: `attribute vec4 aP; attribute vec3 aC; uniform float uTime; varying vec2 vUv; varying vec3 vC;
      void main(){ vUv = uv * 2.0 - 1.0; vC = aC * (0.85 + 0.15 * sin(uTime * 1.7 + aP.x * 0.7 + aP.z)); gl_Position = projectionMatrix * viewMatrix * vec4(aP.xyz + position * aP.w, 1.0); }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vC; void main(){ float r = length(vUv); float a = pow(max(0.0, 1.0 - r), 2.2); gl_FragColor = vec4(vC * a * 0.55, 1.0); }`,
  }));
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 1; root.add(m); return m;
}
/* ───────── chorro de luz/agua que sube (cilindros aditivos con flujo) ───────── */
export function risingStream(root, list) {
  const geos = list.map((s) => { const g = new THREE.CylinderGeometry(s.r * 0.6, s.r, s.h, 16, 1, true); g.translate(s.x, s.y + s.h / 2, s.z); return g; });
  const g = mergeGeometries(geos, false); geos.forEach((x) => x.dispose());
  const mat = finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, defines: { FBM_OCT: 2 }, uniforms: { uTime },
    vertexShader: `varying vec2 vUv; varying vec3 vW; varying vec3 vN; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vW; varying vec3 vN; ${NOISE}
      void main(){ vec3 V = normalize(cameraPosition - vW); float face = abs(dot(normalize(vN), V));
        float f = vnoise(vec3(vUv.x * 10.0, vUv.y * 4.0 - uTime * 1.4, 0.0)) * 0.6 + vnoise(vec3(vUv.x * 23.0, vUv.y * 9.0 - uTime * 2.3, 3.0)) * 0.4;
        float streak = smoothstep(0.45, 0.85, f);
        vec3 c = 0.55 + 0.45 * cos(6.28318 * (vUv.y * 0.7 - uTime * 0.08 + vec3(0.0, 0.33, 0.67)));
        float a = (0.25 + 1.4 * streak) * pow(face, 1.5) * smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        gl_FragColor = vec4(mix(vec3(0.75, 0.95, 1.0), c, 0.6) * a * 0.55, 1.0); }`,
  }));
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 3; root.add(m); return m;
}
