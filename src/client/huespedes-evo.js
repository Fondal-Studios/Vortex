// EVOLUCIÓN VISUAL de los Huéspedes: envuelve buildHost (huespedes-view.js) y le suma, según el nivel de evolución (0–4), mutaciones
// visibles y distintas por Huésped + el arma cuerpo a cuerpo equipada FUSIONADA en la mano (melee-models.js).
//   import { buildHostEvo } from './huespedes-evo.js';
//   const h = buildHostEvo(THREE, 'seraf', { evo: 2, melee: 'pica_cristal', quality: 'low' });
//   // → { group, update(dt,t), pose(name), dispose(), setEvo(n), setMelee(id), evo, tierName, info:{draws,tris} }  (misma API que buildHost)
//   scene.add(h.group); en cada cuadro h.update(dt, t); al evolucionar en la partida h.setEvo(nuevo) (reconstruye en ~5 ms).
// Niveles (nombres = EVO_TIERS de data.js): 0 Larva · 1 Despertar · 2 Fusión · 3 Mutación · 4 Forma final. Cada uno AGREGA piezas (nunca quita):
//   Axioma: hombreras → placas y cresta → alas de cuchillas → halo y alas mayores · Vesper: cuernos y púas → abanico de cola → alas membranosas → alas enormes
//   Micelio: más hongos → sombreros grandes y filamentos → corona y raíces → dosel gigante y esporas · Umbra: tercera órbita → corona y hojas → alas de sombra → anillo dimensional
//   Seraf: 2.º halo y plumas → plumas de ala → alas más grandes y 2.º par → seis alas y rayos de luz.
// Además, cada nivel crece un poco el cuerpo (+2 % por nivel), a partir del 3 hay una jaula de aura y a partir del 4 un sello brillante en el suelo.
// Presupuesto: el Huésped base (≤ 40 llamadas) + ≤ 12 de mutación + ≤ 9 del arma. Medido en Baja con renderer.info (tests/melee-ui.test.js).
import { buildHost, makeBuilder, HOST_COLORS } from './huespedes-view.js';
import { attachToViewmodel } from './melee-models.js';
import { EVO_TIERS, MELEE_WEAPONS } from '../sim/data.js';

const mixc = (a, b, u) => { const A = [(a >> 16) & 255, (a >> 8) & 255, a & 255], C = [(b >> 16) & 255, (b >> 8) & 255, b & 255]; return (Math.round(A[0] + (C[0] - A[0]) * u) << 16) | (Math.round(A[1] + (C[1] - A[1]) * u) << 8) | Math.round(A[2] + (C[2] - A[2]) * u); };
const TAU = Math.PI * 2;
/** Dónde agarra el arma cada Huésped (marco del antebrazo derecho) y cuánto se escala. */
const HAND = { axioma: [0, -0.36, 0.05], vesper: [0, -0.64, 0.04], micelio: [0, -0.74, 0.12], umbra: [0, -0.4, 0.05], seraf: [0, -0.37, 0.03] };
const HSCALE = { axioma: 1, vesper: 1, micelio: 1.35, umbra: 1.1, seraf: 1 };
const TSCALE = { lanza: 0.62, martillo: 1, hacha: 1, espada: 1, daga: 1.1 };

/* Cada mutación recibe: P (constructor), J (articulaciones del Huésped base), n (nivel 0–4), c (color del Huésped) y `at(nombre, padre, pos)` para crear articulaciones nuevas.
   Devuelve una función anim(t, k) opcional con el movimiento propio de las piezas nuevas. */
const MUT = {
  axioma(P, J, n, c, at) {
    const NEG = 0x15171f, ARM = 0x2c3140, BONE = 0x4a5670, LN2 = 0xbfe6ff;
    if (n >= 1) for (const s of [-1, 1]) { // hombreras con filo luminoso
      const a = at('xA' + s, s > 0 ? J.armR : J.armL, [0, 0.1, 0]);
      P.box(a, 'body', ARM, [0.34, 0.07, 0.3], [0.05 * s, 0.1, 0], [0, 0, -0.28 * s]); P.box(a, 'body', BONE, [0.2, 0.05, 0.22], [0.0 * s, 0.17, 0], [0, 0, -0.18 * s]); P.box(a, 'glow', c, [0.3, 0.012, 0.012], [0.05 * s, 0.14, 0.15], [0, 0, -0.28 * s]);
      P.cone(a, 'body', NEG, 0.05, 0.22, [0.2 * s, 0.2, 0], [0, 0, -1.0 * s], 4);
    }
    const tx = at('xT', J.torso, [0, 0, 0]), hx = at('xH', J.head, [0, 0, 0]);
    if (n >= 1) { for (let i = 0; i < 3; i++) P.box(tx, 'glow', c, [0.2 - i * 0.03, 0.02, 0.02], [0, 0.0 + i * 0.1, -0.26], [0.2, 0, 0]); }
    if (n >= 2) { // placa pectoral, cresta de cráneo, placas en antebrazos
      P.box(tx, 'body', ARM, [0.54, 0.2, 0.1], [0, 0.46, 0.24], [0.15, 0, 0]); P.box(tx, 'glow', c, [0.46, 0.014, 0.014], [0, 0.55, 0.285], [0.15, 0, 0]); P.oct(tx, 'glow', LN2, 0.04, [0, 0.46, 0.3], [1, 1.5, 0.6]);
      P.blade(hx, 'body', NEG, [0, 0.22, -0.04], [0, 0.52, -0.38], 0.05, 0.03); P.blade(hx, 'glow', c, [0, 0.24, -0.06], [0, 0.5, -0.36], 0.012, 0.04);
      for (const s of [-1, 1]) { const f = at('xF' + s, s > 0 ? J.foreR : J.foreL, [0, 0, 0]); P.box(f, 'body', ARM, [0.2, 0.22, 0.22], [0, -0.17, 0.0]); P.box(f, 'glow', c, [0.012, 0.18, 0.012], [0.1 * s, -0.17, 0.08]); }
    }
    if (n >= 3) for (const s of [-1, 1]) { // alas de cuchillas en la espalda
      const w = at('xW' + s, J.torso, [0.12 * s, 0.6, -0.2]); w.rest = [0, 0.3 * s, 0.1 * s];
      for (let i = 0; i < 3; i++) { P.blade(w, 'body', NEG, [0, 0, 0], [(0.45 + i * 0.22) * s, 0.35 - i * 0.28, -0.3 - i * 0.05], 0.1, 0.03); P.blade(w, 'glow', c, [0.03 * s, 0, 0], [(0.43 + i * 0.22) * s, 0.35 - i * 0.28, -0.3 - i * 0.05], 0.016, 0.05); }
    }
    if (n >= 4) { // halo detrás de la cabeza + alas mayores + filo en rodillas
      const h2 = at('xHalo', J.head, [0, 0.1, -0.2]); P.tor(h2, 'glow', c, 0.42, 0.014, [0, 0.08, 0], [0, 0, 0], 14); P.tor(h2, 'glow', LN2, 0.34, 0.008, [0, 0.08, 0.0], [0, 0, 0], 12);
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; P.cone(h2, 'glow', c, 0.02, 0.14, [Math.cos(a) * 0.48, 0.08 + Math.sin(a) * 0.48, 0], [0, 0, a - Math.PI / 2], 4); }
      for (const s of [-1, 1]) { const w = at('xW2' + s, J.torso, [0.12 * s, 0.5, -0.22]); w.rest = [0, 0.4 * s, 0.35 * s]; for (let i = 0; i < 2; i++) P.blade(w, 'body', ARM, [0, 0, 0], [(0.9 + i * 0.3) * s, 0.8 - i * 0.6, -0.45], 0.14, 0.03); P.blade(w, 'glow', LN2, [0.04 * s, 0.01, 0], [0.88 * s, 0.78, -0.45], 0.02, 0.05); }
    }
    return (t) => { const s = Math.sin(t * 1.6) * 0.05; for (const sd of [-1, 1]) { for (const nm of ['xW', 'xW2']) { const w = P.joints[nm + sd]; if (w) w.g.rotation.z = w.rest[2] + s * sd; } } };
  },
  vesper(P, J, n, c, at) {
    const SK = 0x2a1a38, SK2 = 0x472a62, NV2 = 0xe2b8ff, CL = 0xe6dcf2;
    const tx = at('xT', J.torso, [0, 0, 0]), hx = at('xH', J.head, [0, 0, 0]);
    if (n >= 1) { // cuernos y púas de codo
      for (const s of [-1, 1]) { P.cone(hx, 'body', CL, 0.035, 0.3, [0.07 * s, 0.1, -0.08], [-0.9, 0, -0.5 * s], 4); const f = at('xE' + s, s > 0 ? J.foreR : J.foreL, [0, 0, 0]); P.cone(f, 'body', CL, 0.025, 0.2, [0, 0.0, -0.06], [-1.3, 0, 0], 4); P.cone(f, 'body', CL, 0.02, 0.14, [0.04 * s, -0.12, -0.05], [-1.4, 0, 0], 4); }
      for (let i = 0; i < 4; i++) P.cone(tx, 'body', CL, 0.03, 0.26, [0, 0.56 - i * 0.1, -0.14], [-1.15, 0, 0], 4);
      P.sph(hx, 'glow', NV2, 0.016, [0.0, 0.04, 0.24], [1, 1, 1], 4);
    }
    if (n >= 2) { // abanico de cola + venas luminosas en los brazos
      const t2 = at('xTail', J.tail2, [0, -0.1, -0.35]);
      for (let i = 0; i < 4; i++) { const a = (i - 1.5) * 0.4; P.blade(t2, 'body', i % 2 ? SK2 : CL, [0, 0, 0], [Math.sin(a) * 0.55, 0.1 + Math.cos(a) * 0.05, -0.55 + Math.abs(a) * 0.1], 0.1, 0.025); P.blade(t2, 'glow', c, [0, 0, 0], [Math.sin(a) * 0.52, 0.1, -0.53], 0.012, 0.03); }
      for (const s of [-1, 1]) { const a = at('xA' + s, s > 0 ? J.armR : J.armL, [0, 0, 0]); P.limb(a, 'glow', NV2, [0.045 * s, -0.04, 0.03], [0.03 * s, -0.5, 0.03], 0.008, 0.008, 3); }
    }
    if (n >= 3) for (const s of [-1, 1]) { // alas membranosas
      const w = at('xW' + s, J.torso, [0.1 * s, 0.5, -0.12]); w.rest = [0.1, 0.4 * s, 0.5 * s];
      const tp = [[0.9, 0.55, -0.2], [1.25, 0.1, -0.25], [0.95, -0.4, -0.2]].map(([x, y, z]) => [x * s, y, z]);
      tp.forEach((t) => { P.limb(w, 'body', SK2, [0, 0, 0], t, 0.028, 0.008, 4); P.limb(w, 'glow', c, [0, 0, 0.01], t, 0.006, 0.003, 3); });
      P.tri(w, 'mem', mixc(SK2, c, 0.35), [0, 0, 0], tp[0], tp[1]); P.tri(w, 'mem', mixc(SK2, c, 0.35), [0, 0, 0], tp[1], tp[2]); P.tri(w, 'mem', mixc(SK2, c, 0.35), [0, 0, 0], tp[2], [0, -0.3, 0]);
    }
    if (n >= 4) { // cresta, ojos extra y alas enormes (escala en anim)
      for (let i = 0; i < 4; i++) P.sph(hx, 'glow', NV2, 0.014, [(i % 2 ? 1 : -1) * (0.03 + (i >> 1) * 0.03), 0.07 + (i >> 1) * 0.04, 0.2], [1, 0.7, 1], 3);
      for (let i = 0; i < 5; i++) P.cone(hx, 'body', CL, 0.025, 0.2 + i * 0.03, [0, 0.1 + i * 0.01, -0.1 - i * 0.07], [-1.5 + i * 0.08, 0, 0], 4);
      const t2 = at('xHalo', J.torso, [0, 0.4, -0.3]); P.tor(t2, 'glow', c, 0.55, 0.01, [0, 0.3, 0], [0, 0, 0], 12);
    }
    return (t) => { for (const s of [-1, 1]) { const w = P.joints['xW' + s]; if (w) { w.g.rotation.z = w.rest[2] + Math.sin(t * 1.4 + s) * 0.12 * s; w.g.rotation.y = w.rest[1]; w.g.scale.setScalar(n >= 4 ? 1.35 : 1); } } };
  },
  micelio(P, J, n, c, at) {
    const CAP = [0xc9732a, 0x7be03a, 0xe8c25a, 0xa8421e], SP = 0xc6ff7a, ST = 0xd8cdb0, MOSS = 0x3f6a2a;
    const tx = at('xT', J.torso, [0, 0, 0]), hx = at('xH', J.head, [0, 0, 0]);
    const cap = (j, x, y, z, r, i) => { P.cyl(j, 'body', ST, r * 0.2, r * 0.28, r * 1.4, [x, y + r * 0.5, z], [0.2, 0, 0], 5); P.sph(j, 'body', CAP[i % 4], r, [x, y + r * 1.2, z], [1, 0.5, 1], 6); P.sph(j, 'glow', SP, r * 0.12, [x + r * 0.3, y + r * 1.5, z + 0.04], [1, 1, 1], 3); P.tor(j, 'glow', mixc(CAP[i % 4], 0xffffff, 0.3), r * 0.5, r * 0.04, [x, y + r * 1.25, z], [Math.PI / 2, 0, 0], 6); };
    if (n >= 1) { for (const s of [-1, 1]) { const a = at('xA' + s, s > 0 ? J.armR : J.armL, [0, 0.12, 0]); cap(a, 0.06 * s, 0.1, 0, 0.14 + 0.02 * n, s > 0 ? 1 : 3); P.sph(a, 'body', MOSS, 0.12, [0.1 * s, 0.05, 0], [1.2, 0.7, 1.1], 5); } cap(tx, -0.25, 0.9, -0.4, 0.14, 2); cap(tx, 0.3, 0.7, -0.5, 0.11, 0); }
    if (n >= 2) { // filamentos de micelio que cuelgan + esporas
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8, x = Math.cos(a) * 0.5, z = Math.sin(a) * 0.4; P.limb(tx, 'glow', c, [x * 0.8, 0.4, z * 0.8], [x * 1.15, -0.35 - (i % 3) * 0.12, z * 1.15], 0.012, 0.004, 3); P.sph(tx, 'glow', SP, 0.02, [x * 1.15, -0.35 - (i % 3) * 0.12, z * 1.15], [1, 1, 1], 3); }
      for (const s of [-1, 1]) cap(tx, 0.55 * s, 0.5, 0.2, 0.2, s > 0 ? 0 : 1);
    }
    if (n >= 3) { // corona de sombrero + raíces luminosas en el suelo
      P.sph(hx, 'body', CAP[1], 0.4, [0, 0.28, -0.02], [1, 0.35, 1], 8); P.sph(hx, 'body', CAP[0], 0.34, [0, 0.38, -0.02], [1, 0.4, 1], 7); for (let i = 0; i < 6; i++) { const a = i * 1.1; P.sph(hx, 'glow', SP, 0.04, [Math.cos(a) * 0.2, 0.46, Math.sin(a) * 0.2], [1, 0.6, 1], 4); }
      const r0 = at('xR', J.root, [0, 0, 0]); for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + 0.3; P.limb(r0, 'glow', c, [Math.cos(a) * 0.5, 0.03, Math.sin(a) * 0.5], [Math.cos(a) * 1.3, 0.02, Math.sin(a) * 1.3], 0.016, 0.004, 3); P.limb(r0, 'glow', SP, [Math.cos(a) * 1.3, 0.02, Math.sin(a) * 1.3], [Math.cos(a + 0.3) * 1.55, 0.02, Math.sin(a + 0.3) * 1.55], 0.008, 0.002, 3); }
    }
    if (n >= 4) { // dosel gigante con branquias luminosas + nube de esporas
      const cn = at('xCan', J.torso, [0, 0.95, -0.35]);
      P.sph(cn, 'body', CAP[3], 0.85, [0, 0.4, 0], [1, 0.3, 1], 9); P.sph(cn, 'body', CAP[0], 0.78, [0, 0.52, 0], [1, 0.3, 1], 8);
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; P.limb(cn, 'glow', mixc(c, 0xffffff, 0.3), [Math.cos(a) * 0.1, 0.3, Math.sin(a) * 0.1], [Math.cos(a) * 0.72, 0.28, Math.sin(a) * 0.72], 0.008, 0.008, 3); }
      for (let i = 0; i < 6; i++) { const a = i * 1.05; P.sph(cn, 'glow', SP, 0.05, [Math.cos(a) * 0.45, 0.62, Math.sin(a) * 0.45], [1, 0.5, 1], 4); }
      const sp = at('xSpore', J.root, [0, 1.6, 0]); for (let i = 0; i < 9; i++) { const a = i * 2.2, r = 0.8 + (i % 3) * 0.25; P.sph(sp, 'mem', SP, 0.05 + (i % 3) * 0.02, [Math.cos(a) * r, (i % 5) * 0.28 - 0.6, Math.sin(a) * r], [1, 1, 1], 4); }
    }
    return (t) => { const sp = P.joints.xSpore; if (sp) { sp.g.rotation.y = t * 0.35; sp.g.position.y = 1.6 + Math.sin(t * 0.9) * 0.08; } const cn = P.joints.xCan; if (cn) cn.g.scale.setScalar(1 + Math.sin(t * 1.2) * 0.02); };
  },
  umbra(P, J, n, c, at) {
    const VOID = 0x1d1230, VOID2 = 0x3b2468, GH = 0x40ffc0, LIL = 0x7a58b8;
    if (n >= 1) { // 3.ª órbita de fragmentos
      const fc = at('xFC', J.root, [0, 0.9, 0]);
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5, p = [Math.cos(a) * 1.35, -0.3 + (i % 3) * 0.3, Math.sin(a) * 1.35], rot = [a, a * 0.7, 0.3 * i]; if (i % 2) P.oct(fc, 'body', VOID2, 0.1, p, [1, 1.8, 1], rot); else P.box(fc, 'body', LIL, [0.1, 0.18, 0.06], p, rot); P.oct(fc, 'glow', GH, 0.03, p, [1, 1.5, 1], rot); }
      P.tor(fc, 'glow', c, 1.35, 0.007, [0, 0, 0], [Math.PI / 2 + 0.1, 0, 0.1], 14);
    }
    const hx = at('xH', J.head, [0, 0, 0]), tx = at('xT', J.torso, [0, 0, 0]);
    if (n >= 2) { // corona dimensional + hojas flotantes detrás
      P.tor(hx, 'glow', GH, 0.3, 0.01, [0, 0.24, -0.04], [Math.PI / 2 - 0.5, 0, 0.2], 10); P.tor(hx, 'glow', c, 0.38, 0.008, [0, 0.2, -0.04], [Math.PI / 2 + 0.4, 0, -0.3], 10);
      for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4; P.blade(hx, 'body', VOID2, [Math.sin(a) * 0.12, 0.26, -0.06], [Math.sin(a) * 0.35, 0.58 + Math.cos(a) * 0.1, -0.16], 0.07, 0.02); P.blade(hx, 'glow', GH, [Math.sin(a) * 0.12, 0.26, -0.06], [Math.sin(a) * 0.34, 0.56 + Math.cos(a) * 0.1, -0.16], 0.012, 0.03); }
      for (const s of [-1, 1]) { P.blade(tx, 'body', VOID, [0.2 * s, 0.3, -0.18], [0.7 * s, 0.9, -0.5], 0.11, 0.025); P.blade(tx, 'glow', c, [0.22 * s, 0.32, -0.19], [0.68 * s, 0.88, -0.49], 0.014, 0.035); }
    }
    if (n >= 3) for (const s of [-1, 1]) { // alas de sombra: tres cuchillas largas
      const w = at('xW' + s, J.torso, [0.12 * s, 0.45, -0.2]); w.rest = [0, 0.3 * s, 0.2 * s];
      for (let i = 0; i < 4; i++) { const e = [(0.7 + i * 0.28) * s, 0.9 - i * 0.5, -0.4 - i * 0.04]; P.blade(w, 'body', VOID, [0, 0, 0], e, 0.13 - i * 0.012, 0.025); P.blade(w, 'glow', i % 2 ? GH : c, [0.02 * s, 0, 0.01], [e[0] * 0.96, e[1] * 0.96, e[2]], 0.014, 0.035); }
    }
    if (n >= 4) { // anillo dimensional enorme + más fragmentos
      const rg = at('xRing', J.root, [0, 1.25, 0]); P.tor(rg, 'glow', c, 1.0, 0.012, [0, 0, 0], [0, 0, 0], 20); P.tor(rg, 'glow', GH, 0.9, 0.006, [0, 0, 0], [0.2, 0, 0], 16);
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; P.oct(rg, 'body', VOID2, 0.06, [Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0], [1, 1.8, 1], [0, 0, a]); P.oct(rg, 'glow', GH, 0.02, [Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0], [1, 1.8, 1], [0, 0, a]); }
    }
    return (t) => { const fc = P.joints.xFC; if (fc) { fc.g.rotation.y = t * 0.7; fc.g.position.y = 0.9 + Math.sin(t * 0.8) * 0.1; } const rg = P.joints.xRing; if (rg) { rg.g.rotation.z = t * 0.3; rg.g.rotation.y = Math.sin(t * 0.4) * 0.5; }
      for (const s of [-1, 1]) { const w = P.joints['xW' + s]; if (w) w.g.rotation.z = w.rest[2] + Math.sin(t * 1.3 + s) * 0.08 * s; } };
  },
  seraf(P, J, n, c, at) {
    const IV = 0xe9dcc2, IV2 = 0xbba57d, GD2 = 0xfff0b0, MEM = 0xffe08a, DK = 0x2b2112;
    const hx = at('xH', J.head, [0, 0, 0]), tx = at('xT', J.torso, [0, 0, 0]);
    if (n >= 1) { // 2.º halo, filamentos más largos, brazaletes
      P.tor(hx, 'glow', GD2, 0.4, 0.008, [0, 0.2, -0.16], [0, 0, 0], 14); for (let i = 0; i < 9; i++) { const a = -1.6 + i * 0.4; P.limb(hx, 'glow', c, [Math.sin(a) * 0.1, 0.24, -0.06], [Math.sin(a) * 0.3, 0.64 + Math.cos(a) * 0.12, -0.16], 0.007, 0.002, 3); }
      for (const s of [-1, 1]) { const f = at('xF' + s, s > 0 ? J.foreR : J.foreL, [0, 0, 0]); P.tor(f, 'body', IV2, 0.05, 0.016, [0, -0.2, 0.0], [Math.PI / 2, 0, 0], 6); P.tor(f, 'glow', c, 0.052, 0.006, [0, -0.2, 0], [Math.PI / 2, 0, 0], 6); }
    }
    if (n >= 2) for (const s of [-1, 1]) { // plumas de cuchilla en el borde de cada ala
      const w = at('xP' + s, s > 0 ? J.wingR : J.wingL, [0, 0, 0]);
      for (let i = 0; i < 5; i++) { const u = i / 4; P.blade(w, 'body', i % 2 ? IV2 : IV, [(0.55 + u * 0.4) * s, 0.7 - u * 1.0, -0.36], [(0.8 + u * 0.55) * s, 0.9 - u * 1.4, -0.45], 0.1, 0.02); P.limb(w, 'glow', c, [(0.62 + u * 0.4) * s, 0.7 - u * 1.0, -0.37], [(0.82 + u * 0.55) * s, 0.9 - u * 1.4, -0.46], 0.006, 0.003, 3); }
      P.sph(tx, 'glow', c, 0.05, [0, 0.36, 0.16], [1, 1, 0.5], 4);
    }
    if (n >= 3) for (const s of [-1, 1]) { // 2.º par de alas (más bajas) y falda brillante
      const w = at('xW' + s, J.torso, [0.08 * s, 0.35, -0.14]); w.rest = [0.2, 0.5 * s, -0.3 * s];
      const tp = [[0.7, 0.25, -0.2], [0.85, -0.3, -0.2], [0.5, -0.7, -0.15]].map(([x, y, z]) => [x * s, y, z]);
      tp.forEach((t) => { P.limb(w, 'body', IV2, [0, 0, 0], t, 0.022, 0.005, 4); P.limb(w, 'glow', c, [0, 0, 0.01], t, 0.005, 0.003, 3); });
      P.tri(w, 'mem', MEM, [0, 0, 0], tp[0], tp[1]); P.tri(w, 'mem', MEM, [0, 0, 0], tp[1], tp[2]);
    }
    if (n >= 4) { // 3.er par de alas + rayos de luz + 3.er halo
      for (const s of [-1, 1]) { const w = at('xW3' + s, J.torso, [0.06 * s, 0.6, -0.16]); w.rest = [-0.3, 0.7 * s, 0.7 * s]; const tp = [[0.55, 0.5, -0.1], [0.8, 0.0, -0.1], [0.5, -0.4, -0.1]].map(([x, y, z]) => [x * s, y, z]); tp.forEach((t) => { P.limb(w, 'body', IV, [0, 0, 0], t, 0.02, 0.005, 4); P.limb(w, 'glow', GD2, [0, 0, 0.01], t, 0.005, 0.003, 3); }); P.tri(w, 'mem', MEM, [0, 0, 0], tp[0], tp[1]); P.tri(w, 'mem', MEM, [0, 0, 0], tp[1], tp[2]); }
      const rays = at('xRay', J.torso, [0, 0.6, -0.4]); for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; P.blade(rays, 'mem', mixc(MEM, c, 0.3), [Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0], [Math.cos(a) * (1.1 + (i % 2) * 0.35), Math.sin(a) * (1.1 + (i % 2) * 0.35), -0.05], 0.08, 0.01); }
      P.tor(hx, 'glow', c, 0.5, 0.007, [0, 0.2, -0.17], [0, 0, 0], 14);
    }
    return (t) => { const f = Math.sin(t * 1.5) * 0.12;
      for (const s of [-1, 1]) { for (const [nm, amp] of [['xW', 0.9], ['xW3', 0.6]]) { const w = P.joints[nm + s]; if (w) { w.g.rotation.z = w.rest[2] + s * f * amp; } } }
      const r = P.joints.xRay; if (r) { r.g.rotation.z = t * 0.2; } };
  },
};
const SCALE_W = { seraf: [1, 1, 1.12, 1.22, 1.3] }; // las alas del Seraf crecen con el nivel

/** Construye un Huésped en un nivel de evolución, con un arma equipada. opts: { evo 0–4, melee id|null|'' , quality, color }. */
export function buildHostEvo(THREE, id, opts = {}) {
  const T = THREE, quality = opts.quality || 'low', color = HOST_COLORS[id];
  let evo = Math.max(0, Math.min(4, opts.evo | 0)), melee = opts.melee || '';
  const group = new T.Group(); group.name = 'huesped-evo-' + id;
  const baseEmi = new T.Color(color).multiplyScalar(0.05);
  let geo = evo; // nivel de GEOMETRÍA mostrado (con opts.budget baja hasta que el cuerpo quepa en ese número de llamadas de dibujo; escala y brillo siguen el nivel real)
  let host = null, weapon = null, anim = null, P = null, aura = null, mats2 = null, lastT = 0;
  const wantsCatalog = () => !!melee && !!MELEE_WEAPONS[melee];       // arma del catálogo → reemplaza la innata
  const counts = { draws: 0, tris: 0 };

  function clear() {
    if (host) { group.remove(host.group); host.dispose(); host = null; }
    if (weapon) { weapon.dispose(); weapon = null; }
    if (aura) { group.remove(aura); aura.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); aura.userData.mats.forEach((m) => m.dispose()); aura = null; }
    if (mats2) { for (const m of Object.values(mats2)) m.dispose(); mats2 = null; }
    anim = null; P = null;
  }
  function build() {
    clear();
    const S = quality === 'low' ? 5 : quality === 'medium' ? 7 : 9;
    host = buildHost(T, id, quality, { native: !wantsCatalog() }); group.add(host.group);
    counts.draws = host.info.draws; counts.tris = host.info.tris;
    const J = host.joints;
    // piezas de mutación: una malla por tipo y articulación nueva
    P = makeBuilder(T, S); const at = (name, parent, pos = [0, 0, 0]) => P.joint(name, parent, pos);
    if (MUT[id] && geo > 0 && J) {
      anim = MUT[id](P, J, geo, color, at); for (const j of Object.values(P.joints)) j.g.rotation.set(j.rest[0], j.rest[1], j.rest[2]);
      mats2 = {
        body: new T.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.5, flatShading: true, emissive: new T.Color(color).multiplyScalar(0.05) }),
        glow: new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
        mem: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, flatShading: true, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false, emissive: new T.Color(color).multiplyScalar(0.3) }),
      };
      const c2 = P.finish(mats2); counts.draws += c2.draws; counts.tris += c2.tris;
    }
    // manos: arma equipada fusionada (si es innata, la lleva el cuerpo base)
    if (wantsCatalog() && J && J.foreR) {
      const w = MELEE_WEAPONS[melee], k = (HSCALE[id] || 1) * (TSCALE[w.type] || 1);
      weapon = attachToViewmodel(T, J.foreR.g, melee, { frame: 'host', size: k, offset: HAND[id] || [0, -0.4, 0.05], tier: geo, quality, color, aura: false });
      const wi = weapon.model.info; counts.draws += wi.draws; counts.tris += wi.tris;
      if (id === 'umbra') { /* el antebrazo derecho ya no tiene hoja: se le pone una muñeca para que no quede cortado */ }
    }
    // jaula de aura (tier ≥ 3) y sello brillante en el suelo (tier 4)
    if (geo >= 3) {
      aura = new T.Group(); const m = [new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.04, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, wireframe: true, toneMapped: false })]; aura.userData.mats = m;
      const g = new T.IcosahedronGeometry(1, 0), a1 = new T.Mesh(g, m[0]), a2 = new T.Mesh(g.clone(), m[1]); for (const a of [a1, a2]) { a.position.y = 1.15; a.scale.set(0.95, 1.4, 0.95); a.frustumCulled = false; a.renderOrder = 4; aura.add(a); }
      counts.draws += 2; counts.tris += 160; group.add(aura);
    }
    if (geo >= 4) {
      const sg = new T.Group(), gm = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }), r1 = new T.Mesh(new T.RingGeometry(1.35, 1.4, 48), gm), r2 = new T.Mesh(new T.RingGeometry(0.98, 1.0, 6), gm);
      for (const r of [r1, r2]) { r.rotation.x = -Math.PI / 2; r.position.y = 0.03; r.frustumCulled = false; sg.add(r); }
      group.add(sg); aura = aura || new T.Group(); aura.add(sg); aura.userData.mats = [...(aura.userData.mats || []), gm]; aura.userData.sigil = [r1, r2]; counts.draws += 2; counts.tris += 120;
    }
    const s = 1 + evo * 0.02; group.scale.setScalar(s);
    host.pose('idle'); host.update(0, lastT);
  }
  function fitBuild() { geo = evo; build(); while (opts.budget && counts.draws > opts.budget && geo > 0) { geo--; build(); } }
  fitBuild();
  function update(dt, t) {
    lastT = t == null ? lastT + dt : t; host.update(dt, lastT);
    const J = host.joints;
    if (id === 'seraf' && J.wingR) { const k = SCALE_W.seraf[evo]; for (const sd of ['wingR', 'wingL']) J[sd].g.scale.multiplyScalar(k); }
    if (anim) anim(lastT, evo);
    if (evo > 0) { host.mats.glow.color.multiplyScalar(1 + evo * 0.1); host.mats.body.emissive.copy(baseEmi).multiplyScalar(1 + evo * 0.5); }
    if (weapon) weapon.update(dt, lastT);
    if (aura) { const sg = aura.userData.sigil; if (sg) { sg[0].rotation.z += dt * 0.3; sg[1].rotation.z -= dt * 0.4; } aura.userData.mats[1].opacity = 0.18 + Math.sin(lastT * 1.8) * 0.06; }
  }
  return {
    group, update, id,
    pose(n) { host.pose(n); }, get poseName() { return host.poseName; },
    setEvo(n) { n = Math.max(0, Math.min(4, n | 0)); if (n === evo) return; evo = n; fitBuild(); },
    setMelee(m) { m = m || ''; if (m === melee) return; melee = m; fitBuild(); },
    get evo() { return evo; }, get geoEvo() { return geo; }, get mats() { return host.mats; }, get melee() { return melee; }, get tierName() { return EVO_TIERS[evo].name; }, get joints() { return host.joints; },
    get weapon() { return weapon; },
    get info() { return { id, evo, draws: counts.draws, tris: Math.round(counts.tris) }; },
    dispose() { clear(); },
  };
}

/** Qué cambia a la vista en cada nivel (para la pantalla «Evolución»). */
export const EVO_VISUAL = {
  axioma: ['', 'Hombreras con filo luminoso y bandas de energía en la espalda.', 'Placa pectoral, cresta en el cráneo y blindaje en los antebrazos.', 'Alas de cuchillas en la espalda y una jaula de energía.', 'Halo de energía, alas mayores y un sello brillante bajo los pies.'],
  vesper: ['', 'Cuernos, púas en los codos y espinas dorsales más largas.', 'Abanico de cuchillas en la cola y venas luminosas en los brazos.', 'Alas membranosas y una jaula de energía.', 'Alas enormes, ojos extra, cresta y un sello brillante bajo los pies.'],
  micelio: ['', 'Más hongos en la espalda y los hombros, con esporas luminosas.', 'Sombreros más grandes, filamentos de micelio que cuelgan y musgo.', 'Corona de sombreros en la cabeza y raíces luminosas por el suelo.', 'Dosel gigante con branquias luminosas y una nube de esporas.'],
  umbra: ['', 'Una tercera órbita de fragmentos de vacío.', 'Corona dimensional y hojas flotando detrás de la cabeza.', 'Alas de sombra hechas de cuatro cuchillas cada una.', 'Anillo dimensional gigante con fragmentos y un sello brillante.'],
  seraf: ['', 'Segundo halo, filamentos más largos y brazaletes dorados.', 'Plumas de cuchilla en el borde de las alas.', 'Segundo par de alas, alas más grandes y una jaula de luz.', 'Tercer par de alas, rayos de luz y un tercer halo.'],
};
