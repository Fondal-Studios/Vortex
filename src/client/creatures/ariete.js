// ARIETE — embestidor. Bestia-escarabajo/rinoceronte acorazada: carne musculosa bajo placas de quitina superpuestas como tejas, caparazón-capucha
// sobre el cuello, cuerno de hueso con anillos de crecimiento que termina en cristal ardiente, mandíbulas, cuatro patas con músculo, tendón y garras.
// Todo el cuerpo es 1 malla fusionada con un solo material bio-orgánico (carne + quitina + hueso + cristal por atributos de vértice).
// wind: se agacha, patea el suelo, baja la cabeza, el cuerno y las juntas del caparazón se ponen al rojo y resuella;
// charge: galope estirado; stun: se tambalea con esquirlas girando; hp<0.35: cojea y jadea.
import * as THREE from 'three';
import { cfg } from '../quality.js';
import { bioMaterial } from './obelisco-mat.js';
import { eyeCluster, softDot, clamp, lerp, damp } from './obelisco-lib.js';
import { V3, paint, place, aimY, mirrorX, merge, loft, line, prof, domePlate, patch, blobGeo, spikes, crystals, crystalGeo, sstep, ikLeg } from './obelisco-geo.js';

export default function build(kit, color) {
  const { Spring } = kit;
  const level = cfg().humans, LOW = level === 'low', HI = level === 'high';
  const R = LOW ? 6 : HI ? 12 : 9, S1 = LOW ? 8 : 14; // lados / tramos
  const bio = bioMaterial({ glow: 0xff5a1a, vein: 0x12040a, rim: 0x5a3a8a, scale: 1.2, bump: 1.0, wet: 0.5, ridge: 70, metal: 0.12, sheen: 0.1, breath: 0.01 });
  const U = bio.userData.u; U.uCrackGlow.value = 0.12; U.uVeinGlow.value = 0.05;
  const ORANGE = new THREE.Color(color), HOT = 0xff6a20;
  const root = new THREE.Group(), body = new THREE.Group(); body.position.y = 0.22; root.add(body);
  const mesh = (geo, parent) => { const m = new THREE.Mesh(geo, bio); parent.add(m); return m; };

  /* ── perfiles del torso (z = eje del cuerpo) ── */
  const Z0 = -1.55, Z1 = 1.15, LZ = Z1 - Z0;
  const rzF = prof([[-1.55, 0.1], [-1.4, 0.3], [-0.95, 0.56], [-0.4, 0.62], [0.1, 0.72], [0.6, 0.8], [0.95, 0.68], [1.15, 0.42]]);
  const cyF = prof([[-1.55, -0.12], [-0.5, 0.0], [0.6, 0.08], [1.15, 0.0]]);
  const RY = 0.84;
  const FLESH = 0x3a1a26, FLESH2 = 0x4e2c36, CHIT = 0x1a1524, BONE = 0x9a8868;

  /* ── CARNE del torso: lomo musculoso con vientre claro ── */
  const parts = [];
  { const pts = []; for (let i = 0; i <= 8; i++) { const z = Z0 + (i / 8) * LZ; pts.push(new V3(0, cyF(z), z)); }
    const g = loft(pts, { seg: S1 + 6, radial: R + 4, r: (t) => rzF(Z0 + t * LZ), ry: () => RY, round: [0.07, 0.1] });
    parts.push(paint(g, FLESH, 0, 0.0, (p, n) => ({ k: 0.75 + 0.55 * clamp(-n.y * 0.8 + 0.2, 0, 1) + 0.15 * Math.sin(p.z * 9), c: n.y < -0.3 ? FLESH2 : FLESH }))); }
  // masas musculares de hombro y anca (carne bajo las placas)
  for (const sd of [-1, 1]) {
    parts.push(paint(blobGeo(0.34, 0.4, 0.5, 14, 10), FLESH, 0, 0, (p) => ({ k: 0.85 + 0.35 * Math.max(0, p.y) })));
    parts[parts.length - 1] = place(parts[parts.length - 1], [sd * 0.5, -0.05, 0.5]);
    const h = paint(blobGeo(0.3, 0.38, 0.46, 12, 9), FLESH, 0); parts.push(place(h, [sd * 0.48, -0.08, -0.65]));
  }

  /* ── CARAPACHO: placas solapadas como tejas (el borde trasero de cada una cubre a la siguiente) ── */
  const plateZ = [0.5, 0.17, -0.18, -0.52, -0.86, -1.18], plateHL = [0.3, 0.29, 0.27, 0.25, 0.22, 0.18], plateA = [1.75, 1.75, 1.7, 1.6, 1.5, 1.35];
  plateZ.forEach((zc, i) => {
    const hl = plateHL[i], A = plateA[i];
    const g = patch((u, v) => {
      const phi = (u - 0.5) * 2 * A, z = zc + (0.5 - v) * 2 * hl, edge = Math.abs(u * 2 - 1);
      const off = (0.05 + 0.1 * Math.pow(v, 1.5) + 0.07 * Math.exp(-phi * phi * 5) + 0.035 * (1 - Math.pow(2 * v - 1, 2))) * (1 - 0.85 * sstep(0.78, 1, edge)) - 0.0;
      const rx = rzF(z) + off;
      return new V3(Math.sin(phi) * rx, cyF(z) + Math.cos(phi) * rx * RY, z);
    }, R + 6, 4, { thick: 0.035 });
    parts.push(paint(g, CHIT, 1, 0, (p, n, uv) => { const rear = sstep(0.55, 1, uv[1]), side = sstep(0.55, 1, Math.abs(uv[0] * 2 - 1)); return { k: 0.55 + 0.7 * rear + 0.25 * Math.exp(-Math.pow((uv[0] - 0.5) * 8, 2)) - 0.2 * side, g: rear * 0.55 * (1 - side), c: i < 2 ? 0x2a2040 : CHIT }; }));
    // lomo de cada placa: cresta de espinas de hueso y un cristal entre juntas
    const sp = [];
    const zr = zc - hl * 0.55, rr = rzF(zr) + 0.12, ph0 = 0;
    sp.push({ p: new V3(0, cyF(zr) + rr * RY * 0.98, zr), d: new V3(0, 1, -0.9), r: 0.07 - i * 0.006, h: 0.3 - i * 0.025 });
    for (const sd of [-1, 1]) { const ph = sd * 0.62; sp.push({ p: new V3(Math.sin(ph) * rr, cyF(zr) + Math.cos(ph) * rr * RY, zr), d: new V3(Math.sin(ph) * 0.9, 0.7, -0.8), r: 0.05 - i * 0.004, h: 0.2 - i * 0.015 }); }
    parts.push(spikes(sp, { sides: 5, color: BONE, cls: 2, curve: -0.25 }));
    if (i % 2 === 0) parts.push(crystals([{ p: new V3(0, cyF(zc - hl) + (rzF(zc - hl) + 0.06) * RY, zc - hl), d: new V3(0, 1, -0.7), r: 0.06, h: 0.34 - i * 0.03, c: color }], { sides: 5 }));
  });
  // capucha del cuello (pronotum): domo grande que cae por delante sobre la cabeza, con borde serrado
  { const g = patch((u, v) => {
      const phi = (u - 0.5) * 2 * 2.0, z = 0.5 + v * 0.8, edge = Math.abs(u * 2 - 1);
      const off = (0.1 + 0.34 * Math.pow(v, 1.2) * (1 - 0.5 * edge) - 0.05 * Math.pow(Math.max(0, v - 0.7) * 3.3, 2) * 0.0) * (1 - 0.7 * sstep(0.8, 1, edge));
      const rx = Math.max(rzF(Math.min(z, 1.15)), 0.45) + off + 0.02 * Math.sin(u * 40) * v;
      const y = cyF(Math.min(z, 1.15)) + Math.cos(phi) * rx * RY + 0.18 * Math.sin(v * Math.PI) * 0.6;
      return new V3(Math.sin(phi) * rx * (1 + 0.15 * v), y - 0.1 * v * v, z);
    }, R + 8, 8, { thick: 0.045, inner: true });
    parts.push(paint(g, CHIT, 1, 0, (p, n, uv) => ({ k: 0.6 + 0.6 * uv[1] + 0.2 * Math.exp(-Math.pow((uv[0] - 0.5) * 6, 2)), g: sstep(0.8, 1, uv[1]) * 0.6, c: 0x2c2240 })));
    const sp = []; const NH = LOW ? 5 : 7; for (let i = 0; i < NH; i++) { const u = (i + 0.5) / NH, phi = (u - 0.5) * 3.2, z = 1.28, rx = 0.45 + 0.34 * 0.8 * (1 - 0.5 * Math.abs(u * 2 - 1)) + 0.02; sp.push({ p: new V3(Math.sin(phi) * rx * 1.12, cyF(1.15) + Math.cos(phi) * rx * RY - 0.1, z - 0.04), d: new V3(Math.sin(phi) * 0.7, 0.2, 1), r: 0.085, h: 0.4 - Math.abs(phi) * 0.09 }); }
    parts.push(spikes(sp, { sides: 5, color: BONE, cls: 2, curve: 0.15 })); }
  // hombreras y ancas: placas abombadas a los lados
  for (const sd of [-1, 1]) {
    const sh = domePlate(0.3, 0.42, 0.2, { ridge: 0.6, thick: 0.04, inner: true }); parts.push(paint(aimY(sh, new V3(sd * 0.7, 0.2, 0.5), new V3(sd * 0.85, 0.65, 0.1), [1, 1, 1]), CHIT, 1, 0, (p, n, uv) => ({ k: 0.6 + 0.6 * Math.max(0, p.y), g: sstep(0.8, 1, Math.max(Math.abs(uv[0] * 2 - 1), Math.abs(uv[1] * 2 - 1))) * 0.5 })));
    const hp = domePlate(0.26, 0.4, 0.17, { ridge: 0.4, thick: 0.04 }); parts.push(paint(aimY(hp, new V3(sd * 0.66, 0.1, -0.7), new V3(sd * 0.9, 0.5, -0.1)), CHIT, 1, 0, (p, n, uv) => ({ k: 0.6 + 0.5 * Math.max(0, p.y), g: sstep(0.8, 1, Math.max(Math.abs(uv[0] * 2 - 1), Math.abs(uv[1] * 2 - 1))) * 0.5 })));
    parts.push(spikes([{ p: new V3(sd * 0.92, 0.4, 0.52), d: new V3(sd * 1, 0.5, 0.1), r: 0.1, h: 0.44 }, { p: new V3(sd * 0.9, 0.34, 0.2), d: new V3(sd * 1, 0.5, -0.2), r: 0.08, h: 0.32 }, { p: new V3(sd * 0.86, 0.2, -0.7), d: new V3(sd * 1, 0.4, -0.5), r: 0.08, h: 0.3 }], { sides: 5, color: BONE, cls: 2, curve: -0.2 }));
  }
  const torso = mesh(merge(parts), body); torso.castShadow = true;

  /* ── COLA: tres vértebras blindadas y un mazo de cristal ── */
  const tail = new THREE.Group(); tail.position.set(0, -0.02, -1.55); body.add(tail);
  { const tp = [];
    const pts = [new V3(0, 0, 0.0), new V3(0, 0.02, -0.4), new V3(0, 0.14, -0.8), new V3(0, 0.36, -1.1)];
    tp.push(paint(loft(pts, { seg: 10, radial: R, r: (t) => lerp(0.2, 0.05, Math.pow(t, 0.8)), ry: () => 0.9, round: [0.1, 0.1] }), FLESH, 0, 0, (p, n) => ({ k: 0.8 + 0.3 * n.y })));
    for (let i = 0; i < 3; i++) { const t = 0.22 + i * 0.25, pt = pts[1].clone().lerp(pts[3], (i + 0.4) / 3 * 0.9); const pl = domePlate(0.2 - i * 0.04, 0.17, 0.1 + 0.02 * (2 - i), { thick: 0.02, ridge: 0.6 }); tp.push(paint(aimY(pl, new V3(pt.x, pt.y + (0.17 - i * 0.04) * 0.9, pt.z), new V3(0, 1, 0.25 - i * 0.2)), CHIT, 1, 0, (p, n, uv) => ({ k: 0.9 + 0.4 * p.y, g: 0.4 * sstep(0.7, 1, uv[1]) }))); }
    tp.push(crystals([{ p: new V3(0, 0.34, -1.05), d: new V3(0, 0.55, -1), r: 0.1, h: 0.5, c: color }, { p: new V3(0.05, 0.3, -1.0), d: new V3(0.8, 0.4, -0.6), r: 0.06, h: 0.28, c: color }, { p: new V3(-0.05, 0.3, -1.0), d: new V3(-0.8, 0.4, -0.6), r: 0.06, h: 0.28, c: color }], { sides: 5 }));
    mesh(merge(tp), tail); }

  /* ── CABEZA: cráneo, cejas pesadas, cuerno de hueso→cristal, colmillos, mandíbula ── */
  const head = new THREE.Group(); head.position.set(0, -0.04, 1.14); body.add(head);
  { const hp = [];
    const sk = loft([new V3(0, 0.02, -0.3), new V3(0, 0, 0.2), new V3(0, -0.07, 0.55), new V3(0, -0.14, 0.8)], { seg: 10, radial: R + 2, r: prof([[0, 0.4], [0.4, 0.4], [0.75, 0.25], [1, 0.14]]), ry: () => 0.78, round: [0.1, 0.12] });
    hp.push(paint(sk, FLESH, 0, 0, (p, n) => ({ cls: n.y > 0.1 ? 1 : 0, c: n.y > 0.1 ? 0x261d33 : FLESH, k: n.y > 0.1 ? 0.8 + 0.4 * p.z : 0.9 })));
    // cejas: crestas macizas sobre los ojos
    for (const sd of [-1, 1]) {
      const br = loft([new V3(sd * 0.05, 0.24, 0.62), new V3(sd * 0.2, 0.24, 0.5), new V3(sd * 0.36, 0.2, 0.32), new V3(sd * 0.44, 0.08, 0.14)], { seg: 8, radial: 6, r: prof([[0, 0.07], [0.5, 0.1], [1, 0.05]]), ry: () => 0.8, round: [0.05, 0.2] });
      hp.push(paint(br, CHIT, 1, 0, (p) => ({ k: 0.9 + 0.4 * p.y })));
      hp.push(spikes([{ p: new V3(sd * 0.38, 0.24, 0.26), d: new V3(sd * 0.9, 0.5, -0.2), r: 0.06, h: 0.34 }], { sides: 5, color: BONE, cls: 2, curve: -0.3 }));
      // cuerno lateral corto
      hp.push(paint(loft([new V3(sd * 0.3, 0.2, 0.0), new V3(sd * 0.5, 0.45, -0.05), new V3(sd * 0.55, 0.78, 0.1)], { seg: 8, radial: 6, r: (t) => lerp(0.1, 0.01, t), round: [0, 0] }), BONE, 2, 0));
      // colmillos / mandíbulas superiores
      hp.push(paint(loft([new V3(sd * 0.2, -0.17, 0.62), new V3(sd * 0.26, -0.3, 0.8), new V3(sd * 0.18, -0.34, 1.05)], { seg: 8, radial: 6, r: (t) => lerp(0.07, 0.008, t), round: [0.1, 0] }), BONE, 2, 0));
    }
    // CUERNO: base ósea ancha, anillos de crecimiento, curva hacia delante y arriba; la punta se vuelve cristal
    const hc = new THREE.CatmullRomCurve3([new V3(0, 0.05, 0.4), new V3(0, 0.2, 0.8), new V3(0, 0.4, 1.2), new V3(0, 0.72, 1.55), new V3(0, 1.02, 1.74)], false, 'centripetal');
    const horn = loft(hc, { seg: LOW ? 10 : 20, radial: R, r: (t) => lerp(0.34, 0.015, Math.pow(t, 0.85)) * (1 + 0.05 * Math.sin(t * 60)), ry: () => 0.92, round: [0.04, 0] });
    hp.push(paint(horn, BONE, 2, 0, (p, n, uv) => { const t = uv[1], c = new THREE.Color(0x2e241c).lerp(new THREE.Color(BONE), sstep(0.0, 0.25, t)).lerp(ORANGE, sstep(0.55, 0.8, t)); return { c, cls: 2 + sstep(0.58, 0.78, t), g: sstep(0.5, 1, t) * 0.8, k: 1 }; }));
    // collar de hueso en la base del cuerno
    hp.push(paint(loft([new V3(0, 0.0, 0.34), new V3(0, 0.12, 0.62)], { seg: 4, radial: R, r: () => 0.36, ry: () => 0.85, round: [0.3, 0.3] }), 0x3a3040, 1, 0, () => ({ k: 0.9 })));
    mesh(merge(hp), head); head.userData.hornCurve = hc; }
  // mandíbula inferior con dientes (se abre al resollar)
  const jaw = new THREE.Group(); jaw.position.set(0, -0.2, 0.28); head.add(jaw);
  { const jp = [];
    const jl = loft([new V3(0, 0, 0), new V3(0, -0.06, 0.35), new V3(0, -0.1, 0.62)], { seg: 8, radial: 8, r: prof([[0, 0.28], [0.6, 0.2], [1, 0.12]]), ry: () => 0.55, round: [0.1, 0.2] });
    jp.push(paint(jl, 0x5a2030, 0, 0.0, (p, n) => ({ k: 0.8 + 0.3 * n.y })));
    const items = []; for (let i = 0; i < (LOW ? 4 : 7); i++) { const a = (i / ((LOW ? 4 : 7) - 1) - 0.5) * 2; items.push({ p: new V3(a * 0.2, 0.05, 0.12 + (1 - Math.abs(a)) * 0.38), d: new V3(-a * 0.1, 1, 0.25), r: 0.035, h: 0.15 + (1 - Math.abs(a)) * 0.05 }); }
    jp.push(spikes(items, { sides: 4, color: 0xe6dcc0, cls: 2 }));
    for (const sd of [-1, 1]) jp.push(paint(loft([new V3(sd * 0.22, 0.0, 0.1), new V3(sd * 0.38, -0.05, 0.4), new V3(sd * 0.26, 0.05, 0.78)], { seg: 8, radial: 6, r: (t) => lerp(0.09, 0.01, t), round: [0.1, 0] }), BONE, 2, 0));
    mesh(merge(jp), jaw); }
  // ojos hundidos bajo la ceja
  const EC = eyeCluster({ max: 2, quality: level, iris: 0xffffff, sclera: 0x9a8a70 }); head.add(EC.object);
  for (const sd of [-1, 1]) EC.add({ p: new V3(sd * 0.34, 0.1, 0.38), n: new V3(sd * 0.7, 0.1, 0.6), r: 0.14, tint: 0xffb02a, slit: true, lag: 12 });

  /* ── PATAS (4): muslo musculoso, rodilla acorazada, tibia con tendón, pie con garras ── */
  const UP = 0.72, LO = 0.78;
  const legGeo = (() => {
    // (lado derecho, +x). El muslo mira hacia abajo (-y); la placa externa está en +x.
    const up = [], lo = [];
    const thigh = loft(line([0, 0, 0], [0, -UP, 0]), { seg: 10, radial: R, r: prof([[0, 0.25], [0.28, 0.32], [0.62, 0.22], [1, 0.13]]), ry: () => 0.9, round: [0.2, 0.0], mod: (t, a) => 1 + 0.07 * Math.sin(a * 3 + t * 5) * (1 - t) });
    up.push(paint(thigh, FLESH, 0, 0, (p, n) => ({ k: 0.8 + 0.3 * n.x, g: 0.0 })));
    const gp = domePlate(0.15, 0.36, 0.13, { ridge: 0.5, thick: 0.03, nu: 6, nv: 6 }); up.push(paint(aimY(gp, new V3(0.17, -UP * 0.42, 0.0), new V3(1, 0.15, 0.0)), CHIT, 1, 0, (p, n, uv) => ({ k: 0.55 + 0.7 * Math.max(0, p.x * 3), g: sstep(0.8, 1, Math.max(Math.abs(uv[0] * 2 - 1), Math.abs(uv[1] * 2 - 1))) * 0.5 })));
    up.push(paint(blobGeo(0.15, 0.15, 0.17, 10, 8), CHIT, 1, 0, (p) => ({ k: 0.7 + 0.5 * p.y })));
    up[up.length - 1] = place(up[up.length - 1], [0, -UP, 0]);
    up.push(spikes([{ p: new V3(0.06, -UP, -0.14), d: new V3(0.4, 0.2, -1), r: 0.06, h: 0.3 }, { p: new V3(0.12, -UP * 0.6, -0.08), d: new V3(1, 0.3, -0.6), r: 0.04, h: 0.2 }], { sides: 5, color: BONE, cls: 2, curve: -0.2 }));
    const shin = loft(line([0, 0, 0], [0, -LO, 0]), { seg: 10, radial: R, r: prof([[0, 0.13], [0.16, 0.165], [0.45, 0.105], [1, 0.06]]), ry: () => 0.95, round: [0.0, 0.0] });
    lo.push(paint(shin, FLESH, 0, 0, (p, n) => ({ k: 0.8 + 0.3 * n.x })));
    const sg = domePlate(0.08, 0.3, 0.07, { ridge: 0.6, thick: 0.02, nu: 5, nv: 6 }); lo.push(paint(aimY(sg, new V3(0.0, -LO * 0.4, 0.075), new V3(0, 0.1, 1)), CHIT, 1, 0, (p, n, uv) => ({ k: 0.7 + 0.5 * Math.max(0, p.y * 4), g: 0.0 })));
    // tendón: tubo claro por detrás de la tibia
    lo.push(paint(loft([new V3(0, -0.05, -0.1), new V3(0, -LO * 0.5, -0.075), new V3(0, -LO + 0.06, -0.04)], { seg: 6, radial: 5, r: () => 0.022, round: [0.2, 0.2] }), 0xb08a80, 0, 0, () => ({ k: 1.1 })));
    // pie: almohadilla + tres garras
    lo.push(paint(place(blobGeo(0.12, 0.07, 0.17, 10, 7), [0, -LO, 0.05]), 0x2a1822, 1, 0, () => ({ k: 0.9 })));
    lo.push(spikes([{ p: new V3(0, -LO, 0.14), d: new V3(0, -0.5, 1), r: 0.05, h: 0.3 }, { p: new V3(0.07, -LO, 0.1), d: new V3(0.6, -0.5, 0.9), r: 0.04, h: 0.24 }, { p: new V3(-0.07, -LO, 0.1), d: new V3(-0.6, -0.5, 0.9), r: 0.04, h: 0.24 }, { p: new V3(0, -LO + 0.04, -0.12), d: new V3(0, -0.2, -1), r: 0.03, h: 0.16 }], { sides: 5, color: 0xe6dcc0, cls: 2, curve: 0.15 }));
    return { uR: merge(up), lR: merge(lo), uL: mirrorX(merge(up)), lL: mirrorX(merge(lo)) };
  })();
  const legs = [], hipsZ = [0.55, -0.62];
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1, row = i >> 1, hz = hipsZ[row];
    const l = ikLeg(bio, side > 0 ? legGeo.uR : legGeo.uL, bio, side > 0 ? legGeo.lR : legGeo.lL, { upper: UP, lower: LO });
    l.object.position.set(side * 0.6, 0.0, hz); l.setBend(new V3(side * 0.35, 1, row ? -0.9 : 0.9)); body.add(l.object);
    legs.push({ l, side, row, base: new V3(side * 0.08, -1.22, row ? -0.05 : 0.1), ph: (i === 0 || i === 3) ? 0 : Math.PI });
  }

  /* ── halo del cuerno, vapor y pájaros-esquirla ── */
  const hornTip = new THREE.Object3D(); { const c = head.userData.hornCurve.getPoint(0.97); hornTip.position.copy(c); head.add(hornTip); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); hornTip.add(halo);
  const NV = LOW ? 0 : 20; let vap = null, vpos, vcol, vvel, vage;
  if (NV) {
    vpos = new Float32Array(NV * 3); vcol = new Float32Array(NV * 3); vvel = new Float32Array(NV * 3); vage = new Float32Array(NV).fill(9);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(vpos, 3)); g.setAttribute('color', new THREE.BufferAttribute(vcol, 3));
    vap = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.5, map: softDot(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })); vap.frustumCulled = false; root.add(vap);
  }
  const birdG = merge([crystalGeo(new V3(0, 0, -0.12), new V3(0, 0, 1), 0.05, 0.3, color, { sides: 4 }), crystalGeo(new V3(-0.02, 0, 0), new V3(-1, 0.2, -0.3), 0.04, 0.2, color, { sides: 4 }), crystalGeo(new V3(0.02, 0, 0), new V3(1, 0.2, -0.3), 0.04, 0.2, color, { sides: 4 })]);
  const birds = []; for (let i = 0; i < 4; i++) { const g = new THREE.Group(); const m = new THREE.Mesh(birdG, bio); g.add(m); g.visible = false; head.add(g); birds.push({ g, m, ph: i / 4 * 6.28 }); }

  const mats = [bio, ...EC.mats];
  const eyeDir = new V3(); const sPitch = new Spring(0, 140, 10), sHit = new Spring(0, 160, 9), sSway = new Spring(0, 90, 6), sTail = new Spring(0, 70, 7), sYaw = new Spring(0, 60, 8);
  let phase = 0, wind = 0, chg = 0, stun = 0, prevHp = 1, hit = 0, limp = 0, wt = 0, prevS = '', steamAcc = 0;
  const tmp = new V3(), look0 = new V3(0, 0.1, 1);
  const sx = Math.sin;

  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = clamp(dt, 0, 0.05); const id = st.id || 0, hp = st.hp == null ? 1 : st.hp, hurtLow = clamp((0.35 - hp) / 0.35, 0, 1);
    const sn = st.s;
    if (sn !== prevS) { if (sn === 'wind') wt = 0; if (sn === 'stun') { sSway.v += 4; } if (prevS === 'stun' || sn === 'stun') hit = Math.max(hit, 0.3); prevS = sn; }
    if (sn === 'wind') wt += dt;
    if (hp < prevHp - 0.001) { hit = 1; sHit.v += 6; } prevHp = hp; hit = Math.max(0, hit - dt * 3);
    const speed = clamp(ctx.speed || 0, 0, 1.6), look = ctx.look || look0;
    wind = damp(wind, sn === 'wind' ? 1 : 0, sn === 'wind' ? 5 : 3, dt); chg = damp(chg, sn === 'charge' ? 1 : 0, 6, dt); stun = damp(stun, (sn === 'stun' || st.st) ? 1 : 0, 6, dt); limp = damp(limp, hurtLow, 3, dt);
    const heat = Math.max(wind, chg * 0.9);
    const run = Math.max(speed, chg * 1.6) * (1 - stun);
    phase += dt * (3 + run * 7.5 + hurtLow * 1.5);
    const breath = sx(t * (1.6 + hurtLow * 2.2 + wind * 1.4) + id) * 0.5 + 0.5;

    // ─ patas
    legs.forEach((L, i) => {
      const ph = phase + L.ph, st0 = clamp(0.1 + run * 0.65, 0, 1), swing = sx(ph), lift = Math.max(0, Math.cos(ph)) * 0.38 * st0;
      let fz = L.base.z + swing * 0.42 * st0, fy = L.base.y + lift, fx = L.base.x;
      if (i === 1 && limp > 0.01) { fy += 0.25 * limp + Math.max(0, sx(t * 3)) * 0.12 * limp; fz *= 1 - 0.5 * limp; }
      if (L.row === 0 && wind > 0.05) {
        const pw = sx(wt * 7.0 + (L.side > 0 ? 3.1 : 0)); const up = Math.max(0, pw); fy = lerp(fy, L.base.y + up * 0.55, wind); fz = lerp(fz, L.base.z + 0.45 - (1 - up) * 0.8, wind);
      }
      if (stun > 0.05) { fx += Math.sin(t * 2.3 + i * 2) * 0.22 * stun; fz += Math.cos(t * 1.7 + i) * 0.2 * stun; fy += Math.max(0, sx(t * 2.6 + i * 1.7)) * 0.25 * stun; fx += L.side * 0.15 * stun; }
      if (chg > 0.05) { fz = lerp(fz, L.base.z + sx(ph) * 0.7, chg); fy = lerp(fy, L.base.y + Math.max(0, Math.cos(ph)) * 0.5, chg); }
      tmp.set(fx, fy + hit * 0.1 * (i & 1 ? 1 : -1), fz); L.l.setFoot(tmp);
      const push = clamp(-Math.cos(ph) * 0.5 + 0.5, 0, 1) * (0.3 + run) + wind * 0.5 * (L.row === 0 ? 1 : 0.3);
      L.l.upperMesh.scale.set(1 + push * 0.16, 1, 1 + push * 0.12);
    });
    // ─ cuerpo: peso, vaivén, agachado al avisar, estirado al cargar, tambaleo al aturdirse
    const pitchS = sPitch.step(dt, 0), hitK = sHit.step(dt, 0), swayK = sSway.step(dt, 0), tl = sTail.step(dt, 0), yawS = sYaw.step(dt, clamp(Math.atan2(look.x, Math.max(0.2, look.z)), -0.9, 0.9));
    const squat = wind * (0.14 + 0.03 * sx(wt * 14)) + stun * 0.08 + hurtLow * 0.06;
    body.position.y = 0.22 - squat + (run > 0.05 ? Math.abs(sx(phase)) * 0.06 * (0.4 + run) : 0) + (breath - 0.5) * 0.02 - hit * 0.04;
    body.rotation.x = chg * 0.1 + wind * 0.07 + sx(phase * 2) * 0.03 * run + hitK * 0.1 + stun * (sx(t * 1.9) * 0.12) + hurtLow * 0.05;
    body.rotation.z = sx(phase) * 0.05 * run + stun * (sx(t * 2.4) * 0.16 + swayK * 0.2) + (hurtLow ? sx(t * 5) * 0.015 : 0) + hit * 0.06 * sx(t * 40) + wind * sx(wt * 7) * 0.035;
    body.rotation.y = stun * sx(t * 1.3) * 0.22;
    body.scale.set(1 - chg * 0.03 + (breath - 0.5) * 0.012, 1 - chg * 0.03 + (breath - 0.5) * 0.03, 1 + chg * 0.07);
    // ─ cabeza: pesada, sigue al jugador con retardo; baja para embestir; cae mareada
    head.rotation.x = lerp(0.02 + hurtLow * 0.12, 0.42, wind) + chg * 0.22 + stun * (0.28 + sx(t * 1.9 + 1) * 0.14) + pitchS + hitK * 0.2 - Math.max(0, Math.sin(phase * 2)) * 0.05 * run;
    head.rotation.y = yawS * 0.5 * (1 - heat * 0.8) + stun * sx(t * 1.6) * 0.5 + sx(t * 0.8 + id) * 0.04;
    head.position.set(0, -0.04 - wind * 0.1 - stun * 0.12, 1.14 + chg * 0.06);
    jaw.rotation.x = clamp(0.1 + breath * 0.1 + wind * (0.35 + 0.25 * sx(wt * 20)) + chg * 0.55 + stun * 0.35 + hurtLow * 0.15 + hit * 0.4, 0, 1) * 0.6;
    // ─ materiales: las juntas del caparazón, las venas y el cuerno se ponen al rojo
    U.uGlow.value = heat * 1.1 + hit * 0.5; U.uCrackGlow.value = 0.1 + heat * 1.6 + hurtLow * 0.4; U.uVeinGlow.value = 0.05 + heat * 0.8 + hurtLow * 0.3 + (wind > 0.1 ? 0.2 * sx(wt * 14) : 0);
    U.uCry.value = 0.7 + heat * 1.6 + 0.2 * sx(t * 5) + hit * 0.6; U.uPulse.value = wind * 0.6 + hurtLow * 0.2; U.uGlowCol.value.setHex(0xff5a1a).lerp(ORANGE, 0.0);
    halo.material.opacity = clamp(heat * 0.55, 0, 0.6) * (0.8 + 0.2 * sx(t * (12 + wind * 30))); halo.scale.setScalar(0.9 + heat * 0.9);
    // ─ ojos: entrecerrados y amenazantes
    EC.update(dt, stun > 0.3 ? eyeDir.set(sx(t * 3) * 0.9, Math.cos(t * 2.4) * 0.6, 1) : look, { open: clamp(0.8 - wind * 0.25 - chg * 0.3 - stun * 0.4 - hurtLow * 0.15, 0.15, 1), dilate: 1 - heat * 0.5 + stun * 0.5, glow: 0.7 + heat * 1.8, jitter: 0.3 + stun * 2, blinkRate: 1 + stun * 2 + hurtLow, maxAng: 0.9, track: 1 + heat });
    // ─ cola
    tail.rotation.x = tl * 0.4 - run * 0.15 + sx(t * 1.3) * 0.05 + wind * 0.3; tail.rotation.y = sx(phase) * 0.18 * run + sx(t * 0.9 + id) * 0.12 + stun * sx(t * 2) * 0.4;
    if (hit > 0.9) sTail.v += 4;
    // ─ pájaros aturdidos
    birds.forEach((B, i) => { B.g.visible = stun > 0.05; const a = t * 3.2 + B.ph; B.g.position.set(Math.cos(a) * 0.55, 0.7 + Math.sin(t * 2 + i) * 0.06, 0.1 + Math.sin(a) * 0.55); B.g.rotation.y = -a + Math.PI; B.g.scale.setScalar(stun); B.m.rotation.z = sx(t * 22 + i) * 0.5; });
    // ─ vapor por los ollares (más al avisar y al estar herido)
    if (vap) {
      const rate = 3 + wind * 22 + hurtLow * 10 + run * 5 + stun * 2; steamAcc += dt * rate;
      head.updateWorldMatrix(true, false);
      while (steamAcc >= 1) { steamAcc -= 1; let k = 0; for (let j = 0; j < NV; j++) if (vage[j] > 1.1) { k = j; break; }
        tmp.set((Math.random() < 0.5 ? -1 : 1) * 0.12, -0.05, 0.82); head.localToWorld(tmp); root.worldToLocal(tmp); vpos[k * 3] = tmp.x; vpos[k * 3 + 1] = tmp.y; vpos[k * 3 + 2] = tmp.z; vvel[k * 3] = (Math.random() - 0.5) * 0.3; vvel[k * 3 + 1] = 0.35 + Math.random() * 0.3; vvel[k * 3 + 2] = 0.5 + Math.random() * 0.4 + wind * 0.6; vage[k] = 0; }
      for (let j = 0; j < NV; j++) { vage[j] += dt * 1.3; const a = vage[j]; if (a > 1.1) { vcol[j * 3] = vcol[j * 3 + 1] = vcol[j * 3 + 2] = 0; continue; }
        vpos[j * 3] += vvel[j * 3] * dt; vpos[j * 3 + 1] += vvel[j * 3 + 1] * dt; vpos[j * 3 + 2] += vvel[j * 3 + 2] * dt * (1 - a * 0.6); const f = Math.sin(Math.min(1, a) * Math.PI) * 0.22; vcol[j * 3] = f * 0.9; vcol[j * 3 + 1] = f * 0.85; vcol[j * 3 + 2] = f; }
      vap.geometry.attributes.position.needsUpdate = true; vap.geometry.attributes.color.needsUpdate = true; vap.material.size = 0.3 + heat * 0.2;
    }
  } };
}
