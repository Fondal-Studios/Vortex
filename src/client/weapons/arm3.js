// Armería 3/3 — Cometa (10), Vórtice (11), Lanza (12), Cetro Vital (13), Eclipse (14).
import { rightHand, supportHand } from './hands.js';
import { forge, grip, plate, armor, stripe, piping, inset, DEC, rail, holo, fins, screenAt, crownRing, stock, stock2, shroud, clamp, damp, easeOut, easeInOut, Spring, PI, puffs, casing } from './forge.js';

const VL = { pos: [0.32, -0.3, -0.62], scale: 2.2, zs: 0.55, rot: [-0.02, 0.5, -0.03] };

/* ═════════════ 10 · COMETA — lanzador teledirigido: un orbe de energía entre dos cuernos y estela de cometa ═════════════ */
export function cometa(q, hands) {
  return forge(10, q, hands, {
    muzzle: [0, 0.05, -0.75], flash: { shape: 'ball', size: 1.3, decay: 6 },
    recoil: { z: 0.15, y: 0.03, pitch: 0.4, roll: 0.04, k: 100, c: 10 }, view: VL, heat: 0.6, kv: 1.4,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      k.prof('b', [[-0.16, -0.012], [-0.16, 0.08], [-0.1, 0.098], [0.14, 0.098], [0.17, 0.0]], 0.08, 0, { c: P.gm, bevel: 0.006 });
      for (const sx of [-1, 1]) { armor(k, P, sx, [[-0.1, 0.0], [-0.1, 0.08], [0.0, 0.092], [0.12, 0.06], [0.1, 0.0]], 0.0405, { dec: DEC.circuito, w: 0.005 }); armor(k, P, sx, [[0.0, 0.012], [0.0, 0.06], [0.06, 0.064], [0.09, 0.036], [0.06, 0.012]], 0.0435, { c: P.dom2, c2: P.dk, dec: DEC.nervadura, w: 0.003 }); }
      k.cbox('b', [0.006, 0.042, 0.075], [-0.0405, 0.04, 0.09], { c: P.dk, ch: 0.002 });
      holo(k, P, [0, 0.098, -0.02], 0.9);
      stock2(k, P, 'bloque', { z0: 0.16, len: 0.24, top: 0.07, bot: -0.075, w: 0.05 });
      const gh = grip(k, P, -0.012, { len: 0.17 }); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.05, -0.24], 0.052, hex); }
      // cañón cónico con anillos de luz, aletas estabilizadoras y dos cuernos que sostienen el orbe
      k.cyl('b', [0.036, 0.05, 0.44], [0, 0.05, -0.37], { c: P.gm3, seg: low ? 10 : 14 });
      for (const [z, c] of [[-0.2, P.dom], [-0.35, P.dom2], [-0.5, P.dom]]) { k.cyl('b', [0.056, 0.056, 0.022], [0, 0.05, z], { c, seg: low ? 10 : 14 }); k.tor('l', [0.056, 0.003], [0, 0.05, z - 0.011], { k: 0, seg: low ? 12 : 16 }); }
      for (const sx of [-1, 1]) {
        k.cbox('b', [0.006, 0.07, 0.1], [sx * 0.062, 0.05, -0.28], { c: P.dom2, r: [0, 0, sx * 0.3], ch: 0.002 });
        const hp = [[sx * 0.03, 0.05, -0.5], [sx * 0.075, 0.05, -0.62], [sx * 0.09, 0.056, -0.74], [sx * 0.07, 0.068, -0.85]];
        for (let i = 0; i < 3; i++) { k.limb('b', hp[i], hp[i + 1], 0.012 - i * 0.002, 0.01 - i * 0.002, { c: i === 2 ? P.pale : P.dom, ball: true, seg: 6 }); k.limb('l', hp[i], hp[i + 1], 0.0045, 0.0045, { k: 0, seg: 4 }); }
      }
      // el orbe y su estela (la estela se enciende con el calor)
      k.part('orb', [0, 0.05, -0.64]);
      k.gem('l', [0.045, 0.062], [0, 0.05, -0.64], { k: 1, n: 8, axis: 'y', tip: 0.35 }); k.gem('l', [0.034, 0.05], [0, 0.05, -0.64], { k: 1, n: 6, axis: 'x', tip: 0.35, twist: 0.3 });
      k.tor('l', [0.066, 0.004], [0, 0.05, -0.64], { k: 0, r: [PI / 2, 0, 0.5], seg: low ? 12 : 20 });
      k.cyl('l', [0.042, 0.002, 0.3], [0, 0.05, -0.5], { k: 0, seg: 8 });
      for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3 + 0.5; k.limb('l', [Math.cos(a) * 0.03, 0.05 + Math.sin(a) * 0.03, -0.62], [Math.cos(a) * 0.075, 0.05 + Math.sin(a) * 0.075, -0.46], 0.01, 0.002, { k: 0, seg: 5 }); }
      return { gh, pivot, screen: { on: 'main', pos: [-0.0435, 0.04, 0.09], rot: [0, -PI / 2 + 0.3, 0], scale: 1.2 }, fore: [0, 0.05, -0.24] };
    },
    anim(P, st, dt, t) { const g = clamp((st.t0 - 0.3) / 0.8, 0, 1), s = st.t0 < 0.3 ? 0.001 : easeOut(g); P.orb.scale.setScalar(Math.max(0.001, s * (1 + 0.05 * Math.sin(t * 8)))); P.orb.rotation.set(t, t * 1.4, 0); P.orb.position.z = P.orb.userData.base.z + (1 - s) * 0.08; },
    fire(P, st, ctx, G) { puffs(ctx, G.hex, -0.75, 4, 0.05); },
  });
}

/* ═════════════ 11 · VÓRTICE — cañón de gravedad: embudo con giroscopio y estrías en espiral ═════════════ */
export function vortice(q, hands) {
  return forge(11, q, hands, {
    muzzle: [0, 0.05, -0.74], flash: { shape: 'ring', size: 1.4, decay: 6 },
    recoil: { z: 0.14, y: 0.02, pitch: 0.3, roll: 0.05, k: 110, c: 10 }, view: VL, heat: 0.7, kv: 1.3,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      k.prof('b', [[-0.16, -0.012], [-0.16, 0.075], [-0.1, 0.092], [0.14, 0.094], [0.16, 0.0]], 0.075, 0, { c: P.gm, bevel: 0.006 });
      for (const sx of [-1, 1]) { armor(k, P, sx, [[-0.1, 0.0], [-0.1, 0.075], [0.0, 0.088], [0.11, 0.056], [0.09, 0.0]], 0.0385, { dec: DEC.circuito, w: 0.005 }); armor(k, P, sx, [[-0.02, 0.012], [-0.02, 0.06], [0.05, 0.064], [0.07, 0.036], [0.05, 0.012]], 0.0415, { c: P.dom2, c2: P.dk, dec: DEC.nervadura, w: 0.003 }); }
      k.cbox('b', [0.006, 0.042, 0.075], [-0.0385, 0.04, 0.09], { c: P.dk, ch: 0.002 });
      stock2(k, P, 'tubo', { z0: 0.16, len: 0.24, top: 0.07, bot: -0.075 });
      const gh = grip(k, P, -0.012, { len: 0.17 }); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.05, -0.24], 0.052, hex); }
      // tubo con estrías en espiral
      k.cyl('b', [0.04, 0.05, 0.36], [0, 0.05, -0.3], { c: P.gm3, seg: low ? 10 : 14 });
      const nS = low ? 6 : 9;
      for (let i = 0; i < nS; i++) { const z = -0.16 - i * (0.26 / nS); k.at([0, 0.05, z], [0, 0, i * 0.5], () => k.cbox('b', [0.011, 0.126, 0.014], [0, 0, 0], { c: i % 2 ? P.dom : P.dom2, ch: 0.002 })); }
      for (const z of [-0.18, -0.34]) k.cyl('b', [0.058, 0.058, 0.02], [0, 0.05, z], { c: P.dk, seg: low ? 10 : 14 });
      // embudo: cono exterior oscuro, interior de energía, borde claro
      k.cyl('b', [0.115, 0.05, 0.2], [0, 0.05, -0.5], { c: P.dom2, seg: low ? 12 : 20, open: true });
      k.cyl('l', [0.105, 0.045, 0.19], [0, 0.05, -0.5], { k: 0, seg: low ? 12 : 20, open: true });
      k.tor('b', [0.115, 0.007], [0, 0.05, -0.6], { c: P.pale, seg: low ? 12 : 24 });
      for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3 + 1.57; k.limb('b', [Math.cos(a) * 0.04, 0.05 + Math.sin(a) * 0.04, -0.4], [Math.cos(a) * 0.1, 0.05 + Math.sin(a) * 0.1, -0.58], 0.01, 0.007, { c: P.st, ball: true, seg: 6 }); }
      k.part('gyro', [0, 0.05, -0.56]);
      for (let i = 0; i < 3; i++) k.tor('l', [0.085, 0.0055], [0, 0.05, -0.56], { k: 0, r: [i * PI / 3, i * PI / 3 + 0.5, i], seg: low ? 14 : 22 });
      k.part('core', [0, 0.05, -0.56]);
      k.gem('l', [0.034, 0.05], [0, 0.05, -0.56], { k: 1, n: 6, axis: 'y' }); k.gem('l', [0.05, 0.05], [0, 0.05, -0.56], { k: 0, n: 4, axis: 'x', c: 0x444444, tip: 0.5 });
      return { gh, pivot, screen: { on: 'main', pos: [-0.0415, 0.04, 0.09], rot: [0, -PI / 2 + 0.3, 0], scale: 1.2 }, fore: [0, 0.05, -0.24] };
    },
    anim(P, st, dt, t, firing) { st.rot += dt * (1.5 + st.pulse * 12 + (firing ? 4 : 0)); P.gyro.rotation.set(st.rot, st.rot * 0.7, st.rot * 0.4); P.core.rotation.set(-t * 3, t * 2, 0); P.core.scale.setScalar(1 + 0.12 * Math.sin(t * 7) + st.pulse * 0.3); },
    fire(P, st, ctx, G) { puffs(ctx, G.hex, -0.62, 4, 0.05); },
  });
}

/* ═════════════ 12 · LANZA — ballesta pesada: brazos de cristal, cuerda de energía y lanza cargada ═════════════ */
export function lanza(q, hands) {
  return forge(12, q, hands, {
    muzzle: [0, 0.055, -1.2], flash: { shape: 'star', size: 1.2, decay: 8 },
    recoil: { z: 0.11, y: 0.015, pitch: 0.2, roll: 0.02, k: 130, c: 13 }, view: { ...VL, scale: 1.55, zs: 0.5 }, heat: 0.8, kv: 1.2,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      k.prof('b', [[-0.16, -0.012], [-0.16, 0.08], [-0.1, 0.096], [0.1, 0.098], [0.2, 0.062], [0.2, -0.02]], 0.066, 0, { c: P.gm, bevel: 0.006 });
      for (const sx of [-1, 1]) armor(k, P, sx, [[-0.1, 0.0], [-0.1, 0.082], [0.08, 0.09], [0.14, 0.06], [0.1, 0.0]], 0.0355, { dec: DEC.circuito, w: 0.005 });
      k.cbox('b', [0.006, 0.042, 0.075], [-0.0355, 0.04, 0.09], { c: P.dk, ch: 0.002 });
      stock2(k, P, 'plegable', { z0: 0.16, len: 0.3, top: 0.07, bot: -0.12 });
      const gh = grip(k, P, -0.012, { len: 0.17 }); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.0, -0.4], 0.028, hex); }
      // viga central con canal luminoso, riel y mira
      k.loft('b', [{ z: -0.2, w: 0.05, h: 0.056, y: 0.05, ch: 0.012 }, { z: -1.0, w: 0.038, h: 0.05, y: 0.05, ch: 0.01 }], { c: P.gm3 });
      k.cbox('l', [0.006, 0.006, 0.7], [0, 0.081, -0.6], { k: 0, ch: 0.0015 }); k.cyl('b', [0.026, 0.026, 0.22], [0, 0.0, -0.4], { c: P.gm3 });
      holo(k, P, [0, 0.082, -0.1], 0.9);
      for (const z of [-0.35, -0.6, -0.85]) { k.tor('l', [0.04, 0.0055], [0, 0.05, z], { k: 3, seg: low ? 8 : 12 }); k.cbox('b', [0.016, 0.012, 0.03], [0, 0.0, z], { c: P.gm3, ch: 0.003 }); }
      // brazos de ballesta curvos (cristal + metal) y cuerda
      const arm = (sx) => [[sx * 0.03, 0.05, -0.56], [sx * 0.11, 0.058, -0.6], [sx * 0.19, 0.08, -0.68], [sx * 0.235, 0.12, -0.78], [sx * 0.245, 0.17, -0.88]];
      for (const sx of [-1, 1]) {
        const a = arm(sx);
        for (let i = 0; i < a.length - 1; i++) { k.limb('b', a[i], a[i + 1], 0.02 - i * 0.003, 0.017 - i * 0.003, { c: i % 2 ? P.dom : P.dom2, ball: true, seg: 6 }); k.limb('l', a[i], a[i + 1], 0.007, 0.006, { k: 0, seg: 4 }); }
        k.gem('l', [0.012, 0.03], a[4], { k: 1, n: 4, axis: 'y' });
      }
      k.cbox('b', [0.07, 0.04, 0.05], [0, 0.05, -0.56], { c: P.dom2, ch: 0.01 });
      // cuerda: dos tramos desde las puntas hasta la muesca; se tensa/relaja con el disparo
      k.part('string', [0, 0.05, -0.88]);
      for (const sx of [-1, 1]) k.limb('l', [sx * 0.245, 0.17, -0.88], [0, 0.056, -0.42], 0.0035, 0.0035, { k: 3, seg: 4 });
      k.part('spear', [0, 0.05, -0.2]);
      k.limb('l', [0, 0.058, -0.2], [0, 0.058, -1.0], 0.011, 0.011, { k: 1, seg: 6 }); k.gem('l', [0.03, 0.12], [0, 0.058, -1.12], { k: 1, n: 4, axis: 'z', tip: 0.7 });
      for (let i = 0; i < 4; i++) { const a = i * PI / 2; k.cbox('l', [0.004, 0.03, 0.06], [Math.cos(a) * 0.016, 0.058 + Math.sin(a) * 0.016, -0.26], { k: 0, r: [0, 0, a], ch: 0.001 }); }
      return { gh, pivot, screen: { on: 'main', pos: [-0.0385, 0.04, 0.09], rot: [0, -PI / 2 + 0.3, 0], scale: 1.2 }, fore: [0, 0.0, -0.4] };
    },
    anim(P, st, dt, t) {
      const need = st.t0 < 0.35 ? 0 : easeOut((st.t0 - 0.35) / 0.7); P.spear.visible = st.t0 > 0.3; P.spear.position.z = P.spear.userData.base.z + (1 - need) * 0.45;
      const snap = st.t0 < 0.08 ? 0.08 : 0.08 + 0.92 * easeOut((st.t0 - 0.3) / 0.6 + (st.t0 < 0.3 ? -1 : 0)); P.string.scale.z = clamp(st.t0 < 0.3 ? 0.15 : need, 0.15, 1); st.seq = -0.2 - ((t * 0.8) % 1) * 0.8;
    },
    fire(P, st, ctx, G) { puffs(ctx, G.hex, -1.1, 3, 0.05); },
  });
}

/* ═════════════ 13 · CETRO VITAL — bastón vivo: enredadera de dos tallos, savia luminosa y flor de cristal ═════════════ */
export function cetro(q, hands) {
  return forge(13, q, hands, {
    muzzle: [0, 0.04, -1.0], flash: { shape: 'star', size: 0.9, decay: 11 },
    recoil: { z: 0.04, y: 0.01, pitch: 0.1, roll: 0.04, k: 170, c: 14 }, view: { ...VL, scale: 1.6, zs: 0.5 }, heat: 0.15, kv: 0.8, cool: 0.6,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      k.prof('b', [[-0.1, -0.012], [-0.1, 0.05], [-0.05, 0.066], [0.08, 0.066], [0.1, 0.0]], 0.05, 0, { c: P.gm, bevel: 0.006 });
      for (const sx of [-1, 1]) armor(k, P, sx, [[-0.06, 0.0], [-0.06, 0.05], [0.0, 0.06], [0.07, 0.04], [0.06, 0.0]], 0.0265, { c: P.dom2, c2: P.dk, dec: DEC.nervadura, w: 0.004 });
      k.cbox('b', [0.006, 0.036, 0.06], [-0.0265, 0.035, 0.05], { c: P.dk, ch: 0.002 });
      k.prof('b', [[-0.1, 0.05], [-0.26, 0.03], [-0.3, -0.04], [-0.22, -0.06], [-0.1, -0.015]], 0.04, 0, { c: P.dom2, bevel: 0.005, holes: [[[-0.13, 0.036], [-0.23, 0.022], [-0.26, -0.03], [-0.2, -0.04], [-0.12, -0.008]]] });
      const gh = grip(k, P, -0.012, { len: 0.17 }); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.04, -0.5], 0.026, hex); }
      // fuste: varilla de savia central y dos tallos entrelazados con espinas
      k.limb('l', [0, 0.04, 0.0], [0, 0.04, -0.84], 0.009, 0.009, { k: 0, seg: 6 });
      const NS = low ? 9 : 13, step = 0.84 / NS;
      for (let i = 0; i <= NS; i++) {
        for (const s of [0, 1]) {
          const f = (i0) => { const ph = i0 * 0.9 + s * PI; return [Math.cos(ph) * 0.017, 0.04 + Math.sin(ph) * 0.017, -i0 * step]; };
          if (i < NS) { k.limb('b', f(i), f(i + 1), 0.0125, 0.0125, { c: s ? P.dom : P.dom2, seg: 6, ball: !low }); }
          if (i % 3 === 1 && !low) { const p = f(i), ph = i * 0.9 + s * PI; k.gem('b', [0.0045, 0.016], [p[0] + Math.cos(ph) * 0.012, p[1] + Math.sin(ph) * 0.012, p[2]], { n: 3, axis: 'y', c: P.pale, r: [0, 0, ph - PI / 2] }); }
        }
      }
      for (const z of [-0.18, -0.5]) k.cyl('b', [0.03, 0.03, 0.02], [0, 0.04, z], { c: P.dk, seg: 8 });
      // cabeza: pétalos que abrazan un corazón de cristal
      k.part('head', [0, 0.04, -0.88]);
      k.gem('l', [0.045, 0.062], [0, 0.04, -0.9], { k: 1, n: 6, axis: 'z', tip: 0.4 }); k.gem('l', [0.025, 0.036], [0, 0.04, -0.9], { k: 0, n: 5, axis: 'y', c: 0xffffff, tip: 0.4 });
      for (let i = 0; i < 5; i++) { const a = i * PI * 2 / 5, c = Math.cos(a), s = Math.sin(a); k.limb('b', [c * 0.03, 0.04 + s * 0.03, -0.82], [c * 0.075, 0.04 + s * 0.075, -0.88], 0.011, 0.009, { c: P.dom, seg: 5 }); k.limb('b', [c * 0.075, 0.04 + s * 0.075, -0.88], [c * 0.058, 0.04 + s * 0.058, -0.97], 0.009, 0.003, { c: P.dom2, seg: 5 }); k.gem('l', [0.01, 0.022], [c * 0.056, 0.04 + s * 0.056, -0.985], { k: 0, n: 4, axis: 'z' }); }
      k.part('orbit', [0, 0.04, -0.9]);
      for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3; k.gem('l', [0.008, 0.016], [Math.cos(a) * 0.1, 0.04 + Math.sin(a) * 0.1, -0.9], { k: 1, n: 4, axis: 'y', r: [0, 0, a] }); }
      k.tor('l', [0.1, 0.0025], [0, 0.04, -0.9], { k: 0, seg: low ? 14 : 28 });
      return { gh, pivot, screen: { on: 'main', pos: [-0.0295, 0.035, 0.05], rot: [0, -PI / 2 + 0.3, 0], scale: 0.95 }, fore: [0, 0.04, -0.5] };
    },
    anim(P, st, dt, t) { P.head.rotation.set(t * 0.5, 0, t * 1.2); P.head.scale.setScalar(1 + 0.08 * Math.sin(t * 4.5) + st.pulse * 0.3); P.orbit.rotation.z = -t * 1.6 - st.pulse; },
    fire(P, st, ctx, G) { if (ctx) { puffs(ctx, G.hex, -1.0, 3, 0.04); ctx.puff([0, 0.04, -0.2], [0, 0.4, 0.5], 0x9bffa0, { size: 0.07, grow: 0.15, life: 0.8, alpha: 0.3 }); } },
  });
}

/* ═════════════ 14 · ECLIPSE — escopeta pesada de dos cañones con un disco negro de corona ═════════════ */
export function eclipse(q, hands) {
  return forge(14, q, hands, {
    muzzle: [0, 0.045, -0.78], eject: [0.05, 0.06, 0.0], flash: { shape: 'fan', size: 1.3, decay: 8 },
    recoil: { z: 0.2, y: 0.04, pitch: 0.45, roll: 0.05, k: 100, c: 10 }, view: { ...VL, scale: 1.7 }, heat: 0.7, kv: 1.3,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      k.prof('b', [[-0.17, -0.012], [-0.17, 0.085], [-0.1, 0.104], [0.12, 0.104], [0.16, 0.06], [0.16, -0.02]], 0.112, 0, { c: P.gm, bevel: 0.008 });
      for (const sx of [-1, 1]) {
        armor(k, P, sx, [[-0.1, 0.0], [-0.1, 0.085], [0.0, 0.098], [0.1, 0.07], [0.12, 0.0]], 0.0585, { dec: DEC.circuito, w: 0.006 });
        armor(k, P, sx, [[-0.02, 0.012], [-0.02, 0.07], [0.06, 0.074], [0.09, 0.04], [0.07, 0.012]], 0.0625, { c: P.dom2, c2: P.dk, dec: DEC.nervadura, w: 0.004 });
        k.cbox('b', [0.006, 0.034, 0.078], [sx * 0.0585, 0.045, 0.0], { c: P.dk, ch: 0.002 });
      }
      k.cbox('b', [0.116, 0.012, 0.28], [0, 0.108, 0.0], { c: P.dom2, ch: 0.003 }); k.gem('l', [0.022, 0.07], [0, 0.124, 0.0], { k: 1, n: 6, axis: 'z', tip: 0.3 });
      k.cbox('b', [0.006, 0.042, 0.075], [-0.0585, 0.04, 0.115], { c: P.dk, ch: 0.002 });
      stock2(k, P, 'tubo', { z0: 0.17, len: 0.3, top: 0.08, bot: -0.12 });
      const gh = grip(k, P, -0.012, { len: 0.17 }); let pivot = null; if (hands) pivot = rightHand(k, gh, hex);
      // dos cañones lado a lado con anillos y bocas luminosas
      for (const sx of [-1, 1]) {
        k.cyl('b', [0.036, 0.036, 0.6], [sx * 0.046, 0.045, -0.42], { c: P.gm3, seg: low ? 10 : 14 }); k.cyl('l', [0.026, 0.026, 0.008], [sx * 0.046, 0.045, -0.722], { k: 1, seg: 10 });
        for (const z of [-0.3, -0.5, -0.66]) k.cyl('b', [0.04, 0.04, 0.02], [sx * 0.046, 0.045, z], { c: P.dom2, seg: low ? 10 : 14 });
      }
      k.cbox('b', [0.02, 0.05, 0.54], [0, 0.045, -0.42], { c: P.dk, ch: 0.004 });
      // corredera ancha
      k.part('pump', [0, -0.01, -0.34]);
      k.cbox('b', [0.116, 0.056, 0.2], [0, -0.01, -0.34], { c: P.dom, ch: 0.016 });
      for (let i = 0; i < (low ? 3 : 5); i++) k.cbox('b', [0.12, 0.06, 0.008], [0, -0.01, -0.27 - i * 0.03], { c: P.dk, ch: 0.002 });
      k.box('l', [0.004, 0.012, 0.14], [-0.059, -0.01, -0.34], { k: 0 }); if (hands) supportHand(k, [0, 0.0, -0.34], 0.05, hex);
      // disco del eclipse: vacío negro con corona luminosa y gemas
      k.part('disc', [0, 0.045, -0.5]);
      k.cyl('b', [0.098, 0.098, 0.012], [0, 0.045, -0.5], { c: 0x040208, seg: low ? 16 : 28 }); k.tor('l', [0.1, 0.007], [0, 0.045, -0.5], { k: 0, seg: low ? 16 : 28 });
      for (let i = 0; i < 8; i++) { const a = i * PI / 4; k.gem('l', [0.008, 0.018], [Math.cos(a) * 0.108, 0.045 + Math.sin(a) * 0.108, -0.5], { k: 1, n: 4, axis: 'y', r: [0, 0, a - PI / 2] }); }
      return { gh, pivot, screen: { on: 'main', pos: [-0.0615, 0.04, 0.115], rot: [0, -PI / 2 + 0.3, 0], scale: 1.2 }, fore: [0, 0.0, -0.34] };
    },
    anim(P, st, dt, t, firing, G) {
      let off = 0; const p = (st.t0 - 0.2) / 0.5; if (p > 0 && p < 1) off = p < 0.45 ? easeOut(p / 0.45) : 1 - (p - 0.45) / 0.55;
      P.pump.position.z = P.pump.userData.base.z + off * 0.12; st.rot += dt * (1.2 + st.pulse * 10); P.disc.rotation.z = st.rot; const s = 1 + st.pulse * 0.2; P.disc.scale.set(s, s, 1);
      if (p > 0.4 && p < 0.5 && st.ctx && !st.ej) { st.ej = true; st.ctx.shard([0.05, 0.06, 0], [1.5, 1.6, 0.6], G.hex, 2.2); } if (p > 0.6) st.ej = false;
    },
    fire(P, st, ctx, G) { if (ctx) for (const sx of [-1, 1]) ctx.puff([sx * 0.046, 0.045, -0.73], [sx * 0.2, 0.05, -0.6], G.hex, { size: 0.12, grow: 0.4, life: 0.5, alpha: 0.45 }); },
  });
}

export const A3 = [cometa, vortice, lanza, cetro, eclipse];
