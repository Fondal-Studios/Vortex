import * as THREE from 'three';
import { cfg } from '../quality.js';
import { uTime, finish } from '../shaders.js';
import { NOISE, HAZE } from './glsl.js';
import { dc, raysTex, streakTex, ringTex, softTex } from './props.js';
import { rng } from './noise.js';

// Cielo y atmósfera del Mapa 1: destellos de lente con oclusión, rayos de luz, mar de nubes con capas,
// gigantes lejanos (megaestructura anular, planeta gaseoso, formas de vidrio) y bruma.

/* ───────── mar de nubes: un plano grande, ruido deformado, se aclara hacia el sol ───────── */
function cloudMat({ c1, c2, scale = 0.006, speed = 0.01, alpha = 0.8, sun, oct = 4, seed = 0 }) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, defines: { FBM_OCT: oct },
    uniforms: { uTime, uC1: { value: dc(c1) }, uC2: { value: dc(c2) }, uScale: { value: scale }, uSpeed: { value: speed }, uAlpha: { value: alpha }, uSun: { value: new THREE.Vector3(...sun).normalize() }, uSeed: { value: seed } },
    vertexShader: `varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uScale, uSpeed, uAlpha, uSeed; uniform vec3 uC1, uC2, uSun; varying vec3 vWP; ${NOISE}
      void main(){
        vec3 V = vWP - cameraPosition; float dist = length(V); vec3 dir = V / dist;
        vec2 xz = vWP.xz * uScale + uSeed; float t = uTime * uSpeed;
        vec3 q = vec3(xz.x, t, xz.y);
        float w = fbm(q * 1.0 + vec3(5.0, 0.0, 2.0));
        float d = fbm(q * 1.8 + 1.7 * vec3(w, 0.0, w) + vec3(0.0, t * 0.6, 0.0));
        float dens = smoothstep(0.30, 0.78, d);
        float sunk = pow(max(dot(dir, uSun), 0.0), 3.0);
        vec3 col = mix(uC1, uC2, smoothstep(0.35, 0.8, d + w * 0.3));
        col += vec3(1.0, 0.6, 0.4) * sunk * 0.35 * dens;
        float fade = (1.0 - smoothstep(350.0, 1050.0, dist)) * smoothstep(5.0, 60.0, dist);
        gl_FragColor = vec4(col * (0.55 + 0.6 * dens), dens * uAlpha * fade);
      }`,
  }));
}

/* ───────── rayo de luz (cinta que mira a la cámara alrededor de su eje) ───────── */
function shaftMat(color) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime, uColor: { value: dc(color) }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uCenter: { value: new THREE.Vector3() }, uLen: { value: 200 }, uWid: { value: 14 }, uPh: { value: 0 }, uK: { value: 1 } },
    vertexShader: `uniform vec3 uAxis, uCenter; uniform float uLen, uWid; varying vec2 vUv;
      void main(){ vUv = uv; vec3 c = uCenter + uAxis * (uv.y - 0.5) * uLen; vec3 side = normalize(cross(uAxis, cameraPosition - c));
        vec3 p = c + side * (uv.x - 0.5) * uWid; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uTime, uPh, uK; uniform vec3 uColor; varying vec2 vUv; ${NOISE}
      void main(){
        float x = abs(vUv.x - 0.5) * 2.0, core = pow(1.0 - x, 2.0);
        float s = vnoise(vec3(vUv.x * 7.0 + uPh, vUv.y * 1.5 - uTime * 0.05, uPh)) * 0.6 + 0.4;
        float e = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        gl_FragColor = vec4(uColor, core * s * e * 0.10 * uK);
      }`,
  }));
}

/* ───────── cristal oscuro con borde irisado (formas simples gigantes y raras) ───────── */
function ghostMat(col, haze, hazeDens) {
  return finish(new THREE.ShaderMaterial({
    uniforms: { uTime, uCol: { value: dc(col) }, uHaze: { value: dc(haze) }, uHD: { value: hazeDens } },
    vertexShader: `varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uHD; uniform vec3 uCol, uHaze; varying vec3 vWP;
      void main(){
        vec3 n = normalize(cross(dFdx(vWP), dFdy(vWP))); vec3 V = cameraPosition - vWP; float dist = length(V); V /= dist;
        if (dot(n, V) < 0.0) n = -n;
        float fr = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 1.8);
        float irid = fract(dot(n, vec3(0.3, 0.5, 0.2)) * 1.2 + fr * 0.8 + uTime * 0.03);
        vec3 pal = 0.5 + 0.5 * cos(6.2832 * (irid + vec3(0.0, 0.33, 0.67)));
        vec3 col = uCol * (0.05 + 0.18 * max(dot(n, normalize(vec3(0.4, 0.7, -0.5))), 0.0)) + mix(uCol, pal, 0.5) * fr * 0.55;
        col = mix(col, uHaze, 1.0 - exp(-dist * dist * uHD));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

/* ───────── megaestructura anular (cinta con paneles y luces de ciudad) ───────── */
function ringMat(haze) {
  return finish(new THREE.ShaderMaterial({
    side: THREE.DoubleSide, defines: { FBM_OCT: 3 },
    uniforms: { uTime, uSun: { value: new THREE.Vector3(0.4, 0.3, -0.8).normalize() }, uHaze: { value: dc(haze) } },
    vertexShader: `varying vec2 vUv; varying vec3 vWP; varying vec3 vN; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun, uHaze; varying vec2 vUv; varying vec3 vWP; varying vec3 vN; ${NOISE}
      void main(){
        vec3 V = normalize(cameraPosition - vWP); vec3 n = normalize(vN); if (dot(n, V) < 0.0) n = -n;
        vec2 g = vec2(vUv.x * 260.0, vUv.y * 8.0);
        float panel = vnoise(vec3(floor(g), 3.0)), seam = smoothstep(0.92, 1.0, max(fract(g.x), fract(g.y)));
        vec3 col = vec3(0.045, 0.055, 0.085) * (0.5 + panel) * (1.0 - 0.5 * seam);
        float band = smoothstep(0.35, 0.5, vUv.y) * smoothstep(0.65, 0.5, vUv.y);
        float city = step(0.78, hash13(vec3(floor(vec2(vUv.x * 700.0, vUv.y * 24.0)), 1.0))) * smoothstep(0.06, 0.3, vnoise(vec3(vUv.x * 40.0, vUv.y * 3.0, 9.0)));
        col += vec3(1.0, 0.75, 0.45) * city * (0.5 + 0.5 * sin(uTime * 0.7 + panel * 20.0)) * 0.9;
        col += vec3(0.1, 0.5, 0.9) * band * 0.18 + vec3(0.2, 0.7, 1.0) * smoothstep(0.02, 0.0, abs(vUv.y - 0.5)) * 0.9;
        col += vec3(1.0, 0.8, 0.6) * pow(max(dot(reflect(-V, n), uSun), 0.0), 20.0) * 0.5;
        float dist = length(cameraPosition - vWP); col = mix(col, uHaze, 0.35);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

/* ───────── planeta gaseoso lejano ───────── */
function gasMat(sun) {
  return finish(new THREE.ShaderMaterial({
    defines: { FBM_OCT: 4 },
    uniforms: { uTime, uSun: { value: new THREE.Vector3(...sun).normalize() } },
    vertexShader: `varying vec3 vWP; varying vec3 vL; varying vec3 vN; void main(){ vL = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun; varying vec3 vWP; varying vec3 vL; varying vec3 vN; ${NOISE}
      void main(){
        vec3 p = normalize(vL); float lat = p.y;
        float warp = fbm(vec3(p.x * 3.0, lat * 8.0, p.z * 3.0) + uTime * 0.01) - 0.5;
        float bands = sin((lat + warp * 0.35) * 22.0) * 0.5 + 0.5, fine = fbm(vec3(p.x * 6.0, lat * 40.0 + warp * 3.0, p.z * 6.0));
        vec3 c1 = vec3(0.50, 0.20, 0.30), c2 = vec3(0.85, 0.52, 0.30), c3 = vec3(0.25, 0.15, 0.45);
        vec3 alb = mix(mix(c1, c2, bands), c3, smoothstep(0.55, 0.8, fine) * 0.6) * (0.7 + 0.5 * fine);
        vec3 V = normalize(cameraPosition - vWP), n = normalize(vN);
        float dif = smoothstep(-0.15, 0.7, dot(n, uSun)), rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        vec3 col = alb * (0.015 + 0.30 * dif) + vec3(0.9, 0.5, 0.7) * rim * (0.08 + 0.35 * dif);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

export function buildSkyFx(r, map, { sunPos, haze, hazeDens }) {
  const root = r.mapRoot, q = cfg(), sunDir = sunPos.clone().normalize(), SUN = sunDir.toArray();

  // mar de nubes en capas, muy por debajo del vacío mortal (y < -70)
  const plane = new THREE.PlaneGeometry(2300, 2300); plane.rotateX(-Math.PI / 2);
  const layers = q.decor ? [[-72, 0x1b1050, 0x6a2fa0, 0.006, 0.45, 4, 1], [-112, 0x0f2a5a, 0x2a7fb0, 0.0045, 0.4, 3, 7], [-165, 0x2a0f50, 0xa03a9a, 0.0035, 0.5, 3, 13]] : [[-90, 0x1b1050, 0x5a2a90, 0.006, 0.55, 2, 1]];
  layers.forEach(([y, c1, c2, sc, al, oct, seed], i) => {
    const m = new THREE.Mesh(plane, cloudMat({ c1, c2, scale: sc, speed: 0.012 + i * 0.004, alpha: al, sun: SUN, oct, seed })); m.position.y = y; m.renderOrder = -9 + i; m.frustumCulled = false; root.add(m);
    r.dyn.push(() => { m.position.x = r.camera.position.x; m.position.z = r.camera.position.z; m.material.uniforms.uSeed.value = seed; }); // sigue a la cámara en horizontal: sin borde visible
  });

  // gigantes lejanos
  const far = new THREE.Group(); root.add(far);
  const gas = new THREE.Mesh(new THREE.SphereGeometry(210, 48, 32), gasMat(SUN)); gas.position.set(-760, -40, 560); far.add(gas); gas.rotation.z = 0.25;
  const pr = new THREE.Mesh(new THREE.RingGeometry(270, 410, 96, 1), finish(new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, defines: { FBM_OCT: 2 },
    uniforms: { uTime },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vP; ${NOISE} void main(){ float r = length(vP); float b = vnoise(vec3(r * 0.12, 1.0, 0.0)) * 0.7 + 0.3 * sin(r * 0.9); float gap = smoothstep(0.0, 0.1, abs(fract(r * 0.045) - 0.5) - 0.05); float a = smoothstep(270.0, 285.0, r) * smoothstep(410.0, 380.0, r) * (0.25 + b * 0.5) * (0.5 + 0.5 * gap);
      gl_FragColor = vec4(vec3(0.62, 0.45, 0.4) * (0.4 + b * 0.5) * 0.55, a * 0.7); }` })));
  pr.position.copy(gas.position); pr.rotation.set(-1.25, 0.1, 0.25); far.add(pr);
  const hazeC = haze;
  const mon = [[0x7d5cff, 'knot', 620, 0.4, 40], [0xff5ca8, 'ico', 860, 2.5, 180], [0x35e0c2, 'oct', 780, 4.5, -60], [0xffc14d, 'ring', 900, 5.6, 120]];
  mon.forEach(([c, kind, d, a, y], i) => {
    const geo = kind === 'knot' ? new THREE.TorusKnotGeometry(120, 14, 180, 10, 2, 3) : kind === 'ico' ? new THREE.IcosahedronGeometry(150, 0) : kind === 'oct' ? new THREE.OctahedronGeometry(170, 0) : new THREE.TorusGeometry(210, 12, 8, 56);
    const o = new THREE.Mesh(geo, ghostMat(c, hazeC, hazeDens * 0.5)); o.position.set(Math.cos(a) * d, y, Math.sin(a) * d); far.add(o);
    r.dyn.push((dt) => { o.rotation.x += dt * 0.02 * (i + 1); o.rotation.y += dt * 0.015; });
  });
  if (q.decor) { // megaestructura anular: un arco colosal cruzando el cielo
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1000, 1000, 80, 160, 1, true, 0, 2.6), ringMat(haze)); ring.position.set(-120, -300, -260); ring.rotation.set(0.95, 0.4, 0.28); ring.frustumCulled = false; far.add(ring);
  }

  // destellos de lente con oclusión por las islas (muestreo del rayo cámara→sol)
  const glare = new THREE.Group(); root.add(glare);
  const mk = (tex, col, base, order = 20) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, opacity: 0 })); m.renderOrder = order; m.frustumCulled = false; m.userData = { base }; glare.add(m); return m; };
  const rays = mk(raysTex(), 0xffd9a0, 0.55), halo = mk(softTex(), 0xffc890, 0.5), streak = mk(streakTex(), 0x9fd8ff, 0.5), ghosts = [];
  const gt = ringTex(), gdef = [[0.55, 0.16, 0xff9a60, 0.4], [0.9, 0.09, 0x7ad0ff, 0.5], [1.35, 0.22, 0xa078ff, 0.28], [1.8, 0.07, 0xffd070, 0.45], [-0.35, 0.12, 0x70ffd0, 0.3]];
  for (const [k, sz, col, o] of gdef) { const m = mk(gt, col, o); m.userData.k = k; m.userData.sz = sz; ghosts.push(m); }
  const ndc = new THREE.Vector3(), tmp = new THREE.Vector3(), cd = new THREE.Vector3(), sunW = new THREE.Vector3(); let vis = 0;
  const place = (m, x, y, size, d = 5) => { tmp.set(x, y, 0.5).unproject(r.camera); tmp.sub(r.camera.position).normalize(); m.position.copy(r.camera.position).addScaledVector(tmp, d); const wh = 2 * d * Math.tan(THREE.MathUtils.degToRad(r.camera.fov / 2)); m.scale.set(size * wh, size * wh, 1); };
  const occluded = () => { // ¿algo sólido tapa el sol?
    const o = r.camera.position; let hit = 0;
    for (let s = 1; s <= 30; s++) { const d = s * 7; const x = o.x + sunDir.x * d, y = o.y + sunDir.y * d, z = o.z + sunDir.z * d;
      for (const is of map.islands) { const rr = Math.hypot(x - is.x, z - is.z), dpt = is.r * 1.5; let R = 0;
        if (y >= is.y0 && y <= is.top) R = is.r; else if (!is.hang && y < is.y0 && y > is.y0 - dpt) R = is.r * (1 - (is.y0 - y) / dpt); else if (is.hang && y > is.top && y < is.top + dpt) R = is.r * (1 - (y - is.top) / dpt);
        if (rr < R) hit = 1; }
      for (const sl of map.solids) if (sl.type === 'sph' && Math.hypot(x - sl.c.x, y - sl.c.y, z - sl.c.z) < sl.r) hit = 1; }
    return hit;
  };
  let occT = 0, occV = 0;
  r.dyn.push((dt, t) => {
    sunW.copy(r.camera.position).addScaledVector(sunDir, 900); ndc.copy(sunW).project(r.camera);
    occT -= dt; if (occT <= 0) { occT = 0.12; occV = occluded(); }
    const onScreen = ndc.z < 1 ? Math.max(0, 1 - Math.max(Math.abs(ndc.x), Math.abs(ndc.y)) * 0.8) : 0;
    const target = onScreen * (1 - occV); vis += (target - vis) * Math.min(1, dt * 6);
    glare.visible = vis > 0.01; if (!glare.visible) return;
    const fade = Math.min(1, vis * 1.3);
    for (const m of glare.children) m.material.opacity = m.userData.base * fade;
    place(halo, ndc.x, ndc.y, 0.9, 5); place(rays, ndc.x, ndc.y, 1.9, 5); rays.material.rotation = t * 0.02 + ndc.x * 0.6; place(streak, ndc.x, ndc.y, 2.6, 5); streak.scale.y *= 0.09;
    for (const g of ghosts) place(g, ndc.x * -g.userData.k + 0.0, ndc.y * -g.userData.k, g.userData.sz * 1.1, 5);
  });

  // rayos de luz volumétricos fingidos (conos aditivos entre las islas)
  if (q.decor) {
    const pg = new THREE.PlaneGeometry(1, 1), sr = rng(31);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(pg, shaftMat(i % 2 ? 0xffd0a0 : 0xffe4c0)), a = i / 7 * Math.PI * 2 + 0.4, d = 20 + sr() * 70;
      const u = m.material.uniforms; u.uAxis.value.copy(sunDir); u.uCenter.value.set(Math.cos(a) * d, 25 + sr() * 30, Math.sin(a) * d); u.uLen.value = 260; u.uWid.value = 8 + sr() * 14; u.uPh.value = sr() * 10; u.uK.value = 0.6 + sr() * 0.8;
      m.scale.set(1, 1, 1); m.frustumCulled = false; m.renderOrder = 3; root.add(m);
    }
  }
  return { gas };
}
