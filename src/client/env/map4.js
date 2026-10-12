import * as THREE from 'three';
import { cfg } from '../quality.js';
import { uTime, finish } from '../shaders.js';
import { NOISE } from './glsl.js';
import { rng } from './noise.js';
import { trackPx, particleGeo, particleMat, crystalGeo } from './props.js';
import { addCosmicEyes } from './eyes.js';
import { M4U, beatAt } from './map4-state.js';

// Entorno del Mapa 4 · JARDÍN DE CARNE.
// Un planeta orgánico hecho de plataformas de tejido vivo (ver src/sim/map4.js: todo lo que se pisa es un DISCO, y aquí se dibuja
// EXACTAMENTE sobre esos mismos discos). Qué hay y cómo se mantiene barato (todo instanciado, sin PointLights en Baja):
//   · suelo: 2 mallas instanciadas (plataformas grandes / discos de rampas y puentes) con un shader de tejido: carne, venas que
//     laten desde el Corazón (uBeat) y se encienden cerca del jugador (uPlayer), caminos más claros que las plataformas;
//   · el puente del acertijo: sus discos están en la misma malla y NACEN por uniforme (uSecN) + un «fantasma» aditivo que avisa dónde;
//   · raíces nerviosas (colgando bajo los bordes) y tallos nerviosos (sobre el suelo): se retraen y brillan cerca del jugador (uniformes);
//   · hongos y cristales bioluminiscentes, columnas-nervio, quistes, la grada con el Corazón latiendo;
//   · membranas translúcidas (cortinas y vesículas), bancos de niebla bajo las plataformas, planetas de carne lejanos, cielo propio.
// Paleta: rojos profundos / magentas / verde ácido. Legibilidad: plataformas rojo carne, caminos salmón claro, vacío = niebla oscura.

export const M4V = { sunDir: new THREE.Vector3(0.35, 0.8, -0.45).normalize(), fog: new THREE.Color(0.20, 0.035, 0.16), fogD: 0.000052 };

/** Lathe con las normales hacia afuera (si salieron al revés, se invierte el perfil). */
function lathe(points, seg, upCheck = true) {
  const mk = (pts) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  let g = mk(points);
  const pos = g.attributes.position, nor = g.attributes.normal; let hi = -1;
  for (let i = 0; i < pos.count; i++) if (Math.hypot(pos.getX(i), pos.getZ(i)) > 0.3 && (hi < 0 || pos.getY(i) > pos.getY(hi) + 1e-6)) hi = i;
  const out = new THREE.Vector3(pos.getX(hi), 0, pos.getZ(hi)).normalize();
  const dot = nor.getX(hi) * out.x + nor.getZ(hi) * out.z;
  if (upCheck && dot < 0) { g.dispose(); g = mk([...points].reverse()); }
  g.deleteAttribute('uv'); return g;
}
const discBig = () => lathe([[0.0, 0.03], [0.86, 0.0], [1.0, -0.16], [1.02, -0.8], [0.93, -2.2], [0.72, -4.6], [0.44, -8.0], [0.17, -11.5], [0.0, -13.8]], 24);
const discSmall = () => lathe([[0.0, 0.03], [0.84, 0.0], [1.0, -0.14], [0.96, -0.9], [0.7, -2.3], [0.36, -4.0], [0.0, -5.4]], 9);
const pillarGeo = () => lathe([[1.5, 0.0], [1.15, 0.1], [0.85, 0.35], [0.8, 0.6], [0.95, 0.82], [0.7, 0.93], [0.0, 1.0]], 10);
const domeGeo = () => lathe([[1.05, 0.0], [1.02, 0.12], [0.92, 0.5], [0.7, 0.82], [0.35, 0.97], [0.0, 1.0]], 12);
const fungiGeo = () => lathe([[0.0, 0.0], [0.11, 0.0], [0.07, 0.2], [0.07, 0.42], [0.5, 0.46], [0.58, 0.56], [0.4, 0.74], [0.0, 0.82]], 6, false);
/** Tentáculo: base en y=0, punta en y=1 (radio 1 → ~0), curvado en x. */
function tendrilGeo() {
  const rings = 5, seg = 5, pos = [], idx = [];
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1), rad = Math.pow(1 - t, 0.9) + 0.09, ox = 0.55 * t * t;
    for (let j = 0; j < seg; j++) { const a = (j / seg) * Math.PI * 2; pos.push(Math.cos(a) * rad + ox, t, Math.sin(a) * rad); }
  }
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + (j + 1) % seg, c = a + seg, d = b + seg; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/* ───────── shaders ───────── */
const FOG = `uniform vec3 uFog; uniform float uFogD;`;
const fogMix = `float f = 1.0 - exp(-dist * dist * uFogD); col = mix(col, uFog, f);`;

function tissueMaterial(U, full) {
  return finish(new THREE.ShaderMaterial({
    defines: { FBM_OCT: full ? 3 : 2 },
    uniforms: { uTime, uPlayer: M4U.uPlayer, uBeat: M4U.uBeat, uSecN: M4U.uSecN, uSunL: { value: M4V.sunDir.clone() }, uFog: { value: M4V.fog }, uFogD: { value: M4V.fogD } },
    vertexShader: `uniform vec3 uSecN; uniform float uBeat; attribute vec4 aInfo;
      varying vec3 vWP; varying vec3 vN; varying vec3 vLP; varying vec4 vInfo; varying float vGrow;
      void main(){
        vec3 pos = position; vInfo = aInfo; vGrow = 1.0; vLP = position;
        if (aInfo.x > 1.5 && aInfo.x < 2.5) {              // disco del puente: nace cuando su tramo crece
          float sN = aInfo.z < 0.5 ? uSecN.x : (aInfo.z < 1.5 ? uSecN.y : uSecN.z);
          float g = clamp(sN - aInfo.w, 0.0, 1.0); vGrow = g;
          float e = g * g * (3.0 - 2.0 * g) * (1.0 + 0.18 * sin(g * 3.14159)); pos.xz *= e; pos.y *= (0.3 + 0.7 * e);
        }
        if (aInfo.x > 5.5 && aInfo.x < 6.5) pos *= 1.0 + 0.11 * uBeat;   // el Corazón late
        vec4 w = modelMatrix * instanceMatrix * vec4(pos, 1.0); vWP = w.xyz;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uBeat; uniform vec3 uPlayer, uSunL; ${FOG}
      varying vec3 vWP; varying vec3 vN; varying vec3 vLP; varying vec4 vInfo; varying float vGrow; ${NOISE}
      float vein(vec3 q, float w){ float n = fbm(q); return 1.0 - smoothstep(0.0, w, abs(n - 0.5)); }
      void main(){
        vec3 V = cameraPosition - vWP; float dist = length(V); V /= dist; vec3 n = normalize(vN);
        float kind = vInfo.x, seed = vInfo.y; vec3 p = vWP;
        float hd = length(p.xz), dp = length(p.xz - uPlayer.xz);
        float near = smoothstep(24.0, 2.0, dp) * (1.0 - smoothstep(6.0, 12.0, abs(p.y - uPlayer.y)));
        float lam = 0.52 + 0.48 * max(dot(n, uSunL), 0.0);
        vec3 lime = vec3(0.60, 1.0, 0.12), mag = vec3(1.0, 0.16, 0.52), rose = vec3(1.0, 0.45, 0.6);
        float nA = fbm(p * 0.06), nB = vnoise(p * 0.5);
        float wave = pow(0.5 + 0.5 * sin(hd * 0.2 - uTime * 2.4 + nA * 6.0), 4.0);
        float act = 0.25 + 1.1 * wave + 1.5 * uBeat * exp(-hd * 0.012) + 1.8 * near;
        vec3 col, emi = vec3(0.0);
        float fr = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
        if (kind < 2.5) {                                   // suelo: plataformas (0), caminos (1), puente vivo (2)
          float top = smoothstep(0.45, 0.8, n.y);
          vec3 skin = mix(vec3(0.34, 0.045, 0.11), vec3(0.66, 0.14, 0.26), smoothstep(0.25, 0.8, nA)) * (0.8 + 0.4 * nB);
          if (kind > 0.5) skin = mix(skin, vec3(0.92, 0.56, 0.48) * (0.82 + 0.3 * nB), 0.66);     // los caminos son tejido claro
          if (kind > 1.5) skin = mix(skin, vec3(0.74, 0.92, 0.40), 0.34);                         // el puente vivo, verdoso
          vec3 q = p * 0.1; float v = vein(q, 0.04) + 0.7 * vein(q * 2.3 + 4.0, 0.06);
          vec3 vc = mix(mag, lime, kind > 0.5 ? 0.85 : smoothstep(0.35, 0.7, vnoise(p * 0.04 + 3.0)));
          emi += vc * v * act * (0.3 + 0.7 * top);
          float sp = smoothstep(0.8, 0.92, vnoise(p * 1.6 + seed * 10.0)) * top;
          emi += lime * sp * (0.5 + 0.5 * sin(uTime * 2.0 + seed * 40.0 + nB * 9.0)) * (0.6 + near * 1.5);
          float drip = smoothstep(0.68, 0.95, vnoise(vec3(p.x * 0.9, p.y * 0.08, p.z * 0.9)));
          vec3 side = mix(vec3(0.12, 0.02, 0.09), vec3(0.34, 0.06, 0.20), nA);
          col = mix(side, skin, top) * lam;
          emi += mix(mag * 0.55, lime, 0.4) * drip * (1.0 - top) * (0.4 + wave);
          emi += rose * fr * 0.28 * (1.0 - top * 0.6);
          if (kind > 1.5) emi += lime * (1.0 - vGrow) * 1.8 + lime * 0.1;
        } else if (kind < 5.5) {                             // columnas-nervio (3), quistes (4), grada (5)
          float h = clamp(vLP.y, 0.0, 1.0);
          vec3 base = mix(vec3(0.24, 0.035, 0.10), vec3(0.58, 0.11, 0.22), nA);
          col = base * lam * (kind < 3.5 ? 0.85 + 0.3 * h : 1.0);
          float a = atan(vLP.z, vLP.x);
          float nerve = pow(abs(sin(a * 4.0 + h * 3.0 * (seed - 0.5) * 2.0 + nB * 2.0)), 22.0);
          emi += mix(mag, lime, 0.5 + 0.5 * sin(h * 6.0 - uTime * 1.5)) * nerve * (0.6 + 1.6 * wave + 1.3 * near) * (kind < 3.5 ? 1.0 : 0.6);
          if (kind < 3.5) emi += lime * smoothstep(0.82, 0.97, h) * (1.1 + 0.8 * sin(uTime * 2.0 + seed * 30.0)) * (1.0 + near);
          else { float sp = smoothstep(0.74, 0.9, vnoise(p * 1.9 + seed * 7.0)); emi += lime * sp * (0.7 + 0.5 * sin(uTime * 2.2 + seed * 20.0)) * (0.7 + near * 1.4); emi += mag * smoothstep(0.9, 1.0, h) * (0.5 + uBeat); }
          emi += rose * fr * 0.3;
        } else if (kind < 6.5) {                             // el Corazón
          float v = vein(p * 0.55, 0.07) + 0.6 * vein(p * 1.4 + 2.0, 0.09);
          col = vec3(0.50, 0.02, 0.08) * (0.6 + 0.5 * max(dot(n, uSunL), 0.0));
          emi += mag * (0.5 + 1.3 * uBeat) * (0.4 + v) + vec3(1.0, 0.5, 0.6) * fr * (0.8 + uBeat);
        } else {                                             // planetas de carne lejanos
          float v = vein(p * 0.012, 0.05) + 0.6 * vein(p * 0.03 + 5.0, 0.07);
          col = mix(vec3(0.22, 0.03, 0.10), vec3(0.5, 0.1, 0.2), nA) * (0.45 + 0.55 * max(dot(n, uSunL), 0.0));
          emi += mix(mag, lime, 0.5 + 0.5 * sin(seed * 20.0)) * v * (0.5 + 0.8 * uBeat) + lime * fr * 0.5;
        }
        col += emi; ${fogMix}
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

/** Tallos y raíces nerviosas (MODE 0), hongos (1) y cristales (2): se encienden cerca del jugador; los tallos/raíces se retraen. */
function bioMaterial(mode) {
  return finish(new THREE.ShaderMaterial({
    side: mode === 0 ? THREE.DoubleSide : THREE.FrontSide, defines: { MODE: mode },
    uniforms: { uTime, uPlayer: M4U.uPlayer, uBeat: M4U.uBeat, uFog: { value: M4V.fog }, uFogD: { value: M4V.fogD } },
    vertexShader: `uniform float uTime; uniform vec3 uPlayer; attribute float aKind; varying vec3 vWP; varying vec3 vC; varying float vT; varying float vK; varying float vPh;
      void main(){
        vec3 pos = position; vec3 base = instanceMatrix[3].xyz;
        float ph = fract(sin(dot(base, vec3(12.9898, 78.233, 37.719))) * 43758.5453); vPh = ph;
        float dpl = length(base.xz - uPlayer.xz) + abs(base.y - uPlayer.y) * 0.5;
        float k = smoothstep(15.0, 3.0, dpl); vK = k; vT = clamp(pos.y, 0.0, 1.0); vC = vec3(0.6, 1.0, 0.2);
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        #if MODE == 0
          float t = vT;
          pos.y *= 1.0 - 0.6 * k * aKind;                                   // se retrae (más los tallos que las raíces)
          pos.x += sin(uTime * 1.3 + ph * 6.28 + t * 3.0) * 0.25 * t * (1.0 - 0.6 * k);
          pos.z += cos(uTime * 1.1 + ph * 9.0 + t * 2.0) * 0.18 * t;
        #endif
        vec4 w = modelMatrix * instanceMatrix * vec4(pos, 1.0);
        #if MODE == 0
          vec2 away = normalize(base.xz - uPlayer.xz + vec2(0.001)); w.xz += away * k * vT * vT * (aKind > 0.5 ? 1.1 : 0.4);
        #endif
        vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uBeat; ${FOG} varying vec3 vWP; varying vec3 vC; varying float vT; varying float vK; varying float vPh;
      void main(){
        float dist = length(cameraPosition - vWP); vec3 col;
        float pulse = 0.75 + 0.25 * sin(uTime * 1.7 + vPh * 6.28) + 0.4 * uBeat;
        #if MODE == 0
          col = mix(vec3(0.22, 0.03, 0.10), vec3(0.85, 0.34, 0.44), vT);
          float tip = smoothstep(0.6, 1.0, vT); col += vC * tip * (1.0 + 1.9 * vK) * pulse * 1.5 + vC * 0.12 * vT * vK;
        #elif MODE == 1
          col = vec3(0.62, 0.52, 0.56) * 0.7; col = mix(col, vC * (1.0 + 1.3 * vK) * pulse * 1.3, step(0.44, vT));
        #else
          vec3 n = normalize(cross(dFdx(vWP), dFdy(vWP))); vec3 V = normalize(cameraPosition - vWP);
          float fr = pow(1.0 - abs(dot(n, V)), 2.0);
          col = vC * (0.25 + 0.8 * vT) * pulse * (1.0 + 1.2 * vK) + vec3(1.0, 0.9, 0.95) * fr * 0.35;
        #endif
        ${fogMix}
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

function membraneMaterial(kind) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, defines: { KIND: kind, FBM_OCT: 3 },
    uniforms: { uTime, uBeat: M4U.uBeat, uFog: { value: M4V.fog }, uFogD: { value: M4V.fogD } },
    vertexShader: `uniform float uTime; varying vec3 vWP; varying vec3 vN; varying vec2 vUv; varying float vPh;
      void main(){ vec3 pos = position; vUv = uv; vec3 base = instanceMatrix[3].xyz; vPh = fract(sin(dot(base, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        #if KIND == 0
          pos.z += sin(pos.x * 5.0 + uTime * 0.7 + vPh * 6.0) * 0.03 + sin(pos.y * 4.0 - uTime * 0.5) * 0.025;
        #endif
        vec4 w = modelMatrix * instanceMatrix * vec4(pos, 1.0); vWP = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uBeat; ${FOG} varying vec3 vWP; varying vec3 vN; varying vec2 vUv; varying float vPh; ${NOISE}
      void main(){
        float dist = length(cameraPosition - vWP); vec3 V = (cameraPosition - vWP) / dist; vec3 n = normalize(vN);
        vec3 lime = vec3(0.6, 1.0, 0.15), mag = vec3(1.0, 0.18, 0.55);
        vec3 col;
        #if KIND == 0
          float e = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
          vec3 q = vec3(vUv * 7.0, vPh * 9.0 + uTime * 0.05); float v = 1.0 - smoothstep(0.0, 0.07, abs(fbm(q) - 0.5));
          float a = (0.07 + 0.55 * v) * e * (0.6 + 0.6 * uBeat);
          col = mix(mag, lime, step(0.6, vPh)) * a * 0.55;
        #else
          float fr = pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 2.4);
          col = mix(mag, lime, step(0.5, vPh)) * (fr * 0.85 + 0.05) * (0.7 + 0.5 * uBeat) * 0.7;
        #endif
        ${fogMix}
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

function skyMat(full) {
  return finish(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, defines: { FBM_OCT: full ? 4 : 3 },
    uniforms: { uTime, uBeat: M4U.uBeat },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform float uTime, uBeat; varying vec3 vDir; ${NOISE}
      float vein(vec3 q, float w){ float n = fbm(q); return 1.0 - smoothstep(0.0, w, abs(n - 0.5)); }
      void main(){
        vec3 d = normalize(vDir); float up = d.y, t = uTime * 0.03;
        vec3 hor = vec3(0.62, 0.08, 0.20), mid = vec3(0.22, 0.02, 0.17), zen = vec3(0.025, 0.0, 0.07), low = vec3(0.16, 0.015, 0.12);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.32, up)); col = mix(col, zen, smoothstep(0.22, 0.95, up));
        col = mix(col, mix(hor * 0.55, low, smoothstep(0.0, -0.55, up)), smoothstep(0.0, -0.06, up));
        vec2 uv = d.xz / (abs(up) + 0.42);
        float cl = fbm(vec3(uv * 1.1 + vec2(t * 2.0, 0.0), t * 3.0)), cl2 = fbm(vec3(uv * 2.6 - vec2(0.0, t * 3.0), 4.0 + t * 2.0));
        col += vec3(0.55, 0.07, 0.25) * smoothstep(0.42, 0.85, cl) * 0.55 * (0.6 + 0.4 * cl2);
        float vn = vein(vec3(uv * 1.7, 2.0 + t), 0.045) + 0.6 * vein(vec3(uv * 3.9 + 9.0, 5.0), 0.06);
        col += mix(vec3(1.0, 0.16, 0.5), vec3(0.6, 1.0, 0.14), smoothstep(0.4, 0.75, cl2)) * vn * (0.28 + 0.35 * uBeat) * smoothstep(-0.05, 0.35, up);
        // cortinas de aurora verde ácido
        float au = smoothstep(0.55, 0.95, fbm(vec3(d.x * 3.0 + t * 4.0, up * 6.0, d.z * 3.0 - t * 2.0))) * smoothstep(0.02, 0.3, up) * smoothstep(0.85, 0.35, up);
        col += vec3(0.45, 1.0, 0.12) * au * 0.4;
        // esporas lejanas
        vec3 sp = floor(d * 160.0); float h = hash13(sp); col += vec3(0.8, 1.0, 0.5) * step(0.9965, h) * (0.5 + 0.5 * sin(uTime * 2.0 + h * 90.0)) * 0.8;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

function mistMaterial(y, tint) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, defines: { FBM_OCT: 3 },
    uniforms: { uTime, uBeat: M4U.uBeat, uTint: { value: new THREE.Color(...tint) }, uY: { value: y } },
    vertexShader: `varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uBeat, uY; uniform vec3 uTint; varying vec3 vWP; ${NOISE}
      void main(){
        float d = length(vWP.xz - cameraPosition.xz); float fade = smoothstep(560.0, 90.0, d);
        vec2 s = vWP.xz * 0.011; float n = fbm(vec3(s + vec2(uTime * 0.012, -uTime * 0.008), uY * 0.02 + uTime * 0.02)); float n2 = fbm(vec3(s * 2.3 + 7.0, uTime * 0.03));
        float a = smoothstep(0.34, 0.8, n) * 0.62 * fade;
        vec3 col = mix(uTint, vec3(0.45, 0.85, 0.12) * 0.55, smoothstep(0.55, 0.85, n2)) * (0.75 + 0.25 * uBeat);
        gl_FragColor = vec4(col, a);
      }`,
  }));
}

function ghostMaterial() {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime, uSecN: M4U.uSecN, uFeed: M4U.uFeed, uFog: { value: M4V.fog }, uFogD: { value: M4V.fogD } },
    vertexShader: `uniform vec3 uSecN; attribute vec4 aInfo; varying vec3 vWP; varying vec3 vN; varying float vFade; varying float vJ;
      void main(){ float sN = aInfo.z < 0.5 ? uSecN.x : (aInfo.z < 1.5 ? uSecN.y : uSecN.z); vFade = 1.0 - clamp(sN - aInfo.w, 0.0, 1.0); vJ = aInfo.w + aInfo.z * 7.0;
        vec3 pos = position * vec3(1.06, 1.0, 1.06) + vec3(0.0, 0.1, 0.0); vec4 w = modelMatrix * instanceMatrix * vec4(pos, 1.0); vWP = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uFeed; ${FOG} varying vec3 vWP; varying vec3 vN; varying float vFade; varying float vJ;
      void main(){
        float dist = length(cameraPosition - vWP); vec3 V = (cameraPosition - vWP) / dist;
        float fr = pow(1.0 - clamp(abs(dot(normalize(vN), V)), 0.0, 1.0), 1.6);
        float run = 0.5 + 0.5 * sin(vJ * 0.9 - uTime * 3.0);
        float a = vFade * (0.10 + 0.22 * run + 0.32 * fr) * (0.55 + 0.9 * uFeed);
        vec3 col = mix(vec3(0.35, 1.0, 0.3), vec3(0.55, 1.0, 0.9), run) * a * 1.25; ${fogMix}
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

function beamMaterial() {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime, uBeat: M4U.uBeat },
    vertexShader: `varying float vY; varying vec3 vC; void main(){ vY = position.y + 0.5; vC = vec3(1.0); 
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uBeat; varying float vY; varying vec3 vC; void main(){ float a = (1.0 - vY) * (0.1 + 0.22 * uBeat) * smoothstep(0.0, 0.04, vY); gl_FragColor = vec4(vC * a, 1.0); }`,
  }));
}

/* ───────── construcción ───────── */
export function buildMap4(r, map, { eyes = true } = {}) {
  const root = r.mapRoot, q = cfg(), full = !!q.decor, L = map.layout, rd = rng(4404);
  r.hemi.color.setHex(0xff90b4); r.hemi.groundColor.setHex(0x44102c); r.hemi.intensity = 1.15;
  r.sun.color.setHex(0xffb4cc); r.sun.intensity = 2.0; r.sun.position.copy(M4V.sunDir);
  r.rim.color.setHex(0x9dff40); r.rim.intensity = 0.9;
  r.scene.environmentIntensity = 0.5; r.sunDir = M4V.sunDir.clone();
  trackPx(r);

  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), eu = new THREE.Euler();
  const tissue = tissueMaterial(null, full);
  const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; root.add(m); return m; };
  const attrInfo = (n) => new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);

  // — cielo, planetas lejanos, bancos de niebla
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), skyMat(full)); sky.renderOrder = -10; sky.frustumCulled = false; root.add(sky);
  for (const [y, tint] of [[-24, [0.34, 0.04, 0.26]], [-52, [0.22, 0.03, 0.2]]]) {
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 1, 1), mistMaterial(y, tint)); mist.rotation.x = -Math.PI / 2; mist.position.y = y; mist.frustumCulled = false; mist.renderOrder = -5; root.add(mist);
  }
  { const n = full ? 7 : 5, g = new THREE.SphereGeometry(1, 20, 12), m = mk(g, tissue, n), info = attrInfo(n);
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + rd(), d = 520 + rd() * 200, s = 55 + rd() * 70; ps.set(Math.cos(a) * d, -60 + rd() * 220, Math.sin(a) * d); sc.set(s, s * (0.7 + rd() * 0.3), s); m.setMatrixAt(i, m4.compose(ps, qt.identity(), sc)); info.set([7, rd(), 0, 0], i * 4); }
    g.setAttribute('aInfo', info); }

  // — suelo: plataformas grandes y discos pequeños (caminos y puente)
  const big = [], small = [];
  L.discs.forEach((d, i) => (d.kind === 'plat' ? big : small).push(i));
  const placeDiscs = (list, geo) => {
    const m = mk(geo, tissue, list.length), info = attrInfo(list.length);
    list.forEach((di, k) => {
      const d = L.discs[di]; ps.set(d.x, d.top, d.z); sc.set(d.r, 1, d.r); qt.setFromEuler(eu.set(0, rd() * 6.283, 0)); m.setMatrixAt(k, m4.compose(ps, qt, sc));
      const kind = d.kind === 'plat' ? 0 : d.kind === 'conn' ? 1 : 2, sec = d.sec ?? -1, j = sec >= 0 ? L.sections[sec].ids.indexOf(di) : 0;
      info.set([kind, rd(), sec < 0 ? 0 : sec, j], k * 4);
    });
    geo.setAttribute('aInfo', info); return m;
  };
  placeDiscs(big, discBig());
  const smallMesh = placeDiscs(small, discSmall());
  // fantasma del puente (sólo los discos del puente)
  { const br = small.filter((di) => L.discs[di].kind === 'bridge'), g = discSmall(), m = mk(g, ghostMaterial(), br.length), info = attrInfo(br.length);
    br.forEach((di, k) => { const d = L.discs[di]; ps.set(d.x, d.top, d.z); sc.set(d.r, 1, d.r); m.setMatrixAt(k, m4.compose(ps, qt.identity(), sc)); info.set([2, 0, d.sec, L.sections[d.sec].ids.indexOf(di)], k * 4); });
    g.setAttribute('aInfo', info); m.renderOrder = 3; }
  void smallMesh;

  // — coberturas: columnas-nervio, quistes y grada
  const pil = L.covers.filter((c) => c.kind === 'pilar'), dom = L.covers.filter((c) => c.kind !== 'pilar');
  const placeCovers = (list, geo, kindOf) => {
    const m = mk(geo, tissue, list.length), info = attrInfo(list.length);
    list.forEach((c, k) => { ps.set(c.x, c.top - 0.3, c.z); sc.set(c.r, c.h + 0.3, c.r); qt.setFromEuler(eu.set(0, rd() * 6.283, 0)); m.setMatrixAt(k, m4.compose(ps, qt, sc)); info.set([kindOf(c), rd(), 0, 0], k * 4); });
    geo.setAttribute('aInfo', info);
  };
  placeCovers(pil, pillarGeo(), () => 3);
  placeCovers(dom, domeGeo(), (c) => (c.kind === 'grada' ? 5 : 4));
  { const g = new THREE.IcosahedronGeometry(1, 2), m = mk(g, tissue, 1), info = attrInfo(1); // el Corazón sobre la grada
    ps.set(0, 1.7 + 2.5, 0); sc.set(2.5, 2.5, 2.5); m.setMatrixAt(0, m4.compose(ps, qt.identity(), sc)); info.set([6, 0.3, 0, 0], 0); g.setAttribute('aInfo', info); }

  // — vegetación: tallos nerviosos (arriba), raíces (colgando), hongos y cristales
  const PAL = [0x9dff3a, 0xff2a8a, 0x3affd8, 0xff7a2a, 0xe040ff], col = new THREE.Color();
  const attach = {}; // ángulos de los enganches de cada plataforma (para no taparlos con vegetación)
  for (const c of L.conns) { for (const [id, pt] of [[c.a, c.pa], [c.b, c.pb]]) { const p = map.plats.find((x) => x.id === id); (attach[id] || (attach[id] = [])).push(Math.atan2(pt.z - p.z, pt.x - p.x)); } }
  const free = (p, a) => !(attach[p.id] || []).some((b) => { let d = Math.abs(a - b) % 6.283; d = Math.min(d, 6.283 - d); return d < 0.3 + 4.5 / p.r; });
  const tend = [], fung = [], crys = [];
  for (const p of map.plats) {
    const parts = p.pit ? 6 : 1;
    for (let i = 0, n = Math.round(p.r * (full ? 1.2 : 0.9)); i < n; i++) { // tallos sobre el suelo
      const a = rd() * 6.283; if (!free(p, a)) continue; const rr = p.r * (0.62 + rd() * 0.33);
      if (p.pit) { const pa = Math.floor(rd() * parts) * (6.283 / parts), c0 = p.r * 0.656, rp = p.r * 0.36 * (0.5 + 0.4 * rd()), aa = rd() * 6.283; tend.push({ x: p.x + Math.cos(pa) * c0 + Math.cos(aa) * rp, y: p.top, z: p.z + Math.sin(pa) * c0 + Math.sin(aa) * rp, up: true, len: 1.2 + rd() * 1.5, w: 0.11 + rd() * 0.08 }); }
      else tend.push({ x: p.x + Math.cos(a) * rr, y: p.top, z: p.z + Math.sin(a) * rr, up: true, len: 1.2 + rd() * 1.6, w: 0.11 + rd() * 0.08 });
    }
    for (let i = 0, n = Math.round(p.r * 1.3); i < n; i++) { // raíces colgando bajo el borde
      const a = rd() * 6.283; let x = p.x + Math.cos(a) * p.r * (0.62 + rd() * 0.34), z = p.z + Math.sin(a) * p.r * (0.62 + rd() * 0.34);
      if (p.pit) { const pa = Math.floor(rd() * 6) * (6.283 / 6), c0 = p.r * 0.656; x = p.x + Math.cos(pa) * c0 + Math.cos(a) * p.r * 0.3; z = p.z + Math.sin(pa) * c0 + Math.sin(a) * p.r * 0.3; }
      tend.push({ x, y: p.top - 1.2 - rd() * 2.5, z, up: false, len: 5 + rd() * (6 + p.r * 0.5), w: 0.18 + rd() * 0.16 });
    }
    for (let i = 0, n = 3 + Math.round(p.r / 5); i < n; i++) { // racimos de hongos
      const a = rd() * 6.283; if (!free(p, a)) continue; const rr = p.r * (0.55 + rd() * 0.38), cx = p.x + Math.cos(a) * rr, cz = p.z + Math.sin(a) * rr, k = 3 + Math.floor(rd() * 3), c = PAL[Math.floor(rd() * PAL.length)];
      if (p.pit && Math.hypot(cx - p.x, cz - p.z) < p.r * 0.35) continue;
      for (let j = 0; j < k; j++) fung.push({ x: cx + (rd() - 0.5) * 3, y: p.top - 0.05, z: cz + (rd() - 0.5) * 3, s: 0.7 + rd() * 1.1, c });
    }
    for (let i = 0, n = 2 + Math.round(p.r / 7); i < n; i++) { // cristales orgánicos junto al borde
      const a = rd() * 6.283; if (!free(p, a)) continue; const rr = p.r * (0.8 + rd() * 0.15);
      crys.push({ x: p.x + Math.cos(a) * rr, y: p.top - 0.1, z: p.z + Math.sin(a) * rr, h: 1.4 + rd() * 2.2, w: 0.35 + rd() * 0.35, c: [0xff2a8a, 0x9dff3a, 0xe040ff][Math.floor(rd() * 3)] });
    }
  }
  for (const c of L.conns) c.chain.forEach((pt, i) => { // bordes de caminos: raíces y algún tallo
    if (i < 2 || i > c.n - 2) return;
    if (i % 3 === 0) tend.push({ x: pt.x + (i % 2 ? 2.3 : -2.3), y: pt.top - 0.8, z: pt.z, up: false, len: 4 + rd() * 6, w: 0.16 + rd() * 0.1 });
    if (i % 5 === 0 && !c.bridge) tend.push({ x: pt.x + (i % 2 ? -2.5 : 2.5), y: pt.top, z: pt.z, up: true, len: 0.9 + rd(), w: 0.1 });
    if (i % 6 === 2 && full && !c.bridge) fung.push({ x: pt.x + (i % 2 ? 2.7 : -2.7), y: pt.top - 0.1, z: pt.z, s: 0.6 + rd() * 0.5, c: PAL[i % PAL.length] });
  });
  { const m = mk(tendrilGeo(), bioMaterial(0), tend.length), kinds = new Float32Array(tend.length);
    tend.forEach((t, i) => { ps.set(t.x, t.y, t.z); if (t.up) qt.setFromEuler(eu.set((rd() - 0.5) * 0.4, rd() * 6.283, (rd() - 0.5) * 0.4)); else qt.setFromEuler(eu.set(Math.PI + (rd() - 0.5) * 0.3, rd() * 6.283, (rd() - 0.5) * 0.3)); sc.set(t.w, t.len, t.w); m.setMatrixAt(i, m4.compose(ps, qt, sc)); kinds[i] = t.up ? 1 : 0; col.setHex(rd() < 0.6 ? 0xb8ff3a : 0xff3a9a); m.setColorAt(i, col); });
    m.geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1)); }
  { const m = mk(fungiGeo(), bioMaterial(1), fung.length);
    fung.forEach((f, i) => { ps.set(f.x, f.y, f.z); qt.setFromEuler(eu.set((rd() - 0.5) * 0.3, rd() * 6.283, (rd() - 0.5) * 0.3)); sc.set(f.s, f.s, f.s); m.setMatrixAt(i, m4.compose(ps, qt, sc)); col.setHex(f.c); m.setColorAt(i, col); }); }
  { const m = mk(crystalGeo(), bioMaterial(2), crys.length);
    crys.forEach((c, i) => { ps.set(c.x, c.y, c.z); qt.setFromEuler(eu.set((rd() - 0.5) * 0.5, rd() * 6.283, (rd() - 0.5) * 0.5)); sc.set(c.w, c.h, c.w); m.setMatrixAt(i, m4.compose(ps, qt, sc)); col.setHex(c.c); m.setColorAt(i, col); }); }

  // — membranas: cortinas colgantes y vesículas flotantes (translúcidas)
  { const n = full ? 10 : 7, g = new THREE.PlaneGeometry(1, 1, 8, 6), m = mk(g, membraneMaterial(0), n);
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + rd() * 0.5, d = 85 + rd() * 70, w = 30 + rd() * 22, h = 26 + rd() * 22; ps.set(Math.cos(a) * d, -6 + rd() * 26, Math.sin(a) * d); qt.setFromEuler(eu.set(0, -a + 1.5708 + (rd() - 0.5) * 0.9, 0)); sc.set(w, h, 1); m.setMatrixAt(i, m4.compose(ps, qt, sc)); } }
  { const n = full ? 14 : 9, g = new THREE.IcosahedronGeometry(1, 1), m = mk(g, membraneMaterial(1), n);
    for (let i = 0; i < n; i++) { const a = rd() * 6.283, d = 70 + rd() * 100, s = 5 + rd() * 9; ps.set(Math.cos(a) * d, -30 + rd() * 80, Math.sin(a) * d); sc.set(s, s * (0.8 + rd() * 0.4), s); m.setMatrixAt(i, m4.compose(ps, qt.identity(), sc)); } }

  // — sumidero luminoso de la Cámara del Latido y faros (haces de luz) del Corazón y del Umbral
  { const cam = map.plats.find((p) => p.id === 'cam'), g = new THREE.CircleGeometry(1, 20), mat = finish(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime, uBeat: M4U.uBeat },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv - 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime, uBeat; varying vec2 vUv; void main(){ float d = length(vUv) * 2.0; float a = (1.0 - smoothstep(0.0, 1.0, d)) * (0.55 + 0.7 * uBeat) * (0.8 + 0.2 * sin(uTime * 3.0 - d * 8.0)); gl_FragColor = vec4(vec3(0.8, 1.0, 0.25) * a * 0.9, 1.0); }` })), m = new THREE.Mesh(g, mat);
    m.rotation.x = -Math.PI / 2; m.position.set(cam.x, cam.top - 17, cam.z); m.scale.setScalar(cam.r * 0.56); m.frustumCulled = false; root.add(m); }
  { const g = new THREE.CylinderGeometry(1, 2.2, 1, 14, 1, true), m = mk(g, beamMaterial(), 2);
    ps.set(0, 50, 0); sc.set(1.2, 100, 1.2); m.setMatrixAt(0, m4.compose(ps, qt.identity(), sc)); m.setColorAt(0, col.setHex(0xff2a6a));
    const u = map.plats.find((p) => p.id === 'umb'); ps.set(u.x, u.top + 40, u.z); sc.set(1.6, 80, 1.6); m.setMatrixAt(1, m4.compose(ps, qt.identity(), sc)); m.setColorAt(1, col.setHex(0xa8ff3a)); m.renderOrder = 2; }

  // — luces de color sólo donde la calidad lo permite
  const lights = [];
  if (q.lights >= 3) { const pl = new THREE.PointLight(0xff3a7a, 160, 70, 1.4); pl.position.set(0, 8, 0); root.add(pl); lights.push(pl); }
  r.dyn.push((dt, t) => {
    M4U.uPlayer.value.copy(r.camera.position); M4U.uPlayer.value.y -= 0.7; M4U.uBeat.value = beatAt(t);
    for (const l of lights) l.intensity = 150 * (0.8 + 0.5 * M4U.uBeat.value);
  });

  // — esporas que flotan alrededor de la cámara + ojos cósmicos
  { const n = full ? 110 : 60, g = particleGeo(n, (i, rr) => [(rr() - 0.5) * 110, (rr() - 0.5) * 6, (rr() - 0.5) * 110], 13), m = new THREE.Points(g, particleMat({ color: 0xc6ff5a, size: 0.17, mode: 0, speed: 0.1, height: 28, amp: 1.6, alpha: 0.85 }));
    m.frustumCulled = false; root.add(m); r.dyn.push(() => { m.position.set(r.camera.position.x, r.camera.position.y - 9, r.camera.position.z); }); }
  if (eyes) addCosmicEyes(r, root, { count: full ? (q.shadows ? 44 : 26) : 9, radius: 760, minR: 330, mode: 'sky', y0: -20, y1: 340, size: 2.1, zenith: false, constellations: 0, haze: 0x330a22 });
}
