// PIEZAS DE EVOLUCIÓN genéricas del kit de Huéspedes: una pieza FÍSICA y reconocible por cada camino de EVO_PATHS (src/sim/data.js), anclada a los huesos del cuerpo
// unificado. Sirven para los cinco Huéspedes (el color sale de ctx.glow / ctx.ember; cada diseño puede pasar su paleta en `pal` o dibujar la suya y no llamar a esto):
//   nivel 1  depredador → garras largas, colmillos de la máscara y púas dorsales  |  coraza → placas extra (abanico en hombros, rodilleras, escamas de pecho, espaldar)
//   nivel 2  velocidad  → tendones de luz, cuchillas de pantorrilla y toberas   |  resonancia → anillos de runas que giran alrededor del núcleo (más grande)
//   nivel 3  simbiosis  → brazo derecho fundido en carne con venas + ojo y tentáculos con física  |  artillería → cañones de cristal en los hombros y cresta de cristal
//   nivel 4  apoteosis  → alas de luz (14 plumas con aleteo) + aureola quebrada    |  anomalía → grietas de vacío y esquirlas negras en órbita
// Uso: const evo = addEvolution(ak, ctx, { t, pal }); y en el update del diseño: evo.update(dt, time, ctx).
import * as T from 'three';
import { tools, V } from './huesped-piezas.js';

export function addEvolution(ak, ctx, o = {}) {
  if (!ctx.evo) return { update() {} };
  const t = o.t || tools(ak), { G, X, spikeAt, seam, limb, ringAt, dome, bonelump, S, low } = t, P = (n) => ak.P(n), add = ak.add, upd = [];
  const pal = { steel: 0xaab0c8, steelD: 0x666a82, bone: 0xd8c8a4, boneL: 0xfff0d6, ...(o.pal || {}) };
  const glow = ctx.glow, ember = ctx.ember, Y = V(0, 1, 0), Xv = V(1, 0, 0), Zv = V(0, 0, 1), has = ctx.has, HC = V(0, 1.6, 0.06);
  const tint = new T.Color(glow), white = new T.Color(0xffffff), VIOLET = 0xb070ff;

  // ═════════════ NIVEL 1
  if (has('depredador')) {
    ak.both(() => { // garras largas de hueso con filo de brasa en cada dedo
      for (const [f, len, r] of (low ? [['finger3', 0.21, 0.011], ['finger4', 0.18, 0.0105]] : [['finger2', 0.17, 0.0105], ['finger3', 0.21, 0.011], ['finger4', 0.18, 0.0105], ['finger5', 0.13, 0.009]])) {
        const a = P(`${f}-2`), b = P(`${f}-3`), d = b.clone().sub(a).normalize();
        add('bone', spikeAt(b.clone().addScaledVector(d, 0.01), d.clone().add(V(0, -0.15, 0.2)), len, r, -0.03, V(0, 0.4, 0.2), { radial: S(5, 4), ridges: 3, ridgeAmp: 0.15 }), `${f}-3`, { color: pal.boneL });
        if (!low) add('ember', spikeAt(b.clone().addScaledVector(d, 0.05), d.clone().add(V(0, -0.15, 0.2)), len * 0.62, 0.0032, -0.02, V(0, 0.4, 0.2), { radial: 3, tubular: 3 }), `${f}-3`, { color: ember });
      }
      add('bone', spikeAt(P('finger1-3'), P('finger1-3').sub(P('finger1-2')).add(V(0, 0, 0.3)), 0.13, 0.0095, -0.02, V(0, 1, 0.3), { radial: S(5, 4) }), 'finger1-3', { color: pal.boneL });
      // colmillos de la máscara (cuelgan de las mejillas) y púas del antebrazo
      add('bone', spikeAt(V(0.045, HC.y - 0.1, HC.z + 0.13), V(0.15, -1, 0.5), 0.1, 0.014, 0.012, Zv, { radial: S(5, 4) }), 'head', { color: pal.boneL });
      add('bone', spikeAt(V(0.085, HC.y - 0.075, HC.z + 0.1), V(0.4, 1, 0.8), 0.07, 0.012, 0.01, Zv, { radial: S(5, 4) }), 'head', { color: pal.boneL });
      const S1 = P('upperarm01'); // guadañas de hueso sobre los hombros
      add('bone', spikeAt(S1.clone().add(V(0.05, 0.13, -0.03)), V(0.45, 1, -0.5), 0.36, 0.03, 0.14, V(0, 0, -1), { radial: S(6, 4), ridges: 3, ridgeAmp: 0.2 }), 'upperarm01', { color: pal.boneL });
      add('ember', spikeAt(S1.clone().add(V(0.06, 0.2, -0.05)), V(0.45, 1, -0.5), 0.26, 0.0045, 0.11, V(0, 0, -1), { radial: 3, tubular: 4 }), 'upperarm01', { color: ember });
      const E0 = P('lowerarm01'), W0 = P('wrist');
      for (let i = 0; i < (low ? 1 : 3); i++) add('bone', limb(spikeAt(V(0, 0, 0), V(-1, 0.1, -0.4), 0.09 - i * 0.015, 0.012, 0.012, Y, { radial: S(5, 4) }), E0, W0, 0.28 + i * 0.22, { off: [-0.07, 0, -0.03] }), 'lowerarm01', { color: pal.bone });
    });
    for (let i = 0; i < (low ? 2 : 4); i++) add('bone', spikeAt(V(0, 1.4 - i * 0.075, -0.1), V(0, 0.55, -1), 0.22 - i * 0.025, 0.02, 0.05, Y, { radial: S(6, 4), ridges: 3, ridgeAmp: 0.2 }), i < 2 ? 'spine01' : 'spine02', { color: pal.boneL });
  }
  if (has('coraza')) {
    ak.both(() => {
      const S0 = P('upperarm01'), C0 = S0.clone().add(V(0.05, 0.07, 0)), K = P('lowerleg01'), E0 = P('lowerarm01'), W0 = P('wrist');
      for (let i = 0; i < (low ? 2 : 3); i++) { // abanico de placas sobre la hombrera
        const pl = G.wrapE(G.plate([[-0.05, 0.0], [0.05, 0.0], [0.065 - i * 0.008, 0.14 + i * 0.045], [0, 0.18 + i * 0.05], [-0.065 + i * 0.008, 0.14 + i * 0.045]], 0.016, 0.005), 0.12, 0.12); X(pl, { p: [C0.x - 0.02 + i * 0.012, C0.y + 0.0, C0.z + 0.0], r: [0, Math.PI / 2 + (i - 1) * 0.1, -0.5 - i * 0.22] }); add('metal', pl, 'upperarm01', { color: i === 1 ? pal.steel : pal.steelD });
      }
      add('gold', X(G.torus(0.15, 0.005, 4, S(18, 9)), { p: [C0.x - 0.02, C0.y - 0.02, C0.z], r: [0, 0, -0.42] }), 'upperarm01');
      add('metal', X(G.wrapE(G.plate([[-0.07, 0.07], [0.07, 0.07], [0.09, 0.0], [0.05, -0.1], [-0.05, -0.1], [-0.09, 0.0]], 0.022, 0.008), 0.09, 0.09), { p: [K.x, K.y, K.z + 0.0], r: [0, 0, 0] }), 'lowerleg01', { color: pal.steel }); // rodillera
      add('gold', X(G.wrapE(G.plate([[-0.07, 0.07], [0.07, 0.07], [0.075, 0.062], [-0.075, 0.062]], 0.026, 0.003), 0.092, 0.09), { p: [K.x, K.y, K.z] }), 'lowerleg01');
      add('metal', limb(G.wrapE(G.plate([[-0.06, 0.1], [0.06, 0.1], [0.07, -0.1], [0, -0.14], [-0.07, -0.1]], 0.016, 0.005), 0.07, 0.072), E0, W0, 0.5, { r: [0, Math.PI / 2, 0], off: [-0.045, 0, 0] }), 'lowerarm01', { color: pal.steel }); // escudete de antebrazo
      for (let i = 0; i < (low ? 1 : 3); i++) add('bone', X(G.wrapE(G.plate([[-0.045, 0.03], [0.045, 0.03], [0.038, -0.03], [0, -0.05], [-0.038, -0.03]], 0.016, 0.005), 0.15, 0.1), { p: [0, 1.38 - i * 0.05, 0.035], r: [0.1, 0, 0] }), 'spine01', { color: i % 2 ? pal.bone : pal.boneL }); // escamas de pecho
    });
    add('metal', X(G.wrapE(G.plate([[-0.16, 0.12], [0.16, 0.12], [0.18, 0.0], [0.12, -0.2], [-0.12, -0.2], [-0.18, 0.0]], 0.02, 0.007), 0.16, 0.12), { p: [0, 1.25, 0.04], r: [0, Math.PI, 0] }), 'spine01', { color: pal.steelD }); // espaldar
    add('gold', seam([V(-0.14, 1.36, -0.128), V(0, 1.38, -0.15), V(0.14, 1.36, -0.128)], 0.0045), 'spine01');
  }

  // ═════════════ NIVEL 2
  if (has('velocidad')) {
    const gl = new T.Color(glow).lerp(white, 0.35);
    ak.both(() => {
      const S0 = P('upperarm01'), E0 = P('lowerarm01'), W0 = P('wrist'), H = P('upperleg01'), K = P('lowerleg01'), A = P('foot');
      const tendon = (a, b, off, n = 9) => { const pts = []; for (let i = 0; i <= n; i++) { const u = i / n, p = a.clone().lerp(b, u); p.add(off).add(V(0.0, 0, Math.sin(u * Math.PI * 3) * 0.006)); pts.push(p); } return pts; };
      add('light', seam(tendon(S0.clone().add(V(0.03, 0.0, -0.06)), E0.clone().add(V(0.04, 0, -0.05)), V(0, 0, 0)), 0.0042), 'upperarm01', { color: gl });
      add('light', seam(tendon(E0.clone().add(V(0.04, 0, -0.05)), W0.clone().add(V(0.0, 0.03, -0.05)), V(0, 0, 0)), 0.0042), 'lowerarm01', { color: gl });
      add('light', seam(tendon(H.clone().add(V(0.04, 0, -0.1)), K.clone().add(V(0.045, 0, -0.09)), V(0, 0, 0)), 0.0046), 'upperleg01', { color: gl });
      add('light', seam(tendon(K.clone().add(V(0.045, 0, -0.09)), A.clone().add(V(0.02, 0.03, -0.075)), V(0, 0, 0)), 0.0046), 'lowerleg01', { color: gl });
      // cuchilla de pantorrilla (barrida hacia atrás) con filo de luz
      const bl = G.plate([[0, 0.16], [0.045, 0.08], [0.04, -0.06], [0.0, -0.2], [-0.02, -0.02], [-0.01, 0.1]], 0.01, 0.003);
      add('metal', limb(bl, K, A, 0.4, { r: [0, 0, 0.0], off: [0.0, 0, -0.085] }), 'lowerleg01', { color: pal.steel });
      add('light', limb(G.plate([[0.0, 0.16], [0.006, 0.12], [0.0, -0.2], [-0.004, -0.02]], 0.014, 0.002), K, A, 0.4, { off: [0.04, 0, -0.088] }), 'lowerleg01', { color: gl });
      add('metal', limb(G.plate([[0, 0.1], [0.03, 0.04], [0.02, -0.05], [0, -0.1]], 0.008, 0.002), K, A, 0.88, { off: [0.07, 0, -0.04], r: [0, 0.6, 0] }), 'foot', { color: pal.steel });
    });
    for (const s of [-1, 1]) { // toberas a la espalda baja
      add('metal', X(G.cone(0.038, 0.1, S(7, 5)), { p: [s * 0.09, 0.96, -0.12], r: [-Math.PI / 2 - 0.2, 0, 0] }), 'spine05', { color: pal.steelD });
      add('light', X(G.cone(0.024, 0.06, S(6, 4)), { p: [s * 0.09, 0.96, -0.2], r: [-Math.PI / 2 - 0.2, 0, 0] }), 'spine05', { color: gl });
      ak.halo('spine05', V(s * 0.09, 0.95, -0.2), glow, 0.2, 0.5);
    }
  }
  if (has('resonancia')) {
    const hub = V(0, 1.278, 0.06);
    const rings = [0.22, 0.28, 0.35].map((R, i) => {
      const b = ak.bone('res' + i, 'spine01', hub), c = new T.Color(glow).lerp(white, 0.25);
      add('gold', X(G.torus(R, 0.0055, 4, S(34, 16)), { p: [hub.x, hub.y, hub.z] }), 'res' + i);
      add('light', X(G.torus(R * 0.985, 0.0024, 3, S(34, 16)), { p: [hub.x, hub.y, hub.z] }), 'res' + i, { color: c });
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + i; add('light', X(t.box(0.012, 0.012, 0.03, 0.002, 1), { p: [hub.x + Math.cos(a) * R, hub.y, hub.z + Math.sin(a) * R], r: [0, -a, 0] }), 'res' + i, { color: c }); }
      return b;
    });
    ak.halo('spine01', V(0, 1.278, 0.22), glow, 0.7, 0.4);
    upd.push((dt, tt) => rings.forEach((b, i) => { b.rotation.set(0.5 + i * 0.35 + Math.sin(tt * 0.4 + i) * 0.2, tt * (0.55 + i * 0.3) * (i % 2 ? -1 : 1), (i - 1) * 0.5); }));
  }

  // ═════════════ NIVEL 3
  if (has('simbiosis')) {
    const FLESH = 0xb04a58, FLESH2 = 0xd8707a, VEIN = 0xff5a6a;
    ak.one('R', () => { // brazo derecho fundido en carne
      const S0 = P('upperarm01'), E0 = P('lowerarm01'), W0 = P('wrist'), R3 = t.rng(21);
      for (let i = 0; i < (low ? 4 : 7); i++) {
        const seg = i < 4, a = seg ? S0 : E0, b = seg ? E0 : W0, u = seg ? 0.12 + i * 0.25 : 0.12 + (i - 4) * 0.34;
        add('flesh', limb(bonelump(0.045 - i * 0.002, [1, 1.35, 1], i + 2, 0.3), a, b, u, { off: [(R3() - 0.5) * 0.05, 0, (R3() - 0.2) * 0.05] }), seg ? 'upperarm01' : 'lowerarm01', { color: i % 2 ? FLESH : FLESH2 });
      }
      for (let k = 0; k < (low ? 2 : 4); k++) add('ember', limb(G.tube([V(0.03 * k - 0.04, -0.12, 0.05), V(0.04 - 0.02 * k, -0.02, 0.07), V(0.03 * k - 0.05, 0.08, 0.05)], 0.0042, 0.0028, { radial: 4, tubular: 8 }), E0, W0, 0.5), 'lowerarm01', { color: VEIN });
      // ojo simbionte sobre el hombro con tentáculos que se mueven
      const eye = S0.clone().add(V(0.0, 0.2, 0.04));
      add('bone', G.sphere(0.04, S(12, 8), S(10, 7)).translate(eye.x, eye.y, eye.z), 'upperarm01', { color: 0xfff3e0 });
      add('light', G.sphere(0.02, 8, 6).translate(eye.x, eye.y + 0.002, eye.z + 0.032), 'upperarm01', { color: 0xffd060 });
      add('dark', G.sphere(0.009, 6, 5).translate(eye.x, eye.y + 0.002, eye.z + 0.047), 'upperarm01', { color: 0x050407 });
      add('flesh', G.torus(0.042, 0.011, 5, S(14, 8)).rotateX(Math.PI / 2).translate(eye.x, eye.y, eye.z + 0.004), 'upperarm01', { color: FLESH });
      for (let k = 0; k < 2; k++) {
        const base = S0.clone().add(V(0.04 - k * 0.07, 0.14, -0.06)), pts = [0, 1, 2, 3, 4].map((i) => base.clone().add(V((k ? -1 : 1) * i * 0.035, 0.04 * i - 0.01 * i * i, -0.05 * i)));
        const ch = ak.chain('tent' + k, 'upperarm01', pts, { stiff: 0.08, damp: 0.93, gravity: 3, sway: 2.0 });
        for (let i = 0; i < 4; i++) add('flesh', G.tube([pts[i], pts[i + 1]], 0.016 - i * 0.003, 0.012 - i * 0.003, { radial: S(5, 4), tubular: 3 }), ch.bones[i].name, { color: i % 2 ? FLESH : FLESH2 });
      }
    });
  }
  if (has('artilleria')) {
    const cc = new T.Color(glow);
    ak.both(() => {
      const S0 = P('upperarm01'), C0 = S0.clone().add(V(0.0, 0.2, 0.0));
      add('metal', X(G.cyl(0.05, 0.058, 0.2, S(10, 7)), { p: [C0.x, C0.y, C0.z + 0.02], r: [Math.PI / 2, 0, 0] }), 'clavicle', { color: pal.steelD });
      add('crystal', X(G.cyl(0.036, 0.04, 0.24, S(10, 7)), { p: [C0.x, C0.y, C0.z + 0.17], r: [Math.PI / 2, 0, 0] }), 'clavicle', { color: cc });
      for (let i = 0; i < 3; i++) add('gold', X(G.torus(0.045, 0.006, 4, S(14, 8)), { p: [C0.x, C0.y, C0.z + 0.1 + i * 0.07], r: [Math.PI / 2, 0, 0] }), 'clavicle');
      add('light', X(G.sphere(0.026, 8, 6), { p: [C0.x, C0.y, C0.z + 0.3] }), 'clavicle', { color: cc.clone().lerp(white, 0.5) });
      ak.halo('clavicle', V(C0.x, C0.y, C0.z + 0.31), glow, 0.2, 0.5);
      add('metal', X(t.box(0.07, 0.07, 0.14, 0.016, 1), { p: [C0.x, C0.y - 0.045, C0.z - 0.05] }), 'clavicle', { color: pal.steel });
    });
    for (let i = 0; i < 5; i++) add('crystal', spikeAt(V((i - 2) * 0.05, 1.3 - Math.abs(i - 2) * 0.03, -0.12), V((i - 2) * 0.35, 1, -0.6), 0.2 - Math.abs(i - 2) * 0.03, 0.022, 0.0, Zv, { radial: 5, tubular: 3 }), 'spine01', { color: cc });
  }

  // ═════════════ NIVEL 4
  if (has('apoteosis')) {
    const c0 = new T.Color(glow).lerp(white, 0.4), c1 = new T.Color(glow);
    const wings = [-1, 1].map((s) => {
      const hub = V(s * 0.07, 1.34, -0.12), b = ak.bone(s < 0 ? 'wingR' : 'wingL', 'spine01', hub), arm = (u) => V(s * (0.04 + 0.52 * u), 0.03 + 0.4 * Math.sin(u * Math.PI * 0.62), -0.04 - 0.1 * u);
      for (let layer = 0; layer < (low ? 1 : 2); layer++) {
        const n = layer ? 8 : (low ? 6 : 10);
        for (let i = 0; i < n; i++) {
          const u = 0.1 + 0.9 * (i / (n - 1)), a = arm(u), alpha = -1.15 + u * 1.55, len = (layer ? 0.4 : 0.62) * (0.7 + 0.6 * Math.sin(Math.min(1, u * 1.1 + 0.15) * Math.PI * 0.8)) * (u > 0.9 ? 0.8 : 1);
          const dir = V(s * Math.cos(alpha), Math.sin(alpha), -0.22 - layer * 0.08).normalize(), at = V(hub.x + a.x, hub.y + a.y, hub.z + a.z - layer * 0.012);
          const g = t.blade(len, 0.1 - layer * 0.025, 0.004, { tipLean: s * 0.18, curve: -0.05 }); X(g, { q: t.basisQ(dir, V(0, 0, 1)), p: [at.x, at.y, at.z] });
          add('spirit', g, b.name, { color: (x, y, z) => { const u = Math.min(1, Math.hypot(x - at.x, y - at.y, z - at.z) / len); return c1.clone().multiplyScalar(0.42).lerp(c0.clone().multiplyScalar(0.9), Math.pow(u, 0.8)); } });
          if (!layer) { const g2 = t.blade(len * 0.96, 0.008, 0.008); X(g2, { q: t.basisQ(dir, V(0, 0, 1)), p: [at.x, at.y, at.z] }); add('light', g2, b.name, { color: c0 }); }
        }
      }
      add('light', G.tube([0, 0.25, 0.5, 0.75, 1].map((u) => { const a = arm(u); return V(hub.x + a.x, hub.y + a.y, hub.z + a.z); }), 0.009, 0.005, { radial: 4, tubular: 10 }), b.name, { color: c0 });
      return b;
    });
    add('gold', X(G.torus(0.2, 0.0055, 4, S(30, 14)), { p: [0, 1.7, -0.13], r: [Math.PI / 2 - 0.15, 0, 0] }), 'head');
    add('light', X(G.torus(0.2, 0.0028, 3, S(30, 14)).scale(1, 1, 1), { p: [0, 1.7, -0.13], r: [Math.PI / 2 - 0.15, 0, 0] }), 'head', { color: c0 });
    for (let i = 0; i < (low ? 5 : 9); i++) { const a = (i / (low ? 5 : 9)) * Math.PI * 2; add('light', G.cone(0.007, 0.03 + (i % 3) * 0.012, 4).rotateZ(-a).translate(Math.sin(a) * 0.222, 1.7 + Math.cos(a) * 0.222 * 0.96, -0.115 - Math.cos(a) * 0.03), 'head', { color: c0 }); }
    ak.halo('head', V(0, 1.7, -0.14), glow, 0.9, 0.22);
    upd.push((dt, tt, c) => { const sp = Math.min(1, (c && c.speed ? c.speed : 0) / 8); wings.forEach((b, k) => { const s = k ? 1 : -1; b.rotation.set(0.1 * Math.sin(tt * 1.2), s * (0.18 + 0.12 * Math.sin(tt * 1.7 + k) + sp * 0.35), s * 0.08 * Math.sin(tt * 1.7)); }); });
  }
  if (has('anomalia')) {
    const hub = V(0, 1.25, 0.0), orb = ak.bone('ano', 'spine01', hub), rr = t.rng(33);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, R = 0.42 + (i % 3) * 0.08, y = (rr() - 0.5) * 0.5, len = 0.1 + rr() * 0.08;
      const sh = X(new T.OctahedronGeometry(1, 0), { s: [0.022, len, 0.022] }); X(sh, { p: [hub.x + Math.cos(a) * R, hub.y + y, hub.z + Math.sin(a) * R], r: [rr() * 0.6, a, rr() * 0.6] });
      add('dark', sh, 'ano', { color: 0x120a1c }); add('light', X(new T.OctahedronGeometry(1, 0), { s: [0.007, len * 1.02, 0.007], p: [hub.x + Math.cos(a) * R, hub.y + y, hub.z + Math.sin(a) * R], r: [0, a, 0] }), 'ano', { color: VIOLET });
    }
    for (const [a, b, s] of [[V(-0.1, 1.38, 0.17), V(0.02, 1.2, 0.18), 3], [V(0.1, 1.42, 0.16), V(0.14, 1.26, 0.15), 4], [V(-0.15, 1.1, 0.15), V(-0.02, 1.0, 0.16), 5]]) add('light', t.crackLine(a, b, { n: 7, jag: 0.014, r: 0.0034, seed: s }), 'spine01', { color: VIOLET });
    add('light', t.crackLine(V(0.03, HC.y + 0.1, HC.z + 0.12), V(0.07, HC.y - 0.02, HC.z + 0.145), { n: 6, jag: 0.008, r: 0.0028, seed: 8 }), 'head', { color: VIOLET });
    ak.halo('spine01', V(0, 1.25, 0.1), VIOLET, 0.8, 0.14);
    upd.push((dt, tt) => { orb.rotation.y = tt * 0.7; orb.rotation.x = Math.sin(tt * 0.5) * 0.15; });
  }
  return { update: (dt, tt, c) => upd.forEach((f) => f(dt, tt, c)) };
}

/** ASPECTO REGIONAL por mapa (REGION de host-human.js): un adorno del folclore del lugar en el color de acento del mapa.
 *  m1 astros (estrellas que orbitan la cabeza) · m2 geoda (cristales en los hombros) · m3 runas (anillo que gira en la cintura) · m4 flores (ojos-flor en hombros y brazos) · m5/m6 velos (ectoplasma que cuelga de los brazos). */
export function addRegion(ak, ctx, o = {}) {
  const region = ctx.region; if (!region || !region.orn) return { update() {} };
  const t = o.t || tools(ak), { G, X, spikeAt, limb, S, low } = t, P = (n) => ak.P(n), add = ak.add, upd = [], acc = region.accent, rr = t.rng(77), Y = V(0, 1, 0);
  const col = new T.Color(acc);
  if (region.orn === 'astros') {
    const hub = V(0, 1.72, 0.06), b = ak.bone('astros', 'head', hub);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add('light', X(new T.OctahedronGeometry(0.022, 0), { p: [hub.x + Math.cos(a) * 0.2, hub.y + Math.sin(i * 1.7) * 0.03, hub.z + Math.sin(a) * 0.2], s: [0.7, 1.3, 0.7] }), 'astros', { color: col }); }
    add('light', X(G.torus(0.2, 0.0016, 3, S(30, 14)), { p: [hub.x, hub.y, hub.z] }), 'astros', { color: col.clone().multiplyScalar(0.5) });
    upd.push((dt, tt) => { b.rotation.y = tt * 0.8; });
  } else if (region.orn === 'geoda') {
    ak.both(() => { const S0 = P('upperarm01'); for (let i = 0; i < 3; i++) add('crystal', spikeAt(V(S0.x + 0.04 + i * 0.03, S0.y + 0.11, S0.z - 0.05 + i * 0.05), V(0.3 + i * 0.3, 1, -0.3 + i * 0.3), 0.14 + i * 0.03, 0.022, 0, Y, { radial: S(5, 4), tubular: 3 }), 'upperarm01', { color: col }); });
  } else if (region.orn === 'runas') {
    const hub = V(0, 0.98, 0.045), b = ak.bone('runas', 'spine04', hub);
    add('light', X(G.torus(0.34, 0.0045, 3, 6), { p: [hub.x, hub.y, hub.z] }), 'runas', { color: col }); add('gold', X(G.torus(0.37, 0.003, 3, 3), { p: [hub.x, hub.y, hub.z] }), 'runas');
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add('light', X(t.box(0.02, 0.02, 0.02, 0.003, 1), { p: [hub.x + Math.cos(a) * 0.34, hub.y, hub.z + Math.sin(a) * 0.34], r: [0.6, a, 0.6] }), 'runas', { color: col }); }
    upd.push((dt, tt) => { b.rotation.y = tt * 0.5; });
  } else if (region.orn === 'flores') {
    ak.both(() => { const S0 = P('upperarm01'), E0 = P('lowerarm01'); for (let i = 0; i < 2; i++) { const p = S0.clone().lerp(E0, 0.25 + i * 0.5).add(V(0.0, 0.0, 0.07)); add('flesh', G.sphere(0.03, S(10, 7), S(8, 6)).translate(p.x, p.y, p.z), 'upperarm01', { color: 0xc8607a }); add('light', G.sphere(0.016, 7, 5).translate(p.x, p.y, p.z + 0.026), 'upperarm01', { color: col }); } });
  } else if (region.orn === 'velos') {
    ak.both(() => { const E0 = P('lowerarm01'), W0 = P('wrist');
      for (let k = 0; k < 2; k++) { const base = E0.clone().lerp(W0, 0.4 + k * 0.2).add(V(-0.05, 0, -0.04)), pts = [0, 1, 2, 3, 4].map((i) => base.clone().add(V(-0.012 * i, -0.09 * i, -0.02 * i)));
        const ch = ak.chain('velo' + k, 'lowerarm01', pts, { stiff: 0.03, damp: 0.94, gravity: 2.5, sway: 1.6 });
        for (let i = 0; i < 4; i++) add('spirit', G.tube([pts[i], pts[i + 1]], 0.05 - i * 0.008, 0.044 - i * 0.008, { radial: 4, tubular: 2, sx: 1, sz: 0.06 }), ch.bones[i].name, { color: col.clone().multiplyScalar(0.8) }); } });
  }
  void rr; void low; void limb;
  return { update: (dt, tt, c) => upd.forEach((f) => f(dt, tt, c)) };
}
