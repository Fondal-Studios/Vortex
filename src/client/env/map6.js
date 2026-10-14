// Entorno del Mapa 6 · OSARIO SIN TECHO — el osario de Sedlec de ARCANUM, MUERTO y ALUCINADO en el limbo.
// Origen: /duelo-arcano/src/world/prague-route.js (mapa 'sedlec': bóvedas, nichos, pilastras, altar, la araña de huesos
// con sus aros), escenografia.js (velas, rastro de huellas, la fractura que sale del altar) y ruta-paisaje.js (pirámides de
// calaveras en las esquinas, guirnaldas de calaveras colgadas de bóveda en bóveda, escudo de huesos, grietas violetas).
// Acá la bóveda se cayó HACIA ARRIBA: sus nervaduras flotan sobre la nave y el cielo del más allá entra por el hueco.
//   · planta en CRUZ (src/sim/map6.js): nave sur (aparición) → crucero (araña de huesos, gravedad rota leve) → nave norte
//     (altar y la grieta); brazos oeste y este. Un camino de losas claras marca los ejes: imposible perderse;
//   · pirámides de calaveras, guirnaldas, bandas de huesos al pie de los muros; las cuencas de las calaveras brillan;
//   · velas con llamas de colores, charcos de luz, raíces que trepan, grietas de luz, polvo, rayos de luz por el techo roto;
//   · cielo alucinado (dorado y violeta) con geometría sagrada y el sol muerto.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cfg } from '../quality.js';
import { uTime, finish } from '../shaders.js';
import { addMotes } from './common.js';
import { trackPx, softTex, mistLayer, particleGeo, particleMat } from './props.js';
import { rng } from './noise.js';
import { M6 } from '../../sim/map6.js';
import {
  deadMaterial, glowMaterial, Batch, put, box, cyl, archGeo, limboSky, crackStrips, rootsMesh, climbCurve, floaters, floatItem,
  leveZone, haloField, lightShafts, lightPools, risingStream,
} from './limbo-kit.js';

export const M6V = { sun: new THREE.Vector3(0.38, 0.42, 0.82).normalize() };
const ACC = [0xb07bff, 0x9fe8ff, 0xf2c66d, 0xff4fd8, 0x46ffd0];
const BONE = [0xe8dcc4, 0xddd0b4, 0xf0e6d2, 0xcfc1a4, 0xe2d6bc];

/** Calavera liviana (~48 triángulos): cráneo + maxilar, con color por vértice. +z = cara. Las cuencas son un plano aparte (eyePlate). */
function skullGeo() {
  const parts = [];
  const add = (g, c) => { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, a = new Float32Array(n * 3), col = new THREE.Color(c); for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); parts.push(g); };
  add(put(new THREE.SphereGeometry(0.5, 6, 4), 0, 0.1, -0.04, 0, 0, 0, 0.95, 1.02, 1.12), 0xffffff);
  add(put(box(0.44, 0.3, 0.36), 0, -0.36, 0.2), 0xeee6d6);             // maxilar y mandíbula
  return mergeGeometries(parts, false);
}
/** Cuencas: un plano de 2 triángulos delante de la cara; su color de instancia es casi negro (cuenca vacía) o una luz de color. */
const eyePlate = () => put(new THREE.PlaneGeometry(0.56, 0.42), 0, -0.06, 0.52);
/** Cara de la calavera: dos cuencas redondas y la nariz (textura con transparencia). */
function eyeTex() { const c = document.createElement('canvas'); c.width = 128; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#fff';
  for (const x of [36, 92]) { g.beginPath(); g.ellipse(x, 38, 21, 19, 0, 0, 7); g.fill(); } g.beginPath(); g.moveTo(64, 56); g.lineTo(56, 80); g.lineTo(72, 80); g.fill();
  const t = new THREE.CanvasTexture(c); return t; }
/** Fémur liviano (~22 triángulos): caña de 3 lados y dos cabezas octaédricas. Eje x. */
const femurGeo = () => mergeGeometries([put(cyl(0.05, 0.05, 1, 3), 0, 0, 0, 0, 0, Math.PI / 2), put(new THREE.OctahedronGeometry(0.1), -0.52, 0, 0, 0, 0, 0, 0.6, 1, 1.3), put(new THREE.OctahedronGeometry(0.1), 0.52, 0, 0, 0, 0, 0, 0.6, 1, 1.3)].map((g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); return g; }), false);

/** La grieta del altar: el más allá visto por una rajadura vertical (psicodelia a pleno). */
function riftMat() {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      float h(float x){ return fract(sin(x * 127.1) * 43758.5); }
      float zig(float y){ float i = floor(y * 9.0), f = fract(y * 9.0); return mix(h(i), h(i + 1.0), f) - 0.5; }
      void main(){ float x = vUv.x - 0.5 - zig(vUv.y) * 0.16 - zig(vUv.y * 3.0 + 7.0) * 0.05;
        float w = 0.05 + 0.13 * sin(vUv.y * 3.1416); float core = 1.0 - smoothstep(0.0, w, abs(x)), glow = exp(-abs(x) * 9.0);
        float fade = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y));
        vec3 pal = 0.55 + 0.45 * cos(6.28318 * (vUv.y * 1.2 - uTime * 0.12 + x * 4.0 + vec3(0.0, 0.33, 0.67)));
        float sw = 0.5 + 0.5 * sin(vUv.y * 40.0 - uTime * 3.0 + x * 30.0);
        vec3 c = pal * core * (0.8 + 0.8 * sw) + vec3(1.0, 0.92, 0.75) * pow(core, 4.0) * 1.5 + pal * glow * 0.45;
        gl_FragColor = vec4(c * fade, 1.0); }`,
  }));
}

export function build(r, map) {
  const root = r.mapRoot, q = cfg(), low = !q.decor, rd = rng(6060), sunDir = M6V.sun.clone();
  r.hemi.color.setHex(0xc8a8ff); r.hemi.groundColor.setHex(0x2a1a14); r.hemi.intensity = 1.3;
  r.sun.color.setHex(0xffe2b0); r.sun.intensity = 2.2; r.sun.position.copy(sunDir); r.sunDir = sunDir.clone();
  r.rim.color.setHex(0x46ffd0); r.rim.intensity = 0.8;
  r.scene.environmentIntensity = 0.45;
  trackPx(r);
  const N = M6.NAVE, X = M6.CRUCERO, H = M6.WALL_H, A = M6.ALTAR;

  const MAT = {
    floor: deadMaterial('flag', { sat: 0.55, tint: 0xd8cfc4, dustK: 0, grime: 0, crack: 0.9, crackY: [-1, 0.5], crackCol: 0xf2c66d, rough: 0.9, envI: 0.8 }),
    stone: deadMaterial('vault', { sat: 0.6, tint: 0xe2d8cc, dustK: 0.45, grime: 0.45, crack: 0.7, crackY: [0.3, 30], crackCol: 0xb07bff }),
    trim: deadMaterial('ashlar', { sat: 0.5, tint: 0xf0e8dc, dustK: 0.5, grime: 0.3, crack: 0.4, crackCol: 0x9fe8ff }),
    bone: deadMaterial('ph:marble_01', { sat: 0.7, tint: 0xfff4e0, dustK: 0.2, grime: 0.15, crack: 0.25, crackCol: 0xff4fd8, rough: 0.7 }),
    iron: deadMaterial(null, { color: 0x2a2622, sat: 0.4, rough: 0.5, metal: 0.8, dustK: 0.2, crack: 0, envI: 1 }),
    cloth: deadMaterial('ph:rough_linen', { sat: 0.8, tint: 0x8a2a3a, dustK: 0.25, crack: 0 }),
    glow: glowMaterial(),
  };
  const B = { floor: new Batch(0.25), stone: new Batch(0.22), trim: new Batch(0.3), bone: new Batch(0.6), iron: new Batch(0.5), cloth: new Batch(0.5), glow: new Batch(1) };

  // ── piso de losas y los CAMINOS: franjas de losa clara por los dos ejes de la cruz (de la entrada al altar, de brazo a brazo)
  B.floor.add(put(new THREE.PlaneGeometry(N.x1 - N.x0 + 1, N.z1 - N.z0 + 1).rotateX(-Math.PI / 2), 0, 0, (N.z0 + N.z1) / 2), 0xffffff);
  for (const s of [-1, 1]) B.floor.add(put(new THREE.PlaneGeometry(X.x1 - N.x1 + 0.5, X.z1 - X.z0 + 1).rotateX(-Math.PI / 2), s * (N.x1 + X.x1) / 2, 0, 0), 0xffffff);
  B.trim.add(put(box(3.2, 0.03, N.z1 - N.z0 - 2), 0, 0.015, (N.z0 + N.z1) / 2), 0xfff6e6);
  B.trim.add(put(box(X.x1 - X.x0 - 2, 0.03, 3.2), 0, 0.016, 0), 0xfff6e6);
  for (const z of [30, 20, -22, -32]) B.trim.add(put(box(4.2, 0.035, 0.3), 0, 0.02, z), 0xd6c8b0);

  // ── muros (las mismas cajas de la simulación) con coronamiento roto, pilastras y nichos
  for (const w of map.wallDefs) {
    const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2, wx = w.x1 - w.x0, wz = w.z1 - w.z0;
    B.stone.add(put(box(wx, H, wz), cx, H / 2, cz), 0xffffff);
    const L = Math.max(wx, wz), along = wx > wz, n = Math.floor(L / 2.2);
    for (let i = 0; i < n; i++) { // coronamiento roto: sillares desparejos (algunos ya flotan: ver más abajo)
      if (rd() < 0.35) continue; const t = (i + 0.5) / n - 0.5, hh = 0.6 + rd() * 3.4;
      B.stone.add(put(box(along ? 2.1 : wx * 0.9, hh, along ? wz * 0.9 : 2.1), cx + (along ? t * L : 0), H + hh / 2, cz + (along ? 0 : t * L)), 0xe8e0d4);
    }
    B.trim.add(put(box(wx + 0.3, 0.5, wz + 0.3), cx, 0.25, cz), 0xcfc4b4);
    B.trim.add(put(box(wx + 0.2, 0.35, wz + 0.2), cx, 7.4, cz), 0xe0d6c6);
  }
  // caras interiores (para pilastras, nichos, huesos y raíces): [x0,z0,x1,z1,nx,nz]
  const faces = [
    [N.x0, X.z1, N.x0, N.z1, 1, 0], [N.x1, X.z1, N.x1, N.z1, -1, 0], [N.x0, N.z1, N.x1, N.z1, 0, -1],
    [N.x0, N.z0, N.x0, X.z0, 1, 0], [N.x1, N.z0, N.x1, X.z0, -1, 0], [N.x0, N.z0, N.x1, N.z0, 0, 1],
    [X.x0, X.z0, X.x0, X.z1, 1, 0], [X.x1, X.z0, X.x1, X.z1, -1, 0],
    [X.x0, X.z0, N.x0, X.z0, 0, 1], [N.x1, X.z0, X.x1, X.z0, 0, 1], [X.x0, X.z1, N.x0, X.z1, 0, -1], [N.x1, X.z1, X.x1, X.z1, 0, -1],
  ];
  const skulls = [], femurs = [], candles = [], roots = [];
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S3 = new THREE.Vector3();
  const skull = (x, y, z, s, ry, rx = 0) => { E.set(rx, ry, 0); skulls.push(M4.compose(V.set(x, y, z), Q.setFromEuler(E), S3.setScalar(s)).clone()); };
  const femur = (x, y, z, s, ry, rz = 0) => { E.set(0, ry, rz); femurs.push(M4.compose(V.set(x, y, z), Q.setFromEuler(E), S3.setScalar(s)).clone()); };
  for (const [x0, z0, x1, z1, nx, nz] of faces) {
    const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L, ry = Math.atan2(nx, nz);
    const at = (t, off = 0) => [x0 + ux * t + nx * off, z0 + uz * t + nz * off];
    // pilastras cada ~6 m y nichos de calaveras entre ellas (los nichos de Sedlec)
    for (let t = 3; t < L - 2; t += 6) {
      const [px, pz] = at(t, 0.3); B.trim.add(put(box(Math.abs(nx) ? 0.6 : 1.1, H - 0.2, Math.abs(nz) ? 0.6 : 1.1), px, (H - 0.2) / 2, pz), 0xeae2d6);
      if (t + 3 < L - 1) {
        const [mx, mz] = at(t + 3, 0.05);
        B.trim.add(put(archGeo(1.0, 0.25, 0.4, 8), mx, 4.2, mz, 0, ry, 0), 0xf0e6d6);
        for (let j = 0; j < (low ? 2 : 3); j++) for (let k = -1; k <= 1; k++) skull(mx + ux * k * 0.55 + nx * 0.15, 2.6 + j * 0.5, mz + uz * k * 0.55 + nz * 0.15, 0.42, ry);
        if (rd() < 0.5) candles.push([mx + nx * 0.5, 2.15, mz + nz * 0.5]);
      }
    }
    // banda de huesos al pie del muro: fémures apilados con calaveras cada tanto (las pilas de Sedlec)
    // (como en ARCANUM: una masa de huesos detrás y las cabezas de los fémures asomando adelante)
    { const [mx, mz] = at(L / 2, 0.3); B.bone.add(put(box(Math.abs(nx) ? 0.5 : L - 0.6, 1.0, Math.abs(nz) ? 0.5 : L - 0.6), mx, 0.5, mz), 0x8a7a62); }
    const step = low ? 0.95 : 0.55;
    for (let t = 0.5; t < L - 0.5; t += step) {
      const [bx, bz] = at(t, 0.6);
      for (let j = 0; j < 1; j++) femur(bx, 0.3 + j * 0.4 + (rd() - 0.5) * 0.06, bz, 0.8, ry + Math.PI / 2 + (rd() - 0.5) * 0.2);
      if (rd() < (low ? 0.08 : 0.16)) skull(bx, 1.2, bz, 0.42, ry + (rd() - 0.5) * 0.4);
    }
    // raíces que trepan
    for (let i = 0; i < (low ? 1 : 2); i++) { const [rx, rz] = at(2 + rd() * (L - 4)); roots.push(climbCurve(rx, rz, nx, nz, 5 + rd() * 8, rd)); }
  }

  // ── coberturas de la simulación
  for (const c of map.covers) {
    if (c.kind === 'piramide') {
      // pirámide de calaveras (ARCANUM ruta-paisaje.js: anillos que se achican) sobre un cono de huesos
      B.bone.add(put(new THREE.ConeGeometry(c.r, c.h - 0.2, 14, 1, true), c.x, (c.h - 0.2) / 2, c.z), 0x9a8a70);
      const rings = low ? 5 : 8;
      for (let a = 0; a < rings; a++) { const R = c.r * (1 - a / (rings + 0.6)) + 0.1, n = Math.max(4, Math.round(R * 2 * Math.PI / (low ? 0.95 : 0.62))), y = 0.3 + a * (c.h - 0.6) / rings;
        for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2 + a * 0.4; skull(c.x + Math.cos(t) * R, y, c.z + Math.sin(t) * R, 0.55, Math.atan2(Math.cos(t), Math.sin(t)), -0.15); } }
      skull(c.x, c.h + 0.1, c.z, 0.8, Math.atan2(-c.x, -c.z));
      B.iron.add(put(cyl(0.05, 0.05, 2.2, 5), c.x, c.h + 1.4, c.z), 0x2a2420); B.iron.add(put(box(1, 0.08, 0.08), c.x, c.h + 2.1, c.z), 0x2a2420);
      candles.push([c.x + c.r * 0.9, 0.05, c.z], [c.x - c.r * 0.9, 0.05, c.z]);
    } else if (c.kind === 'pilar') {
      B.trim.add(put(cyl(c.r, c.r * 1.08, c.h, 12), c.x, c.h / 2, c.z), 0xece4d8);
      B.trim.add(put(box(c.r * 2.6, 0.5, c.r * 2.6), c.x, 0.25, c.z), 0xd4c8b8); B.trim.add(put(box(c.r * 2.5, 0.6, c.r * 2.5), c.x, c.h - 0.3, c.z), 0xe8dfd0);
      if (!low) for (let k = 0; k < 6; k++) skull(c.x + Math.cos(k) * (c.r + 0.15), 3.2, c.z + Math.sin(k) * (c.r + 0.15), 0.38, Math.atan2(Math.cos(k), Math.sin(k)));
      roots.push(climbCurve(c.x + c.r, c.z, 1, 0, c.h - 1, rd, { out: 0.05, wander: 0.3 }));
    } else if (c.kind === 'banco') {
      B.cloth.add(put(box(c.hx * 2, 0.12, c.hz * 2), c.x, c.h - 0.06, c.z), 0x5a3a2a); B.cloth.add(put(box(c.hx * 2, c.h - 0.12, 0.1), c.x, (c.h - 0.12) / 2, c.z + c.hz - 0.05, -0.1), 0x4a2e22);
    } else if (c.kind === 'sarcofago') {
      B.trim.add(put(box(c.hx * 2, c.h - 0.2, c.hz * 2), c.x, (c.h - 0.2) / 2, c.z), 0xd8cebe); B.trim.add(put(box(c.hx * 2 + 0.2, 0.25, c.hz * 2 + 0.2), c.x, c.h - 0.12, c.z, 0, 0.06, 0.03), 0xece2d2);
      skull(c.x, c.h + 0.2, c.z - c.hz * 0.6, 0.5, 0); candles.push([c.x, c.h, c.z + c.hz * 0.5]);
    } else if (c.kind === 'altar') {
      B.trim.add(put(box(c.hx * 2, c.h, c.hz * 2), c.x, c.h / 2, c.z), 0xf2eade); B.cloth.add(put(box(c.hx * 2 + 0.1, 0.05, c.hz * 2 - 0.4), c.x, c.h + 0.02, c.z), 0x6a1a3a);
      B.trim.add(put(box(c.hx * 2 + 1, 0.3, c.hz * 2 + 1), c.x, 0.15, c.z), 0xd8cebe);
      for (let k = -2; k <= 2; k++) { skull(c.x + k * 1.1, c.h + 0.25, c.z, 0.5, 0); candles.push([c.x + k * 1.1 + 0.5, c.h, c.z + 0.6]); }
    } else if (c.kind === 'osario') {
      B.cloth.add(put(box(c.hx * 2, c.h, c.hz * 2), c.x, c.h / 2, c.z), 0x4a3424);
      for (let k = 0; k < 6; k++) skull(c.x + (rd() - 0.5) * c.hx * 1.6, c.h + 0.2, c.z + (rd() - 0.5) * c.hz * 1.4, 0.45, rd() * 6);
      for (let k = 0; k < 5; k++) femur(c.x + (rd() - 0.5) * c.hx, c.h + 0.1, c.z + (rd() - 0.5) * c.hz, 0.9, rd() * 6);
    } else if (c.kind === 'columna') {
      // columna de calaveras (anillos apilados)
      for (let y = 0.3; y < c.h; y += low ? 0.75 : 0.42) { const n = low ? 7 : 10; for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2 + y; skull(c.x + Math.cos(t) * c.r * 0.82, y, c.z + Math.sin(t) * c.r * 0.82, 0.42, Math.atan2(Math.cos(t), Math.sin(t))); } }
      B.bone.add(put(cyl(c.r * 0.8, c.r * 0.85, c.h, 10), c.x, c.h / 2, c.z), 0x6a5a48);
      candles.push([c.x, c.h + 0.1, c.z]);
    }
  }
  // velas sueltas por el piso (algunas caídas) a lo largo de los caminos
  for (let i = 0; i < (low ? 14 : 26); i++) { const ax = rd() < 0.5, t = rd(); const x = ax ? (rd() < 0.5 ? -2.6 : 2.6) : X.x0 + 3 + t * (X.x1 - X.x0 - 6), z = ax ? N.z0 + 3 + t * (N.z1 - N.z0 - 6) : (rd() < 0.5 ? -2.6 : 2.6); if (map.walkable(x, z, 0.6)) candles.push([x, 0, z]); }

  // velas: cera + llama de color
  const flames = [];
  candles.forEach(([x, y, z], i) => { const hh = 0.18 + rd() * 0.3; B.bone.add(put(cyl(0.06, 0.07, hh, 6), x, y + hh / 2, z), 0xf4ecd8); const col = ACC[i % ACC.length]; B.glow.add(put(new THREE.ConeGeometry(0.05, 0.16, 5), x, y + hh + 0.08, z), new THREE.Color(col).multiplyScalar(1.8)); flames.push({ p: new THREE.Vector3(x, y + hh + 0.1, z), col }); });

  const shadows = !!q.shadows;
  for (const k of Object.keys(B)) { const m = B[k].build(MAT[k], { shadows: shadows && k !== 'glow' && k !== 'floor', name: 'm6-' + k }); if (m) { if (k === 'floor' && shadows) m.receiveShadow = true; root.add(m); } }

  // calaveras y huesos instanciados (+ el brillo de las cuencas, de colores)
  const sk = new THREE.InstancedMesh(skullGeo(), MAT.bone, skulls.length); skulls.forEach((m, i) => sk.setMatrixAt(i, m)); sk.instanceMatrix.needsUpdate = true; sk.name = 'm6-calaveras'; root.add(sk);
  const eyes = new THREE.InstancedMesh(eyePlate(), new THREE.MeshBasicMaterial({ color: 0xffffff, map: eyeTex(), alphaTest: 0.5, toneMapped: false }), skulls.length);
  skulls.forEach((m, i) => { eyes.setMatrixAt(i, m); eyes.setColorAt(i, rd() < 0.5 ? new THREE.Color(ACC[Math.floor(rd() * ACC.length)]).multiplyScalar(1.8) : new THREE.Color(0x060404)); }); eyes.instanceMatrix.needsUpdate = true; eyes.instanceColor.needsUpdate = true; root.add(eyes);
  const boneMat = deadMaterial('ph:marble_01', { vcol: false, sat: 0.7, tint: 0xf4e8d2, dustK: 0.2, crack: 0 });
  const fm = new THREE.InstancedMesh(femurGeo(), boneMat, femurs.length); femurs.forEach((m, i) => fm.setMatrixAt(i, m)); fm.instanceMatrix.needsUpdate = true; fm.name = 'm6-huesos'; root.add(fm);
  for (const im of [sk, eyes, fm]) im.frustumCulled = false; // sin sombra propia: son muchas y chicas (ahorra la pasada de sombras)

  // ── la araña de huesos: flota sobre el crucero y gira despacio; guirnaldas de calaveras entre los pilares
  const ch = new THREE.Group(); ch.position.set(0, 14, 0); root.add(ch);
  const cb = new Batch(1), cg = new Batch(1);
  for (const [y, R] of [[0, 3.2], [1.4, 2.4], [2.6, 1.5]]) { cb.add(put(new THREE.TorusGeometry(R, 0.14, 6, 28), 0, y, 0, Math.PI / 2), 0xf0e4cc); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; cb.add(put(cyl(0.06, 0.06, 1.4, 5), Math.cos(a) * R, y + 0.6, Math.sin(a) * R, 0.3 * Math.cos(a), 0, -0.3 * Math.sin(a)), 0xe8dcc0); cg.add(put(new THREE.ConeGeometry(0.08, 0.25, 5), Math.cos(a) * R, y + 1.45, Math.sin(a) * R), new THREE.Color(ACC[(k + y * 3) % ACC.length | 0]).multiplyScalar(2)); } }
  cb.add(put(cyl(0.08, 0.08, 9, 5), 0, 7, 0), 0x3a3028);
  ch.add(cb.build(MAT.bone)); ch.add(cg.build(MAT.glow));
  r.dyn.push((dt, t) => { ch.rotation.y = t * 0.08; ch.position.y = 14 + Math.sin(t * 0.4) * 0.6; });
  // guirnaldas (de pilar a pilar a lo largo de las naves, y cruzando el crucero)
  const gl = [];
  const garland = (ax, az, bx, bz, y0, sag) => { const n = low ? 9 : 14; for (let k = 0; k <= n; k++) { const u = k / n; gl.push([ax + (bx - ax) * u, y0 - Math.sin(u * Math.PI) * sag, az + (bz - az) * u, Math.atan2(bz - az, bx - ax)]); } };
  for (const z of [20, 31, -21, -32]) garland(-8, z, 8, z, 11, 2.2);
  garland(-14, -12, 14, 12, 12.5, 3.5); garland(14, -12, -14, 12, 12.5, 3.5);
  const gm = new THREE.InstancedMesh(skullGeo(), MAT.bone, gl.length); gl.forEach(([x, y, z, a], i) => { E.set(0, -a + Math.PI / 2, 0); gm.setMatrixAt(i, M4.compose(V.set(x, y, z), Q.setFromEuler(E), S3.setScalar(0.42))); }); gm.instanceMatrix.needsUpdate = true; gm.frustumCulled = false; root.add(gm);
  r.dyn.push((dt, t) => { gm.position.y = Math.sin(t * 0.5) * 0.25; });

  // ── la bóveda que cayó HACIA ARRIBA: nervaduras y sillares flotando sobre la cruz
  const ribs = [];
  for (const z of [34, 26, 16, -16, -26, -38]) ribs.push({ p: new THREE.Vector3(0, 19 + rd() * 6, z), s: 1, rot: new THREE.Euler(0, 0, (rd() - 0.5) * 0.25), amp: 0.6, spd: 0.25 + rd() * 0.2, ph: rd() * 6, spin: new THREE.Vector3(0, 0, (rd() - 0.5) * 0.02) });
  for (const x of [-30, -22, 22, 30]) ribs.push({ p: new THREE.Vector3(x, 18 + rd() * 6, 0), s: 1, rot: new THREE.Euler(0, Math.PI / 2, (rd() - 0.5) * 0.25), amp: 0.6, spd: 0.3, ph: rd() * 6, spin: new THREE.Vector3(0, 0, 0.01) });
  floaters(r, root, archGeo(12, 0.9, 1.1, 14), deadMaterial('ashlar', { vcol: false, sat: 0.5, tint: 0xf0e8dc, crack: 1, crackCol: 0xf2c66d, dustK: 0.4 }), ribs, { name: 'm6-nervaduras' });
  const blocks = [];
  for (let i = 0; i < (low ? 30 : 60); i++) { const onX = rd() < 0.5; blocks.push(floatItem(rd, new THREE.Vector3(onX ? (rd() - 0.5) * 76 : (rd() - 0.5) * 26, 16 + rd() * 16, onX ? (rd() - 0.5) * 20 : -44 + rd() * 82), 0.8 + rd() * 0.9, { amp: 0.6, spd: 0.25, spin: 0.2, sv: new THREE.Vector3(1.4, 0.7, 0.9) })); }
  floaters(r, root, new THREE.BoxGeometry(1, 1, 1), deadMaterial('vault', { vcol: false, sat: 0.6, tint: 0xe2d8cc, crack: 1, crackCol: 0xb07bff, dustK: 0.4 }), blocks, { name: 'm6-sillares' });
  // huesos que flotan en el crucero (gravedad rota)
  const fb = []; const OJ = M6.OJO;
  for (let i = 0; i < (low ? 36 : 70); i++) { const a = rd() * 6.283, rr = 1 + Math.sqrt(rd()) * (OJ.r - 1); fb.push(floatItem(rd, new THREE.Vector3(OJ.x + Math.cos(a) * rr, 1 + rd() * rd() * 10, OJ.z + Math.sin(a) * rr), 0.55 + rd() * 0.35, { amp: 0.4, spd: 0.4, spin: 0.8 })); }
  floaters(r, root, femurGeo(), boneMat, fb, { name: 'm6-huesos-flotan' });
  leveZone(r, root, M6.OJO, { color: 0xf2c66d, count: low ? 120 : 180 });

  // ── la grieta del altar (el más allá) y las grietas del piso que salen de ella
  const rift = new THREE.Mesh(new THREE.PlaneGeometry(7, 13), riftMat()); rift.position.set(A.x, 6.6, N.z0 + 0.08); root.add(rift);
  crackStrips(root, [
    { x: A.x, z: A.z + 1.6, n: low ? 7 : 10, len: 16, a0: Math.PI * 0.05, spread: Math.PI * 0.9 },
    { x: 0, z: 0, n: 8, len: 12 }, { x: -30, z: 0, n: 3, len: 8 }, { x: 30, z: 0, n: 3, len: 8 }, { x: 0, z: 30, n: 3, len: 7 },
  ], { color: 0xff7ae0, seed: 61, avoid: (x, z) => map.walkable(x, z, 0.3) });
  risingStream(root, [{ x: OJ.x, y: 0.2, z: OJ.z, r: 2.2, h: 13 }]);
  rootsMesh(root, roots, { color: 0x46ffd0, bark: 0x6a5844, sun: sunDir });

  // ── cielo alucinado (oro y violeta), luz por el techo roto, charcos de luz, niebla baja, polvo
  limboSky(r, root, { sun: sunDir, skyline: 0, hue: 0.1, glyph: 1.1, zen: 0x0a0418, hor: 0x5a2a5a, glow: 0xf2c66d });
  lightShafts(root, [
    { x: 0, z: 0, top: 60, r0: 6, r1: 4, k: 1.2, col: 0xffd890 }, { x: 0, z: 26, top: 55, r0: 3, r1: 2, k: 1, col: 0xc8a0ff },
    { x: 0, z: -30, top: 55, r0: 3.4, r1: 2.2, k: 1.1, col: 0xff9be0 }, ...(low ? [] : [{ x: -28, z: 0, top: 50, r0: 3, r1: 2, k: 0.9, col: 0x7ff0d8 }, { x: 28, z: 0, top: 50, r0: 3, r1: 2, k: 0.9, col: 0x9fe8ff }]),
  ], { tilt: new THREE.Vector3(-0.12, 1, -0.2) });
  const pools = [{ x: 0, z: -42, r: 8, col: 0xd070ff, k: 1.1 }, { x: 0, z: 0, r: 8, col: 0xf2c66d, k: 0.6 }];
  for (const f of flames) pools.push({ x: f.p.x, z: f.p.z, r: 1.8, col: f.col, k: 0.6 });
  lightPools(root, pools);
  const hl = flames.map((f) => ({ p: f.p, s: 0.9, col: f.col, o: 0.9 }));
  hl.push({ p: new THREE.Vector3(A.x, 5, N.z0 + 1), s: 14, col: 0xd890ff, o: 0.55 });
  haloField(root, hl, { tex: r.shared('env.soft', softTex) });
  const mist = [];
  for (let i = 0; i < (low ? 12 : 20); i++) { const onX = rd() < 0.4, x = onX ? X.x0 + 4 + rd() * (X.x1 - X.x0 - 8) : (rd() - 0.5) * 22, z = onX ? (rd() - 0.5) * 18 : N.z0 + 4 + rd() * (N.z1 - N.z0 - 8); mist.push({ p: new THREE.Vector3(x, 0.8 + rd(), z), s: 7 + rd() * 6, col: [0x6a3a9a, 0x8a5a3a, 0x3a7a8a][i % 3] }); }
  mistLayer(r, mist, { alpha: 0.2, near: 5, far: 110 });
  const ash = new THREE.Points(particleGeo(low ? 120 : 260, (i, rr) => [(rr() - 0.5) * 26, rr() * 4, -44 + rr() * 82], 7), particleMat({ color: 0xffd8a0, size: 0.07, mode: 0, speed: 0.02, height: 20, amp: 0.8, alpha: 0.7 }));
  ash.frustumCulled = false; root.add(ash);
  addMotes(r, root, low ? 60 : 160, 26);
  if (q.lights >= 3) { const pl = new THREE.PointLight(0xd890ff, 80, 34, 1.5); pl.position.set(A.x, 4, A.z + 3); root.add(pl); const pc = new THREE.PointLight(0xffd890, 50, 30, 1.5); pc.position.set(0, 9, 0); root.add(pc); }
}
