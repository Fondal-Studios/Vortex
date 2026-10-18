// MUTACIONES de los Huéspedes: lo que cada CAMINO de evolución (`pth`, EVO_PATHS de data.js) y cada ASPECTO REGIONAL (mapa) agregan al cuerpo.
// Se dibujan DENTRO del mismo constructor del cuerpo (huespedes-view.js → opts.mutate) para no sumar llamadas de dibujo: las piezas se unen a las
// articulaciones que ya existen. Cada pieza toma la paleta del Huésped (`pal`) y sus puntos de anclaje (`anchors`), de modo que la misma mutación se ve
// «hecha del mismo material»: garras de hueso en Axioma, de cristal fantasma en Vesper, de raíz en Micelio, de espejo en Umbra, de luz en Seraf.
//
//   Nivel 1  depredador → garras y espinas de cuello        | coraza → placas de armadura superpuestas
//   Nivel 2  velocidad  → tendones de luz y estelas         | resonancia → núcleo enorme con anillos y runas
//   Nivel 3  simbiosis  → brazo fundido y simbionte vivo     | artilleria → cañones de cristal en los hombros y la espalda
//   Nivel 4  apoteosis  → alas de luz y aureola quebrada     | anomalia → grietas de vacío y esquirlas negras en órbita
//
// applyMutations(P, J, host, { path:[ids], region }) → anim(t, k)  (movimiento propio de las piezas nuevas; k = { open, ext })
import { feather } from './huespedes-limbo.js';
const TAU = Math.PI * 2;
const FLESH = 0xb0485a, FLESH2 = 0xe58a8a, VOID = 0x08040f;

/** Regiones (mapa → folclore del lugar). `color` tiñe el borde de luz, los brillos y las partículas del Huésped. */
export const REGIONS = {
  m1: { name: 'Vacío de Islas', color: 0x9fe8ff, orn: 'astros', note: 'constelaciones que orbitan la cabeza' },
  m2: { name: 'Cámara Fractal', color: 0xff5a9e, orn: 'geoda', note: 'esquirlas de geoda que brotan de hombros y espalda' },
  m3: { name: 'Laberinto Celestial', color: 0xffb050, orn: 'runas', note: 'anillos de runas que giran en la cintura' },
  m4: { name: 'Jardín de Carne', color: 0xff7ab0, orn: 'flores', note: 'flores-ojo y zarcillos en hombros y brazos' },
  m5: { name: 'Limbo', color: 0xbfd8ff, orn: 'velos', note: 'velos de ectoplasma que cuelgan de los brazos' },
  m6: { name: 'Limbo', color: 0xe8d8ff, orn: 'velos', note: 'velos de ectoplasma que cuelgan de los brazos' },
};
export const DEFAULT_PATH = ['coraza', 'resonancia', 'simbiosis', 'apoteosis'];
/** Camino elegido en cada nivel (1..evo): lo de `pth` si es válido; si no, la primera opción de ese nivel. */
export function pathIds(evo, pth, EVO_PATHS) {
  const out = []; for (let i = 1; i <= evo; i++) { const opts = (EVO_PATHS && EVO_PATHS[i]) || [], id = pth && pth[i - 1]; out.push(opts.some((o) => o.id === id) || (!EVO_PATHS && id) ? id : DEFAULT_PATH[i - 1]); } return out;
}

export function applyMutations(P, J, host, { path = [], region = null } = {}) {
  const A = host.anchors, pal = host.pal, s = A.s || 1, anims = [], has = (id) => path.includes(id);
  const at = (name, parent, pos = [0, 0, 0]) => P.joint(name, parent, pos);
  const tor = J.torso, head = J.head, sh = A.sh, hand = A.hand;
  const SX = [-1, 1];
  const claw = (j, x, y, z, L, col, glowCol) => { P.tube(j, 'body', col, [[x, y, z], [x * 1.3, y - 0.07 * L, z + 0.07 * L], [x * 1.5, y - 0.2 * L, z + 0.18 * L], [x * 1.45, y - 0.34 * L, z + 0.2 * L]], 0.018 * s, 0.003, 4); P.tube(j, 'glow', glowCol, [[x, y - 0.02, z + 0.01], [x * 1.3, y - 0.08 * L, z + 0.08 * L], [x * 1.5, y - 0.2 * L, z + 0.18 * L]], 0.005 * s, 0.002, 3); };

  /* ───────── nivel 1 ───────── */
  if (has('depredador')) {
    for (const sd of SX) { const f = sd > 0 ? J.foreR : J.foreL; for (let i = 0; i < 4; i++) claw(f, (i - 1.5) * 0.034 * s, hand[1] - 0.02, hand[2] + 0.05, 1.5 * s, pal.light, pal.hot); }
    for (let i = 0; i < 7; i++) { const u = i / 6; P.cone(tor, 'body', pal.rim, 0.032 * s, (0.26 - u * 0.1) * s, [0, A.back[1] + 0.2 - u * 0.5 * s * 0.8, A.back[2] - 0.02 - (A.quad ? -u * 0.6 : u * 0.02)], [-1.0 + (A.quad ? 0.6 : 0), 0, 0], 5); P.cone(tor, 'glow', pal.hot, 0.008 * s, 0.2 * s, [0, A.back[1] + 0.22 - u * 0.4 * s, A.back[2] - 0.03], [-1.0, 0, 0], 3); }
    for (const sd of SX) for (let i = 0; i < 2; i++) P.cone(head, 'body', pal.light, 0.022 * s, 0.18 * s, [A.head[0] + 0.09 * sd, A.head[1] - 0.04 - i * 0.04, A.head[2] - 0.02 - i * 0.05], [0.5, 0, -1.2 * sd], 4);
  }
  if (has('coraza')) {
    for (const sd of SX) {
      for (let i = 0; i < 3; i++) { const k = 1 - i * 0.2, x = sd * (sh[0] + 0.05 + i * 0.06 * s), y = sh[1] + 0.1 - i * 0.045 * s; P.lump(tor, 'body', i === 1 ? pal.rim : pal.main, 0.2 * s * k, [x, y, sh[2]], [1.55, 0.2, 1.2], 8, 0.05, 4 + i + sd, [0, 0, -sd * (0.18 + i * 0.22)]); P.tube(tor, 'glow', pal.glow, [[x - sd * 0.12 * s * k, y - 0.01, sh[2] + 0.2 * s * k], [x + sd * 0.2 * s * k, y - 0.03 - i * 0.03, sh[2] + 0.04], [x - sd * 0.12 * s * k, y - 0.01, sh[2] - 0.2 * s * k]], 0.006 * s, 0.006 * s, 3); }
      for (let q = 0; q < 2; q++) P.cone(tor, 'body', pal.light, 0.03 * s, (0.22 - q * 0.06) * s, [sd * (sh[0] + 0.26 * s), sh[1] + 0.05 - q * 0.07, sh[2] + (q - 0.5) * 0.12], [0, 0, -sd * 1.35], 5);
    }
    P.lump(tor, 'body', pal.main, 0.2 * s, [A.chest[0], A.chest[1], A.chest[2] + 0.04], [1.0, 1.15, 0.42], 8, 0.05, 11); P.blade(tor, 'body', pal.rim, [0, A.chest[1] - 0.17 * s, A.chest[2] + 0.1], [0, A.chest[1] + 0.2 * s, A.chest[2] + 0.12], 0.07 * s, 0.035); P.tube(tor, 'glow', pal.glow, [[-0.14 * s, A.chest[1] + 0.12 * s, A.chest[2] + 0.12], [0, A.chest[1] - 0.12 * s, A.chest[2] + 0.17], [0.14 * s, A.chest[1] + 0.12 * s, A.chest[2] + 0.12]], 0.007 * s, 0.007 * s, 3);
    for (let i = 0; i < 4; i++) P.lump(tor, 'body', i % 2 ? pal.main : pal.rim, 0.15 * s - i * 0.012, [0, A.back[1] + 0.18 - i * 0.12 * s, A.back[2] - 0.03 - (A.quad ? -i * 0.2 : 0)], [1.5, 0.4, 0.9], 6, 0.05, i);
    for (const sd of SX) { const f = sd > 0 ? J.foreR : J.foreL; P.tube(f, 'body', pal.main, [[0, -0.05 * s, 0.0], [0, -0.2 * s, 0.03], [0, -0.34 * s, 0.03]], 0.075 * s, 0.07 * s, 7, pal.rim); P.tor(f, 'glow', pal.glow, 0.075 * s, 0.006, [0, -0.2 * s, 0.03], [Math.PI / 2, 0, 0], 7); }
  }

  /* ───────── nivel 2 ───────── */
  if (has('velocidad')) {
    for (const sd of SX) { const a = sd > 0 ? J.armR : J.armL, f = sd > 0 ? J.foreR : J.foreL; P.tube(a, 'glow', pal.glow, [[0.05 * s * sd, 0.02, 0.05 * s], [0.07 * s * sd, -0.18 * s, 0.06 * s], [0.05 * s * sd, -0.34 * s, 0.05 * s]], 0.009 * s, 0.006 * s, 4, pal.light); P.tube(f, 'glow', pal.glow, [[0.05 * s * sd, -0.02, 0.05 * s], [0.06 * s * sd, -0.2 * s, 0.06 * s], [0.04 * s * sd, -0.36 * s, 0.05 * s]], 0.008 * s, 0.005 * s, 4, pal.light); }
    const st = at('xStreak', tor, [0, sh[1], sh[2]]);
    for (const sd of SX) for (let i = 0; i < 2; i++) { const x = sd * (sh[0] + i * 0.02), rows = 6, Ar = [], Br = []; for (let r = 0; r < rows; r++) { const u = r / (rows - 1); Ar.push([x, -i * 0.12 * s + Math.sin(u * 3 + i) * 0.04 * u, -u * 1.2 * s - 0.1]); Br.push([x + sd * 0.05 * s * (1 - u), -i * 0.12 * s - 0.05 * s * (1 - u) + Math.sin(u * 3 + i + 1) * 0.04 * u, -u * 1.2 * s - 0.1]); } P.sheet(st, 'mem', pal.glow, Ar, Br, 1, pal.light); }
    for (const sd of SX) for (let i = 0; i < 3; i++) P.blade(st, 'glow', pal.light, [sd * (0.15 + i * 0.12) * s, -0.2 * s - i * 0.05, -0.25 - i * 0.2], [sd * (0.17 + i * 0.12) * s, -0.2 * s - i * 0.05, -0.65 - i * 0.2], 0.03 * s, 0.01);
    if (A.legs) for (const sd of SX) P.tube(J.root, 'glow', pal.glow, [[sd * A.legs.x, A.legs.y0, A.legs.z], [sd * (A.legs.x + 0.03), (A.legs.y0 + A.legs.y1) / 2, A.legs.z + 0.05], [sd * A.legs.x, A.legs.y1, A.legs.z - 0.03]], 0.01 * s, 0.006 * s, 4, pal.light);
    anims.push((t, k) => { st.g.rotation.x = Math.sin(t * 5) * 0.06; for (const m of st.g.children) m.visible = true; void k; });
  }
  if (has('resonancia')) {
    const rg = at('xRes', tor, [A.chest[0], A.chest[1], A.chest[2] + 0.02]);
    P.ico(rg, 'glow', pal.light, 0.065 * s, [0, 0, 0.04], [1, 1.2, 0.8], [0, 0, 0], 1); P.lump(rg, 'mem', pal.glow, 0.2 * s, [0, 0, 0.04], [1, 1.2, 0.8], 7, 0.05, 3);
    const rings = []; for (let i = 0; i < 3; i++) { const j = at('xRing' + i, rg, [0, 0, 0.0]); P.tor(j, 'glow', i === 1 ? pal.hot : pal.glow, (0.2 + i * 0.07) * s, 0.0055 * s, [0, 0, 0], [0, 0, 0], 12); for (let r = 0; r < 4; r++) { const a = r * TAU / 4 + i; P.oct(j, 'body', pal.light, 0.022 * s, [Math.cos(a) * (0.2 + i * 0.07) * s, Math.sin(a) * (0.2 + i * 0.07) * s, 0], [0.7, 1.4, 0.5], [0, 0, a]); } rings.push(j); }
    anims.push((t, k) => { rings.forEach((j, i) => { j.g.rotation.x = t * (0.9 + i * 0.5) + i * 1.1; j.g.rotation.y = t * (0.6 - i * 0.3) + i; j.g.scale.setScalar(1 + k.open * 0.3); }); rg.g.scale.setScalar(1 + 0.08 * Math.sin(t * 3)); });
  }

  /* ───────── nivel 3 ───────── */
  if (has('simbiosis')) {
    for (const j of [J.armR, J.foreR]) { const L = j === J.armR ? 0.34 : 0.36; for (let i = 0; i < 3; i++) P.lump(j, 'body', i % 2 ? FLESH : FLESH2, (0.075 - i * 0.008) * s, [0.04 * s, -i * L / 3 * s - 0.04, 0.02 * s], [1, 1.5, 1], 7, 0.3, 3 + i); P.tube(j, 'glow', 0xff9aa8, [[0.09 * s, -0.02, 0.04], [0.1 * s, -L * 0.5 * s, 0.07 * s], [0.07 * s, -L * s, 0.05 * s]], 0.007 * s, 0.005 * s, 3, 0xffd0d8); }
    const sy = at('xSym', tor, [-sh[0] - 0.05, sh[1] + 0.14 * s, sh[2]]); P.lump(sy, 'body', FLESH, 0.12 * s, [0, 0.0, 0], [1, 0.85, 1.1], 8, 0.25, 6); P.lump(sy, 'mem', FLESH2, 0.16 * s, [0, 0, 0], [1, 0.85, 1.1], 8, 0.25, 6); P.sph(sy, 'glow', 0xffffff, 0.04 * s, [0, 0.03 * s, 0.1 * s], [1, 1, 0.7], 7); P.sph(sy, 'body', 0x1a0710, 0.018 * s, [0, 0.03 * s, 0.135 * s], [1, 1, 0.6], 5);
    const tents = []; for (let i = 0; i < 4; i++) { const tj = at('xTent' + i, sy, [(i - 1.5) * 0.06 * s, -0.04 * s, 0.02]); P.tube(tj, 'body', FLESH, [[0, 0, 0], [0.03 * s, -0.12 * s, 0.05 * s], [-0.02 * s, -0.26 * s, 0.08 * s], [0.03 * s, -0.4 * s, 0.1 * s]], 0.026 * s, 0.004 * s, 5, FLESH2); P.sph(tj, 'glow', 0xffc0c8, 0.012 * s, [0.03 * s, -0.4 * s, 0.1 * s], [1, 1, 1], 4); tents.push(tj); }
    anims.push((t) => { tents.forEach((j, i) => { j.g.rotation.x = Math.sin(t * 2.2 + i) * 0.3; j.g.rotation.z = Math.cos(t * 1.7 + i * 1.3) * 0.3; }); sy.g.scale.setScalar(1 + 0.06 * Math.sin(t * 3.1)); });
  }
  if (has('artilleria')) {
    const cn = []; for (const sd of SX) { const c = at('xCan' + sd, tor, [sd * (sh[0] + 0.02), sh[1] + 0.22 * s, sh[2] - 0.05]); P.cyl(c, 'body', pal.dark, 0.045 * s, 0.06 * s, 0.42 * s, [0, 0, 0.18 * s], [Math.PI / 2, 0, 0], 8); P.cyl(c, 'mem', pal.glow, 0.05 * s, 0.065 * s, 0.4 * s, [0, 0, 0.18 * s], [Math.PI / 2, 0, 0], 8);
      for (let i = 0; i < 3; i++) P.tor(c, 'body', pal.main, 0.06 * s, 0.012 * s, [0, 0, (0.05 + i * 0.13) * s], [0, 0, 0], 8); P.sph(c, 'glow', pal.light, 0.032 * s, [0, 0, 0.4 * s], [1, 1, 1.2], 6); P.lump(c, 'body', pal.main, 0.075 * s, [0, 0, -0.02], [1, 1, 1.2], 6, 0.1, 3);
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3; P.oct(c, 'glow', pal.glow, 0.03 * s, [Math.cos(a) * 0.1 * s, Math.sin(a) * 0.1 * s, 0.3 * s], [0.7, 1.6, 0.7], [0, 0, a]); } cn.push(c); }
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.32; P.oct(tor, 'mem', pal.glow, 0.07 * s, [Math.sin(a) * 0.22 * s, A.back[1] + 0.28 * s + Math.cos(a) * 0.05, A.back[2] - 0.05], [0.7, 2.3, 0.7], [0, 0, -a]); P.oct(tor, 'glow', pal.light, 0.022 * s, [Math.sin(a) * 0.22 * s, A.back[1] + 0.28 * s + Math.cos(a) * 0.05, A.back[2] - 0.05], [0.7, 2.3, 0.7], [0, 0, -a]); }
    anims.push((t, k) => { cn.forEach((c, i) => { c.g.rotation.x = -0.1 - k.open * 0.35 + Math.sin(t * 1.5 + i) * 0.03; }); });
  }

  /* ───────── nivel 4 ───────── */
  if (has('apoteosis')) {
    const wings = [];
    for (const sd of SX) { const w = at('xWing' + sd, tor, [sd * 0.1 * s, A.back[1] + 0.12 * s, A.back[2] - 0.04]); w.rest = [0, 0.3 * sd, 0.15 * sd];
      for (let l = 0; l < 2; l++) for (let i = 0; i < 4; i++) { const u = i / 3, L = (1.55 - l * 0.4) * s * (0.6 + 0.4 * Math.sin((u * 0.8 + 0.2) * Math.PI)), ang = 1.0 - u * 1.8 - l * 0.12, y0 = -l * 0.1 * s, tip = [Math.cos(ang) * L * sd, y0 + Math.sin(ang) * L * 0.9, -0.15 - l * 0.05], mid = [tip[0] * 0.5, y0 + tip[1] * 0.5 + 0.1, tip[2] * 0.7];
        feather(P, w, 'mem', l === 0 ? pal.glow : pal.light, l === 1 ? pal.hot : pal.glow, [0, y0, 0], mid, tip, 0.17 * s * (1 - l * 0.25)); if (l === 0) P.tube(w, 'glow', pal.hot, [[0, y0, 0], mid, tip], 0.007 * s, 0.002, 3, pal.light); }
      wings.push(w); }
    const hl = at('xHalo', head, [A.head[0], A.head[1] + 0.34 * s, A.head[2] - 0.12]), arcs = [[0.2, 3.4], [3.8, 5.6]]; arcs.forEach(([a0, a1], i) => { const pts = []; for (let q = 0; q <= 7; q++) { const a = a0 + (a1 - a0) * q / 7; pts.push([Math.cos(a) * 0.32 * s, Math.sin(a) * 0.32 * s * 0.0 + 0.0, Math.sin(a) * 0.0]); } P.tube(hl, 'glow', i ? pal.hot : pal.light, pts.map((p, q) => [p[0], Math.sin((a0 + (a1 - a0) * q / 7)) * 0.32 * s, 0]), 0.014 * s, 0.01 * s, 5); });
    P.tor(hl, 'mem', pal.glow, 0.32 * s, 0.045 * s, [0, 0, 0], [0, 0, 0], 12);
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.3; P.blade(tor, 'mem', pal.light, [Math.cos(a) * 0.25 * s, A.back[1] + 0.3 + Math.sin(a) * 0.25 * s, A.back[2] - 0.2], [Math.cos(a) * (1.1 + (i % 2) * 0.4) * s, A.back[1] + 0.3 + Math.sin(a) * (1.1 + (i % 2) * 0.4) * s, A.back[2] - 0.3], 0.06 * s, 0.01); }
    anims.push((t, k) => { wings.forEach((w, i) => { const sd = i ? 1 : -1; w.g.rotation.z = w.rest[2] + sd * (Math.sin(t * 1.5) * 0.12 + k.open * 0.6); w.g.rotation.y = w.rest[1] - sd * k.open * 0.7 * 0; }); hl.g.rotation.z = Math.sin(t * 0.6) * 0.15; hl.g.rotation.y = t * 0.4; });
  }
  if (has('anomalia')) {
    for (let i = 0; i < 9; i++) { const sd = i % 2 ? 1 : -1, u = Math.floor(i / 2) / 4, p = [sd * (0.1 + u * 0.16) * s, A.back[1] + 0.34 * s - u * 0.55 * s, A.back[2] - 0.06 - u * 0.02]; P.cone(tor, 'body', VOID, 0.05 * s, (0.3 - u * 0.1) * s, p, [-0.8, 0, -sd * (0.5 + u * 0.4)], 4); P.cone(tor, 'glow', pal.hot, 0.011 * s, (0.26 - u * 0.1) * s, [p[0], p[1] + 0.01, p[2] - 0.012], [-0.8, 0, -sd * (0.5 + u * 0.4)], 3); }
    for (const sd of SX) for (let i = 0; i < 3; i++) { const u = i / 2; P.cone(tor, 'body', VOID, 0.04 * s, (0.2 + u * 0.14) * s, [sd * (sh[0] + 0.02 + u * 0.05), sh[1] + 0.16 + u * 0.06, sh[2] + (i - 1) * 0.07], [0.3 * (i - 1), 0, -sd * (1.0 + u * 0.4)], 4); }
    for (let i = 0; i < 4; i++) { const k = i - 1.5; P.tube(tor, 'glow', pal.hot, [[k * 0.07 * s, A.chest[1] + 0.2 * s, A.chest[2] + 0.12], [k * 0.09 * s + 0.02, A.chest[1] + 0.04, A.chest[2] + 0.16], [k * 0.05 * s, A.chest[1] - 0.16 * s, A.chest[2] + 0.14]], 0.005 * s, 0.003 * s, 3); }
    const vd = at('xVoid', J.root, [0, 1.2 * s + 0.2, 0]); for (let i = 0; i < 7; i++) { const a = i * TAU / 7, r = (0.85 + (i % 3) * 0.2) * s, y = ((i % 4) - 1.5) * 0.28; P.oct(vd, 'body', VOID, 0.09 * s, [Math.cos(a) * r, y, Math.sin(a) * r], [0.6, 1.8, 0.6], [a, a * 0.7, 0.3 * i]); P.oct(vd, 'glow', pal.hot, 0.026 * s, [Math.cos(a) * r, y, Math.sin(a) * r], [0.6, 1.8, 0.6], [a, a * 0.7, 0.3 * i]); }
    anims.push((t, k) => { vd.g.rotation.y = -t * (0.5 + k.open); vd.g.position.y = 1.2 * s + 0.2 + Math.sin(t * 1.2) * 0.07; });
  }

  /* ───────── aspecto regional ───────── */
  const R = region && REGIONS[region];
  if (R) {
    if (R.orn === 'astros') { const o = at('xAstro', head, [A.head[0], A.head[1] + 0.25 * s, A.head[2]]); for (let i = 0; i < 6; i++) { const a = i * TAU / 6, r = 0.3 * s; P.oct(o, 'glow', R.color, 0.026 * s, [Math.cos(a) * r, Math.sin(i * 1.3) * 0.05, Math.sin(a) * r], [0.7, 1.3, 0.7], [a, a, 0]); if (i < 5) P.tube(o, 'glow', R.color, [[Math.cos(a) * r, Math.sin(i * 1.3) * 0.05, Math.sin(a) * r], [Math.cos(a + 0.5) * r, Math.sin((i + 1) * 1.3) * 0.05, Math.sin(a + 0.5) * r]], 0.003 * s, 0.003 * s, 3); } anims.push((t) => { o.g.rotation.y = t * 0.6; }); }
    else if (R.orn === 'geoda') { for (const sd of SX) for (let i = 0; i < 3; i++) { P.cone(tor, 'mem', R.color, 0.035 * s, (0.17 + i * 0.07) * s, [sd * (sh[0] + 0.0 + i * 0.03), sh[1] + 0.19 + i * 0.03, sh[2] - 0.02 + (i - 1) * 0.07], [0.35 * (i - 1), 0, -sd * (0.5 + i * 0.3)], 5); P.cone(tor, 'glow', 0xffffff, 0.008 * s, (0.16 + i * 0.06) * s, [sd * (sh[0] + i * 0.03), sh[1] + 0.19 + i * 0.03, sh[2] - 0.02 + (i - 1) * 0.07], [0.35 * (i - 1), 0, -sd * (0.5 + i * 0.3)], 3); } for (let i = 0; i < 4; i++) P.cone(tor, 'mem', R.color, 0.03 * s, (0.15 + (i % 2) * 0.08) * s, [(i - 1.5) * 0.08 * s, A.back[1] + 0.1, A.back[2] - 0.07], [-0.9, 0, (i - 1.5) * 0.2], 5); }
    else if (R.orn === 'runas') { const o = at('xRuna', J.root, [0, 1.0 * s + 0.05, 0]); P.tor(o, 'glow', R.color, 0.42 * s, 0.006, [0, 0, 0], [Math.PI / 2, 0, 0], 6); P.tor(o, 'glow', 0xffe0a0, 0.48 * s, 0.004, [0, 0, 0], [Math.PI / 2, 0, 0], 3); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; P.box(o, 'glow', R.color, [0.05 * s, 0.07 * s, 0.01], [Math.cos(a) * 0.45 * s, 0, Math.sin(a) * 0.45 * s], [0, -a + Math.PI / 2, 0.3 * i]); } anims.push((t) => { o.g.rotation.y = t * 0.5; o.g.position.y = 1.0 * s + 0.05 + Math.sin(t * 1.3) * 0.03; }); }
    else if (R.orn === 'flores') { for (const sd of SX) for (let i = 0; i < 2; i++) { const j = i ? (sd > 0 ? J.armR : J.armL) : tor, p = i ? [0.07 * s * sd, -0.12 * s, 0.07 * s] : [sd * (sh[0] + 0.04), sh[1] + 0.12 * s, sh[2] + 0.06]; P.lump(j, 'body', FLESH, 0.05 * s, p, [1, 1, 1], 7, 0.2, 4 + i); P.sph(j, 'glow', 0xffffff, 0.026 * s, [p[0], p[1], p[2] + 0.04 * s], [1, 1, 0.7], 6); P.sph(j, 'body', 0x2a0a18, 0.012 * s, [p[0], p[1], p[2] + 0.062 * s], [1, 1, 0.6], 4); for (let q = 0; q < 5; q++) { const a = q * TAU / 5; P.lump(j, 'mem', R.color, 0.03 * s, [p[0] + Math.cos(a) * 0.07 * s, p[1] + Math.sin(a) * 0.07 * s, p[2] - 0.005], [1, 1.5, 0.5], 5, 0.1, q, [0, 0, a]); } P.tube(j, 'body', FLESH, [p, [p[0] + 0.03, p[1] - 0.12 * s, p[2] - 0.02], [p[0] - 0.02, p[1] - 0.22 * s, p[2]]], 0.01 * s, 0.003, 4, FLESH2); } }
    else if (R.orn === 'velos') { for (const sd of SX) { const j = sd > 0 ? J.foreR : J.foreL, rows = 6, Ar = [], Br = []; for (let r = 0; r < rows; r++) { const u = r / (rows - 1); Ar.push([0.03 * sd * s, -0.1 - u * 0.9 * s, 0.03 + Math.sin(u * 3) * 0.05]); Br.push([0.03 * sd * s + sd * (0.14 + u * 0.1) * s, -0.1 - u * 0.9 * s - 0.1 * u, 0.03 + Math.sin(u * 3 + 1) * 0.06]); } P.sheet(j, 'mem', R.color, Ar, Br, 2, 0xffffff); } for (let i = 0; i < 3; i++) P.tube(head, 'mem', R.color, [[(i - 1) * 0.05 * s, A.head[1] - 0.02, A.head[2] + 0.1], [(i - 1) * 0.06 * s, A.head[1] - 0.2 * s, A.head[2] + 0.12], [(i - 1) * 0.07 * s, A.head[1] - 0.4 * s, A.head[2] + 0.1]], 0.012 * s, 0.003, 4); }
  }
  return (t, k) => { for (const f of anims) f(t, k); };
}
