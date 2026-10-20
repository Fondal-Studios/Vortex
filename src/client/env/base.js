// Entorno de LA BASE · «El Santuario» (docs/BASE.md): un santuario-nave del limbo, orgánico y cálido, MUY legible.
// Plano y estaciones: src/sim/base.js. Este archivo sólo DIBUJA lo estático (suelo, muros, props, cubas, mesa, capullos…) y deja los
// «mangos» de lo que cambia (nivel de las cubas, macetas, avisos…) en `parts` para src/client/base-fx.js, que lo anima cada cuadro.
//
// Presupuesto de dibujo (Baja ≤ 60 llamadas y ≤ 40 000 triángulos de escenario; se mide en tools/base-medir.mjs): todo lo estático se FUSIONA por material
// (2 mallas: sólido con luz + brillo sin luz), lo repetido es INSTANCIADO (cubas, capullos, macetas, vitrinas) y los carteles van en UN atlas.
// Luces: hemisférica + sol + contraluz del Renderer (relleno generoso, el Huésped se lee siempre). Media/Alta suman detalle (más costillas, halos, motas, luces puntuales).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cfg } from '../quality.js';
import { uTime, finish } from '../shaders.js';
import { limboSky, put, box, cyl, lightShafts, haloField } from './limbo-kit.js';
import { particleGeo, particleMat, softTex, trackPx } from './props.js';
import { BASE, ESTACIONES, CUBAS, MACETAS, CAPULLOS, VIVARIOS, VITRINAS, MANIQUIES } from '../../sim/base.js';
import { createBaseFx } from '../base-fx.js';

const PAL = { crema: 0xf6dfd2, rosa: 0xeaa9ba, violeta: 0xb89ae0, turq: 0x6fd8cf, oro: 0xffd27a, magenta: 0xff5fd0, cian: 0x5ff0ff, lima: 0xb8ff5a, madera: 0xb98258, oscuro: 0x4a3860, hueso: 0xf3e6d6, tierra: 0xc47a5a, piedra: 0xcdb0e8 };
const ACENTOS = [PAL.magenta, PAL.cian, PAL.oro, PAL.lima, PAL.violeta, PAL.turq];

/** Pinta una geometría con un color por vértice (sin UV: todo el color viene de los vértices). */
function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g; if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const merged = (list) => { if (!list.length) return null; const g = mergeGeometries(list, false); list.forEach((x) => x.dispose()); g.computeBoundingSphere(); return g; };

/** Vidrio de las cubas, vivarios y vitrinas: fresnel claro + reflejo que corre (instanciado: usa instanceMatrix). */
function glassMat(tint = 0xbff6ff, alpha = 0.34) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime, uTint: { value: new THREE.Color(tint) }, uAlpha: { value: alpha } },
    vertexShader: `varying vec3 vN, vW; varying float vY;
      void main(){ vec4 p = vec4(position, 1.0); vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
        #endif
        vec4 w = modelMatrix * p; vW = w.xyz; vN = normalize(mat3(modelMatrix) * n); vY = position.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uAlpha; uniform vec3 uTint; varying vec3 vN, vW; varying float vY;
      void main(){ vec3 V = normalize(cameraPosition - vW); float f = 1.0 - abs(dot(normalize(vN), V)); float stripe = smoothstep(0.9, 1.0, sin(vW.y * 3.0 + vW.x * 1.5 + uTime * 0.6) * 0.5 + 0.5) * 0.25;
        gl_FragColor = vec4(uTint * (0.75 + f * 0.5 + stripe), clamp(uAlpha + f * 0.45 + stripe * 0.4, 0.0, 0.8)); }`,
  }));
}

/** Remolino de color (espejo del Armero y puerta de Cooperativo). */
function swirlMat(c1, c2, spd = 0.4) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime, uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(c2) }, uSpd: { value: spd }, uPulse: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uSpd, uPulse; uniform vec3 uC1, uC2; varying vec2 vUv;
      void main(){ float r = length(vUv), a = atan(vUv.y, vUv.x); if (r > 1.0) discard;
        float s = sin(a * 3.0 + r * 9.0 - uTime * uSpd * 6.0) * 0.5 + 0.5, s2 = sin(a * 5.0 - r * 6.0 + uTime * uSpd * 4.0) * 0.5 + 0.5;
        vec3 col = mix(uC1, uC2, s * 0.7 + s2 * 0.3) * (0.7 + 0.5 * (1.0 - r)) + vec3(1.0) * smoothstep(0.9, 1.0, r) * 0.6;
        col += (1.0 + sin(uTime * 3.0)) * 0.25 * uPulse * (1.0 - r);
        gl_FragColor = vec4(col, 0.55 + 0.4 * (1.0 - r)); }`,
  }));
}

export function build(r, map) {
  const root = r.mapRoot, q = cfg(), low = !q.decor, seg = low ? 8 : 12;
  const hi = !!r.composer && !!cfg().post;   // Media/Alta: con bloom y exposición alta la misma luz lava la imagen → menos luz y un bloom contenido (el Huésped tiene que seguir leyéndose)
  r.hemi.color.setHex(0xfff0e8); r.hemi.groundColor.setHex(0xb08aa8); r.hemi.intensity = hi ? 0.8 : 1.05;
  r.sun.color.setHex(0xfff0d8); r.sun.intensity = hi ? 1.3 : 1.7; if (r.bloom) { r.bloom.strength = Math.min(r.bloom.strength, 0.22); r.bloom.threshold = 1.05; } const sunDir = new THREE.Vector3(0.35, 1, 0.55).normalize(); r.sun.position.copy(sunDir); r.sunDir = sunDir.clone();
  r.rim.color.setHex(0xff8fd8); r.rim.intensity = 0.9;
  r.scene.environmentIntensity = hi ? 0.2 : 0.5;
  trackPx(r);
  const S = [], GL = [], parts = { map };   // sólido con luz · brillo sin luz
  const sol = (g, hex) => S.push(paint(g, hex)), glo = (g, hex) => GL.push(paint(g, hex));

  /* ───── suelo: shader sin luz (legible, barato): baldosas, pulsos desde el centro, discos de color bajo cada estación y caminos dorados ───── */
  const ids = Object.keys(ESTACIONES), stV = [], stC = [];
  for (let i = 0; i < 10; i++) { const e = ESTACIONES[ids[i]]; stV.push(new THREE.Vector4(e ? e.x : 1e5, e ? e.z : 1e5, e ? e.r * 0.62 : 1, 0)); stC.push(new THREE.Color(e ? e.color : 0)); }
  parts.floorMat = finish(new THREE.ShaderMaterial({
    uniforms: { uTime, uSt: { value: stV }, uStC: { value: stC }, uNear: { value: new THREE.Vector4(1e5, 1e5, 1, 0) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec4 uSt[10]; uniform vec3 uStC[10]; uniform vec4 uNear; varying vec3 vW;
      vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
      void main(){ vec2 p = vW.xz; float d0 = length(p);
        vec3 col = mix(vec3(0.56, 0.34, 0.60), vec3(0.30, 0.42, 0.68), smoothstep(-40.0, 40.0, p.x + p.y * 0.5));
        vec2 g = abs(fract(p / 4.0) - 0.5) * 2.0; col += vec3(0.10, 0.08, 0.14) * smoothstep(0.90, 1.0, max(g.x, g.y)); col *= 0.94 + 0.12 * smoothstep(0.0, 0.5, max(g.x, g.y));
        float vein = smoothstep(0.55, 0.0, abs(sin(p.x * 0.31 + sin(p.y * 0.23 + uTime * 0.05) * 1.7) * sin(p.y * 0.27 - p.x * 0.11)));
        col = mix(col, col * vec3(1.25, 0.9, 1.2), vein * 0.55);
        float rg = fract(d0 / 9.0 - uTime * 0.06); col += pal(d0 * 0.02 - uTime * 0.03) * smoothstep(0.09, 0.0, abs(rg - 0.5)) * 0.42;
        for (int i = 0; i < 10; i++) { vec4 s = uSt[i]; float d = length(p - s.xy); float disc = smoothstep(s.z, s.z * 0.15, d);
          float rim = smoothstep(0.35, 0.0, abs(d - s.z * 0.92)) * (0.6 + 0.4 * sin(uTime * 1.6 + float(i)));
          col = mix(col, uStC[i] * 0.8 + 0.2, disc * 0.45); col += uStC[i] * rim * 0.7; }
        float nr = smoothstep(uNear.z, 0.0, length(p - uNear.xy)) * uNear.w; col += vec3(1.0, 0.95, 0.75) * nr * 0.30;
        float lz = smoothstep(0.7, 0.0, abs(p.x)) * step(-31.0, p.y) * step(p.y, 33.0), lx = smoothstep(0.7, 0.0, abs(p.y)) * step(-33.0, p.x) * step(p.x, 35.0);
        float dash = 0.55 + 0.45 * step(0.5, fract((p.y + p.x) / 3.0 - uTime * 0.7));
        col = mix(col, vec3(1.0, 0.86, 0.5), max(lz, lx) * 0.55 * dash);
        gl_FragColor = vec4(col, 1.0); }`,
  }));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(130, 130).rotateX(-Math.PI / 2), parts.floorMat); floor.position.set(0, -0.02, -2); root.add(floor);

  /* ───── muros del borde (celdas de 4 m) con costillas verticales y venas de luz en la cara de adentro ───── */
  const ribs = [];
  for (const w of map.wallDefs) {
    const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2, sx = w.x1 - w.x0, sz = w.z1 - w.z0;
    sol(put(box(sx, w.h, sz), cx, w.h / 2, cz), (Math.floor(cx / 4) + Math.floor(cz / 4)) & 1 ? 0xe58d92 : 0xf0a98e);
    for (const dz of [1, -1]) if (map.walkable(cx, cz + dz * (sz / 2 + 2.2), 0)) {   // cara de adentro paralela al eje x: una costilla cada 4 m + una vena de luz a lo largo
      for (let x = w.x0 + 2; x < w.x1; x += 4) if (map.walkable(x, cz + dz * (sz / 2 + 2.2), 0)) ribs.push([x, cz + dz * (sz / 2 + 0.25), 0, dz]);
      glo(put(box(sx - 0.6, 0.16, 0.1), cx, 11.4, cz + dz * (sz / 2 + 0.06)), ACENTOS[(Math.floor(cx / 4) + 12) % ACENTOS.length]);
    }
    for (const dx of [1, -1]) if (map.walkable(cx + dx * (sx / 2 + 2.2), cz, 0)) { ribs.push([cx + dx * (sx / 2 + 0.25), cz, dx, 0]); glo(put(box(0.1, 0.16, sz - 0.6), cx + dx * (sx / 2 + 0.06), 11.4, cz), ACENTOS[(Math.floor(cz / 4) + 12) % ACENTOS.length]); }
  }
  ribs.forEach(([x, z, dx, dz], i) => {
    const alongX = dz !== 0; sol(put(box(alongX ? 1.1 : 0.7, 13.4, alongX ? 0.7 : 1.1), x, 6.7, z), PAL.hueso);
    sol(put(new THREE.SphereGeometry(0.9, 6, 4), x, 13.4, z, 0, 0, 0, alongX ? 1.1 : 0.7, 0.8, alongX ? 0.7 : 1.1), PAL.hueso);
    glo(put(box(alongX ? 0.22 : 0.1, 11, alongX ? 0.1 : 0.22), x - dx * 0.0 + dx * 0.3, 6.4, z + dz * 0.3), ACENTOS[i % ACENTOS.length]);
  });

  /* ───── costillas de la nave: arcos que cruzan el salón por encima ───── */
  const arcs = low ? [-32, -12, 12, 32] : [-36, -24, -12, 0, 12, 24, 36];
  for (const z of arcs) {
    const g = new THREE.TorusGeometry(38, 0.55, 6, low ? 20 : 30, Math.PI); g.scale(1, 0.58, 1); g.translate(0, 0, 0); g.rotateY(0);
    sol(put(g, 0, 0, z), PAL.hueso);
    glo(put(new THREE.TorusGeometry(38, 0.14, 4, low ? 20 : 30, Math.PI).scale(1, 0.58, 1), 0, 0.0, z + 0.55), ACENTOS[Math.abs(Math.round(z / 12)) % ACENTOS.length]);
  }

  /* ───── props por tipo de cobertura ───── */
  const sc = { pilar: 0, tabique: 0 };
  for (const c of map.covers) {
    const k = c.kind, x = c.x, z = c.z;
    if (k === 'pilar') {
      const r0 = c.r, i = sc.pilar++;
      sol(put(cyl(r0 * 1.7, r0 * 1.9, 0.6, seg), x, 0.3, z), PAL.rosa);
      sol(put(cyl(r0 * 0.85, r0 * 1.2, c.h - 1.2, seg), x, c.h / 2, z), PAL.hueso);
      sol(put(cyl(r0 * 2.2, r0 * 0.9, 1.6, seg), x, c.h - 0.2, z), PAL.hueso);
      for (const yy of [2.2, 5.6, 9]) glo(put(cyl(r0 * 1.1 + 0.2 - yy * 0.012, r0 * 1.1 + 0.2 - yy * 0.012, 0.16, seg), x, yy, z), ACENTOS[(i + Math.round(yy)) % ACENTOS.length]);
    } else if (k === 'tabique') {
      const i = sc.tabique++, w = c.hx * 2, d = c.hz * 2;
      sol(put(box(w, c.h, d), x, c.h / 2, z), PAL.crema);
      sol(put(box(w + 0.5, 0.5, d + 0.5), x, c.h + 0.2, z), PAL.rosa);
      sol(put(box(w + 0.5, 0.4, d + 0.5), x, 0.2, z), PAL.rosa);
      glo(put(box(w - 0.4, 0.14, d + 0.06), x, c.h - 0.8, z), ACENTOS[i % ACENTOS.length]);
      glo(put(box(w - 0.4, 0.1, d + 0.06), x, 1.1, z), ACENTOS[(i + 2) % ACENTOS.length]);
    } else if (k === 'mesa') {
      sol(put(cyl(c.r * 1.25, c.r * 1.4, 0.25, seg * 2), x, 0.12, z), PAL.rosa);
      sol(put(cyl(c.r * 0.9, c.r * 1.1, c.h - 0.2, seg * 2), x, c.h / 2 + 0.1, z), PAL.piedra);
      sol(put(cyl(c.r, c.r, 0.14, seg * 2), x, c.h, z), PAL.oscuro);
      glo(put(cyl(c.r * 1.01, c.r * 1.01, 0.1, seg * 2), x, c.h - 0.12, z), PAL.oro);
      glo(put(cyl(c.r * 1.3, c.r * 1.3, 0.05, seg * 2), x, 0.3, z), PAL.cian);
    } else if (k === 'consola') {
      sol(put(box(c.hx * 2, c.h, c.hz * 2), x, c.h / 2, z), PAL.piedra);
      sol(put(box(c.hx * 1.9, 0.14, c.hz * 1.7), x, c.h + 0.35, z + 0.1, -0.5), PAL.oscuro);
      glo(put(box(c.hx * 1.5, 0.05, c.hz * 1.1), x, c.h + 0.43, z + 0.12, -0.5), PAL.cian);
      for (let i = 0; i < 5; i++) glo(put(new THREE.SphereGeometry(0.1, 5, 4), x - c.hx * 0.8 + i * c.hx * 0.4, c.h + 0.1, z + c.hz + 0.05), ACENTOS[i]);
      for (const sx of [-1, 1]) { sol(put(cyl(0.12, 0.12, 5, 6), x + sx * (c.hx + 0.4), 2.5, z - 1.4), PAL.oscuro); glo(put(new THREE.SphereGeometry(0.28, 6, 5), x + sx * (c.hx + 0.4), 5.1, z - 1.4), PAL.magenta); }
    } else if (k === 'cuba') {
      sol(put(cyl(c.r * 1.35, c.r * 1.5, 0.6, seg), x, 0.3, z), PAL.oscuro);
      sol(put(cyl(c.r * 1.15, c.r * 1.0, 0.6, seg), x, c.h + 0.3, z), PAL.oscuro);
      sol(put(cyl(0.22, 0.22, 11 - c.h, 6), x, c.h + 0.6 + (11 - c.h) / 2, z), PAL.rosa);
      glo(put(cyl(c.r * 1.36, c.r * 1.36, 0.08, seg), x, 0.64, z), PAL.cian);
      glo(put(cyl(c.r * 1.16, c.r * 1.16, 0.08, seg), x, c.h + 0.02, z), PAL.magenta);
    } else if (k === 'puesto') {
      sol(put(box(c.hx * 2, c.h, c.hz * 2), x, c.h / 2, z), PAL.madera);
      sol(put(box(c.hx * 2.3, 0.14, c.hz * 2.1), x, c.h + 0.07, z), 0xe0b88a);
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) sol(put(cyl(0.08, 0.08, 3.4, 5), x + sx * (c.hx + 0.2), 1.7, z + sz * (c.hz - 0.1)), PAL.oscuro);
      for (let i = 0; i < 6; i++) sol(put(box(c.hx * 2 + 1.1, 0.14, c.hz * 2 / 6 + 0.03), x - 0.5 + 0.0, 3.5 - Math.abs(i - 2.5) * 0.05, z - c.hz + (i + 0.5) * c.hz * 2 / 6, 0.0, 0, 0.35), i & 1 ? PAL.oro : PAL.magenta);
      for (let i = 0; i < 4; i++) glo(put(new THREE.SphereGeometry(0.17, 6, 4), x + 0.1, c.h + 0.3, z - 2 + i * 1.3), [PAL.oro, PAL.cian, PAL.lima, PAL.magenta][i]);
    } else if (k === 'yunque') {
      sol(put(cyl(0.5, 0.7, 0.55, 6), x, 0.28, z), PAL.oscuro); sol(put(box(1.2, 0.35, 0.55), x, 0.75, z), 0x6a5a7a); sol(put(box(0.5, 0.3, 0.4), x - 0.8, 0.8, z), 0x6a5a7a);
      glo(put(new THREE.ConeGeometry(0.5, 1.1, 6), x + 2.2, 0.6, z + 0.2), 0xff8a3a); glo(put(new THREE.ConeGeometry(0.3, 0.8, 6), x + 2.2, 0.75, z + 0.2), 0xffe27a); sol(put(cyl(0.8, 0.9, 0.35, 8), x + 2.2, 0.17, z + 0.2), 0x6a5a7a);
    } else if (k === 'fuente') {
      sol(put(cyl(c.r, c.r * 0.8, c.h, seg), x, c.h / 2, z), PAL.piedra); glo(put(cyl(c.r * 0.85, c.r * 0.85, 0.05, seg), x, c.h + 0.02, z), PAL.cian);
      sol(put(cyl(0.12, 0.2, 1.8, 6), x, 1.2, z), PAL.piedra); glo(put(new THREE.SphereGeometry(0.28, 6, 5), x, 2.2, z), PAL.lima);
    } else if (k === 'espejo') {
      sol(put(cyl(c.r * 0.7, c.r * 1.2, c.h, seg), x + 0.5, c.h / 2, z), PAL.rosa);
      sol(put(new THREE.SphereGeometry(c.r * 0.85, 8, 6), x + 0.5, c.h + 0.2, z), PAL.rosa);
      sol(put(new THREE.TorusGeometry(1.95, 0.16, 6, low ? 20 : 32), x - c.r - 0.05, 2.7, z, 0, Math.PI / 2, 0, 1, 1.25, 1), PAL.oro);
    } else if (k === 'maceta') {
      sol(put(cyl(c.r, c.r * 0.72, c.h, seg), x, c.h / 2, z), PAL.tierra); sol(put(cyl(c.r * 1.12, c.r * 1.05, 0.14, seg), x, c.h, z), 0xe49a78); sol(put(cyl(c.r * 0.9, c.r * 0.9, 0.04, seg), x, c.h + 0.02, z), 0x4a3030);
    } else if (k === 'vivario') {
      sol(put(box(c.hx * 2 + 0.3, 0.3, c.hz * 2 + 0.3), x, 0.15, z), PAL.oscuro); sol(put(box(c.hx * 2 + 0.3, 0.3, c.hz * 2 + 0.3), x, c.h + 0.15, z), PAL.oscuro);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) sol(put(cyl(0.1, 0.1, c.h, 5), x + sx * c.hx, c.h / 2, z + sz * c.hz), PAL.rosa);
      glo(put(box(c.hx * 2 - 0.4, 0.05, c.hz * 2 - 0.4), x, 0.34, z), [PAL.lima, PAL.turq, PAL.violeta][VIVARIOS.findIndex((v) => v.x === x)] || PAL.lima);
    } else if (k === 'maniqui') {
      sol(put(cyl(0.45, 0.55, 0.2, 7), x, 0.1, z), PAL.oscuro); sol(put(cyl(0.06, 0.06, 1.9, 5), x, 1.0, z), PAL.madera);
      sol(put(cyl(0.34, 0.42, 1.0, 7), x, 1.35, z), 0xe0c08a); sol(put(new THREE.SphereGeometry(0.26, 7, 5), x, 2.0, z), 0xe0c08a); sol(put(box(1.3, 0.14, 0.14), x, 1.7, z), PAL.madera);
      glo(put(new THREE.TorusGeometry(0.2, 0.05, 4, 10), x, 1.45, z + 0.43), 0xff4a4a); glo(put(new THREE.SphereGeometry(0.07, 5, 4), x, 1.45, z + 0.45), 0xffffff);
    } else if (k === 'vitrina') {
      sol(put(box(c.hx * 2 + 0.3, 0.7, c.hz * 2 + 0.3), x, 0.35, z), PAL.oscuro); sol(put(box(c.hx * 2 + 0.3, 0.3, c.hz * 2 + 0.3), x, c.h + 0.15, z), PAL.oscuro);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) sol(put(cyl(0.07, 0.07, c.h, 5), x + sx * c.hx, c.h / 2, z + sz * c.hz), PAL.oro);
      glo(put(box(c.hx * 2 - 0.3, 0.05, c.hz * 2 - 0.3), x, 0.72, z), PAL.oro);
    } else if (k === 'pedestal') {
      sol(put(cyl(c.r, c.r * 1.3, c.h, seg), x, c.h / 2, z), PAL.piedra); glo(put(cyl(c.r * 1.01, c.r * 1.01, 0.08, seg), x, c.h - 0.04, z), PAL.oro);
    } else if (k === 'banco') {
      sol(put(box(c.hx * 2, c.h, c.hz * 2), x, c.h / 2, z), PAL.madera); sol(put(box(c.hx * 2 - 0.1, 0.12, c.hz * 2 - 0.1), x, c.h + 0.06, z), PAL.violeta);
    }
  }
  /* cordones de los capullos colgantes */
  for (const cp of CAPULLOS) { sol(put(cyl(0.05, 0.05, 8.4, 4), cp.x, 8, cp.z), PAL.oscuro); sol(put(new THREE.SphereGeometry(0.22, 5, 4), cp.x, 12.2, cp.z), PAL.oro); }
  /* puerta de Cooperativo: marco (el remolino va aparte) */
  { const E = ESTACIONES.coop; sol(put(new THREE.TorusGeometry(2.9, 0.28, 6, low ? 20 : 32), -39.2, 3.3, E.z, 0, Math.PI / 2, 0, 1, 1.15, 1), PAL.oro); sol(put(box(0.9, 0.5, 6.6), -39.6, 0.25, E.z), PAL.oscuro); }
  /* interior de los vivarios: criaturas dormidas de luz */
  VIVARIOS.forEach((v, i) => {
    const c = [PAL.lima, PAL.turq, PAL.violeta][i];
    if (i === 0) { glo(put(new THREE.TorusGeometry(0.7, 0.2, 5, 10), v.x, 0.9, v.z, Math.PI / 2), c); glo(put(new THREE.SphereGeometry(0.28, 6, 5), v.x + 0.8, 1.1, v.z), c); }
    if (i === 1) { glo(put(new THREE.SphereGeometry(0.6, 8, 6), v.x, 1.7, v.z, 0, 0, 0, 1, 0.7, 1), c); for (let t = -2; t <= 2; t++) glo(put(cyl(0.04, 0.02, 1.2, 4), v.x + t * 0.22, 0.9, v.z), c); }
    if (i === 2) { glo(put(new THREE.OctahedronGeometry(0.7), v.x, 1.1, v.z, 0, 0.6, 0, 1, 1.4, 1), c); glo(put(new THREE.OctahedronGeometry(0.35), v.x + 1.0, 0.6, v.z + 0.2), c); }
  });
  /* hongos y frondas decorativas en el jardín (más en Media/Alta) */
  for (let i = 0; i < (low ? 8 : 22); i++) {
    const a = i * 2.399, rr = 5 + (i * 7 % 10), x = 26 + Math.cos(a) * rr * 1.5, z = -30 + Math.sin(a) * rr * 0.9;
    if (x < 14 || x > 38 || z > -14 || z < -36 || MACETAS.some((m) => Math.hypot(m.x - x, m.z - z) < 2.5)) continue;
    sol(put(cyl(0.05, 0.1, 0.8 + (i % 3) * 0.3, 5), x, 0.4, z), PAL.hueso); glo(put(new THREE.SphereGeometry(0.4 + (i % 2) * 0.15, 6, 4, 0, 6.28, 0, 1.6), x, 0.85 + (i % 3) * 0.3, z), ACENTOS[i % ACENTOS.length]);
  }
  /* mesa del Herrero / vitrina central: pequeños detalles de las estaciones sin cobertura propia */
  { const g = new THREE.OctahedronGeometry(0.55); glo(put(g, -24, 1.9, -26, 0, 0, 0, 1, 1.5, 1), PAL.oro); }

  const solid = merged(S), glow = merged(GL);
  const mSol = new THREE.Mesh(solid, new THREE.MeshStandardMaterial({ vertexColors: true, color: hi ? 0xe0e0e0 : 0xffffff, roughness: 0.62, metalness: 0.05, envMapIntensity: hi ? 0.25 : 0.6 })); mSol.matrixAutoUpdate = false; root.add(mSol);
  const mGlow = new THREE.Mesh(glow, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false })); mGlow.matrixAutoUpdate = false; root.add(mGlow);

  /* ───── cubas de la Forja: vidrio y líquido instanciados ───── */
  const M4 = new THREE.Matrix4(), V3 = new THREE.Vector3(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3();
  const unitCyl = cyl(1, 1, 1, seg * 2).translate(0, 0.5, 0);
  const glass = new THREE.InstancedMesh(unitCyl, glassMat(0xbff6ff, 0.22), CUBAS.length); glass.frustumCulled = false; glass.renderOrder = 6;
  const liq = new THREE.InstancedMesh(unitCyl.clone(), null, CUBAS.length); liq.frustumCulled = false; liq.renderOrder = 5;
  CUBAS.forEach((c, i) => { M4.compose(V3.set(c.x, 0.6, c.z), Q.identity(), S3.set(c.r, 5.5, c.r)); glass.setMatrixAt(i, M4); M4.compose(V3.set(c.x, 0.7, c.z), Q.identity(), S3.set(c.r * 0.93, 5.2, c.r * 0.93)); liq.setMatrixAt(i, M4); });
  const aFill = new THREE.InstancedBufferAttribute(new Float32Array(CUBAS.length).fill(0.5), 1), aCol = new THREE.InstancedBufferAttribute(new Float32Array(CUBAS.length * 3), 3), aGlow = new THREE.InstancedBufferAttribute(new Float32Array(CUBAS.length), 1);
  liq.geometry.setAttribute('aFill', aFill); liq.geometry.setAttribute('aCol', aCol); liq.geometry.setAttribute('aGlow', aGlow);
  liq.material = finish(new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: { uTime },
    vertexShader: `attribute float aFill, aGlow; attribute vec3 aCol; varying float vY, vF, vG; varying vec3 vC, vW; varying vec3 vN;
      void main(){ vec4 p = instanceMatrix * vec4(position, 1.0); vec4 w = modelMatrix * p; vW = w.xyz; vY = position.y; vF = aFill; vG = aGlow; vC = aCol; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; varying float vY, vF, vG; varying vec3 vC, vW, vN;
      void main(){ if (vY > vF) discard; vec3 V = normalize(cameraPosition - vW); float f = 1.0 - abs(dot(normalize(vN), V));
        float bub = smoothstep(0.93, 1.0, sin(vW.y * 6.0 - uTime * 2.0 + vW.x * 3.0 + vW.z * 5.0) * 0.5 + 0.5) * 0.5;
        float wav = 0.5 + 0.5 * sin(vW.y * 2.2 + uTime * 0.9 + vW.x);
        vec3 c = vC * (0.75 + 0.35 * wav) + vec3(bub) + vC * f * 0.5 + vC * vG * (0.5 + 0.5 * sin(uTime * 4.0));
        float surf = smoothstep(0.04, 0.0, vF - vY); c += vec3(1.0, 0.95, 0.85) * surf * 0.8;
        gl_FragColor = vec4(c, 0.9); }`,
  }));
  root.add(liq, glass);
  parts.liq = { aFill, aCol, aGlow }; parts.item = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); parts.item.position.set(CUBAS[2].x, 3.2, CUBAS[2].z); parts.item.visible = false; root.add(parts.item);

  /* ───── vidrios cuadrados: vivarios y vitrinas (una sola instanciación) ───── */
  const unitBox = box(1, 1, 1).translate(0, 0.5, 0), boxes = [...VIVARIOS.map((v) => ({ x: v.x, z: v.z, w: 4.4, h: 2.3, d: 1.8, y: 0.3 })), ...VITRINAS.map((v) => ({ x: v.x, z: v.z, w: 3.7, h: 1.9, d: 1.4, y: 0.7 }))];
  const glass2 = new THREE.InstancedMesh(unitBox, glassMat(0xe8f6ff, 0.16), boxes.length); glass2.frustumCulled = false; glass2.renderOrder = 6;
  boxes.forEach((b, i) => { M4.compose(V3.set(b.x, b.y, b.z), Q.identity(), S3.set(b.w, b.h, b.d)); glass2.setMatrixAt(i, M4); });
  root.add(glass2);

  /* ───── Mesa de Territorios: holograma + 6 arenas + vórtice ───── */
  const holoMat = finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
      void main(){ float r = length(vUv); if (r > 1.0) discard; vec2 g = abs(fract(vUv * 6.0) - 0.5) * 2.0; float grid = smoothstep(0.93, 1.0, max(g.x, g.y)) * 0.5;
        float ring = smoothstep(0.03, 0.0, abs(fract(r * 3.0 - uTime * 0.2) - 0.5) - 0.45) * 0.0 + smoothstep(0.04, 0.0, abs(r - 0.95)) + smoothstep(0.03, 0.0, abs(r - 0.62)) * 0.6;
        float scan = smoothstep(0.05, 0.0, abs(fract(vUv.y * 0.5 - uTime * 0.15) - 0.5)) * 0.3;
        vec3 c = pal(r * 0.6 - uTime * 0.08) * (grid + ring + scan + 0.16 * (1.0 - r)) * 1.1; gl_FragColor = vec4(c, 1.0); }`,
  }));
  const holo = new THREE.Mesh(new THREE.CircleGeometry(2.45, 48).rotateX(-Math.PI / 2), holoMat); holo.position.set(0, 1.2, 0); root.add(holo);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: 0xffe9a8, wireframe: true, toneMapped: false })); core.position.set(0, 2.6, 0); root.add(core);
  const pins = new THREE.InstancedMesh(new THREE.ConeGeometry(0.2, 0.9, 6).translate(0, 0.45, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), 6); pins.frustumCulled = false;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; M4.compose(V3.set(Math.cos(a) * 1.55, 1.25, Math.sin(a) * 1.55), Q.identity(), S3.set(1, 1, 1)); pins.setMatrixAt(i, M4); pins.setColorAt(i, new THREE.Color(0x888888)); }
  root.add(pins); parts.holo = { core, pins };

  /* ───── espejo del Armero y puerta de Cooperativo ───── */
  const espejoMat = swirlMat(0x6fe9ff, 0xff7ad9, 0.5), espejo = new THREE.Mesh(new THREE.CircleGeometry(1.82, 40), espejoMat); espejo.scale.set(1, 1.25, 1); espejo.rotation.y = -Math.PI / 2; espejo.position.set(28.5, 2.7, 0); root.add(espejo);
  const portalMat = swirlMat(0xb98cff, 0x6fe9ff, 0.35), portal = new THREE.Mesh(new THREE.CircleGeometry(2.75, 40), portalMat); portal.scale.set(1, 1.15, 1); portal.rotation.y = Math.PI / 2; portal.position.set(-39.1, 3.3, ESTACIONES.coop.z); root.add(portal);
  parts.espejoMat = espejoMat; parts.portalMat = portalMat;

  /* ───── capullos colgantes (uno por Huésped): cáscara + alma ───── */
  const ni = (g) => (g.index ? g.toNonIndexed() : g);
  const shellG = new THREE.SphereGeometry(1, 14, 10).scale(0.95, 1.7, 0.95), soulG = merged([put(cyl(0.3, 0.38, 1.3, 7), 0, 0.2, 0), put(new THREE.SphereGeometry(0.3, 7, 5), 0, 1.15, 0), put(box(1.0, 0.16, 0.16), 0, 0.75, 0)].map(ni));
  const n = CAPULLOS.length, cAcc = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), shell = new THREE.InstancedMesh(shellG, null, n); shell.frustumCulled = false; shell.renderOrder = 6;
  shell.geometry.setAttribute('aCS', cAcc);
  shell.material = finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime },
    vertexShader: `attribute vec4 aCS; varying vec4 vS; varying vec3 vN, vW; void main(){ vec4 p = instanceMatrix * vec4(position, 1.0); vec4 w = modelMatrix * p; vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vS = aCS; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; varying vec4 vS; varying vec3 vN, vW;
      void main(){ vec3 V = normalize(cameraPosition - vW); float f = 1.0 - abs(dot(normalize(vN), V)); float own = vS.w;
        vec3 col = mix(vec3(0.55, 0.52, 0.62), vS.rgb, own); float pulse = 0.75 + 0.25 * sin(uTime * 2.0 + vW.z);
        float a = mix(0.28, 0.34, own) + f * 0.5; col = col * (0.6 + f * 0.9) * mix(1.0, pulse, own);
        gl_FragColor = vec4(col, a); }`,
  }));
  const soul = new THREE.InstancedMesh(soulG, new THREE.MeshBasicMaterial({ toneMapped: false, vertexColors: false }), n); soul.frustumCulled = false;
  CAPULLOS.forEach((c, i) => { M4.compose(V3.set(c.x, 5.3, c.z), Q.identity(), S3.set(1.05, 1.05, 1.05)); shell.setMatrixAt(i, M4); M4.compose(V3.set(c.x, 4.2, c.z), Q.identity(), S3.set(0, 0, 0)); soul.setMatrixAt(i, M4); soul.setColorAt(i, new THREE.Color(0xffffff)); });
  root.add(shell, soul); parts.cap = { shell, soul, attr: cAcc };

  /* ───── plantas del jardín (instanciadas; las anima base-fx) ───── */
  const plantG = merged([put(cyl(0.07, 0.1, 1.2, 5), 0, 0.6, 0), put(new THREE.SphereGeometry(0.5, 7, 5), 0, 1.35, 0, 0, 0, 0, 1, 0.8, 1), put(new THREE.ConeGeometry(0.35, 0.8, 5), 0.45, 0.9, 0, 0, 0, -0.9), put(new THREE.ConeGeometry(0.35, 0.8, 5), -0.45, 0.9, 0, 0, 0, 0.9)].map(ni));
  const plants = new THREE.InstancedMesh(plantG, new THREE.MeshStandardMaterial({ roughness: 0.55, emissive: 0x335522, emissiveIntensity: 0.6 }), MACETAS.length); plants.frustumCulled = false;
  const halos = new THREE.InstancedMesh(new THREE.RingGeometry(1.2, 1.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }), MACETAS.length); halos.frustumCulled = false;
  MACETAS.forEach((m, i) => { M4.compose(V3.set(m.x, 0.95, m.z), Q.identity(), S3.set(0, 0, 0)); plants.setMatrixAt(i, M4); plants.setColorAt(i, new THREE.Color(0x88ff66)); halos.setMatrixAt(i, M4); });
  root.add(plants, halos); parts.plants = { plants, halos };

  /* ───── gemas de las vitrinas (las llena base-fx con tus objetos más fuertes) ───── */
  const GEMS = VITRINAS.length * 4, gems = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.34), new THREE.MeshBasicMaterial({ toneMapped: false }), GEMS); gems.frustumCulled = false;
  for (let i = 0; i < GEMS; i++) { M4.compose(V3.set(0, -50, 0), Q.identity(), S3.set(0, 0, 0)); gems.setMatrixAt(i, M4); gems.setColorAt(i, new THREE.Color(0xffffff)); }
  root.add(gems); parts.gems = gems;

  /* ───── carteles de las estaciones (un atlas, una llamada) y puntitos de aviso ───── */
  const AW = 1024, CH = 96, atlas = document.createElement('canvas'); atlas.width = AW; atlas.height = CH * (ids.length + 1) + 128;
  { const g = atlas.getContext('2d'); g.textBaseline = 'middle'; g.textAlign = 'center';
    ids.forEach((id, i) => { const e = ESTACIONES[id], y = i * CH; g.fillStyle = 'rgba(40,24,60,0.78)'; g.beginPath(); g.roundRect(10, y + 8, AW - 20, CH - 16, 36); g.fill(); g.lineWidth = 6; g.strokeStyle = '#' + e.color.toString(16).padStart(6, '0'); g.stroke();
      g.font = '700 54px "Trebuchet MS", system-ui, sans-serif'; g.lineWidth = 8; g.strokeStyle = '#1a0f2a'; const t = `${e.icono}  ${e.nombre}`; g.strokeText(t, AW / 2, y + CH / 2 + 3); g.fillStyle = '#fff6e8'; g.fillText(t, AW / 2, y + CH / 2 + 3); });
    const y0 = CH * ids.length, gr = g.createRadialGradient(64, y0 + 64, 4, 64, y0 + 64, 60); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#ffe27a'); gr.addColorStop(1, 'rgba(255,200,60,0)'); g.fillStyle = gr; g.fillRect(0, y0, 128, 128);
    g.font = '900 70px system-ui'; g.fillStyle = '#5a2a00'; g.fillText('!', 64, y0 + 68); }
  const tex = new THREE.CanvasTexture(atlas), QN = ids.length * 2, pos = new Float32Array(QN * 12), uvs = new Float32Array(QN * 8), cs = new Float32Array(QN * 12), ss = new Float32Array(QN * 8), on = new Float32Array(QN * 4), idx = [];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]], H = atlas.height;
  ids.forEach((id, i) => {
    const e = ESTACIONES[id], top = e.z < -34 ? 7.6 : id === 'territorios' ? 4.6 : 6.4;
    for (let k = 0; k < 2; k++) {   // k=0: cartel · k=1: puntito de aviso
      const qn = i * 2 + k, w = k ? 0.9 : 5.4, h = k ? 0.9 : 0.5, cy = k ? top + 0.95 : top;
      for (let c = 0; c < 4; c++) {
        const vi = qn * 4 + c; pos.set([corners[c][0], corners[c][1], 0], vi * 3); cs.set([e.x, cy, e.z], vi * 3); ss.set([w, h], vi * 2); on[vi] = k ? 0 : 1;
        const u0 = k ? 0 : 0, u1 = k ? 128 / AW : 1, v0 = k ? (CH * ids.length) : i * CH, v1 = k ? CH * ids.length + 128 : i * CH + CH;
        uvs.set([corners[c][0] < 0 ? u0 : u1, 1 - (corners[c][1] < 0 ? v1 : v0) / H], vi * 2);
      }
      idx.push(qn * 4, qn * 4 + 1, qn * 4 + 2, qn * 4, qn * 4 + 2, qn * 4 + 3);
    }
  });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); lg.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); lg.setAttribute('aC', new THREE.BufferAttribute(cs, 3)); lg.setAttribute('aS', new THREE.BufferAttribute(ss, 2));
  const aOn = new THREE.BufferAttribute(on, 1); aOn.setUsage(THREE.DynamicDrawUsage); lg.setAttribute('aOn', aOn); lg.setIndex(idx);
  const labels = new THREE.Mesh(lg, finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime, uTex: { value: tex } },
    vertexShader: `attribute vec3 aC; attribute vec2 aS; attribute float aOn; varying vec2 vUv; varying float vOn; varying float vD; uniform float uTime;
      void main(){ vec3 to = cameraPosition - aC; vec3 right = normalize(vec3(to.z, 0.0, -to.x)); float bob = aS.x < 1.0 ? 0.12 * sin(uTime * 3.0 + aC.x) : 0.0;
        vec3 p = aC + right * position.x * aS.x + vec3(0.0, 1.0, 0.0) * (position.y * aS.y + bob); vUv = uv; vOn = aOn; vD = length(to); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform sampler2D uTex; varying vec2 vUv; varying float vOn, vD; void main(){ vec4 t = texture2D(uTex, vUv); float a = t.a * vOn * smoothstep(70.0, 40.0, vD); if (a < 0.02) discard; gl_FragColor = vec4(t.rgb, a); }`,
  }))); labels.frustumCulled = false; labels.renderOrder = 9; root.add(labels); parts.labels = { aOn, ids };

  /* ───── cielo, rayos de luz, halos y motas ───── */
  limboSky(r, root, { sun: new THREE.Vector3(-0.4, -0.35, -0.8), hor: 0xffb8a0, zen: 0x7a4aa8, glow: 0xffb0e0, hue: 0.12, glyph: 0.7, skyline: 0 });
  lightShafts(root, [{ x: -18, z: -18, top: 34, r0: 6, r1: 1.5, k: 0.7, col: 0xffe0b0 }, { x: 20, z: -20, top: 34, r0: 6, r1: 1.5, k: 0.6, col: 0xffc8f0 }, { x: 0, z: 20, top: 34, r0: 6, r1: 1.5, k: 0.6, col: 0xc8f0ff }, ...(low ? [] : [{ x: -26, z: 24, top: 34, r0: 5, r1: 1.2, k: 0.5, col: 0xe0c8ff }, { x: 28, z: 22, top: 34, r0: 5, r1: 1.2, k: 0.5, col: 0xffd8b0 }])], { color: 0xfff0e0 });
  const bulbs = []; for (const c of map.covers) if (c.kind === 'pilar') for (const yy of [2.2, 5.6]) bulbs.push({ p: new THREE.Vector3(c.x, yy, c.z), s: 1.6, col: ACENTOS[(Math.round(c.x + c.z) + (yy > 3 ? 1 : 0) + 12) % ACENTOS.length], o: 0.5 });
  for (const e of Object.values(ESTACIONES)) bulbs.push({ p: new THREE.Vector3(e.x, 2.2, e.z), s: 3.4, col: e.color, o: 0.35 });
  haloField(root, bulbs, { tex: softTex() });
  const motes = new THREE.Points(particleGeo(low ? 160 : 420, (i, rd) => [(rd() - 0.5) * 80, 0.5 + rd() * 16, -2 + (rd() - 0.5) * 84], 31), particleMat({ color: 0xfff0d8, size: 0.14, mode: 1, amp: 1.4, alpha: 0.7 })); motes.frustumCulled = false; root.add(motes);
  const bubbles = new THREE.Points(particleGeo(low ? 40 : 110, (i, rd) => [(rd() - 0.5) * 20, 0.8, -38 + (rd() - 0.5) * 3], 17), particleMat({ color: 0xbff6ff, size: 0.2, mode: 0, speed: 0.22, height: 6, amp: 0.4, alpha: 0.8 })); motes.frustumCulled = false; bubbles.frustumCulled = false; root.add(bubbles);
  if (!low) { // luces puntuales cálidas (Media/Alta): la Forja y la Mesa
    const l1 = new THREE.PointLight(0xff7ad9, 14, 26, 1.6); l1.position.set(0, 5, -33); const l2 = new THREE.PointLight(0xffe0a0, 10, 22, 1.6); l2.position.set(0, 4, 0); root.add(l1, l2); parts.luces = [l1, l2];
  }
  /* ───── NPC livianos para Baja: una figura fusionada (túnica + cabeza + prop de su oficio) + su aro de luz; Media/Alta usan los humanos de Arcanum ───── */
  r.objects.npcLite = low ? (d, col) => {
    const kind = d.nk, L = [], add = (g, hex) => L.push(paint(g, hex)), dark = new THREE.Color(col).multiplyScalar(0.55).getHex(), skin = 0xf0c8a0;
    add(put(cyl(0.34, 0.78, 1.5, 8), 0, 0.75, 0), dark); add(put(new THREE.SphereGeometry(0.42, 8, 6), 0, 1.55, 0, 0, 0, 0, 1, 0.8, 0.8), col);
    add(put(new THREE.SphereGeometry(0.26, 8, 6), 0, 2.0, 0.03), skin); add(put(new THREE.ConeGeometry(0.34, 0.5, 8), 0, 2.32, 0), kind === 'sanadora' ? 0x2a9a6a : kind === 'herrero' ? 0x5a3a2a : col);
    add(put(cyl(0.12, 0.12, 0.7, 5), 0.5, 1.2, 0.25, 0.6, 0, 0), skin);
    if (kind === 'cambista') add(put(new THREE.TorusGeometry(0.22, 0.06, 5, 10), 0.72, 1.55, 0.35), 0xffd45a);
    else if (kind === 'herrero') { add(put(cyl(0.05, 0.05, 1.1, 5), 0.78, 1.0, 0.3), 0x6a4a2a); add(put(box(0.5, 0.26, 0.26), 0.78, 1.6, 0.3), 0x6a6a7a); }
    else if (kind === 'sanadora') { add(put(box(0.5, 0.12, 0.12), 0.7, 1.8, 0.3), 0x7dffb0); add(put(box(0.12, 0.5, 0.12), 0.7, 1.8, 0.3), 0x7dffb0); }
    else { add(put(cyl(0.05, 0.05, 2.4, 5), 0.8, 1.2, 0.3), 0xcfa070); add(put(new THREE.OctahedronGeometry(0.22), 0.8, 2.55, 0.3), 0x9fe8ff); }
    const body = new THREE.Mesh(merged(L), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: new THREE.Color(col), emissiveIntensity: 0.18 })), g = new THREE.Group(), pivot = new THREE.Group(); pivot.add(body); g.add(pivot);
    const aura = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.25, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending })); aura.position.y = 0.06; g.add(aura);
    g.userData = { pivot, aura, simple: true }; return g;
  } : null;
  for (const [id, it] of [...r.objects.items]) if (it.t === 'npc') { r.objects.root.remove(it.g); r.objects.items.delete(id); }   // (los NPC que se armaron antes de llegar acá se rehacen con el estilo de esta calidad)
  r.baseFx = createBaseFx(r, parts, { low });
}
