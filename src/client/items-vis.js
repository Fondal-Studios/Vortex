// ASPECTO ORGÁNICO DE LOS OBJETOS (docs/INVENTARIO.md): armadura anclada a huesos (kit de huesped-armor.js), reliquias y modelos de armas (1.ª y 3.ª persona).
//
//   const eq = parseEq(player.eq);                         // «id.fase,id.fase» del snapshot → [{ id, it, slot, fase }]
//   ak.replaceSlots(armorSlots(eq)); D.build(ak, ctx); ak.keepAll(); addEquipmentArmor(ak, eq, ctx);   // (lo hace huesped-cuerpo.js)
//   buildItemWeapon(THREE, 'gemelas_axioma', { phase, quality, side: 'R'|'L' }) → { group, update(dt,t), setPhase(n), dispose, info }
//
// Cada pieza de armadura se compone de un CASCARÓN sólido (hueso, caparazón, corteza, cristal, carne, hongo o vacío) más «motivos» orgánicos propios del material
// (púas de hueso, placas de quitina, raíces en espiral, cristales, bultos y tendones, sombreros de hongo, esquirlas de vacío). Con la maduración crecen: más motivos,
// venas que laten con el pulso (uBeat) y un halo en las legendarias Maduras. Presupuesto en Baja: la armadura SUSTITUYE la geometría base de su zona
// (ak.replaceSlots) y suma muy pocas llamadas de dibujo (un material nuevo = una llamada, nunca más por pieza). Medido en docs/INVENTARIO.md.
import * as T from 'three';
import { ITEMS, MATERIALS, ARMOR_SLOTS, SETS, setCounts } from '../sim/items.js';
import { tools, V } from './huesped-piezas.js';
import { makeBuilder, buildMelee } from './melee-models.js';
import { uBeat } from './shaders.js';

const TAU = Math.PI * 2;
export const FASE_NOMBRE = ['Latente', 'Despierta', 'Madura', 'Plena'];
const VEIN_K = [0.55, 0.85, 1.15, 1.5];

/** «id.fase,id.fase» → [{ id, it, slot, fase }] (ignora ids desconocidos). */
export function parseEq(s) {
  if (!s) return [];
  return String(s).split(',').map((x) => { const [id, f] = x.split('.'), it = ITEMS[id]; return it ? { id, it, slot: it.slot, fase: Math.max(0, Math.min(3, f | 0)) } : null; }).filter(Boolean);
}
/** Zonas del cuerpo cuya geometría base se sustituye por la armadura puesta. */
export const armorSlots = (eq) => new Set(eq.filter((e) => ARMOR_SLOTS.includes(e.slot)).map((e) => e.slot));
export const itemOfSlot = (eq, slot) => eq.find((e) => e.slot === slot) || null;

const mixHex = (a, b, u) => new T.Color(a).lerp(new T.Color(b), u).getHex();
const scaleHex = (h, k) => new T.Color(h).multiplyScalar(k).getHex();
const lerp = (a, b, u) => a + (b - a) * u;

/* ───────────────────────── paleta por material ───────────────────────── */
/** Material de la malla del kit y colores. main/dark = cuerpo sólido; glow = venas; acc = acento. */
function palette(e) {
  const M = MATERIALS[e.it.mat], f = e.fase, k = VEIN_K[f];
  const base = { hueso: ['bone', 0xe6d9bc, 0xb5a482], quitina: ['metal', 0xc08a4c, 0x6a4020], raiz: ['bark', 0xa07a48, 0x5a4026], cristal: ['crystal', 0xbfeaff, 0x6aa8e0], carne: ['flesh', 0xd05a68, 0x8a2a3a], espora: ['bark', 0xc6d86a, 0x6e8a30], vacio: ['dark', 0x3a2a60, 0x120c24] }[e.it.mat];
  return { key: base[0], main: base[1], dark: base[2], glow: scaleHex(M.glow, k), glowRaw: M.glow, acc: M.glow, mat: e.it.mat, f, r: e.it.r, vk: k };
}

/* ───────────────────────── geometría por segmentos ───────────────────────── */
function basis(a, b) {
  const y = b.clone().sub(a).normalize(); let z = V(0, 0, 1).addScaledVector(y, -y.z); if (z.lengthSq() < 1e-4) z = V(0, 1, 0).addScaledVector(y, -y.y); z.normalize();
  return { y, z, x: new T.Vector3().crossVectors(y, z) };
}
const radial = (B, ang) => B.x.clone().multiplyScalar(Math.cos(ang)).addScaledVector(B.z, Math.sin(ang));
const along = (a, b, u) => a.clone().lerp(b, u);

/**
 * Motivo orgánico alrededor de un segmento a→b (radio rad). Cada material dibuja su propio carácter. `n` = cantidad base (crece con la fase).
 * Todo va al hueso `bone`. Devuelve nada; las piezas se suman al kit.
 */
function motivo(ak, t, p, seg) {
  const { G, X, S, low, spikeAt, seam } = t, add = ak.add, { a, b, rad, bone } = seg, B = basis(a, b), len = a.distanceTo(b);
  const n = Math.max(1, seg.n + (p.f >= 2 ? 1 : 0) + (p.r >= 3 ? 1 : 0) - (low ? 1 : 0)), L = seg.len || 1, ang0 = seg.ang0 || 0, sweep = seg.sweep ?? TAU;
  const at = (i, u) => ang0 + (n === 1 ? sweep / 2 : (sweep * i) / (n - 1 + (sweep >= TAU - 1e-3 ? 1 : 0)));
  switch (p.mat) {
    case 'hueso': // púas de hueso curvas y un aro de hueso liso
      for (let i = 0; i < n; i++) { const an = at(i), u = 0.15 + 0.7 * ((i * 0.618) % 1), r = radial(B, an), base = along(a, b, u).addScaledVector(r, rad); add('bone', spikeAt(base, r.clone().multiplyScalar(1).addScaledVector(B.y, 0.7), (0.07 + 0.03 * ((i * 7) % 3)) * L, 0.012 * Math.sqrt(L), 0.02, r, { radial: S(5, 4), ridges: 3, ridgeAmp: 0.16 }), bone, { color: i % 2 ? p.main : mixHex(p.main, 0xffffff, 0.3) }); }
      break;
    case 'quitina': // placas superpuestas, cada una con su cresta
      for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, c = along(a, b, u), R = rad * (1.02 - 0.12 * u), g = G.band(R, (len / n) * 1.35, 0.012, { seg: S(14, 8), simple: low, sx: 1, sz: 0.95 }); add('metal', t.limb(g, a, b, u), bone, { color: i % 2 ? p.main : mixHex(p.main, p.dark, 0.3) }); void c; if (!low || i % 2 === 0) add('metal', spikeAt(c.clone().addScaledVector(B.z, R * 0.95), B.z.clone().addScaledVector(B.y, -0.5), 0.045 * L, 0.012, 0, B.y, { radial: S(4, 3) }), bone, { color: p.dark }); }
      break;
    case 'raiz': // dos raíces en espiral y brotes
      for (let k = 0; k < (low ? 1 : 2); k++) { const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10, an = ang0 + k * Math.PI + u * 7 + (seg.twist || 0); pts.push(along(a, b, u).addScaledVector(radial(B, an), rad * (1 + 0.15 * Math.sin(u * 9)))); } add('bark', G.tube(pts, 0.014 * Math.sqrt(L), 0.008, { radial: S(5, 4), tubular: low ? 8 : 16, ridges: 3, ridgeAmp: 0.18 }), bone, { color: k ? p.dark : p.main }); }
      for (let i = 0; i < n; i++) { const an = at(i) + 0.5, u = 0.2 + 0.6 * ((i * 0.37) % 1), r = radial(B, an); add('light', spikeAt(along(a, b, u).addScaledVector(r, rad * 1.05), r.clone().addScaledVector(B.y, 0.8), 0.05 * L, 0.011, 0.01, B.y, { radial: 4, tubular: 3 }), bone, { color: scaleHex(0x9bff4a, 0.5 + 0.25 * p.f) }); }
      break;
    case 'cristal': // cristales que nacen de la superficie
      for (let i = 0; i < n; i++) { const an = at(i), u = 0.2 + 0.6 * ((i * 0.618) % 1), r = radial(B, an), base = along(a, b, u).addScaledVector(r, rad * 0.9), sh = G.shard((0.07 + 0.04 * ((i * 5) % 3)) * L, 0.014 * Math.sqrt(L), S(5, 4)); const q = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), r.clone().addScaledVector(B.y, 0.45).normalize()); add('crystal', X(sh, { q, p: [base.x, base.y, base.z] }), bone, { color: mixHex(p.main, p.acc, 0.2 + 0.1 * (i % 3)) }); }
      break;
    case 'carne': // bultos de carne y un tendón que late
      for (let i = 0; i < n; i++) { const an = at(i), u = 0.2 + 0.6 * ((i * 0.618) % 1), r = radial(B, an), base = along(a, b, u).addScaledVector(r, rad * 0.95); add('flesh', X(t.bonelump(0.028 * Math.sqrt(L) * (1 + 0.4 * ((i * 3) % 2)), [1, 0.8, 1], i + (seg.seed || 0), 0.3), { p: [base.x, base.y, base.z] }), bone, { color: i % 2 ? p.main : p.dark }); }
      { const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push(along(a, b, u).addScaledVector(radial(B, ang0 + 0.7 + Math.sin(u * 5) * 0.3), rad * 1.06)); } add('flesh', G.tube(pts, 0.011, 0.007, { radial: 4, tubular: 8 }), bone, { color: p.dark }); }
      break;
    case 'espora': // sombreros de hongo con pintas luminosas
      for (let i = 0; i < n; i++) { const an = at(i), u = 0.15 + 0.7 * ((i * 0.618) % 1), r = radial(B, an), base = along(a, b, u).addScaledVector(r, rad * 0.95), R = (0.04 + 0.016 * ((i * 5) % 3)) * Math.sqrt(L), cap = t.dome(R, R * 0.55, { seg: S(10, 6), flat: 0.2 }), q = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), r.clone().addScaledVector(B.y, 0.35).normalize());
        add('bark', X(G.cyl(R * 0.22, R * 0.28, R * 0.7, S(5, 4)), { q, p: [base.x, base.y, base.z] }), bone, { color: p.dark }); const top = base.clone().addScaledVector(r.clone().addScaledVector(B.y, 0.35).normalize(), R * 0.7); add('stone', X(cap, { q, p: [top.x, top.y, top.z] }), bone, { color: i % 2 ? p.main : mixHex(p.main, 0xffffff, 0.35) });
        if (!low || i === 0) add('light', X(G.sphere(R * 0.14, 5, 4), { p: [top.x + r.x * R * 0.4, top.y + r.y * R * 0.4 + R * 0.38, top.z + r.z * R * 0.4] }), bone, { color: scaleHex(p.glowRaw, 0.55 + 0.2 * p.f) }); }
      break;
    case 'vacio': // esquirlas finas que se arrastran hacia atrás
      for (let i = 0; i < n; i++) { const an = at(i), u = 0.2 + 0.6 * ((i * 0.618) % 1), r = radial(B, an), base = along(a, b, u).addScaledVector(r, rad * 0.9), d = r.clone().multiplyScalar(0.5).add(V(0, -0.15, -0.9)).normalize(); add('spirit', spikeAt(base, d, (0.1 + 0.05 * ((i * 5) % 3)) * L, 0.016, 0.01, B.y, { radial: 3, tubular: 4 }), bone, { color: mixHex(p.acc, 0x6a3aff, 0.4) }); if (i % 2 === 0) add('dark', X(G.shard(0.05 * L, 0.012, S(4, 3)), { p: [base.x, base.y, base.z], r: [0.4 + i, 0, 0.3] }), bone, { color: p.main }); }
      break;
    default: break;
  }
  // vena luminosa a lo largo del segmento (late con el pulso del juego; más fuerte con la maduración)
  if (p.f >= 1 || p.r >= 2) { const pts = []; for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push(along(a, b, u).addScaledVector(radial(B, ang0 + 1.3 + Math.sin(u * 6) * 0.25), rad * 1.01)); } add('ember', seam(pts, 0.0034), bone, { color: p.glow }); }
  void seam;
}

/* ───────────────────────── piezas por zona ───────────────────────── */
function cascaron(ak, t, p, geo, bone, color) { ak.add(p.key, geo, bone, { color: color ?? p.main }); }

function head(ak, t, e, p) {
  const { G, X, S, low, spikeAt } = t, add = ak.add, HC = V(0, 1.6, 0.045);
  // cascarón: casco abierto por delante
  const open = 0.95, pts = [[0.1, -0.07], [0.108, -0.03], [0.112, 0.02], [0.105, 0.07], [0.086, 0.115], [0.054, 0.14], [0.018, 0.152], [0, 0.155]];
  const shell = G.lathe(pts, S(16, 9), open, TAU - open * 2, 36); X(shell, { p: [HC.x, HC.y, HC.z], s: [1.02, 1, 1.2] });
  if (p.mat === 'espora') { // sombrero de hongo ancho
    const cap = t.dome(0.19, 0.1, { seg: S(16, 9), flat: 0.25 }); X(cap, { p: [HC.x, HC.y + 0.05, HC.z - 0.01], s: [1, 1, 1.05] }); add('stone', cap, 'head', { color: p.main });
    add('bark', G.cyl(0.07, 0.09, 0.07, S(8, 5)).translate(HC.x, HC.y + 0.03, HC.z - 0.02), 'head', { color: p.dark });
    for (let i = 0; i < (low ? 3 : 6); i++) { const a = i * 1.05; add('light', X(G.sphere(0.014, 5, 4), { p: [HC.x + Math.sin(a) * 0.1, HC.y + 0.13 - 0.01 * (i % 2), HC.z + Math.cos(a) * 0.1 - 0.01] }), 'head', { color: scaleHex(p.glowRaw, 0.5 + 0.2 * p.f) }); }
  } else cascaron(ak, t, p, shell, 'head', p.mat === 'vacio' ? p.dark : p.main);
  // frente: ceja
  if (p.mat !== 'espora') cascaron(ak, t, p, X(G.wrapE(G.plate([[0, 0.012], [0.05, 0.028], [0.108, 0.05], [0.12, 0.03], [0.07, -0.006], [0, -0.016], [-0.07, -0.006], [-0.12, 0.03], [-0.108, 0.05], [-0.05, 0.028]], 0.022, 0.006), 0.116, 0.142), { p: [HC.x, HC.y + 0.035, HC.z] }), 'head', p.dark);
  // carácter del material: cuernos/cresta/antenas según el material
  const crown = (sp, up, n, len, rr) => { for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * sp; add(p.mat === 'cristal' ? 'crystal' : p.mat === 'vacio' ? 'spirit' : p.mat === 'raiz' ? 'bark' : p.mat === 'carne' ? 'flesh' : p.mat === 'quitina' ? 'metal' : 'bone',
    p.mat === 'cristal' ? X(G.shard(len * (1 - Math.abs(a) * 0.5), rr, S(5, 4)), { p: [HC.x + Math.sin(a) * 0.1, HC.y + 0.09, HC.z - 0.02 + Math.cos(a) * 0.02], r: [-0.25 - Math.abs(a) * 0.1, 0, -a * 1.1] }) : spikeAt(V(HC.x + Math.sin(a) * 0.09, HC.y + 0.07, HC.z - 0.03), V(Math.sin(a) * 0.8, up, -0.45), len * (1 - Math.abs(a) * 0.4), rr, 0.05, V(0, 0, -1), { radial: S(5, 4), ridges: 3, ridgeAmp: 0.18 }), 'head', { color: p.mat === 'vacio' ? p.acc : i % 2 ? p.main : mixHex(p.main, 0xffffff, 0.25) }); } };
  if (p.mat === 'hueso') { ak.both(() => crown(0, 1, 1, 0.3 + 0.04 * p.f + (p.r >= 2 ? 0.06 : 0), 0.024)); }
  else if (p.mat === 'quitina') { for (let i = 0; i < 3; i++) add('metal', G.band(0.1 - i * 0.005, 0.03, 0.012, { seg: S(14, 8), simple: low }).translate(HC.x, HC.y + 0.04 + i * 0.03, HC.z - 0.015 - i * 0.012), 'head', { color: i % 2 ? p.main : p.dark }); crown(0.55, 1, 1 + (p.r >= 2 ? 2 : 0), 0.1, 0.014); }
  else if (p.mat === 'raiz') crown(0.5, 1.1, 3 + p.f, 0.22, 0.014);
  else if (p.mat === 'cristal') crown(0.34, 1, 5 + (p.r >= 2 ? 2 : 0) + (p.f >= 2 ? 2 : 0), 0.14, 0.018);
  else if (p.mat === 'carne') { for (let i = 0; i < (low ? 3 : 5); i++) add('flesh', X(t.bonelump(0.03 + 0.008 * (i % 2), [1, 0.8, 1], i + 3, 0.3), { p: [HC.x + (i - 2) * 0.04, HC.y + 0.1 - Math.abs(i - 2) * 0.012, HC.z - 0.03] }), 'head', { color: i % 2 ? p.main : p.dark }); }
  else if (p.mat === 'vacio') { // capucha alta que se deshace
    add('spirit', X(G.cone(0.13, 0.4, S(8, 5)), { p: [HC.x, HC.y + 0.06, HC.z - 0.08], r: [-0.35, 0, 0] }), 'head', { color: mixHex(p.acc, 0x2a1050, 0.6) });
    crown(0.5, 0.9, 2 + (p.f >= 2 ? 2 : 0), 0.16, 0.014);
  }
  // collar
  add(p.key === 'crystal' ? 'bone' : p.key, G.band(0.075, 0.03, 0.012, { seg: S(14, 8), simple: low }).translate(0, 1.455, 0.03), 'neck01', { color: p.dark });
  // cicatriz de luz
  const scar = []; for (let i = 0; i <= 7; i++) { const u = i / 7; scar.push(V(HC.x + Math.sin((u - 0.5) * 0.4) * 0.01, HC.y + 0.12 - u * 0.16 + Math.sin(u * 5) * 0.004, HC.z + 0.14 - u * 0.04)); } if (p.f >= 1) add('ember', t.seam(scar, 0.003), 'head', { color: p.glow });
  if (p.r >= 3 && p.f >= 2) ak.halo('head', V(0, 1.64, 0.02), p.glowRaw, 0.5, 0.35);
}

function torso(ak, t, e, p) {
  const { G, X, S, low, spikeAt, seam } = t, add = ak.add;
  // peto: elipsoide abierto por la espalda
  const chest = G.lathe([[0.168, 1.2], [0.178, 1.25], [0.182, 1.3], [0.172, 1.35], [0.148, 1.395], [0.108, 1.425], [0.094, 1.44]], S(14, 9), 0.3, TAU - 0.6, 30); X(chest, { p: [0, 0, 0.035], s: [1, 1, 0.76] });
  cascaron(ak, t, p, chest, 'spine01', p.main);
  // cintura
  cascaron(ak, t, p, G.band(0.15, 0.1, 0.016, { seg: S(16, 9), simple: low, sz: 0.78 }).translate(0, 1.08, 0.04), 'spine02', p.dark);
  add('ember', seam(Array.from({ length: 8 }, (_, i) => V(Math.sin(i * 0.4 - 1.4) * 0.14, 1.21 + (i % 2) * 0.012, 0.03 + Math.cos(i * 0.4 - 1.4) * 0.11)), 0.0034), 'spine01', { color: p.glow });
  // hombreras (ambos lados) con el motivo del material
  ak.both(() => {
    const C = ak.P('upperarm01'), K = ak.P('lowerarm01');
    cascaron(ak, t, p, X(t.dome(0.105, 0.075, { seg: S(12, 7) }), { p: [C.x + 0.01, C.y + 0.02, C.z], r: [0, 0, -0.55] }), 'upperarm01', p.main);
    motivo(ak, t, p, { a: C.clone().add(V(-0.02, 0.05, 0)), b: C.clone().add(V(0.12, 0.13, 0)), rad: 0.05, bone: 'upperarm01', n: 2 + (p.r >= 2 ? 1 : 0), len: 1.2, ang0: 0.2, sweep: 2.4 });
    void K;
  });
  // carácter del material en el pecho
  const cz = 0.19;
  if (p.mat === 'hueso') { for (let i = 0; i < (low ? 3 : 5); i++) add('bone', G.torus(0.13 + 0.004 * i, 0.011 - 0.0006 * i, S(5, 4), S(22, 12)).scale(1, 1, 0.82).translate(0, 1.04 + i * 0.034, 0.05), i < 2 ? 'spine03' : 'spine02', { color: i % 2 ? p.main : p.dark }); add('bone', X(G.wrapE(G.plate([[0, 0.12], [0.03, 0.08], [0.034, -0.05], [0, -0.11], [-0.034, -0.05], [-0.03, 0.08]], 0.03, 0.01), 0.04, 0.17), { p: [0, 1.29, 0.03] }), 'spine01', { color: p.main }); }
  else if (p.mat === 'quitina') { for (let i = 0; i < (low ? 3 : 4); i++) add('metal', G.band(0.172 - i * 0.004, 0.06, 0.012, { seg: S(16, 9), simple: low, sz: 0.76 }).translate(0, 1.38 - i * 0.07, 0.035), i < 2 ? 'spine01' : 'spine02', { color: i % 2 ? p.main : p.dark }); }
  else if (p.mat === 'raiz') { for (let k = 0; k < (low ? 2 : 3); k++) { const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12, an = k * 2.1 + u * 5; pts.push(V(Math.sin(an) * 0.17, 1.0 + u * 0.42, 0.04 + Math.cos(an) * 0.13)); } add('bark', G.tube(pts, 0.016, 0.01, { radial: S(5, 4), tubular: low ? 10 : 18, ridges: 3, ridgeAmp: 0.2 }), 'spine01', { color: k % 2 ? p.dark : p.main }); }
    for (let i = 0; i < 2 + p.f; i++) add('light', spikeAt(V(Math.sin(i * 2.3) * 0.1, 1.16 + i * 0.07, 0.17), V(Math.sin(i * 2.3) * 0.4, 0.7, 1), 0.07, 0.012, 0.01, V(0, 1, 0), { radial: 4, tubular: 3 }), 'spine01', { color: scaleHex(0x9bff4a, 0.5 + 0.25 * p.f) }); }
  else if (p.mat === 'cristal') { const c = V(0, 1.28, cz); for (let i = 0; i < 3 + (p.r >= 2 ? 2 : 0) + (p.f >= 2 ? 2 : 0); i++) { const a = (i - 1.5) * 0.45; add('crystal', X(G.shard((0.13 - Math.abs(a) * 0.05) * (1 + 0.1 * p.f), 0.026, S(5, 4)), { p: [c.x + Math.sin(a) * 0.07, c.y - 0.04, c.z], r: [Math.PI / 2 - 0.2, 0, -a * 0.9] }), 'spine01', { color: mixHex(p.main, p.acc, 0.25 + 0.1 * (i % 3)) }); } add('light', G.sphere(0.022, 6, 4).translate(c.x, c.y, c.z + 0.04), 'spine01', { color: p.glow }); }
  else if (p.mat === 'carne') { for (let i = 0; i < (low ? 4 : 7); i++) add('flesh', X(t.bonelump(0.036 + 0.01 * (i % 3), [1, 0.8, 0.9], i, 0.3), { p: [Math.sin(i * 1.7) * 0.1, 1.12 + (i % 4) * 0.075, 0.16 - Math.abs(Math.sin(i * 1.7)) * 0.03] }), 'spine01', { color: i % 2 ? p.main : p.dark }); add('ember', seam(Array.from({ length: 9 }, (_, i) => V(Math.sin(i * 0.9) * 0.08, 1.4 - i * 0.045, 0.17)), 0.0036), 'spine01', { color: p.glow }); }
  else if (p.mat === 'espora') { for (let i = 0; i < (low ? 2 : 4); i++) { const sd = i % 2 ? -1 : 1, y = 1.12 + i * 0.07; add('bark', X(G.cyl(0.02, 0.026, 0.06, S(5, 4)), { p: [sd * 0.17, y, 0.04], r: [0, 0, sd * Math.PI / 2] }), 'spine01', { color: p.dark }); add('stone', X(t.dome(0.07 - i * 0.008, 0.035, { seg: S(10, 6), flat: 0.25 }), { p: [sd * 0.2, y, 0.04], r: [0, 0, -sd * 1.4] }), 'spine01', { color: i % 2 ? p.main : mixHex(p.main, 0xffffff, 0.35) }); } add('light', G.sphere(0.02, 5, 4).translate(0, 1.3, 0.2), 'spine01', { color: scaleHex(p.glowRaw, 0.6 + 0.2 * p.f) }); }
  else if (p.mat === 'vacio') { add('spirit', X(G.cone(0.2, 0.55, S(10, 6)), { p: [0, 1.0, -0.12], r: [0.28, 0, 0] }), 'spine01', { color: mixHex(p.acc, 0x2a1050, 0.55) }); for (let i = 0; i < 3 + p.f; i++) add('spirit', spikeAt(V((i - 2) * 0.07, 1.34, -0.14), V((i - 2) * 0.2, -0.3, -1), 0.2 + 0.06 * (i % 3), 0.02, 0.02, V(0, 1, 0), { radial: 3, tubular: 4 }), 'spine01', { color: mixHex(p.acc, 0x6a3aff, 0.4) }); }
  if (p.r >= 3 && p.f >= 2) ak.halo('spine01', V(0, 1.3, 0.22), p.glowRaw, 0.5, 0.4);
}

function arms(ak, t, e, p) {
  const { G, X, S, low, spikeAt, seam } = t, add = ak.add;
  ak.both(() => {
    const U = ak.P('upperarm01'), E = ak.P('lowerarm01'), W = ak.P('wrist');
    // Siluetas funcionales: tendones en paralelo para ritmo, placas anchas para peso.
    if (e.it.id === 'tendones_relampago') {
      for (const side of [-1, 1]) {
        const pts = [E, along(E, W, 0.45), W].map((v, i) => v.clone().add(V(side * (i === 1 ? 0.075 : 0.045), 0, 0.055)));
        add('flesh', G.tube(pts, 0.012, 0.008, { radial: 4, tubular: low ? 5 : 10 }), 'lowerarm01', { color: p.dark });
        add('ember', seam(pts, 0.003), 'lowerarm01', { color: p.glow });
      }
    } else if (e.it.id === 'punos_basalticos') {
      for (const u of [0.35, 0.7]) add('metal', t.ringAt(E, W, u, 0.085, 0.06, 0.018), 'lowerarm01', { color: p.dark });
    }
    // brazal: cono sobre el antebrazo y banda sobre el brazo
    cascaron(ak, t, p, t.limb(t.cuff(0.062, 0.052, E.distanceTo(W) * 0.8, 0.012, S(14, 8)), E, W, 0.5), 'lowerarm01', p.main);
    cascaron(ak, t, p, t.ringAt(U, E, 0.55, 0.062, 0.05, 0.012), 'upperarm01', p.dark);
    // guantelete: puño con nudillos
    cascaron(ak, t, p, X(t.dome(0.06, 0.05, { seg: S(10, 6) }), { p: [W.x + 0.01, W.y - 0.02, W.z + 0.01], r: [Math.PI * 0.35, 0, 0.35] }), 'wrist', p.main);
    for (let i = 0; i < (low ? 2 : 3); i++) { const base = W.clone().add(V(0.01 - i * 0.012, -0.075 - i * 0.01, 0.07 + i * 0.01)); add(p.mat === 'cristal' ? 'crystal' : p.mat === 'vacio' ? 'spirit' : p.mat === 'raiz' ? 'bark' : p.mat === 'carne' ? 'flesh' : p.mat === 'espora' ? 'bark' : p.mat === 'quitina' ? 'metal' : 'bone', spikeAt(base, V(0.1, -0.5, 1), (0.07 + 0.025 * p.f) * (p.r >= 2 ? 1.2 : 1), 0.012, 0.008, V(0, 1, 0), { radial: S(5, 4), ridges: 3, ridgeAmp: 0.16 }), 'wrist', { color: p.mat === 'vacio' ? p.acc : i % 2 ? p.main : mixHex(p.main, 0xffffff, 0.2) }); }
    motivo(ak, t, p, { a: E, b: W, rad: 0.062, bone: 'lowerarm01', n: 3, len: 1, ang0: 1.2, sweep: 3.2, seed: 1, twist: 0.5 });
    if (p.r >= 1) motivo(ak, t, p, { a: U, b: E, rad: 0.066, bone: 'upperarm01', n: 2, len: 0.9, ang0: 1.4, sweep: 2.4, seed: 5 });
    if (p.f >= 2) add('ember', seam([E.clone().add(V(0.03, 0.02, 0.05)), along(E, W, 0.5).add(V(0.04, 0, 0.055)), W.clone().add(V(0.03, 0.02, 0.05))], 0.0034), 'lowerarm01', { color: p.glow });
  });
}

function legs(ak, t, e, p) {
  const { G, X, S, low, seam } = t, add = ak.add;
  ak.both(() => {
    const H = ak.P('upperleg01'), K = ak.P('lowerleg01'), A = ak.P('foot');
    cascaron(ak, t, p, t.limb(t.cuff(0.07, 0.056, K.distanceTo(A) * 0.78, 0.014, S(14, 8)), K, A, 0.5), 'lowerleg01', p.main);
    cascaron(ak, t, p, X(t.dome(0.075, 0.06, { seg: S(10, 6) }), { p: [K.x, K.y + 0.0, K.z + 0.045], r: [Math.PI / 2, 0, 0] }), 'lowerleg01', p.dark);   // rodillera
    cascaron(ak, t, p, t.ringAt(H, K, 0.55, 0.098, 0.07, 0.014), 'upperleg01', p.dark);
    // bota: puntera
    cascaron(ak, t, p, X(G.sphere(0.058, S(9, 6), S(6, 4)), { p: [A.x, A.y - 0.03, A.z + 0.1], s: [1, 0.62, 1.7] }), 'foot', p.main);
    motivo(ak, t, p, { a: K, b: A, rad: 0.068, bone: 'lowerleg01', n: 3, len: 1, ang0: 1.2, sweep: 3.4, seed: 2 });
    if (p.r >= 1) motivo(ak, t, p, { a: H, b: K, rad: 0.1, bone: 'upperleg01', n: 2, len: 1.1, ang0: 1.5, sweep: 2.4, seed: 8 });
    if (p.f >= 2) add('ember', seam([K.clone().add(V(0.02, -0.04, 0.062)), along(K, A, 0.55).add(V(0.015, 0, 0.065)), A.clone().add(V(0.01, 0.08, 0.06))], 0.0036), 'lowerleg01', { color: p.glow });
  });
}

/** Reliquia: cuelga de la cadera izquierda con un cordón; late con el pulso. */
function relic(ak, t, e, p) {
  const { G, X, S, low, spikeAt, seam } = t, add = ak.add, k = 1 + 0.12 * p.f, c = V(0.2, 0.98, 0.1);
  add('leather', G.tube([V(0.16, 1.1, 0.07), V(0.19, 1.04, 0.1), c.clone().add(V(0, 0.05, 0))], 0.005, 0.005, { radial: 3, tubular: 6 }), 'spine03', { color: 0x3a2a1c });
  const key = p.key === 'crystal' ? 'crystal' : p.key === 'flesh' ? 'flesh' : p.key === 'dark' ? 'dark' : p.key === 'bone' ? 'bone' : 'bark';
  switch (p.mat) {
    case 'hueso': add('bone', spikeAt(c.clone().add(V(0, 0.03, 0)), V(0, -1, 0.1), 0.12 * k, 0.026 * k, 0.015, V(0, 0, 1), { radial: S(6, 4), ridges: 3, ridgeAmp: 0.15 }), 'spine03', { color: p.main }); break;
    case 'espora': add('bark', X(G.sphere(0.04 * k, S(8, 5), S(6, 4)), { p: [c.x, c.y - 0.03, c.z], s: [1, 1.2, 1] }), 'spine03', { color: p.dark }); for (let i = 0; i < (low ? 4 : 7); i++) add('light', spikeAt(c.clone().add(V(0, -0.03, 0)), V(Math.sin(i * 2.4), Math.cos(i * 1.7), Math.cos(i * 2.4)), 0.035 * k, 0.007, 0, V(0, 1, 0), { radial: 3, tubular: 2 }), 'spine03', { color: scaleHex(p.glowRaw, 0.6 + 0.2 * p.f) }); break;
    case 'cristal': add('crystal', X(G.sphere(0.04 * k, S(9, 6), S(7, 5)), { p: [c.x, c.y - 0.04, c.z] }), 'spine03', { color: p.main }); add('light', G.sphere(0.017 * k, 6, 4).translate(c.x, c.y - 0.04, c.z + 0.032), 'spine03', { color: p.glow }); break;
    case 'carne': add('flesh', X(t.bonelump(0.045 * k, [1, 1.15, 0.9], 3, 0.25), { p: [c.x, c.y - 0.04, c.z] }), 'spine03', { color: p.main }); add('ember', seam([c.clone().add(V(0, 0.0, 0.04)), c.clone().add(V(0.02, -0.05, 0.045)), c.clone().add(V(0, -0.1, 0.03))], 0.005), 'spine03', { color: p.glow }); break;
    case 'vacio': add('spirit', X(G.shard(0.14 * k, 0.026 * k, S(5, 4)), { p: [c.x, c.y - 0.12, c.z], r: [Math.PI, 0.3, 0.2] }), 'spine03', { color: mixHex(p.acc, 0x6a3aff, 0.3) }); add('dark', X(G.shard(0.07 * k, 0.018, S(4, 3)), { p: [c.x + 0.025, c.y - 0.05, c.z], r: [Math.PI, 0, -0.3] }), 'spine03', { color: p.main }); break;
    default: add(key, X(G.sphere(0.04 * k, S(8, 5), S(6, 4)), { p: [c.x, c.y - 0.05, c.z], s: [0.85, 1.35, 0.85] }), 'spine03', { color: p.main }); add('ember', seam([c.clone().add(V(0, -0.0, 0.034)), c.clone().add(V(0, -0.1, 0.034))], 0.004), 'spine03', { color: p.glow }); break;
  }
  if (e.it.id === 'relicario_amortiguador') for (const r of [0.065, 0.085]) add('metal', G.torus(r * k, 0.005, 4, S(14, 8)).translate(c.x, c.y - 0.05, c.z), 'spine03', { color: p.dark });
  if (p.r >= 2) add('ember', G.torus(0.05 * k, 0.003, 3, S(14, 8)).rotateX(Math.PI / 2).translate(c.x, c.y - 0.05, c.z), 'spine03', { color: p.glow });
  if (p.r >= 3 && p.f >= 2) ak.halo('spine03', V(c.x, c.y - 0.05, c.z), p.glowRaw, 0.35, 0.45);
}

const BUILD = { head, torso, arms, legs, relic };

/**
 * Agrega al kit la armadura y la reliquia puestas. Llamar DESPUÉS de ak.keepAll() (lo que reemplaza ya se descartó). Devuelve { slots: [...] }.
 * Las zonas con armadura pierden la geometría base de esa parte; el resto del cuerpo queda igual.
 */
export function addEquipmentArmor(ak, eq) {
  const t = tools(ak), done = [], sc = setCounts(eq), full = [];
  for (const e of eq) {
    const fn = BUILD[e.slot]; if (!fn) continue;
    const n = e.it.set ? sc[e.it.set] || 0 : 0, p = palette(e);
    if (n >= 2) { p.vk *= 1.15; p.glow = scaleHex(p.glowRaw, p.vk); }                     // con 2 piezas del set las vetas brillan más
    if (n >= 4) { p.f = Math.min(3, p.f + 1); p.vk *= 1.2; p.glow = scaleHex(p.glowRaw, p.vk); if (!full.includes(e.it.set)) full.push(e.it.set); }   // con 4 el set «despierta»: una fase más de aspecto
    try { fn(ak, t, e, p); done.push(e.slot); } catch (err) { console.warn('Armadura ' + e.id + ':', err.message); }
  }
  // set completo: aura de pulso que rodea el torso y anillos de luz en los hombros
  for (const sid of full) { const g = MATERIALS[SETS[sid].mat].glow; ak.halo('spine01', V(0, 1.2, 0.05), g, 0.95, 0.28); ak.both(() => { const C = ak.P('upperarm01'); ak.add('ember', t.G.torus(0.09, 0.0035, 3, t.S(16, 8)).rotateZ(0.55).translate(C.x + 0.01, C.y + 0.05, C.z), 'upperarm01', { color: scaleHex(g, 1.4) }); }); }
  return { slots: done, sets: full };
}

/* ═════════════════════════ ARMAS ═════════════════════════ */
const ZERO = [0, 0, 0], ONE = [1, 1, 1];
const gripWrap = (B, col, col2, y0, y1, r, rings = 4) => { B.cyl('body', col, r, r, y1 - y0, [0, (y0 + y1) / 2, 0]); for (let i = 0; i < rings; i++) B.cyl('body', col2, r * 1.18, r * 1.18, 0.014, [0, y0 + (y1 - y0) * ((i + 0.5) / rings), 0]); };
const VEIN_PHASE = [0.6, 0.9, 1.2, 1.6];

/** Modelos propios de las armas firma y de la cañonera de disparo (marco: empuñe en el origen, hoja/cabeza hacia +Y, filo hacia +X, frente +Z). */
const MODELOS = {
  /** Espada gemela: `side` 'R' = Vigilia (hueso pálido, luz dorada) · 'L' = Ceniza (hueso quemado, brasa). Dos hojas orgánicas con dientes de hueso que crecen con la fase. */
  gemelas(B, c, f, side) {
    const R = side !== 'L', BONE = R ? 0xece1c6 : 0x4a3a34, BONE2 = R ? 0xb7a883 : 0x2a1c1c, GL = R ? c.gold : c.ember, GL2 = R ? 0xffffff : 0xffb070;
    gripWrap(B, BONE2, R ? 0x5a4630 : 0x1a0f0f, -0.15, 0.07, 0.022, 4);
    B.ico('body', BONE, 0.045, [0, -0.19, 0], [1, 1.1, 0.9]); B.cone('body', BONE2, 0.012, 0.08 + 0.02 * f, [0.03, -0.24, 0.02], [0, 0, 0.55], 4); B.cone('body', BONE2, 0.012, 0.08 + 0.02 * f, [-0.03, -0.24, -0.02], [0, 0, -0.55], 4);
    // guardas de costilla (se curvan hacia el filo)
    B.arc('body', BONE, (u) => [0.02 + u * 0.15, 0.085 + Math.sin(u * 2.3) * 0.07, 0], 4, 0.02, 0.011); B.arc('body', BONE, (u) => [-0.02 - u * 0.12, 0.085 + Math.sin(u * 2.3) * 0.05, 0], 4, 0.018, 0.01);
    B.sph('body', BONE2, 0.036, [0, 0.1, 0], [1.1, 0.8, 1.1]);
    // hoja en forma de hoja curva: se ensancha y termina en punta
    B.plate('body', BONE, [[-0.055, 0.1], [0.055, 0.1], [0.075, 0.3], [0.07, 0.58], [0.045, 0.82], [0.0, 1.06], [-0.04, 0.78], [-0.06, 0.55], [-0.07, 0.3]], 0.024, ZERO, ZERO, ONE, 0.007);
    for (let i = 0; i < 3 + f; i++) { const y = 0.26 + i * (0.5 / (2 + f)); B.spike('body', BONE2, [-0.06, y, 0], [-0.13 - (i % 2) * 0.02, y + 0.1, 0], 0.04, 0.018); }   // dientes de hueso del lomo: crecen
    B.box('glow', GL, [0.012, 0.7, 0.028], [0.005, 0.5, 0], ZERO); B.sph('glow', GL, 0.018, [0, 0.13, 0.02]);
    if (f >= 1) B.arc('glow', GL, (u) => [0.045 * Math.sin(u * 5), 0.14 + u * 0.8, 0.016], 9, 0.006, 0.003, 3);
    if (f >= 2) { B.sph('mem', GL, 0.07, [0, 0.55, 0], [1, 8, 1], 6); for (let i = 0; i < 3; i++) B.cone('glow', GL2, 0.012, 0.06, [0.075, 0.25 + i * 0.22, 0], [0, 0, -0.5], 4); }
    if (f >= 3) { B.tor('glow', GL, 0.1, 0.005, [0, 0.55, 0], [Math.PI / 2, 0, 0], 8); for (let i = 0; i < 4; i++) B.oct('og', GL2, 0.018, [Math.cos(i * 1.57) * 0.12, 0.3 + i * 0.2, Math.sin(i * 1.57) * 0.12], [0.6, 1.6, 0.6]); }
    return { rad: 0.14, mid: 0.55 };
  },
  /** Garras dobles de la Bestia: tres cuchillas curvas de quitina desde una barra de puño; luz de luna en las puntas. */
  garras(B, c, f, side) {
    const CH = 0x5a3a24, CH2 = 0xc08a4c, TIP = 0xe8f0ff, GL = c.moon;
    B.cyl('body', CH, 0.026, 0.026, 0.2, [0, 0.0, 0], [0, 0, Math.PI / 2], 6); B.box('body', CH2, [0.2, 0.05, 0.06], [0, -0.02, 0]);
    const n = 3 + (f >= 2 ? 1 : 0);
    for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 0.06, L = 0.6 - Math.abs(i - (n - 1) / 2) * 0.07 + (f >= 3 ? 0.06 : 0);
      B.arc('body', i % 2 ? CH2 : CH, (u) => [x + u * 0.03, 0.04 + u * L, 0.09 * u * u], 6, 0.022, 0.004, 4); B.cone('glow', TIP, 0.008, 0.06, [x + 0.035, 0.04 + L, 0.09], [0.55, 0, 0.0], 4); }
    B.arc('glow', GL, (u) => [0.0, 0.05 + u * 0.4, 0.07 * u * u + 0.012], 6, 0.006, 0.003, 3);
    for (let i = 0; i < 3 + f; i++) B.spike('body', CH2, [(i - 1.5) * 0.05, 0.02, -0.02], [(i - 1.5) * 0.06, -0.06, -0.06], 0.04, 0.025);
    if (f >= 1) B.sph('glow', GL, 0.02, [0, 0.0, 0.04]);
    if (f >= 2) B.sph('mem', GL, 0.09, [0, 0.3, 0.03], [1, 4, 1], 6);
    if (f >= 3) B.tor('glow', GL, 0.12, 0.004, [0, 0.3, 0.03], [Math.PI / 2, 0, 0], 8);
    return { rad: 0.12, mid: 0.3 };
  },
  /** Cetro de Raíz Madre: báculo de raíces trenzadas con un bulbo que echa brotes, vainas de esporas y flores. */
  baculo(B, c, f) {
    const BK = 0x4a3220, BK2 = 0x7a5530, LF = 0x7be03a, SP = c.spore;
    B.arc('body', BK, (u) => [Math.sin(u * 14) * 0.026, -0.3 + u * 1.6, Math.cos(u * 14) * 0.026], 14, 0.032, 0.026, 5);
    B.arc('body', BK2, (u) => [Math.sin(u * 14 + 3.14) * 0.03, -0.3 + u * 1.6, Math.cos(u * 14 + 3.14) * 0.03], 14, 0.018, 0.015, 4);
    B.sph('body', BK2, 0.1, [0, 1.38, 0], [1, 1.3, 1], 7);
    for (let i = 0; i < 5 + f; i++) { const a = i * 1.26, e = 1.18 + (i % 3) * 0.1; B.limb('body', BK, [Math.sin(a) * 0.05, e - 0.1, Math.cos(a) * 0.05], [Math.sin(a) * 0.2, e + 0.15, Math.cos(a) * 0.2], 0.02, 0.008, 4); B.cone('glow', LF, 0.04, 0.12, [Math.sin(a) * 0.22, e + 0.2, Math.cos(a) * 0.22], [Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6], 4); }
    B.sph('glow', SP, 0.05 + 0.008 * f, [0, 1.4, 0], ONE, 6); B.sph('mem', SP, 0.16, [0, 1.4, 0], ONE, 6);
    for (let i = 0; i < 3 + f * 2; i++) B.sph('glow', mixc(SP, 0xffffff, 0.4), 0.018, [Math.sin(i * 2.1) * 0.15, 0.9 + i * 0.07, Math.cos(i * 2.1) * 0.15], ONE, 4);
    if (f >= 2) for (let i = 0; i < 4; i++) { B.cone('glow', 0xffd0f0, 0.03, 0.08, [Math.sin(i * 1.57) * 0.12, 1.55, Math.cos(i * 1.57) * 0.12], [Math.cos(i * 1.57) * 0.5, 0, -Math.sin(i * 1.57) * 0.5], 5); }
    if (f >= 3) B.tor('glow', SP, 0.2, 0.006, [0, 1.4, 0], [Math.PI / 2, 0.3, 0], 8);
    return { rad: 0.2, mid: 1.2 };
  },
  /** Segadora de Ecos: vara oscura con una hoja en media luna y esquirlas de espejo que orbitan. */
  guadana(B, c, f) {
    const VO = 0x241638, VO2 = 0x6a50c0, GL = c.void;
    B.cyl('body', VO, 0.02, 0.024, 1.9, [0, 0.62, 0]); for (let i = 0; i < 4; i++) B.tor('body', VO2, 0.026, 0.007, [0, -0.2 + i * 0.07, 0], [Math.PI / 2, 0, 0], 6);
    B.oct('body', VO2, 0.045, [0, -0.38, 0], [1, 1.3, 1]);
    // la hoja: media luna que sale de la punta de la vara
    B.arc('body', VO2, (u) => [0.05 + Math.sin(u * 2.5) * 0.62, 1.52 + (1 - Math.cos(u * 2.5)) * 0.2 - u * 0.05, 0], 9, 0.05, 0.006, 4);
    B.plate('body', VO, [[0.0, 1.5], [0.28, 1.66], [0.5, 1.64], [0.64, 1.5], [0.7, 1.4], [0.56, 1.5], [0.32, 1.56], [0.0, 1.55]], 0.026, ZERO, ZERO, ONE, 0.006);
    B.arc('glow', GL, (u) => [0.06 + Math.sin(u * 2.5) * 0.63, 1.54 + (1 - Math.cos(u * 2.5)) * 0.2 - u * 0.05, 0.012], 9, 0.007, 0.003, 3);
    B.oct('glow', GL, 0.03, [0, 1.52, 0.02], [0.8, 1.2, 0.6]);
    for (let i = 0; i < 2 + f; i++) { const a = i * 1.9, y = 0.8 + i * 0.18; B.oct('body', VO2, 0.03, [Math.sin(a) * 0.1, y, Math.cos(a) * 0.1], [0.6, 1.6, 0.6], [a, 0, 0.3]); B.oct('glow', GL, 0.012, [Math.sin(a) * 0.1, y, Math.cos(a) * 0.1 + 0.02], [0.6, 1.6, 0.6]); }
    if (f >= 2) B.sph('mem', GL, 0.2, [0.32, 1.55, 0], [1, 1, 0.2], 6);
    if (f >= 3) for (let i = 0; i < 4; i++) B.oct('og', GL, 0.022, [Math.cos(i * 1.57) * 0.22, 1.5, Math.sin(i * 1.57) * 0.22], [0.6, 1.6, 0.6]);
    return { rad: 0.3, mid: 1.4 };
  },
};
/** Arco de la Aureola Quebrada (arma de disparo de Seraf). Marco de arma de disparo: apunta a −Z, la mano en el origen; el arco está en el plano XY. */
function arco(B, c, f) {
  const GD = 0xfff0b0, GD2 = 0xffc23a, WH = 0xfff8e0, GL = c.halo;
  const limb = (s) => { B.arc('body', GD2, (u) => [s * 0.02, 0.02 + u * 0.4, -0.05 * Math.sin(u * 3.0) - u * u * 0.08], 8, 0.018, 0.008, 4); B.cone('glow', WH, 0.012, 0.06, [s * 0.02, 0.44, -0.12], [Math.PI / 2 + 0.3, 0, 0], 4); };
  limb(1); B.arc('body', GD2, (u) => [0.02, -0.02 - u * 0.4, -0.05 * Math.sin(u * 3.0) - u * u * 0.08], 8, 0.018, 0.008, 4); B.cone('glow', WH, 0.012, 0.06, [0.02, -0.44, -0.12], [-Math.PI / 2 - 0.3, 0, 0], 4);
  B.cyl('body', 0x3a2a1c, 0.022, 0.022, 0.16, [0.02, 0, 0.0]); B.sph('glow', GL, 0.026, [0.02, 0.0, -0.04]);
  B.limb('glow', WH, [0.02, 0.44, -0.12], [0.02, 0.0, 0.05], 0.003, 0.003, 3); B.limb('glow', WH, [0.02, 0.0, 0.05], [0.02, -0.44, -0.12], 0.003, 0.003, 3);
  for (let i = 0; i < 3 + f * 2; i++) { const s = i % 2 ? 1 : -1, y = (i + 1) * 0.07 * s; B.oct('body', GD, 0.016, [0.02, y, -0.05 - Math.abs(y) * 0.1], [0.6, 1.5, 0.6], [0, 0, 0.3]); }
  B.limb('glow', GD, [0.02, 0, 0.05], [0.02, 0, -0.55], 0.007, 0.002, 4); B.cone('glow', WH, 0.016, 0.09, [0.02, 0, -0.62], [-Math.PI / 2, 0, 0], 4);
  if (f >= 1) B.arc('glow', GL, (u) => [0.036, 0.42 - u * 0.84, -0.06 - 0.05 * Math.sin(u * 3.14)], 10, 0.005, 0.003, 3);
  if (f >= 2) B.sph('mem', GL, 0.22, [0.02, 0, -0.08], [0.2, 1.6, 1], 6);
  if (f >= 3) B.tor('glow', GL, 0.44, 0.005, [0.02, 0, -0.1], [0, Math.PI / 2, 0], 10);
  return { rad: 0.3, mid: 0 };
}
const mixc = (a, b, u) => mixHex(a, b, u);

/** Ids de los modelos propios (el resto reutiliza melee-models.js con el tinte del material). */
export const MODELO_PROPIO = { gemelas_axioma: 'gemelas', colmillos_luna: 'garras', baculo_raiz: 'baculo', guadana_umbra: 'guadana', arco_aureola: 'arco' };
/** Colores de cada arma firma para efectos de golpe y estela: { c, a }. */
export const ITEM_FX = {
  gemelas_axioma: { c: 0xffcf8a, a: 0xff5a22, name: 'cruz' }, colmillos_luna: { c: 0xe8f0ff, a: 0xff5a7a, name: 'garras' }, baculo_raiz: { c: 0x9bff4a, a: 0xffb0e0, name: 'raices' },
  guadana_umbra: { c: 0xb98cff, a: 0x40ffc0, name: 'media_luna' }, arco_aureola: { c: 0xfff0b0, a: 0xffc23a, name: 'luz' },
};
/** Color de efecto de cualquier objeto con arma (los no firma toman el de su material). */
export const fxOf = (id) => ITEM_FX[id] || (ITEMS[id] ? { c: MATERIALS[ITEMS[id].mat].glow, a: MATERIALS[ITEMS[id].mat].color, name: 'generico' } : null);

/**
 * Modelo 3D de un arma de objeto. opts: { phase 0..3, quality, side 'R'|'L' (espadas/garras dobles), color (tinte extra) }.
 * Devuelve { group, update(dt, t), setPhase(n), dispose(), info } con el empuñe en el origen y la hoja hacia +Y (armas de cuerpo a cuerpo).
 */
export function buildItemWeapon(THREE, itemId, opts = {}) {
  const it = ITEMS[itemId]; if (!it) throw new Error('Objeto desconocido: ' + itemId);
  const own = MODELO_PROPIO[itemId];
  if (!own && it.m) { // arma del catálogo viejo con el tinte de su material
    const m = buildMelee(THREE, it.m.model, { tier: Math.min(3, opts.phase | 0), quality: opts.quality || 'low', color: MATERIALS[it.mat].glow, aura: false });
    return { ...m, setPhase: (n) => m.setTier(Math.min(3, n | 0)), phase: opts.phase | 0 };
  }
  const quality = opts.quality || 'low', Sg = quality === 'low' ? 5 : quality === 'medium' ? 6 : 8, state = { phase: Math.max(0, Math.min(3, opts.phase | 0)), t: 0, dead: false, counts: { draws: 0, tris: 0 } };
  const group = new T.Group(); group.name = 'item-' + itemId; const root = new T.Group(); group.add(root);
  const mats = {
    body: new T.MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.5, flatShading: true }),
    glow: new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    mem: new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }),
    aura: new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }),
    cage: new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false, wireframe: true, toneMapped: false }),
  };
  let content = null, orbit = null;
  const pal = { gold: 0xffcf8a, ember: 0xff5a22, moon: 0xcfe0ff, spore: 0xb8ff5a, void: 0xb98cff, halo: 0xffc23a };
  function build() {
    if (content) { root.remove(content); content.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    content = new T.Group(); orbit = new T.Group(); content.add(orbit); root.add(content);
    const B = makeBuilder(T, Sg), f = state.phase;
    if (own === 'arco') arco(B, pal, f); else MODELOS[own](B, pal, f, opts.side || 'R');
    state.counts = B.finish(mats, content, orbit);
  }
  build();
  const ph0 = (itemId.length * 1.37) % 6;
  function update(dt, t) {
    if (state.dead) return; state.t = t == null ? state.t + dt : t; const tm = state.t, f = state.phase, beat = uBeat.value;
    mats.glow.color.setScalar(VEIN_PHASE[f] * (0.75 + 0.35 * beat) + Math.sin(tm * 2.4 + ph0) * 0.06);
    mats.mem.opacity = 0.26 + f * 0.03 + 0.1 * beat; mats.cage.opacity = 0.2 + Math.sin(tm * 2.2 + ph0) * 0.06;
    if (orbit) { orbit.rotation.y = tm * (0.9 + f * 0.3); orbit.position.y = Math.sin(tm * 1.4) * 0.02; }
  }
  return {
    group, update, dispose() { state.dead = true; group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); for (const m of Object.values(mats)) m.dispose(); },
    setPhase(n) { n = Math.max(0, Math.min(3, n | 0)); if (n !== state.phase) { state.phase = n; build(); } }, get phase() { return state.phase; }, id: itemId, own,
    get info() { return { id: itemId, phase: state.phase, draws: state.counts.draws, tris: Math.round(state.counts.tris) }; },
  };
}

/**
 * Cuelga un arma de objeto de una mano/ancla y devuelve el modelo con su pivote. frame 'vm' (viewmodel: la hoja apunta a −Z) o 'host' (mano del cuerpo 3D).
 * opts: { phase, quality, side, size, offset:[x,y,z], rot:[x,y,z] (extra) }.
 */
export function mountItemWeapon(THREE, anchor, itemId, opts = {}) {
  const frame = opts.frame || 'vm', pivot = new T.Group(); pivot.name = 'item-anchor';
  const m = buildItemWeapon(THREE, itemId, opts), off = opts.offset || ZERO, size = opts.size || (frame === 'vm' ? 0.5 : 1);
  if (frame === 'vm') pivot.rotation.x = -Math.PI / 2; else pivot.rotation.x = Math.PI - 0.85;
  if (opts.rot) { pivot.rotation.x += opts.rot[0]; pivot.rotation.y += opts.rot[1]; pivot.rotation.z += opts.rot[2]; }
  pivot.position.set(off[0], off[1], off[2]); pivot.scale.setScalar(size); pivot.add(m.group); anchor.add(pivot);
  return { group: pivot, model: m, update: (dt, t) => m.update(dt, t), setPhase: (n) => m.setPhase(n), dispose() { m.dispose(); anchor.remove(pivot); } };
}

/**
 * Arma de disparo de objeto en el cuerpo (3.ª persona): cruzada a la espalda. El Arco de la Aureola lleva su modelo propio; las demás, un «injerto» orgánico del material.
 */
export function buildGunBack(THREE, itemId, opts = {}) {
  const it = ITEMS[itemId]; if (!it) throw new Error('Objeto desconocido: ' + itemId);
  const own = MODELO_PROPIO[itemId];
  if (own === 'arco') { const m = buildItemWeapon(THREE, itemId, opts); m.group.rotation.set(0, 0, 0); return m; }
  const group = new T.Group(), M = MATERIALS[it.mat], f = Math.max(0, Math.min(3, opts.phase | 0));
  const body = new T.MeshStandardMaterial({ color: M.color, roughness: 0.55, metalness: 0.15, flatShading: true }), glow = new T.MeshBasicMaterial({ color: M.glow, toneMapped: false });
  const stock = new T.Mesh(new T.BoxGeometry(0.07, 0.1, 0.62), body), core = new T.Mesh(new T.SphereGeometry(0.035 + 0.006 * f, 6, 5), glow), vein = new T.Mesh(new T.BoxGeometry(0.012, 0.012, 0.5), glow), tip = new T.Mesh(new T.ConeGeometry(0.03, 0.14, 5), body);
  core.position.set(0, 0.07, -0.08); vein.position.set(0, 0.056, -0.04); tip.rotation.x = -Math.PI / 2; tip.position.set(0, 0, -0.38); group.add(stock, core, vein, tip);
  return { group, update(dt, t) { glow.color.setScalar(VEIN_PHASE[f] * (0.75 + 0.35 * uBeat.value) + Math.sin(t * 2) * 0.05); }, setPhase() {}, dispose() { for (const o of [stock, core, vein, tip]) o.geometry.dispose(); body.dispose(); glow.dispose(); }, id: itemId, phase: f };
}

/**
 * «Injerto» orgánico para el arma de disparo en primera persona (viewmodel): piezas del material que crecen sobre el arma base. Cuelga del grupo del arma
 * (weapons-vm.js → setItemGun). Marco del arma: boca hacia −Z. ≤ 3 llamadas de dibujo.
 */
export function buildGunGraft(THREE, itemId, opts = {}) {
  const it = ITEMS[itemId]; if (!it) throw new Error('Objeto desconocido: ' + itemId);
  const own = MODELO_PROPIO[itemId];
  if (own === 'arco') { const m = buildItemWeapon(THREE, itemId, opts); m.group.scale.setScalar(1); return { ...m, replaces: true }; }
  const quality = opts.quality || 'low', Sg = quality === 'low' ? 5 : 6, M = MATERIALS[it.mat], f = Math.max(0, Math.min(3, opts.phase | 0));
  const group = new T.Group(); group.name = 'graft-' + itemId; const mats = { body: new T.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.5, flatShading: true }), glow: new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), mem: new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.28, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }) };
  const B = makeBuilder(T, Sg), C = M.color, D = M.dark, G = M.glow;
  // vena que corre por arriba del arma y un núcleo que late
  B.arc('glow', G, (u) => [Math.sin(u * 9) * 0.008, 0.075, -0.05 - u * 0.5], 10, 0.006, 0.003, 3); B.sph('glow', G, 0.022 + 0.005 * f, [0, 0.09, -0.12], ONE, 5);
  // placas del material sobre el cañón y crecimientos propios
  for (let i = 0; i < 2 + (it.r >= 2 ? 1 : 0); i++) B.box('body', i % 2 ? C : D, [0.05, 0.02, 0.1], [0, 0.065, -0.18 - i * 0.14], ZERO);
  switch (it.mat) {
    case 'hueso': for (let i = 0; i < 3 + f; i++) B.cone('body', C, 0.014, 0.06 + 0.01 * f, [(i % 2 ? 1 : -1) * 0.04, 0.05, -0.1 - i * 0.1], [0, 0, (i % 2 ? -1 : 1) * 1.1], 4); break;
    case 'quitina': for (let i = 0; i < 3; i++) B.box('body', i % 2 ? C : D, [0.07, 0.014, 0.07], [0, 0.085, -0.12 - i * 0.12], [0.1, 0, 0]); break;
    case 'raiz': B.arc('body', C, (u) => [Math.sin(u * 7) * 0.035, 0.0, -0.05 - u * 0.5], 10, 0.014, 0.01, 4); for (let i = 0; i < 2 + f; i++) B.cone('glow', 0x9bff4a, 0.02, 0.06, [Math.sin(i * 2) * 0.04, 0.06, -0.15 - i * 0.12], ZERO, 4); break;
    case 'cristal': for (let i = 0; i < 3 + f; i++) B.oct('body', mixHex(C, G, 0.3), 0.022, [(i % 2 ? 1 : -1) * 0.035, 0.05, -0.12 - i * 0.1], [0.6, 1.8, 0.6], [0, 0, (i % 2 ? -1 : 1) * 0.4]); break;
    case 'carne': for (let i = 0; i < 3 + f; i++) B.sph('body', i % 2 ? C : D, 0.026, [(i % 2 ? 1 : -1) * 0.03, 0.04, -0.1 - i * 0.1], [1, 0.8, 1.2], 5); break;
    case 'espora': for (let i = 0; i < 2 + f; i++) { B.cyl('body', D, 0.01, 0.012, 0.05, [(i % 2 ? 1 : -1) * 0.04, 0.06, -0.12 - i * 0.12]); B.sph('glow', G, 0.022, [(i % 2 ? 1 : -1) * 0.04, 0.095, -0.12 - i * 0.12], [1, 0.6, 1], 5); } break;
    case 'vacio': for (let i = 0; i < 3 + f; i++) B.oct('mem', G, 0.03, [(i % 2 ? 1 : -1) * 0.05, 0.04 + 0.02 * (i % 2), -0.1 - i * 0.1], [0.5, 1.6, 0.5], [0, 0, 0.3]); break;
    default: break;
  }
  const orbit = new T.Group(); group.add(orbit); const counts = B.finish(mats, group, orbit);
  return { group, update(dt, t) { mats.glow.color.setScalar(VEIN_PHASE[f] * (0.75 + 0.35 * uBeat.value) + Math.sin(t * 2.2) * 0.05); }, setPhase() {}, dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); for (const m of Object.values(mats)) m.dispose(); }, id: itemId, phase: f, info: counts, replaces: false };
}
