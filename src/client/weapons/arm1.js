// Armería 1/3 — Haz (0), Prisma (1), Ráfaga (2), Nova (3), Aguja (4).
import { rightHand, supportHand } from './hands.js';
import { forge, grip, plate, armor, stripe, piping, inset, DEC, rail, holo, fins, bolts, screenAt, crownRing, stock, stock2, shroud, clamp, damp, easeOut, easeInOut, Spring, PI, puffs, casing } from './forge.js';

const VS = { pos: [0.3, -0.25, -0.58], scale: 2.2, zs: 0.7, rot: [-0.02, 0.45, -0.02] };       // armas cortas
const VL = { pos: [0.32, -0.3, -0.62], scale: 2.2, zs: 0.55, rot: [-0.02, 0.5, -0.03] };         // armas largas

/* ═════════════ 0 · HAZ — pistola de prisma: corredera angular con un prisma de cristal a la vista ═════════════ */
export function haz(q, hands) {
  return forge(0, q, hands, {
    muzzle: [0, 0.04, -0.56], eject: [0.03, 0.07, 0.03], flash: { shape: 'star', size: 0.55, decay: 13 },
    recoil: { z: 0.07, y: 0.014, pitch: 0.2, roll: 0.03, k: 210, c: 17 }, view: VS, heat: 0.38, kv: 2.6, cool: 0.55, bdec: 7,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      // — armazón fijo: guardapolvo con riel, módulo de luz, empuñadura
      k.loft('b', [{ z: 0.1, w: 0.044, h: 0.034, y: -0.012, ch: 0.007 }, { z: -0.06, w: 0.044, h: 0.034, y: -0.012, ch: 0.007 }, { z: -0.28, w: 0.04, h: 0.03, y: -0.016, ch: 0.007 }], { c: P.gm3 });
      for (let i = 0; i < 4; i++) k.cbox('b', [0.046, 0.004, 0.008], [0, -0.03, -0.1 - i * 0.045], { c: P.dk, ch: 0.001 });
      k.cbox('b', [0.038, 0.032, 0.055], [0, -0.042, -0.205], { c: P.dom2, ch: 0.007 });                          // módulo bajo el cañón
      k.cbox('l', [0.022, 0.018, 0.004], [0, -0.042, -0.235], { k: 1, ch: 0.002 });                               // lente del módulo
      for (let i = 0; i < 3; i++) k.box('l', [0.005, 0.008, 0.014], [-0.0235, -0.012, -0.075 - i * 0.02], { k: 2 }); // luces de estado
      armor(k, P, -1, [[0.03, -0.004], [0.2, -0.004], [0.225, -0.022], [0.03, -0.022]], 0.0225, { c: P.dom2, dec: DEC.nervadura, step: false, w: 0.004 });
      const gh = grip(k, P, 0.0, { len: 0.19 }); let pivot = null; if (hands) pivot = rightHand(k, gh, hex);
      // — cañón y compensador de dos púas (fijos)
      k.cyl('b', [0.0155, 0.0155, 0.2], [0, 0.036, -0.4], { c: P.st, seg: 8 });
      k.loft('b', [{ z: -0.43, w: 0.038, h: 0.042, y: 0.036, ch: 0.009 }, { z: -0.5, w: 0.034, h: 0.036, y: 0.036, ch: 0.008 }], { c: P.dom });
      for (const sx of [-1, 1]) k.loft('b', [{ z: -0.48, w: 0.008, h: 0.044, x: sx * 0.019, y: 0.036, ch: 0.002 }, { z: -0.56, w: 0.005, h: 0.022, x: sx * 0.016, y: 0.036, ch: 0.001 }], { c: P.pale });
      k.gem('l', [0.009, 0.034], [0, 0.036, -0.51], { k: 1, n: 5, axis: 'z' });                                     // emisor entre las púas
      // — corredera (retrocede): bloque trasero, ventana, bloque delantero; el PRISMA asoma por encima como una aleta de cristal
      k.part('slide', [0, 0.03, 0]);
      k.prof('b', [[-0.15, 0.02], [-0.15, 0.058], [-0.12, 0.078], [-0.04, 0.082], [0.0, 0.078], [0.035, 0.078], [0.035, 0.012], [-0.125, 0.012]], 0.05, 0, { c: P.gm, bevel: 0.006 });
      k.prof('b', [[0.15, 0.012], [0.15, 0.082], [0.2, 0.082], [0.265, 0.062], [0.3, 0.042], [0.3, 0.028], [0.27, 0.012]], 0.05, 0, { c: P.gm, bevel: 0.006 });
      k.cbox('b', [0.05, 0.01, 0.12], [0, 0.017, -0.092], { c: P.dk, ch: 0.002 });                                 // piso de la ventana
      for (const sx of [-1, 1]) {
        k.cbox('b', [0.006, 0.02, 0.12], [sx * 0.022, 0.027, -0.092], { c: P.dom2, ch: 0.002 });                   // rieles bajos de la ventana
        armor(k, P, sx, [[-0.11, 0.02], [-0.11, 0.07], [-0.03, 0.078], [0.0, 0.05], [-0.02, 0.02]], 0.0265, { dec: DEC.circuito, dec2: 0 });   // placa trasera
        armor(k, P, sx, [[0.175, 0.02], [0.175, 0.078], [0.235, 0.074], [0.285, 0.044], [0.255, 0.02]], 0.0265, { dec: DEC.rombos });          // placa delantera
        stripe(k, P, sx, 0.0285, [-0.105, 0.026], [-0.01, 0.026], 0.0035);
        stripe(k, P, sx, 0.0285, [0.18, 0.026], [0.26, 0.026], 0.0035);
        k.box('l', [0.004, 0.004, 0.085], [sx * 0.0285, 0.071, 0.01], { k: 0 });                                    // vena luminosa del lomo
      }
      for (const z of [-0.045, -0.14]) k.cbox('b', [0.058, 0.014, 0.012], [0, 0.056, z], { c: P.st, ch: 0.003 });   // abrazaderas
      k.gem('l', [0.03, 0.095], [0, 0.075, -0.092], { k: 1, n: 6, axis: 'z', tip: 0.3 });                         // PRISMA
      k.gem('l', [0.014, 0.04], [0, 0.075, -0.092], { k: 0, n: 6, axis: 'z', tip: 0.3, twist: 0.5 });
      k.cbox('b', [0.052, 0.006, 0.05], [0, 0.0825, 0.065], { c: P.dom2, ch: 0.002 });
      for (let i = 0; i < (low ? 3 : 5); i++) k.box('b', [0.054, 0.05, 0.004], [0, 0.047, 0.14 - i * 0.012], { c: P.dk, sharp: true });
      for (const sx of [-1, 1]) k.cbox('b', [0.005, 0.01, 0.01], [sx * 0.013, 0.088, 0.135], { c: P.st, ch: 0.002 });    // alza
      k.gem('b', [0.007, 0.012], [0, 0.092, -0.285], { n: 4, axis: 'y', c: P.acc });                              // punto de mira
      // cara trasera de la corredera (la cámara la ve): ranuras y cristal de estado
      k.cbox('b', [0.04, 0.05, 0.004], [0, 0.047, 0.152], { c: P.gm3, ch: 0.004 }); for (const x of [-0.012, 0, 0.012]) k.box('b', [0.004, 0.034, 0.003], [x, 0.047, 0.1545], { c: P.dk, sharp: true });
      k.gem('l', [0.006, 0.012], [0, 0.074, 0.154], { k: 2, n: 4, axis: 'y' });
      // — anillo emisor que gira alrededor del cañón
      k.part('ring', [0, 0.036, -0.4]);
      crownRing(k, P, [0, 0.036, -0.4], 0.04, low ? 5 : 6, { tube: 0.0045, gemR: 0.0075 });
      const bz = 0.065; k.cbox('b', [0.006, 0.042, 0.082], [-0.0265, 0.047, bz], { c: P.dk, ch: 0.002 });
      return { gh, pivot, screen: { on: 'slide', pos: [-0.0298, 0.017, bz], rot: [0, -PI / 2 + 0.3, 0], scale: 0.95 }, fore: null };
    },
    anim(P, st, dt, t, firing, G) {
      st.s1.step(dt); P.slide.position.z = P.slide.userData.base.z + clamp(st.s1.x, -0.01, 0.065);
      st.w = damp(st.w, firing ? 16 : 3.2, 4, dt); st.rot += st.w * dt; P.ring.rotation.z = st.rot; P.ring.position.z = P.ring.userData.base.z + st.kick.x * 0.3;
    },
    fire(P, st, ctx, G) { st.s1.v += 2.6; st.w += 12; casing(ctx, G.hex, [0.03, 0.07, 0.03], [0.9, 1.1, 0.5]); puffs(ctx, G.hex, -0.55, 2, 0.04, { size: 0.09, alpha: 0.5 }); if (ctx) ctx.puff([0, 0.1, -0.12], [0, 0.18, 0.02], 0xffffff, { size: 0.05, grow: 0.12, life: 0.3, alpha: 0.28 }); },
  });
}

/* ═════════════ 1 · PRISMA — escopeta de corredera de tres cañones con corona de cristal ═════════════ */
export function prisma(q, hands) {
  return forge(1, q, hands, {
    muzzle: [0, 0.03, -0.76], eject: [0.034, 0.05, 0.0], flash: { shape: 'fan', size: 1.0, decay: 9 },
    recoil: { z: 0.17, y: 0.035, pitch: 0.4, roll: 0.045, k: 120, c: 11 }, view: VL, heat: 0.7, kv: 1.0, cool: 0.4, bdec: 6,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      // receptor con lomo escalonado y placas de color
      k.prof('b', [[-0.2, -0.012], [-0.2, 0.07], [-0.13, 0.096], [0.09, 0.098], [0.16, 0.072], [0.16, -0.034], [0.0, -0.036], [-0.14, -0.025]], 0.064, 0, { c: P.gm, bevel: 0.006 });
      for (const sx of [-1, 1]) {
        armor(k, P, sx, [[-0.05, -0.005], [-0.05, 0.084], [0.07, 0.09], [0.11, 0.05], [0.1, -0.005]], 0.0345, { dec: DEC.circuito });
        k.cbox('b', [0.004, 0.034, 0.078], [sx * 0.0385, 0.04, -0.01], { c: P.dk, ch: 0.0015 });             // puerto de eyección
        k.box('l', [0.003, 0.012, 0.06], [sx * 0.0398, 0.04, -0.01], { k: 0 });
        armor(k, P, sx, [[-0.17, 0.0], [-0.17, 0.06], [-0.12, 0.085], [-0.09, 0.085], [-0.09, 0.0]], 0.0345, { c: P.dom2, c2: P.dk, dec: DEC.nervadura });
        stripe(k, P, sx, 0.0415, [-0.045, 0.002], [0.09, 0.002], 0.004);
      }
      for (let i = 0; i < 3; i++) k.box('l', [0.005, 0.008, 0.014], [-0.0355, 0.075 - i * 0.012, -0.085], { k: 2 });
      k.cbox('b', [0.006, 0.042, 0.075], [-0.0355, 0.03, 0.118], { c: P.dk, ch: 0.002 });
      rail(k, P, 0.1, 0.12, -0.2, 0.034, 0.03);
      k.cbox('b', [0.02, 0.014, 0.012], [0, 0.114, 0.12], { c: P.st, ch: 0.002 }); k.gem('b', [0.008, 0.016], [0, 0.098, -0.7], { n: 4, axis: 'y', c: P.acc }); // alza y punto de mira
      stock2(k, P, 'tubo', { z0: 0.2, len: 0.3, top: 0.068, bot: -0.1 });
      const gh = grip(k, P, -0.034, { len: 0.17 }); let pivot = null; if (hands) pivot = rightHand(k, gh, hex);
      // tres cañones en triángulo, abrazaderas hexagonales y puntas luminosas
      for (const [x, y] of [[0, 0.054], [-0.023, 0.016], [0.023, 0.016]]) { k.cyl('b', [0.0185, 0.0185, 0.62], [x, y, -0.43], { c: P.gm3, seg: 8 }); k.cyl('l', [0.0125, 0.0125, 0.006], [x, y, -0.742], { k: 0, seg: 8 }); }
      for (const [z, c] of [[-0.22, P.dom], [-0.4, P.dom2], [-0.56, P.dom]]) { k.cyl('b', [0.056, 0.056, 0.026], [0, 0.03, z], { c, seg: 6 }); k.tor('l', [0.056, 0.0025], [0, 0.03, z - 0.0135], { seg: 6, k: 0 }); }
      // tubo del cargador con cartuchos de energía
      k.limb('l', [0, -0.026, -0.14], [0, -0.026, -0.64], 0.0125, 0.0125, { k: 0, seg: 8 });
      for (const z of [-0.12, -0.64]) k.cyl('b', [0.022, 0.022, 0.03], [0, -0.026, z], { c: P.pale, seg: 10 });
      // corredera: antebrazo ranurado que sostiene la mano izquierda
      k.part('pump', [0, -0.026, -0.34]);
      k.loft('b', [{ z: -0.24, w: 0.08, h: 0.07, y: -0.026, ch: 0.02 }, { z: -0.44, w: 0.08, h: 0.07, y: -0.026, ch: 0.02 }], { c: P.dom2, edge: 1.5, u: DEC.nervadura });
      for (let i = 0; i < (low ? 3 : 6); i++) k.loft('b', [{ z: -0.27 - i * 0.026, w: 0.086, h: 0.076, y: -0.026, ch: 0.022 }, { z: -0.281 - i * 0.026, w: 0.086, h: 0.076, y: -0.026, ch: 0.022 }], { c: P.dk });
      k.box('l', [0.003, 0.012, 0.14], [-0.0415, -0.026, -0.34], { k: 0 }); k.box('l', [0.003, 0.012, 0.14], [0.0415, -0.026, -0.34], { k: 0 });
      if (hands) supportHand(k, [0, -0.026, -0.34], 0.036, hex);
      // corona de cristal que gira en la boca
      k.part('fan', [0, 0.03, -0.69]);
      k.tor('l', [0.06, 0.006], [0, 0.03, -0.69], { k: 0, seg: 12 });
      for (let i = 0; i < (low ? 6 : 9); i++) { const a = i * PI * 2 / (low ? 6 : 9); k.gem('l', [0.0085, 0.0145], [Math.cos(a) * 0.06, 0.03 + Math.sin(a) * 0.06, -0.69], { k: 1, n: 4, axis: 'y', r: [0, 0, a - PI / 2 + PI] }); }
      return { gh, pivot, screen: { on: 'main', pos: [-0.0385, 0.03, 0.118], rot: [0, -PI / 2 + 0.3, 0], scale: 1.2 }, fore: [0, -0.026, -0.34] };
    },
    anim(P, st, dt, t, firing) {
      let off = 0; const pt = st.t0 - 0.16, p = pt / 0.46;
      if (p >= 0 && p < 1) off = p < 0.45 ? easeOut(p / 0.45) : 1 - easeInOut((p - 0.45) / 0.55);
      if (p > 0.4 && p < 0.6 && !st.ej && st.ctx) { st.ej = true; st.ctx.shard([0.034, 0.05, 0.0], [1.4, 1.5, 0.6], 0xff8fd0, 2.2); st.ctx.shard([0.034, 0.05, 0.0], [1.0, 1.9, 0.9], 0xffffff, 1.2); st.ctx.puff([0.04, 0.05, 0.0], [0.25, 0.3, 0.1], 0xff8fd0, { size: 0.07, grow: 0.2, life: 0.4, alpha: 0.35 }); }
      if (p < 0.3) st.ej = false;
      P.pump.position.z = P.pump.userData.base.z + off * 0.115;
      st.w = damp(st.w, firing ? 12 : 1.8, 3, dt); st.rot += st.w * dt; P.fan.rotation.z = st.rot;
    },
    fire(P, st, ctx, G) { st.w += 20; st.ej = false; if (ctx) for (let i = 0; i < 3; i++) ctx.puff([(i - 1) * 0.022, 0.03, -0.75], [(i - 1) * 0.18, 0.05, -0.5], G.hex, { size: 0.1, grow: 0.35, life: 0.45, alpha: 0.45 }); },
  });
}

/* ═════════════ 2 · RÁFAGA — ametralladora rotativa con tambor y carcasa de rayas de aviso ═════════════ */
export function rafaga(q, hands) {
  return forge(2, q, hands, {
    muzzle: [0, 0.045, -0.78], eject: [0.037, 0.045, 0.02], flash: { shape: 'jet', size: 0.5, decay: 26 },
    recoil: { z: 0.026, y: 0.004, pitch: 0.045, roll: 0.012, k: 300, c: 22 }, view: VL, heat: 0.05, kv: 0.5, cool: 0.3, bdec: 9,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      k.prof('b', [[-0.2, -0.02], [-0.2, 0.075], [-0.14, 0.1], [0.16, 0.1], [0.24, 0.062], [0.24, -0.03], [0.0, -0.038], [-0.12, -0.026]], 0.076, 0, { c: P.gm, bevel: 0.006 });
      for (const sx of [-1, 1]) {
        armor(k, P, sx, [[-0.02, 0.0], [-0.02, 0.092], [0.16, 0.096], [0.22, 0.06], [0.22, 0.0]], 0.0385, { dec: DEC.aviso, w: 0.005 });
        stripe(k, P, sx, 0.0415, [-0.015, 0.004], [0.2, 0.004], 0.005);
        armor(k, P, sx, [[-0.19, 0.0], [-0.19, 0.07], [-0.14, 0.095], [-0.05, 0.095], [-0.05, 0.0]], 0.0385, { c: P.dom2, c2: P.dk, dec: DEC.nervadura, w: 0.004 });
      }
      k.cbox('b', [0.006, 0.05, 0.085], [-0.0395, 0.045, 0.115], { c: P.dk, ch: 0.002 });                            // marco de la pantalla
      for (let i = 0; i < 3; i++) k.box('l', [0.005, 0.008, 0.014], [-0.041, 0.02, -0.0 + 0.0 - i * 0.022 + 0.01], { k: 2 });
      k.prof('b', [[-0.07, 0.1], [-0.045, 0.155], [0.13, 0.155], [0.17, 0.1]], 0.03, 0, { c: P.dk, bevel: 0.004, holes: [[[-0.04, 0.108], [-0.027, 0.141], [0.115, 0.141], [0.145, 0.108]]] }); // asa de transporte
      k.cbox('l', [0.026, 0.026, 0.006], [0, 0.126, -0.17], { k: 1, ch: 0.004 });                                       // lente
      k.cbox('b', [0.06, 0.03, 0.05], [0, 0.112, -0.19], { c: P.gm3, ch: 0.006 });
      if (!low) for (let i = 0; i < 4; i++) k.box('b', [0.05, 0.003, 0.014], [0, 0.1015, 0.1 - i * 0.035], { c: P.dk, sharp: true });
      stock2(k, P, 'plegable', { z0: 0.2, len: 0.24, top: 0.075, bot: -0.07 });
      const gh = grip(k, P, -0.036, { len: 0.16 }); let pivot = null; if (hands) pivot = rightHand(k, gh, hex);
      // tambor de munición bajo el arma: cristal visible por la tapa lateral
      k.cyl('b', [0.08, 0.08, 0.075], [0, -0.1, -0.16], { axis: 'x', c: P.gm3, seg: q.high ? 20 : 12 });
      k.cyl('b', [0.084, 0.084, 0.012], [-0.04, -0.1, -0.16], { axis: 'x', c: P.dom, seg: q.high ? 20 : 12 });
      k.cyl('b', [0.084, 0.084, 0.012], [0.04, -0.1, -0.16], { axis: 'x', c: P.dom, seg: q.high ? 20 : 12 });
      k.cyl('l', [0.056, 0.056, 0.004], [-0.0465, -0.1, -0.16], { axis: 'x', k: 1, seg: 14 });
      k.cbox('b', [0.05, 0.06, 0.06], [0, -0.045, -0.1], { c: P.dk, ch: 0.01 });                                         // guía de alimentación
      // carcasa fija con aletas y anillos de luz
      shroud(k, P, -0.2, -0.44, 0.045, 0.054, { c: P.dom2, step: 0.05 });
      for (const z of [-0.205, -0.435]) k.tor('l', [0.056, 0.0035], [0, 0.045, z], { k: 0 });
      for (const x of [-0.0555, 0.0555]) k.box('l', [0.004, 0.02, 0.12], [x, 0.045, -0.32], { k: 0 });
      if (hands) supportHand(k, [0, 0.045, -0.32], 0.054, hex);
      // 6 cañones giratorios con eje de energía
      k.part('barrels', [0, 0.045, -0.5]);
      for (let i = 0; i < 6; i++) { const a = i * PI / 3, x = Math.cos(a) * 0.032, y = 0.045 + Math.sin(a) * 0.032; k.cyl('b', [0.0108, 0.0108, 0.34], [x, y, -0.6], { c: i % 2 ? P.gm3 : P.st, seg: 8 }); k.cyl('l', [0.007, 0.007, 0.006], [x, y, -0.772], { k: i % 2 ? 1 : 0, seg: 6 }); }
      k.limb('l', [0, 0.045, -0.44], [0, 0.045, -0.765], 0.0095, 0.0095, { k: 0, seg: 8 });
      for (const [z, c] of [[-0.46, P.dom], [-0.61, P.dk], [-0.73, P.dom]]) { k.cyl('b', [0.048, 0.048, 0.02], [0, 0.045, z], { c, seg: low ? 10 : 12 }); k.tor('l', [0.048, 0.0022], [0, 0.045, z - 0.01], { k: 0, seg: 12 }); }
      // tambor interior de cristales que gira
      k.part('drum', [0, -0.1, -0.16]);
      for (let i = 0; i < 7; i++) { const a = i * PI * 2 / 7; k.gem('l', [0.0095, 0.016], [-0.0475, -0.1 + Math.sin(a) * 0.04, -0.16 + Math.cos(a) * 0.04], { k: 1, n: 4, axis: 'x', r: [a, 0, 0] }); }
      return { gh, pivot, screen: { on: 'main', pos: [-0.0428, 0.045, 0.115], rot: [0, -PI / 2 + 0.3, 0], scale: 1.3 }, fore: [0, 0.045, -0.32] };
    },
    anim(P, st, dt, t, firing, G) {
      st.since = (st.since ?? 9) + dt; const spin = firing || st.since < 0.18;
      st.w = damp(st.w, spin ? 42 : 0, spin ? 5 : 1.4, dt); st.rot += st.w * dt; P.barrels.rotation.z = -st.rot; st.wd = damp(st.wd || 0, st.w * 0.25, 4, dt); P.drum.rotation.x += st.wd * dt;
      st.shake = Math.max(0, (st.shake || 0) - dt * 14); st.s1.step(dt);
      P.barrels.position.x = P.barrels.userData.base.x + (Math.random() - 0.5) * 0.0025 * st.shake; P.barrels.position.y = P.barrels.userData.base.y + (Math.random() - 0.5) * 0.0025 * st.shake;
      P.main.position.z = clamp(st.s1.x, -0.01, 0.03) * 0.6; G.heat = Math.min(1, G.heat + st.w / 4000);
    },
    fire(P, st, ctx, G) { st.shake = 1; st.since = 0; st.w = Math.min(46, st.w + 6); st.s1.v += 0.5; if (ctx) { ctx.shard([0.037, 0.045, 0.02], [0.9 + Math.random() * 0.5, 0.7 + Math.random() * 0.8, 0.5 + Math.random() * 0.6], G.hex, 0.75); if (Math.random() < 0.4) ctx.puff([0, 0.045, -0.78], [0, 0.03, -0.1], G.hex, { size: 0.06, grow: 0.2, life: 0.28, alpha: 0.28 }); } },
  });
}

/* ═════════════ 3 · NOVA — lanzacohetes: tubo grueso, reactor en la cima y bidones de combustible ═════════════ */
export function nova(q, hands) {
  return forge(3, q, hands, {
    muzzle: [0, 0.07, -0.7], eject: null, flash: { shape: 'ball', size: 1.5, decay: 5.5 },
    recoil: { z: 0.2, y: 0.045, pitch: 0.5, roll: 0.05, k: 90, c: 9 }, view: { ...VL, scale: 2.0 }, heat: 0.9, kv: 1.6, cool: 0.28, bdec: 4,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low, sg = q.high ? 20 : 12;
      k.cyl('b', [0.07, 0.07, 0.26], [0, 0.07, 0.02], { c: P.gm3, seg: sg });                                    // tubo trasero
      k.cyl('b', [0.07, 0.07, 0.3], [0, 0.07, -0.26], { c: P.dom, seg: sg });                                    // tubo medio, color del arma
      k.cyl('b', [0.098, 0.07, 0.15], [0, 0.07, -0.55], { c: P.dom2, seg: sg });                                 // boca acampanada
      for (const z of [0.12, 0.0, -0.1, -0.12, -0.3, -0.4]) { k.cyl('b', [0.0755, 0.0755, 0.014], [0, 0.07, z], { c: P.dk, seg: sg }); k.tor('l', [0.0755, 0.0028], [0, 0.07, z - 0.007], { k: 0, seg: low ? 12 : 24 }); }
      k.tor('l', [0.098, 0.0065], [0, 0.07, -0.628], { k: 0, seg: low ? 14 : 28 });
      k.cyl('b', [0.074, 0.092, 0.1], [0, 0.07, 0.17], { c: P.gm, seg: sg }); k.cyl('l', [0.058, 0.058, 0.006], [0, 0.07, 0.222], { k: 0, seg: 12 }); k.tor('b', [0.09, 0.008], [0, 0.07, 0.22], { c: P.pale, seg: low ? 12 : 24 }); // escape trasero
      for (let i = 0; i < 6; i++) { const a = i * PI / 3; k.cbox('b', [0.012, 0.03, 0.06], [Math.cos(a) * 0.09, 0.07 + Math.sin(a) * 0.09, 0.19], { c: P.dom2, r: [0, 0, a - PI / 2], ch: 0.003 }); }
      // bidones de combustible a los costados (visible el líquido)
      for (const sx of [-1, 1]) {
        for (const y of [0.04, 0.1]) { k.cyl('b', [0.024, 0.024, 0.24], [sx * 0.105, y, -0.24], { c: P.gm3, seg: 10 }); k.cyl('l', [0.017, 0.017, 0.22], [sx * 0.105, y, -0.24], { k: 0, seg: 8 }); for (const z of [-0.14, -0.34]) k.cyl('b', [0.028, 0.028, 0.012], [sx * 0.105, y, z], { c: P.dk, seg: 10 }); }
        k.cbox('b', [0.05, 0.1, 0.02], [sx * 0.082, 0.07, -0.14], { c: P.dk, ch: 0.005 }); k.cbox('b', [0.05, 0.1, 0.02], [sx * 0.082, 0.07, -0.34], { c: P.dk, ch: 0.005 });
      }
      k.prof('b', [[-0.12, 0.0], [0.15, 0.0], [0.15, -0.04], [-0.12, -0.04]], 0.07, 0, { c: P.gm, bevel: 0.005 });
      const gh = grip(k, P, -0.04, { len: 0.17 }); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.07, -0.34], 0.074, hex, { flip: 0.7 }); }
      // jaula del reactor
      for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; k.limb('b', [Math.cos(a) * 0.03, 0.135, -0.12 + Math.sin(a) * 0.03], [Math.cos(a) * 0.056, 0.2, -0.12 + Math.sin(a) * 0.056], 0.008, 0.006, { c: P.st, ball: true }); }
      k.tor('b', [0.058, 0.005], [0, 0.245, -0.12], { c: P.pale, r: [PI / 2, 0, 0], seg: low ? 10 : 20 }); k.tor('b', [0.058, 0.005], [0, 0.19, -0.12], { c: P.pale, r: [PI / 2, 0, 0], seg: low ? 10 : 20 });
      for (let i = 0; i < 4; i++) { const a = i * PI / 2; k.cyl('b', [0.008, 0.008, 0.055], [Math.cos(a) * 0.058, 0.2175, -0.12 + Math.sin(a) * 0.058], { axis: 'y', c: P.gm3, seg: 6 }); }
      const scr = screenAt(k, P, [0, 0.1425, 0.04], 0, 0.062, 0.04, 1.12, 0.9);
      for (let i = 0; i < 3; i++) k.box('l', [0.008, 0.005, 0.01], [-0.02 + i * 0.02, 0.139, -0.02], { k: 2 });
      k.part('cage', [0, 0.22, -0.12]);
      for (let i = 0; i < 3; i++) k.tor('l', [0.047, 0.0042], [0, 0.22, -0.12], { k: 0, r: [i * PI / 3 + 0.4, i * PI / 3, 0], seg: low ? 12 : 22 });
      k.part('core', [0, 0.22, -0.12]);
      k.gem('l', [0.032, 0.045], [0, 0.22, -0.12], { k: 1, n: 6, axis: 'y' }); k.gem('l', [0.02, 0.03], [0, 0.22, -0.12], { k: 0, n: 5, axis: 'x', c: 0xffffff });
      // cohete cargado: la punta de cristal asoma por la boca
      k.part('rocket', [0, 0.07, -0.5]);
      k.cyl('b', [0.052, 0.052, 0.08], [0, 0.07, -0.52], { c: P.gm3 }); k.cyl('l', [0.003, 0.052, 0.12], [0, 0.07, -0.62], { k: 1, seg: 8 });
      for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3 + 1; k.cbox('b', [0.006, 0.05, 0.05], [Math.cos(a) * 0.05, 0.07 + Math.sin(a) * 0.05, -0.49], { c: P.dom, r: [0, 0, a - PI / 2], ch: 0.002 }); }
      return { gh, pivot, screen: { on: 'main', pos: [scr.pos[0], scr.pos[1], scr.pos[2]], rot: scr.rot, scale: scr.scale }, fore: [0, 0.07, -0.34] };
    },
    anim(P, st, dt, t, firing, G) {
      st.cw = damp(st.cw ?? 1.2, firing ? 7 : 1.2, 3, dt); P.cage.rotation.y += st.cw * dt; P.cage.rotation.x += st.cw * 0.4 * dt;
      st.cp = damp(st.cp || 0, firing ? 1 : 0, 5, dt); P.core.scale.setScalar(1 + 0.06 * Math.sin(t * 7) + st.cp * 0.18 - G.boost * 0.2); P.core.rotation.set(t * 1.7, t * 2.3, 0);
      const rt = st.t0, rk = clamp((rt - 0.35) / 0.7, 0, 1), rs = rt < 0.1 ? 1 : easeOut(rk);
      P.rocket.visible = rt < 0.06 || rt > 0.35; P.rocket.scale.setScalar(Math.max(0.01, rt < 0.06 ? 1 : rs)); P.rocket.position.z = P.rocket.userData.base.z + (1 - rs) * 0.1;
      st.steam = (st.steam || 0) - dt;
      if (st.steam > 0 && st.ctx && Math.random() < dt * 30) { const c = st.ctx; for (const sx of [-1, 1]) c.puff([sx * 0.11, 0.07, -0.28 + Math.random() * 0.08], [sx * 0.2, 0.18 + Math.random() * 0.1, -0.05], 0xffffff, { size: 0.07, grow: 0.3, life: 0.7, alpha: 0.2 }); c.puff([0, 0.07, 0.24], [0, 0.1, 0.35], G.hex, { size: 0.08, grow: 0.3, life: 0.5, alpha: 0.25 }); }
    },
    fire(P, st, ctx, G) { st.steam = 1.2; st.cw = (st.cw ?? 1.2) + 14; if (ctx) { for (let i = 0; i < 4; i++) ctx.puff([0, 0.07, -0.66], [(Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4 + 0.1, -0.5], i % 2 ? G.hex : 0xffffff, { size: 0.16, grow: 0.5, life: 0.8, alpha: 0.4 }); for (let i = 0; i < 3; i++) ctx.shard([0, 0.07, -0.65], [(Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5 + 0.4, -1.2], G.hex, 1.1); } },
  });
}

/* ═════════════ 4 · AGUJA — fusil de riel con bobinas, mira de cristal y bípode ═════════════ */
export function aguja(q, hands) {
  const COIL_Z = [-0.3, -0.45, -0.6, -0.75, -0.9, -1.05];
  return forge(4, q, hands, {
    muzzle: [0, 0.05, -1.32], eject: null, flash: { shape: 'ring', size: 1.0, decay: 8 },
    recoil: { z: 0.1, y: 0.015, pitch: 0.22, roll: 0.02, k: 140, c: 14 }, view: { ...VL, scale: 1.8, zs: 0.5 }, heat: 1.0, kv: 1.3, cool: 0.2, bdec: 3.2,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      k.prof('b', [[-0.16, -0.02], [-0.16, 0.085], [-0.1, 0.1], [0.1, 0.102], [0.23, 0.064], [0.23, -0.03], [0.0, -0.05]], 0.066, 0, { c: P.gm, bevel: 0.006 });
      for (const sx of [-1, 1]) { armor(k, P, sx, [[-0.1, -0.02], [-0.1, 0.092], [0.1, 0.094], [0.15, 0.06], [0.1, -0.02]], 0.0355, { dec: DEC.circuito, w: 0.005 }); armor(k, P, sx, [[0.14, -0.02], [0.14, 0.06], [0.215, 0.056], [0.215, -0.02]], 0.0355, { c: P.dom2, c2: P.dk, dec: DEC.nervadura, w: 0.004 }); }
      // banco de capacitores: tres cristales en una ventana del costado
      k.cbox('b', [0.006, 0.12, 0.07], [-0.0375, 0.03, 0.02 - 0.05 + 0.0], { c: P.dk, ch: 0.002 });
      for (let i = 0; i < 3; i++) k.gem('l', [0.012, 0.024], [-0.043, -0.012 + i * 0.044, -0.03], { k: 1, n: 6, axis: 'z', tip: 0.3, twist: i });
      stock2(k, P, 'bloque', { z0: 0.16, len: 0.36, top: 0.08, bot: -0.14, w: 0.042 });
      const gh = grip(k, P, -0.05, { len: 0.165 }); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.0, -0.45], 0.031, hex); }
      // mira telescópica con lente de cristal
      for (const z of [0.03, -0.15]) k.cbox('b', [0.05, 0.05, 0.026], [0, 0.125, z], { c: P.gm3, ch: 0.008 });
      k.cyl('b', [0.03, 0.03, 0.3], [0, 0.15, -0.06], { c: P.dk, seg: low ? 10 : 14 }); k.cyl('b', [0.043, 0.032, 0.07], [0, 0.15, -0.235], { c: P.dom2, seg: low ? 10 : 14 }); k.cyl('b', [0.036, 0.03, 0.05], [0, 0.15, 0.11], { c: P.dom2, seg: low ? 10 : 14 });
      k.cyl('l', [0.036, 0.036, 0.004], [0, 0.15, -0.272], { k: 1, seg: low ? 10 : 14 }); k.cyl('l', [0.02, 0.02, 0.004], [0, 0.15, 0.137], { k: 2, seg: 8 });
      k.cbox('b', [0.016, 0.03, 0.03], [0.04, 0.15, -0.06], { c: P.dk, ch: 0.004 });
      // guardamanos, freno de boca, bípode plegado
      k.cyl('b', [0.03, 0.03, 0.24], [0, 0.0, -0.45], { c: P.gm3 }); for (const z of [-0.35, -0.55]) k.cyl('b', [0.035, 0.035, 0.014], [0, 0.0, z], { c: P.dom });
      k.cbox('b', [0.02, 0.04, 0.05], [0, 0.025, -0.4], { c: P.gm3, ch: 0.004 });
      for (const sx of [-1, 1]) { k.limb('b', [sx * 0.02, -0.035, -0.7], [sx * 0.032, -0.09, -0.86], 0.007, 0.006, { c: P.pale, ball: true }); k.cbox('b', [0.016, 0.01, 0.03], [sx * 0.032, -0.095, -0.865], { c: P.dom, ch: 0.002 }); }
      k.cbox('b', [0.05, 0.026, 0.07], [0, -0.03, -0.7], { c: P.gm3, ch: 0.006 });
      // bobinas fijas (se encienden en secuencia) y soportes
      for (const z of COIL_Z) { k.tor('l', [0.05, 0.0075], [0, 0.05, z], { k: 3, seg: low ? 8 : 14 }); k.cbox('b', [0.016, 0.014, 0.03], [0, -0.0, z], { c: P.gm3, ch: 0.003 }); k.cbox('b', [0.014, 0.012, 0.014], [0, 0.103, z], { c: P.gm3, ch: 0.002 }); }
      k.loft('b', [{ z: -1.12, w: 0.04, h: 0.04, y: 0.05, ch: 0.01 }, { z: -1.22, w: 0.03, h: 0.03, y: 0.05, ch: 0.008 }], { c: P.dom });
      // rieles gemelos (se abren al cargar)
      for (const sx of [-1, 1]) {
        k.part(sx < 0 ? 'railL' : 'railR', [0, 0.05, -0.2]);
        k.loft('b', [{ z: -0.2, w: 0.022, h: 0.052, x: sx * 0.034, y: 0.05, ch: 0.006 }, { z: -0.95, w: 0.022, h: 0.052, x: sx * 0.034, y: 0.05, ch: 0.006 }, { z: -1.1, w: 0.014, h: 0.03, x: sx * 0.034, y: 0.05, ch: 0.004 }], { c: P.dom2, edge: 1.5 });
        k.box('l', [0.002, 0.02, 0.8], [sx * 0.0225, 0.05, -0.62], { k: 0 });
        if (!low) fins(k, P, 8, [sx * 0.046, 0.05, -0.28], [0.005, 0.034, 0.016], 0.085, P.dk);
      }
      k.part('needle', [0, 0.05, -0.2]);
      k.limb('l', [0, 0.05, -0.1], [0, 0.05, -1.12], 0.0065, 0.0065, { k: 1, seg: 6 }); k.cyl('l', [0.0005, 0.0065, 0.14], [0, 0.05, -1.19], { k: 1, seg: 6 }); k.cyl('l', [0.012, 0.012, 0.05], [0, 0.05, -0.24], { k: 0, seg: 8 });
      const scr = screenAt(k, P, [-0.0365, 0.045, 0.1], -1, 0.07, 0.04, 1.3, 0.3);
      return { gh, pivot, screen: { on: 'main', ...scr }, fore: [0, 0, -0.45] };
    },
    anim(P, st, dt, t, firing, G) {
      st.open = st.open || new Spring(500, 24); st.open.step(dt);
      st.dis = (st.dis ?? 9) + dt; st.charge = damp(st.charge || 0, firing ? 1 : 0, firing ? 2.4 : 3, dt);
      if (st.dis < 0.3) st.seq = 0.25 - (st.dis / 0.3) * 1.55; else { const per = 3.2 - st.charge * 2.2; st.seq = 0.25 - ((t % per) / per) * 1.4; }
      const sOpen = st.charge * 0.007 + clamp(st.open.x, -0.01, 0.02);
      P.railL.position.x = P.railL.userData.base.x - sOpen; P.railR.position.x = P.railR.userData.base.x + sOpen;
      const need = st.dis < 0.45 ? 0 : easeOut((st.dis - 0.45) / 0.55); P.needle.visible = st.dis > 0.4; P.needle.position.z = P.needle.userData.base.z + (1 - need) * 0.5;
      G.boost += st.charge * 0.02;
      if (st.ctx && st.dis > 0.2 && st.dis < 1.6 && Math.random() < dt * 24) st.ctx.puff([(Math.random() - 0.5) * 0.04, 0.05, -0.5 - Math.random() * 0.5], [0, 0.22, 0], 0xffffff, { size: 0.05, grow: 0.25, life: 0.8, alpha: 0.16 });
    },
    fire(P, st, ctx, G) { st.dis = 0; st.open && (st.open.v += 0.7); G.heat = 1; G.boost = 1.2; if (ctx) { ctx.puff([0, 0.05, -1.3], [0, 0, -0.6], G.hex, { size: 0.2, grow: 0.4, life: 0.5, alpha: 0.5 }); for (let i = 0; i < 5; i++) ctx.shard([0, 0.05, -0.6 - i * 0.12], [(Math.random() - 0.5) * 1.2, (Math.random() - 0.3) * 1.3, 0.2 + Math.random() * 0.4], i % 2 ? G.hex : 0xffffff, 1.0); } },
  });
}

export const A1 = [haz, prisma, rafaga, nova, aguja];
