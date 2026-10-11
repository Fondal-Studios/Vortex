// Manos y antebrazos en primera persona: guantes tácticos futuristas con placas de cristal, correas,
// costuras luminosas, muñequera con pantallita y tatuajes procedurales (ver handmat.js).
// Coordenadas del arma: x derecha, y arriba, z negativo hacia la boca. Todo va en la capa 'g' (material compartido).
// kind de cada pieza: 0 piel/guante · 1 placa de cristal · 2 correa/armadura · 3 costura luminosa · 4 manga · 7 pantallita
// (+8 en el dedo índice, que se curva en el vértice según el uniforme uTrig).
import * as THREE from 'three';
import { HU } from './handmat.js';

const V = (...a) => new THREE.Vector3(...a);
const SK = 0, CR = 1, AR = 2, LM = 3, SL = 4, SC = 7;
const gr = (x) => { const v = Math.round(Math.min(1, x) * 255); return (v << 16) | (v << 8) | v; }; // gris = tono (el color real lo pone el shader)

/** Antebrazo CORTO: guantelete, correa, pantallita de muñeca, brazalete de armadura abierto por arriba (para el tatuaje) y manga acampanada.
 *  wrist = muñeca · dir = hacia el codo · len = largo total (≈0.3). */
export function forearm(k, wrist, dir, len, r0, r1) {
  const w = V(...wrist), d = V(...dir).normalize(), at = (t) => w.clone().addScaledVector(d, t).toArray();
  const up = V(0, 1, 0).sub(d.clone().multiplyScalar(d.y)).normalize(), side = V().crossVectors(up, d).normalize();
  const rr = (t) => r0 + (r1 - r0) * Math.min(1, t / len), qB = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side.clone().negate(), up, d.clone().negate()));
  const off = (t, h, s = 0) => at(t).map((x, i) => x + up.getComponent(i) * (rr(t) + h) + side.getComponent(i) * s);
  const tD = Math.min(len, 0.1), tA = Math.min(len, 0.26);
  // guantelete (piel/neoprene) hasta mitad del antebrazo, con flujo del tatuaje hacia la mano
  k.limb('g', at(-0.012), at(tA), r0, rr(tA), { c: gr(0.95), k: SK, seg: 9, flow: [0.0, -tA] });
  // muñequera: correa + hebilla
  k.limb('g', at(0.03), at(0.062), r0 * 1.2, r0 * 1.2, { c: gr(0.75), k: AR, seg: 9 });
  k.box('g', [0.012, 0.01, 0.018], off(0.046, 0.0105), { c: gr(1), k: AR, q: qB, rad: 0.003 });
  // pantallita de muñeca (cristal oscuro con píxeles) con marco y luz
  k.box('g', [0.036, 0.007, 0.046], off(0.092, 0.002), { c: gr(0.9), k: AR, q: qB, rad: 0.004 });
  k.box('g', [0.028, 0.006, 0.036], off(0.092, 0.0075), { c: gr(1), k: SC, q: qB, rad: 0.002, flow: [0.0, -0.02, 'z', 0.036] });
  for (const sg of [-1, 1]) k.box('g', [0.0035, 0.0045, 0.04], off(0.092, 0.0065, sg * 0.0185), { c: gr(1), k: LM, q: qB, rad: 0.0012 });
  if (len > 0.14) {
    // brazalete: dos placas laterales + vientre, abierto por el dorso
    const t0 = 0.125, t1 = tA, tm = (t0 + t1) / 2, l = t1 - t0, R = rr(tm);
    for (const sg of [-1, 1]) {
      k.box('g', [0.007, R * 1.05, l], at(tm).map((x, i) => x + side.getComponent(i) * (R + 0.002) * sg - up.getComponent(i) * R * 0.2), { c: gr(0.8), k: AR, q: qB, rad: 0.003 });
      k.box('g', [0.0028, 0.0028, l * 0.98], at(tm).map((x, i) => x + side.getComponent(i) * (R + 0.0058) * sg + up.getComponent(i) * R * 0.28), { c: gr(1), k: LM, q: qB, rad: 0.001, flow: [0.0, -l, 'z', l] });
    }
    k.box('g', [R * 1.3, 0.007, l], at(tm).map((x, i) => x - up.getComponent(i) * (R + 0.002)), { c: gr(0.7), k: AR, q: qB, rad: 0.003 });
    // cristal de dorso
    k.poly('g', 'oct', 0.011, off(0.145, 0.014), { k: CR, s: [1, 0.6, 1.9], q: qB });
  }
  if (len > tA) { // manga acampanada con aro luminoso
    k.limb('g', at(tA - 0.012), at(len), rr(tA) * 1.16, rr(len) * 1.34, { c: gr(1), k: SL, seg: 10, flow: [-tA, -len] });
    k.tor('g', [rr(tA) * 1.17, 0.0028], at(tA - 0.004), { q: new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d), k: LM, seg: 14, c: gr(1) });
  }
}

/**
 * Mano derecha sobre la empuñadura. g = {zc (centro en z), top (y del borde superior), d (profundidad), hw (semiancho)}.
 * Dedos medio/anular/meñique envuelven el frente de la empuñadura con 3 falanges; pulgar sobre el costado del arma.
 * El índice se arma aparte (pieza `trigger`, ver triggerFinger). Devuelve el pivote del índice.
 */
export function rightHand(k, g, hex, { arm = true } = {}) {
  const { zc, top, d, hw } = g, x1 = hw + 0.013, zF = zc - d / 2, zR = zc + d / 2, zW = zR + 0.07;
  const fz = (z0, z1) => [zW - z0, zW - z1]; // flujo por z: u crece hacia el frente
  // talón y palma
  k.box('g', [0.04, 0.118, d + 0.05], [hw + 0.02, top - 0.052, zc + 0.004], { c: gr(0.85), k: SK, rad: 0.014, flow: [...fz(zF - 0.02, zR + 0.03), 'z', d + 0.05] });
  k.box('g', [hw * 2 + 0.03, 0.07, 0.05], [0, top - 0.042, zR + 0.024], { c: gr(0.7), k: SK, rad: 0.012, u: 0.0 });
  // dorso: losa inclinada hacia la cámara + placa de cristal + cresta de nudillos
  k.box('g', [0.05, 0.03, d + 0.07], [hw + 0.026, top - 0.012, zc + 0.012], { c: gr(1), k: SK, r: [0, 0, 0.28], rad: 0.012, flow: [...fz(zF - 0.03, zR + 0.05), 'z', d + 0.07] });
  k.poly('g', 'oct', 0.03, [hw + 0.03, top + 0.0, zc + 0.012], { k: CR, s: [1.0, 0.3, 1.5], r: [0, 0, 0.28] });
  for (let i = 0; i < 4; i++) k.poly('g', 'oct', 0.0105, [hw + 0.021 + 0.007 * (i % 2), top - 0.002 - i * 0.0, zF + 0.012 - 0.0 + i * 0.0 - (i - 1.5) * 0.0], { k: CR, s: [0.8, 0.8, 1.2], r: [0, 0, 0.3] });
  k.box('g', [0.008, 0.07, 0.018], [hw + 0.047, top - 0.044, zF + 0.012], { c: gr(0.8), k: AR, r: [0, 0, 0.1], rad: 0.003 }); // barra de nudillos
  // dedos medio, anular y meñique: 3 falanges con nudillos de cristal y uñas facetadas
  const lens = [1.0, 0.96, 0.82];
  for (let i = 0; i < 3; i++) {
    const y = top - 0.088 - i * 0.027, r = 0.0135 * (1 - i * 0.05), sc = lens[i];
    const A = [x1, y, zR - 0.02], B = [x1 - 0.002, y, zF - 0.006], C = [-hw - 0.012, y, zF - 0.008], D = [-hw - 0.014 * sc, y, zF + 0.026 * sc];
    const u0 = 0.075, u1 = u0 + 0.04, u2 = u1 + 0.04, u3 = u2 + 0.03;
    k.limb('g', A, B, r, r * 0.95, { c: gr(1), k: SK, flow: [u0, u1] }); k.limb('g', B, C, r * 0.95, r * 0.9, { c: gr(1), k: SK, flow: [u1, u2] });
    k.limb('g', C, D, r * 0.9, r * 0.8, { c: gr(1), k: SK, flow: [u2, u3] });
    k.sph('g', r * 1.02, B, { c: gr(0.85), k: SK, u: u1 }); k.sph('g', r * 0.97, C, { c: gr(0.85), k: SK, u: u2 }); k.sph('g', r * 0.84, D, { c: gr(1), k: SK, u: u3 });
    k.poly('g', 'oct', 0.0085, [(B[0] + C[0]) / 2 + 0.006, y + r * 0.75, zF - 0.012], { k: CR, s: [1.5, 0.45, 1], r: [0, 0, 0] }); // placa de la falange media
    k.poly('g', 'tet', 0.0085, [D[0] - 0.003, y + r * 0.85, D[2] - 0.004], { k: CR, s: [0.8, 0.5, 1.6], r: [0.3, 0, 0] });        // uña
    k.poly('g', 'oct', 0.0095, [A[0] + 0.004, y + 0.001, A[2] - 0.004], { k: CR, s: [0.6, 1, 1] });                             // nudillo
  }
  // correa transversal sobre los dedos (en la zona visible, bajo el guardamonte) con costura luminosa
  k.box('g', [hw * 2 + 0.04, 0.009, 0.01], [0, top - 0.145, zF - 0.017], { c: gr(0.8), k: AR, rad: 0.003 });
  // pulgar: tres falanges a lo largo del costado izquierdo del arma
  const m0 = [-hw - 0.006, top - 0.018, zR + 0.0], th1 = [-hw - 0.022, top + 0.004, zc + d * 0.08], th2 = [-hw - 0.028, top + 0.013, zc - d * 0.32], th3 = [-hw - 0.027, top + 0.018, zF - 0.032];
  k.sph('g', 0.023, [-hw - 0.012, top - 0.026, zR - 0.004], { c: gr(0.85), k: SK, u: 0.0 }); // montículo del pulgar
  k.limb('g', m0, th1, 0.0178, 0.0155, { c: gr(1), k: SK, flow: [0.02, 0.06] }); k.limb('g', th1, th2, 0.0155, 0.0138, { c: gr(1), k: SK, flow: [0.06, 0.1] }); k.limb('g', th2, th3, 0.0138, 0.0122, { c: gr(1), k: SK, flow: [0.1, 0.13] });
  k.sph('g', 0.0155, th1, { c: gr(0.85), k: SK, u: 0.06 }); k.sph('g', 0.0138, th2, { c: gr(0.85), k: SK, u: 0.1 }); k.sph('g', 0.0122, th3, { c: gr(1), k: SK, u: 0.13 });
  k.poly('g', 'oct', 0.011, [th3[0], th3[1] + 0.011, th3[2] - 0.006], { k: CR, s: [0.9, 0.4, 1.6] });
  k.poly('g', 'oct', 0.012, [th2[0] + 0.001, th2[1] + 0.012, th2[2] + 0.012], { k: CR, s: [0.9, 0.4, 1.7] });
  k.box('g', [0.014, 0.006, 0.05], [th1[0] - 0.0, th1[1] + 0.017, (th1[2] + th2[2]) / 2 + 0.02], { c: gr(0.8), k: AR, r: [0.05, 0, 0.1], rad: 0.002 });
  if (arm) forearm(k, [hw + 0.03, top - 0.06, zR + 0.06], [0.3, -0.45, 1], 0.34, 0.024, 0.031);
  return [x1, top - 0.027, zR - 0.006];
}

/** Dedo índice: pieza con pivote en el nudillo (`k.part('trigger', pivot)` antes). Mide ≈0.125 hacia -Z y se curva solo en el shader:
 *  pasar `P.trigger.userData.curl = 0..1` con trigCurl(). `reach` queda por compatibilidad. */
export function triggerFinger(k, g, pivot, reach) { // eslint-disable-line no-unused-vars
  const IK = 8; // kind del índice = 8 + clase
  k.at(pivot, [0, 0.17, 0], () => {
    const r = 0.0125, P0 = [0, 0, 0], P1 = [0, 0, -0.05], P2 = [0, 0, -0.088], P3 = [0, 0, -0.122];
    k.limb('g', P0, P1, r, r * 0.94, { c: gr(1), k: IK + SK, flow: [0.085, 0.135] }); k.limb('g', P1, P2, r * 0.94, r * 0.88, { c: gr(1), k: IK + SK, flow: [0.135, 0.175] });
    k.limb('g', P2, P3, r * 0.88, r * 0.78, { c: gr(1), k: IK + SK, flow: [0.175, 0.21] });
    k.sph('g', r * 1.03, P0, { c: gr(0.85), k: IK + SK, u: 0.085 }); k.sph('g', r * 0.97, P1, { c: gr(0.85), k: IK + SK, u: 0.135 }); k.sph('g', r * 0.9, P2, { c: gr(0.85), k: IK + SK, u: 0.175 }); k.sph('g', r * 0.78, P3, { c: gr(1), k: IK + SK, u: 0.21 });
    k.poly('g', 'oct', 0.0105, [0, r * 0.9, -0.025], { k: IK + CR, s: [1, 0.5, 1.5] }); k.poly('g', 'oct', 0.0085, [0, r * 0.82, -0.073], { k: IK + CR, s: [1, 0.5, 1.3] });
    k.poly('g', 'tet', 0.009, [0, r * 0.7, -0.124], { k: IK + CR, s: [0.8, 0.5, 1.6], r: [0.3, 0, 0] });
    k.box('g', [0.02, 0.006, 0.014], [0, r * 0.95, -0.0], { c: gr(0.8), k: IK + AR, rad: 0.002 });
  });
  return g.top;
}

/** Fija el curvado del índice (0..1) en la pieza `trigger` de un arma. */
export function trigCurl(P, c) { if (P.trigger) P.trigger.userData.curl = c; }
/** Conecta la curva del índice al dibujo (el material es compartido): se llama una vez tras construir las piezas. */
export function bindTrigger(P) {
  if (!P.trigger) return;
  P.trigger.userData.curl = 0;
  P.trigger.traverse((o) => { if (o.isMesh) o.onBeforeRender = () => { HU.uTrig.value = P.trigger.userData.curl || 0; }; });
}

/**
 * Mano izquierda de apoyo: agarre en "C" alrededor de un tubo.
 * c = [x,y,z] centro del tubo, R = radio del tubo, axis = 'z' (guardamanos) o 'y' (empuñadura vertical).
 * Los dedos (3 falanges con nudillos y uñas de cristal) pasan por debajo y suben por la derecha; el pulgar queda encima.
 */
export function supportHand(k, c, R, hex, { axis = 'z', arm = true, spread = 1, flip = 1 } = {}) {
  const rot = axis === 'y' ? new THREE.Euler(Math.PI / 2, 0, 0) : new THREE.Euler(0, 0, 0), Rf = R + 0.012, r = 0.0125;
  const a0 = THREE.MathUtils.degToRad(-128), a1 = THREE.MathUtils.degToRad(35);
  k.at(c, [rot.x, rot.y, rot.z], () => {
    for (let i = 0; i < 4; i++) {
      const z = (-0.034 + i * 0.0225) * spread, ri = r * (1 - Math.abs(i - 1) * 0.04), end = a1 - (i === 3 ? 0.35 : 0);
      const pts = k.arc('g', 0, 0, Rf, a0, end, z, ri, 5, { c: gr(1), k: SK, flow: [0.0, 0.18] });
      const t = pts[pts.length - 1], kn = pts[1], mid = pts[3];
      k.poly('g', 'tet', 0.0085, [t[0] + 0.004, t[1] + 0.002, z], { k: CR, s: [1.5, 0.8, 0.6], r: [0, 0, end + 0.3] });  // uña
      k.poly('g', 'oct', 0.0095, [kn[0] - 0.006, kn[1] - 0.008, z], { k: CR, s: [1, 0.55, 1], r: [0, 0, a0 + Math.PI / 2] }); // nudillo
      k.poly('g', 'oct', 0.0075, [mid[0] + 0.004, mid[1] + 0.005, z], { k: CR, s: [1.2, 0.4, 0.9], r: [0, 0, 0.9] });
    }
    // palma bajo el tubo y talón de la mano
    const pa = THREE.MathUtils.degToRad(-150);
    k.box('g', [0.058, 0.034, 0.1], [Math.cos(pa) * (Rf + 0.012), Math.sin(pa) * (Rf + 0.012), 0.002], { c: gr(0.85), k: SK, r: [0, 0, pa + Math.PI / 2], rad: 0.014, flow: [0.0, 0.1, 'z', 0.1] });
    k.poly('g', 'oct', 0.026, [Math.cos(pa - 0.12) * (Rf + 0.03), Math.sin(pa - 0.12) * (Rf + 0.03), 0.002], { k: CR, s: [1.2, 0.3, 1.7], r: [0, 0, pa + Math.PI / 2 - 0.12] });
    k.box('g', [0.052, 0.008, 0.012], [Math.cos(pa + 0.25) * (Rf + 0.026), Math.sin(pa + 0.25) * (Rf + 0.026), -0.034], { c: gr(0.8), k: AR, r: [0, 0, pa + Math.PI / 2 + 0.25], rad: 0.002 }); // correa
    // pulgar por encima, hacia adelante (3 falanges)
    const t0 = [-Rf * 0.62, Rf * 0.9, 0.05], t1 = [-Rf * 0.3, Rf * 1.12, -0.012], t2 = [-Rf * 0.08, Rf * 1.1, -0.07];
    k.limb('g', t0, t1, 0.0168, 0.0148, { c: gr(1), k: SK, ball: true, flow: [0.02, 0.1] }); k.limb('g', t1, t2, 0.0148, 0.0128, { c: gr(1), k: SK, ball: true, flow: [0.1, 0.16] });
    k.poly('g', 'oct', 0.011, [t2[0], t2[1] + 0.009, t2[2] - 0.004], { k: CR, s: [0.9, 0.4, 1.6] });
    k.poly('g', 'oct', 0.011, [t1[0], t1[1] + 0.014, t1[2] + 0.02], { k: CR, s: [0.9, 0.4, 1.6] });
    if (arm) forearm(k, [Math.cos(pa) * (Rf + 0.025), Math.sin(pa) * (Rf + 0.025), 0.06], [-0.34 * flip, -0.3, 1], 0.34, 0.025, 0.032);
  });
}
