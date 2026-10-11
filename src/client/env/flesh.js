import * as THREE from 'three';
import { uTime, finish, uTide } from '../shaders.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE, BUMP } from './glsl.js';
import { dc } from './props.js';

// Materiales del Mapa 2 «Cámara Fractal»: colinas-tumor / geoda, medusas, velos y latido del núcleo.

export const HEART = `float heart(float t){ float ph = fract(t / 1.55); return exp(-pow(ph * 10.0, 2.0)) + 0.65 * exp(-pow((ph - 0.27) * 10.0, 2.0)); }`;
/** Latido (mismo que el del shader): 0..~1.2, doble golpe cada 1.55 s. */
export const heart = (t) => { const ph = (t / 1.55) % 1; return Math.exp(-((ph * 10) ** 2)) + 0.65 * Math.exp(-(((ph - 0.27) * 10) ** 2)); };

/* ───────── colinas: la mitad son tumores (carne brillante), la otra mitad geodas (corteza con cavidades de cristal) ───────── */
export function hillGeometry(hills, R, detail = 1) {
  const gs = hills.map((s, i) => {
    const g = new THREE.SphereGeometry(s.r, 40 * detail, 28 * detail); g.deleteAttribute('uv'); g.translate(s.c.x, s.c.y, s.c.z);
    const n = g.attributes.position.count, aC = new Float32Array(n * 3), aT = new Float32Array(n).fill(i % 2);
    for (let k = 0; k < n; k++) aC.set([s.c.x, s.c.y, s.c.z], k * 3);
    g.setAttribute('aC', new THREE.BufferAttribute(aC, 3)); g.setAttribute('aT', new THREE.BufferAttribute(aT, 1)); return g;
  });
  return mergeGeometries(gs, false);
}
export function hillMat(oct = 4) {
  return finish(new THREE.ShaderMaterial({
    defines: { FBM_OCT: oct },
    uniforms: { uTime, uTide },
    vertexShader: `attribute vec3 aC; attribute float aT; varying vec3 vWP; varying vec3 vN; varying vec3 vC; varying float vT;
      void main(){ vC = aC; vT = aT; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uTide; varying vec3 vWP; varying vec3 vN; varying vec3 vC; varying float vT; ${NOISE} ${BUMP} ${HEART}
      void main(){
        vec3 N = normalize(vN), V = cameraPosition - vWP; float dist = length(V); V /= dist;
        vec3 q = (vWP - vC) * 0.2; vec3 L = normalize(-vWP);
        float beat = heart(uTime), body = fbm(q * 1.6 + vT * 5.0);
        vec3 col, emi = vec3(0.0); float hgt, gloss;
        if (vT < 0.5) {            // tumor
          float pore = smoothstep(0.72, 0.86, vnoise(q * 9.0)), lump = smoothstep(0.45, 0.8, fbm(q * 3.5));
          float v1 = 1.0 - abs(2.0 * vnoise(q * 4.0 + 2.0) - 1.0), vein = smoothstep(0.90, 0.99, v1);
          hgt = body + lump * 0.5 - pore * 0.4;
          vec3 alb = mix(vec3(0.30, 0.05, 0.17), vec3(0.78, 0.25, 0.36), body); alb = mix(alb, vec3(0.10, 0.02, 0.06), pore);
          col = alb; gloss = 0.9;
          emi = vec3(1.0, 0.35, 0.28) * (vein * (0.25 + 0.9 * beat) + lump * 0.06 * (0.3 + beat));
          emi += vec3(0.9, 0.25, 0.35) * pore * (0.15 + 0.5 * beat);
        } else {                    // geoda
          float cav = smoothstep(0.50, 0.57, fbm(q * 2.4 + 3.0)), rimc = smoothstep(0.50, 0.53, fbm(q * 2.4 + 3.0)) * (1.0 - smoothstep(0.57, 0.62, fbm(q * 2.4 + 3.0)));
          hgt = body * (1.0 - cav) + 0.2 * vnoise(q * 14.0) - cav * 0.5;
          vec3 crust = mix(vec3(0.07, 0.04, 0.10), vec3(0.20, 0.12, 0.16), body);
          float k = vnoise(q * 6.0 + uTime * 0.05);
          vec3 gem = mix(vec3(0.1, 0.8, 0.9), vec3(0.9, 0.3, 0.8), smoothstep(0.35, 0.7, k));
          float spark = step(0.93, hash13(floor(q * 40.0))) * (0.5 + 0.5 * sin(uTime * 3.0 + k * 20.0));
          col = mix(crust, gem * 0.25, cav); gloss = mix(0.25, 1.0, cav);
          emi = gem * cav * (0.55 + 0.35 * beat + 0.4 * k) + vec3(1.0, 0.8, 0.9) * rimc * 0.5 + vec3(1.0) * spark * cav * 0.9;
        }
        N = bumpN(N, vWP, hgt, 1.6);
        float dif = max(dot(N, L), 0.0);
        vec3 H = normalize(L + V); float spec = pow(max(dot(N, H), 0.0), mix(20.0, 90.0, gloss)) * gloss;
        float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 c = col * (0.08 + 0.75 * dif) + vec3(1.0, 0.85, 0.75) * spec * 0.6 + emi * (1.0 + uTide * 0.6) + vec3(0.9, 0.35, 0.5) * fr * 0.10;
        c = mix(c, vec3(0.16, 0.05, 0.20), 1.0 - exp(-dist * 0.0045));
        gl_FragColor = vec4(c * 0.85, 1.0);
      }`,
  }));
}

/* ───────── medusas ambientales (translúcidas, pulsan, se mecen; derivan por vertex shader) ───────── */
export function medusaGeo() {
  const bell = new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); bell.scale(1, 0.75, 1); bell.deleteAttribute('uv');
  const parts = [bell.toNonIndexed()]; parts[0].setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(parts[0].attributes.position.count), 1));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, t = new THREE.ConeGeometry(0.018, 1.5, 4, 7, true); t.rotateX(Math.PI); t.translate(Math.cos(a) * 0.36, -0.75, Math.sin(a) * 0.36); t.deleteAttribute('uv');
    const g = t.toNonIndexed(); g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(1), 1)); parts.push(g);
  }
  return mergeGeometries(parts, false);
}
export function medusaMat() {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime, uTide },
    vertexShader: `attribute float aPart; uniform float uTime, uTide; varying vec3 vC; varying float vPart; varying float vH; varying vec3 vN; varying vec3 vV;
      void main(){ vec3 p = position; vC = vec3(0.4, 1.0, 0.9); float ph = 0.0;
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        #ifdef USE_INSTANCING
          ph = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        #endif
        float pulse = sin(uTime * 1.5 + ph * 6.283); vPart = aPart; vH = -p.y;
        if (aPart < 0.5) { p.xz *= 1.0 + 0.12 * pulse * (1.0 - p.y); p.y *= 1.0 - 0.14 * pulse; }
        else { float k = clamp(-p.y / 1.5, 0.0, 1.0); p.xz += vec2(sin(uTime * 1.3 + ph * 5.0 + k * 4.0), cos(uTime * 1.1 + ph * 7.0 + k * 3.0)) * 0.16 * k; p.xz *= 1.0 + 0.1 * pulse * k; }
        vec4 p4 = vec4(p, 1.0); vec3 n = normal;
        #ifdef USE_INSTANCING
          p4 = instanceMatrix * p4; n = mat3(instanceMatrix) * n;
          p4.xyz += vec3(sin(uTime * 0.07 + ph * 40.0), sin(uTime * 0.05 + ph * 13.0) * 0.5, cos(uTime * 0.06 + ph * 27.0)) * 6.0 * (1.0 + uTide * 1.5);
        #endif
        vec4 w = modelMatrix * p4; vN = normalize(mat3(modelMatrix) * n); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uTide; varying vec3 vC; varying float vPart; varying float vH; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        vec3 col; float a;
        if (vPart < 0.5) { col = vC * (0.35 + 0.9 * f); a = 0.10 + 0.40 * f; }
        else { col = vC * (0.5 + 0.8 * smoothstep(0.2, 1.0, vH)); a = 0.35 * (1.0 - 0.6 * vH); }
        gl_FragColor = vec4(col * (1.0 + uTide * 0.6), a * (1.0 + uTide * 0.5)); }`,
  }));
}

/* ───────── velos: membranas colgantes que suben del suelo (traslúcidas, con venas y borde luminoso) ───────── */
export function veilGeo() { const g = new THREE.PlaneGeometry(1, 1, 18, 12); g.translate(0, 0.5, 0); return g; }
export function veilMat() {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, defines: { FBM_OCT: 3 },
    uniforms: { uTime, uTide },
    vertexShader: `uniform float uTime, uTide; varying vec2 vUv; varying vec3 vC; varying float vPh;
      void main(){ vUv = uv; vec3 p = position; float ph = 0.0; vC = vec3(1.0, 0.5, 0.6);
        #ifdef USE_INSTANCING
          ph = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vPh = ph; float k = uv.y;
        p.z += (sin(k * 4.0 + uTime * (0.7 + uTide * 1.6) + ph * 6.283) * 0.10 + sin(p.x * 5.0 + uTime * 0.9 + ph * 9.0) * 0.05) * k * 1.4;
        p.x += sin(k * 3.0 + uTime * 0.5 + ph * 4.0) * 0.06 * k;
        vec4 p4 = vec4(p, 1.0);
        #ifdef USE_INSTANCING
          p4 = instanceMatrix * p4;
        #endif
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * p4; }`,
    fragmentShader: `uniform float uTime, uTide; varying vec2 vUv; varying vec3 vC; varying float vPh; ${NOISE} ${HEART}
      void main(){
        float beat = heart(uTime);
        vec3 q = vec3(vUv * vec2(7.0, 5.0), vPh * 10.0);
        float v = 1.0 - abs(2.0 * vnoise(q) - 1.0), vein = smoothstep(0.86, 0.99, v) + 0.5 * smoothstep(0.9, 0.99, 1.0 - abs(2.0 * vnoise(q * 2.3 + 3.0) - 1.0));
        float edge = smoothstep(0.06, 0.0, vUv.x) + smoothstep(0.94, 1.0, vUv.x);
        float fadeTop = pow(1.0 - vUv.y, 0.8), base = smoothstep(0.0, 0.15, vUv.y);
        float body = 0.10 + 0.08 * fbm(q * 0.7);
        vec3 col = vC * (body + vein * (0.5 + 0.7 * beat + 0.4 * uTide) + edge * 0.5);
        gl_FragColor = vec4(col, (0.20 + 0.45 * vein + 0.3 * edge) * fadeTop * base * (1.0 + uTide * 0.4));
      }`,
  }));
}
