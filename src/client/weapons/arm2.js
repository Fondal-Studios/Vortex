// Armería 2/3 — Pulso (5), Gemelas (6), Solar (7), Fractal (8), Enjambre (9).
import { rightHand, supportHand } from './hands.js';
import { forge, grip, plate, armor, stripe, piping, inset, DEC, rail, holo, fins, screenAt, crownRing, stock, stock2, shroud, clamp, damp, easeOut, easeInOut, Spring, PI, puffs, casing } from './forge.js';

const VS = { pos: [0.3, -0.25, -0.58], scale: 2.2, zs: 0.7, rot: [-0.02, 0.45, -0.02] };
const VL = { pos: [0.32, -0.3, -0.62], scale: 2.2, zs: 0.55, rot: [-0.02, 0.5, -0.03] };

/* ═════════════ 5 · PULSO — cañón de mano: tambor hexagonal de celdas de energía y tres anillos de choque ═════════════ */
export function pulso(q, hands) {
  return forge(5, q, hands, {
    muzzle: [0, 0.045, -0.5], eject: [0.03, 0.06, 0.0], flash: { shape: 'ring', size: 0.8, decay: 12 },
    recoil: { z: 0.07, y: 0.014, pitch: 0.2, roll: 0.02, k: 220, c: 17 }, view: VS, heat: 0.3, kv: 1.5,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      // armazón: culata con martillo, puente superior, tirante bajo el cañón
      k.prof('b', [[-0.12, -0.004], [-0.125, 0.07], [-0.08, 0.098], [0.03, 0.1], [0.03, -0.004]], 0.05, 0, { c: P.gm, bevel: 0.006 });
      k.prof('b', [[-0.04, 0.1], [-0.02, 0.112], [0.15, 0.112], [0.17, 0.095], [0.15, 0.082], [-0.03, 0.082]], 0.044, 0, { c: P.gm3, bevel: 0.005 });            // puente sobre el tambor
      k.cbox('b', [0.016, 0.03, 0.03], [0, 0.1, 0.115], { c: P.dk, r: [0.5, 0, 0], ch: 0.004 });                                                                    // martillo
      for (const sx of [-1, 1]) { armor(k, P, sx, [[-0.1, 0.004], [-0.1, 0.07], [-0.07, 0.092], [0.0, 0.092], [0.025, 0.05], [0.0, 0.004]], 0.0265, { dec: DEC.circuito, w: 0.005 }); k.cbox('b', [0.006, 0.05, 0.1], [sx * 0.0265, 0.03, -0.13], { c: P.dom2, ch: 0.002 }); }
      k.cbox('b', [0.006, 0.04, 0.07], [-0.0265, 0.047, 0.072], { c: P.dk, ch: 0.002 });
      const gh = grip(k, P, -0.004, { len: 0.18 }); let pivot = null; if (hands) pivot = rightHand(k, gh, hex);
      // cañón grueso con riel ventilado y punto de mira
      k.loft('b', [{ z: -0.15, w: 0.052, h: 0.056, y: 0.045, ch: 0.014 }, { z: -0.44, w: 0.05, h: 0.052, y: 0.045, ch: 0.013 }], { c: P.dom2, edge: 1.5 });
      k.cbox('b', [0.02, 0.014, 0.28], [0, 0.082, -0.3], { c: P.dk, ch: 0.003 }); k.gem('b', [0.008, 0.016], [0, 0.098, -0.42], { n: 4, axis: 'y', c: P.pale });
      k.cbox('b', [0.04, 0.036, 0.1], [0, 0.0, -0.2], { c: P.gm3, ch: 0.007 });
      for (const z of [-0.22, -0.3, -0.38]) k.cbox('b', [0.056, 0.016, 0.01], [0, 0.045, z], { c: P.dom, ch: 0.003 });
      k.cbox('b', [0.058, 0.06, 0.03], [0, 0.045, -0.45], { c: P.dom, ch: 0.01 });
      // tambor hexagonal de celdas (gira 60° por disparo)
      k.part('cyl', [0, 0.04, -0.09]);
      k.cyl('b', [0.05, 0.05, 0.12], [0, 0.04, -0.09], { c: P.gm2, seg: 6 });
      for (let i = 0; i < 6; i++) { const a = i * PI / 3; k.gem('l', [0.0125, 0.058], [Math.cos(a) * 0.043, 0.04 + Math.sin(a) * 0.043, -0.09], { k: 1, n: 4, axis: 'z', tip: 0.18, r: [0, 0, a] }); }
      k.cyl('b', [0.036, 0.036, 0.13], [0, 0.04, -0.09], { c: P.dk, seg: 6 });
      // tres anillos de choque en la boca (laten hacia afuera)
      k.part('rings', [0, 0.045, -0.47]);
      for (const [r, z] of [[0.034, -0.465], [0.044, -0.485], [0.054, -0.505]]) k.tor('l', [r, 0.0045], [0, 0.045, z], { k: 0, seg: low ? 10 : 18 });
      return { gh, pivot, screen: { on: 'main', pos: [-0.0298, 0.047, 0.072], rot: [0, -PI / 2 + 0.3, 0], scale: 0.95 }, fore: null };
    },
    anim(P, st, dt, t, firing) {
      st.cr = damp(st.cr || 0, st.n * PI / 3, 14, dt); P.cyl.rotation.z = st.cr; const s = 1 + st.pulse * 0.4; P.rings.scale.set(s, s, 1 + st.pulse * 0.5); P.rings.rotation.z += dt * (1.5 + st.pulse * 6);
    },
    fire(P, st, ctx, G) { casing(ctx, G.hex, [0.03, 0.06, 0.0], [1, 1.1, 0.5]); puffs(ctx, G.hex, -0.5, 2, 0.045); },
  });
}

/* ═════════════ 6 · GEMELAS — subfusil de dos cañones paralelos que retroceden por turnos ═════════════ */
export function gemelas(q, hands) {
  return forge(6, q, hands, {
    muzzle: [0, 0.045, -0.6], eject: [0.04, 0.07, 0.0], flash: { shape: 'jet', size: 0.55, decay: 24 },
    recoil: { z: 0.03, y: 0.005, pitch: 0.05, roll: 0.02, k: 300, c: 22 }, view: VS, heat: 0.07, kv: 0.6,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      k.prof('b', [[-0.14, -0.012], [-0.14, 0.072], [-0.1, 0.09], [0.12, 0.094], [0.19, 0.05], [0.19, -0.02]], 0.092, 0, { c: P.gm, bevel: 0.007 });
      k.cbox('b', [0.09, 0.012, 0.2], [0, 0.098, -0.02], { c: P.dom2, ch: 0.003 });
      k.gem('l', [0.02, 0.1], [0, 0.114, -0.04], { k: 1, n: 6, axis: 'z', tip: 0.22 });                                          // espina de cristal en el lomo
      for (const sx of [-1, 1]) {
        armor(k, P, sx, [[-0.1, -0.004], [-0.1, 0.07], [-0.06, 0.088], [0.1, 0.09], [0.16, 0.05], [0.11, -0.004]], 0.0475, { dec: DEC.circuito, w: 0.005 });
        armor(k, P, sx, [[0.0, 0.01], [0.0, 0.07], [0.08, 0.072], [0.11, 0.04], [0.09, 0.01]], 0.0505, { c: P.dom2, c2: P.dk, dec: DEC.nervadura, w: 0.003 });
        k.cbox('b', [0.006, 0.06, 0.1], [sx * 0.0475, 0.02, -0.12], { c: P.dk, ch: 0.002 });
        for (let i = 0; i < 4; i++) k.box('l', [0.004, 0.034, 0.012], [sx * 0.0505, 0.02, -0.085 - i * 0.022], { k: 2 });          // cargadores de celdas
      }
      k.cbox('b', [0.006, 0.042, 0.075], [-0.0485, 0.045, 0.075], { c: P.dk, ch: 0.002 });
      const gh = grip(k, P, -0.012, { len: 0.17 }); let pivot = null; if (hands) pivot = rightHand(k, gh, hex);
      // cuña frontal en V con cristal entre los cañones
      k.loft('b', [{ z: -0.18, w: 0.09, h: 0.07, y: 0.04, ch: 0.014 }, { z: -0.26, w: 0.085, h: 0.05, y: 0.045, ch: 0.012 }], { c: P.gm3 });
      k.gem('l', [0.011, 0.045], [0, 0.045, -0.3], { k: 1, n: 5, axis: 'z' });
      holo(k, P, [0, 0.1, 0.07], 0.9);
      for (const sx of [-1, 1]) {
        k.part(sx < 0 ? 'barL' : 'barR', [sx * 0.044, 0.045, 0]);
        k.cyl('b', [0.02, 0.02, 0.44], [sx * 0.044, 0.045, -0.37], { c: P.gm3, seg: 8 }); k.cyl('b', [0.029, 0.029, 0.07], [sx * 0.044, 0.045, -0.565], { c: P.dom, seg: 8 }); k.cyl('l', [0.015, 0.015, 0.01], [sx * 0.044, 0.045, -0.604], { k: 1 });
        for (const z of [-0.3, -0.4, -0.5]) k.tor('l', [0.023, 0.003], [sx * 0.044, 0.045, z], { k: 0, seg: 10 });
      }
      return { gh, pivot, screen: { on: 'main', pos: [-0.0518, 0.045, 0.075], rot: [0, -PI / 2 + 0.3, 0], scale: 1.15 }, fore: null };
    },
    anim(P, st, dt) { st.s1.step(dt); st.s2.step(dt); P.barL.position.z = P.barL.userData.base.z + clamp(st.s1.x, -0.01, 0.05); P.barR.position.z = P.barR.userData.base.z + clamp(st.s2.x, -0.01, 0.05); },
    fire(P, st, ctx, G) { (st.n % 2 ? st.s1 : st.s2).v += 1.8; if (ctx) { const x = st.n % 2 ? -0.044 : 0.044; ctx.shard([x, 0.07, 0.0], [x * 25 + 0.5, 1, 0.5], G.hex, 0.7); if (Math.random() < 0.5) ctx.puff([x, 0.045, -0.62], [0, 0.05, -0.1], G.hex, { size: 0.07, grow: 0.2, life: 0.25, alpha: 0.32 }); } },
  });
}

/* ═════════════ 7 · SOLAR — lanzador de luz: tanque de plasma y tobera en corona ═════════════ */
export function solar(q, hands) {
  return forge(7, q, hands, {
    muzzle: [0, 0.04, -0.5], flash: { shape: 'ball', size: 0.9, decay: 10 },
    recoil: { z: 0.02, y: 0.003, pitch: 0.03, roll: 0.02, k: 300, c: 22 }, view: { ...VL, scale: 1.75 }, heat: 0.05, kv: 0.4, cool: 0.5,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      k.prof('b', [[-0.16, -0.012], [-0.16, 0.07], [-0.1, 0.086], [0.1, 0.088], [0.14, 0.06], [0.14, -0.012]], 0.07, 0, { c: P.gm, bevel: 0.006 });
      for (const sx of [-1, 1]) { armor(k, P, sx, [[-0.1, 0.0], [-0.1, 0.075], [0.0, 0.083], [0.11, 0.055], [0.08, 0.0]], 0.0365, { dec: DEC.circuito, w: 0.005 }); armor(k, P, sx, [[0.0, 0.01], [0.0, 0.06], [0.06, 0.062], [0.08, 0.04], [0.06, 0.01]], 0.0395, { c: P.dom2, c2: P.dk, dec: DEC.nervadura, w: 0.003 }); }
      k.cbox('b', [0.006, 0.042, 0.075], [-0.0375, 0.045, 0.095], { c: P.dk, ch: 0.002 });
      // tanque de plasma encima, con correas
      k.cyl('b', [0.046, 0.046, 0.29], [0, 0.145, -0.02], { c: P.gm3, seg: low ? 10 : 14 });
      k.cyl('l', [0.036, 0.036, 0.25], [0, 0.145, -0.02], { k: 0, seg: low ? 8 : 12 });
      for (const z of [-0.12, -0.04, 0.04, 0.1]) k.cyl('b', [0.05, 0.05, 0.016], [0, 0.145, z], { c: P.dk, seg: low ? 10 : 14 });
      for (const z of [-0.17, 0.13]) k.cyl('b', [0.04, 0.05, 0.03], [0, 0.145, z], { c: P.dom, seg: low ? 10 : 14 });
      k.limb('b', [0, 0.09, 0.0], [0, 0.1, 0.0], 0.014, 0.014, { c: P.gm3 }); k.limb('b', [0, 0.1, -0.1], [0, 0.082, -0.18], 0.011, 0.011, { c: P.dk });      // mangueras
      stock2(k, P, 'tubo', { z0: 0.16, len: 0.24, top: 0.062, bot: -0.08 });
      const gh = grip(k, P, -0.012, { len: 0.17 }); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.04, -0.18], 0.048, hex); }
      k.cyl('b', [0.046, 0.05, 0.15], [0, 0.04, -0.205], { c: P.dom2, seg: low ? 10 : 14 });
      for (const z of [-0.15, -0.2, -0.25]) k.cyl('b', [0.052, 0.052, 0.01], [0, 0.04, z], { c: P.dk, seg: low ? 10 : 14 });
      // tobera: corona de ocho pétalos, dos aros de luz y el sol
      for (let i = 0; i < 8; i++) { const a = i * PI / 4, c = Math.cos(a), s = Math.sin(a); k.limb('b', [c * 0.046, 0.04 + s * 0.046, -0.28], [c * 0.118, 0.04 + s * 0.118, -0.47], 0.012, 0.008, { c: i % 2 ? P.dom : P.pale, seg: 5 }); }
      k.tor('l', [0.118, 0.006], [0, 0.04, -0.47], { k: 0, seg: low ? 12 : 22 }); k.tor('l', [0.082, 0.005], [0, 0.04, -0.375], { k: 0, seg: low ? 10 : 18 });
      k.part('sun', [0, 0.04, -0.34]);
      k.gem('l', [0.034, 0.05], [0, 0.04, -0.34], { k: 1, n: 8, axis: 'x', tip: 0.3 }); k.gem('l', [0.026, 0.04], [0, 0.04, -0.34], { k: 1, n: 6, axis: 'y', tip: 0.3, twist: 0.4 });
      for (let i = 0; i < 6; i++) { const a = i * PI / 3; k.gem('l', [0.008, 0.016], [Math.cos(a) * 0.062, 0.04 + Math.sin(a) * 0.062, -0.34], { k: 1, n: 4, axis: 'y', r: [0, 0, a + PI / 2] }); }
      return { gh, pivot, screen: { on: 'main', pos: [-0.0405, 0.045, 0.095], rot: [0, -PI / 2 + 0.3, 0], scale: 1.15 }, fore: [0, 0.04, -0.18] };
    },
    anim(P, st, dt, t, firing, G) { P.sun.rotation.set(t * 2, t * 3, 0); P.sun.scale.setScalar(1 + 0.08 * Math.sin(t * 9) + (firing ? 0.25 : 0)); if (firing) { G.heat = Math.min(1, G.heat + dt * 1.2); if (st.ctx && Math.random() < dt * 40) st.ctx.puff([0, 0.04, -0.47], [(Math.random() - 0.5) * 0.3, (Math.random() - 0.3) * 0.2, -0.7], 0xffb040, { size: 0.11, grow: 0.35, life: 0.45, alpha: 0.35 }); } },
  });
}

/* ═════════════ 8 · FRACTAL — fusil de arco: espina de energía con ramas de cristal que se bifurcan ═════════════ */
export function fractal(q, hands) {
  return forge(8, q, hands, {
    muzzle: [0, 0.045, -0.92], flash: { shape: 'jet', size: 0.9, decay: 12 },
    recoil: { z: 0.05, y: 0.008, pitch: 0.1, roll: 0.03, k: 200, c: 16 }, view: { ...VL, scale: 1.65 }, heat: 0.4, kv: 1,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      k.prof('b', [[-0.14, -0.012], [-0.14, 0.07], [-0.08, 0.086], [0.1, 0.088], [0.13, 0.0]], 0.06, 0, { c: P.gm, bevel: 0.006 });
      for (const sx of [-1, 1]) armor(k, P, sx, [[-0.1, 0.0], [-0.1, 0.07], [-0.02, 0.08], [0.09, 0.05], [0.06, 0.0]], 0.0315, { dec: DEC.circuito, w: 0.005 });
      k.cbox('b', [0.006, 0.042, 0.075], [-0.0315, 0.04, 0.07], { c: P.dk, ch: 0.002 });
      stock2(k, P, 'plegable', { z0: 0.14, len: 0.26, top: 0.055, bot: -0.07 });
      const gh = grip(k, P, -0.012, { len: 0.17 }); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.045, -0.32], 0.034, hex); }
      // espina: dos rieles oscuros y una varilla de energía
      for (const sx of [-1, 1]) k.loft('b', [{ z: -0.1, w: 0.012, h: 0.05, x: sx * 0.022, y: 0.045, ch: 0.003 }, { z: -0.8, w: 0.012, h: 0.05, x: sx * 0.022, y: 0.045, ch: 0.003 }], { c: P.gm3 });
      k.limb('l', [0, 0.045, -0.1], [0, 0.045, -0.82], 0.014, 0.014, { k: 0, seg: 8 });
      for (const z of [-0.17, -0.45, -0.72]) k.cbox('b', [0.06, 0.06, 0.02], [0, 0.045, z], { c: P.dom2, ch: 0.01 });
      // ramas fractales: cada rama sale de la espina, se divide en dos y cada punta termina en un cristal
      for (let i = 0; i < (low ? 5 : 7); i++) {
        const z = -0.2 - i * 0.085, sgn = i % 2 ? 1 : -1, len = 0.075 - i * 0.004, a = 0.7 * sgn, c = Math.cos(a), s = Math.sin(a);
        const p0 = [0, 0.045, z], p1 = [-s * len * 0.7, 0.045 + c * len, z - 0.03], p2 = [-s * len * 1.1 - sgn * 0.02, 0.045 + c * len * 1.3, z - 0.075], p3 = [-s * len * 0.9 + sgn * 0.03, 0.045 + c * len * 1.25, z - 0.06];
        k.limb('l', p0, p1, 0.0085, 0.006, { k: 3, seg: 5 }); k.limb('l', p1, p2, 0.006, 0.0035, { k: 3, seg: 5 }); k.limb('l', p1, p3, 0.006, 0.0035, { k: 3, seg: 5 });
        k.gem('l', [0.007, 0.014], p2, { k: 3, n: 4, axis: 'y' }); k.gem('l', [0.007, 0.014], p3, { k: 3, n: 4, axis: 'y' });
      }
      // diapasón del emisor
      for (const sx of [-1, 1]) k.loft('b', [{ z: -0.8, w: 0.01, h: 0.05, x: sx * 0.03, y: 0.045, ch: 0.002 }, { z: -0.92, w: 0.006, h: 0.034, x: sx * 0.03, y: 0.045, ch: 0.002 }], { c: P.pale });
      k.gem('l', [0.012, 0.05], [0, 0.045, -0.88], { k: 1, n: 5, axis: 'z' });
      return { gh, pivot, screen: { on: 'main', pos: [-0.0345, 0.04, 0.07], rot: [0, -PI / 2 + 0.3, 0], scale: 1.1 }, fore: [0, 0.045, -0.32] };
    },
    anim(P, st, dt, t) { const sp = st.t0 < 0.4 ? 3 : 1; st.seq = -0.2 - (((t * 1.6 * sp) % 1) * 0.6); },
    fire(P, st, ctx, G) { if (ctx) for (let i = 0; i < 5; i++) ctx.shard([(Math.random() - 0.5) * 0.04, 0.045 + (Math.random() - 0.5) * 0.08, -0.2 - Math.random() * 0.5], [(Math.random() - 0.5) * 2, Math.random() * 1.5, -0.5], i % 2 ? G.hex : 0xffffff, 0.8); },
  });
}

/* ═════════════ 9 · ENJAMBRE — lanzador de micromisiles: racimo giratorio de cinco tubos con ojivas visibles ═════════════ */
export function enjambre(q, hands) {
  return forge(9, q, hands, {
    muzzle: [0, 0.05, -0.74], flash: { shape: 'fan', size: 1.0, decay: 9 },
    recoil: { z: 0.1, y: 0.02, pitch: 0.25, roll: 0.03, k: 130, c: 12 }, view: VL, heat: 0.5, kv: 1.2,
    build(k, G, hands) {
      const { P } = G, hex = G.hex, low = G.low;
      k.prof('b', [[-0.16, -0.012], [-0.16, 0.075], [-0.1, 0.092], [0.14, 0.094], [0.17, 0.0]], 0.076, 0, { c: P.gm, bevel: 0.006 });
      for (const sx of [-1, 1]) { armor(k, P, sx, [[-0.1, 0.0], [-0.1, 0.075], [0.0, 0.088], [0.1, 0.06], [0.12, 0.0]], 0.0385, { dec: DEC.circuito, w: 0.005 }); armor(k, P, sx, [[0.0, 0.012], [0.0, 0.06], [0.05, 0.062], [0.08, 0.036], [0.06, 0.012]], 0.0415, { c: P.dom2, c2: P.dk, dec: DEC.nervadura, w: 0.003 }); }
      k.cbox('b', [0.006, 0.042, 0.075], [-0.0385, 0.04, 0.09], { c: P.dk, ch: 0.002 });
      for (let i = 0; i < 5; i++) k.box('l', [0.008, 0.008, 0.012], [-0.03 + i * 0.015, 0.1, -0.06], { k: 2 });
      // antena de seguimiento
      for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.026; k.limb('b', [x, 0.094, 0.0], [x * 1.4, 0.15 + (i === 1 ? 0.03 : 0), -0.02], 0.004, 0.003, { c: P.pale, seg: 5 }); k.gem('l', [0.007, 0.012], [x * 1.4, 0.158 + (i === 1 ? 0.03 : 0), -0.02], { k: 2, n: 4, axis: 'y' }); }
      k.cbox('b', [0.07, 0.014, 0.08], [0, 0.101, 0.0], { c: P.dom2, ch: 0.003 });
      stock2(k, P, 'bloque', { z0: 0.16, len: 0.26, top: 0.07, bot: -0.075, w: 0.05 });
      const gh = grip(k, P, -0.012, { len: 0.17 }); let pivot = null; if (hands) { pivot = rightHand(k, gh, hex); supportHand(k, [0, 0.0, -0.32], 0.05, hex); }
      k.cbox('b', [0.07, 0.05, 0.3], [0, -0.0, -0.32], { c: P.gm3, ch: 0.012 });                                  // pie de carga bajo el racimo
      // racimo giratorio: 5 tubos con ojivas de cristal
      k.part('cluster', [0, 0.05, -0.4]);
      for (let i = 0; i < 5; i++) {
        const a = i * PI * 2 / 5 + 0.3, x = Math.cos(a) * 0.05, y = 0.05 + Math.sin(a) * 0.05;
        k.cyl('b', [0.0235, 0.0235, 0.5], [x, y, -0.43], { c: i % 2 ? P.gm3 : P.dom2, seg: low ? 8 : 10 });
        k.gem('l', [0.017, 0.045], [x, y, -0.71], { k: 1, n: 5, axis: 'z', tip: 0.6 }); k.tor('l', [0.0245, 0.0025], [x, y, -0.6], { k: 0, seg: 10 });
      }
      k.limb('l', [0, 0.05, -0.17], [0, 0.05, -0.66], 0.014, 0.014, { k: 0 });
      for (const z of [-0.2, -0.45, -0.66]) k.cyl('b', [0.08, 0.08, 0.02], [0, 0.05, z], { c: z === -0.45 ? P.dom : P.dk, seg: 5 });
      return { gh, pivot, screen: { on: 'main', pos: [-0.0415, 0.04, 0.09], rot: [0, -PI / 2 + 0.3, 0], scale: 1.2 }, fore: [0, 0.0, -0.32] };
    },
    anim(P, st, dt) { st.rot = damp(st.rot, st.n * PI * 2 / 5, 8, dt); P.cluster.rotation.z = st.rot; },
    fire(P, st, ctx, G) { if (ctx) { puffs(ctx, G.hex, -0.72, 3, 0.05); for (let i = 0; i < 5; i++) ctx.puff([0, 0.05, -0.4 - i * 0.05], [0, 0.1, 0.1], 0xffffff, { size: 0.06, grow: 0.2, life: 0.6, alpha: 0.2 }); } },
  });
}

export const A2 = [pulso, gemelas, solar, fractal, enjambre];
