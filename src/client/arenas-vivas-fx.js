// ARENAS VIVAS (cliente): dibuja los órganos del organismo de cada arena y sus avisos. La simulación está en src/sim/arenas-vivas.js
// (docs/MUNDO_VIVO.md → «Arenas vivas»). Sólo LEE `state.ar`; la disposición (dónde está cada órgano) sale de layoutArena(mapa).
// PSICODELIA FLASHERA PERO LEGIBLE: todo es autoiluminado (nunca queda una zona oscura), los beneficios son anillos suaves que suben y
// las amenazas son franjas de peligro con borde blanco que se llena hasta el golpe (el mismo lenguaje en las 6 arenas; lo que cambia es
// el color y la silueta). Presupuesto: un cuerpo + un halo + una marca de suelo por órgano (≈ 9 llamadas) y hasta 3 avisos.
// Latido sincronizado con la fase: dormido lento y tenue · despierto normal · furioso rápido y brillante · ofrenda cálido y lento.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { uTime, finish, screenColor } from './shaders.js';
import { MAPS } from '../sim/maps.js';
import { layoutArena } from '../sim/arenas-vivas.js';
import { ARENAS_VIVAS } from '../sim/data.js';

const hex = (s) => parseInt(s.slice(1), 16);
/** Color de ayuda y de amenaza de cada arena (de su paleta de identidad; ver docs/MAPAS.md). */
const PAL = {
  m1: { ay: '#19f0ff', am: '#ff3df2' }, m2: { ay: '#9b5cff', am: '#ffb52e' }, m3: { ay: '#3dffb8', am: '#e8fbff' },
  m4: { ay: '#b6ff2a', am: '#ff2f5e' }, m5: { ay: '#ffcf4a', am: '#5b8bff' }, m6: { ay: '#efe6c8', am: '#ff6a14' },
};
const BEAT = { dormido: 0.5, despierto: 1.0, furioso: 1.9, ofrenda: 0.75 };      // latidos por segundo
const FASE = { dormido: 0.35, despierto: 0.7, furioso: 1.0, ofrenda: 0.85 };    // intensidad del brillo
const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), MB = new THREE.Matrix4();

/* ───────── geometría: piezas fusionadas con atributos aK (mezcla de color 0-1), aG (cuánto late/brilla) y aS (cuelga y se balancea) ───────── */
function part(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], k = 0, g = 0.5, sw = 0 } = {}) {
  let q = geo.index ? geo.toNonIndexed() : geo.clone();
  q.deleteAttribute('uv'); q.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));
  const n = q.attributes.position.count;
  q.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(n).fill(k), 1)); q.setAttribute('aG', new THREE.BufferAttribute(new Float32Array(n).fill(g), 1)); q.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(n).fill(sw), 1));
  return q;
}
const S_ = (r, w = 14, h = 9) => new THREE.SphereGeometry(r, w, h), CY = (a, b, h, n = 8, o = false) => new THREE.CylinderGeometry(a, b, h, n, 1, o), CO = (r, h, n = 6) => new THREE.ConeGeometry(r, h, n);
const TO = (R, t, n = 6, m = 20, arc = Math.PI * 2) => new THREE.TorusGeometry(R, t, n, m, arc), OC = (r) => new THREE.OctahedronGeometry(r, 0), BX = (a, b, c) => new THREE.BoxGeometry(a, b, c);
const ring = (n, f) => Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2, i));

/** Cuerpo de cada órgano según la silueta de su arena (iconografía). El origen es el centro del cuerpo golpeable. */
function cuerpo(motivo, o) {
  const r = o.hr, P = [];
  if (o.k === 'corazon') {
    if (motivo === 'medusa') { // campana de medusa con zarcillos y anillos de luz
      P.push(part(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, 0.1 * r, 0], s: [1.15, 0.9, 1.15], k: 0.1, g: 0.6 }));
      P.push(part(TO(r * 1.05, 0.07, 5, 28), { r: [Math.PI / 2, 0, 0], p: [0, 0.1 * r, 0], k: 1, g: 1 }), part(TO(r * 0.7, 0.06, 5, 24), { r: [Math.PI / 2, 0, 0], p: [0, 0.55 * r, 0], k: 1, g: 1 }));
      P.push(part(new THREE.IcosahedronGeometry(r * 0.42, 0), { p: [0, 0.2 * r, 0], k: 1, g: 1 }));
      P.push(...ring(9, (a, i) => part(CY(0.07, 0.02, r * (1.3 + (i % 3) * 0.35), 5), { p: [Math.cos(a) * r * 1.0, -r * (0.55 + (i % 3) * 0.17), Math.sin(a) * r * 1.0], r: [Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2], k: (i % 2), g: 0.8 })));
    } else if (motivo === 'iris') { // espejo facetado con satélites
      P.push(part(OC(r * 0.95), { s: [1, 1.3, 1], k: 0.1, g: 0.7 }), part(OC(r * 0.45), { k: 1, g: 1 }));
      P.push(...ring(6, (a, i) => part(OC(r * 0.3), { p: [Math.cos(a) * r * 1.6, Math.sin(a * 2) * r * 0.3, Math.sin(a) * r * 1.6], k: i % 2, g: 0.9 })));
      P.push(part(TO(r * 1.6, 0.05, 4, 40), { r: [Math.PI / 2, 0, 0], k: 1, g: 0.9 }));
    } else if (motivo === 'ondas') { // garganta con anillos de sonido
      P.push(part(CY(r * 0.45, r * 0.6, r * 1.9, 10, true), { k: 0, g: 0.6 }), part(CO(r * 0.5, r * 1.1, 8), { p: [0, r * 1.45, 0], k: 0.5, g: 0.9 }));
      P.push(...[-0.7, 0, 0.7].map((y, i) => part(TO(r * (1.05 + i * 0.28), 0.07, 5, 30), { r: [Math.PI / 2, 0, 0], p: [0, y * r, 0], k: 1, g: 1 })));
      P.push(part(S_(r * 0.35), { k: 1, g: 1 }));
    } else if (motivo === 'corazon') { // corazón anatómico con vasos y raíces
      P.push(part(S_(r * 0.95, 14, 10), { s: [1, 1.1, 0.95], k: 0, g: 0.8 }), part(S_(r * 0.62), { p: [r * 0.7, r * 0.55, 0.1 * r], k: 0.2, g: 0.8 }), part(S_(r * 0.55), { p: [-r * 0.65, r * 0.6, -0.1 * r], k: 0.3, g: 0.8 }));
      P.push(part(S_(r * 0.4), { p: [0, 0, r * 0.45], k: 1, g: 1 }));
      P.push(...ring(4, (a) => part(TO(r * 0.5, 0.13, 5, 10, Math.PI), { p: [Math.cos(a) * r * 0.5, r * 0.95, Math.sin(a) * r * 0.5], r: [0, -a, 0], k: 0.6, g: 0.6 })));
      P.push(...ring(5, (a, i) => part(CY(0.16, 0.04, r * 1.6, 5), { p: [Math.cos(a) * r * 0.7, -r * 1.1, Math.sin(a) * r * 0.7], r: [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35], k: 0.3 + 0.1 * i, g: 0.5 })));
    } else if (motivo === 'reloj') { // esfera de reloj con péndulo
      P.push(part(CY(r * 1.25, r * 1.25, 0.16, 28), { r: [Math.PI / 2, 0, 0], p: [0, r * 0.7, 0], k: 0, g: 0.5 }), part(TO(r * 1.25, 0.08, 5, 28), { p: [0, r * 0.7, 0], k: 1, g: 1 }));
      P.push(...ring(12, (a, i) => part(BX(0.1, i % 3 === 0 ? 0.45 : 0.25, 0.12), { p: [Math.sin(a) * r * 1.05, r * 0.7 + Math.cos(a) * r * 1.05, 0.1], r: [0, 0, -a], k: 1, g: 0.8 })));
      P.push(part(BX(0.12, r * 0.9, 0.1), { p: [0, r * 0.7 + r * 0.4, 0.1], k: 1, g: 0.8 }), part(BX(r * 0.7, 0.12, 0.1), { p: [r * 0.3, r * 0.7, 0.1], k: 0.5, g: 0.8 }));
      P.push(part(CY(0.06, 0.06, r * 1.7, 5), { p: [0, -r * 0.2, 0], k: 0.4, g: 1, sw: 1 }), part(S_(r * 0.55, 14, 8), { p: [0, -r * 1.05, 0], s: [1, 0.55, 0.5], k: 1, g: 1, sw: 1 }));
    } else { // costilla: jaula de costillas con un corazón encendido
      P.push(part(S_(r * 0.5, 12, 8), { k: 1, g: 1 }));
      P.push(...ring(6, (a) => part(TO(r * 1.05, 0.11, 5, 14, Math.PI), { r: [0, a, 0], s: [1, 1.15, 1], p: [0, -r * 0.1, 0], k: 0, g: 0.3 })));
      P.push(...ring(6, (a) => part(CY(0.11, 0.07, r * 0.9, 5), { p: [Math.cos(a) * r * 0.55, -r * 1.2, Math.sin(a) * r * 0.55], k: 0, g: 0.2 })));
    }
  } else if (o.k === 'boca') { // sale del suelo (y local = 0 es el piso: se baja medio cuerpo)
    if (motivo === 'medusa') P.push(part(CY(0.1, 0.2, 1.8, 6), { p: [0, 0.9, 0], k: 0, g: 0.4 }), part(S_(0.6, 14, 10), { p: [0, 2.0, 0], k: 1, g: 1 }), ...ring(5, (a) => part(CO(0.18, 1.1, 5), { p: [Math.cos(a) * 0.5, 0.45, Math.sin(a) * 0.5], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], k: 0.6, g: 0.5 })));
    else if (motivo === 'iris') P.push(...ring(6, (a, i) => part(BX(0.32, 1.9, 0.32), { p: [Math.cos(a) * 1.15, 0.95, Math.sin(a) * 1.15], r: [Math.sin(a) * 0.3, -a, -Math.cos(a) * 0.3], k: i % 2, g: 0.7 })), part(OC(0.55), { p: [0, 1.4, 0], k: 1, g: 1 }));
    else P.push(...[0.9, 1.5, 2.2, 1.7, 1.1, 1.9, 1.3].map((h, i) => part(CY(0.16, 0.2, h, 7), { p: [Math.cos(i * 0.8 - 1.2) * 1.0, h / 2, Math.sin(i * 0.8 - 1.2) * 1.0], k: i / 6, g: 0.8 })));
  } else if (o.k === 'raiz') {
    if (motivo === 'ondas') P.push(part(CY(0.35, 0.55, 2.4, 8), { p: [0, -0.2, 0], k: 0, g: 0.5 }), part(CY(0.5, 1.15, 1.0, 10, true), { p: [0, 1.0, 0.5], r: [1.1, 0, 0], k: 0.6, g: 1 }), part(TO(0.7, 0.07, 5, 20), { p: [0, 1.0, 0.5], r: [1.1, 0, 0], k: 1, g: 1 }));
    else if (motivo === 'reloj') P.push(part(CY(0.8, 0.8, 0.2, 14), { r: [Math.PI / 2, 0, 0], k: 0.2, g: 0.5 }), part(BX(1.4 * 2.1, 0.2, 0.5), { p: [1.4 * 0.55, 0, 0], k: 1, g: 1 }), part(S_(0.5, 10, 6), { p: [-1.4 * 0.6, 0, 0], k: 0.5, g: 0.7 }), part(BX(0.5, 0.2, 0.2), { p: [0, 0, 0], k: 1, g: 1 }));
    else { // raíz que se curva con garras
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -1.6, 0), new THREE.Vector3(0.5, -0.5, 0.2), new THREE.Vector3(0.1, 0.5, -0.3), new THREE.Vector3(-0.6, 1.2, 0)]);
      P.push(part(new THREE.TubeGeometry(curve, 12, 0.42, 6), { k: 0.2, g: 0.6 }), ...ring(3, (a) => part(CO(0.16, 0.8, 4), { p: [-0.6 + Math.cos(a) * 0.35, 1.5, Math.sin(a) * 0.35], r: [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], k: 1, g: 1 })));
    }
  } else if (o.k === 'pulmon') {
    if (motivo === 'iris') P.push(part(S_(1.0, 12, 8), { p: [0, 0.2, 0], s: [1, 0.8, 1], k: 0, g: 1 }), ...[0, 1, 2, 3].map((i) => part(TO(1.0 - i * 0.12, 0.09, 5, 20), { r: [Math.PI / 2, 0, 0], p: [0, 1.1 + i * 0.28, 0], k: 1, g: 1 })), part(OC(0.45), { p: [0, 0.2, 0], k: 1, g: 1 }));
    else if (motivo === 'corazon') P.push(...[[0, 0.3, 0, 0.9], [0.8, 0.1, 0.2, 0.65], [-0.7, 0.2, -0.3, 0.7], [0.1, 0.9, 0.5, 0.5], [-0.2, 0.0, 0.8, 0.5]].map(([x, y, z, rr], i) => part(S_(rr, 10, 7), { p: [x, y, z], k: 0.3 + i * 0.15, g: 1 })), part(CY(0.2, 0.3, 1.2, 6), { p: [0, -0.6, 0], k: 0, g: 0.4 }));
    else P.push(...ring(10, (a, i) => part(CO(0.26, 1.3, 4), { p: [Math.cos(a) * 1.1, 0.5, Math.sin(a) * 1.1], r: [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35], k: i % 2 ? 0 : 0.2, g: 0.4 })), part(new THREE.CircleGeometry(1.0, 12), { r: [-Math.PI / 2, 0, 0], p: [0, 0.1, 0], k: 1, g: 1 }), part(S_(0.5, 8, 6), { p: [0, 0.4, 0], k: 1, g: 1 }));
  } else if (o.k === 'vena') { // dos pilares de luz en los extremos
    P.push(part(CO(0.35, 2.0, 4), { p: [0, 1.0, 0], k: 1, g: 1 }), part(TO(0.7, 0.07, 5, 18), { r: [Math.PI / 2, 0, 0], p: [0, 0.15, 0], k: 0.4, g: 1 }));
  }
  return mergeGeometries(P);
}

/* ───────── materiales ───────── */
const VERT_BODY = `
  attribute float aK; attribute float aG; attribute float aS;
  uniform float uBeat, uBr, uSwing, uCharge, uPivot; varying vec3 vN; varying vec3 vV; varying float vK; varying float vG;
  void main(){
    vec3 p = position;
    if (aS > 0.5) { float a = uSwing; float c = cos(a), s = sin(a); vec2 q = vec2(p.x, p.y - uPivot); p.x = q.x * c - q.y * s; p.y = uPivot + q.x * s + q.y * c; }
    float br = 1.0 + 0.07 * uBeat * aG + 0.22 * uBr * aG - 0.1 * uCharge;
    p *= br; vK = aK; vG = aG; vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(p, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv;
  }`;
function bodyMat(c1, c2) {
  return finish(new THREE.ShaderMaterial({
    uniforms: { uTime, uC1: { value: screenColor(hex(c1)) }, uC2: { value: screenColor(hex(c2)) }, uBeat: { value: 0 }, uBr: { value: 0 }, uSwing: { value: 0 }, uPivot: { value: 1.4 }, uCharge: { value: 0 }, uFase: { value: 0.7 }, uHurt: { value: 0 }, uRoto: { value: 0 } },
    vertexShader: VERT_BODY,
    fragmentShader: `uniform vec3 uC1, uC2; uniform float uBeat, uFase, uHurt, uRoto, uCharge, uTime; varying vec3 vN; varying vec3 vV; varying float vK; varying float vG;
      void main(){
        vec3 n = normalize(vN); float f = pow(1.0 - abs(dot(n, normalize(vV))), 2.2);
        float lam = 0.55 + 0.45 * dot(n, normalize(vec3(0.4, 0.8, 0.3)));
        vec3 base = mix(uC1, uC2, vK + 0.15 * sin(uTime * 2.0 + vK * 6.0));
        vec3 col = base * (0.28 + 0.5 * lam) * (0.6 + 0.55 * uFase);
        col += base * uBeat * (0.12 + 0.45 * vG) * uFase + uC2 * f * (0.3 + 0.35 * uFase) + vec3(1.0) * (uCharge * 0.3 * (0.75 + 0.25 * sin(uTime * 4.0)) + uHurt * 0.5);
        col += uC2 * vG * 0.14 * pow(0.5 + 0.5 * sin(vK * 18.0 - uTime * 2.0), 5.0) * uFase;
        float gris = dot(col, vec3(0.33)); col = mix(col, vec3(gris * 0.9 + 0.12), uRoto * 0.85);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}
const VERT_UV = `varying vec2 vUv; varying vec3 vP; attribute float aT; varying float vT; void main(){ vUv = uv; vT = aT; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const HAZARD = `float hz(vec2 p, float t){ return smoothstep(0.42, 0.5, fract((p.x + p.y) * 5.0 - t * 0.6)); }`;
/** Marca de suelo + haz de luz de una boca (ayuda) o de un pulmón (nube que sana / envenena). */
function zonaMat(ay, am) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime, uAy: { value: screenColor(hex(ay)) }, uAm: { value: screenColor(hex(am)) }, uAct: { value: 0 }, uFill: { value: 0 }, uTox: { value: 0 }, uWarn: { value: 0 }, uDens: { value: 0 } },
    vertexShader: VERT_UV,
    fragmentShader: `uniform float uTime, uAct, uFill, uTox, uWarn, uDens; uniform vec3 uAy, uAm; varying vec2 vUv; varying vec3 vP; varying float vT; ${HAZARD}
      void main(){
        vec3 colA = mix(uAy, uAm, uTox);
        if (vT > 0.5 && vT < 1.5) { // haz de luz (pared del cilindro): faro que se ve de lejos
          float up = vUv.y, st = 0.5 + 0.5 * sin(vUv.x * 40.0 + uTime * 2.0 - up * 9.0);
          gl_FragColor = vec4(colA * (0.5 + st), uAct * (1.0 - up) * (0.05 + 0.2 * st)); return;
        }
        if (vT > 1.5) { // nube (media esfera): remolinos suaves; con veneno, franjas de peligro
          float sw = 0.5 + 0.5 * sin(vP.x * 5.0 + vP.y * 7.0 - uTime * 1.4 + sin(vP.z * 4.0 + uTime * 0.7) * 2.0);
          float h = hz(vP.xz * 2.0 + vP.y, uTime) * uTox;
          gl_FragColor = vec4(colA * (0.55 + 0.7 * sw + 0.5 * h), uDens * (0.04 + 0.11 * sw + 0.09 * h) * (gl_FrontFacing ? 1.0 : 0.4)); return;   // desde adentro de la nube se ve más ligera
        }
        vec2 p = (vUv - 0.5) * 2.0; float r = length(p), a = atan(p.y, p.x);
        float edge = smoothstep(0.07, 0.0, abs(r - 0.94)), disc = smoothstep(1.0, 0.0, r);
        float rings = smoothstep(0.08, 0.0, abs(fract(r * 2.5 - uTime * (0.25 + 0.4 * uAct)) - 0.5) - 0.40) * smoothstep(1.0, 0.2, r);
        float ang = fract((a + 1.5708) / 6.28318), arc = step(ang, uFill) * smoothstep(0.05, 0.0, abs(r - 0.8) - 0.03);
        float dash = step(0.5, fract(a * 4.0 + uTime * 0.5));
        float warn = uWarn * hz(p, uTime * 3.0) * smoothstep(1.0, 0.85, r) * (0.5 + 0.5 * sin(uTime * 12.0));
        vec3 col = colA * (0.5 + 0.9 * rings + 1.1 * edge) + vec3(1.0) * arc * 0.5;
        float al = uAct * (0.10 * disc + 0.24 * rings + 0.38 * edge) + (1.0 - uAct) * (0.04 * disc + 0.28 * edge * (0.4 + 0.6 * dash)) + arc * 0.75 + warn * 0.35;
        gl_FragColor = vec4(col, al * smoothstep(1.0, 0.92, r));
      }`,
  }));
}
/** Cinta de un carril de luz: chevrones que corren de A hacia B. */
function venaMat(ay) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime, uAy: { value: screenColor(hex(ay)) }, uAct: { value: 0.7 }, uLen: { value: 10 } },
    vertexShader: VERT_UV,
    fragmentShader: `uniform float uTime, uAct, uLen; uniform vec3 uAy; varying vec2 vUv;
      void main(){
        float x = (vUv.y - 0.5) * 2.0, y = vUv.x * uLen; // x a lo ancho, y a lo largo
        float chev = smoothstep(0.30, 0.0, abs(fract(y * 0.28 - uTime * 0.9 + abs(x) * 0.25) - 0.5) - 0.16);
        float edge = smoothstep(0.1, 0.0, abs(abs(x) - 0.93));
        gl_FragColor = vec4(uAy * (0.6 + 1.2 * chev + 0.9 * edge), uAct * (0.10 + 0.5 * chev + 0.45 * edge));
      }`,
  }));
}
/** Aviso de ataque: franjas de peligro con borde blanco que se llena hasta el golpe. kind 0 = círculo, 1 = línea (largo × ancho). */
function avisoMat(am) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime, uAm: { value: screenColor(hex(am)) }, uK: { value: 0 }, uKind: { value: 0 }, uSw: { value: 0 } },
    vertexShader: VERT_UV,
    fragmentShader: `uniform float uTime, uK, uKind, uSw; uniform vec3 uAm; varying vec2 vUv; ${HAZARD}
      void main(){
        vec2 p = (vUv - 0.5) * 2.0; float r = length(p), across = abs(p.y), along = vUv.x;
        float fill = uKind < 0.5 ? smoothstep(uK + 0.02, uK - 0.02, r) : smoothstep(uK + 0.02, uK - 0.02, along);
        float edge = uKind < 0.5 ? smoothstep(0.06, 0.0, abs(r - 0.95)) : smoothstep(0.1, 0.0, abs(across - 0.9));
        float st = hz(uKind < 0.5 ? p : vec2(vUv.x * 8.0, p.y), uTime * (1.0 + 4.0 * uK));
        float hot = 0.5 + 0.5 * sin(uTime * (8.0 + 22.0 * uK));
        vec3 bright = mix(uAm, vec3(1.0), 0.35 + 0.4 * hot * uK), dark = uAm * 0.18;
        vec3 col = mix(dark, bright, st);
        float inside = uKind < 0.5 ? smoothstep(1.0, 0.94, r) : smoothstep(1.0, 0.94, across);
        float al = inside * (0.22 + 0.5 * fill) + edge * (0.55 + 0.4 * hot);
        if (uSw > 0.5) { col = mix(col, vec3(1.0), 0.45); al = max(al, inside * 0.75); }
        gl_FragColor = vec4(mix(col, vec3(1.0), edge * 0.8), clamp(al, 0.0, 0.92));
      }`,
  }));
}

/* ───────── el efecto ───────── */
export class ArenasVivasFx {
  constructor(renderer) {
    this.r = renderer; this.root = new THREE.Group(); this.root.name = 'arenas-vivas'; renderer.scene.add(this.root);
    this.mapId = null; this.items = []; this.avisos = []; this.t = 0; this.beatPh = 0; this.prevTl = []; this.flash = [];
  }
  dispose() {
    for (const c of [...this.root.children]) { this.root.remove(c); c.traverse((o) => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose && o.material.dispose(); }); }
    this.items = []; this.avisos = []; this.mapId = null;
  }
  build(mapId) {
    this.dispose(); this.mapId = mapId;
    const map = MAPS[mapId], L = map && layoutArena(map); if (!L) return;
    const def = L.def, pal = PAL[mapId], k = map.R ? 1 / (2 * map.R) : 0;
    this.pal = pal; this.def = def; this.L = L;
    for (const o of L.org) {
      const g = new THREE.Group(); g.quaternion.copy(_q.setFromUnitVectors(Y, _v.set(o.u.x, o.u.y, o.u.z)));
      const it = { o, g, kind: o.k };
      if (o.k !== 'vena') {
        const body = new THREE.Mesh(cuerpo(def.motivo, o), bodyMat(def.color, def.color2));
        body.position.y = o.k === 'corazon' || o.k === 'raiz' ? (o.h || 1.4) : 0; it.esc = o.k === 'raiz' ? 1.6 : o.k === 'boca' || o.k === 'pulmon' ? 1.3 : 1; it.body = body; g.add(body);   // corazón y raíz: centrados en su esfera golpeable; boca y pulmón: apoyados en el piso
        body.material.uniforms.uPivot.value = o.hr * 0.65;   // el péndulo cuelga del centro de la esfera de reloj
        const halo = new THREE.Sprite(this.r.halo_(hex(def.color2)).clone());
        halo.material.opacity = 0.7; halo.position.y = o.k === 'boca' || o.k === 'pulmon' ? 1.2 : body.position.y; halo.scale.setScalar(o.hr * 2.6); halo.renderOrder = 3; it.halo = halo; g.add(halo);
      }
      if (o.k === 'boca' || o.k === 'pulmon') { // marca de suelo + faro (boca) o nube (pulmón)
        const R = o.r, parts = [];
        const disc = new THREE.CircleGeometry(1, 40); disc.rotateX(-Math.PI / 2); if (k) { const pos = disc.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, k * R * (x * x + z * z)); } }   // en la esfera de m2 el suelo se curva hacia arriba: el disco lo sigue
        disc.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(disc.attributes.position.count).fill(0), 1)); parts.push(disc);
        if (o.k === 'boca') { const wall = new THREE.CylinderGeometry(1, 1, 2.6 / R, 36, 1, true); wall.translate(0, 1.3 / R, 0); wall.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(wall.attributes.position.count).fill(1), 1)); parts.push(wall); }
        else { const dome = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); dome.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(dome.attributes.position.count).fill(2), 1)); parts.push(dome); it.domeStart = disc.attributes.position.count; }
        const m = new THREE.Mesh(mergeGeometries(parts.map((p) => p.toNonIndexed())), zonaMat(pal.ay, pal.am));
        m.position.y = 0.08; m.scale.setScalar(R); m.renderOrder = 2; it.zona = m; g.add(m);
      }
      if (o.k === 'vena') { // cinta + dos pilares
        const w = o.w, L2 = o.L, geo = new THREE.PlaneGeometry(L2, w); geo.rotateX(-Math.PI / 2);
        geo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(0), 1));
        const mat = venaMat(pal.ay); mat.uniforms.uLen.value = L2; const cinta = new THREE.Mesh(geo, mat); cinta.renderOrder = 2; it.zona = cinta;
        const dir = new THREE.Vector3(o.B.x - o.A.x, 0, o.B.z - o.A.z).normalize(); cinta.rotation.y = Math.atan2(-dir.z, dir.x); cinta.position.y = 0.08;
        const pil = new THREE.Mesh(cuerpo(def.motivo, o), bodyMat(def.color, def.color2)); const pil2 = pil.clone(); pil.position.set(o.A.x - o.pos.x, 0, o.A.z - o.pos.z); pil2.position.set(o.B.x - o.pos.x, 0, o.B.z - o.pos.z); it.pil = [pil, pil2];
        g.add(cinta, pil, pil2);
      }
      g.position.set(o.pos.x, o.pos.y, o.pos.z); this.root.add(g); this.items.push(it);
    }
    for (let i = 0; i < 3; i++) { // avisos (pool)
      const c = new THREE.Mesh(new THREE.CircleGeometry(1, 48), avisoMat(pal.am)); c.geometry.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(c.geometry.attributes.position.count), 1));
      const l = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), avisoMat(pal.am)); l.geometry.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(4), 1)); l.material.uniforms.uKind.value = 1;
      for (const m of [c, l]) { m.visible = false; m.renderOrder = 4; this.root.add(m); }
      this.avisos.push({ c, l });
    }
  }
  update(dt, state) {
    const ar = state && state.ar, mapId = state && state.map;
    if (mapId !== this.mapId) this.build(mapId);
    if (!ar || !this.L) { this.root.visible = false; return; }
    this.root.visible = true; this.t += dt;
    const ph = ar.ph, hz = BEAT[ph] || 1;
    this.beatPh = (this.beatPh + dt * hz) % 1; const bp = this.beatPh, beat = Math.exp(-((bp * 9) ** 2)) + 0.6 * Math.exp(-(((bp - 0.28) * 9) ** 2));
    const fase = FASE[ph] || 0.7;
    // los avisos que acaban de desaparecer = golpe: destello breve del órgano
    const tl = ar.tl || [];
    for (const p of this.prevTl) if (!tl.some((q) => q[0] === p[0])) this.flash[p[0]] = 1;
    this.prevTl = tl;
    this.items.forEach((it, i) => {
      const s = ar.o[i]; if (!s) return;
      const [hp, roto, fed, zona, br, modo, golpe] = s, o = it.o;
      this.flash[i] = Math.max(0, (this.flash[i] || 0) - dt * 3);
      const cargando = tl.find((q) => q[0] === i), carga = cargando ? 1 - cargando[10] / Math.max(0.01, cargando[11]) : 0;
      if (it.body) {
        const U = it.body.material.uniforms; U.uBeat.value = roto ? 0 : beat; U.uFase.value = roto ? 0.3 : fase; U.uRoto.value = roto; U.uCharge.value = Math.max(carga, this.flash[i] * 0.6);
        U.uHurt.value = golpe ? 1 : Math.max(0, U.uHurt.value - dt * 6); U.uBr.value = o.k === 'pulmon' ? br : 0; U.uSwing.value = Math.sin(this.t * hz * 3.14159) * 0.55 * (roto ? 0 : 1);
        const sc = (roto ? 0.7 : 1 + 0.03 * beat) * it.esc; it.body.scale.setScalar(sc);
        if (o.k === 'corazon' && this.def.motivo !== 'reloj') { it.body.rotation.y += dt * (0.25 + 0.4 * (ph === 'furioso')); it.body.position.y = o.h + Math.sin(this.t * 1.3 + i) * 0.18; }
        if (o.k === 'raiz' && cargando && cargando[1] >= 2) it.body.rotation.y = this.def.motivo === 'reloj' ? Math.atan2(-cargando[7], cargando[5]) : Math.atan2(cargando[5], cargando[7]);   // la manecilla / la trompeta apuntan al aviso
        else if (o.k === 'raiz' && !roto && o.atk && o.atk.tipo === 'giro') it.body.rotation.y += dt * 0.3;
        if (it.halo) it.halo.material.opacity = roto ? 0.12 : (0.18 + 0.3 * beat) * (0.5 + 0.6 * fase) + this.flash[i] * 0.4;
      }
      if (it.zona && o.k === 'boca') { const U = it.zona.material.uniforms; U.uAct.value += ((zona > 0 ? 1 : 0) - U.uAct.value) * Math.min(1, dt * 4); U.uFill.value = fed / 100; }
      if (it.zona && o.k === 'pulmon') {
        const U = it.zona.material.uniforms, tox = ph === 'furioso' && !ar.sed && !roto ? 1 : 0, exh = modo === 2 && !roto;
        U.uTox.value += (tox - U.uTox.value) * Math.min(1, dt * 5);
        U.uDens.value = exh ? br : (modo === 1 && !roto ? 0.35 : 0); U.uWarn.value = tox && modo === 1 ? 1 : 0; U.uAct.value = exh ? 0.8 : 0.25; U.uFill.value = 0;
        it.zona.scale.set(o.r, o.r * (exh ? 1 : 0.35 + 0.65 * (modo === 0 ? br : 1)), o.r);
      }
      if (it.zona && o.k === 'vena') it.zona.material.uniforms.uAct.value = 0.35 + 0.65 * Math.min(1, (ph === 'ofrenda' ? 1.5 : ph === 'dormido' ? 0.4 : ph === 'furioso' ? 0.75 : 1));
    });
    // avisos
    const used = [0, 0];
    for (const T of tl) {
      const o = this.L.org[T[0]], kind = T[1], line = kind >= 2, slot = this.avisos[used[0] + used[1]]; if (!slot) break;
      const m = line ? slot.l : slot.c, other = line ? slot.c : slot.l; other.visible = false; used[line ? 1 : 0]++;
      const [, , cx, cy, cz, dx, dy, dz, rr, w, left, total, sw] = T, k = sw ? 1 : 1 - Math.min(1, left / Math.max(0.01, total));
      m.visible = true; m.material.uniforms.uK.value = k; m.material.uniforms.uSw.value = sw;
      const up = new THREE.Vector3(o.u.x, o.u.y, o.u.z);
      if (!line) { m.position.set(cx, cy, cz).addScaledVector(up, 0.12); m.quaternion.setFromUnitVectors(Z, up); m.scale.setScalar(rr); }
      else { // línea: eje local X = dirección, Y = a lo ancho, Z = arriba
        const d = new THREE.Vector3(dx, dy, dz).normalize(), across = new THREE.Vector3().crossVectors(up, d).normalize();
        m.position.set(cx, cy, cz).addScaledVector(up, 0.12).addScaledVector(d, rr / 2);
        m.quaternion.setFromRotationMatrix(MB.makeBasis(d, across, up)); m.scale.set(Math.max(0.1, rr), w, 1);
      }
    }
    for (let i = used[0] + used[1]; i < 3; i++) { this.avisos[i].c.visible = false; this.avisos[i].l.visible = false; }
  }
}
