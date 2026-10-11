// Diez armas más (ids 15..24): voltaico, glaciar, plaga, brasa, mina, sierra, pulsar, dardos, requiem, quimera.
// Misma fábrica `make` que guns2.js. Cada una tiene una silueta propia (se reconoce de un vistazo desde la cámara):
//  voltaico = cuernos de electrodos con arco · glaciar = cañón con corona de carámbanos y tanque · plaga = jeringa con ampolla
//  brasa = brasero con tobera incandescente · mina = tambor con minas · sierra = disco de luz giratorio al frente
//  pulsar = esfera con platillo y ondas · dardos = ballesta de 3 dardos · requiem = rifle largo con guadaña · quimera = collage caótico.
import * as THREE from 'three';
import { rightHand, supportHand } from './hands.js';
import { DARK, GUN, STEEL, PALE, clamp, damp, easeOut, bezel, vivid } from './guns.js';
import { make, stdGrip, gem, burst, VIEW_L, VIEW_S } from './guns2.js';

const rnd = Math.random;
const PI = Math.PI;
/** Pantallita de munición en el costado izquierdo del receptor (x = -(ancho/2 + 0.0025)). */
function scr(k, x, y, z, w = 0.07, h = 0.04, sc = 1.2) {
  bezel(k, [x, y, z], [0, -PI / 2 + 0.3, 0], w, h);
  return { pos: [x - 0.002, y, z], rot: [0, -PI / 2 + 0.3, 0], scale: sc };
}
const lights = (k, x, y, z, n = 3) => { for (let i = 0; i < n; i++) k.box('l', [0.005, 0.008, 0.014], [x, y + i * 0.012, z], { k: 2 }); };
const hand = (k, G, hands, top = -0.012, sup = null) => { const gh = stdGrip(k, top); let pivot = null; if (hands) { pivot = rightHand(k, gh, G.hex); if (sup) supportHand(k, sup[0], sup[1], G.hex); } return { gh, pivot }; };
/** Cono de cristal (punta hacia -Z) entre dos puntos. */
const spike = (k, a, b, r0, r1 = 0.0015, o = {}) => k.limb('l', a, b, r0, r1, { k: 1, seg: 5, ...o });

/* ═════════════ 15 · VOLTAICO — bobina con cuernos de electrodos que chispean ═════════════ */
function voltaico(q, hands) {
  return make(15, q, hands, {
    muzzle: [0, 0.06, -0.7], flash: { shape: 'bolt', size: 0.95, decay: 14 }, recoil: { z: 0.045, y: 0.008, pitch: 0.1, roll: 0.03, k: 240, c: 18 }, view: { ...VIEW_L, scale: 0.98 }, heat: 0.35, kv: 0.8, cool: 0.5,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.15, 0.072], [0.1, 0.078], [0.15, 0.05], [0.15, -0.012], [-0.15, -0.012], [-0.17, 0.03]], 0.06, 0, { c: B });
      k.prof('b', [[-0.15, 0.06], [-0.24, 0.04], [-0.27, -0.03], [-0.21, -0.04], [-0.15, -0.02]], 0.04, 0, { c: DARK, holes: [[[-0.2, 0.04], [-0.32, 0.026], [-0.34, -0.03], [-0.25, -0.03]]] });
      for (const sx of [-1, 1]) { // condensadores traseros
        k.cyl('b', [0.022, 0.022, 0.2], [sx * 0.03, 0.105, -0.01], { c: A, seg: 10 });
        for (const z of [-0.08, -0.01, 0.06]) k.tor('l', [0.0235, 0.0035], [sx * 0.03, 0.105, z], { k: 3, seg: q.low ? 8 : 12 });
        k.cyl('b', [0.016, 0.016, 0.02], [sx * 0.03, 0.105, 0.1], { c: PALE, seg: 8 });
      }
      k.cyl('b', [0.012, 0.014, 0.5], [0, 0.05, -0.4], { c: GUN, seg: 8 });                                  // núcleo de la bobina
      for (let i = 0; i < 8; i++) { const z = -0.17 - i * 0.055, R = 0.056 - i * 0.0048; k.tor('l', [R, 0.0068], [0, 0.05, z], { k: 3, seg: q.low ? 9 : 16 }); k.cyl('b', [R * 0.8, R * 0.8, 0.01], [0, 0.05, z - 0.027], { c: DARK, seg: 8 }); }
      for (const sx of [-1, 1]) { // cuernos de electrodos
        const P = [[sx * 0.03, 0.05, -0.15], [sx * 0.078, 0.058, -0.32], [sx * 0.098, 0.07, -0.5], [sx * 0.074, 0.074, -0.64], [sx * 0.034, 0.064, -0.71]];
        for (let i = 0; i < 4; i++) k.limb('b', P[i], P[i + 1], 0.014 - i * 0.0018, 0.014 - (i + 1) * 0.0018, { c: i % 2 ? A : B, ball: true, seg: 7 });
        k.cyl('b', [0.026, 0.026, 0.02], [sx * 0.05, 0.054, -0.2], { c: PALE, seg: 8 });
        k.sph('l', 0.016, P[4], { k: 1 });
      }
      k.sph('l', 0.014, [0, 0.05, -0.68], { k: 1 }); k.cyl('l', [0.0015, 0.012, 0.07], [0, 0.05, -0.74], { k: 1, seg: 6 });
      k.box('l', [0.004, 0.02, 0.1], [-0.0315, 0.035, 0.0], { k: 0 }); lights(k, -0.0325, 0.0, -0.1);
      const info = hand(k, G, hands, -0.012, [[0, 0.0, -0.3], 0.03]);
      k.cyl('b', [0.03, 0.03, 0.22], [0, 0.0, -0.3], { c: GUN });
      for (const z of [-0.22, -0.38]) k.cyl('b', [0.034, 0.034, 0.012], [0, 0.0, z], { c: B });
      info.screen = { ...scr(k, -0.0325, 0.04, 0.09) };
      // arcos eléctricos: zigzag entre los cuernos y la punta central (se sacude cada cuadro)
      k.part('arcs', [0, 0.066, -0.7]);
      const zz = (a, b, n, amp, r) => { let p = a; for (let i = 1; i <= n; i++) { const t = i / n, nx = i === n ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + (i % 2 ? amp : -amp) * (0.6 + 0.4 * Math.sin(i * 2.1)), a[2] + (b[2] - a[2]) * t + (i % 3 ? -amp : amp) * 0.5]; k.limb('l', p, nx, r, r, { k: 1, seg: 4 }); p = nx; } };
      zz([-0.074, 0.074, -0.64], [0.074, 0.074, -0.64], 9, 0.016, 0.0028); zz([-0.074, 0.074, -0.64], [0, 0.05, -0.68], 5, 0.012, 0.0022); zz([0.074, 0.074, -0.64], [0, 0.05, -0.68], 5, 0.012, 0.0022); zz([-0.034, 0.064, -0.71], [0.034, 0.064, -0.71], 6, 0.014, 0.0026);
      return info;
    },
    anim(P, st, dt, t, firing, G) {
      st.seq = -0.12 - ((t * (firing ? 4.5 : 1.3 + st.pulse * 4)) % 1) * 0.5;
      st.at = (st.at || 0) - dt;
      if (st.at <= 0) { st.at = firing ? 0.025 : 0.07; P.arcs.rotation.z = (rnd() - 0.5) * 0.9; P.arcs.rotation.x = (rnd() - 0.5) * 0.7; P.arcs.scale.set(0.85 + rnd() * 0.3, 0.7 + rnd() * 0.7, 1); P.arcs.visible = firing || st.pulse > 0.05 || rnd() < 0.6; }
      if (st.ctx && rnd() < dt * (firing ? 30 : 7)) st.ctx.shard([(rnd() < 0.5 ? -1 : 1) * 0.07, 0.07, -0.64], [(rnd() - 0.5) * 1.2, rnd() * 1.2, -0.3], rnd() < 0.5 ? 0xffffff : G.hex, 0.45);
    },
    fire(P, st, ctx, G) { if (ctx) { for (let i = 0; i < 4; i++) ctx.shard([(i % 2 ? 1 : -1) * 0.07, 0.07, -0.64], [(rnd() - 0.5) * 2, rnd() * 1.5, -0.8], i % 2 ? 0xffffff : G.hex, 0.8); burst(ctx, G.hex, -0.7, 2, 0.06); } },
  });
}

/* ═════════════ 16 · GLACIAL — cañón de hielo con corona de carámbanos, tanque con cristales y vapor ═════════════ */
function glacial(q, hands) {
  return make(16, q, hands, {
    muzzle: [0, 0.04, -0.78], flash: { shape: 'frost', size: 1.15, decay: 8 }, recoil: { z: 0.12, y: 0.025, pitch: 0.32, roll: 0.04, k: 110, c: 11 }, view: { ...VIEW_L, scale: 0.97 }, heat: 0.5, kv: 1.2, cool: 0.35,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.16, 0.082], [0.14, 0.092], [0.19, 0.055], [0.19, -0.015], [-0.16, -0.012], [-0.18, 0.03]], 0.07, 0, { c: B });
      k.prof('b', [[-0.16, 0.065], [-0.25, 0.04], [-0.27, -0.03], [-0.21, -0.04], [-0.16, -0.02]], 0.045, 0, { c: DARK });
      k.cyl('b', [0.052, 0.052, 0.34], [0, 0.152, -0.03], { c: GUN, seg: q.low ? 9 : 14 });                               // tanque criogénico
      for (const z of [-0.15, -0.03, 0.09]) { k.cyl('b', [0.057, 0.057, 0.016], [0, 0.152, z], { c: B, seg: q.low ? 9 : 14 }); k.tor('l', [0.058, 0.0028], [0, 0.152, z - 0.009], { k: 0, seg: 12 }); }
      for (const sx of [-1, 1]) k.box('l', [0.004, 0.045, 0.21], [sx * 0.053, 0.152, -0.03], { k: 0 });
      k.box('l', [0.03, 0.006, 0.26], [0, 0.205, -0.03], { k: 1 });
      k.poly('l', 'oct', 0.03, [0, 0.215, -0.07], { k: 1, s: [0.6, 1.8, 0.7], r: [0.1, 0, 0.12] }); k.poly('l', 'oct', 0.022, [-0.02, 0.21, 0.03], { k: 1, s: [0.6, 1.6, 0.7], r: [-0.1, 0, -0.3] }); k.poly('l', 'oct', 0.018, [0.022, 0.208, -0.12], { k: 1, s: [0.6, 1.5, 0.7], r: [0.05, 0, 0.4] }); k.poly('l', 'oct', 0.014, [0.0, 0.205, 0.1], { k: 1, s: [0.6, 1.4, 0.7] });
      k.cyl('b', [0.056, 0.038, 0.4], [0, 0.04, -0.36], { c: GUN, seg: q.low ? 9 : 14 });                                  // cañón cónico
      for (const z of [-0.22, -0.34, -0.46]) { k.cyl('b', [0.06, 0.06, 0.014], [0, 0.04, z], { c: B, seg: 12 }); k.tor('l', [0.061, 0.003], [0, 0.04, z - 0.008], { k: 0, seg: 14 }); }
      k.limb('b', [0, 0.115, -0.2], [0, 0.07, -0.26], 0.012, 0.012, { c: DARK, ball: true });                              // manguera
      k.cyl('b', [0.07, 0.056, 0.05], [0, 0.04, -0.58], { c: B, seg: q.low ? 9 : 14 });
      bezel(k, [-0.0365, 0.04, 0.1], [0, -PI / 2 + 0.3, 0], 0.07, 0.04); lights(k, -0.0365, 0.0, -0.1);
      const info = hand(k, G, hands, -0.012, [[0, 0.04, -0.28], 0.05]);
      info.screen = { pos: [-0.0385, 0.04, 0.1], rot: [0, -PI / 2 + 0.3, 0], scale: 1.25 };
      k.part('crown', [0, 0.04, -0.62]);                                                                                     // corona de carámbanos
      for (let i = 0; i < 9; i++) { const a = i * PI * 2 / 9 + 0.2, L = 0.1 + (i % 3) * 0.05; spike(k, [Math.cos(a) * 0.056, 0.04 + Math.sin(a) * 0.056, -0.6], [Math.cos(a) * 0.026, 0.04 + Math.sin(a) * 0.026, -0.6 - L], 0.015, 0.0015); }
      spike(k, [0, 0.04, -0.6], [0, 0.04, -0.82], 0.022, 0.002);
      return info;
    },
    anim(P, st, dt, t, firing) {
      P.crown.rotation.z = -t * 0.35 - st.pulse * 0.8; const s = 1 + st.pulse * 0.16; P.crown.scale.set(s, s, 1 + st.pulse * 0.1);
      if (st.ctx && rnd() < dt * (firing ? 18 : 9)) st.ctx.puff([(rnd() - 0.5) * 0.06, 0.2, -0.03 + (rnd() - 0.5) * 0.2], [0, 0.18, 0.02], 0xcfefff, { size: 0.05, grow: 0.17, life: 1.0, alpha: 0.16 });
    },
    fire(P, st, ctx, G) { if (ctx) { for (let i = 0; i < 6; i++) ctx.shard([(rnd() - 0.5) * 0.06, 0.04 + (rnd() - 0.5) * 0.06, -0.7], [(rnd() - 0.5) * 1.6, rnd() * 1.2, -1.0], i % 2 ? 0xffffff : G.hex, 1.0); burst(ctx, 0xdff6ff, -0.78, 4, 0.04); } },
  });
}

/* ═════════════ 17 · PLAGA — jeringa lanzadora: tubo con veneno, émbolo, aguja y ampolla burbujeante ═════════════ */
function plaga(q, hands) {
  return make(17, q, hands, {
    muzzle: [0, 0.05, -0.97], flash: { shape: 'blob', size: 0.9, decay: 9 }, recoil: { z: 0.07, y: 0.012, pitch: 0.18, roll: 0.025, k: 160, c: 14 }, view: { ...VIEW_L, scale: 0.9, zs: 0.5 }, heat: 0.3, kv: 1.0, cool: 0.5,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.12, 0.062], [0.12, 0.068], [0.15, 0.04], [0.15, -0.012], [-0.12, -0.012], [-0.14, 0.025]], 0.055, 0, { c: B });
      k.prof('b', [[-0.12, 0.05], [-0.22, 0.035], [-0.24, -0.03], [-0.19, -0.04], [-0.12, -0.02]], 0.04, 0, { c: DARK });
      k.cyl('l', [0.027, 0.027, 0.46], [0, 0.05, -0.32], { k: 0, seg: q.low ? 8 : 12 });                                    // veneno visible
      for (const z of [-0.09, -0.21, -0.33, -0.45, -0.55]) k.cyl('b', [0.038, 0.038, 0.014], [0, 0.05, z], { c: z === -0.09 ? A : GUN, seg: q.low ? 8 : 12 });
      for (const [x, y] of [[0, 0.088], [0, 0.012]]) k.box('b', [0.01, 0.008, 0.48], [x, y, -0.32], { c: STEEL });
      for (let i = 0; i < 9; i++) k.box('b', [0.003, 0.004, i % 3 ? 0.008 : 0.016], [-0.04, 0.05 + 0.0, -0.12 - i * 0.045], { c: PALE }); // graduación
      k.sph('l', 0.052, [0, 0.145, -0.15], { k: 0, seg: q.low ? 7 : 12 }); k.cyl('b', [0.034, 0.034, 0.012], [0, 0.098, -0.15], { axis: 'y', c: B, seg: 10 }); k.cyl('b', [0.014, 0.03, 0.022], [0, 0.202, -0.15], { axis: 'y', c: A, seg: 10 }); // ampolla
      k.tor('b', [0.052, 0.004], [0, 0.145, -0.15], { c: PALE, r: [PI / 2, 0, 0], seg: 12 });
      k.box('b', [0.15, 0.012, 0.03], [0, 0.05, -0.04], { c: B, rad: 0.004 });                                                // aletas de dedos
      k.cyl('b', [0.008, 0.02, 0.05], [0, 0.05, -0.605], { c: GUN, seg: 8 }); k.cyl('b', [0.0012, 0.006, 0.34], [0, 0.05, -0.8], { c: STEEL, seg: 5 }); k.sph('l', 0.007, [0, 0.05, -0.97], { k: 0 }); // aguja
      for (let i = 0; i < 3; i++) k.cyl('b', [0.0045, 0.0045, 0.006], [0, 0.05, -0.7 - i * 0.07], { c: PALE, seg: 5 });
      bezel(k, [-0.0295, 0.04, 0.09], [0, -PI / 2 + 0.3, 0], 0.06, 0.035); lights(k, -0.03, 0.0, -0.06);
      const info = hand(k, G, hands, -0.012, [[0, 0.05, -0.3], 0.038]);
      info.screen = { pos: [-0.0315, 0.04, 0.09], rot: [0, -PI / 2 + 0.3, 0], scale: 1.05 };
      k.part('plunger', [0, 0.05, 0.0]);                                                                                      // émbolo
      k.cyl('b', [0.009, 0.009, 0.36], [0, 0.05, 0.08], { c: STEEL, seg: 6 }); k.cyl('b', [0.026, 0.026, 0.02], [0, 0.05, -0.08], { c: DARK, seg: 10 }); k.tor('b', [0.044, 0.007], [0, 0.05, 0.27], { c: B, r: [0, PI / 2, 0], seg: 14 }); k.box('b', [0.012, 0.03, 0.012], [0, 0.05, 0.25], { c: GUN });
      return info;
    },
    anim(P, st, dt, t) {
      const p = st.t0 < 0.12 ? st.t0 / 0.12 : Math.max(0, 1 - (st.t0 - 0.12) / 0.7); P.plunger.position.z = P.plunger.userData.base.z - p * 0.13;
      if (st.ctx && rnd() < dt * 12) st.ctx.puff([(rnd() - 0.5) * 0.04, 0.17, -0.15 + (rnd() - 0.5) * 0.03], [0, 0.12, 0], 0xa6ff6a, { size: 0.03, grow: 0.07, life: 0.7, alpha: 0.28 });
      st.seq = -9;
    },
    fire(P, st, ctx, G) { if (ctx) { for (let i = 0; i < 4; i++) ctx.shard([0, 0.05, -0.97], [(rnd() - 0.5) * 0.8, rnd() * 0.5, -1.6], G.hex, 0.7); burst(ctx, G.hex, -0.97, 3, 0.05); } },
  });
}

/* ═════════════ 18 · BRASA — lanzallamas-brasero: tanque, manguera y tobera hexagonal incandescente ═════════════ */
function brasa(q, hands) {
  return make(18, q, hands, {
    muzzle: [0, 0.05, -0.54], flash: { shape: 'ember', size: 1.0, decay: 9 }, recoil: { z: 0.03, y: 0.005, pitch: 0.05, roll: 0.025, k: 260, c: 20 }, view: { ...VIEW_L, scale: 1.0 }, heat: 0.12, kv: 0.5, cool: 0.25,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.15, 0.07], [0.12, 0.076], [0.16, 0.04], [0.16, -0.015], [-0.15, -0.012], [-0.17, 0.03]], 0.065, 0, { c: B });
      k.prof('b', [[-0.15, 0.058], [-0.24, 0.035], [-0.26, -0.03], [-0.2, -0.04], [-0.15, -0.02]], 0.042, 0, { c: DARK });
      k.cyl('b', [0.058, 0.058, 0.34], [0, 0.135, -0.01], { c: DARK, seg: q.low ? 9 : 14 });                                  // tanque de combustible
      for (const z of [-0.13, 0.0, 0.13]) k.cyl('b', [0.062, 0.062, 0.018], [0, 0.135, z], { c: B, seg: q.low ? 9 : 14 });
      for (const sx of [-1, 1]) k.box('l', [0.004, 0.05, 0.1], [sx * 0.0585, 0.135, -0.065], { k: 0 });
      k.box('l', [0.03, 0.005, 0.12], [0, 0.1925, -0.065], { k: 0 }); k.cyl('b', [0.016, 0.016, 0.03], [0, 0.205, 0.08], { axis: 'y', c: PALE, seg: 8 });
      k.limb('b', [0, 0.115, -0.17], [0, 0.06, -0.29], 0.014, 0.014, { c: GUN, ball: true });                              // manguera
      k.cyl('b', [0.09, 0.05, 0.2], [0, 0.05, -0.4], { c: B, seg: 6 });                                                      // tobera hexagonal
      k.cyl('b', [0.1, 0.1, 0.018], [0, 0.05, -0.505], { c: DARK, seg: 6 });
      k.cyl('l', [0.078, 0.078, 0.01], [0, 0.05, -0.51], { k: 1, seg: 6 }); k.tor('l', [0.088, 0.006], [0, 0.05, -0.516], { k: 0, seg: 6 });
      for (let i = 0; i < 6; i++) { const a = i * PI / 3 + PI / 6; k.box('b', [0.01, 0.034, 0.13], [Math.cos(a) * 0.082, 0.05 + Math.sin(a) * 0.082, -0.4], { c: DARK, r: [0, 0, a - PI / 2], rad: 0.003 }); }
      for (let i = 0; i < 3; i++) k.box('b', [0.19, 0.007, 0.007], [0, 0.05, -0.512], { c: STEEL, r: [0, 0, i * PI / 3] });
      for (const z of [-0.33, -0.43]) k.tor('l', [0.074 - (z + 0.33) * -0.2, 0.004], [0, 0.05, z], { k: 0, seg: 6 });
      lights(k, -0.0355, 0.0, -0.1); bezel(k, [-0.0345, 0.04, 0.1], [0, -PI / 2 + 0.3, 0], 0.07, 0.04);
      const info = hand(k, G, hands, -0.012, [[0, 0.0, -0.3], 0.034]);
      k.cyl('b', [0.034, 0.034, 0.18], [0, 0.0, -0.3], { c: GUN }); for (const z of [-0.23, -0.37]) k.cyl('b', [0.037, 0.037, 0.012], [0, 0.0, z], { c: B });
      info.screen = { pos: [-0.0365, 0.04, 0.1], rot: [0, -PI / 2 + 0.3, 0], scale: 1.25 };
      k.part('pilot', [0, 0.095, -0.3]); k.cyl('l', [0.0015, 0.011, 0.055], [0, 0.125, -0.3], { axis: 'y', k: 0, seg: 5 }); k.sph('l', 0.009, [0, 0.098, -0.3], { k: 1 });
      return info;
    },
    anim(P, st, dt, t, firing, G) {
      if (firing) G.heat = Math.min(1, G.heat + dt * 1.6);
      const f = 1 + 0.35 * Math.sin(t * 23) + 0.2 * Math.sin(t * 37 + 1); P.pilot.scale.set(1, f * (firing ? 1.7 : 1), 1);
      if (st.ctx && rnd() < dt * (firing ? 55 : 6)) { const a = rnd() * PI * 2, rr = rnd() * 0.07; st.ctx.puff([Math.cos(a) * rr, 0.05 + Math.sin(a) * rr, -0.52], [(rnd() - 0.5) * 0.3, (rnd() - 0.3) * 0.2 + 0.05, firing ? -0.9 : -0.1], rnd() < 0.5 ? 0xff9a30 : 0xffd23f, { size: firing ? 0.09 : 0.04, grow: firing ? 0.3 : 0.1, life: firing ? 0.5 : 0.45, alpha: firing ? 0.38 : 0.22, rise: 0.4 }); }
    },
    fire(P, st, ctx, G) { if (ctx) { burst(ctx, 0xff9a30, -0.54, 2, 0.05); ctx.shard([0, 0.05, -0.52], [(rnd() - 0.5) * 1.4, rnd() * 1.4, -1.2], 0xffd23f, 0.7); } },
  });
}

/* ═════════════ 19 · MINA — sembradora: tambor con minas, mortero corto y rayas de peligro ═════════════ */
function mina(q, hands) {
  return make(19, q, hands, {
    muzzle: [0, 0.076, -0.42], flash: { shape: 'ball', size: 0.8, decay: 9 }, recoil: { z: 0.1, y: 0.03, pitch: 0.3, roll: 0.03, k: 130, c: 12 }, view: { ...VIEW_L, scale: 1.0, zs: 0.6 }, heat: 0.25, kv: 1.1, cool: 0.5,
    build(k, G, hands) {
      const { hex, B, A } = G, Y = 0xffd23f, BK = 0x14100a;
      k.prof('b', [[-0.14, 0.07], [0.1, 0.075], [0.14, 0.04], [0.14, -0.012], [-0.14, -0.012], [-0.16, 0.03]], 0.062, 0, { c: B });
      k.prof('b', [[-0.14, 0.055], [-0.22, 0.035], [-0.24, -0.03], [-0.19, -0.04], [-0.14, -0.02]], 0.045, 0, { c: DARK });
      for (let i = 0; i < 6; i++) k.box('b', [0.004, 0.035, 0.022], [-0.032, 0.03, 0.09 - i * 0.04 - 0.02], { c: i % 2 ? BK : Y, r: [0, 0, 0] });         // rayas de peligro
      k.at([0, 0.062, -0.28], [0.12, 0, 0], () => {                                                                                  // mortero con la boca inclinada
        k.cyl('b', [0.044, 0.048, 0.24], [0, 0, 0], { c: GUN, seg: q.low ? 8 : 12 }); k.cyl('b', [0.055, 0.055, 0.024], [0, 0, -0.115], { c: B, seg: q.low ? 8 : 12 });
        k.cyl('l', [0.036, 0.036, 0.01], [0, 0, -0.128], { k: 0, seg: 10 }); for (let i = 0; i < 4; i++) k.box('b', [0.012, 0.006, 0.05], [Math.cos(i * PI / 2) * 0.052, Math.sin(i * PI / 2) * 0.052, -0.05], { c: i % 2 ? BK : Y, r: [0, 0, i * PI / 2] });
      });
      k.box('b', [0.04, 0.03, 0.18], [0, 0.098, -0.02], { c: GUN, rad: 0.006 }); k.cyl('l', [0.012, 0.012, 0.008], [0, 0.098, -0.115], { k: 1 }); // alza con lente
      lights(k, -0.0325, 0.0, -0.1); bezel(k, [-0.0335, 0.04, 0.095], [0, -PI / 2 + 0.3, 0], 0.07, 0.04);
      const info = hand(k, G, hands, -0.012);
      info.screen = { pos: [-0.0355, 0.04, 0.095], rot: [0, -PI / 2 + 0.3, 0], scale: 1.25 };
      k.part('drum', [0, -0.045, -0.22]);                                                                                            // tambor con 6 minas
      k.cyl('b', [0.098, 0.098, 0.07], [0, -0.045, -0.22], { axis: 'x', c: GUN, seg: q.low ? 12 : 18 }); k.cyl('b', [0.1, 0.1, 0.01], [-0.04, -0.045, -0.22], { axis: 'x', c: B, seg: q.low ? 12 : 18 }); k.cyl('b', [0.1, 0.1, 0.01], [0.04, -0.045, -0.22], { axis: 'x', c: B, seg: q.low ? 12 : 18 });
      k.cyl('b', [0.026, 0.026, 0.1], [0, -0.045, -0.22], { axis: 'x', c: STEEL, seg: 8 });
      for (let i = 0; i < 6; i++) { const a = i * PI / 3, y = -0.045 + Math.sin(a) * 0.063, z = -0.22 + Math.cos(a) * 0.063;
        k.cyl('b', [0.03, 0.03, 0.016], [-0.047, y, z], { axis: 'x', c: i % 2 ? Y : 0xffe58a, seg: 10 }); k.cyl('l', [0.013, 0.013, 0.006], [-0.056, y, z], { axis: 'x', k: i % 2 ? 1 : 2, seg: 8 });
        for (let j = 0; j < 4; j++) { const b = j * PI / 2 + a; k.box('b', [0.008, 0.007, 0.007], [-0.049, y + Math.sin(b) * 0.032, z + Math.cos(b) * 0.032], { c: BK }); } }
      return info;
    },
    anim(P, st, dt, t) { st.rot = damp(st.rot, st.n * PI / 3, 9, dt); P.drum.rotation.x = st.rot; },
    fire(P, st, ctx, G) { if (ctx) { ctx.shard([0, 0.076, -0.41], [(rnd() - 0.5) * 0.5, 1.6, -0.8], 0xffd23f, 1.4); burst(ctx, 0xffd23f, -0.42, 3, 0.07); ctx.puff([-0.05, -0.045, -0.22], [-0.2, 0.05, 0], 0xffffff, { size: 0.05, grow: 0.15, life: 0.3, alpha: 0.25 }); } },
  });
}

/* ═════════════ 20 · SIERRA — disco circular de luz con dientes de cristal girando al frente ═════════════ */
function sierra(q, hands) {
  return make(20, q, hands, {
    muzzle: [-0.012, 0.05, -0.57], flash: { shape: 'saw', size: 1.0, decay: 10 }, recoil: { z: 0.025, y: 0.004, pitch: 0.04, roll: 0.03, k: 280, c: 20 }, view: { ...VIEW_L, scale: 0.95 }, heat: 0.1, kv: 0.5, cool: 0.35,
    build(k, G, hands) {
      const { hex, B, A } = G, R = 0.13;
      k.prof('b', [[-0.15, 0.072], [0.12, 0.078], [0.16, 0.045], [0.16, -0.015], [-0.15, -0.012], [-0.17, 0.03]], 0.065, 0, { c: B });
      k.prof('b', [[-0.15, 0.058], [-0.23, 0.035], [-0.25, -0.03], [-0.2, -0.04], [-0.15, -0.02]], 0.04, 0, { c: DARK });
      k.box('b', [0.034, 0.05, 0.3], [0.022, 0.048, -0.3], { c: B, rad: 0.006 }); k.cyl('b', [0.05, 0.05, 0.06], [0.038, 0.05, -0.43], { axis: 'x', c: A, seg: q.low ? 10 : 16 }); // brazo y motor
      k.cyl('b', [0.14, 0.14, 0.01], [0.022, 0.05, -0.43], { axis: 'x', c: DARK, seg: q.low ? 14 : 28 });                      // pantalla protectora
      for (let i = 0; i < 6; i++) { const a = i * PI / 3; k.limb('b', [0.018, 0.05, -0.43], [0.018, 0.05 + Math.sin(a) * 0.11, -0.43 + Math.cos(a) * 0.11], 0.006, 0.004, { c: STEEL }); }
      k.cyl('b', [0.03, 0.03, 0.02], [0.0, 0.0, -0.22], { c: B }); k.cyl('b', [0.03, 0.03, 0.2], [0, 0.0, -0.22], { c: GUN });
      lights(k, -0.0335, 0.0, -0.1); bezel(k, [-0.0345, 0.04, 0.095], [0, -PI / 2 + 0.3, 0], 0.07, 0.04);
      const info = hand(k, G, hands, -0.012, [[0, 0.0, -0.22], 0.03]);
      info.screen = { pos: [-0.0365, 0.04, 0.095], rot: [0, -PI / 2 + 0.3, 0], scale: 1.25 };
      const cx = -0.012, cy = 0.05, cz = -0.43;
      k.part('saw', [cx, cy, cz]);
      k.cyl('l', [R, R, 0.004], [cx, cy, cz], { axis: 'x', k: 0, seg: q.low ? 18 : 32 });                                       // lámina de luz
      k.tor('l', [R, 0.0075], [cx, cy, cz], { r: [0, PI / 2, 0], k: 1, seg: q.low ? 16 : 32 }); k.tor('l', [R * 0.55, 0.004], [cx, cy, cz], { r: [0, PI / 2, 0], k: 0, seg: q.low ? 12 : 24 });
      const nT = q.low ? 14 : 20;
      for (let i = 0; i < nT; i++) { const a = i * PI * 2 / nT; k.cyl('l', [0.001, 0.013, 0.04], [cx, cy + Math.cos(a) * (R + 0.012), cz + Math.sin(a) * (R + 0.012)], { axis: 'y', k: 1, seg: 4, r: [a, 0, 0] }); }
      k.cyl('b', [0.03, 0.03, 0.03], [cx - 0.004, cy, cz], { axis: 'x', c: STEEL, seg: 10 }); k.cyl('l', [0.014, 0.014, 0.034], [cx - 0.006, cy, cz], { axis: 'x', k: 1, seg: 8 });
      for (let i = 0; i < 4; i++) { const a = i * PI / 2 + 0.4; k.limb('b', [cx, cy, cz], [cx, cy + Math.sin(a) * R * 0.55, cz + Math.cos(a) * R * 0.55], 0.007, 0.005, { c: STEEL }); }
      return info;
    },
    anim(P, st, dt, t, firing, G) {
      st.w = damp(st.w || 5, firing ? 46 : 6 + st.pulse * 18, 4, dt); st.rot += st.w * dt; P.saw.rotation.x = st.rot; if (firing) G.heat = Math.min(1, G.heat + dt * 1.2);
      st.seq = -9;
      if (st.ctx && rnd() < dt * (firing ? 60 : 4)) { const a = rnd() * 1.2 + 0.3; st.ctx.shard([-0.012, 0.05 + Math.cos(a) * 0.13, -0.43 + Math.sin(a) * 0.13], [(rnd() - 0.5) * 0.8, 0.8 + rnd(), -1.4 * rnd()], rnd() < 0.5 ? 0xffffff : G.hex, 0.45); }
    },
    fire(P, st, ctx, G) { if (ctx) for (let i = 0; i < 4; i++) ctx.shard([-0.012, 0.05, -0.55], [(rnd() - 0.5) * 1.2, rnd() * 1.6, -1.2 - rnd()], i % 2 ? 0xffffff : G.hex, 0.8); },
  });
}

/* ═════════════ 21 · PULSAR — platillo emisor, esfera central en órbita y ondas que se expanden ═════════════ */
function pulsar(q, hands) {
  return make(21, q, hands, {
    muzzle: [0, 0.045, -0.66], flash: { shape: 'pulse', size: 1.25, decay: 7 }, recoil: { z: 0.08, y: 0.01, pitch: 0.2, roll: 0.03, k: 150, c: 13 }, view: { ...VIEW_L, scale: 0.97 }, heat: 0.4, kv: 1.0, cool: 0.45,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.14, 0.072], [0.1, 0.078], [0.15, 0.05], [0.15, -0.012], [-0.14, -0.012], [-0.16, 0.03]], 0.06, 0, { c: B });
      k.prof('b', [[-0.14, 0.058], [-0.23, 0.035], [-0.25, -0.03], [-0.2, -0.04], [-0.14, -0.02]], 0.04, 0, { c: DARK, holes: [[[-0.18, 0.036], [-0.28, 0.026], [-0.3, -0.03], [-0.2, -0.02]]] });
      k.cyl('b', [0.036, 0.046, 0.2], [0, 0.045, -0.22], { c: GUN, seg: 10 });
      k.cyl('b', [0.098, 0.03, 0.1], [0, 0.045, -0.35], { c: B, seg: q.low ? 10 : 18 });                                      // platillo emisor
      k.tor('l', [0.099, 0.0055], [0, 0.045, -0.4], { k: 0, seg: q.low ? 10 : 18 }); k.cyl('l', [0.084, 0.084, 0.006], [0, 0.045, -0.4], { k: 0, seg: q.low ? 10 : 18 });
      for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3 + PI / 2; k.limb('b', [Math.cos(a) * 0.09, 0.045 + Math.sin(a) * 0.09, -0.4], [Math.cos(a) * 0.064, 0.045 + Math.sin(a) * 0.064, -0.64], 0.01, 0.007, { c: A, ball: true }); }
      k.tor('b', [0.064, 0.009], [0, 0.045, -0.64], { c: B, seg: q.low ? 10 : 18 });
      for (let i = 0; i < 6; i++) { const a = i * PI / 3; k.poly('l', 'oct', 0.007, [Math.cos(a) * 0.064, 0.045 + Math.sin(a) * 0.064, -0.648], { k: 1, r: [0, 0, a], s: [0.8, 1.4, 0.8] }); }
      lights(k, -0.0315, 0.0, -0.1); bezel(k, [-0.0325, 0.04, 0.09], [0, -PI / 2 + 0.3, 0], 0.07, 0.04);
      const info = hand(k, G, hands, -0.012, [[0, 0.045, -0.2], 0.04]);
      info.screen = { pos: [-0.0345, 0.04, 0.09], rot: [0, -PI / 2 + 0.3, 0], scale: 1.25 };
      k.part('core', [0, 0.045, -0.5]); k.poly('l', 'ico', 0.05, [0, 0.045, -0.5], { k: 1 }); k.poly('l', 'oct', 0.026, [0, 0.045, -0.5], { k: 0, c: 0xffffff });
      k.part('gyro', [0, 0.045, -0.5]); for (let i = 0; i < 2; i++) k.tor('l', [0.074, 0.0045], [0, 0.045, -0.5], { k: 0, r: [i * 1.1 + 0.3, i * 1.6, 0], seg: 20 });
      k.part('waves', [0, 0.045, -0.64]); for (let i = 0; i < 3; i++) k.tor('l', [0.05, 0.0045], [0, 0.045, -0.64 - i * 0.12], { k: 0, seg: q.low ? 12 : 24 });
      return info;
    },
    anim(P, st, dt, t, firing) {
      P.core.rotation.set(t * 1.4, t * 2.1, 0); P.core.scale.setScalar(1 + 0.08 * Math.sin(t * 6) + st.pulse * 0.3);
      P.gyro.rotation.set(t * (0.8 + st.pulse * 6), t * 1.3, t * 0.5);
      const e = clamp(st.t0 / 0.9, 0, 1); P.waves.visible = e < 1 || firing; const ee = firing ? (t * 1.3) % 1 : easeOut(e);
      P.waves.position.z = P.waves.userData.base.z - ee * 0.55; P.waves.scale.setScalar(0.7 + ee * 1.9);
    },
    fire(P, st, ctx, G) { burst(ctx, G.hex, -0.66, 3, 0.045); },
  });
}

/* ═════════════ 22 · DARDOS — ballesta: brazos del arco, cuerda que se suelta y 3 dardos de cristal ═════════════ */
function dardos(q, hands) {
  return make(22, q, hands, {
    muzzle: [0, 0.092, -0.6], flash: { shape: 'quad', size: 0.95, decay: 10 }, recoil: { z: 0.06, y: 0.01, pitch: 0.13, roll: 0.03, k: 190, c: 15 }, view: { ...VIEW_L, scale: 0.98 }, heat: 0.3, kv: 0.9, cool: 0.5,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.14, 0.07], [0.1, 0.076], [0.16, 0.05], [0.16, -0.012], [-0.14, -0.012], [-0.16, 0.03]], 0.06, 0, { c: B });
      k.prof('b', [[-0.14, 0.058], [-0.24, 0.036], [-0.26, -0.03], [-0.2, -0.04], [-0.14, -0.02]], 0.04, 0, { c: DARK });
      k.box('b', [0.09, 0.014, 0.42], [0, 0.083, -0.29], { c: GUN, rad: 0.004 });                                             // rampa de dardos
      for (const x of [-0.045, 0.045]) k.box('b', [0.006, 0.02, 0.42], [x, 0.092, -0.29], { c: B, rad: 0.002 });
      for (const sx of [-1, 1]) {                                                                                             // brazos del arco
        const P = [[sx * 0.04, 0.056, -0.2], [sx * 0.095, 0.06, -0.25], [sx * 0.15, 0.062, -0.32], [sx * 0.195, 0.062, -0.41], [sx * 0.205, 0.06, -0.5]];
        for (let i = 0; i < 4; i++) k.limb('b', P[i], P[i + 1], 0.016 - i * 0.003, 0.016 - (i + 1) * 0.003, { c: i % 2 ? A : B, ball: true, seg: 7 });
        k.sph('l', 0.011, P[4], { k: 1 }); k.limb('l', P[1], P[3], 0.0035, 0.0035, { k: 0, seg: 4 });
      }
      k.box('b', [0.1, 0.022, 0.034], [0, 0.056, -0.2], { c: B, rad: 0.006 }); k.box('l', [0.02, 0.006, 0.012], [0, 0.07, -0.2], { k: 2 });
      k.box('b', [0.014, 0.02, 0.05], [0, 0.116, -0.05], { c: GUN }); k.cyl('l', [0.007, 0.007, 0.006], [0, 0.122, -0.078], { k: 2, seg: 6 }); // punto rojo
      k.cyl('b', [0.028, 0.028, 0.2], [0, 0.0, -0.24], { c: GUN });
      lights(k, -0.0315, 0.0, -0.1); bezel(k, [-0.0325, 0.04, 0.09], [0, -PI / 2 + 0.3, 0], 0.07, 0.04);
      const info = hand(k, G, hands, -0.012, [[0, 0.0, -0.24], 0.028]);
      info.screen = { pos: [-0.0345, 0.04, 0.09], rot: [0, -PI / 2 + 0.3, 0], scale: 1.25 };
      k.part('string', [0, 0.06, -0.48]);                                                                                     // cuerda: en V (tensa) y se endereza al soltarla
      k.limb('l', [-0.205, 0.06, -0.5], [0, 0.07, -0.2], 0.0032, 0.0032, { k: 0, seg: 4 }); k.limb('l', [0.205, 0.06, -0.5], [0, 0.07, -0.2], 0.0032, 0.0032, { k: 0, seg: 4 }); k.sph('l', 0.007, [0, 0.07, -0.2], { k: 1 });
      k.part('darts', [0, 0.09, -0.3]);                                                                                       // 3 dardos de cristal
      for (const [x, y] of [[0, 0.108], [-0.026, 0.1], [0.026, 0.1]]) { k.limb('l', [x, y, -0.16], [x, y, -0.5], 0.0075, 0.0075, { k: 1, seg: 5 }); k.cyl('l', [0.0006, 0.0085, 0.07], [x, y, -0.535], { k: 1, seg: 5 }); for (let j = 0; j < 3; j++) { const a = j * PI * 2 / 3; k.box('b', [0.004, 0.018, 0.04], [x + Math.cos(a) * 0.01, y + Math.sin(a) * 0.01, -0.18], { c: A, r: [0, 0, a + PI / 2] }); } }
      return info;
    },
    anim(P, st) {
      if (st.n === 0) { P.string.scale.z = 1; P.darts.visible = true; P.darts.scale.setScalar(1); P.darts.position.z = P.darts.userData.base.z; return; }
      P.string.scale.z = Math.max(0.001, easeOut((st.t0 - 0.35) / 0.45));
      const d = clamp((st.t0 - 0.5) / 0.4, 0, 1); P.darts.visible = d > 0; P.darts.scale.setScalar(Math.max(0.001, easeOut(d))); P.darts.position.z = P.darts.userData.base.z + (1 - easeOut(d)) * 0.1;
    },
    fire(P, st, ctx, G) { if (ctx) { for (let i = 0; i < 3; i++) ctx.shard([(i - 1) * 0.026, 0.1, -0.55], [(i - 1) * 0.5, 0.2, -2.2], G.hex, 0.9); burst(ctx, G.hex, -0.6, 2, 0.09); } },
  });
}

/* ═════════════ 23 · REQUIEM — rifle ceremonial largo, marfil y oro, con hoja de guadaña de cristal ═════════════ */
function requiem(q, hands) {
  return make(23, q, hands, {
    muzzle: [0, 0.05, -1.0], flash: { shape: 'scythe', size: 1.2, decay: 8 }, recoil: { z: 0.12, y: 0.018, pitch: 0.22, roll: 0.02, k: 125, c: 13 }, view: { ...VIEW_L, scale: 0.84, zs: 0.45, pos: [0.25, -0.26, -0.66] }, heat: 0.5, kv: 1.1, cool: 0.4,
    build(k, G, hands) {
      const { hex } = G, IV = 0xd9d2ec, GD = 0xe3bd62, DK = 0x2b2540;
      k.prof('b', [[-0.18, 0.076], [0.14, 0.086], [0.2, 0.056], [0.2, -0.02], [-0.18, -0.015]], 0.055, 0, { c: IV });
      for (const sx of [-1, 1]) { k.box('b', [0.004, 0.04, 0.22], [sx * 0.0285, 0.04, -0.03], { c: GD }); k.box('l', [0.003, 0.006, 0.17], [sx * 0.0305, 0.058, -0.03], { k: 0 }); }
      k.prof('b', [[-0.18, 0.07], [-0.55, 0.05], [-0.6, -0.14], [-0.5, -0.15], [-0.4, -0.04], [-0.18, -0.03]], 0.04, 0, { c: DK, holes: [[[-0.23, 0.045], [-0.5, 0.034], [-0.52, -0.09], [-0.42, -0.015], [-0.23, 0.0]]] });
      k.prof('b', [[-0.18, 0.072], [-0.3, 0.064], [-0.3, 0.056], [-0.18, 0.064]], 0.046, 0, { c: GD });
      k.poly('l', 'oct', 0.03, [0, 0.0, 0.34], { k: 1, s: [0.55, 0.6, 1.8], r: [0.12, 0, 0] }); k.box('l', [0.044, 0.14, 0.01], [0, -0.04, 0.6], { k: 0 }); k.box('b', [0.05, 0.15, 0.008], [0, -0.04, 0.61], { c: GD });
      k.cyl('b', [0.017, 0.021, 0.8], [0, 0.05, -0.6], { c: IV, seg: q.low ? 8 : 12 });                                     // cañón largo
      for (const z of [-0.3, -0.5, -0.7, -0.9]) { k.cyl('b', [0.027, 0.027, 0.012], [0, 0.05, z], { c: GD, seg: q.low ? 8 : 12 }); k.tor('l', [0.0285, 0.002], [0, 0.05, z - 0.007], { k: 0, seg: 12 }); }
      k.cyl('b', [0.032, 0.024, 0.04], [0, 0.05, -0.975], { c: GD, seg: 10 });
      k.tor('b', [0.016, 0.0035], [0, 0.13, -0.08], { c: GD }); k.tor('b', [0.014, 0.003], [0, 0.12, -0.8], { c: GD }); k.limb('b', [0, 0.086, -0.08], [0, 0.13, -0.08], 0.005, 0.005, { c: GD }); // mira
      k.cyl('b', [0.03, 0.03, 0.26], [0, 0.0, -0.5], { c: IV });                                                           // guardamanos
      for (const z of [-0.4, -0.6]) k.cyl('b', [0.034, 0.034, 0.012], [0, 0.0, z], { c: GD });
      for (let i = 0; i < 4; i++) { k.limb('b', [0, -0.08 - i * 0.03, 0.54], [(i % 2 ? 1 : -1) * 0.012, -0.11 - i * 0.03, 0.54], 0.004, 0.003, { c: GD }); } // borla
      k.sph('l', 0.012, [0.0, -0.215, 0.54], { k: 1 });
      lights(k, -0.0275, 0.0, -0.1); bezel(k, [-0.0285, 0.04, 0.09], [0, -PI / 2 + 0.3, 0], 0.065, 0.038);
      const info = hand(k, G, hands, -0.012, [[0, 0.0, -0.5], 0.03]);
      info.screen = { pos: [-0.0305, 0.04, 0.09], rot: [0, -PI / 2 + 0.3, 0], scale: 1.15 };
      // hoja de guadaña: sube desde la boca y se curva hacia adelante
      k.part('blade', [0, 0.05, -0.97]);
      const pts = [[0.05, -0.97], [0.14, -0.985], [0.25, -1.03], [0.33, -1.1], [0.37, -1.19], [0.35, -1.28], [0.28, -1.34], [0.2, -1.36]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [y0, z0] = pts[i], [y1, z1] = pts[i + 1], r0 = 0.02 * (1 - i / pts.length) + 0.003, r1 = 0.02 * (1 - (i + 1) / pts.length) + 0.002;
        k.limb('l', [0, y0, z0], [0, y1, z1], r0, r1, { k: 1, seg: 6, s: [0.32, 1, 1], ball: i === 0 });
        k.limb('b', [0.003, y0 + 0.006, z0 + 0.012], [0.003, y1 + 0.006, z1 + 0.012], 0.0035, 0.0025, { c: GD, seg: 4 });
      }
      k.limb('l', [0, pts[1][0], pts[1][1] + 0.012], [0, 0.3, -1.2], 0.003, 0.003, { k: 0, seg: 4 });
      k.cyl('b', [0.026, 0.02, 0.05], [0, 0.065, -0.975], { c: GD, seg: 8 });
      return info;
    },
    anim(P, st, dt, t) { P.blade.rotation.x = Math.sin(t * 1.3) * 0.012 - st.pulse * 0.06; P.blade.scale.set(1, 1 + st.pulse * 0.05, 1 + st.pulse * 0.08); },
    fire(P, st, ctx, G) { if (ctx) { burst(ctx, G.hex, -1.0, 3, 0.05); for (let i = 0; i < 4; i++) ctx.shard([0, 0.3 + rnd() * 0.1, -1.1 - rnd() * 0.2], [(rnd() - 0.5) * 0.8, 0.6 + rnd(), -0.5], i % 2 ? 0xffd98a : 0xffffff, 0.9); } },
  });
}

/* ═════════════ 24 · QUIMERA — collage caótico: tubos de escopeta, jaula de cohete, cañones giratorios, bobina y cristales que cambian ═════════════ */
function quimera(q, hands) {
  return make(24, q, hands, {
    muzzle: [0, 0.05, -0.74], flash: { shape: 'chaos', size: 1.1, decay: 8 }, recoil: { z: 0.1, y: 0.02, pitch: 0.24, roll: 0.06, k: 130, c: 11 }, view: { ...VIEW_L, scale: 0.95 }, heat: 0.4, kv: 1.1, cool: 0.4,
    build(k, G, hands) {
      const { hex } = G, C1 = 0xff66c4, C2 = 0x40e0ff, C3 = 0xffd34a, C4 = 0x9a7bff, C5 = 0x7dff7a;
      k.prof('b', [[-0.16, 0.078], [0.12, 0.088], [0.17, 0.045], [0.17, -0.015], [-0.16, -0.012], [-0.18, 0.03]], 0.085, 0, { c: C1 });
      k.prof('b', [[-0.16, 0.06], [-0.26, 0.035], [-0.28, -0.04], [-0.21, -0.05], [-0.16, -0.02]], 0.05, 0, { c: DARK }); k.poly('l', 'oct', 0.03, [0, 0.0, 0.3], { k: 1, s: [0.5, 0.55, 1.6] });
      for (const [x, y, c] of [[-0.065, 0.03, C2], [-0.095, 0.06, C3], [-0.05, 0.075, C4]]) { k.cyl('b', [0.017, 0.017, 0.34], [x, y, -0.34], { c, seg: 9 }); k.cyl('l', [0.011, 0.011, 0.006], [x, y, -0.512], { k: 1, seg: 7 }); } // tubos de escopeta (izq.)
      for (const z of [-0.22, -0.4]) k.box('b', [0.06, 0.07, 0.014], [-0.07, 0.055, z], { c: DARK, rad: 0.004 });
      k.box('b', [0.02, 0.05, 0.3], [0.055, 0.045, -0.2], { c: C3, rad: 0.004 }); k.box('l', [0.003, 0.026, 0.24], [0.0655, 0.045, -0.2], { k: 0 }); k.prof('b', [[-0.12, 0.0], [0.22, 0.0], [0.26, 0.03], [0.22, 0.05], [-0.12, 0.05]].map(([u, v]) => [u, v]), 0.014, 0.075, { c: C4 }); // riel derecho
      for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; k.limb('b', [Math.cos(a) * 0.03, 0.135 + Math.sin(a) * 0.0, -0.1 + Math.sin(a) * 0.03], [Math.cos(a) * 0.05, 0.19, -0.1 + Math.sin(a) * 0.05], 0.007, 0.005, { c: C2, ball: true }); } // jaula
      k.tor('b', [0.056, 0.005], [0, 0.19, -0.1], { c: PALE, r: [PI / 2, 0, 0] }); k.box('b', [0.1, 0.012, 0.1], [0, 0.092, -0.1], { c: DARK });
      k.cyl('b', [0.012, 0.014, 0.4], [0, 0.05, -0.45], { c: GUN, seg: 8 });                                                  // bobina de aguja
      for (let i = 0; i < 4; i++) k.tor('l', [0.046, 0.0065], [0, 0.05, -0.3 - i * 0.1], { k: 3, seg: q.low ? 9 : 14 });
      lights(k, -0.0425, 0.0, -0.1); bezel(k, [-0.0435, 0.04, 0.1], [0, -PI / 2 + 0.3, 0], 0.07, 0.04);
      const info = hand(k, G, hands, -0.012, [[0, 0.0, -0.3], 0.034]);
      k.cyl('b', [0.034, 0.034, 0.2], [0, 0.0, -0.3], { c: C5 }); for (const z of [-0.23, -0.37]) k.cyl('b', [0.038, 0.038, 0.012], [0, 0.0, z], { c: C1 });
      info.screen = { pos: [-0.0455, 0.04, 0.1], rot: [0, -PI / 2 + 0.3, 0], scale: 1.25 };
      k.part('barrels', [0, 0.05, -0.55]);                                                                                    // 3 cañones giratorios
      for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3, x = Math.cos(a) * 0.032, y = 0.05 + Math.sin(a) * 0.032; k.cyl('b', [0.011, 0.011, 0.34], [x, y, -0.58], { c: [C1, C3, C2][i], seg: 8 }); k.cyl('l', [0.007, 0.007, 0.006], [x, y, -0.752], { k: 1, seg: 6 }); }
      for (const z of [-0.45, -0.62, -0.73]) { k.cyl('b', [0.05, 0.05, 0.016], [0, 0.05, z], { c: DARK, seg: 12 }); k.tor('l', [0.05, 0.0025], [0, 0.05, z - 0.008], { k: 0, seg: 12 }); }
      k.part('gyro', [0, 0.19, -0.1]); for (let i = 0; i < 3; i++) k.tor('l', [0.044, 0.004], [0, 0.19, -0.1], { k: 0, r: [i * PI / 3 + 0.4, i * PI / 3, 0], seg: 18 });
      k.poly('l', 'ico', 0.026, [0, 0.19, -0.1], { k: 1 });
      return info;
    },
    anim(P, st, dt, t, firing, G) {
      st.w = damp(st.w || 2, firing ? 20 : 2, 3, dt); st.rot += st.w * dt; P.barrels.rotation.z = st.rot; P.gyro.rotation.set(t * 1.6, t * 2.2, t); P.gyro.scale.setScalar(1 + st.pulse * 0.3);
      const u = G.mats.glow.uniforms; u.uColor.value.setHSL((t * 0.14) % 1, 0.9, 0.6); u.uHue.value = (t * 0.25) % 1; st.seq = -0.3 - ((t * 1.5) % 1) * 0.4;
    },
    fire(P, st, ctx, G) { if (ctx) { for (let i = 0; i < 5; i++) ctx.shard([(rnd() - 0.5) * 0.1, 0.05 + (rnd() - 0.5) * 0.1, -0.6 - rnd() * 0.2], [(rnd() - 0.5) * 2, (rnd() - 0.3) * 1.5, -1], new THREE.Color().setHSL(rnd(), 0.9, 0.6).getHex(), 1); burst(ctx, new THREE.Color().setHSL(rnd(), 0.9, 0.6).getHex(), -0.74, 3, 0.05); } },
  });
}

export const NEW = [voltaico, glacial, plaga, brasa, mina, sierra, pulsar, dardos, requiem, quimera];
