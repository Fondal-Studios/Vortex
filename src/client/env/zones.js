import * as THREE from 'three';
import { cfg } from '../quality.js';
import { uTime, finish, zoneMaterial, screenColor } from '../shaders.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE, BUMP } from './glsl.js';
import { dc, particleMat, particleGeo, debrisGeo } from './props.js';
import { rockPBR } from './rock.js';
import { rng } from './noise.js';

// Zonas de física, portales y planetoide del Mapa 1. Cada efecto cuenta lo que hace:
//  columna que sube (gravedad invertida), pompa irisada (cero-G) con rocas flotando, burbuja de tiempo con reloj,
//  pozo de gravedad con polvo cayendo y escombros en órbita, portales con vórtice.

const hslScreen = (h, s, l) => { const c = new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace), o = { r: 0, g: 0, b: 0 }; c.getRGB(o, THREE.SRGBColorSpace); return new THREE.Color().setRGB(o.r, o.g, o.b, THREE.LinearSRGBColorSpace); };

/* ───────── portales: discos con vórtice, anillos con runas y almohadillas, todo fusionado ───────── */
function portalMats() {
  const disc = finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime },
    vertexShader: `attribute vec3 aCol; attribute float aKind; varying vec2 vUv; varying vec3 vC; varying float vK; void main(){ vUv = uv; vC = aCol; vK = aKind; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vC; varying float vK;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0; float r = length(p), a = atan(p.y, p.x);
        if (vK < 0.5) { // vórtice
          float sw = a * 2.0 + 5.5 * log(r + 0.08) - uTime * 3.0;
          float arms = 0.5 + 0.5 * sin(sw * 1.5), arms2 = 0.5 + 0.5 * sin(a * 3.0 - 7.0 * r + uTime * 2.2);
          float core = exp(-r * 3.2), rip = 0.5 + 0.5 * sin(r * 26.0 - uTime * 5.0);
          vec3 col = vC * (0.18 + 0.7 * arms * (1.0 - r * 0.5) + 0.4 * arms2 * r) + vec3(1.0, 0.95, 0.9) * core * 0.5 + vC * rip * 0.14 * (1.0 - r);
          float edge = smoothstep(1.0, 0.80, r);
          gl_FragColor = vec4(col, edge * (0.50 + 0.45 * arms + core * 0.4));
        } else {        // almohadilla en el suelo: anillos que se contraen hacia el portal
          float ring = smoothstep(0.08, 0.0, abs(fract(r * 2.2 + uTime * 0.5) - 0.5) - 0.40) * smoothstep(1.0, 0.3, r);
          float edge = smoothstep(0.06, 0.0, abs(r - 0.9));
          gl_FragColor = vec4(vC * (0.6 + 1.2 * ring + 1.2 * edge), (0.07 * smoothstep(1.0, 0.0, r) + 0.30 * ring + 0.5 * edge) * smoothstep(1.0, 0.92, r));
        }
      }`,
  }));
  const ring = finish(new THREE.ShaderMaterial({
    uniforms: { uTime },
    vertexShader: `attribute vec3 aCol; varying vec2 vUv; varying vec3 vC; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vC; varying vec3 vN; varying vec3 vV;
      void main(){
        float seg = smoothstep(0.35, 0.65, sin(vUv.x * 6.2832 * 14.0 - uTime * 2.5) * 0.5 + 0.5);
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
        vec3 col = vC * (0.35 + 0.9 * seg) * (0.6 + 0.8 * f) + vec3(0.9) * f * 0.25;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  return { disc, ring };
}

function buildPortals(r, map) {
  const root = r.mapRoot, q = cfg(), discs = [], rings = [], pts = [], pm = new THREE.Matrix4(), e = new THREE.Euler(), qq = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  const addAttrs = (g, col, kind) => { const n = g.attributes.position.count, c = new Float32Array(n * 3), k = new Float32Array(n).fill(kind); for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3); g.setAttribute('aCol', new THREE.BufferAttribute(c, 3)); if (kind >= 0) g.setAttribute('aKind', new THREE.BufferAttribute(k, 1)); return g; };
  const flipped = (end) => map.islands.some((is) => is.hang && Math.hypot(end.x - is.x, end.z - is.z) < is.r && Math.abs(end.y - is.y0) < 2.5) || map.solids.some((s) => s.type === 'sph' && Math.abs(end.x - s.c.x) < 0.1 && end.y < s.c.y);
  for (const po of map.portals) for (const end of [po.a, po.b]) {
    const col = hslScreen(po.hue, 1, 0.62), up = flipped(end) ? -1 : 1, yaw = Math.atan2(end.x, end.z), pos = new THREE.Vector3(end.x, end.y + up, end.z);
    e.set(0, yaw, 0); qq.setFromEuler(e);
    const d = new THREE.CircleGeometry(po.r * 0.95, q.decor ? 48 : 24); d.deleteAttribute('normal'); d.applyMatrix4(pm.compose(pos, qq, one)); discs.push(addAttrs(d, col, 0));
    const t = new THREE.TorusGeometry(po.r * 0.95, 0.16, 8, q.decor ? 56 : 28); t.applyMatrix4(pm.compose(pos, qq, one)); rings.push(addAttrs(t, col, -1));
    const pad = new THREE.CircleGeometry(po.r * 1.45, q.decor ? 40 : 20); pad.deleteAttribute('normal'); pad.rotateX(-up * Math.PI / 2); pad.translate(end.x, end.y - up * 0.88, end.z); discs.push(addAttrs(pad, col, 1));
    pts.push({ pos, yaw, col });
  }
  const { disc, ring } = portalMats();
  const dm = new THREE.Mesh(mergeGeometries(discs, false), disc); dm.frustumCulled = false; dm.renderOrder = 4; root.add(dm);
  const rm = new THREE.Mesh(mergeGeometries(rings, false), ring); rm.frustumCulled = false; root.add(rm);
  if (q.decor) { // chispas en espiral que entran al portal (una sola nube para todos)
    const per = 26, n = pts.length * per, pos = new Float32Array(n * 3), aR = new Float32Array(n * 4), aC = new Float32Array(n * 3), aY = new Float32Array(n), col = new Float32Array(n * 3), rd = rng(17);
    pts.forEach((p, k) => { for (let i = 0; i < per; i++) { const o = k * per + i; aR.set([rd(), rd(), 0.5 + rd() * 0.9, rd()], o * 4); aC.set([p.pos.x, p.pos.y, p.pos.z], o * 3); aY[o] = p.yaw; col.set([p.col.r, p.col.g, p.col.b], o * 3); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aR', new THREE.BufferAttribute(aR, 4)); g.setAttribute('aC', new THREE.BufferAttribute(aC, 3)); g.setAttribute('aY', new THREE.BufferAttribute(aY, 1)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    const m = finish(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime, uPx: particleMat().uniforms.uPx },
      vertexShader: `attribute vec4 aR; attribute vec3 aC; attribute float aY; attribute vec3 aCol; uniform float uTime, uPx; varying vec3 vC; varying float vA;
        void main(){ float ph = fract(aR.x + uTime * 0.35 * (0.6 + 0.8 * aR.y)); float a = aR.w * 6.2831 + ph * 6.0, rr = 3.1 * (1.0 - ph) + 0.15;
          vec3 l = vec3(cos(a) * rr, sin(a) * rr, (ph - 0.5) * 0.8); float cy = cos(aY), sy = sin(aY); vec3 w = aC + vec3(l.x * cy + l.z * sy, l.y, -l.x * sy + l.z * cy);
          vec4 mv = modelViewMatrix * vec4(w, 1.0); vC = aCol; vA = sin(ph * 3.14159); gl_PointSize = clamp(0.20 * aR.z * 2.0 * uPx / max(-mv.z, 0.3), 1.0, 40.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0); gl_FragColor = vec4(vC * 1.6 + 0.2, a * vA * 0.9); }` }));
    const sp = new THREE.Points(g, m); sp.frustumCulled = false; root.add(sp);
  }
}

/* ───────── planetoide: continentes, océanos, hielo, luces biológicas nocturnas, nubes, atmósfera y anillo ───────── */
function planetMat(sun, oct) {
  return finish(new THREE.ShaderMaterial({
    defines: { FBM_OCT: oct },
    uniforms: { uTime, uSun: { value: new THREE.Vector3(...sun).normalize() } },
    vertexShader: `varying vec3 vL; varying vec3 vN; varying vec3 vWP; void main(){ vL = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun; varying vec3 vL; varying vec3 vN; varying vec3 vWP; ${NOISE} ${BUMP}
      void main(){
        vec3 p = normalize(vL), n = normalize(vN), V = normalize(cameraPosition - vWP);
        float h = fbm(p * 2.4 + 3.0) + 0.25 * fbm(p * 7.0), sea = 0.52;
        float land = smoothstep(sea - 0.005, sea + 0.012, h);
        float pole = smoothstep(0.84, 0.97, abs(p.y) + (h - 0.5) * 0.4);
        vec3 ocean = mix(vec3(0.02, 0.10, 0.28), vec3(0.06, 0.52, 0.62), smoothstep(sea - 0.12, sea, h));
        vec3 low = vec3(0.10, 0.46, 0.20), high = vec3(0.62, 0.44, 0.20), rock = vec3(0.36, 0.30, 0.42);
        vec3 ter = mix(mix(low, high, smoothstep(sea, sea + 0.12, h)), rock, smoothstep(sea + 0.16, sea + 0.26, h));
        vec3 alb = mix(ocean, ter, land); alb = mix(alb, vec3(0.85, 0.92, 1.0), pole);
        vec3 nb = bumpN(n, vWP, h * 3.0 * land, 0.15);
        float dif = clamp(dot(nb, uSun) * 1.1 + 0.08, 0.0, 1.0), night = 1.0 - smoothstep(-0.1, 0.25, dot(n, uSun));
        vec3 H = normalize(uSun + V); float spec = pow(max(dot(n, H), 0.0), 60.0) * (1.0 - land) * 0.8;
        float veins = (1.0 - smoothstep(0.0, 0.05, abs(vnoise(p * 9.0 + 2.0) - 0.5) * 2.0)) * land * (1.0 - pole);
        vec3 col = alb * (0.16 + 0.95 * dif) + spec * vec3(1.0, 0.95, 0.85);
        col += vec3(0.1, 1.0, 0.8) * veins * night * (0.6 + 0.4 * sin(uTime * 1.3 + p.x * 8.0));
        col += vec3(0.25, 0.55, 1.0) * pow(1.0 - max(dot(n, V), 0.0), 3.0) * (0.15 + 0.7 * dif);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}
function cloudShellMat(sun) {
  return finish(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, defines: { FBM_OCT: 3 },
    uniforms: { uTime, uSun: { value: new THREE.Vector3(...sun).normalize() } },
    vertexShader: `varying vec3 vL; varying vec3 vN; void main(){ vL = position; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun; varying vec3 vL; varying vec3 vN; ${NOISE}
      void main(){ vec3 p = normalize(vL); float c = smoothstep(0.58, 0.80, fbm(p * 3.2 + vec3(0.0, uTime * 0.01, 0.0)) + 0.2 * fbm(p * 8.0));
        float dif = clamp(dot(normalize(vN), uSun) * 1.2 + 0.15, 0.0, 1.0); gl_FragColor = vec4(mix(vec3(0.25, 0.25, 0.4), vec3(1.0, 0.92, 0.95), dif), c * 0.6); }` }));
}
const atmoMat = () => finish(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
  uniforms: { uSun: { value: new THREE.Vector3(0.4, 1, -0.5).normalize() } },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float f = pow(max(dot(-normalize(vN), normalize(vV)), 0.0), 2.5); gl_FragColor = vec4(vec3(0.25, 0.6, 1.0) * f * 1.1, f * 0.55); }` }));

function buildPlanetoid(r, map, sun) {
  const root = r.mapRoot, q = cfg();
  for (const s of map.solids) if (s.type === 'sph') {
    const g = new THREE.Group(); g.position.set(s.c.x, s.c.y, s.c.z); root.add(g);
    const pl = new THREE.Mesh(new THREE.SphereGeometry(s.r, q.decor ? 64 : 32, q.decor ? 48 : 20), planetMat(sun, q.decor ? 4 : 3)); g.add(pl);
    const atm = new THREE.Mesh(new THREE.SphereGeometry(s.r * 1.16, 40, 24), atmoMat()); g.add(atm);
    let cl = null; if (q.decor) { cl = new THREE.Mesh(new THREE.SphereGeometry(s.r * 1.035, 40, 28), cloudShellMat(sun)); g.add(cl); }
    if (q.decor) { // anillo tenue (no estorba: es traslúcido y está dentro del pozo de gravedad)
      const rg = new THREE.Mesh(new THREE.RingGeometry(s.r * 1.45, s.r * 2.05, 90, 1), finish(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: { uTime }, vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec2 vP; void main(){ float rr = length(vP); float b = 0.5 + 0.5 * sin(rr * 7.0) * sin(rr * 2.3 + 1.0); float e = smoothstep(8.7, 9.2, rr) * smoothstep(12.4, 11.4, rr); gl_FragColor = vec4(vec3(0.8, 0.6, 0.9) * (0.4 + 0.6 * b), e * 0.12 * (0.4 + b)); }` })));
      rg.rotation.set(-1.15, 0.1, 0.35); g.add(rg);
    }
    r.dyn.push((dt) => { pl.rotation.y += dt * 0.05; if (cl) cl.rotation.y += dt * 0.07; });
  }
}

/* ───────── zonas ───────── */
function addDebrisSwarm(r, center, n, rmin, rmax, size, seed, orbit) {
  if (!cfg().decor) return;
  const rd = rng(seed), m = new THREE.InstancedMesh(debrisGeo(1, seed), rockPBR({ envMap: r.envTex, attr: false, accent: 0xa0c8ff, octaves: 3 }), n), it = [];
  m.frustumCulled = false;
  for (let i = 0; i < n; i++) it.push({ a: rd() * 6.283, rr: rmin + rd() * (rmax - rmin), y: (rd() - 0.5) * (rmax - rmin) * 0.8, s: size * (0.3 + rd() * 0.9), sp: (0.3 + rd() * 0.5) * (orbit ? 0.35 : 0.12) * (rd() < 0.5 ? 1 : -1), ax: new THREE.Vector3(rd() - 0.5, rd(), rd() - 0.5).normalize(), ph: rd() * 6.28 });
  const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), pp = new THREE.Vector3(), ss = new THREE.Vector3();
  r.dyn.push((dt, t) => { for (let i = 0; i < n; i++) { const o = it[i]; const a = o.a + t * o.sp; if (orbit) pp.set(Math.cos(a) * o.rr, o.y * 0.5 + Math.sin(a * 0.7 + o.ph) * 0.8, Math.sin(a) * o.rr); else pp.set(Math.sin(t * 0.13 * (1 + o.sp) + o.ph) * o.rr * 0.6, Math.sin(t * 0.17 + o.ph * 2) * o.rr * 0.6 + o.y * 0.3, Math.cos(t * 0.11 + o.ph) * o.rr * 0.6);
    pp.add(center); qq.setFromAxisAngle(o.ax, t * o.sp * 2 + o.ph); mm.compose(pp, qq, ss.setScalar(o.s)); m.setMatrixAt(i, mm); } m.instanceMatrix.needsUpdate = true; });
  r.mapRoot.add(m);
}

function buildZoneFx(r, map) {
  const root = r.mapRoot, q = cfg(), deco = q.decor;
  for (const z of map.zones) {
    const C = new THREE.Vector3(z.c.x, z.c.y, z.c.z);
    if (z.kind === 'flip') {
      const h = z.y1 - z.y0, col = 0x66ffcc;
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(z.r, z.r, h, deco ? 40 : 20, 1, true), zoneMaterial(col, 1)); sh.position.set(z.c.x, z.y0 + h / 2, z.c.z); sh.renderOrder = 3; root.add(sh);
      const pad = new THREE.Mesh(new THREE.CircleGeometry(z.r * 1.7, 48), zoneMaterial(col, 6)); pad.rotation.x = -Math.PI / 2; pad.position.set(z.c.x, z.c.y + 0.05, z.c.z); pad.renderOrder = 3; root.add(pad);
      const hang = map.islands.find((is) => is.hang && Math.hypot(is.x - z.c.x, is.z - z.c.z) < 1);
      if (hang) { const pad2 = new THREE.Mesh(new THREE.CircleGeometry(z.r * 1.7, 48), zoneMaterial(col, 6)); pad2.rotation.x = Math.PI / 2; pad2.position.set(z.c.x, hang.y0 - 0.06, z.c.z); pad2.renderOrder = 3; root.add(pad2); }
      const n = deco ? 170 : 50, pts = new THREE.Points(particleGeo(n, (i, rd) => { const a = rd() * 6.283, rr = Math.sqrt(rd()) * (z.r - 0.5); return [Math.cos(a) * rr, 0, Math.sin(a) * rr]; }, 21), particleMat({ color: 0xa8ffe0, size: 0.24, mode: 0, speed: 0.2, height: hang ? hang.y0 - z.y0 : h * 0.6, amp: 0.8, alpha: 0.5 }));
      pts.position.set(z.c.x, z.y0, z.c.z); pts.frustumCulled = false; root.add(pts);

    } else if (z.kind === 'zero') {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(z.r, 40, 28), zoneMaterial(0xd8b8ff, 4)); sh.position.copy(C); sh.renderOrder = 3; root.add(sh);
      const pts = new THREE.Points(particleGeo(deco ? 100 : 30, (i, rd) => { const v = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(rd()) * (z.r - 1.5)); return [v.x, v.y, v.z]; }, 5), particleMat({ color: 0xe0ccff, size: 0.22, mode: 1, amp: 2.4, alpha: 0.9 }));
      pts.position.copy(C); pts.frustumCulled = false; root.add(pts);
      addDebrisSwarm(r, C, 9, 3, z.r - 2.5, 0.5, 31, false);
    } else if (z.kind === 'well') {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(z.r, 36, 24), zoneMaterial(0x6aa0ff, 5)); sh.position.copy(C); sh.renderOrder = 3; root.add(sh);
      const pts = new THREE.Points(particleGeo(deco ? 130 : 40, (i, rd) => { const v = new THREE.Vector3().randomDirection(); return [v.x, v.y, v.z]; }, 8), particleMat({ color: 0x9ec8ff, size: 0.2, mode: 3, speed: 0.12, amp: z.r, height: 6.6, alpha: 0.9 }));
      pts.position.copy(C); pts.frustumCulled = false; root.add(pts);
      addDebrisSwarm(r, C, 10, 9.2, 12.2, 0.55, 12, true);
    } else if (z.kind === 'slow') {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(z.r, 40, 28), zoneMaterial(0xffb347, 3)); sh.position.copy(C); sh.renderOrder = 3; root.add(sh);
      if (deco) {
        const rings = [0, 1].map((i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(z.r * (0.55 + 0.2 * i), 0.07, 6, 64, 5.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc060).multiplyScalar(1.6), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); t.position.copy(C); root.add(t); return t; });
        r.dyn.push((dt, t) => { rings[0].rotation.set(1.2, t * 0.12, 0.3); rings[1].rotation.set(0.4, -t * 0.07, 1.1); });
        const pts = new THREE.Points(particleGeo(40, (i, rd) => { const v = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(rd()) * (z.r - 1)); return [v.x, v.y, v.z]; }, 3), particleMat({ color: 0xffd090, size: 0.16, mode: 1, amp: 0.9, alpha: 0.8 }));
        pts.position.copy(C); pts.frustumCulled = false; root.add(pts);
      }
    }
  }
}

export function buildZones(r, map, { sun }) {
  buildPlanetoid(r, map, sun);
  buildZoneFx(r, map);
  buildPortals(r, map);
}
