import * as THREE from 'three';
import { uTime, finish } from '../shaders.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE } from './glsl.js';
import { rng, fbm3 } from './noise.js';

// Piezas reutilizables del entorno: cristales/hongos/raíces instanciados, cascadas de luz, partículas, texturas de canvas.

/** Color "de pantalla": los canales sRGB tal cual (los ShaderMaterial propios hacen pow(2.2) en finish()). */
export const dc = (hex) => { const c = new THREE.Color(); c.setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, THREE.LinearSRGBColorSpace); return c; };

/** Píxeles por unidad a 1 m de distancia (alto del buffer * ½ * cot(fov/2)); lo actualiza trackPx(). */
export const uPx = { value: 600 };
export function trackPx(r) { const v = new THREE.Vector2(); r.dyn.push(() => { r.gl.getDrawingBufferSize(v); uPx.value = v.y * 0.5 * r.camera.projectionMatrix.elements[5]; }); }

/* ───────── cristal hexagonal instanciable (base en y=0, punta en y=1) ───────── */
export function crystalGeo() {
  const pts = [new THREE.Vector2(0.0, 0), new THREE.Vector2(0.5, 0.0), new THREE.Vector2(0.5, 0.68), new THREE.Vector2(0.0, 1.0)];
  const g = new THREE.LatheGeometry(pts, 6).toNonIndexed(); g.deleteAttribute('uv'); g.computeVertexNormals(); return g;
}
export function crystalMat({ haze = 0x2a2060, hazeDens = 0.0000028, sun = [0.4, 1, -0.5], glow = 1 } = {}) {
  return finish(new THREE.ShaderMaterial({
    uniforms: { uTime, uSun: { value: new THREE.Vector3(...sun).normalize() }, uHaze: { value: dc(haze) }, uHazeD: { value: hazeDens }, uGlow: { value: glow } },
    vertexShader: `varying vec3 vWP; varying vec3 vC; varying float vY; varying float vPh;
      void main(){ vec4 p4 = vec4(position, 1.0); vY = position.y; vC = vec3(0.4, 1.0, 0.9); vPh = 0.0;
        #ifdef USE_INSTANCING
          p4 = instanceMatrix * p4; vPh = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vec4 w = modelMatrix * p4; vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uHazeD, uGlow; uniform vec3 uSun, uHaze; varying vec3 vWP; varying vec3 vC; varying float vY; varying float vPh;
      void main(){
        vec3 n = normalize(cross(dFdx(vWP), dFdy(vWP))); vec3 V = cameraPosition - vWP; float dist = length(V); V /= dist;
        if (dot(n, V) < 0.0) n = -n;
        float fr = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.5);
        float dif = max(dot(n, uSun), 0.0);
        float pulse = 0.75 + 0.25 * sin(uTime * 1.7 + vPh * 6.2831);
        vec3 col = vC * (0.10 + 0.55 * dif);                                     // cuerpo: oscuro, saturado
        col += vC * (0.55 + 1.5 * smoothstep(0.1, 1.0, vY)) * pulse * 0.75 * uGlow; // luz interior que sube a la punta
        col = mix(col, vec3(0.75, 0.95, 1.0) * 1.1, fr * 0.55);                  // borde de vidrio
        vec3 R = reflect(-V, n); col += vec3(1.0) * pow(max(dot(R, uSun), 0.0), 40.0) * 1.5; // destello
        float f = 1.0 - exp(-dist * dist * uHazeD); col = mix(col, uHaze, f);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

/* ───────── hongo luminoso (tallo y sombrero) ───────── */
export function mushroomGeo() {
  const stem = new THREE.CylinderGeometry(0.07, 0.1, 0.5, 6, 1, true); stem.translate(0, 0.25, 0);
  const cap = new THREE.SphereGeometry(0.34, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.62, 1); cap.translate(0, 0.46, 0);
  for (const g of [stem, cap]) { g.deleteAttribute('uv'); g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(g === cap ? 1 : 0), 1)); }
  return mergeGeometries([stem.index ? stem.toNonIndexed() : stem, cap.index ? cap.toNonIndexed() : cap], false);
}
export function mushroomMat({ haze = 0x2a2060, hazeDens = 0.0000028 } = {}) {
  return finish(new THREE.ShaderMaterial({
    uniforms: { uTime, uHaze: { value: dc(haze) }, uHazeD: { value: hazeDens } },
    vertexShader: `attribute float aPart; varying vec3 vWP; varying vec3 vC; varying float vPart; varying float vPh; varying vec3 vN;
      void main(){ vec4 p4 = vec4(position, 1.0); vec3 n = normal; vC = vec3(0.4, 1.0, 0.8); vPh = 0.0; vPart = aPart;
        #ifdef USE_INSTANCING
          p4 = instanceMatrix * p4; n = mat3(instanceMatrix) * n; vPh = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vN = normalize(mat3(modelMatrix) * n); vec4 w = modelMatrix * p4; vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uHazeD; uniform vec3 uHaze; varying vec3 vWP; varying vec3 vC; varying float vPart; varying float vPh; varying vec3 vN;
      void main(){
        vec3 V = cameraPosition - vWP; float dist = length(V); V /= dist; vec3 n = normalize(vN);
        float pulse = 0.7 + 0.3 * sin(uTime * 1.3 + vPh * 6.2831);
        float fr = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.0);
        vec3 col = mix(vec3(0.10, 0.09, 0.12) + vC * 0.05, vC * (0.9 + 0.8 * fr) * pulse * 1.3, vPart);
        col += vC * fr * 0.4 * vPart;
        float f = 1.0 - exp(-dist * dist * uHazeD); col = mix(col, uHaze, f);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

/* ───────── raíces colgantes: cono fino que se curva y se mece en el vertex shader ───────── */
export function rootGeo() {
  const g = new THREE.ConeGeometry(0.03, 1, 5, 10, true); g.rotateX(Math.PI); g.translate(0, -0.5, 0); g.deleteAttribute('uv'); return g;
}
export function rootMat({ haze = 0x2a2060, hazeDens = 0.0000028 } = {}) {
  return finish(new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime, uHaze: { value: dc(haze) }, uHazeD: { value: hazeDens } },
    vertexShader: `uniform float uTime; varying vec3 vWP; varying vec3 vC; varying float vT; varying float vPh;
      void main(){ vec3 p = position; float t = clamp(-p.y, 0.0, 1.0); vT = t; vC = vec3(0.4, 1.0, 0.8); vPh = 0.0;
        float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453); vPh = ph;
        #endif
        p.x += (0.10 * sin(t * 3.2 + ph * 6.0) + 0.05 * sin(uTime * 0.9 + ph * 20.0 + t * 2.0)) * t * 1.5 + 0.12 * t * t;
        p.z += 0.07 * sin(t * 2.4 + ph * 9.0 + uTime * 0.7) * t;
        vec4 p4 = vec4(p, 1.0);
        #ifdef USE_INSTANCING
          p4 = instanceMatrix * p4;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        vec4 w = modelMatrix * p4; vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uHazeD; uniform vec3 uHaze; varying vec3 vWP; varying vec3 vC; varying float vT; varying float vPh;
      void main(){
        float dist = length(cameraPosition - vWP);
        vec3 col = mix(vec3(0.07, 0.04, 0.05), vec3(0.16, 0.10, 0.09), vT);
        float tip = smoothstep(0.62, 1.0, vT); col += vC * tip * (1.0 + 0.7 * sin(uTime * 1.6 + vPh * 6.28)) * 1.4;
        float f = 1.0 - exp(-dist * dist * uHazeD); col = mix(col, uHaze, f);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

/* ───────── cascada de luz / polvo que cae al vacío (aditiva) ───────── */
export function fallMat(color, speed = 1) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime, uColor: { value: dc(color) }, uSpeed: { value: speed } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uSpeed; uniform vec3 uColor; varying vec2 vUv; ${NOISE}
      void main(){
        float x = vUv.x, y = vUv.y; // y: 1 arriba (borde de isla) → 0 abajo
        float cols = 18.0, c = floor(x * cols), h = hash13(vec3(c, 3.0, 7.0));
        float s = 0.0;
        for (int i = 0; i < 3; i++) { float fi = float(i); float k = 5.0 + fi * 4.0 + h * 3.0;
          float f = fract(y * k * 3.0 + uTime * uSpeed * (0.35 + 0.25 * fi + h * 0.3) + h * 9.0 + fi * 0.37);
          s += smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.05, 0.35, f)) * (0.4 + 0.6 * hash13(vec3(c, fi, 1.0))); }
        float colMask = smoothstep(0.1, 0.5, abs(fract(x * cols) - 0.5)); // rendijas entre hebras
        colMask = 1.0 - colMask * 0.5;
        float wmask = pow(1.0 - abs(x - 0.5) * 2.0, 1.5);
        float lenFade = pow(y, 1.6);
        float haze = vnoise(vec3(x * 6.0, y * 3.0 - uTime * 0.2 * uSpeed, 0.0)) * 0.5 + 0.2;
        float a = (s * 0.8 + haze * 0.35) * wmask * lenFade * colMask;
        gl_FragColor = vec4(uColor * 1.3, a * 0.32);
      }`,
  }));
}

/* ───────── partículas por vertex shader (ascendentes / a la deriva) ───────── */
export function particleMat({ color = 0xffffff, size = 0.4, mode = 0, speed = 0.3, height = 30, amp = 1, alpha = 1, defines = {} } = {}) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, defines: { MODE: mode, ...defines },
    uniforms: { uTime, uPx, uColor: { value: dc(color) }, uSize: { value: size }, uSpeed: { value: speed }, uH: { value: height }, uAmp: { value: amp }, uAlpha: { value: alpha }, uK: { value: 0 } },
    vertexShader: `attribute vec4 aR; uniform float uTime, uPx, uSize, uSpeed, uH, uAmp, uK; varying float vA; varying float vR;
      void main(){ vec3 p = position; vR = aR.w;
        #if MODE == 0
          float ph = fract(aR.x + uTime * uSpeed * (0.6 + 0.8 * aR.y));
          p.y += ph * uH; p.xz += vec2(sin(uTime * 1.3 + aR.w * 40.0), cos(uTime * 1.1 + aR.w * 30.0)) * uAmp * (0.3 + ph);
          vA = sin(ph * 3.14159) ;
        #elif MODE == 1
          float k = 1.0 + uK * 1.5;
          p += vec3(sin(uTime * 0.4 * aR.y * k + aR.w * 60.0), cos(uTime * 0.35 * aR.x * k + aR.w * 20.0), sin(uTime * 0.3 * k + aR.x * 30.0)) * uAmp;
          vA = 0.55 + 0.45 * sin(uTime * (0.8 + aR.y) + aR.w * 30.0);
        #elif MODE == 2
          float ph = fract(aR.x + uTime * uSpeed * (0.6 + 0.8 * aR.y)); // espiral hacia el centro
          float a = aR.w * 6.2831 + ph * 5.0 * (0.6 + aR.y), rr = uAmp * (1.0 - ph) + 0.4;
          p = vec3(cos(a) * rr, (aR.z - 0.5) * uH * (1.0 - ph), sin(a) * rr);
          vA = sin(ph * 3.14159);
        #else
          float ph = fract(aR.x + uTime * uSpeed * (0.6 + 0.8 * aR.y)); // caída hacia un pozo: radio uAmp → uH girando
          float ca = cos(ph * 2.2), sa = sin(ph * 2.2); vec3 nd = normalize(position); nd.xz = mat2(ca, -sa, sa, ca) * nd.xz;
          p = nd * mix(uAmp, uH, ph * ph); vA = sin(ph * 3.14159);
        #endif
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(uSize * aR.z * 2.0 * uPx / max(-mv.z, 0.3), 1.0, 96.0);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying float vA; varying float vR;
      void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0);
        gl_FragColor = vec4(uColor * (1.2 + vR), a * vA * uAlpha); }`,
  }));
}
/** Geometría de n partículas; área dada por fn(i, rnd) → [x,y,z]. */
export function particleGeo(n, fn, seed = 5) {
  const rd = rng(seed), pos = new Float32Array(n * 3), aR = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const p = fn(i, rd); pos.set(p, i * 3); aR.set([rd(), rd(), 0.4 + rd() * 0.9, rd()], i * 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aR', new THREE.BufferAttribute(aR, 4)); return g;
}

/* ───────── texturas de canvas (halo, rayos, destellos de lente) ───────── */
export function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
export function raysTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.translate(w / 2, h / 2);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h);
    const rd = rng(9);
    for (let i = 0; i < 28; i++) { const a = rd() * 6.283, L = (0.35 + rd() * 0.65) * w / 2, wd = 0.01 + rd() * 0.03;
      const lg = g.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L); lg.addColorStop(0, 'rgba(255,255,255,0.55)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - wd) * L, Math.sin(a - wd) * L); g.lineTo(Math.cos(a + wd) * L, Math.sin(a + wd) * L); g.closePath(); g.fill(); }
  });
}
export function streakTex() { // destello horizontal alargado
  return canvasTex(256, 32, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, w, h); });
}
export function ringTex() { return canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 20, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.25)'); gr.addColorStop(0.9, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }); }
export function softTex() { return canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }); }

/** Roca irregular para escombros (icosaedro deformado y soldado → normales suaves). */
export function debrisGeo(detail = 2, seed = 3) {
  let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = fbm3(x * 1.7 + seed, y * 1.7, z * 1.7, 3), c = Math.abs(Math.sin(x * 3 + y * 2 + seed) * Math.cos(z * 2.5)) * 0.12;
    const k = 0.62 + n * 0.7 - c; p.setXYZ(i, x * k, y * k * 0.75, z * k); }
  g.computeVertexNormals(); return g;
}
