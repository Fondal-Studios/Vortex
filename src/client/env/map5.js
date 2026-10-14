// Entorno del Mapa 5 · PLAZA DE LOS ECOS — la Praga vieja de ARCANUM, MUERTA en el limbo.
// Origen: /duelo-arcano/src/world/praga.js, praga-build.js, praga-mat.js y praga-atmo.js (calle empedrada que desemboca en la
// plaza; fachadas barrocas con zócalo de sillar, impostas, cornisas con perfil, frontones de volutas o escalonados, tejados,
// chimeneas, faroles de hierro; las torres de Týn al fondo; la torre del Ayuntamiento con el RELOJ ASTRONÓMICO y el portal
// gótico bajo el reloj; la fuente barroca). Los perfiles (cornisa, imposta, frontón, tejado) están copiados de praga-build.js
// en limbo-kit.js. Acá todo está MUERTO:
//   · los pasteles se lavaron a hueso, ceniza y azul noche (deadMaterial: desaturado + polvo pálido + grietas de luz);
//   · los faroles no dan luz cálida: arde una llama fría, celeste; las ventanas están negras salvo alguna de «los que añoran»;
//   · el reloj se detuvo en una hora imposible; bajo él, el portal deja ver el más allá (lo único con color fuerte);
//   · la fuente cae hacia ARRIBA (zona de gravedad rota: adoquines, tejas y gotas suspendidas);
//   · raíces/venas luminosas trepan las fachadas desde las grietas del empedrado; niebla baja, polvo, rayos de luz;
//   · el cielo: noche ceniza, sol muerto, skyline de una ciudad muerta y geometría sagrada lenta en el cenit.
// Todo lo jugable coincide con src/sim/map5.js (muros, coberturas, zona 'leve').
import * as THREE from 'three';
import { cfg } from '../quality.js';
import { uTime, finish } from '../shaders.js';
import { addMotes } from './common.js';
import { trackPx, softTex, mistLayer, dc, particleGeo, particleMat } from './props.js';
import { rng } from './noise.js';
import { M5 } from '../../sim/map5.js';
import {
  deadMaterial, glassMaterial, glowMaterial, Batch, put, box, cyl, profileBar, CORNICE, STRING, gableGeo, roofGeo, archGeo,
  limboSky, crackStrips, rootsMesh, climbCurve, floaters, floatItem, leveZone, haloField, lightShafts, lightPools, risingStream,
} from './limbo-kit.js';

export const M5V = { sun: new THREE.Vector3(-0.42, 0.34, -0.84).normalize(), glow: 0x9fe8ff, flame: 0xbfeaff };
// estucos pastel de ARCANUM (praga-build.js PASTEL): muertos (polvo, grietas) pero alucinados por la luz del más allá
const STUCCO = [0xf4a6b8, 0x9fdcc0, 0xf6d77e, 0x9fc4f0, 0xc7ade9, 0xf7b98a, 0xf3e3bd, 0xa8e0ea, 0xf2b0d6, 0xd6ea9c];
// acentos de luz (docs/CONCEPTO_ARTE.md): violeta del Vórtice, celeste espiritual, oro, magenta, turquesa
export const ACC = [0xb07bff, 0x9fe8ff, 0xf2c66d, 0xff4fd8, 0x46ffd0];
const accC = (rd, k = 1) => new THREE.Color(ACC[Math.floor(rd() * ACC.length)]).multiplyScalar(k);

/** Una fila de casas sobre la cara de un muro: a,b = extremos (x,z), n = normal hacia la plaza. */
function facadeRun(B, a, b, n, rd, { low, hMin = 17.5, hMax = 21.5, ground = 'mix', skip = null }) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(ux, 0, uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], 0, n[1]));
  const lit = [];
  let s = 0;
  while (s < L - 1) {
    let w = Math.min(L - s, 6 + rd() * 3); if (L - s - w < 4) w = L - s;
    const cx = s + w / 2, mid = [a[0] + ux * cx, a[1] + uz * cx];
    s += w;
    if (skip && skip(mid[0], mid[1])) continue;
    const h = hMin + rd() * (hMax - hMin), col = STUCCO[Math.floor(rd() * STUCCO.length)];
    const place = (g) => { g.applyMatrix4(basis); g.translate(mid[0], 0, mid[1]); return g; };
    // cuerpo (cubre el muro de colisión de 4 m) y zócalo de sillar
    B.stucco.add(place(put(box(w - 0.06, h, 4), 0, h / 2, -2)), col);
    B.stone.add(place(put(box(w, 3.6, 0.32), 0, 1.8, 0.16)), 0xd2cdc4);
    // impostas y cornisa (perfiles de ARCANUM)
    const nf = Math.max(3, Math.floor((h - 5) / 3.4));
    for (let k = 1; k < nf; k += low ? 2 : 1) B.stone.add(place(put(profileBar(STRING, w, 1), 0, 4 + 3.4 * k - 0.1, 0)), 0xc9c4ba);
    B.stone.add(place(put(profileBar(CORNICE, w + 0.2, 2), 0, h - 0.6, 0, 0, 0, 0, 1, 1.3, 1.3)), 0xd0cbc1);
    B.stone.add(place(put(profileBar(STRING, w, 1), 0, 3.6, 0)), 0xbab5ab);
    // ventanas: marco de piedra + vidrio (algunas con la luz fría de los que añoran) + alféizar; postigos caídos
    const nw = Math.max(1, Math.floor((w - 1) / 2.35));
    for (let k = 0; k < nf; k++) {
      const y = 5.4 + 3.4 * k; if (y + 1.2 > h - 0.8) break;
      for (let i = 0; i < nw; i++) {
        const x = (i - (nw - 1) / 2) * 2.3, glow = rd() < 0.3 ? 0.9 + rd() * 1.2 : 0;
        B.stone.add(place(put(box(1.34, 2.04, 0.16), x, y, 0.08)), 0xd8d3ca);
        const wc = glow ? accC(rd, glow) : null;
        B.glass.add(place(put(new THREE.PlaneGeometry(1.02, 1.74), x, y, 0.165)), wc || 0x000000, null);
        B.stone.add(place(put(box(1.56, 0.12, 0.34), x, y - 1.08, 0.17)), 0xcfcac0);
        if (glow) { const pp = place(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([x, y, 0.5], 3))).attributes.position.array; lit.push([pp[0], pp[1], pp[2], wc.getHex()]); }
        if (!low && rd() < 0.3) { const side = rd() < 0.5 ? -1 : 1, tilt = (rd() - 0.5) * 0.5; B.wood.add(place(put(box(0.52, 1.74, 0.06), x + side * 0.85, y - (Math.abs(tilt) * 0.4), 0.22, 0, side * 0.5, tilt)), 0x3a3a3c); }
      }
    }
    // planta baja: portal arqueado oscuro o vidriera de tienda muerta
    if (ground !== 'none') {
      if (rd() < 0.5 || w < 6.6) {
        B.glass.add(place(put(new THREE.PlaneGeometry(1.7, 2.7), 0, 1.35, 0.33)), rd() < 0.12 ? new THREE.Color(0.1, 0.25, 0.32) : 0x000000, null);
        B.stone.add(place(put(archGeo(0.85, 0.28, 0.4, 8), 0, 2.7, 0.34)), 0xcac4b8);
        B.stone.add(place(put(box(0.28, 2.7, 0.4), -0.99, 1.35, 0.34)), 0xcac4b8); B.stone.add(place(put(box(0.28, 2.7, 0.4), 0.99, 1.35, 0.34)), 0xcac4b8);
      } else {
        const sw = Math.min(w - 2.2, 4.2);
        B.glass.add(place(put(new THREE.PlaneGeometry(sw, 2.2), 0, 1.6, 0.33)), rd() < 0.2 ? new THREE.Color(0.12, 0.2, 0.26) : 0x000000, null);
        B.wood.add(place(put(box(sw + 0.3, 0.16, 0.42), 0, 2.78, 0.34)), 0x2c2d30); B.wood.add(place(put(box(sw + 0.3, 0.4, 0.42), 0, 0.4, 0.34)), 0x2c2d30);
        if (!low) B.cloth.add(place(put(box(sw + 0.4, 0.05, 1.3), 0, 3.05, 0.95, -0.35, 0, (rd() - 0.5) * 0.08)), 0xa8a294); // toldo raído
      }
    }
    // remate: frontón de volutas / escalonado (ARCANUM) o tejado con chimenea
    if (rd() < 0.55) {
      const gw = w * (0.62 + rd() * 0.2), gh = 3 + rd() * 2.5;
      B.stucco.add(place(put(gableGeo(gw, gh, rd() < 0.4, 0.5), 0, h - 0.15, -0.25)), col);
      B.roof.add(place(put(roofGeo(w - 0.4, 3.2, 3.6), 0, h - 0.1, -2.1)), 0x3c3f45);
      if (!low) { const gy = h + gh * 0.45; B.glass.add(place(put(new THREE.CircleGeometry(0.45, 10), 0, gy, 0.27)), rd() < 0.25 ? new THREE.Color(0.2, 0.45, 0.6) : 0x000000, null); }
    } else {
      B.roof.add(place(put(roofGeo(w + 0.1, 4 + rd() * 2, 4.4), 0, h - 0.05, -1.9)), rd() < 0.5 ? 0x3a3d43 : 0x45474c);
      if (rd() < 0.6) B.stone.add(place(put(box(0.8, 2.6, 0.8), (rd() - 0.5) * w * 0.6, h + 2.6, -2.6)), 0x8d8a85);
    }
  }
  return lit;
}

/** Textura del reloj astronómico detenido (ARCANUM praga-tex.js dialTextures, versión muerta: azul ceniza y oro apagado). */
function clockTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), C = 256;
  g.fillStyle = '#1c222c'; g.fillRect(0, 0, 512, 512);
  const grd = g.createRadialGradient(C, C, 40, C, C, 250); grd.addColorStop(0, '#3a4456'); grd.addColorStop(0.62, '#28303e'); grd.addColorStop(1, '#141820');
  g.fillStyle = grd; g.beginPath(); g.arc(C, C, 250, 0, 7); g.fill();
  g.strokeStyle = '#b8a77a'; g.lineWidth = 9; g.beginPath(); g.arc(C, C, 243, 0, 7); g.stroke();
  g.lineWidth = 3; for (const r of [205, 160, 92]) { g.beginPath(); g.arc(C, C, r, 0, 7); g.stroke(); }
  g.fillStyle = '#cfc6a8'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const RN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV'];
  RN.forEach((t, i) => { const a = (i / 24) * Math.PI * 2 - Math.PI / 2; g.save(); g.translate(C + Math.cos(a) * 224, C + Math.sin(a) * 224); g.rotate(a + Math.PI / 2); g.font = 'bold 17px Georgia, serif'; g.fillText(t, 0, 0); g.restore(); });
  const Z = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  g.font = '26px serif'; Z.forEach((t, i) => { const a = (i / 12) * Math.PI * 2; g.fillText(t, C + 40 + Math.cos(a) * 128, C - 30 + Math.sin(a) * 128); });
  g.strokeStyle = '#8a7f62'; g.lineWidth = 2; g.beginPath(); g.arc(C + 40, C - 30, 150, 0, 7); g.stroke();
  // grietas en la esfera
  g.strokeStyle = 'rgba(160,232,255,0.55)'; g.lineWidth = 1.6; let x = C - 60, y = C + 40; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 18; i++) { x += (Math.random() - 0.4) * 22; y += (Math.random() - 0.6) * 18; g.lineTo(x, y); } g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Portal del más allá bajo el reloj (lo único con color fuerte: psicodelia contenida en un arco). */
function portalMat() {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
      void main(){ vec2 p = (vUv - vec2(0.5, 0.42)) * vec2(1.0, 1.45); float r = length(p), a = atan(p.y, p.x);
        float sw = sin(a * 5.0 + r * 18.0 - uTime * 0.9) * 0.5 + 0.5, tun = fract(log(r + 0.02) * 1.6 - uTime * 0.12);
        vec3 c = mix(vec3(0.62, 0.9, 1.0), pal(tun * 0.6 + uTime * 0.02) * 0.9, 0.35) * (0.25 + 0.75 * pow(sw, 3.0)) * (1.0 - smoothstep(0.0, 0.62, r));
        c += vec3(0.85, 0.95, 1.0) * (1.0 - smoothstep(0.0, 0.08, r)) * 1.4;
        gl_FragColor = vec4(c * 0.9, 1.0); }`,
  }));
}

export function build(r, map) {
  const root = r.mapRoot, q = cfg(), low = !q.decor, rd = rng(5150), sunDir = M5V.sun.clone();
  // luz: luna fría desde el sol muerto + cielo ceniza (render.js ya puso el HDRI 'moonless_golf')
  r.hemi.color.setHex(0xa48cff); r.hemi.groundColor.setHex(0x1a2a3a); r.hemi.intensity = 1.35;
  r.sun.color.setHex(0xd8e6ff); r.sun.intensity = 2.1; r.sun.position.copy(sunDir); r.sunDir = sunDir.clone();
  r.rim.color.setHex(0xff5cc8); r.rim.intensity = 0.9;
  r.scene.environmentIntensity = 0.35;
  trackPx(r);

  const MAT = {
    floor: deadMaterial('cobble', { sat: 0.22, tint: 0xd8dde6, dustK: 0.0, grime: 0.0, crack: 0.75, crackY: [-1, 0.5], rough: 0.95, envI: 0.8 }),
    stucco: deadMaterial('stucco', { sat: 0.7, tint: 0xf2f0ec, dustK: 0.45, grime: 0.5, crack: 0.55, crackY: [0.5, 26] }),
    stone: deadMaterial('ashlar', { sat: 0.25, tint: 0xe6e3dc, dustK: 0.5, grime: 0.4, crack: 0.35, crackY: [0.2, 40] }),
    roof: deadMaterial('ashlar', { sat: 0.1, tint: 0x7a7e86, dustK: 0.25, grime: 0.0, crack: 0.0 }),
    wood: deadMaterial('ph:rough_linen', { sat: 0.15, tint: 0x8a8580, dustK: 0.3, crack: 0, rough: 0.9 }),
    cloth: deadMaterial('ph:rough_linen', { sat: 0.2, tint: 0xd8d2c4, dustK: 0.2, crack: 0, rough: 1 }),
    iron: deadMaterial(null, { color: 0x2a2c30, sat: 0.2, rough: 0.55, metal: 0.8, dustK: 0.25, crack: 0, envI: 0.9 }),
    glass: glassMaterial(), glow: glowMaterial(),
  };
  const B = { floor: new Batch(0.33), stucco: new Batch(0.25), stone: new Batch(0.3), roof: new Batch(0.5), wood: new Batch(0.5), cloth: new Batch(0.6), iron: new Batch(0.5), glass: new Batch(1), glow: new Batch(1) };
  const P = M5.PLAZA, C = M5.CALLE, TW = M5.TORRE, AR = M5.ARCADA, F = M5.FUENTE;

  // ── piso: empedrado (plaza + calle) y cordón de losas al pie de las fachadas
  B.floor.add(put(new THREE.PlaneGeometry(P.x1 - P.x0 + 1, P.z1 - P.z0 + 1).rotateX(-Math.PI / 2), (P.x0 + P.x1) / 2, 0, (P.z0 + P.z1) / 2), 0xffffff);
  B.floor.add(put(new THREE.PlaneGeometry(C.x1 - C.x0 + 1, C.z1 - C.z0).rotateX(-Math.PI / 2), 0, 0, (C.z0 + C.z1) / 2), 0xffffff);
  const curb = (x0, x1, z0, z1) => B.stone.add(put(box(x1 - x0, 0.06, z1 - z0), (x0 + x1) / 2, 0.03, (z0 + z1) / 2), 0x9a9890);
  curb(P.x0, P.x1, P.z0, P.z0 + 1.6); curb(P.x0, P.x0 + 1.6, P.z0, P.z1); curb(P.x1 - 1.6, P.x1, P.z0, P.z1); curb(P.x0, C.x0, P.z1 - 1.6, P.z1); curb(C.x1, P.x1, P.z1 - 1.6, P.z1);
  curb(C.x0, C.x0 + 1.2, P.z1, C.z1); curb(C.x1 - 1.2, C.x1, P.z1, C.z1);

  // ── fachadas sobre los muros de borde (las casas de ARCANUM, muertas)
  const lit = [];
  const run = (a, b, n, o = {}) => lit.push(...facadeRun(B, a, b, n, rd, { low, ...o }));
  run([P.x1 + 0, P.z0], [P.x0, P.z0], [0, 1]);                                   // norte
  run([P.x0, P.z0], [P.x0, P.z1], [1, 0]);                                       // oeste (detrás de los soportales)
  run([P.x1, P.z1], [P.x1, P.z0], [-1, 0], { skip: (x, z) => z > TW.z0 - 1 && z < TW.z1 + 1 }); // este (sin la torre)
  run([C.x0, P.z1], [P.x0, P.z1], [0, -1]); run([P.x1, P.z1], [C.x1, P.z1], [0, -1]); // sur
  run([C.x0, P.z1], [C.x0, C.z1], [1, 0], { hMin: 15.5, hMax: 19 }); run([C.x1, C.z1], [C.x1, P.z1], [-1, 0], { hMin: 15.5, hMax: 19 }); // la calle
  // fondo de la calle: arco tapiado (el camino de vuelta ya no existe) — una membrana de luz quieta
  B.stucco.add(put(box(C.x1 - C.x0 + 8, 19, 4), 0, 9.5, C.z1 + 2), 0xc8c4bc);
  B.stone.add(put(archGeo(2.6, 0.6, 0.6, 12), 0, 3.4, C.z1 - 0.1), 0xcfc9bd);
  B.stone.add(put(box(0.6, 3.4, 0.6), -2.9, 1.7, C.z1 - 0.1), 0xcfc9bd); B.stone.add(put(box(0.6, 3.4, 0.6), 2.9, 1.7, C.z1 - 0.1), 0xcfc9bd);
  B.stone.add(put(box(5.2, 6, 0.3), 0, 3, C.z1 + 0.15), 0x8f8c86); // tapiado

  // ── soportales (oeste): pilares, arcos, alero
  for (const c of map.covers.filter((c) => c.kind === 'pilar')) {
    B.stone.add(put(cyl(0.7, 0.78, AR.h - 1.2, 12), c.x, (AR.h - 1.2) / 2 + 0.4, c.z), 0xd2cdc3);
    B.stone.add(put(box(1.9, 0.5, 1.9), c.x, 0.25, c.z), 0xb7b2a8); B.stone.add(put(box(1.8, 0.45, 1.8), c.x, AR.h - 0.75, c.z), 0xc8c3b9);
  }
  const pil = map.covers.filter((c) => c.kind === 'pilar').map((c) => c.z).sort((a, b) => a - b);
  for (let i = 0; i < pil.length - 1; i++) { const z = (pil[i] + pil[i + 1]) / 2, span = (pil[i + 1] - pil[i]) / 2 - 0.75; B.stone.add(put(archGeo(span - 0.35, 0.35, 0.8, 10), AR.x, AR.h - 0.5 - span + 0.35, z, 0, Math.PI / 2, 0), 0xd0cbc0); }
  B.stone.add(put(box(1.0, 1.5, AR.z1 - AR.z0 + 4), AR.roofX1 - 0.3, AR.h + 0.6, (AR.z0 + AR.z1) / 2), 0xcdc8be);
  B.stucco.add(put(box(AR.roofX1 - AR.roofX0, 1.2, AR.z1 - AR.z0 + 4), (AR.roofX0 + AR.roofX1) / 2, AR.h + 0.6, (AR.z0 + AR.z1) / 2), 0xb8b4ac);
  B.roof.add(put(box(AR.roofX1 - AR.roofX0 + 0.6, 0.3, AR.z1 - AR.z0 + 4.6), (AR.roofX0 + AR.roofX1) / 2, AR.h + 1.35, (AR.z0 + AR.z1) / 2, 0, 0, -0.12), 0x3e4146);

  // ── torre del Ayuntamiento y el reloj astronómico (detenido)
  const tx = (TW.x0 + TW.x1) / 2, tz = (TW.z0 + TW.z1) / 2, tw = TW.x1 - TW.x0, td = TW.z1 - TW.z0;
  B.stone.add(put(box(tw, TW.h, td), tx, TW.h / 2, tz), 0xc2bdb3);
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) B.stone.add(put(box(1.1, TW.h + 1.5, 1.1), tx + sx * tw / 2, (TW.h + 1.5) / 2, tz + sz * td / 2), 0xb3aea4); // aristas
  B.stone.add(put(box(tw + 1.4, 1.2, td + 1.4), tx, TW.h - 3, tz), 0xcfcac0); // galería
  B.stone.add(put(profileBar(CORNICE, td + 1.6, 2), TW.x0 - 0.7, TW.h - 3.6, tz, 0, Math.PI / 2, 0, 1, 1.4, 1.4), 0xd3cec4);
  B.roof.add(put(new THREE.ConeGeometry(Math.max(tw, td) * 0.62, 13, 4).rotateY(Math.PI / 4), tx, TW.h + 6.5, tz), 0x2f3237);
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) B.roof.add(put(new THREE.ConeGeometry(0.7, 5, 6), tx + sx * (tw / 2 + 0.2), TW.h + 2.2, tz + sz * (td / 2 + 0.2)), 0x34373c);
  for (let k = 0; k < 3; k++) { const y = 15 + k * 3.2; B.glass.add(put(new THREE.PlaneGeometry(1.0, 2.2), TW.x0 - 0.02, y, tz, 0, -Math.PI / 2, 0), k === 1 ? new THREE.Color(0.25, 0.55, 0.7) : 0x000000, null); B.stone.add(put(box(0.2, 2.6, 1.4), TW.x0 - 0.05, y, tz), 0xd6d1c7); }
  // esfera del reloj (material propio) + aros de oro apagado + agujas detenidas
  const clockMat = new THREE.MeshStandardMaterial({ map: clockTexture(), roughness: 0.6, metalness: 0.2, emissive: 0x9fe8ff, emissiveIntensity: 0.06 });
  const dial = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40), clockMat); dial.position.set(TW.x0 - 0.34, 9.4, tz); dial.rotation.y = -Math.PI / 2; root.add(dial);
  B.iron.add(put(new THREE.TorusGeometry(2.38, 0.12, 6, 40), TW.x0 - 0.4, 9.4, tz, 0, Math.PI / 2, 0), 0x8a7c58);
  B.iron.add(put(box(0.08, 1.9, 0.12), TW.x0 - 0.46, 9.4 + 0.8, tz + 0.3, 0.35, 0, 0), 0x9a8a5e); B.iron.add(put(box(0.08, 1.3, 0.12), TW.x0 - 0.48, 9.4 - 0.4, tz - 0.4, -2.2, 0, 0), 0x9a8a5e);
  B.stone.add(put(box(0.5, 6.4, 6.4), TW.x0 - 0.05, 9.4, tz), 0xb5b0a6);
  // portal gótico bajo el reloj (altar del Núcleo): arco + luz del más allá
  B.stone.add(put(archGeo(1.9, 0.45, 0.8, 12), TW.x0 - 0.2, 3.6, tz, 0, Math.PI / 2, 0), 0xd6d0c4);
  B.stone.add(put(box(0.8, 3.6, 0.5), TW.x0 - 0.2, 1.8, tz - 2.15), 0xd6d0c4); B.stone.add(put(box(0.8, 3.6, 0.5), TW.x0 - 0.2, 1.8, tz + 2.15), 0xd6d0c4);
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 5.5), portalMat()); portal.position.set(TW.x0 - 0.12, 2.75, tz); portal.rotation.y = -Math.PI / 2; root.add(portal);

  // ── Týn: las dos torres con agujas, al norte sobre los techos (orientación). Las puntas FLOTAN, despegadas.
  const TZ = P.z0 - 26;
  B.stone.add(put(box(24, 26, 12), 0, 13, TZ), 0x8f8d8a);
  B.stucco.add(put(gableGeo(20, 12, true, 1.2), 0, 26, TZ + 5.4), 0x9a9894);
  for (const sx of [-1, 1]) {
    const x = sx * 8.5;
    B.stone.add(put(box(7, 40, 7), x, 20, TZ + 1), 0x8a8885);
    B.stone.add(put(box(8, 1, 8), x, 40.5, TZ + 1), 0x9c9a96);
    B.roof.add(put(new THREE.ConeGeometry(4.6, 16, 8), x, 49, TZ + 1), 0x2b2d31);
    for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.roof.add(put(new THREE.ConeGeometry(0.8, 7, 6), x + ax * 3.6, 44.5, TZ + 1 + az * 3.6), 0x2b2d31);
    for (let k = 0; k < 4; k++) B.glass.add(put(new THREE.PlaneGeometry(1.4, 3.6), x, 12 + k * 7, TZ + 4.55), rd() < 0.35 ? new THREE.Color(0.18, 0.4, 0.55) : 0x000000, null);
  }
  for (let k = 0; k < 3; k++) B.glass.add(put(new THREE.PlaneGeometry(2.2, 7), (k - 1) * 4.5, 12, TZ + 6.05), k === 1 ? new THREE.Color(0.2, 0.45, 0.6) : 0x000000, null);

  // ── la fuente (cae hacia arriba): pileta octogonal, columna, estatua rota
  B.stone.add(put(cyl(F.r, F.r + 0.2, 1.1, 8), F.x, 0.55, F.z), 0xcfc9bd);
  B.stone.add(put(cyl(F.r - 0.35, F.r - 0.35, 0.2, 8), F.x, 1.05, F.z), 0xbab4a8);
  B.glass.add(put(new THREE.CircleGeometry(F.r - 0.4, 16).rotateX(-Math.PI / 2), F.x, 0.92, F.z), new THREE.Color(0.08, 0.2, 0.26), null);
  B.stone.add(put(cyl(0.6, 0.95, 4.2, 10), F.x, 3.1, F.z), 0xd6d0c4); B.stone.add(put(cyl(1.4, 0.5, 0.5, 10), F.x, 5.2, F.z), 0xd6d0c4);
  B.stone.add(put(cyl(0.18, 0.22, 1.2, 6), F.x - 0.2, 6.0, F.z), 0xdcd6ca); B.stone.add(put(cyl(0.18, 0.22, 1.2, 6), F.x + 0.2, 6.0, F.z), 0xdcd6ca); // piernas de la estatua

  // ── coberturas del mercado muerto (exactamente sobre los sólidos de la simulación)
  for (const c of map.covers) {
    if (c.kind === 'puesto') {
      B.wood.add(put(box(c.hx * 2, 0.12, c.hz * 2), c.x, c.h - 0.06, c.z), 0x4a4644);
      B.wood.add(put(box(c.hx * 2 - 0.1, c.h - 0.4, c.hz * 2 - 0.1), c.x, (c.h - 0.4) / 2, c.z), 0x3a3836);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.wood.add(put(box(0.1, 2.4, 0.1), c.x + sx * (c.hx - 0.1), 1.2 + c.h * 0.5, c.z + sz * (c.hz - 0.1)), 0x3c3a38);
      B.cloth.add(put(box(c.hx * 2 + 0.6, 0.04, c.hz * 2 + 0.6), c.x, 2.6 + c.h * 0.5, c.z, (rd() - 0.5) * 0.25, 0, (rd() - 0.5) * 0.3), STUCCO[Math.floor(rd() * 4)]);
      for (let i = 0; i < 5; i++) B.stone.add(put(box(0.25 + rd() * 0.2, 0.3, 0.25), c.x + (rd() - 0.5) * c.hx * 1.5, c.h + 0.15, c.z + (rd() - 0.5) * c.hz * 1.5), 0xd8d2c4);
    } else if (c.kind === 'quiosco') {
      B.stucco.add(put(cyl(c.r, c.r, c.h - 1, 12), c.x, (c.h - 1) / 2, c.z), 0xbcb8b0);
      B.roof.add(put(new THREE.SphereGeometry(c.r + 0.35, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), c.x, c.h - 1, c.z), 0x3a3d42);
      B.iron.add(put(cyl(0.05, 0.05, 1.4, 5), c.x, c.h + 0.6, c.z), 0x2a2c30);
      B.stone.add(put(cyl(c.r + 0.15, c.r + 0.2, 0.4, 12), c.x, 0.2, c.z), 0xb0aba2);
    } else if (c.kind === 'pedestal') {
      B.stone.add(put(box(c.hx * 2, c.h - 0.6, c.hz * 2), c.x, (c.h - 0.6) / 2, c.z), 0xcbc6bc);
      B.stone.add(put(box(c.hx * 2 + 0.5, 0.6, c.hz * 2 + 0.5), c.x, c.h - 0.3, c.z), 0xd8d3c9); B.stone.add(put(box(c.hx * 2 + 0.4, 0.5, c.hz * 2 + 0.4), c.x, 0.25, c.z), 0xb4afa5);
      B.stone.add(put(box(0.5, 1.4, 0.6), c.x - 0.3, c.h + 0.7, c.z), 0xdad4c8); B.stone.add(put(box(0.5, 1.1, 0.6), c.x + 0.35, c.h + 0.55, c.z + 0.2), 0xdad4c8); // las piernas que quedaron
    } else if (c.kind === 'carro') {
      B.wood.add(put(box(c.hx * 2, c.h, c.hz * 2), c.x, c.h / 2, c.z, 0, 0.05, 0.08), 0x3d3a37);
      B.iron.add(put(new THREE.TorusGeometry(0.6, 0.07, 5, 12), c.x + c.hx * 0.6, 0.62, c.z + c.hz + 0.05), 0x3a3a3a); B.iron.add(put(new THREE.TorusGeometry(0.6, 0.07, 5, 12), c.x - c.hx * 0.3, 1.25, c.z - c.hz - 0.1, 1.2, 0, 0), 0x3a3a3a);
    } else if (c.kind === 'cajon') {
      B.wood.add(put(box(c.hx * 2, c.h, c.hz * 2), c.x, c.h / 2, c.z, 0, (rd() - 0.5) * 0.3, 0), 0x46423e);
    } else if (c.kind === 'farol') {
      // farol de hierro de ARCANUM (ruta-paisaje.js «farol»), escalado; la llama arde FRÍA
      const s = c.h / 3.95;
      B.iron.add(put(cyl(0.06 * s, 0.09 * s, 3.4 * s, 6), c.x, 1.7 * s, c.z), 0x222326); B.iron.add(put(cyl(0.22 * s, 0.22 * s, 0.12 * s, 8), c.x, 0.06 * s, c.z), 0x222326);
      B.iron.add(put(box(0.36 * s, 0.06 * s, 0.36 * s), c.x, 3.42 * s, c.z), 0x222326); B.iron.add(put(new THREE.ConeGeometry(0.3 * s, 0.3 * s, 4).rotateY(Math.PI / 4), c.x, 3.95 * s, c.z), 0x222326);
      c.col = ACC[(Math.abs(Math.round(c.x * 7 + c.z * 3))) % ACC.length]; B.glow.add(put(box(0.24 * s, 0.36 * s, 0.24 * s), c.x, 3.66 * s, c.z), new THREE.Color(c.col).multiplyScalar(1.6));
    }
  }

  // ── construir los lotes (una malla por material)
  const shadows = !!q.shadows;
  for (const k of Object.keys(B)) { const m = B[k].build(MAT[k], { shadows: shadows && k !== 'glass' && k !== 'glow' && k !== 'floor', name: 'm5-' + k }); if (m) { if (k === 'floor' && shadows) m.receiveShadow = true; root.add(m); } }

  // ── cielo, grietas, raíces, objetos suspendidos, zona de gravedad rota
  limboSky(r, root, { sun: sunDir, skyline: 1, hue: 0.62, glyph: 1, zen: 0x0b0620, hor: 0x3a2a6a, glow: M5V.glow });
  const inside = (x, z) => map.walkable(x, z, 0.4);
  crackStrips(root, [
    { x: F.x, z: F.z, n: low ? 7 : 10, len: 14, spread: Math.PI * 2 },                 // de la fuente
    { x: TW.x0 - 1.2, z: tz, n: 6, len: 12, a0: Math.PI * 0.55, spread: Math.PI * 0.9 }, // del portal del reloj
    { x: -14, z: 18, n: 3, len: 9 }, { x: 14, z: -26, n: 3, len: 8 }, { x: 0, z: 40, n: 3, len: 7, a0: -Math.PI / 2 },
  ], { color: M5V.glow, seed: 77, avoid: inside });
  const roots = [];
  for (let i = 0; i < (low ? 10 : 18); i++) { // trepan las fachadas desde el empedrado
    const side = i % 4, t = rd();
    if (side === 0) roots.push(climbCurve(P.x0 + 6 + t * (P.x1 - P.x0 - 12), P.z0, 0, 1, 8 + rd() * 9, rd));
    else if (side === 1) roots.push(climbCurve(P.x1, P.z0 + 4 + t * (TW.z0 - P.z0 - 6), -1, 0, 7 + rd() * 9, rd));
    else if (side === 2) roots.push(climbCurve(P.x0 + 4 + t * (C.x0 - P.x0 - 6), P.z1, 0, -1, 6 + rd() * 9, rd));
    else roots.push(climbCurve(C.x1 + 3 + t * (P.x1 - C.x1 - 6), P.z1, 0, -1, 6 + rd() * 9, rd));
  }
  roots.push(climbCurve(F.x + 0.95, F.z, 1, 0, 5, rd, { out: 0.05, wander: 0.5 }), climbCurve(F.x - 0.95, F.z + 0.2, -1, 0, 4.5, rd, { out: 0.05, wander: 0.5 }));
  roots.push(climbCurve(TW.x0, tz - 3.2, -1, 0, 14, rd), climbCurve(TW.x0, tz + 3.3, -1, 0, 11, rd));
  for (const c of map.covers.filter((c) => c.kind === 'pedestal')) roots.push(climbCurve(c.x + c.hx, c.z, 1, 0, c.h, rd, { out: 0.05 }));
  rootsMesh(root, roots, { color: M5V.glow, sun: sunDir });

  // gravedad rota: adoquines y tejas suspendidos sobre el Ojo de la Fuente; gotas que suben; la estatua flota en pedazos
  const fl = [], zr = M5.OJO.r;
  for (let i = 0; i < (low ? 34 : 70); i++) { const a = rd() * 6.283, rr = 1.6 + Math.sqrt(rd()) * (zr - 1.8); fl.push(floatItem(rd, new THREE.Vector3(F.x + Math.cos(a) * rr, 1.2 + rd() * rd() * 12, F.z + Math.sin(a) * rr), 0.22 + rd() * 0.12, { amp: 0.35, spd: 0.4, spin: 0.6, sv: new THREE.Vector3(1.3, 0.55, 1) })); }
  for (const c of map.covers.filter((c) => c.kind === 'pedestal')) for (let i = 0; i < 4; i++) fl.push(floatItem(rd, new THREE.Vector3(c.x + (rd() - 0.5) * 2, c.h + 2.2 + i * 1.1, c.z + (rd() - 0.5) * 2), 0.45 + rd() * 0.3, { amp: 0.25, spd: 0.3, spin: 0.3, sv: new THREE.Vector3(1, 1.4, 0.8) }));
  floaters(r, root, new THREE.BoxGeometry(1, 1, 1), (() => { const m = deadMaterial('cobble', { vcol: false, sat: 0.6, tint: 0xffffff, crack: 1, dustK: 0.2 }); m.emissive.setHex(0x6a3aa8); m.emissiveIntensity = 0.35; return m; })(), fl, { name: 'm5-adoquines' });
  const tiles = [];
  for (let i = 0; i < (low ? 24 : 50); i++) { const side = rd() < 0.5 ? -1 : 1; tiles.push(floatItem(rd, new THREE.Vector3((rd() - 0.5) * 70, 22 + rd() * 14, P.z0 + rd() * (P.z1 - P.z0)), 0.6 + rd() * 0.5, { amp: 0.8, spd: 0.25, spin: 0.35, sv: new THREE.Vector3(1, 0.08, 0.6) })); void side; }
  for (let i = 0; i < 4; i++) tiles.push(floatItem(rd, new THREE.Vector3((i < 2 ? -8.5 : 8.5) + (rd() - 0.5) * 2, 60 + i * 4, TZ + 1), 2.2, { amp: 1.2, spd: 0.12, spin: 0.08, sv: new THREE.Vector3(1.6, 3.4, 1.6) })); // puntas de Týn despegadas
  floaters(r, root, new THREE.BoxGeometry(1, 1, 1), deadMaterial('ashlar', { vcol: false, sat: 0.1, tint: 0x8a8e96, crack: 0.4, dustK: 0.3 }), tiles, { name: 'm5-tejas' });
  leveZone(r, root, M5.OJO, { color: 0xc9eeff, count: low ? 140 : 200 });
  // agua de la fuente que sube (chorro de gotas desde la columna)
  const jet = new THREE.Points(particleGeo(low ? 90 : 180, (i, rr) => { const a = rr() * 6.283, d = 0.3 + rr() * 1.4; return [F.x + Math.cos(a) * d, 1 + rr() * 1.5, F.z + Math.sin(a) * d]; }, 13), particleMat({ color: 0xa8e6ff, size: 0.06, mode: 0, speed: 0.12, height: 16, amp: 0.25, alpha: 0.9 }));
  jet.frustumCulled = false; root.add(jet);
  risingStream(root, [{ x: F.x, y: 1, z: F.z, r: 1.3, h: 26 }, { x: F.x, y: 0.9, z: F.z, r: 2.6, h: 12 }]);
  const pools = [{ x: F.x, z: F.z, r: 9, col: 0x9a6aff, k: 0.9 }, { x: TW.x0 - 3, z: tz, r: 7, col: 0xd070ff, k: 1.1 }];
  for (const c of map.covers.filter((c) => c.kind === 'farol')) pools.push({ x: c.x, z: c.z, r: 4.2, col: c.col || M5V.flame, k: 0.8 });
  for (const p of lit) if (p[1] < 9) pools.push({ x: p[0], z: p[2], r: 2.5, col: p[3], k: 0.5 });
  lightPools(root, pools);

  // ── luz: halos de faroles, ventanas y portal; rayos de luz; niebla baja; polvo
  const hl = [];
  for (const c of map.covers.filter((c) => c.kind === 'farol')) hl.push({ p: new THREE.Vector3(c.x, c.h * 0.93, c.z), s: 2.4, col: c.col || M5V.flame, o: 0.8 });
  for (const p of lit.slice(0, 90)) hl.push({ p: new THREE.Vector3(p[0], p[1], p[2]), s: 2.6, col: p[3], o: 0.35 });
  hl.push({ p: new THREE.Vector3(TW.x0 - 0.8, 2.6, tz), s: 9, col: 0xd8a0ff, o: 0.8 });
  haloField(root, hl, { tex: r.shared('env.soft', softTex) });
  lightShafts(root, [ // luz que cae por las grietas del cielo: sobre la fuente, el mercado y la boca de la calle
    { x: F.x - 2, z: F.z + 1, top: 60, r0: 5, r1: 3.2, k: 1.2, col: 0xd8c0ff }, { x: 15, z: 13, top: 55, r0: 3, r1: 1.8, k: 1, col: 0xff8fe0 }, { x: -18, z: -20, top: 55, r0: 3.2, r1: 2, k: 1, col: 0x7ff0d8 },
    ...(low ? [] : [{ x: 0, z: 34, top: 45, r0: 2.6, r1: 1.6, k: 0.9, col: 0xf2c66d }, { x: -30, z: 6, top: 45, r0: 2.4, r1: 1.5, k: 0.8, col: 0x9fe8ff }]),
  ], { color: 0xdcefff });
  const mist = [];
  for (let i = 0; i < (low ? 10 : 18); i++) mist.push({ p: new THREE.Vector3(P.x0 + 4 + rd() * (P.x1 - P.x0 - 8), 0.8 + rd() * 1.2, P.z0 + 4 + rd() * (P.z1 - P.z0 - 8)), s: 9 + rd() * 8, col: [0x6a4aa8, 0x2a7a8a, 0x8a3a7a][i % 3] });
  for (let i = 0; i < 4; i++) mist.push({ p: new THREE.Vector3((rd() - 0.5) * 6, 1, C.z0 + 3 + i * 6), s: 7, col: 0x5a4a9a });
  mistLayer(r, mist, { alpha: 0.2, near: 6, far: 120 });
  addMotes(r, root, low ? 60 : 160, 26);
  if (q.lights >= 3) { // Media/Alta: luz fría real en el portal y sobre la fuente
    const pl = new THREE.PointLight(0xc890ff, 70, 30, 1.6); pl.position.set(TW.x0 - 2, 3, tz); root.add(pl);
    const pf = new THREE.PointLight(0x7ff0d8, 50, 26, 1.6); pf.position.set(F.x, 7, F.z); root.add(pf);
    r.dyn.push((dt, t) => { pl.intensity = 60 * (0.8 + 0.2 * Math.sin(t * 1.3)); });
  }
  void dc;
}
