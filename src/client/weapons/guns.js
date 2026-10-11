// Las cinco armas psicodélicas. Cada función devuelve un "arma" lista para usar:
//   { group, muzzle, eject, flash, recoil, view, update(dt,t,firing), fire(ctx), setAmmo(n,max), dispose() }
// Origen en la empuñadura, boca hacia -Z, y hacia arriba, x hacia la derecha.
import * as THREE from 'three';
import { Kit, makeMats, AmmoScreen, tint } from './kit.js';
import { rightHand, triggerFinger, supportHand } from './hands.js';

export const WEAPON_COLORS = [0x66ffee, 0xff8fd0, 0xffd34a, 0xff7a45, 0xa98bff];
export const WEAPON_LABELS = ['HAZ', 'PRISMA', 'RÁFAGA', 'NOVA', 'AGUJA'];

const DARK = 0x16121f, GUN = 0x2a2540, STEEL = 0x9aa0c4, PALE = 0xd5d9ff;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const easeInOut = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

/** Resorte amortiguado (para culatazos y correderas), con subpasos estables. */
class Spring {
  constructor(k, c) { this.x = 0; this.v = 0; this.k = k; this.c = c; }
  step(dt) { let n = Math.max(1, Math.ceil(dt / 0.006)); const h = dt / n; while (n--) { this.v += (-this.k * this.x - this.c * this.v) * h; this.x += this.v * h; } return this.x; }
}

/** Color anodizado saturado: mismo tono, saturación alta y luminosidad fija (en sRGB). */
function vivid(hex, l) { const hsl = {}; new THREE.Color(hex).getHSL(hsl, THREE.SRGBColorSpace); return new THREE.Color().setHSL(hsl.h, 0.95, l, THREE.SRGBColorSpace).getHex(); }
function newGun(index, q) {
  const hex = WEAPON_COLORS[index], k = new Kit(q), mats = makeMats(q, hex), scr = new AmmoScreen(hex, WEAPON_LABELS[index]);
  return { hex, k, mats, scr, B: vivid(hex, 0.46), B2: vivid(hex, 0.3), A: vivid(new THREE.Color(hex).offsetHSL(0.5, 0, 0).getHex(), 0.4), q, heat: 0, boost: 0, ammo: 1 };
}
/** Ranuras de ventilación. */
function vents(k, n, [x, y, z], [w, h, d], step, c = DARK, axis = 'z') {
  for (let i = 0; i < n; i++) { const o = i * step; k.box('b', [w, h, d], axis === 'z' ? [x, y, z - o] : [x, y - o, z], { c, rad: 0.0015 }); }
}
const screw = (k, pos, axis = 'x', r = 0.0045) => k.cyl('b', [r, r, 0.004], pos, { axis, seg: 6, c: STEEL });
/** Pantalla en una cara: posición, normal inclinada. */
function placeScreen(G, parent, pos, rot, scale = 1) {
  const m = G.scr.mesh; m.position.set(...pos); m.rotation.set(...rot); m.scale.setScalar(scale); parent.add(m);
}
/** Marco oscuro para la pantalla. */
function bezel(k, pos, rot, w, h) { k.box('b', [w, h, 0.006], pos, { c: DARK, r: rot, rad: 0.002 }); }
function finalize(G, W) {
  W.setAmmo = (n, max) => { G.scr.set(n, max); G.ammo = Number.isFinite(n) && Number.isFinite(max) && max > 0 ? clamp(n / max, 0, 1) : 1; };
  W.dispose = () => { G.mats.dispose(); G.scr.dispose(); W.group.traverse((o) => { if (o.isMesh && o.geometry && o !== G.scr.mesh) o.geometry.dispose(); }); };
  W.mats = G.mats; W.G = G; return W;
}
function addParts(G, group, names) {
  const out = {}; for (const n of names) { out[n] = G.k.build(n, G.mats); group.add(out[n]); out[n].userData.base = out[n].position.clone(); } return out;
}

/* ═════════════════════════════ 0 · HAZ — pistola de prisma ═════════════════════════════ */
export function haz(q, hands) {
  const G = newGun(0, q), { k, hex, B, B2 } = G, group = new THREE.Group();
  // — armazón fijo
  k.part('main');
  k.prof('b', [[0.3, 0], [0.3, -0.03], [0.14, -0.036], [0.14, 0]], 0.044, 0, { c: DARK });                                  // riel inferior
  k.prof('b', [[0.14, 0], [0.14, -0.07], [0.02, -0.07], [0.02, 0], [0.032, 0], [0.032, -0.058], [0.128, -0.058], [0.128, 0]], 0.03, 0, { c: GUN }); // guardamonte
  k.box('b', [0.012, 0.034, 0.01], [0, -0.04, -0.06], { c: PALE, r: [0.3, 0, 0] });                                       // gatillo
  k.prof('b', [[-0.06, 0], [0.036, 0], [0.032, -0.2], [-0.1, -0.2], [-0.085, -0.04]], 0.042, 0, { c: DARK });              // empuñadura
  if (q.detail) for (let i = 0; i < 6; i++) k.box('b', [0.045, 0.0035, 0.1 - i * 0.004], [0, -0.05 - i * 0.025, 0.026 + i * 0.006], { c: 0x0a0712, rad: 0.001 });
  k.box('l', [0.004, 0.11, 0.012], [-0.0235, -0.115, -0.035 + 0.0], { k: 0 });                                              // vena de energía en la empuñadura
  k.box('b', [0.05, 0.012, 0.125], [0, -0.205, 0.045], { c: GUN, rad: 0.004 });                                             // base del cargador
  for (let i = 0; i < 3; i++) k.box('l', [0.005, 0.008, 0.012], [-0.0225, -0.013, -0.1 - i * 0.02], { k: 2 });             // luces de estado
  k.cyl('b', [0.016, 0.016, 0.2], [0, 0.03, -0.4], { c: GUN });                                                           // cañón
  k.cyl('b', [0.024, 0.026, 0.07], [0, 0.03, -0.43], { c: B, seg: 6 });                                                   // carcasa hexagonal
  k.cyl('l', [0.009, 0.012, 0.012], [0, 0.03, -0.505], { k: 1 });                                                         // emisor
  k.poly('b', 'tet', 0.009, [0, 0.082, -0.335], { c: PALE, s: [0.7, 1.4, 0.8] });                                          // punto de mira
  const gh = { zc: 0.02, top: -0.012, d: 0.105, hw: 0.021 };
  let pivot = null; if (hands) pivot = rightHand(k, gh, hex);
  // — corredera (retrocede al disparar) con prisma central, ventana de líquido y pantalla
  k.part('slide', [0, 0.03, 0]);
  k.prof('b', [[-0.14, 0.072], [0.3, 0.072], [0.355, 0.05], [0.355, 0], [-0.14, 0], [-0.165, 0.03]], 0.05, 0, { c: B });
  k.box('b', [0.003, 0.034, 0.168], [-0.0257, 0.036, -0.1], { c: DARK, rad: 0.001 }); k.box('l', [0.004, 0.026, 0.15], [-0.0268, 0.036, -0.1], { k: 0 });
  k.box('b', [0.003, 0.034, 0.168], [0.0257, 0.036, -0.1], { c: DARK, rad: 0.001 }); k.box('l', [0.004, 0.026, 0.15], [0.0268, 0.036, -0.1], { k: 0 });
  k.cyl('l', [0.024, 0.024, 0.14], [0, 0.1, -0.15], { k: 1, seg: 6 });                                                      // prisma
  k.cyl('l', [0.002, 0.024, 0.07], [0, 0.1, -0.255], { k: 1, seg: 6 }); k.cyl('l', [0.024, 0.002, 0.05], [0, 0.1, -0.045], { k: 1, seg: 6 });
  for (const z of [-0.06, -0.15, -0.245]) { k.box('b', [0.06, 0.034, 0.014], [0, 0.088, z], { c: GUN }); screw(k, [0.03, 0.088, z], 'x'); }
  if (q.detail) vents(k, 5, [0, 0.036, 0.1], [0.054, 0.04, 0.004], 0.014, 0x0e0a18);                                         // estrías traseras
  bezel(k, [0, 0.0735, 0.068], [-Math.PI / 2 + 0.34, 0, 0], 0.05, 0.034);
  // — anillo de emisión (gira) con gemas
  k.part('ring', [0, 0.03, -0.47]);
  k.tor('l', [0.04, 0.0055], [0, 0.03, -0.47], { k: 0, seg: 6 });
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; k.poly('l', 'oct', 0.0075, [Math.cos(a) * 0.04, 0.03 + Math.sin(a) * 0.04, -0.47], { k: 1, r: [0, 0, a], s: [0.8, 1.5, 0.8] }); }
  // — dedo índice
  if (hands) { k.part('trigger', pivot); triggerFinger(k, gh, pivot, 0.02); }

  const P = addParts(G, group, ['main', 'slide', 'ring', ...(hands ? ['trigger'] : [])]);
  placeScreen(G, P.slide, [0, 0.0775 - 0.03, 0.068], [-Math.PI / 2 + 0.34, 0, 0], 0.88);
  const sl = new Spring(1100, 44), curl = { v: 0 }; let ringW = 3, ringA = 0;
  const W = {
    group, muzzle: [0, 0.03, -0.52], eject: [0.03, 0.07, 0.02], flash: { shape: 'star', size: 0.5, decay: 13 },
    recoil: { z: 0.07, y: 0.012, pitch: 0.2, roll: 0.025, k: 210, c: 17 }, view: { pos: [0.3, -0.19, -0.5], scale: 0.78, zs: 0.8, rot: [0.0, 0.04, 0] },
    update(dt, t, firing) {
      sl.step(dt); P.slide.position.z = P.slide.userData.base.z + clamp(sl.x, -0.01, 0.06);
      G.heat = Math.max(0, G.heat - dt * 0.55); G.boost = Math.max(0, G.boost - dt * 7);
      ringW = damp(ringW, firing ? 16 : 3.2, 4, dt); ringA += ringW * dt; P.ring.rotation.z = ringA;
      curl.v = Math.max(curl.v - dt * 9, firing ? 0.35 : 0); if (P.trigger) P.trigger.rotation.x = -curl.v * 0.5;
      G.mats.set(t, G.heat, -9, G.ammo, G.boost); G.scr.update(t);
    },
    fire(ctx) {
      sl.v += 2.4; G.heat = Math.min(1, G.heat + 0.38); G.boost = 1; curl.v = 1; ringW += 12;
      if (ctx) { ctx.shard([0.03, 0.07, 0.02], [0.9, 1.1, 0.5], hex, 0.8); ctx.puff([0, 0.03, -0.5], [0, 0.04, -0.2], hex, { size: 0.09, grow: 0.28, life: 0.35, alpha: 0.5 }); ctx.puff([0, 0.1, -0.2], [0, 0.18, 0.02], 0xffffff, { size: 0.05, grow: 0.12, life: 0.3, alpha: 0.28 }); }
    },
  };
  return finalize(G, W);
}

/* ═════════════════════════════ 1 · PRISMA — escopeta de corredera ═════════════════════════════ */
export function prisma(q, hands) {
  const G = newGun(1, q), { k, hex, B } = G, group = new THREE.Group();
  k.part('main');
  k.prof('b', [[-0.17, 0.075], [0.12, 0.088], [0.155, 0.062], [0.155, -0.015], [0.0, -0.032], [-0.17, -0.012]], 0.062, 0, { c: B });                    // receptor
  k.box('b', [0.034, 0.01, 0.3], [0, 0.0955, 0.0], { c: GUN });                                                                                         // riel superior
  if (q.detail) for (let i = 0; i < 7; i++) k.box('b', [0.036, 0.004, 0.008], [0, 0.102, 0.12 - i * 0.04], { c: DARK });
  k.tor('b', [0.014, 0.0035], [0, 0.118, 0.13], { c: PALE }); k.poly('b', 'tet', 0.012, [0, 0.1, -0.64], { c: PALE, s: [0.6, 1.5, 0.7] });                // alza y punto de mira
  k.box('b', [0.004, 0.034, 0.088], [0.0315, 0.04, 0.0], { c: DARK }); k.box('l', [0.0035, 0.014, 0.06], [0.0325, 0.04, 0.0], { k: 0 });               // puerto de eyección
  k.box('b', [0.004, 0.044, 0.1], [-0.0315, 0.035, -0.04], { c: DARK });
  for (let i = 0; i < 3; i++) k.box('l', [0.005, 0.008, 0.014], [-0.034, 0.03 + i * 0.012, -0.075], { k: 2 });                                        // luces
  bezel(k, [-0.0325, 0.035, 0.115], [0, -Math.PI / 2 + 0.3, 0], 0.07, 0.04);
  // culata esquelética con cristal
  k.prof('b', [[-0.17, 0.07], [-0.46, 0.035], [-0.5, -0.02], [-0.5, -0.11], [-0.43, -0.135], [-0.3, -0.05], [-0.17, -0.02]], 0.045, 0, { c: DARK, holes: [[[-0.22, 0.04], [-0.4, 0.022], [-0.44, -0.04], [-0.3, -0.016]]] });
  k.poly('l', 'oct', 0.034, [0, 0.0, 0.32], { k: 1, s: [0.5, 0.55, 1.6], r: [0.1, 0, 0] });
  k.box('l', [0.048, 0.125, 0.012], [0, -0.05, 0.507], { k: 0 }); k.box('b', [0.05, 0.13, 0.008], [0, -0.05, 0.518], { c: GUN });
  // empuñadura y guardamonte
  k.prof('b', [[-0.065, -0.03], [0.04, -0.03], [0.034, -0.2], [-0.085, -0.2]], 0.044, 0, { c: DARK });
  k.prof('b', [[0.15, -0.03], [0.15, -0.075], [0.0, -0.075], [0.0, -0.03], [0.012, -0.03], [0.012, -0.063], [0.138, -0.063], [0.138, -0.03]], 0.03, 0, { c: GUN });
  k.box('b', [0.012, 0.036, 0.01], [0, -0.05, -0.085], { c: PALE, r: [0.25, 0, 0] });
  k.box('l', [0.004, 0.1, 0.012], [-0.0235, -0.12, -0.03], { k: 0 });
  // tres cañones en triángulo (9 perdigones) con abrazaderas
  const tubes = [[0, 0.052], [-0.022, 0.017], [0.022, 0.017]];
  for (const [x, y] of tubes) { k.cyl('b', [0.0185, 0.0185, 0.6], [x, y, -0.42], { c: GUN }); k.cyl('l', [0.012, 0.012, 0.006], [x, y, -0.722], { k: 0, seg: 8 }); }
  for (const z of [-0.2, -0.36, -0.52]) { k.cyl('b', [0.052, 0.052, 0.022], [0, 0.03, z], { c: B, seg: 6 }); k.tor('l', [0.052, 0.0025], [0, 0.03, z - 0.011], { seg: 6, k: 0 }); }
  // tubo del cargador: cristal líquido entre anillos de acero
  k.limb('l', [0, -0.02, -0.14], [0, -0.02, -0.64], 0.0135, 0.0135, { k: 0, seg: 8 });
  for (const z of [-0.12, -0.64]) k.cyl('b', [0.022, 0.022, 0.03], [0, -0.02, z], { c: PALE, seg: 10 });
  for (const z of [-0.2, -0.5, -0.56]) k.cyl('b', [0.0195, 0.0195, 0.012], [0, -0.02, z], { c: DARK, seg: 10 });
  const gh = { zc: 0.0, top: -0.03, d: 0.115, hw: 0.022 };
  let pivot = null; if (hands) pivot = rightHand(k, gh, hex);
  // corredera con la mano izquierda
  k.part('pump', [0, -0.02, -0.34]);
  k.cyl('b', [0.036, 0.036, 0.2], [0, -0.02, -0.34], { c: B });
  for (let i = 0; i < 6; i++) k.cyl('b', [0.0385, 0.0385, 0.008], [0, -0.02, -0.26 - i * 0.032], { c: DARK });
  k.box('l', [0.0035, 0.012, 0.15], [-0.0375, -0.02, -0.34], { k: 0 }); k.box('l', [0.0035, 0.012, 0.15], [0.0375, -0.02, -0.34], { k: 0 });
  if (hands) supportHand(k, [0, -0.02, -0.34], 0.036, hex);
  // anillo-prisma del extremo que gira
  k.part('fan', [0, 0.03, -0.66]);
  k.tor('l', [0.056, 0.0065], [0, 0.03, -0.66], { k: 0, seg: 6 });
  for (let i = 0; i < 9; i++) { const a = i * Math.PI * 2 / 9; k.poly('l', 'oct', 0.0075, [Math.cos(a) * 0.056, 0.03 + Math.sin(a) * 0.056, -0.66], { k: 1, r: [0, 0, a], s: [0.8, 1.6, 0.8] }); }
  if (hands) { k.part('trigger', pivot); triggerFinger(k, gh, pivot, 0.03); }

  const P = addParts(G, group, ['main', 'pump', 'fan', ...(hands ? ['trigger'] : [])]);
  placeScreen(G, P.main, [-0.0345, 0.035, 0.115], [0, -Math.PI / 2 + 0.3, 0], 1.25);
  let pumpT = -1, fanW = 2, fanA = 0, curl = 0, ejectDone = true; const kick = new Spring(180, 15);
  const W = {
    group, muzzle: [0, 0.03, -0.74], eject: [0.034, 0.05, 0.0], flash: { shape: 'fan', size: 1.0, decay: 9 },
    recoil: { z: 0.17, y: 0.035, pitch: 0.4, roll: 0.045, k: 120, c: 11 }, view: { pos: [0.31, -0.2, -0.5], scale: 0.62, zs: 0.6, rot: [0.02, 0.0, 0] },
    update(dt, t, firing) {
      kick.step(dt);
      let off = 0;
      if (pumpT >= 0) { pumpT += dt; const p = (pumpT - 0.16) / 0.46; // espera, atrás, adelante
        if (p >= 0 && p < 1) off = p < 0.45 ? easeOut(p / 0.45) : 1 - easeInOut((p - 0.45) / 0.55);
        if (p > 0.4 && !ejectDone && W._ctx) { ejectDone = true; const c = W._ctx; c.shard([0.034, 0.05, 0.0], [1.4, 1.5, 0.6], hex, 2.2); c.shard([0.034, 0.05, 0.0], [1.0, 1.9, 0.9], 0xffffff, 1.2); c.puff([0.04, 0.05, 0.0], [0.25, 0.3, 0.1], hex, { size: 0.07, grow: 0.2, life: 0.4, alpha: 0.35 }); }
        if (p >= 1) pumpT = -1; }
      P.pump.position.z = P.pump.userData.base.z + off * 0.115;
      G.heat = Math.max(0, G.heat - dt * 0.4); G.boost = Math.max(0, G.boost - dt * 6);
      fanW = damp(fanW, firing ? 12 : 1.8, 3, dt); fanA += fanW * dt; P.fan.rotation.z = fanA;
      curl = Math.max(curl - dt * 8, firing ? 0.3 : 0); if (P.trigger) P.trigger.rotation.x = -curl * 0.5;
      G.mats.set(t, G.heat, -9, G.ammo, G.boost); G.scr.update(t);
    },
    fire(ctx) {
      G.heat = Math.min(1, G.heat + 0.7); G.boost = 1; curl = 1; fanW += 20; pumpT = 0; ejectDone = false; W._ctx = ctx; kick.v += 1.0;
      if (ctx) for (let i = 0; i < 3; i++) ctx.puff([(i - 1) * 0.02, 0.03, -0.73], [(i - 1) * 0.18, 0.05, -0.5], hex, { size: 0.1, grow: 0.35, life: 0.45, alpha: 0.45 });
    },
  };
  return finalize(G, W);
}

/* ═════════════════════════════ 2 · RÁFAGA — rotativa automática ═════════════════════════════ */
export function rafaga(q, hands) {
  const G = newGun(2, q), { k, hex, B } = G, group = new THREE.Group();
  k.part('main');
  k.prof('b', [[-0.2, 0.087], [0.2, 0.097], [0.245, 0.07], [0.245, -0.025], [0.0, -0.036], [-0.2, -0.015]], 0.07, 0, { c: B });                          // receptor
  k.prof('b', [[-0.08, 0.097], [-0.055, 0.15], [0.14, 0.15], [0.17, 0.097]], 0.028, 0, { c: GUN, holes: [[[-0.04, 0.108], [-0.028, 0.138], [0.12, 0.138], [0.14, 0.108]]] }); // asa de transporte
  k.cyl('l', [0.017, 0.017, 0.008], [0, 0.124, -0.16], { k: 1, seg: 10 });                                                                            // lente
  k.box('b', [0.03, 0.02, 0.05], [0, 0.103, -0.2], { c: GUN });
  k.prof('b', [[-0.2, 0.075], [-0.4, 0.04], [-0.42, -0.06], [-0.3, -0.07], [-0.2, -0.02]], 0.05, 0, { c: DARK });                                       // culata
  k.box('l', [0.046, 0.1, 0.01], [0, -0.01, 0.425], { k: 0 }); k.box('b', [0.05, 0.11, 0.008], [0, -0.01, 0.436], { c: GUN });
  k.prof('b', [[-0.06, -0.03], [0.045, -0.03], [0.035, -0.19], [-0.08, -0.19]], 0.045, 0, { c: DARK });
  k.prof('b', [[0.18, -0.025], [0.18, -0.07], [0.04, -0.07], [0.04, -0.025], [0.052, -0.025], [0.052, -0.058], [0.168, -0.058], [0.168, -0.025]], 0.03, 0, { c: GUN });
  k.box('b', [0.012, 0.034, 0.01], [0, -0.048, -0.03], { c: PALE, r: [0.25, 0, 0] });
  // tambor de munición bajo el arma (cristal visible por la tapa)
  k.cyl('b', [0.078, 0.078, 0.07], [0, -0.1, -0.16], { axis: 'x', c: GUN });
  k.cyl('b', [0.08, 0.08, 0.012], [0.039, -0.1, -0.16], { axis: 'x', c: B, seg: q.high ? 16 : 10 });
  k.cyl('l', [0.052, 0.052, 0.004], [-0.0365, -0.1, -0.16], { axis: 'x', k: 1, seg: 14 });
  k.cyl('b', [0.082, 0.082, 0.014], [-0.039, -0.1, -0.16], { axis: 'x', c: B, seg: q.high ? 16 : 10, open: true });
  // carcasa (fija) con aletas, anillos de luz y ranuras de calor
  k.cyl('b', [0.052, 0.054, 0.17], [0, 0.045, -0.325], { c: B });
  for (let i = 0; i < 5; i++) k.cyl('b', [0.0555, 0.0555, 0.01], [0, 0.045, -0.26 - i * 0.032], { c: DARK });
  k.tor('l', [0.054, 0.0035], [0, 0.045, -0.248], { k: 0 }); k.tor('l', [0.054, 0.0035], [0, 0.045, -0.405], { k: 0 });
  for (const x of [-0.0535, 0.0535]) k.box('l', [0.004, 0.02, 0.1], [x, 0.045, -0.33], { k: 0 });
  vents(k, 4, [0, 0.0985, 0.1], [0.05, 0.003, 0.014], 0.035, DARK); k.box('b', [0.06, 0.03, 0.02], [0, 0.068, -0.21], { c: GUN });
  k.box('b', [0.004, 0.034, 0.09], [0.0365, 0.045, -0.01], { c: DARK }); k.box('l', [0.0035, 0.012, 0.05], [0.0375, 0.045, -0.01], { k: 0 });
  for (let i = 0; i < 3; i++) k.box('l', [0.005, 0.008, 0.014], [-0.0365, 0.02, -0.1 - i * 0.022], { k: 2 });
  bezel(k, [-0.0365, 0.056, 0.115], [0, -Math.PI / 2 + 0.3, 0], 0.075, 0.042);
  const gh = { zc: 0.015, top: -0.03, d: 0.115, hw: 0.0225 };
  let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.045, -0.325], 0.053, hex); }
  // cañones giratorios (6 + eje de energía)
  k.part('barrels', [0, 0.045, -0.5]);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const x = Math.cos(a) * 0.031, y = 0.045 + Math.sin(a) * 0.031; k.cyl('b', [0.0105, 0.0105, 0.34], [x, y, -0.58], { c: i % 2 ? GUN : STEEL, seg: 8 }); k.cyl('l', [0.007, 0.007, 0.006], [x, y, -0.752], { k: i % 2 ? 1 : 0, seg: 6 }); }
  k.limb('l', [0, 0.045, -0.4], [0, 0.045, -0.745], 0.0095, 0.0095, { k: 0, seg: 8 });
  for (const z of [-0.43, -0.6, -0.72]) { k.cyl('b', [0.047, 0.047, 0.018], [0, 0.045, z], { c: B, seg: 12 }); k.tor('l', [0.047, 0.0022], [0, 0.045, z - 0.009], { k: 0, seg: 12 }); }
  // tambor interior que gira al disparar
  k.part('drum', [0, -0.1, -0.16]);
  for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; k.poly('l', 'oct', 0.0095, [-0.0385, -0.1 + Math.sin(a) * 0.037, -0.16 + Math.cos(a) * 0.037], { k: 1, s: [0.7, 1.2, 1.2], r: [a, 0, 0] }); }
  if (hands) { k.part('trigger', pivot); triggerFinger(k, gh, pivot, 0.03); }

  const P = addParts(G, group, ['main', 'barrels', 'drum', ...(hands ? ['trigger'] : [])]);
  placeScreen(G, P.main, [-0.0395, 0.056, 0.115], [0, -Math.PI / 2 + 0.3, 0], 1.3);
  let w = 0, ang = 0, curl = 0, shake = 0, wd = 0, sinceShot = 9; const sx = new Spring(400, 20);
  const W = {
    group, muzzle: [0, 0.045, -0.77], eject: [0.037, 0.045, 0.02], flash: { shape: 'jet', size: 0.5, decay: 26 },
    recoil: { z: 0.026, y: 0.004, pitch: 0.045, roll: 0.012, k: 300, c: 22 }, view: { pos: [0.3, -0.2, -0.5], scale: 0.62, zs: 0.65, rot: [0.02, 0.0, 0] },
    update(dt, t, firing) {
      sinceShot += dt; const spin = firing || sinceShot < 0.18;
      w = damp(w, spin ? 42 : 0, spin ? 5 : 1.4, dt); ang += w * dt; P.barrels.rotation.z = -ang; wd = damp(wd, w * 0.25, 4, dt); P.drum.rotation.x += wd * dt;
      shake = Math.max(0, shake - dt * 14); sx.step(dt);
      P.barrels.position.x = P.barrels.userData.base.x + (Math.random() - 0.5) * 0.0025 * shake; P.barrels.position.y = P.barrels.userData.base.y + (Math.random() - 0.5) * 0.0025 * shake;
      P.main.position.z = clamp(sx.x, -0.01, 0.03) * 0.6;
      G.heat = Math.max(0, G.heat - dt * 0.3); G.boost = Math.max(0, G.boost - dt * 9);
      curl = Math.max(curl - dt * 14, firing ? 0.8 : 0); if (P.trigger) P.trigger.rotation.x = -curl * 0.5;
      G.mats.set(t, G.heat + w / 160, -9, G.ammo, G.boost * 0.7); G.scr.update(t);
    },
    fire(ctx) {
      G.heat = Math.min(1, G.heat + 0.05); G.boost = 1; shake = 1; sinceShot = 0; w = Math.min(46, w + 6); sx.v += 0.5; curl = 1;
      if (ctx) { ctx.shard([0.037, 0.045, 0.02], [0.9 + Math.random() * 0.5, 0.7 + Math.random() * 0.8, 0.5 + Math.random() * 0.6], hex, 0.75); if (Math.random() < 0.4) ctx.puff([0, 0.045, -0.76], [0, 0.03, -0.1], hex, { size: 0.06, grow: 0.2, life: 0.28, alpha: 0.28 }); }
    },
  };
  return finalize(G, W);
}

/* ═════════════════════════════ 3 · NOVA — lanzacohetes ═════════════════════════════ */
export function nova(q, hands) {
  const G = newGun(3, q), { k, hex, B } = G, group = new THREE.Group();
  k.part('main');
  k.cyl('b', [0.07, 0.07, 0.6], [0, 0.07, -0.2], { c: B, seg: q.high ? 20 : 12 });                                                                      // tubo principal
  for (const z of [0.0, -0.1, -0.3, -0.38]) { k.cyl('b', [0.0745, 0.0745, 0.014], [0, 0.07, z], { c: GUN, seg: q.high ? 20 : 12 }); k.tor('l', [0.0745, 0.0028], [0, 0.07, z - 0.007], { k: 0, seg: q.high ? 24 : 12 }); }
  k.cyl('b', [0.098, 0.074, 0.13], [0, 0.07, -0.56], { c: B, seg: q.high ? 20 : 12 });                                                                  // boca acampanada
  k.tor('l', [0.097, 0.0065], [0, 0.07, -0.625], { k: 0, seg: q.high ? 28 : 14 });
  k.cyl('b', [0.074, 0.088, 0.1], [0, 0.07, 0.15], { c: GUN, seg: q.high ? 20 : 12 });                                                                  // escape trasero
  k.cyl('l', [0.058, 0.058, 0.006], [0, 0.07, 0.205], { k: 0, seg: 12 }); k.tor('b', [0.088, 0.008], [0, 0.07, 0.2], { c: PALE, seg: q.high ? 24 : 12 });
  k.prof('b', [[-0.12, 0.0], [0.15, 0.0], [0.15, -0.04], [-0.12, -0.04]], 0.07, 0, { c: DARK });                                                         // bloque inferior
  k.prof('b', [[-0.06, -0.04], [0.045, -0.04], [0.036, -0.205], [-0.085, -0.205]], 0.046, 0, { c: DARK });                                                // empuñadura
  k.prof('b', [[0.16, -0.04], [0.16, -0.08], [0.0, -0.08], [0.0, -0.04], [0.012, -0.04], [0.012, -0.068], [0.148, -0.068], [0.148, -0.04]], 0.03, 0, { c: GUN });
  k.box('b', [0.012, 0.036, 0.01], [0, -0.055, -0.08], { c: PALE, r: [0.25, 0, 0] });
  k.box('l', [0.004, 0.1, 0.012], [-0.0245, -0.125, -0.03], { k: 0 });
  // cámara de reacción: núcleo flotando en una jaula
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; k.limb('b', [Math.cos(a) * 0.03, 0.135, -0.12 + Math.sin(a) * 0.03], [Math.cos(a) * 0.052, 0.19, -0.12 + Math.sin(a) * 0.052], 0.008, 0.006, { c: GUN, ball: true }); }
  k.tor('b', [0.058, 0.005], [0, 0.245, -0.12], { c: PALE, r: [Math.PI / 2, 0, 0] }); k.tor('b', [0.058, 0.005], [0, 0.19, -0.12], { c: PALE, r: [Math.PI / 2, 0, 0] });
  k.cyl('b', [0.01, 0.01, 0.06], [0, 0.22, -0.12 - 0.058], { axis: 'y', c: GUN }); k.cyl('b', [0.01, 0.01, 0.06], [0, 0.22, -0.12 + 0.058], { axis: 'y', c: GUN });
  k.cyl('b', [0.01, 0.01, 0.06], [0.058, 0.22, -0.12], { axis: 'y', c: GUN }); k.cyl('b', [0.01, 0.01, 0.06], [-0.058, 0.22, -0.12], { axis: 'y', c: GUN });
  // aletas laterales con ventilas de vapor
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { k.box('b', [0.018, 0.05, 0.02], [sx * 0.078, 0.07, -0.19 - i * 0.04], { c: DARK, r: [0, 0, sx * 0.15] }); k.box('l', [0.004, 0.035, 0.012], [sx * 0.0875, 0.07, -0.19 - i * 0.04], { k: 0 }); }
  k.prof('b', [[0.06, 0.14], [0.1, 0.19], [0.02, 0.19]], 0.016, 0.07, { c: GUN });                                                                       // alza abatible
  bezel(k, [0, 0.1385, 0.01], [-1.0, 0, 0], 0.062, 0.04);
  for (let i = 0; i < 3; i++) k.box('l', [0.008, 0.005, 0.01], [-0.045 + i * 0.012, 0.139, -0.05], { k: 2 });
  const gh = { zc: 0.0, top: -0.04, d: 0.115, hw: 0.023 };
  let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.07, -0.34], 0.074, hex, { flip: 0.7 }); }
  // jaula giratoria y núcleo pulsante
  k.part('cage', [0, 0.22, -0.12]);
  for (let i = 0; i < 3; i++) k.tor('l', [0.047, 0.0042], [0, 0.22, -0.12], { k: 0, r: [i * Math.PI / 3 + 0.4, i * Math.PI / 3, 0], seg: 20 });
  k.part('core', [0, 0.22, -0.12]);
  k.poly('l', 'ico', 0.034, [0, 0.22, -0.12], { k: 1 }); k.poly('l', 'oct', 0.02, [0, 0.22, -0.12], { k: 0, c: 0xffffff });
  // cohete cargado: la punta de cristal asoma por la boca
  k.part('rocket', [0, 0.07, -0.5]);
  k.cyl('b', [0.052, 0.052, 0.08], [0, 0.07, -0.52], { c: GUN }); k.cyl('l', [0.003, 0.052, 0.12], [0, 0.07, -0.62], { k: 1, seg: 8 });
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 1; k.box('b', [0.006, 0.05, 0.05], [Math.cos(a) * 0.05, 0.07 + Math.sin(a) * 0.05, -0.49], { c: B, r: [0, 0, a - Math.PI / 2] }); }
  if (hands) { k.part('trigger', pivot); triggerFinger(k, gh, pivot, 0.03); }

  const P = addParts(G, group, ['main', 'cage', 'core', 'rocket', ...(hands ? ['trigger'] : [])]);
  placeScreen(G, P.main, [0, 0.1425, 0.01], [-1.0, 0, 0], 1.12);
  let cageW = 1.2, rocketT = 9, curl = 0, steam = 0, coreP = 0; const kick = new Spring(120, 9);
  const W = {
    group, muzzle: [0, 0.07, -0.68], eject: null, flash: { shape: 'ball', size: 1.5, decay: 5.5 },
    recoil: { z: 0.2, y: 0.045, pitch: 0.5, roll: 0.05, k: 90, c: 9 }, view: { pos: [0.3, -0.24, -0.5], scale: 0.6, zs: 0.6, rot: [0.02, 0.0, 0] },
    update(dt, t, firing) {
      kick.step(dt); cageW = damp(cageW, firing ? 7 : 1.2, 3, dt); P.cage.rotation.y += cageW * dt; P.cage.rotation.x += cageW * 0.4 * dt;
      coreP = damp(coreP, firing ? 1 : 0, 5, dt); const s = 1 + 0.06 * Math.sin(t * 7) + coreP * 0.18 - G.boost * 0.2; P.core.scale.setScalar(s); P.core.rotation.set(t * 1.7, t * 2.3, 0);
      rocketT += dt; const rk = clamp((rocketT - 0.35) / 0.7, 0, 1), rs = rocketT < 0.1 ? 1 : easeOut(rk);
      P.rocket.visible = rocketT < 0.06 || rocketT > 0.35; P.rocket.scale.setScalar(Math.max(0.01, rocketT < 0.06 ? 1 : rs)); P.rocket.position.z = P.rocket.userData.base.z + (1 - rs) * 0.1;
      G.heat = Math.max(0, G.heat - dt * 0.28); G.boost = Math.max(0, G.boost - dt * 4);
      steam -= dt; if (steam > 0 && W._ctx && Math.random() < dt * 30) { const c = W._ctx; for (const sx of [-1, 1]) c.puff([sx * 0.09, 0.07, -0.28 + Math.random() * 0.08], [sx * 0.2, 0.18 + Math.random() * 0.1, -0.05], 0xffffff, { size: 0.07, grow: 0.3, life: 0.7, alpha: 0.2 }); c.puff([0, 0.07, 0.22], [0, 0.1, 0.35], hex, { size: 0.08, grow: 0.3, life: 0.5, alpha: 0.25 }); }
      curl = Math.max(curl - dt * 6, firing ? 0.3 : 0); if (P.trigger) P.trigger.rotation.x = -curl * 0.5;
      G.mats.set(t, G.heat + coreP * 0.1, -9, G.ammo, G.boost); G.scr.update(t);
    },
    fire(ctx) {
      G.heat = Math.min(1, G.heat + 0.9); G.boost = 1; rocketT = 0; steam = 1.2; curl = 1; cageW += 14; kick.v += 1.6; W._ctx = ctx;
      if (ctx) { for (let i = 0; i < 4; i++) ctx.puff([0, 0.07, -0.66], [(Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4 + 0.1, -0.5], i % 2 ? hex : 0xffffff, { size: 0.16, grow: 0.5, life: 0.8, alpha: 0.4 }); for (let i = 0; i < 3; i++) ctx.shard([0, 0.07, -0.65], [(Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5 + 0.4, -1.2], hex, 1.1); }
    },
  };
  return finalize(G, W);
}

/* ═════════════════════════════ 4 · AGUJA — riel de bobinas ═════════════════════════════ */
export function aguja(q, hands) {
  const G = newGun(4, q), { k, hex, B } = G, group = new THREE.Group();
  const COIL_Z = [-0.3, -0.45, -0.6, -0.75, -0.9, -1.05];
  k.part('main');
  k.prof('b', [[-0.16, 0.088], [0.13, 0.098], [0.23, 0.062], [0.23, -0.03], [0.0, -0.05], [-0.16, -0.02]], 0.066, 0, { c: B });                           // receptor
  k.prof('b', [[-0.16, 0.08], [-0.5, 0.06], [-0.55, -0.14], [-0.47, -0.14], [-0.4, -0.04], [-0.16, -0.03]], 0.04, 0, { c: DARK, holes: [[[-0.2, 0.05], [-0.45, 0.037], [-0.47, -0.07], [-0.4, -0.012], [-0.2, -0.0]]] }); // culata
  k.poly('l', 'oct', 0.03, [0, 0.0, 0.33], { k: 1, s: [0.6, 0.6, 1.7], r: [0.12, 0, 0] });
  k.box('l', [0.04, 0.15, 0.01], [0, -0.03, 0.55], { k: 0 });
  // celda de energía superior
  k.cyl('l', [0.028, 0.038, 0.24], [0, 0.138, 0.08], { k: 1, seg: 6 });
  for (const z of [-0.05, 0.21]) { k.box('b', [0.082, 0.05, 0.016], [0, 0.125, z], { c: GUN }); screw(k, [0.034, 0.125, z], 'x'); screw(k, [-0.034, 0.125, z], 'x'); }
  for (const x of [-0.045, 0.045]) k.box('b', [0.01, 0.05, 0.24], [x, 0.125, 0.08], { c: B, rad: 0.003 });
  // empuñadura + guardamonte
  k.prof('b', [[-0.06, -0.05], [0.045, -0.05], [0.036, -0.215], [-0.085, -0.215]], 0.045, 0, { c: DARK });
  k.prof('b', [[0.14, -0.05], [0.14, -0.092], [0.0, -0.092], [0.0, -0.05], [0.012, -0.05], [0.012, -0.08], [0.128, -0.08], [0.128, -0.05]], 0.03, 0, { c: GUN });
  k.box('b', [0.012, 0.034, 0.01], [0, -0.07, -0.07], { c: PALE, r: [0.25, 0, 0] });
  k.box('l', [0.004, 0.1, 0.012], [-0.0245, -0.135, -0.03], { k: 0 });
  k.box('b', [0.004, 0.034, 0.09], [0.034, 0.03, 0.0], { c: DARK }); k.box('l', [0.0035, 0.012, 0.05], [0.035, 0.03, 0.0], { k: 0 });
  for (let i = 0; i < 4; i++) k.box('l', [0.005, 0.008, 0.014], [-0.0345, 0.0 + i * 0.012, -0.1], { k: 2 });
  bezel(k, [-0.0345, 0.04, 0.09], [0, -Math.PI / 2 + 0.3, 0], 0.07, 0.04);
  // guardamanos inferior y mira abierta
  k.cyl('b', [0.03, 0.03, 0.24], [0, 0.0, -0.45], { c: GUN }); for (const z of [-0.35, -0.55]) k.cyl('b', [0.034, 0.034, 0.014], [0, 0.0, z], { c: B });
  k.limb('b', [0, 0.02, -0.4], [0, 0.04, -0.4], 0.016, 0.016, { c: GUN });
  k.tor('b', [0.016, 0.0035], [0, 0.145, -0.1], { c: PALE }); k.tor('b', [0.012, 0.003], [0, 0.145, -0.85], { c: PALE });
  k.limb('b', [0, 0.098, -0.1], [0, 0.145, -0.1], 0.005, 0.005, { c: GUN });
  // bobinas (se encienden en secuencia) + soportes
  for (const z of COIL_Z) { k.tor('l', [0.05, 0.0075], [0, 0.05, z], { k: 3, seg: 6 }); k.box('b', [0.016, 0.012, 0.03], [0, -0.0, z], { c: GUN }); }
  k.limb('b', [0, 0.05, -1.12], [0, 0.05, -1.2], 0.02, 0.012, { c: B });
  const gh = { zc: 0.0, top: -0.05, d: 0.115, hw: 0.0225 };
  let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.0, -0.45], 0.031, hex); }
  // rieles gemelos (se abren al cargar)
  for (const sx of [-1, 1]) {
    k.part(sx < 0 ? 'railL' : 'railR', [0, 0.05, -0.2]);
    k.box('b', [0.022, 0.05, 0.84], [sx * 0.034, 0.05, -0.62], { c: B, rad: 0.004 });
    k.box('l', [0.002, 0.02, 0.8], [sx * 0.0225, 0.05, -0.62], { k: 0 });
    k.prof('b', [[-0.94, 0.075], [-1.1, 0.05], [-1.1, 0.025], [-0.94, 0.025]].map(([u, v]) => [u * -1, v]), 0.022, sx * 0.034, { c: STEEL });
    if (q.detail) vents(k, 4, [sx * 0.0455, 0.05, -0.35], [0.003, 0.03, 0.012], 0.06, DARK);
  }
  // la aguja: lanza de cristal en el canal
  k.part('needle', [0, 0.05, -0.2]);
  k.limb('l', [0, 0.05, -0.1], [0, 0.05, -1.12], 0.0065, 0.0065, { k: 1, seg: 6 }); k.cyl('l', [0.0005, 0.0065, 0.14], [0, 0.05, -1.19], { k: 1, seg: 6 });
  k.cyl('l', [0.012, 0.012, 0.05], [0, 0.05, -0.24], { k: 0, seg: 8 });
  if (hands) { k.part('trigger', pivot); triggerFinger(k, gh, pivot, 0.03); }

  const P = addParts(G, group, ['main', 'railL', 'railR', 'needle', ...(hands ? ['trigger'] : [])]);
  placeScreen(G, P.main, [-0.0365, 0.04, 0.09], [0, -Math.PI / 2 + 0.3, 0], 1.3);
  let seq = 9, seqSpeed = 0, charge = 0, dischargeT = 9, curl = 0, spark = 0; const kick = new Spring(150, 12), open = new Spring(500, 24);
  const W = {
    group, muzzle: [0, 0.05, -1.3], eject: null, flash: { shape: 'ring', size: 1.0, decay: 8 },
    recoil: { z: 0.1, y: 0.015, pitch: 0.22, roll: 0.02, k: 140, c: 14 }, view: { pos: [0.3, -0.2, -0.45], scale: 0.52, zs: 0.5, rot: [0.02, 0.0, 0] },
    update(dt, t, firing) {
      kick.step(dt); open.step(dt); dischargeT += dt;
      charge = damp(charge, firing ? 1 : 0, firing ? 2.4 : 3, dt);
      // secuencia: en reposo pulso lento; cargando, más rápido; al descargar, barrido veloz hasta la boca
      if (dischargeT < 0.3) seq = 0.25 - (dischargeT / 0.3) * 1.55;
      else { const per = 3.2 - charge * 2.2; seq = 0.25 - ((t % per) / per) * 1.4; }
      const sOpen = charge * 0.007 + clamp(open.x, -0.01, 0.02);
      P.railL.position.x = P.railL.userData.base.x - sOpen; P.railR.position.x = P.railR.userData.base.x + sOpen;
      const need = dischargeT < 0.45 ? 0 : easeOut((dischargeT - 0.45) / 0.55); // la aguja vuelve a cargarse
      P.needle.visible = dischargeT > 0.4 || dischargeT < 0.0; P.needle.position.z = P.needle.userData.base.z + (1 - need) * 0.5 - charge * 0.0;
      G.heat = Math.max(0, G.heat - dt * 0.2); G.boost = Math.max(0, G.boost - dt * 3.2);
      if (W._ctx && dischargeT > 0.2 && dischargeT < 1.6 && Math.random() < dt * 24) W._ctx.puff([(Math.random() - 0.5) * 0.04, 0.05, -0.5 - Math.random() * 0.5], [0, 0.22, 0], 0xffffff, { size: 0.05, grow: 0.25, life: 0.8, alpha: 0.16 });
      curl = Math.max(curl - dt * 4, firing ? 0.25 : 0); if (P.trigger) P.trigger.rotation.x = -curl * 0.5;
      spark = Math.max(0, spark - dt);
      G.mats.set(t, G.heat * 0.9 + charge * 0.22, seq, G.ammo, G.boost + charge * 0.25); G.scr.update(t);
    },
    fire(ctx) {
      dischargeT = 0; G.heat = 1; G.boost = 1.2; curl = 1; kick.v += 1.3; open.v += 0.7; W._ctx = ctx; spark = 0.3;
      if (ctx) { ctx.puff([0, 0.05, -1.3], [0, 0, -0.6], hex, { size: 0.2, grow: 0.4, life: 0.5, alpha: 0.5 }); for (let i = 0; i < 5; i++) ctx.shard([0, 0.05, -0.6 - i * 0.12], [(Math.random() - 0.5) * 1.2, (Math.random() - 0.3) * 1.3, 0.2 + Math.random() * 0.4], i % 2 ? hex : 0xffffff, 1.0); }
    },
  };
  return finalize(G, W);
}

export const BUILD = [haz, prisma, rafaga, nova, aguja];
