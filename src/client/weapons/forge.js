// La Armería: fábrica común y piezas reutilizables de las armas 0..14 (Haz … Eclipse).
// Todo el código visible está en español. Coordenadas del arma: origen en la empuñadura, x derecha, y arriba, z NEGATIVO hacia la boca.
//
// Anclas para las manos (otro agente las dibuja con hands.js): `group.userData.grip` = [x,y,z] del centro de la empuñadura y
// `group.userData.fore` = [x,y,z] del centro del guardamano (o null si el arma es de una mano). Las manos se arman con
// rightHand(k, gh, hex) y supportHand(k, centro, radio, hex) usando las mismas medidas: el guardamano es un tubo de ese radio.
//
// Paleta por arma (palette): grafito (dk) + metal de cañón (gm) + color dominante del arma (dom/dom2) + metal claro (lt) + acento
// complementario (acc). Regla de la biblia: 1 dominante + 1 acento + 1 neutro oscuro; el emisivo sólo donde la pieza HACE algo.
import * as THREE from 'three';
import { Kit, makeMats, AmmoScreen } from './kit.js';
import { VIEWS } from './compose.js';
import { rightHand, triggerFinger, supportHand, trigCurl, bindTrigger } from './hands.js';

export const WEAPON_COLORS = [0x66ffee, 0xff8fd0, 0xffd34a, 0xff7a45, 0xa98bff, 0x5fd0ff, 0xff4fd8, 0xffa030, 0xc8ff4a, 0xff5a5a, 0x7aa8ff, 0xb050ff, 0x40ffc0, 0x6aff6a, 0x9060ff,
  0x66aaff, 0x9fe8ff, 0x7dff4a, 0xff7a1a, 0xffd23f, 0xff5a7a, 0xb98cff, 0x66ffcc, 0xe8d8ff, 0xff66c4]; // 15..24: voltaico, glaciar, plaga, brasa, mina, sierra, pulsar, dardos, requiem, quimera
export const WEAPON_LABELS = ['HAZ', 'PRISMA', 'RÁFAGA', 'NOVA', 'AGUJA', 'PULSO', 'GEMELAS', 'SOLAR', 'FRACTAL', 'ENJAMBRE', 'COMETA', 'VÓRTICE', 'LANZA', 'CETRO', 'ECLIPSE', 'VOLTAICO', 'GLACIAR', 'PLAGA', 'BRASA', 'MINA', 'SIERRA', 'PULSAR', 'DARDOS', 'REQUIEM', 'QUIMERA'];

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
export const easeInOut = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export const PI = Math.PI;
/** Resorte amortiguado (culatazos, correderas), con subpasos estables. */
export class Spring {
  constructor(k, c) { this.x = 0; this.v = 0; this.k = k; this.c = c; }
  step(dt) { let n = Math.max(1, Math.ceil(dt / 0.006)); const h = dt / n; while (n--) { this.v += (-this.k * this.x - this.c * this.v) * h; this.x += this.v * h; } return this.x; }
}
/** Color en HSL (sRGB) → hex. */
export const hsl = (h, s, l) => new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l, THREE.SRGBColorSpace).getHex();
export const hueOf = (hex) => { const o = {}; new THREE.Color(hex).getHSL(o, THREE.SRGBColorSpace); return o.h; };

export const GRAPH = 0x0e0c14, STEEL = 0x8a90b4, PALE = 0xd0d6ff;
/** Paleta de un arma a partir de su color canon. */
export function palette(hex, post = false) {
  const h = hueOf(hex), k = post ? 0.68 : 1, warm = h > 0.0 && h < 0.17 ? 1.4 : 1; // los naranjas/amarillos oscuros se ven marrones: se suben de valor // con post-proceso (Media/Alta) la exposición es casi el doble: los valores bajan para no lavarse
  return {
    hex, dk: post ? 0x050408 : 0x08070c, gm: hsl(h, 0.4, 0.13 * k), gm2: hsl(h, 0.4, 0.07 * k), gm3: hsl(h, 0.35, 0.21 * k), dom: hsl(h, 0.95, Math.min(0.56, 0.4 * k * warm)), dom2: hsl(h, 0.9, Math.min(0.34, 0.25 * k * warm)), dom3: hsl(h, 0.95, Math.min(0.66, 0.55 * k * warm)),
    lt: hsl(h, 0.3, 0.6 * k), st: post ? 0x5e6482 : 0x8a90b4, pale: post ? 0x9aa0cc : 0xd0d6ff, acc: hsl(h + 0.5, 0.9, 0.5 * k), acc2: hsl(h + 0.33, 0.85, 0.45 * k),
  };
}

/* ═══════════════════════════ piezas reutilizables (todas dentro del Kit) ═══════════════════════════ */

/** Empuñadura con estrías, tira de energía, correa trasera y guardamonte. Mide lo mismo que stdGrip (zc 0, d 0.112, hw 0.022) para que las manos calcen. */
export function grip(k, P, top, { len = 0.17, trig = true, vein = true, guard = true } = {}) {
  const low = k.q.low;
  k.prof('b', [[-0.07, top], [0.042, top], [0.036, top - len], [-0.09, top - len + 0.004], [-0.092, top - len * 0.55]], 0.044, 0, { c: P.gm2, bevel: 0.004 });
  k.prof('b', [[-0.08, top - 0.01], [-0.052, top - 0.012], [-0.062, top - len + 0.006], [-0.088, top - len + 0.008]], 0.05, 0, { c: P.dk, bevel: 0.003 });  // correa trasera (más ancha)
  if (!low) for (let i = 0; i < 6; i++) k.box('b', [0.047, 0.0035, 0.1 - i * 0.003], [0, top - 0.02 - i * 0.022, 0.0125 + i * 0.002], { c: P.dk, rad: 0.001 }); // estrías
  k.cbox('b', [0.006, len * 0.7, 0.07], [-0.0235, top - len * 0.5, 0.0], { c: P.dom2, ch: 0.0015 });                                 // panel lateral izquierdo
  if (vein) k.box('l', [0.004, len * 0.55, 0.012], [-0.0268, top - len * 0.52, -0.012], { k: 0 });
  k.cbox('b', [0.054, 0.014, 0.12], [0, top - len - 0.003, 0.0], { c: P.gm, ch: 0.004 });                                          // talón
  if (guard) k.prof('b', [[0.14, top], [0.14, top - 0.046], [0.0, top - 0.046], [0.0, top], [0.012, top], [0.012, top - 0.032], [0.128, top - 0.032], [0.128, top]], 0.03, 0, { c: P.gm, bevel: 0.003 });
  if (trig) k.cbox('b', [0.012, 0.034, 0.012], [0, top - 0.02, -0.07], { c: P.pale, r: [0.25, 0, 0], ch: 0.003 });
  return { zc: 0.0, top: top - 0.002, d: 0.112, hw: 0.022 };
}

/** Placa angular de armadura pegada a un costado: pts = [[u (hacia la boca), v (arriba)], ...] en el plano del costado, x = posición lateral. */
export function plate(k, pts, x, c, w = 0.005, o = {}) { return k.prof('b', pts, w, x, { c, bevel: 0.0018, ...o }); }
/** Reduce un polígono hacia su centro (f<1). */
export function inset(pts, f = 0.8) { const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length; return pts.map(([u, v]) => [cx + (u - cx) * f, cy + (v - cy) * f]); }
/** Armadura escalonada: placa base + placa interior más oscura (con calcomanía opcional) a cada costado. sx = -1 izq, 1 der; xo = distancia al eje. */
export function armor(k, P, sx, pts, xo, { c, c2, dec = 0, w = 0.005, f = 0.84, step = true } = {}) {
  if (!step) return plate(k, pts, sx * xo, c ?? P.dom, w, { u: dec });
  plate(k, pts, sx * xo, c2 ?? P.dom2, w);                                                   // marco oscuro
  plate(k, inset(pts, f), sx * (xo + 0.0032), c ?? P.dom, w, { u: dec });                   // placa clara con calcomanía
}
/** Franja de acento (color complementario) entre dos puntos (u,v) del costado. */
export function stripe(k, P, sx, xo, a, b, th = 0.004, c) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * th / 2, ny = dx / l * th / 2;
  plate(k, [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], sx * xo, c ?? P.acc, 0.003, { bevel: 0.0008 });
}
/** Tira de luz (vena) entre dos puntos z (en el costado, altura y). */
export function piping(k, sx, xo, y, z0, z1, kind = 0, h = 0.004) { k.box('l', [0.003, h, Math.abs(z1 - z0)], [sx * xo, y, (z0 + z1) / 2], { k: kind }); }

/** Calcomanías procedurales del shader (se pasan como `u`): */
export const DEC = { aviso: 1, perforado: 2, nervadura: 3, circuito: 4, runas: 5, rombos: 6 };

/** Culata esquelética: perfil con hueco, almohadilla y cristal. u hacia atrás (negativo). */
export function stock(k, P, { z0 = 0.17, len = 0.32, top = 0.07, bot = -0.11, w = 0.045, gem: g = true, c } = {}) {
  const u0 = -z0, u1 = u0 - len, low = k.q.low;
  k.prof('b', [[u0, top], [u1 + 0.02, top - 0.035], [u1, top - 0.06], [u1, bot], [u1 + 0.08, bot - 0.02], [u1 + 0.17, -0.04], [u0 - 0.03, -0.03], [u0, -0.01]], w, 0, { c: c ?? P.gm, bevel: 0.005,
    holes: [[[u0 - 0.04, top - 0.03], [u1 + 0.05, top - 0.055], [u1 + 0.045, bot + 0.04], [u1 + 0.13, -0.035], [u0 - 0.07, -0.025]]] });
  k.cbox('b', [0.05, Math.abs(top - bot) * 0.9, 0.012], [0, (top + bot) / 2 - 0.01, -u1 + 0.006], { c: P.dom2, ch: 0.004 });                  // almohadilla
  if (g) k.gem('l', [0.02, 0.07], [0, (top + bot) / 2 + 0.0, -(u0 + u1) / 2 - 0.02], { k: 1, n: 6, axis: 'z', tip: 0.3 });                   // cristal en el hueco
  if (!low) for (let i = 0; i < 3; i++) k.box('l', [0.004, 0.006, 0.05], [-0.0235, top - 0.045 - i * 0.012, -(u0 + u1) / 2 + i * 0.01], { k: 3 });
}

/** Culatas alternativas: 'tubo' (tubo amortiguador + culatín con calcomanía), 'plegable' (marco de barras) o 'bloque' (culata sólida biselada con ventana de cristal). */
export function stock2(k, P, style, { z0 = 0.17, len = 0.28, top = 0.07, bot = -0.1, w = 0.046, c } = {}) {
  const low = k.q.low, u0 = -z0, uE = -(z0 + len), mid = (top + bot) / 2, cc = c ?? P.gm;
  if (style === 'tubo') {
    k.cyl('b', [0.026, 0.026, len * 0.82], [0, top - 0.05, z0 + len * 0.41], { c: P.gm3, seg: low ? 8 : 10 });
    for (let i = 0; i < 3; i++) k.cyl('b', [0.03, 0.03, 0.012], [0, top - 0.05, z0 + len * (0.12 + i * 0.22)], { c: P.dk, seg: low ? 8 : 10 });
    k.prof('b', [[u0 - len * 0.78, top - 0.01], [uE, top - 0.03], [uE - 0.01, bot + 0.01], [u0 - len * 0.8, bot + 0.03]], w + 0.004, 0, { c: P.dom2, bevel: 0.006, u: DEC.rombos });
    k.cbox('b', [0.034, 0.02, len * 0.5], [0, top - 0.015, z0 + len * 0.34], { c: P.dk, ch: 0.005 });
    k.limb('b', [0, -0.02, z0 * 0.7], [0, bot + 0.04, z0 + len * 0.82], 0.01, 0.009, { c: P.gm3, seg: 6 });
  } else if (style === 'plegable') {
    for (const [a, b2] of [[[top - 0.012, 0], [top - 0.03, len]], [[-0.008, 0.02], [bot + 0.01, len * 0.96]]]) k.limb('b', [0, a[0], z0 + a[1]], [0, b2[0], z0 + b2[1]], 0.011, 0.011, { c: P.gm3, seg: 6, ball: !low });
    k.limb('b', [0, top - 0.03, z0 + len], [0, bot + 0.01, z0 + len * 0.96], 0.012, 0.012, { c: P.gm3, seg: 6 });
    k.cbox('b', [0.05, Math.abs(top - bot) * 0.8, 0.014], [0, mid - 0.01, z0 + len + 0.004], { c: P.dom2, ch: 0.004, u: DEC.rombos });
    k.gem('l', [0.012, 0.04], [0, mid - 0.01, z0 + len * 0.55], { k: 1, n: 5, axis: 'z', tip: 0.3 });
  } else { // bloque
    k.prof('b', [[u0, top], [uE + 0.03, top - 0.02], [uE, top - 0.05], [uE, bot + 0.02], [uE + 0.06, bot], [u0 - len * 0.5, -0.05], [u0, -0.02]], w, 0, { c: cc, bevel: 0.007 });
    k.prof('b', [[u0 - 0.05, top - 0.03], [uE + 0.06, top - 0.045], [uE + 0.04, mid + 0.01], [u0 - 0.08, mid + 0.02]], w + 0.006, 0, { c: P.dom2, bevel: 0.004, u: DEC.nervadura });
    k.cbox('b', [0.05, Math.abs(top - bot) * 0.9, 0.012], [0, mid - 0.01, -uE + 0.006], { c: P.dk, ch: 0.004 });
  }
}

/** Cañón/carcasa octogonal con bandas de color y ranuras de ventilación. */
export function shroud(k, P, z0, z1, y, r, { c, band = true, vents: vn = 4, bandC, step = 0.06 } = {}) {
  k.loft('b', [{ z: z0, w: r * 2, h: r * 2, y, ch: r * 0.38 }, { z: z1, w: r * 2, h: r * 2, y, ch: r * 0.38 }], { c: c ?? P.gm, edge: 1.5 });
  if (band) { const n = Math.min(Math.floor(Math.abs(z0 - z1) / step), k.q.low ? 4 : 9); for (let i = 0; i < n; i++) { const zc = z0 + (z1 - z0) * ((i + 0.5) / n); k.loft('b', [{ z: zc + 0.006, w: r * 2.2, h: r * 2.2, y, ch: r * 0.4 }, { z: zc - 0.006, w: r * 2.2, h: r * 2.2, y, ch: r * 0.4 }], { c: bandC ?? P.dk }); } }
}

/** Riel de accesorios con muescas. */
export function rail(k, P, y, z0, z1, w = 0.03, step = 0.026) {
  k.cbox('b', [w, 0.008, Math.abs(z1 - z0)], [0, y, (z0 + z1) / 2], { c: P.dk, ch: 0.002 });
  const n = Math.floor(Math.abs(z1 - z0) / step), s = z0 > z1 ? -1 : 1;
  const lim = k.q.low ? Math.min(n, 8) : n, st = Math.abs(z1 - z0) / Math.max(1, lim);
  for (let i = 0; i < lim; i++) k.box('b', [w + 0.004, 0.005, st * 0.45], [0, y + 0.0055, z0 + s * (i + 0.5) * st], { c: P.gm, sharp: true });
}

/** Mira holográfica de cristal: base, marco, lente de cristal y retícula emisiva. */
export function holo(k, P, [x, y, z], s = 1) {
  k.cbox('b', [0.05 * s, 0.012 * s, 0.07 * s], [x, y + 0.006 * s, z], { c: P.gm, ch: 0.003 });
  for (const sx of [-1, 1]) k.cbox('b', [0.006 * s, 0.05 * s, 0.05 * s], [x + sx * 0.022 * s, y + 0.036 * s, z], { c: P.dk, ch: 0.002 });
  k.cbox('b', [0.05 * s, 0.008 * s, 0.05 * s], [x, y + 0.064 * s, z], { c: P.dom2, ch: 0.002 });
  k.cbox('l', [0.036 * s, 0.04 * s, 0.003 * s], [x, y + 0.036 * s, z - 0.018 * s], { k: 1, ch: 0.002 });         // lente (cristal)
  k.cbox('l', [0.006 * s, 0.006 * s, 0.004 * s], [x, y + 0.036 * s, z - 0.02 * s], { k: 2 });                      // punto de la retícula
}

/** Aletas de disipador en fila (sobre el eje z). */
export function fins(k, P, n, [x, y, z], [w, h, d], step, c, axis = 'z') {
  for (let i = 0; i < n; i++) k.cbox('b', [w, h, d], axis === 'z' ? [x, y, z - i * step] : [x, y - i * step, z], { c: c ?? P.dk, ch: Math.min(w, h, d) * 0.25 });
}

/** Tornillos/remaches pequeños (en Baja se omiten). */
export function bolts(k, P, list, axis = 'x', r = 0.0045) { if (k.q.low) return; for (const p of list) k.cyl('b', [r, r, 0.004], p, { axis, seg: 6, c: P.st }); }

/** Pantalla de munición con marco oscuro biselado. Devuelve la descripción para placeScreen. side = -1 (izquierda) o 0 (arriba, inclinada hacia el tirador). */
export function screenAt(k, P, [x, y, z], side = -1, w = 0.07, h = 0.04, sc = 1.2, tilt = 0.3) {
  if (side === 0) { // arriba, mirando al tirador
    k.cbox('b', [w, 0.006, h], [x, y, z], { c: P.dk, r: [tilt, 0, 0], ch: 0.002 });
    return { pos: [x, y + 0.003, z], rot: [-PI / 2 + tilt + 0.0, 0, 0], scale: sc };
  }
  k.cbox('b', [0.006, h, w], [x, y, z], { c: P.dk, r: [0, tilt - 0.0, 0], ch: 0.002 });
  return { pos: [x - 0.0035, y, z], rot: [0, -PI / 2 + tilt, 0], scale: sc };
}

/** Anillo con dientes de cristal (se gira como una pieza). */
export function crownRing(k, P, c, R, n, { tube = 0.005, gemR = 0.008, kind = 0, rot = [0, 0, 0] } = {}) {
  k.at(c, rot, () => {
    k.tor('l', [R, tube], [0, 0, 0], { k: kind, seg: n * 2 });
    for (let i = 0; i < n; i++) { const a = i * PI * 2 / n; k.gem('l', [gemR, gemR * 1.7], [Math.cos(a) * R, Math.sin(a) * R, 0], { k: 1, n: 4, axis: 'y', r: [0, 0, a - PI / 2 + PI] }); }
  });
}

/* ═══════════════════════════ fábrica ═══════════════════════════ */

/**
 * Crea un arma. S = { muzzle, eject, flash:{shape,size,decay}, recoil:{z,y,pitch,roll,k,c}, view:{pos,scale,zs,rot}, heat, kv, cool, bdec,
 *   build(k, G, hands) → { gh, pivot, fore, screen:{on,pos,rot,scale} }, anim(P, st, dt, t, firing, G, W), fire(P, st, ctx, G, W) }.
 * Devuelve { group, muzzle, eject, flash, recoil, view, update(dt,t,firing,ctx), fire(ctx), setAmmo(n,max), dispose() }.
 */
export function forge(index, q, hands, S) {
  const hex = WEAPON_COLORS[index], k = new Kit(q), mats = makeMats(q, hex), scr = new AmmoScreen(hex, WEAPON_LABELS[index]), group = new THREE.Group();
  const G = { hex, k, mats, scr, q, heat: 0, boost: 0, ammo: 1, P: palette(hex, !q.low), low: q.low, high: q.high };
  const st = { t: 0, curl: 0, kick: new Spring(S.kk?.[0] ?? 180, S.kk?.[1] ?? 14), pulse: 0, rot: 0, seq: -9, ctx: null, side: 0, n: 0, s1: new Spring(500, 24), s2: new Spring(500, 24), t0: 9, firing: false, w: 0 };
  k.part('main');
  const info = S.build(k, G, hands) || {};
  if (hands && info.gh) { k.part('trigger', info.pivot); triggerFinger(k, info.gh, info.pivot, info.reach ?? 0.03); }
  const P = {}; for (const n of Object.keys(k.parts)) { P[n] = k.build(n, mats); group.add(P[n]); P[n].userData.base = P[n].position.clone(); } bindTrigger(P);
  if (info.screen) { const m = scr.mesh, sc = info.screen; m.position.set(...sc.pos); m.rotation.set(...sc.rot); m.scale.setScalar(sc.scale || 1.2); (P[sc.on || 'main'] || group).add(m); }
  if (info.gh) group.userData.grip = [0, info.gh.top - 0.05, info.gh.zc];
  group.userData.fore = info.fore || null;
  const W = {
    group, muzzle: S.muzzle, eject: S.eject || null, flash: S.flash, recoil: S.recoil, view: VIEWS[index] ? JSON.parse(JSON.stringify(VIEWS[index])) : S.view,
    update(dt, t, firing, ctx) {
      if (ctx) st.ctx = ctx;
      st.t = t; st.firing = !!firing; st.kick.step(dt); st.t0 += dt; G.heat = Math.max(0, G.heat - dt * (S.cool ?? 0.4)); G.boost = Math.max(0, G.boost - dt * (S.bdec ?? 6));
      st.curl = Math.max(st.curl - dt * 8, firing ? 0.3 : 0); st.pulse = Math.max(0, st.pulse - dt * 3);
      trigCurl(P, st.curl);
      S.anim && S.anim(P, st, dt, t, firing, G, W);
      mats.set(t, G.heat, st.seq, G.ammo, G.boost); scr.update(t);
    },
    fire(ctx) { G.heat = Math.min(1, G.heat + (S.heat ?? 0.4)); G.boost = 1; st.curl = 1; st.pulse = 1; st.kick.v += S.kv ?? 1; st.ctx = ctx || st.ctx; st.t0 = 0; st.n++; S.fire && S.fire(P, st, ctx, G, W); },
    setAmmo(n, max) { scr.set(n, max); G.ammo = Number.isFinite(n) && Number.isFinite(max) && max > 0 ? clamp(n / max, 0, 1) : 1; },
    dispose() { mats.dispose(); scr.dispose(); group.traverse((o) => { if (o.isMesh && o.geometry && o !== scr.mesh) o.geometry.dispose(); }); },
    mats, G, P, st,
  };
  return W;
}

/** Humo/chispas en la boca: n bocanadas hacia adelante. */
export const puffs = (ctx, hex, z, n = 3, y = 0.04, o = {}) => { if (ctx) for (let i = 0; i < n; i++) ctx.puff([0, y, z], [(Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3 + 0.05, -0.4], hex, { size: 0.09, grow: 0.3, life: 0.4, alpha: 0.4, ...o }); };
/** Casquillo de cristal que sale por el costado. */
export const casing = (ctx, hex, p, v = [1, 1.1, 0.5], s = 0.8) => { if (ctx) ctx.shard(p, v, hex, s); };
