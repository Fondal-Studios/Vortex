// Diez armas nuevas (ids 5..14): pulso, gemelas, solar, fractal, enjambre, cometa, vórtice, lanza, cetro, eclipse.
// Fábrica común `make`: cada arma sólo describe su geometría (build), su animación (anim) y qué hace al disparar (fire).
import * as THREE from 'three';
import { Kit, makeMats, AmmoScreen } from './kit.js';
import { rightHand, triggerFinger, supportHand } from './hands.js';
import { DARK, GUN, STEEL, PALE, clamp, damp, easeOut, Spring, newGun, finalize, addParts, placeScreen, bezel, screw, vents } from './guns.js';

const VIEW_L = { pos: [0.27, -0.27, -0.7], scale: 0.95, zs: 0.55, rot: [-0.02, 0.28, -0.05] };
const VIEW_S = { pos: [0.27, -0.26, -0.62], scale: 1.1, zs: 0.7, rot: [-0.02, 0.26, -0.04] };

/** Empuñadura + guardamonte + gatillo estándar; devuelve las medidas para la mano. */
function stdGrip(k, top, { z = 0, len = 0.17, trig = true } = {}) {
  k.prof('b', [[-0.065 + z, top], [0.04 + z, top], [0.034 + z, top - len], [-0.085 + z, top - len]], 0.044, 0, { c: DARK });
  k.prof('b', [[0.14 + z, top], [0.14 + z, top - 0.042], [0.0 + z, top - 0.042], [0.0 + z, top], [0.012 + z, top], [0.012 + z, top - 0.03], [0.128 + z, top - 0.03], [0.128 + z, top]], 0.03, 0, { c: GUN });
  if (trig) k.box('b', [0.012, 0.034, 0.01], [0, top - 0.02, -0.07 - z], { c: PALE, r: [0.25, 0, 0] });
  k.box('l', [0.004, len * 0.6, 0.012], [-0.0235, top - len * 0.55, -0.03 - z], { k: 0 });
  return { zc: 0.0 - z, top: top - 0.002, d: 0.112, hw: 0.022 };
}
const gem = (k, r, c, n, rad, z, y, o = {}) => { for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n; k.poly('l', 'oct', r, [Math.cos(a) * rad, y + Math.sin(a) * rad, z], { k: 1, r: [0, 0, a], s: [0.8, 1.5, 0.8], ...o }); } };

function make(index, q, hands, S) {
  const G = newGun(index, q), { k, hex } = G, group = new THREE.Group();
  const st = { t: 0, curl: 0, kick: new Spring(S.kk?.[0] ?? 180, S.kk?.[1] ?? 14), pulse: 0, rot: 0, seq: -9, ctx: null, side: 0, n: 0, s1: new Spring(500, 24), s2: new Spring(500, 24), t0: 9 };
  k.part('main');
  const info = S.build(k, G, hands) || {};
  if (hands && info.gh) { k.part('trigger', info.pivot); triggerFinger(k, info.gh, info.pivot, info.reach ?? 0.03); }
  const P = addParts(G, group, Object.keys(k.parts));
  if (info.screen) placeScreen(G, P[info.screen.on || 'main'], info.screen.pos, info.screen.rot, info.screen.scale || 1.2);
  const W = {
    group, muzzle: S.muzzle, eject: S.eject || null, flash: S.flash, recoil: S.recoil, view: S.view,
    update(dt, t, firing) {
      st.t = t; st.kick.step(dt); st.t0 += dt; G.heat = Math.max(0, G.heat - dt * (S.cool ?? 0.4)); G.boost = Math.max(0, G.boost - dt * (S.bdec ?? 6));
      st.curl = Math.max(st.curl - dt * 8, firing ? 0.3 : 0); st.pulse = Math.max(0, st.pulse - dt * 3);
      if (P.trigger) P.trigger.rotation.x = -st.curl * 0.5;
      S.anim && S.anim(P, st, dt, t, firing, G, W);
      G.mats.set(t, G.heat, st.seq, G.ammo, G.boost); G.scr.update(t);
    },
    fire(ctx) { G.heat = Math.min(1, G.heat + (S.heat ?? 0.4)); G.boost = 1; st.curl = 1; st.pulse = 1; st.kick.v += S.kv ?? 1; st.ctx = ctx; st.t0 = 0; st.n++; S.fire && S.fire(P, st, ctx, G, W); },
  };
  return finalize(G, W);
}
const burst = (ctx, hex, z, n = 3, y = 0.04) => { if (ctx) for (let i = 0; i < n; i++) ctx.puff([0, y, z], [(Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3 + 0.05, -0.4], hex, { size: 0.09, grow: 0.3, life: 0.4, alpha: 0.4 }); };

/* 5 · PULSO */
function pulso(q, hands) {
  return make(5, q, hands, {
    muzzle: [0, 0.03, -0.4], eject: [0.03, 0.06, 0.0], flash: { shape: 'ring', size: 0.7, decay: 12 }, recoil: { z: 0.06, y: 0.01, pitch: 0.17, roll: 0.02, k: 220, c: 17 }, view: VIEW_S, heat: 0.3, kv: 1.5,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.11, 0.072], [0.2, 0.072], [0.26, 0.045], [0.26, -0.01], [-0.11, -0.01], [-0.135, 0.03]], 0.05, 0, { c: B });
      k.box('b', [0.054, 0.012, 0.15], [0, 0.077, -0.07], { c: A }); k.box('b', [0.003, 0.03, 0.15], [-0.0257, 0.03, -0.06], { c: DARK }); k.box('l', [0.004, 0.022, 0.13], [-0.0268, 0.03, -0.06], { k: 0 });
      k.prof('b', [[0.26, -0.01], [0.26, -0.03], [0.1, -0.034], [0.1, -0.01]], 0.044, 0, { c: DARK });
      k.cyl('b', [0.02, 0.022, 0.12], [0, 0.03, -0.3], { c: GUN }); k.cyl('l', [0.012, 0.012, 0.01], [0, 0.03, -0.365], { k: 1 });
      k.cyl('l', [0.02, 0.02, 0.1], [0, 0.098, -0.02], { k: 1, seg: 6 }); for (const z of [0.03, -0.07]) k.box('b', [0.058, 0.03, 0.012], [0, 0.088, z], { c: GUN });
      k.box('b', [0.05, 0.02, 0.07], [0, 0.074, 0.08], { c: DARK }); bezel(k, [0, 0.0735, 0.07], [-Math.PI / 2 + 0.34, 0, 0], 0.05, 0.034);
      const gh = stdGrip(k, -0.01); let pivot = null; if (hands) pivot = rightHand(k, gh, hex);
      k.part('ring', [0, 0.03, -0.32]); k.tor('l', [0.052, 0.007], [0, 0.03, -0.32], { k: 0, seg: 6 }); gem(k, 0.008, 0, 6, 0.052, -0.32, 0.03); k.tor('b', [0.036, 0.004], [0, 0.03, -0.3], { c: PALE, seg: 8 });
      return { gh, pivot, screen: { pos: [0, 0.0775, 0.07], rot: [-Math.PI / 2 + 0.34, 0, 0], scale: 0.85 } };
    },
    anim(P, st, dt, t, firing) { st.rot += dt * (2 + (firing ? 10 : 0) + st.pulse * 14); P.ring.rotation.z = st.rot; const s = 1 + st.pulse * 0.45; P.ring.scale.set(s, s, 1); P.ring.position.z = P.ring.userData.base.z + st.kick.x * 0.5; },
    fire(P, st, ctx, G) { if (ctx) { ctx.shard([0.03, 0.06, 0.0], [1, 1.1, 0.5], G.hex, 0.8); burst(ctx, G.hex, -0.4, 2, 0.03); } },
  });
}

/* 6 · GEMELAS */
function gemelas(q, hands) {
  return make(6, q, hands, {
    muzzle: [0, 0.045, -0.55], eject: [0.04, 0.07, 0.0], flash: { shape: 'jet', size: 0.55, decay: 24 }, recoil: { z: 0.03, y: 0.005, pitch: 0.05, roll: 0.02, k: 300, c: 22 }, view: VIEW_S, heat: 0.07, kv: 0.6,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.12, 0.078], [0.14, 0.082], [0.19, 0.05], [0.19, -0.02], [-0.12, -0.012], [-0.14, 0.03]], 0.085, 0, { c: B });
      k.box('b', [0.09, 0.014, 0.2], [0, 0.088, -0.02], { c: A }); k.cyl('l', [0.022, 0.022, 0.16], [0, 0.106, -0.04], { k: 1, seg: 6 });
      for (const sx of [-1, 1]) { k.box('b', [0.003, 0.036, 0.16], [sx * 0.0432, 0.04, -0.03], { c: DARK }); k.box('l', [0.004, 0.026, 0.14], [sx * 0.0443, 0.04, -0.03], { k: 0 }); }
      for (let i = 0; i < 3; i++) k.box('l', [0.006, 0.008, 0.014], [-0.044, 0.0 + i * 0.0, -0.12 - i * 0.02], { k: 2 });
      bezel(k, [0, 0.0735, 0.09], [-Math.PI / 2 + 0.34, 0, 0], 0.07, 0.034);
      const gh = stdGrip(k, -0.012); let pivot = null; if (hands) pivot = rightHand(k, gh, hex);
      for (const sx of [-1, 1]) { k.part(sx < 0 ? 'barL' : 'barR', [sx * 0.04, 0.045, 0]); k.cyl('b', [0.02, 0.02, 0.44], [sx * 0.04, 0.045, -0.37], { c: GUN }); k.cyl('b', [0.028, 0.028, 0.06], [sx * 0.04, 0.045, -0.56], { c: B, seg: 8 }); k.cyl('l', [0.014, 0.014, 0.01], [sx * 0.04, 0.045, -0.592], { k: 1 }); for (const z of [-0.25, -0.35, -0.45]) k.tor('l', [0.022, 0.003], [sx * 0.04, 0.045, z], { k: 0, seg: 10 }); }
      return { gh, pivot, screen: { pos: [0, 0.0775, 0.09], rot: [-Math.PI / 2 + 0.34, 0, 0], scale: 1.2 } };
    },
    anim(P, st, dt) { st.s1.step(dt); st.s2.step(dt); P.barL.position.z = P.barL.userData.base.z + clamp(st.s1.x, -0.01, 0.05); P.barR.position.z = P.barR.userData.base.z + clamp(st.s2.x, -0.01, 0.05); },
    fire(P, st, ctx, G) { (st.n % 2 ? st.s1 : st.s2).v += 1.8; if (ctx) { const x = st.n % 2 ? -0.04 : 0.04; ctx.shard([x, 0.07, 0.0], [x * 25 + 0.5, 1, 0.5], G.hex, 0.7); if (Math.random() < 0.4) ctx.puff([x, 0.045, -0.6], [0, 0.05, -0.1], G.hex, { size: 0.06, grow: 0.2, life: 0.25, alpha: 0.3 }); } },
  });
}

/* 7 · SOLAR */
function solar(q, hands) {
  return make(7, q, hands, {
    muzzle: [0, 0.045, -0.46], flash: { shape: 'ball', size: 0.9, decay: 10 }, recoil: { z: 0.02, y: 0.003, pitch: 0.03, roll: 0.02, k: 300, c: 22 }, view: VIEW_L, heat: 0.05, kv: 0.4, cool: 0.5,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.16, 0.07], [0.12, 0.082], [0.14, 0.0], [-0.16, -0.012]], 0.07, 0, { c: B });
      k.cyl('l', [0.036, 0.036, 0.26], [0, 0.13, -0.02], { k: 0, seg: 10 }); for (const z of [-0.14, -0.07, 0.0, 0.07, 0.1]) k.cyl('b', [0.042, 0.042, 0.016], [0, 0.13, z], { c: GUN, seg: 10 }); k.limb('b', [0, 0.078, 0.05], [0, 0.1, 0.05], 0.012, 0.012, { c: GUN });
      k.prof('b', [[-0.16, 0.06], [-0.4, 0.03], [-0.42, -0.07], [-0.3, -0.07], [-0.16, -0.02]], 0.05, 0, { c: DARK }); k.box('l', [0.046, 0.1, 0.01], [0, -0.01, 0.425], { k: 0 });
      bezel(k, [-0.0365, 0.04, 0.09], [0, -Math.PI / 2 + 0.3, 0], 0.07, 0.04);
      const gh = stdGrip(k, -0.012); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.04, -0.18], 0.048, hex); }
      k.cyl('b', [0.045, 0.05, 0.14], [0, 0.04, -0.2], { c: B });
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; k.limb('b', [Math.cos(a) * 0.045, 0.04 + Math.sin(a) * 0.045, -0.27], [Math.cos(a) * 0.115, 0.04 + Math.sin(a) * 0.115, -0.46], 0.01, 0.007, { c: i % 2 ? A : GUN }); }
      k.tor('l', [0.115, 0.006], [0, 0.04, -0.46], { k: 0, seg: 16 }); k.tor('l', [0.08, 0.005], [0, 0.04, -0.365], { k: 0, seg: 14 });
      k.part('sun', [0, 0.04, -0.34]); k.poly('l', 'ico', 0.038, [0, 0.04, -0.34], { k: 1 }); gem(k, 0.01, 0, 6, 0.06, -0.34, 0.04);
      return { gh, pivot, screen: { on: 'main', pos: [-0.0385, 0.04, 0.09], rot: [0, -Math.PI / 2 + 0.3, 0], scale: 1.25 } };
    },
    anim(P, st, dt, t, firing, G) { P.sun.rotation.set(t * 2, t * 3, 0); P.sun.scale.setScalar(1 + 0.08 * Math.sin(t * 9) + (firing ? 0.25 : 0)); if (firing) { G.heat = Math.min(1, G.heat + dt * 1.2); if (st.ctx && Math.random() < dt * 40) st.ctx.puff([0, 0.04, -0.45], [(Math.random() - 0.5) * 0.3, (Math.random() - 0.3) * 0.2, -0.7], 0xffb040, { size: 0.11, grow: 0.35, life: 0.45, alpha: 0.35 }); } },
    fire(P, st, ctx) { st.ctx = ctx || st.ctx; },
  });
}

/* 8 · FRACTAL */
function fractal(q, hands) {
  return make(8, q, hands, {
    muzzle: [0, 0.045, -0.78], flash: { shape: 'jet', size: 0.9, decay: 12 }, recoil: { z: 0.05, y: 0.008, pitch: 0.1, roll: 0.03, k: 200, c: 16 }, view: VIEW_L, heat: 0.4, kv: 1,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.14, 0.07], [0.1, 0.075], [0.13, 0.0], [-0.14, -0.012]], 0.06, 0, { c: B });
      k.prof('b', [[-0.14, 0.055], [-0.36, 0.03], [-0.38, -0.06], [-0.28, -0.06], [-0.14, -0.015]], 0.045, 0, { c: DARK });
      k.cyl('b', [0.03, 0.032, 0.62], [0, 0.045, -0.43], { c: GUN }); k.limb('l', [0, 0.045, -0.15], [0, 0.045, -0.74], 0.016, 0.016, { k: 0, seg: 8 });
      for (let i = 0; i < 8; i++) { const z = -0.2 - i * 0.07, up = i % 2 ? 1 : -1; k.limb('l', [0, 0.045 + up * 0.03, z], [0.0, 0.045 + up * 0.075, z - 0.025], 0.008, 0.004, { k: 3 }); k.poly('l', 'oct', 0.011, [0, 0.045 + up * 0.082, z - 0.028], { k: 3 }); k.limb('l', [up * 0.03, 0.045, z - 0.035], [up * 0.075, 0.045, z - 0.06], 0.008, 0.004, { k: 3 }); }
      for (const z of [-0.17, -0.45, -0.72]) k.cyl('b', [0.043, 0.043, 0.02], [0, 0.045, z], { c: B, seg: 8 });
      bezel(k, [-0.031, 0.04, 0.07], [0, -Math.PI / 2 + 0.3, 0], 0.06, 0.036);
      const gh = stdGrip(k, -0.012); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.045, -0.32], 0.034, hex); }
      return { gh, pivot, screen: { pos: [-0.0325, 0.04, 0.07], rot: [0, -Math.PI / 2 + 0.3, 0], scale: 1.1 } };
    },
    anim(P, st, dt, t, firing) { const sp = st.t0 < 0.4 ? 3 : 1; st.seq = -0.2 - (((t * 1.6 * sp) % 1) * 0.6); },
    fire(P, st, ctx, G) { if (ctx) for (let i = 0; i < 5; i++) ctx.shard([(Math.random() - 0.5) * 0.04, 0.045 + (Math.random() - 0.5) * 0.08, -0.2 - Math.random() * 0.5], [(Math.random() - 0.5) * 2, Math.random() * 1.5, -0.5], i % 2 ? G.hex : 0xffffff, 0.8); },
  });
}

/* 9 · ENJAMBRE */
function enjambre(q, hands) {
  return make(9, q, hands, {
    muzzle: [0, 0.05, -0.7], flash: { shape: 'fan', size: 1.0, decay: 9 }, recoil: { z: 0.1, y: 0.02, pitch: 0.25, roll: 0.03, k: 130, c: 12 }, view: VIEW_L, heat: 0.5, kv: 1.2,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.16, 0.075], [0.14, 0.085], [0.16, 0.0], [-0.16, -0.012]], 0.075, 0, { c: B });
      k.prof('b', [[-0.16, 0.06], [-0.4, 0.03], [-0.42, -0.07], [-0.3, -0.07], [-0.16, -0.02]], 0.05, 0, { c: DARK });
      for (let i = 0; i < 5; i++) k.box('l', [0.008, 0.008, 0.012], [-0.03 + i * 0.015, 0.1, -0.06], { k: 2 });
      bezel(k, [-0.0385, 0.04, 0.09], [0, -Math.PI / 2 + 0.3, 0], 0.07, 0.04);
      const gh = stdGrip(k, -0.012); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.0, -0.32], 0.05, hex); }
      k.part('cluster', [0, 0.05, -0.4]);
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + 0.3, x = Math.cos(a) * 0.045, y = 0.05 + Math.sin(a) * 0.045; k.cyl('b', [0.02, 0.02, 0.52], [x, y, -0.43], { c: i % 2 ? GUN : B, seg: 10 }); k.cyl('l', [0.013, 0.013, 0.008], [x, y, -0.695], { k: 1, seg: 8 }); k.tor('l', [0.021, 0.0025], [x, y, -0.6], { k: 0, seg: 10 }); }
      k.limb('l', [0, 0.05, -0.17], [0, 0.05, -0.69], 0.012, 0.012, { k: 0 });
      for (const z of [-0.2, -0.45, -0.66]) k.cyl('b', [0.07, 0.07, 0.02], [0, 0.05, z], { c: GUN, seg: 5 });
      return { gh, pivot, screen: { pos: [-0.0395, 0.04, 0.09], rot: [0, -Math.PI / 2 + 0.3, 0], scale: 1.25 } };
    },
    anim(P, st, dt) { st.rot = damp(st.rot, st.n * Math.PI * 2 / 5, 8, dt); P.cluster.rotation.z = st.rot; },
    fire(P, st, ctx, G) { if (ctx) { burst(ctx, G.hex, -0.7, 3, 0.05); for (let i = 0; i < 5; i++) ctx.puff([0, 0.05, -0.4 - i * 0.05], [0, 0.1, 0.1], 0xffffff, { size: 0.06, grow: 0.2, life: 0.6, alpha: 0.2 }); } },
  });
}

/* 10 · COMETA */
function cometa(q, hands) {
  return make(10, q, hands, {
    muzzle: [0, 0.05, -0.72], flash: { shape: 'ball', size: 1.3, decay: 6 }, recoil: { z: 0.15, y: 0.03, pitch: 0.4, roll: 0.04, k: 100, c: 10 }, view: VIEW_L, heat: 0.6, kv: 1.4,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.16, 0.08], [0.14, 0.09], [0.17, 0.0], [-0.16, -0.012]], 0.08, 0, { c: B });
      k.prof('b', [[-0.16, 0.06], [-0.4, 0.03], [-0.42, -0.07], [-0.3, -0.07], [-0.16, -0.02]], 0.05, 0, { c: DARK });
      k.cyl('b', [0.036, 0.048, 0.42], [0, 0.05, -0.36], { c: GUN }); for (const z of [-0.2, -0.36, -0.5]) { k.cyl('b', [0.055, 0.055, 0.02], [0, 0.05, z], { c: B, seg: 10 }); k.tor('l', [0.055, 0.003], [0, 0.05, z - 0.01], { k: 0, seg: 14 }); }
      for (const sx of [-1, 1]) { k.limb('b', [sx * 0.03, 0.05, -0.5], [sx * 0.07, 0.05, -0.64], 0.011, 0.008, { c: A, ball: true }); k.limb('b', [sx * 0.07, 0.05, -0.64], [sx * 0.05, 0.05, -0.76], 0.008, 0.006, { c: A, ball: true }); }
      bezel(k, [-0.0415, 0.04, 0.09], [0, -Math.PI / 2 + 0.3, 0], 0.07, 0.04);
      const gh = stdGrip(k, -0.012); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.05, -0.24], 0.052, hex); }
      k.part('orb', [0, 0.05, -0.62]); k.poly('l', 'ico', 0.05, [0, 0.05, -0.62], { k: 1 }); k.cyl('l', [0.04, 0.002, 0.22], [0, 0.05, -0.5], { k: 0, seg: 8 }); k.tor('l', [0.068, 0.004], [0, 0.05, -0.62], { k: 0, r: [Math.PI / 2, 0, 0.5], seg: 16 });
      return { gh, pivot, screen: { pos: [-0.0425, 0.04, 0.09], rot: [0, -Math.PI / 2 + 0.3, 0], scale: 1.25 } };
    },
    anim(P, st, dt, t) { const g = clamp((st.t0 - 0.3) / 0.8, 0, 1), s = st.t0 < 0.3 ? 0.001 : easeOut(g); P.orb.scale.setScalar(Math.max(0.001, s * (1 + 0.05 * Math.sin(t * 8)))); P.orb.rotation.set(t, t * 1.4, 0); P.orb.position.z = P.orb.userData.base.z + (1 - s) * 0.08; },
    fire(P, st, ctx, G) { burst(ctx, G.hex, -0.72, 4, 0.05); },
  });
}

/* 11 · VÓRTICE */
function vortice(q, hands) {
  return make(11, q, hands, {
    muzzle: [0, 0.05, -0.62], flash: { shape: 'ring', size: 1.4, decay: 6 }, recoil: { z: 0.14, y: 0.02, pitch: 0.3, roll: 0.05, k: 110, c: 10 }, view: VIEW_L, heat: 0.7, kv: 1.3,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.16, 0.075], [0.14, 0.085], [0.16, 0.0], [-0.16, -0.012]], 0.075, 0, { c: B });
      k.prof('b', [[-0.16, 0.06], [-0.4, 0.03], [-0.42, -0.07], [-0.3, -0.07], [-0.16, -0.02]], 0.05, 0, { c: DARK });
      k.cyl('b', [0.04, 0.05, 0.36], [0, 0.05, -0.3], { c: GUN }); for (const z of [-0.18, -0.34]) k.cyl('b', [0.056, 0.056, 0.02], [0, 0.05, z], { c: B, seg: 10 });
      for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 1.57; k.limb('b', [Math.cos(a) * 0.04, 0.05 + Math.sin(a) * 0.04, -0.4], [Math.cos(a) * 0.09, 0.05 + Math.sin(a) * 0.09, -0.58], 0.01, 0.007, { c: A, ball: true }); }
      bezel(k, [-0.0385, 0.04, 0.09], [0, -Math.PI / 2 + 0.3, 0], 0.07, 0.04);
      const gh = stdGrip(k, -0.012); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.05, -0.24], 0.052, hex); }
      k.part('gyro', [0, 0.05, -0.58]); for (let i = 0; i < 3; i++) { k.tor('l', [0.085, 0.0055], [0, 0.05, -0.58], { k: 0, r: [i * Math.PI / 3, i * Math.PI / 3 + 0.5, i], seg: 22 }); }
      k.part('core', [0, 0.05, -0.58]); k.poly('l', 'ico', 0.032, [0, 0.05, -0.58], { k: 1 }); k.poly('l', 'oct', 0.05, [0, 0.05, -0.58], { k: 0, c: 0x444444 });
      return { gh, pivot, screen: { pos: [-0.0395, 0.04, 0.09], rot: [0, -Math.PI / 2 + 0.3, 0], scale: 1.25 } };
    },
    anim(P, st, dt, t, firing) { st.rot += dt * (1.5 + st.pulse * 12 + (firing ? 4 : 0)); P.gyro.rotation.set(st.rot, st.rot * 0.7, st.rot * 0.4); P.core.rotation.set(-t * 3, t * 2, 0); P.core.scale.setScalar(1 + 0.12 * Math.sin(t * 7) + st.pulse * 0.3); },
    fire(P, st, ctx, G) { burst(ctx, G.hex, -0.62, 4, 0.05); },
  });
}

/* 12 · LANZA */
function lanza(q, hands) {
  return make(12, q, hands, {
    muzzle: [0, 0.05, -1.15], flash: { shape: 'star', size: 1.2, decay: 8 }, recoil: { z: 0.11, y: 0.015, pitch: 0.2, roll: 0.02, k: 130, c: 13 }, view: { ...VIEW_L, scale: 0.85, zs: 0.45 }, heat: 0.8, kv: 1.2,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.16, 0.08], [0.12, 0.09], [0.2, 0.06], [0.2, -0.02], [-0.16, -0.012]], 0.066, 0, { c: B });
      k.prof('b', [[-0.16, 0.07], [-0.5, 0.05], [-0.54, -0.12], [-0.46, -0.12], [-0.4, -0.03], [-0.16, -0.02]], 0.04, 0, { c: DARK, holes: [[[-0.2, 0.05], [-0.45, 0.035], [-0.46, -0.06], [-0.4, -0.01], [-0.2, 0.0]]] });
      for (const sx of [-1, 1]) { k.box('b', [0.02, 0.05, 0.9], [sx * 0.032, 0.05, -0.65], { c: B, rad: 0.004 }); k.box('l', [0.002, 0.018, 0.86], [sx * 0.0215, 0.05, -0.65], { k: 0 }); k.prof('b', [[1.0, 0.075], [1.14, 0.05], [1.0, 0.025]], 0.02, sx * 0.032, { c: STEEL }); }
      for (const z of [-0.35, -0.6, -0.85]) { k.tor('l', [0.05, 0.007], [0, 0.05, z], { k: 3, seg: 6 }); k.box('b', [0.016, 0.012, 0.03], [0, 0.0, z], { c: GUN }); }
      k.cyl('b', [0.026, 0.026, 0.2], [0, 0.0, -0.45], { c: GUN }); bezel(k, [-0.0345, 0.04, 0.09], [0, -Math.PI / 2 + 0.3, 0], 0.07, 0.04);
      const gh = stdGrip(k, -0.012); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.0, -0.45], 0.028, hex); }
      k.part('spear', [0, 0.05, -0.2]); k.limb('l', [0, 0.05, -0.05], [0, 0.05, -0.95], 0.011, 0.011, { k: 1, seg: 6 }); k.cyl('l', [0.0005, 0.011, 0.2], [0, 0.05, -1.05], { k: 1, seg: 6 }); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.box('l', [0.004, 0.03, 0.06], [Math.cos(a) * 0.016, 0.05 + Math.sin(a) * 0.016, -0.1], { k: 0, r: [0, 0, a] }); }
      return { gh, pivot, screen: { pos: [-0.0365, 0.04, 0.09], rot: [0, -Math.PI / 2 + 0.3, 0], scale: 1.25 } };
    },
    anim(P, st, dt, t) { const need = st.t0 < 0.35 ? 0 : easeOut((st.t0 - 0.35) / 0.7); P.spear.visible = st.t0 > 0.3; P.spear.position.z = P.spear.userData.base.z + (1 - need) * 0.45; st.seq = -0.2 - ((t * 0.8) % 1) * 0.8; },
    fire(P, st, ctx, G) { burst(ctx, G.hex, -1.1, 3, 0.05); },
  });
}

/* 13 · CETRO VITAL */
function cetro(q, hands) {
  return make(13, q, hands, {
    muzzle: [0, 0.04, -0.98], flash: { shape: 'star', size: 0.9, decay: 11 }, recoil: { z: 0.04, y: 0.01, pitch: 0.1, roll: 0.04, k: 170, c: 14 }, view: { ...VIEW_L, scale: 0.9, zs: 0.5 }, heat: 0.15, kv: 0.8, cool: 0.6,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.1, 0.055], [0.08, 0.06], [0.1, 0.0], [-0.1, -0.012]], 0.05, 0, { c: B });
      k.cyl('b', [0.017, 0.022, 0.95], [0, 0.04, -0.4], { c: B, seg: 10 });
      for (let i = 0; i < 9; i++) k.cyl('b', [0.026, 0.026, 0.012], [0, 0.04, -0.1 - i * 0.1], { c: i % 2 ? A : GUN, seg: 10 });
      for (const sx of [-1, 1]) k.box('l', [0.004, 0.01, 0.8], [sx * 0.021, 0.04, -0.5], { k: 0 });
      for (let i = 0; i < 4; i++) { const z = -0.2 - i * 0.18; k.limb('b', [0, 0.04, z], [0.055, 0.0, z - 0.08], 0.006, 0.003, { c: A }); k.limb('b', [0, 0.04, z], [-0.055, 0.0, z - 0.08], 0.006, 0.003, { c: A }); }
      k.prof('b', [[-0.1, 0.045], [-0.32, 0.03], [-0.34, -0.06], [-0.26, -0.06], [-0.1, -0.015]], 0.04, 0, { c: DARK }); bezel(k, [-0.026, 0.035, 0.07], [0, -Math.PI / 2 + 0.3, 0], 0.06, 0.036);
      const gh = stdGrip(k, -0.012); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.04, -0.5], 0.026, hex); }
      k.part('head', [0, 0.04, -0.86]); k.poly('l', 'ico', 0.055, [0, 0.04, -0.86], { k: 1 });
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; k.limb('b', [Math.cos(a) * 0.03, 0.04 + Math.sin(a) * 0.03, -0.8], [Math.cos(a) * 0.085, 0.04 + Math.sin(a) * 0.085, -0.9], 0.012, 0.004, { c: A }); k.poly('l', 'tet', 0.012, [Math.cos(a) * 0.09, 0.04 + Math.sin(a) * 0.09, -0.92], { k: 0 }); }
      for (let i = 0; i < 3; i++) k.poly('l', 'oct', 0.008, [Math.cos(i * 2.1) * 0.09, 0.04 + Math.sin(i * 2.1) * 0.09, -0.86], { k: 1 });
      return { gh, pivot, screen: { pos: [-0.0275, 0.035, 0.07], rot: [0, -Math.PI / 2 + 0.3, 0], scale: 1.1 } };
    },
    anim(P, st, dt, t) { P.head.rotation.set(t * 0.5, 0, t * 1.2); const b = 1 + 0.08 * Math.sin(t * 4.5) + st.pulse * 0.3; P.head.scale.setScalar(b); },
    fire(P, st, ctx, G) { if (ctx) { burst(ctx, G.hex, -0.98, 3, 0.04); ctx.puff([0, 0.04, -0.2], [0, 0.4, 0.5], 0x9bffa0, { size: 0.07, grow: 0.15, life: 0.8, alpha: 0.3 }); } },
  });
}

/* 14 · ECLIPSE */
function eclipse(q, hands) {
  return make(14, q, hands, {
    muzzle: [0, 0.045, -0.72], eject: [0.05, 0.06, 0.0], flash: { shape: 'fan', size: 1.3, decay: 8 }, recoil: { z: 0.2, y: 0.04, pitch: 0.45, roll: 0.05, k: 100, c: 10 }, view: VIEW_L, heat: 0.7, kv: 1.3,
    build(k, G, hands) {
      const { hex, B, A } = G;
      k.prof('b', [[-0.17, 0.085], [0.12, 0.095], [0.16, 0.06], [0.16, -0.02], [-0.17, -0.012]], 0.11, 0, { c: B });
      k.box('b', [0.112, 0.012, 0.28], [0, 0.098, 0.0], { c: A }); k.cyl('l', [0.02, 0.02, 0.12], [0, 0.114, 0.0], { k: 1, seg: 6 });
      k.prof('b', [[-0.17, 0.07], [-0.46, 0.035], [-0.5, -0.1], [-0.4, -0.13], [-0.17, -0.02]], 0.055, 0, { c: DARK }); k.box('l', [0.05, 0.12, 0.01], [0, -0.04, 0.5], { k: 0 });
      for (const sx of [-1, 1]) { k.cyl('b', [0.036, 0.036, 0.6], [sx * 0.044, 0.045, -0.42], { c: GUN }); k.cyl('l', [0.026, 0.026, 0.008], [sx * 0.044, 0.045, -0.722], { k: 1 }); for (const z of [-0.3, -0.5, -0.66]) k.cyl('b', [0.039, 0.039, 0.02], [sx * 0.044, 0.045, z], { c: B, seg: 12 }); }
      bezel(k, [-0.0565, 0.04, 0.1], [0, -Math.PI / 2 + 0.3, 0], 0.07, 0.04);
      const gh = stdGrip(k, -0.012); let pivot = null; if (hands) pivot = rightHand(k, gh, hex);
      k.part('pump', [0, -0.01, -0.34]); k.box('b', [0.1, 0.05, 0.2], [0, -0.01, -0.34], { c: B, rad: 0.014 }); for (let i = 0; i < 5; i++) k.box('b', [0.102, 0.052, 0.008], [0, -0.01, -0.27 - i * 0.03], { c: DARK }); k.box('l', [0.004, 0.012, 0.14], [-0.051, -0.01, -0.34], { k: 0 }); if (hands) supportHand(k, [0, 0.0, -0.34], 0.05, hex);
      k.part('disc', [0, 0.045, -0.45]); k.cyl('b', [0.06, 0.06, 0.01], [0, 0.045, -0.45], { c: 0x030206, seg: 20 }); k.tor('l', [0.063, 0.006], [0, 0.045, -0.45], { k: 0, seg: 20 }); gem(k, 0.008, 0, 8, 0.063, -0.45, 0.045);
      return { gh, pivot, screen: { on: 'main', pos: [-0.0575, 0.04, 0.1], rot: [0, -Math.PI / 2 + 0.3, 0], scale: 1.25 } };
    },
    anim(P, st, dt, t, firing, G, W) {
      let off = 0; const p = (st.t0 - 0.2) / 0.5; if (p > 0 && p < 1) off = p < 0.45 ? easeOut(p / 0.45) : 1 - (p - 0.45) / 0.55;
      P.pump.position.z = P.pump.userData.base.z + off * 0.12; st.rot += dt * (1.2 + st.pulse * 10); P.disc.rotation.z = st.rot; const s = 1 + st.pulse * 0.3; P.disc.scale.set(s, s, 1);
      if (p > 0.4 && p < 0.5 && st.ctx && !st.ej) { st.ej = true; st.ctx.shard([0.05, 0.06, 0], [1.5, 1.6, 0.6], G.hex, 2.2); } if (p > 0.6) st.ej = false;
    },
    fire(P, st, ctx, G) { if (ctx) for (const sx of [-1, 1]) { ctx.puff([sx * 0.044, 0.045, -0.73], [sx * 0.2, 0.05, -0.6], G.hex, { size: 0.12, grow: 0.4, life: 0.5, alpha: 0.45 }); } },
  });
}

export const EXTRA = [pulso, gemelas, solar, fractal, enjambre, cometa, vortice, lanza, cetro, eclipse];
