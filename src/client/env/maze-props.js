import * as THREE from 'three';
import { cfg } from '../quality.js';
import { uTime, finish } from '../shaders.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE } from './glsl.js';
import { HAZE_D } from './maze-materials.js';
import { rng } from './noise.js';
import { dc, crystalGeo, crystalMat, debrisGeo, particleGeo, particleMat } from './props.js';

// Decorado del Mapa 3: ruinas flotantes, estatuas rotas, enredaderas, faroles, mariposas, cristales, portales, obeliscos.
// Todo lo repetido va en InstancedMesh (una llamada de dibujo por tipo).

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();

/** Mismos colores de zona que el GLSL (ZONES), en JS: ámbar (aparición) / cian / magenta / lima / violeta (plaza). */
export function zoneColor(x, z, out = new THREE.Color()) {
  const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const sx = Math.max(-1, Math.min(1, x / 74)), sz = Math.max(-1, Math.min(1, z / 74)), wx = sm(-0.25, 0.25, sx), wz = sm(-0.25, 0.25, sz);
  const A = [1.0, 0.60, 0.22], C = [0.20, 0.85, 1.0], M = [1.0, 0.26, 0.74], L = [0.52, 1.0, 0.34], V = [0.62, 0.42, 1.0];
  const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const cen = 1 - sm(20, 36, Math.max(Math.abs(x), Math.abs(z)));
  const c = lerp(lerp(lerp(M, L, wx), lerp(A, C, wx), wz), V, cen);
  return out.setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace);
}

/* ───────── ruinas: piedra oscura con grietas de luz (sombreado plano por derivadas) ───────── */
export function ruinMaterial() {
  return finish(new THREE.ShaderMaterial({
    defines: { FBM_OCT: 2 },
    uniforms: { uTime },
    vertexShader: `varying vec3 vWP; varying vec3 vC; varying vec3 vL; varying float vPh;
      void main(){ vec4 p4 = vec4(position, 1.0); vC = vec3(0.6, 0.5, 1.0); vPh = 0.0; vL = position;
        #ifdef USE_INSTANCING
          p4 = instanceMatrix * p4; vPh = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vec4 w = modelMatrix * p4; vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; varying vec3 vWP; varying vec3 vC; varying vec3 vL; varying float vPh; ${NOISE}
      void main(){
        vec3 n = normalize(cross(dFdx(vWP), dFdy(vWP))); vec3 V = cameraPosition - vWP; float dist = length(V); V /= dist;
        if (dot(n, V) < 0.0) n = -n;
        vec3 L = normalize(vec3(0.55, 0.62, -0.45));
        float dif = max(dot(n, L), 0.0), fr = pow(1.0 - max(dot(n, V), 0.0), 2.5);
        float g = vnoise(vWP * 0.5 + vPh * 10.0), g2 = vnoise(vWP * 2.2);
        vec3 stone = mix(vec3(0.05, 0.045, 0.09), vec3(0.15, 0.12, 0.20), g) * (0.6 + 0.6 * g2);
        vec3 col = stone * (0.5 + dif * 1.5) + vec3(0.06, 0.05, 0.14);
        float cr = abs(vnoise(vWP * 0.8 + vec3(0.0, -uTime * 0.2, 0.0)) - 0.5) * 2.0;
        float crack = 1.0 - smoothstep(0.0, 0.10, cr);
        col += vC * crack * (0.6 + 0.5 * sin(uTime * 1.2 + vPh * 6.28)) * 1.1;
        col += vC * fr * 0.30 * (0.5 + 0.5 * n.y);
        col += vec3(1.0, 0.9, 0.8) * pow(max(dot(reflect(-V, n), L), 0.0), 30.0) * 0.25;
        col = mix(col, vec3(0.08, 0.06, 0.18) + vC * 0.05, 1.0 - exp(-dist * dist * ${(HAZE_D * 1.4).toFixed(7)}));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

/* ───────── enredaderas luminosas (cintas que ondulan, con pulsos que bajan) ───────── */
function vineMaterial() {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime },
    vertexShader: `uniform float uTime; varying vec2 vUv; varying vec3 vC; varying float vPh; varying vec3 vWP;
      void main(){ vUv = uv; vC = vec3(0.5, 1.0, 0.8); vPh = 0.0; vec4 p4 = vec4(position, 1.0); float t = clamp(-position.y, 0.0, 1.0);
        vec3 ax = vec3(1.0, 0.0, 0.0), az = vec3(0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          p4 = instanceMatrix * p4; vPh = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          ax = normalize(instanceMatrix[0].xyz); az = normalize(instanceMatrix[2].xyz);
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        p4.xyz += ax * sin(t * 5.0 + vPh * 6.0 + uTime * 0.8) * 0.28 * t + az * (0.10 + 0.34 * t) * (0.6 + 0.4 * sin(uTime * 0.6 + vPh * 9.0 + t * 2.0));
        vec4 w = modelMatrix * p4; vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vC; varying float vPh; varying vec3 vWP;
      void main(){
        float t = 1.0 - vUv.y, e = abs(vUv.x - 0.5) * 2.0;
        float core = pow(1.0 - e, 1.5) * (1.0 - t * 0.5);
        float pulse = pow(0.5 + 0.5 * sin(t * 9.0 - uTime * 2.2 + vPh * 40.0), 3.0);
        float leaf = step(0.0, sin(t * 38.0 + vPh * 20.0)) * smoothstep(0.35, 0.9, e) * 0.35;
        float d = length(cameraPosition - vWP);
        gl_FragColor = vec4(vC * (0.5 + 1.8 * pulse + leaf) * (0.8 + 0.4 * sin(vPh * 30.0 + uTime)), (core + leaf) * 0.85 * (1.0 - smoothstep(60.0, 140.0, d)));
      }`,
  }));
}
function vineGeo() { const g = new THREE.PlaneGeometry(1, 1, 1, 14); g.translate(0, -0.5, 0); g.deleteAttribute('normal'); return g; }

/* ───────── faroles flotantes: cuerpo facetado + resplandor (cartel que mira a la cámara) ───────── */
function lanternMaterials() {
  const body = finish(new THREE.ShaderMaterial({
    uniforms: { uTime },
    vertexShader: `uniform float uTime; varying vec3 vC; varying vec3 vN; varying vec3 vV; varying float vPh;
      void main(){ vec4 p4 = vec4(position, 1.0); vC = vec3(1.0); vPh = 0.0;
        #ifdef USE_INSTANCING
          vPh = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          p4 = instanceMatrix * p4; p4.y += sin(uTime * 0.9 + vPh * 6.28) * 0.45;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vec4 mv = viewMatrix * modelMatrix * p4; vN = normalize(mat3(viewMatrix) * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime; varying vec3 vC; varying vec3 vN; varying vec3 vV; varying float vPh;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
        float fl = 0.8 + 0.2 * sin(uTime * 3.0 + vPh * 30.0);
        gl_FragColor = vec4(mix(vC * 1.5 * fl, vec3(1.0, 0.97, 0.9), 0.55 - f * 0.45), 1.0); }`,
  }));
  const glow = finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime, uSize: { value: 5.5 } },
    vertexShader: `uniform float uTime, uSize; varying vec2 vUv; varying vec3 vC; varying float vPh;
      void main(){ vUv = uv; vC = vec3(1.0); vPh = 0.0; vec3 c = vec3(0.0);
        #ifdef USE_INSTANCING
          c = instanceMatrix[3].xyz; vPh = fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); c.y += sin(uTime * 0.9 + vPh * 6.28) * 0.45;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vec3 rt = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 w = c + (rt * position.x + up * position.y) * uSize * (0.9 + 0.15 * sin(uTime * 2.0 + vPh * 20.0));
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vC; void main(){ float r = length(vUv - 0.5) * 2.0; float a = pow(max(1.0 - r, 0.0), 2.4); gl_FragColor = vec4(vC * (0.9 + a), a * 0.55); }`,
  }));
  return { body, glow };
}

/* ───────── mariposas de luz: dos alas que aletean y vuelan en círculos (todo en el vertex shader) ───────── */
function butterflyMaterial() {
  return finish(new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime },
    vertexShader: `uniform float uTime; attribute float aWing; varying vec3 vC; varying vec2 vP; varying float vPh;
      void main(){ vC = vec3(1.0, 0.6, 0.9); vP = position.xz; vec3 c = vec3(0.0); float ph = 0.0, rad = 2.0, spd = 0.6;
        #ifdef USE_INSTANCING
          c = instanceMatrix[3].xyz; ph = fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); rad = 1.2 + ph * 2.6; spd = 0.35 + ph * 0.5;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vPh = ph;
        float ang = uTime * spd * (ph > 0.5 ? 1.0 : -1.0) + ph * 40.0;
        vec3 off = vec3(cos(ang) * rad, sin(ang * 1.7) * 0.7 + sin(uTime * 0.7 + ph * 9.0) * 0.4, sin(ang) * rad);
        float yaw = -ang + (ph > 0.5 ? 1.5708 : -1.5708);
        float fl = sin(uTime * (14.0 + ph * 6.0) + ph * 30.0) * 0.95;
        vec3 p = position * 0.55; float a = fl * aWing;
        p = vec3(p.x * cos(a), p.y + abs(p.x) * sin(abs(a)) * 0.9, p.z);
        float cy = cos(yaw), sy = sin(yaw); p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
        gl_Position = projectionMatrix * viewMatrix * vec4(c + off + p, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec3 vC; varying vec2 vP; varying float vPh;
      void main(){ float r = length(vP * vec2(1.0, 0.9)); float a = smoothstep(1.1, 0.2, r);
        float spot = smoothstep(0.55, 0.45, length(vP - vec2(0.55, 0.25)));
        gl_FragColor = vec4(vC * (1.0 + spot * 1.2 + (1.0 - r) * 0.5), a * 0.85); }`,
  }));
}
function butterflyGeo() { // dos alas triangulares-romboidales; aWing = ±1 (lado)
  const pos = [], wing = [];
  for (const s of [-1, 1]) { const v = [[0, 0, 0.0], [s * 1.0, 0, 0.7], [s * 1.0, 0, -0.5], [s * 0.35, 0, -0.9]]; for (const k of [[0, 1, 2], [0, 2, 3]]) for (const i of k) { pos.push(...v[i]); wing.push(s); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1)); return g;
}

/* ───────── portales: anillo con runas que gira, vórtice, almohadilla en el suelo y resplandor ───────── */
function portalMaterials() {
  const ring = finish(new THREE.ShaderMaterial({
    uniforms: { uTime },
    vertexShader: `uniform float uTime; varying vec2 vUv; varying vec3 vC; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vC = vec3(1.0); vec4 p4 = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p4 = instanceMatrix * p4; vC = instanceColor;
        #endif
        vec4 mv = viewMatrix * modelMatrix * p4; vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vC; varying vec3 vN; varying vec3 vV;
      void main(){
        float seg = smoothstep(0.35, 0.65, sin(vUv.x * 6.2832 * 18.0 - uTime * 2.5) * 0.5 + 0.5);
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
        vec3 col = vC * (0.45 + 1.4 * seg) * (0.6 + 0.8 * f) + vec3(0.9) * f * 0.3;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  const disc = finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime },
    vertexShader: `varying vec2 vUv; varying vec3 vC; varying float vK; attribute float aKind;
      void main(){ vUv = uv; vC = vec3(1.0); vK = aKind; vec4 p4 = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p4 = instanceMatrix * p4;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * p4; }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vC; varying float vK;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0; float r = length(p), a = atan(p.y, p.x);
        if (vK < 0.5) {
          float sw = a * 2.0 + 5.5 * log(r + 0.08) - uTime * 3.0;
          float arms = 0.5 + 0.5 * sin(sw * 1.5), arms2 = 0.5 + 0.5 * sin(a * 3.0 - 7.0 * r + uTime * 2.2);
          float core = exp(-r * 3.2), rip = 0.5 + 0.5 * sin(r * 26.0 - uTime * 5.0);
          vec3 col = vC * (0.25 + 0.9 * arms * (1.0 - r * 0.5) + 0.5 * arms2 * r) + vec3(1.0, 0.95, 0.9) * core * 0.7 + vC * rip * 0.18 * (1.0 - r);
          gl_FragColor = vec4(col, smoothstep(1.0, 0.80, r) * (0.50 + 0.45 * arms + core * 0.4));
        } else {
          float ring = smoothstep(0.08, 0.0, abs(fract(r * 2.2 + uTime * 0.5) - 0.5) - 0.40) * smoothstep(1.0, 0.3, r);
          float edge = smoothstep(0.06, 0.0, abs(r - 0.9)), tick = smoothstep(0.55, 0.6, sin(a * 24.0 + uTime) * 0.5 + 0.5) * smoothstep(0.04, 0.0, abs(r - 0.72));
          gl_FragColor = vec4(vC * (0.6 + 1.2 * ring + 1.4 * edge + tick), (0.07 * smoothstep(1.0, 0.0, r) + 0.30 * ring + 0.5 * edge + 0.4 * tick) * smoothstep(1.0, 0.92, r));
        }
      }`,
  }));
  return { ring, disc };
}

/* ───────── geometrías de ruinas ───────── */
const flat = (g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); n.deleteAttribute('normal'); return n; };
function statueGeo() { // pedestal + torso + hombros + cabeza (se ve "rota" al escalarla distinto y hundirla)
  const parts = [];
  const add = (g, x, y, z, rz = 0) => { g.rotateZ(rz); g.translate(x, y, z); parts.push(flat(g)); };
  add(new THREE.BoxGeometry(1.3, 0.5, 1.3), 0, 0.25, 0);
  add(new THREE.CylinderGeometry(0.42, 0.56, 1.5, 7), 0, 1.25, 0);
  add(new THREE.BoxGeometry(1.25, 0.28, 0.5), 0, 2.1, 0, 0.12);
  add(new THREE.SphereGeometry(0.3, 7, 5), 0.05, 2.5, 0);
  add(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 5), 0.78, 1.7, 0, -0.5);   // brazo roto
  return mergeGeometries(parts, false);
}
function obeliskGeo() {
  const shaft = flat(new THREE.CylinderGeometry(0.55, 0.85, 0.86, 4, 1)); shaft.translate(0, 0.43, 0);
  const tip = flat(new THREE.ConeGeometry(0.55, 0.14, 4)); tip.translate(0, 0.93, 0);
  return mergeGeometries([shaft, tip], false);
}

/** Construye todo el decorado. Devuelve { crystalList } para que map3 pueda sumar más cristales antes de instanciar. */
export function buildMazeProps(r, root, map, { sunDir }) {
  const q = cfg(), deco = q.decor, med = q.lights >= 3, hi = q.shadows;
  const rd = rng(3033);
  const lvl = (lo, mid, hi_) => (hi ? hi_ : med ? mid : lo);
  const slabH = 74;
  const inst = (geo, mat, list, setup, { shadow = false } = {}) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length); im.frustumCulled = false;
    list.forEach((it, i) => setup(im, i, it)); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    if (shadow && hi) { im.castShadow = true; }
    root.add(im); return im;
  };
  const place = (m, i, pos, up, sx, sy, sz, spin = 0) => { _q.setFromUnitVectors(_up, up); if (spin) { _q2.setFromAxisAngle(up, spin); _q.premultiply(_q2); } _m.compose(pos, _q, _s.set(sx, sy, sz)); m.setMatrixAt(i, _m); };
  const zcol = (x, z, k = 1) => { zoneColor(x, z, _c); return _c.clone().multiplyScalar(k); };
  const rnd = (a, b) => a + rd() * (b - a);
  const dir = (j = 0.5) => new THREE.Vector3(rd() - 0.5, rd() - 0.5, rd() - 0.5).multiplyScalar(j);

  /* ── cristales (todos en una sola malla instanciada) ── */
  const cr = [];
  const addCr = (pos, up, w, h, col) => cr.push({ pos, up, w, h, col });
  // colgando de la panza de la losa (tallos de cristal hacia el vacío)
  for (let i = 0, n = lvl(34, 60, 96); i < n; i++) {
    const e = rd() < 0.55; // más densos hacia el borde
    const x = e ? (rd() < 0.5 ? -1 : 1) * rnd(55, slabH) : rnd(-slabH, slabH), z = e ? rnd(-slabH, slabH) : (rd() < 0.5 ? -1 : 1) * rnd(55, slabH);
    const sw = rd() < 0.5; const px = sw ? z : x, pz = sw ? x : z;
    const h = rnd(6, 34) * (e ? 1.1 : 0.8), w = rnd(1.3, 4.0);
    addCr(new THREE.Vector3(px, -5.9, pz), new THREE.Vector3(0, -1, 0).add(dir(0.35)).normalize(), w, h, zcol(px, pz, 1.05));
  }
  // brotando de los costados de la losa
  for (let i = 0, n = lvl(26, 44, 70); i < n; i++) {
    const side = Math.floor(rd() * 4), s = rnd(-slabH, slabH), y = rnd(-5.4, -0.6);
    const o = [[slabH, y, s, 1, 0], [-slabH, y, s, -1, 0], [s, y, slabH, 0, 1], [s, y, -slabH, 0, -1]][side];
    const out = new THREE.Vector3(o[3], 0, o[4]);
    addCr(new THREE.Vector3(o[0], o[1], o[2]), out.clone().multiplyScalar(0.9).add(new THREE.Vector3(0, rnd(-0.5, 0.9), 0)).add(dir(0.3)).normalize(), rnd(0.9, 2.4), rnd(3, 11), zcol(o[0], o[2], 1.1));
  }
  // coronando los muros y a sus pies
  const wl = map.walls;
  const alongWall = (w) => { const lx = w.h.x > w.h.z; const a = lx ? w.h.x : w.h.z; const t = rnd(-a + 1, a - 1); return lx ? new THREE.Vector3(w.c.x + t, 0, w.c.z) : new THREE.Vector3(w.c.x, 0, w.c.z + t); };
  for (let i = 0, n = lvl(22, 60, 110); i < n; i++) { const w = wl[Math.floor(rd() * wl.length)], p = alongWall(w); p.y = w.c.y + w.h.y - 0.1; const sc = rnd(0.5, 1.4);
    addCr(p, new THREE.Vector3(0, 1, 0).add(dir(0.9)).normalize(), sc * 0.55, sc * rnd(1.3, 3.0), zcol(p.x, p.z, 1.15)); }
  for (let i = 0, n = lvl(20, 70, 130); i < n; i++) { const w = wl[Math.floor(rd() * wl.length)], p = alongWall(w), lx = w.h.x > w.h.z, sg = rd() < 0.5 ? 1 : -1;
    if (lx) p.z += sg * (w.h.z + rnd(0.15, 0.6)); else p.x += sg * (w.h.x + rnd(0.15, 0.6));
    p.y = 0; const sc = rnd(0.25, 0.75); addCr(p, new THREE.Vector3(0, 1, 0).add(dir(0.7)).normalize(), sc * 0.5, sc * rnd(1.4, 2.6), zcol(p.x, p.z, 1.2)); }

  /* ── islotes flotantes: roca + cristales + estatua rota + pilar o arco (y puentes) ── */
  const R = new THREE.Vector3();
  const rocks = [], stat = [], pill = [], arch = [], slab = [], oris = [];
  const nIsl = lvl(7, 12, 18);
  for (let i = 0; i < nIsl; i++) {
    const a = (i / nIsl) * 6.2832 + rnd(-0.2, 0.2), d = rnd(100, 250), y = rnd(-46, 62);
    const pos = new THREE.Vector3(Math.cos(a) * d, y, Math.sin(a) * d), s = rnd(7, 19);
    const col = zcol(pos.x, pos.z, 1);
    rocks.push({ pos, s, ax: dir(1).normalize(), ang: rd() * 6, col });
    const top = pos.clone().add(new THREE.Vector3(0, s * 0.42, 0));
    for (let k = 0, n = 2 + Math.floor(rd() * 3); k < n; k++) addCr(top.clone().add(new THREE.Vector3(rnd(-0.3, 0.3) * s, 0, rnd(-0.3, 0.3) * s)), new THREE.Vector3(0, 1, 0).add(dir(0.8)).normalize(), rnd(1.0, 2.2) * s / 12, rnd(3, 8) * s / 12, col);
    if (rd() < 0.7) stat.push({ pos: top.clone().add(new THREE.Vector3(rnd(-0.2, 0.2) * s, -0.2, rnd(-0.2, 0.2) * s)), s: rnd(1.4, 3.0), yaw: rd() * 6, tilt: rnd(-0.25, 0.25), col });
    if (rd() < 0.5) pill.push({ pos: top.clone().add(new THREE.Vector3(rnd(-0.25, 0.25) * s, 0, rnd(-0.25, 0.25) * s)), h: rnd(4, 10), w: rnd(0.9, 1.6), tilt: rnd(-0.18, 0.18), col });
    else arch.push({ pos: top.clone().add(new THREE.Vector3(0, -0.4, 0)), s: rnd(3, 6), yaw: rd() * 6, col });
  }
  // columnas y arcos sueltos a la deriva (ruinas de un templo roto)
  for (let i = 0, n = lvl(5, 10, 16); i < n; i++) { const a = rd() * 6.2832, d = rnd(88, 190), pos = new THREE.Vector3(Math.cos(a) * d, rnd(-30, 50), Math.sin(a) * d);
    if (rd() < 0.55) pill.push({ pos, h: rnd(6, 16), w: rnd(1, 2), tilt: rnd(-0.6, 0.6), col: zcol(pos.x, pos.z), free: true });
    else arch.push({ pos, s: rnd(4, 9), yaw: rd() * 6, col: zcol(pos.x, pos.z), roll: rnd(-0.5, 0.5) }); }
  // puentes rotos: tramos de losas que flotan en arco alrededor de la losa
  for (let b = 0, nb = lvl(2, 3, 5); b < nb; b++) {
    const a0 = rnd(0, 6.28), span = rnd(0.5, 0.9), d = rnd(86, 120), y0 = rnd(-14, 8), n = 9 + Math.floor(rd() * 5);
    for (let k = 0; k < n; k++) { if (rd() < 0.15) continue; const a = a0 + (k / n) * span; slab.push({ pos: new THREE.Vector3(Math.cos(a) * d, y0 + Math.sin(k * 0.7) * 0.8 + rnd(-0.4, 0.4), Math.sin(a) * d), yaw: -a + 1.5708 + rnd(-0.05, 0.05), sx: 3.2, sy: 0.55, sz: (span * d / n) * 0.85, col: zcol(Math.cos(a) * d, Math.sin(a) * d, 1) }); }
  }
  void R; void oris;

  const ruin = ruinMaterial();
  const yawQ = (yaw, roll = 0, pitch = 0) => _q.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
  inst(debrisGeo(2, 5), ruin, rocks, (m, i, it) => { _q.setFromAxisAngle(it.ax, it.ang); _m.compose(it.pos, _q, _s.set(it.s, it.s * 0.9, it.s)); m.setMatrixAt(i, _m); m.setColorAt(i, it.col); }, { shadow: true });
  inst(statueGeo(), ruin, stat, (m, i, it) => { yawQ(it.yaw, it.tilt, 0); _m.compose(it.pos, _q, _s.set(it.s, it.s * (0.7 + (i % 3) * 0.2), it.s)); m.setMatrixAt(i, _m); m.setColorAt(i, it.col); });
  inst(new THREE.CylinderGeometry(0.72, 1, 1, 6, 1), ruin, pill, (m, i, it) => { yawQ(i, it.tilt, it.free ? it.tilt * 0.7 : 0); _m.compose(it.pos.clone().add(new THREE.Vector3(0, it.h / 2, 0)), _q, _s.set(it.w, it.h, it.w)); m.setMatrixAt(i, _m); m.setColorAt(i, it.col); });
  inst(new THREE.TorusGeometry(1, 0.13, 6, 18, Math.PI), ruin, arch, (m, i, it) => { yawQ(it.yaw, it.roll || 0); _m.compose(it.pos, _q, _s.set(it.s, it.s * 1.15, it.s * 0.8)); m.setMatrixAt(i, _m); m.setColorAt(i, it.col); });
  inst(new THREE.BoxGeometry(1, 1, 1), ruin, slab, (m, i, it) => { yawQ(it.yaw, rnd(-0.05, 0.05)); _m.compose(it.pos, _q, _s.set(it.sx, it.sy, it.sz)); m.setMatrixAt(i, _m); m.setColorAt(i, it.col); });

  /* ── plaza central: ocho obeliscos que flotan, anillos de giroscopio, cristal mayor ── */
  const obs = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.2832 + 0.39, c = zcol(0, 0, 1.0); obs.push({ pos: new THREE.Vector3(Math.cos(a) * 21.5, 5.5, Math.sin(a) * 21.5), a, col: i % 2 ? new THREE.Color(1.0, 0.45, 0.85) : new THREE.Color(0.55, 0.45, 1.0), c }); }
  inst(obeliskGeo(), ruin, obs, (m, i, it) => { yawQ(it.a + 0.785); _m.compose(it.pos, _q, _s.set(2.3, 13, 2.3)); m.setMatrixAt(i, _m); m.setColorAt(i, it.col); }, { shadow: true });
  for (const o of obs) addCr(o.pos.clone().add(new THREE.Vector3(0, 15.5, 0)), new THREE.Vector3(0, 1, 0), 0.9, 3.4, o.col.clone().multiplyScalar(1.1));
  addCr(new THREE.Vector3(0, 17.6, 0), new THREE.Vector3(0, 1, 0), 2.4, 7.0, new THREE.Color(0.8, 0.6, 1.0));
  const gyro = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.045, 6, 64), ruin, 3); gyro.frustumCulled = false; root.add(gyro);
  gyro.setColorAt(0, new THREE.Color(0.6, 0.45, 1.0)); gyro.setColorAt(1, new THREE.Color(1.0, 0.5, 0.85)); gyro.setColorAt(2, new THREE.Color(1.0, 0.8, 0.5));
  const gq = new THREE.Quaternion(), ge = new THREE.Euler();
  const gyroR = [7.2, 10.2, 13.4];
  r.dyn.push((dt, t) => {
    for (let i = 0; i < 3; i++) { ge.set(t * (0.13 + i * 0.07) + i * 2.1, t * (0.11 - i * 0.05) + i, t * 0.09 * (i + 1)); gq.setFromEuler(ge); _m.compose(_p.set(0, 16 + Math.sin(t * 0.3 + i) * 0.6, 0), gq, _s.set(gyroR[i], gyroR[i], gyroR[i])); gyro.setMatrixAt(i, _m); }
    gyro.instanceMatrix.needsUpdate = true;
  });

  // cristales: una sola malla para todos
  inst(crystalGeo(), crystalMat({ haze: 0x180f38, hazeDens: HAZE_D, sun: sunDir.toArray(), glow: 1.15 }), cr, (m, i, it) => { place(m, i, it.pos, it.up, it.w, it.h, it.w, i * 1.7); m.setColorAt(i, it.col); });

  /* ── enredaderas: cuelgan de los muros (caras que miran a un pasillo) y del borde de la losa ── */
  const vines = [];
  const nv = lvl(36, 90, 160);
  for (let i = 0; i < nv; i++) {
    const w = wl[Math.floor(rd() * wl.length)], lx = w.h.x > w.h.z, sg = rd() < 0.5 ? 1 : -1, p = alongWall(w), nrm = lx ? new THREE.Vector3(0, 0, sg) : new THREE.Vector3(sg, 0, 0);
    if (Math.abs(w.c.x) > 70 && nrm.x * Math.sign(w.c.x) > 0) continue; if (Math.abs(w.c.z) > 70 && nrm.z * Math.sign(w.c.z) > 0) continue;
    p.addScaledVector(nrm, (lx ? w.h.z : w.h.x) + 0.06); p.y = rnd(7, 12);
    vines.push({ pos: p, nrm, len: rnd(2.5, 8.5), wd: rnd(0.14, 0.3), col: zcol(p.x, p.z, 1.15) });
  }
  for (let i = 0, n = lvl(12, 30, 56); i < n; i++) { const side = Math.floor(rd() * 4), s = rnd(-slabH, slabH), o = [[slabH, s, 1, 0], [-slabH, s, -1, 0], [s, slabH, 0, 1], [s, -slabH, 0, -1]][side];
    vines.push({ pos: new THREE.Vector3(o[0], -0.2, o[1]), nrm: new THREE.Vector3(o[2], 0, o[3]), len: rnd(5, 18), wd: rnd(0.2, 0.5), col: zcol(o[0], o[1], 1.1) }); }
  inst(vineGeo(), vineMaterial(), vines, (m, i, it) => {
    const nz = it.nrm.clone(), ny = new THREE.Vector3(0, 1, 0), nx = new THREE.Vector3().crossVectors(ny, nz).normalize();
    _m.makeBasis(nx.multiplyScalar(it.wd), ny.multiplyScalar(it.len), nz).setPosition(it.pos); m.setMatrixAt(i, _m); m.setColorAt(i, it.col);
  });

  /* ── faroles flotantes y mariposas dentro de las celdas ── */
  const cellPoint = (margin, y0, y1) => { const cx = Math.floor(rd() * 9), cz = Math.floor(rd() * 9); return new THREE.Vector3(-72 + cx * 16 + rnd(margin, 16 - margin), rnd(y0, y1), -72 + cz * 16 + rnd(margin, 16 - margin)); };
  const lan = []; for (let i = 0, n = lvl(14, 30, 48); i < n; i++) { const p = cellPoint(3, 4.2, 9); lan.push({ pos: p, col: zcol(p.x, p.z, 1) }); }
  const lm = lanternMaterials();
  inst(new THREE.OctahedronGeometry(0.4, 0), lm.body, lan, (m, i, it) => { _m.compose(it.pos, _q.identity(), _s.set(1, 1.4, 1)); m.setMatrixAt(i, _m); m.setColorAt(i, it.col); });
  const gm = inst(new THREE.PlaneGeometry(1, 1), lm.glow, lan, (m, i, it) => { _m.setPosition(it.pos); m.setMatrixAt(i, _m); m.setColorAt(i, it.col); }); if (gm) gm.renderOrder = 6;
  const bf = []; for (let i = 0, n = lvl(14, 36, 64); i < n; i++) { const p = cellPoint(4, 1.4, 5.5); bf.push({ pos: p, col: new THREE.Color().setHSL(rd(), 1, 0.62) }); }
  const bm = inst(butterflyGeo(), butterflyMaterial(), bf, (m, i, it) => { _m.setPosition(it.pos); m.setMatrixAt(i, _m); _c.copy(it.col); m.setColorAt(i, _c); }); if (bm) bm.renderOrder = 6;

  // luciérnagas (puntos a la deriva), una cálida y una fría
  const mk = (n, col, size, seed) => { const g = particleGeo(n, (k, rr) => [rnd(-72, 72), rr() * 10 + 0.4, rnd(-72, 72)], seed); const pt = new THREE.Points(g, particleMat({ color: col, size, mode: 1, amp: 2.6, alpha: 0.9 })); pt.frustumCulled = false; root.add(pt); };
  mk(lvl(80, 200, 340), 0xffe2a0, 0.26, 21); if (deco) mk(lvl(0, 120, 220), 0x9fe8ff, 0.22, 33);

  /* ── portales ── */
  buildPortals(r, root, map, { zcol, deco });
  return {};
}

function buildPortals(r, root, map, { zcol, deco }) {
  const mats = portalMaterials(), ends = [];
  map.portals.forEach((po) => { const c = new THREE.Color().setHSL(po.hue, 1, 0.62); const o = {}; c.getRGB(o, THREE.SRGBColorSpace); const col = new THREE.Color().setRGB(o.r, o.g, o.b, THREE.LinearSRGBColorSpace);
    for (const e of [po.a, po.b]) ends.push({ pos: new THREE.Vector3(e.x, e.y + 1.0, e.z), yaw: Math.atan2(-e.x, -e.z), rad: po.r, col }); });
  const mkI = (geo, mat, setup, order) => { const im = new THREE.InstancedMesh(geo, mat, ends.length); im.frustumCulled = false; ends.forEach((e, i) => setup(im, i, e)); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; if (order) im.renderOrder = order; root.add(im); return im; };
  const tor = new THREE.TorusGeometry(1, 0.075, 8, deco ? 56 : 32);
  const ringG = tor;
  const compose = (e, k) => { _q.setFromAxisAngle(_up, e.yaw); return _m.compose(e.pos, _q, _s.set(e.rad * k, e.rad * k, e.rad * k)); };
  mkI(ringG, mats.ring, (m, i, e) => { m.setMatrixAt(i, compose(e, 0.97)); m.setColorAt(i, e.col); });
  mkI(new THREE.TorusGeometry(1, 0.03, 6, deco ? 56 : 32), mats.ring, (m, i, e) => { m.setMatrixAt(i, compose(e, 1.28)); m.setColorAt(i, e.col); });
  const dg = new THREE.CircleGeometry(0.95, deco ? 48 : 24); dg.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(dg.attributes.position.count), 1)); dg.deleteAttribute('normal');
  mkI(dg, mats.disc, (m, i, e) => { m.setMatrixAt(i, compose(e, e.rad / 0.95 * 0.95)); m.setColorAt(i, e.col); }, 4);
  const pg = new THREE.CircleGeometry(1, deco ? 40 : 20); pg.rotateX(-Math.PI / 2); pg.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(pg.attributes.position.count).fill(1), 1)); pg.deleteAttribute('normal');
  mkI(pg, mats.disc, (m, i, e) => { _m.compose(_p.set(e.pos.x, 0.06, e.pos.z), _q.identity(), _s.set(e.rad * 1.9, 1, e.rad * 1.9)); m.setMatrixAt(i, _m); m.setColorAt(i, e.col); }, 3);
  if (deco) { // chispas en espiral hacia cada portal
    ends.forEach((e) => { const g = particleGeo(26, () => [0, 0, 0], 11); const pt = new THREE.Points(g, particleMat({ color: 0xffffff, size: 0.2, mode: 2, speed: 0.4, amp: e.rad * 1.4, height: 0.8, alpha: 0.95 }));
      pt.material.uniforms.uColor.value.copy(e.col).multiplyScalar(1.4); pt.position.copy(e.pos); pt.rotation.y = e.yaw; pt.frustumCulled = false; root.add(pt); });
  }
  void zcol;
}
