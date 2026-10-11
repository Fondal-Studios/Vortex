import * as THREE from 'three';
import { cfg } from '../quality.js';
import { uTime, finish } from '../shaders.js';
import { NOISE } from './glsl.js';
import { ZONES } from './maze-glsl.js';
import { rng } from './noise.js';
import { dc } from './props.js';

// Cielo del Mapa 3: un cosmos con nebulosas de colores, vía láctea, galaxias espirales, un remolino en el cenit,
// mar de nubes teñido, bruma baja entre los muros y planetas lejanos.

export function cosmosSky({ iters = 8 } = {}) {
  const oct = iters <= 4 ? 2 : iters <= 6 ? 3 : 4, full = iters > 4 ? 1 : 0;
  return finish(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, defines: { FBM_OCT: oct, FULL: full },
    uniforms: { uTime },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform float uTime; varying vec3 vDir; ${NOISE}
      const float TAU = 6.2831853;
      vec3 stars(vec3 d, float scale, float thr, float size, float bright){
        vec3 p = d * scale, i = floor(p), f = fract(p) - 0.5, r = hash33(i); float h = hash13(i + 13.7);
        float dd = length(f - (r - 0.5) * 0.7), on = step(thr, h);
        float tw = 0.65 + 0.35 * sin(uTime * (1.0 + r.x * 3.0) + r.y * 40.0);
        float core = smoothstep(size, 0.0, dd), halo = pow(smoothstep(size * 3.0, 0.0, dd), 3.0) * 0.35;
        vec3 tint = mix(vec3(0.65, 0.8, 1.0), vec3(1.0, 0.7, 0.9), r.z);
        return on * (core + halo) * tw * bright * tint * (0.5 + 0.9 * h);
      }
      vec3 galaxy(vec3 d, vec3 c, float size, float rot, float incl, vec3 ca, vec3 cb){
        float vis = smoothstep(0.0, 0.3, dot(d, c)); if (vis <= 0.0) return vec3(0.0);
        vec3 u = normalize(cross(c, vec3(0.0, 1.0, 0.13))), v = cross(c, u);
        vec2 q = vec2(dot(d, u), dot(d, v)) / size; float cr = cos(rot), sr = sin(rot); q = mat2(cr, -sr, sr, cr) * q; q.y /= incl;
        float rr = length(q), a = atan(q.y, q.x);
        float arms = 0.5 + 0.5 * cos(2.0 * (a - 2.4 * log(rr + 0.06)) + uTime * 0.02);
        float disk = exp(-rr * 2.4) * (0.25 + arms * arms * 1.5), core = exp(-rr * 10.0) * 2.4;
        float dust = vnoise(vec3(q * 7.0, 1.0));
        return (mix(ca, cb, smoothstep(0.0, 1.2, rr)) * disk * (0.55 + 0.9 * dust) + vec3(1.0, 0.9, 0.75) * core) * vis * smoothstep(1.5, 0.5, rr);
      }
      void main(){
        vec3 d = normalize(vDir); float t = uTime * 0.02;
        vec3 col = mix(vec3(0.020, 0.012, 0.060), vec3(0.040, 0.030, 0.130), smoothstep(-1.0, 1.0, d.y));
        col += vec3(0.30, 0.10, 0.36) * pow(1.0 - abs(d.y), 5.0) * 0.55;                       // fulgor del horizonte
        vec3 q = d * 2.2;
        float w = fbm(q + vec3(0.0, t, 0.0));
        float n1 = fbm(q * 1.25 + w * 1.5 + 3.0);
        col += mix(vec3(0.95, 0.14, 0.62), vec3(0.18, 0.46, 1.0), smoothstep(0.30, 0.80, n1)) * smoothstep(0.40, 0.86, n1) * 0.62;
        #if FULL
          float n2 = fbm(q * 2.1 - w * 1.2 + 9.0), n3 = fbm(q * 0.9 + 21.0 + vec3(t, 0.0, 0.0));
          col += vec3(0.08, 0.95, 0.80) * smoothstep(0.52, 0.90, n2) * 0.25;
          col += vec3(1.0, 0.68, 0.20) * smoothstep(0.58, 0.93, n3) * 0.20;
        #endif
        // vía láctea
        vec3 m = normalize(vec3(0.35, 1.0, -0.25)); float bnd = dot(d, m);
        float mw = exp(-bnd * bnd * 26.0) * (0.35 + 0.9 * fbm(d * 7.0 + 4.0));
        col += mix(vec3(0.55, 0.40, 0.95), vec3(1.0, 0.75, 0.85), fbm(d * 3.0)) * mw * 0.55;
        // remolino del cenit: el techo del cielo es un ojo-vórtice
        float zen = acos(clamp(d.y, -1.0, 1.0)), za = atan(d.z, d.x);
        float sw = 0.5 + 0.5 * sin(za * 5.0 + 9.0 * log(zen + 0.05) - uTime * 0.25);
        float zm = smoothstep(0.75, 0.0, zen);
        col += mix(vec3(0.3, 0.2, 0.9), vec3(1.0, 0.5, 0.9), sw) * sw * zm * 0.5 + vec3(1.0, 0.9, 1.0) * exp(-zen * 14.0) * 0.8;
        // galaxias espirales
        col += galaxy(d, normalize(vec3(-0.55, 0.38, 0.74)), 0.20, 0.5, 0.55, vec3(0.45, 0.62, 1.0), vec3(1.0, 0.45, 0.8)) * 0.85;
        col += galaxy(d, normalize(vec3(0.7, 0.55, 0.45)), 0.14, 2.2, 0.8, vec3(1.0, 0.75, 0.4), vec3(0.6, 0.35, 1.0)) * 0.8;
        #if FULL
          col += galaxy(d, normalize(vec3(0.1, 0.18, -0.98)), 0.11, 1.0, 0.4, vec3(0.4, 1.0, 0.9), vec3(0.9, 0.4, 1.0)) * 0.7;
        #endif
        // estrellas
        col += stars(d, 90.0, 0.84, 0.10, 1.4) + stars(d, 28.0, 0.80, 0.085, 2.0);
        #if FULL
          col += stars(d, 220.0, 0.88, 0.16, 0.9);
        #endif
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

/** Mar de nubes teñido (plano grande que sigue a la cámara). */
export function cloudMaterial({ c1, c2, scale = 0.006, speed = 0.01, alpha = 0.8, oct = 4, seed = 0, y = 0, near = 5 }) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, defines: { FBM_OCT: oct },
    uniforms: { uTime, uC1: { value: dc(c1) }, uC2: { value: dc(c2) }, uScale: { value: scale }, uSpeed: { value: speed }, uAlpha: { value: alpha }, uSeed: { value: seed }, uNear: { value: near } },
    vertexShader: `varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uScale, uSpeed, uAlpha, uSeed, uNear; uniform vec3 uC1, uC2; varying vec3 vWP; ${NOISE}
      void main(){
        vec3 V = vWP - cameraPosition; float dist = length(V);
        vec2 xz = vWP.xz * uScale + uSeed; float t = uTime * uSpeed;
        vec3 q = vec3(xz.x, t, xz.y);
        float w = fbm(q + vec3(5.0, 0.0, 2.0));
        float d = fbm(q * 1.8 + 1.7 * vec3(w, 0.0, w) + vec3(0.0, t * 0.6, 0.0));
        float dens = smoothstep(0.30, 0.78, d);
        vec3 col = mix(uC1, uC2, smoothstep(0.35, 0.8, d + w * 0.3));
        col += vec3(0.6, 0.35, 0.6) * pow(dens, 3.0) * 0.25;
        float fade = (1.0 - smoothstep(350.0, 1000.0, dist)) * smoothstep(uNear, uNear * 6.0, dist);
        gl_FragColor = vec4(col * (0.55 + 0.7 * dens), dens * uAlpha * fade);
      }`,
  }));
}

/** Bruma baja entre los muros: velos de ruido teñidos por zona; se apagan cerca de la altura de los ojos. */
export function mistMaterial({ y, alpha = 0.3, seed = 0 }) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, defines: { FBM_OCT: 3 },
    uniforms: { uTime, uY: { value: y }, uAlpha: { value: alpha }, uSeed: { value: seed } },
    vertexShader: `varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uY, uAlpha, uSeed; varying vec3 vWP; ${NOISE} ${ZONES}
      void main(){
        float dist = length(vWP - cameraPosition);
        vec2 p = vWP.xz * 0.045 + uSeed;
        float w = fbm(vec3(p, uTime * 0.03));
        float d = fbm(vec3(p * 1.9 + w * 1.4, uTime * 0.05 + uSeed));
        float dens = smoothstep(0.38, 0.8, d);
        float eye = smoothstep(0.5, 1.8, abs(cameraPosition.y - uY));  // no se ve de canto a la altura de los ojos
        float edge = 1.0 - smoothstep(66.0, 80.0, max(abs(vWP.x), abs(vWP.z)));
        vec3 zc = zoneCol(vWP.xz);
        float fade = smoothstep(2.0, 12.0, dist) * (1.0 - smoothstep(60.0, 150.0, dist));
        gl_FragColor = vec4(zc * 0.40 + vec3(0.12, 0.09, 0.26), dens * uAlpha * eye * edge * fade);
      }`,
  }));
}

/** Planeta lejano con bandas y atmósfera. */
export function planetMaterial({ a, b, c, seed = 0 }) {
  return finish(new THREE.ShaderMaterial({
    defines: { FBM_OCT: 3 },
    uniforms: { uTime, uA: { value: dc(a) }, uB: { value: dc(b) }, uC: { value: dc(c) }, uSeed: { value: seed }, uSun: { value: new THREE.Vector3(0.55, 0.4, -0.5).normalize() } },
    vertexShader: `varying vec3 vL; varying vec3 vN; varying vec3 vWP; void main(){ vL = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uSeed; uniform vec3 uA, uB, uC, uSun; varying vec3 vL; varying vec3 vN; varying vec3 vWP; ${NOISE}
      void main(){
        vec3 p = normalize(vL); float lat = p.y;
        float warp = fbm(vec3(p.x * 3.0, lat * 7.0, p.z * 3.0) + uSeed + uTime * 0.01) - 0.5;
        float bands = sin((lat + warp * 0.4) * 18.0) * 0.5 + 0.5;
        float fine = fbm(vec3(p.x * 6.0, lat * 30.0 + warp * 3.0, p.z * 6.0) + uSeed);
        vec3 alb = mix(mix(uA, uB, bands), uC, smoothstep(0.55, 0.8, fine) * 0.7) * (0.7 + 0.5 * fine);
        vec3 V = normalize(cameraPosition - vWP), n = normalize(vN);
        float dif = smoothstep(-0.2, 0.8, dot(n, uSun)), rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        vec3 col = alb * (0.10 + 0.8 * dif) + mix(uB, vec3(1.0), 0.4) * rim * (0.2 + 0.7 * dif);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

/** Construye cielo + nubes + bruma + planetas lejanos. */
export function buildMazeSky(r, root) {
  const q = cfg(), full = q.decor;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, full ? 48 : 32, full ? 24 : 16), cosmosSky({ iters: q.skyIters }));
  sky.renderOrder = -10; sky.frustumCulled = false; root.add(sky); r.sky = sky;

  const plane = new THREE.PlaneGeometry(2400, 2400); plane.rotateX(-Math.PI / 2);
  const layers = full
    ? [[-34, 0x2a1070, 0xb03aa8, 0.0065, 0.55, 4, 1], [-80, 0x0f2a6a, 0x2a9fd0, 0.0045, 0.5, 3, 7], [-150, 0x3a0f60, 0xe04a8a, 0.0035, 0.5, 3, 13], [95, 0x1a2a70, 0x3ac0c8, 0.005, 0.28, 3, 5]]
    : [[-40, 0x2a1070, 0xa03aa0, 0.0065, 0.6, 2, 1]];
  layers.forEach(([y, c1, c2, sc, al, oct, seed], i) => {
    const m = new THREE.Mesh(plane, cloudMaterial({ c1, c2, scale: sc, speed: 0.012 + i * 0.004, alpha: al, oct, seed }));
    m.position.y = y; m.renderOrder = -9 + i; m.frustumCulled = false; root.add(m);
    r.dyn.push(() => { m.position.x = r.camera.position.x; m.position.z = r.camera.position.z; });
  });

  if (full) { // bruma baja entre los muros (dos velos)
    const mp = new THREE.PlaneGeometry(150, 150); mp.rotateX(-Math.PI / 2);
    [[0.35, 0.20, 3], [3.4, 0.09, 9]].forEach(([y, a, seed], i) => { const m = new THREE.Mesh(mp, mistMaterial({ y, alpha: a, seed })); m.position.y = y; m.renderOrder = 2 + i; root.add(m); });
  }

  // planetas lejanos (esferas con bandas); uno con anillo
  const far = new THREE.Group(); root.add(far);
  const rd = rng(808);
  const planets = [[0xc0508a, 0x6a2fb0, 0xffb060, 150, [-640, 150, -520]], [0x2a8fb0, 0x1a3a90, 0x80ffd0, 110, [720, -60, 380]]];
  if (full) planets.push([0xe0a050, 0xa0402a, 0xfff0c0, 70, [-300, 330, 760]]);
  planets.forEach(([a, b, c, rad, pos], i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(rad, full ? 40 : 24, full ? 28 : 16), planetMaterial({ a, b, c, seed: i * 5.1 })); s.position.set(...pos); far.add(s);
    if (i === 0) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(rad * 1.5, rad * 2.3, 64, 1), finish(new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: { uTime },
        vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uTime; varying vec2 vP; void main(){ float r = length(vP) / ${(rad).toFixed(1)}; float b = 0.5 + 0.5 * sin(r * 38.0) * sin(r * 9.0 + 1.0); float a = smoothstep(1.5, 1.6, r) * smoothstep(2.3, 2.15, r) * (0.25 + b * 0.55);
          gl_FragColor = vec4(vec3(0.95, 0.62, 0.78) * (0.5 + b * 0.5), a * 0.7); }` })));
      ring.position.copy(s.position); ring.rotation.set(-1.15, 0.2, 0.3); far.add(ring);
    }
    r.dyn.push((dt) => { s.rotation.y += dt * 0.01; });
  });
  void rd;
  return { sky, far, planets };
}
