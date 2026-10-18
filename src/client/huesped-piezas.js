// CAJA DE HERRAMIENTAS DE PIEZAS para diseñar un Huésped sobre el kit (huesped-armor.js). Cada diseño (src/client/huesped/<id>.js) hace:
//   const t = tools(ak);            // atajos: t.V, t.spikeAt, t.seam, t.limb, t.ringAt, t.platePts, t.crackLine …
//   ak.both(() => { ak.add('metal', t.ringAt('upperarm01', 'lowerarm01', 0.3, 0.09, 0.03), 'upperarm01', { color: 0x777 }); });
// Convención de «segmento» (hueso a → hueso b): eje Y = a→b (hacia la mano / el pie), +Z = adelante, +X = hacia el CENTRO del cuerpo (medial).
import * as T from 'three';
import { G, X, fbm, rng } from './huesped-armor.js';

export const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** Rotación que lleva +Y a `dir`, con la curvatura (+Z local) hacia `toward`. */
export function basisQ(dir, toward = V(0, 0, 1)) {
  const y = dir.clone().normalize(); let z = toward.clone().addScaledVector(y, -toward.dot(y)); if (z.lengthSq() < 1e-6) z = V(1, 0, 0).addScaledVector(y, -y.x); z.normalize();
  const x = new T.Vector3().crossVectors(y, z); return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
}

export function tools(ak) {
  const low = ak.low, S = ak.s;
  /** Espina/cuerno: base en `base`, apunta a `dir`, largo len, radio r, curvatura `bend` (m) hacia `toward`. */
  function spikeAt(base, dir, len, r, bend = 0, toward = V(0, 0, 1), o = {}) {
    const g = G.spike(len, r, bend, { radial: S(5), tubular: S(6, 3), ...o }); return X(g, { q: basisQ(dir, toward), p: [base.x, base.y, base.z] });
  }
  /** Costura emisiva: tubo fino por los puntos (Vector3[]). */
  function seam(pts, r = 0.0035, o = {}) { return G.tube(pts, r, o.r1 ?? r, { radial: low ? 3 : 4, tubular: Math.max(4, pts.length * (low ? 2 : 4)), closeStart: true }); }
  /** Grieta irregular entre dos puntos (zigzag con ruido) — costura de brasa. */
  function crackLine(a, b, { n = 7, jag = 0.012, r = 0.003, seed = 1, lift = null } = {}) {
    const R = rng(seed), d = b.clone().sub(a), up = Math.abs(d.y) < 0.9 * d.length() ? V(0, 1, 0) : V(1, 0, 0), s1 = new T.Vector3().crossVectors(d, up).normalize(), s2 = new T.Vector3().crossVectors(d, s1).normalize(), pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, e = i === 0 || i === n ? 0 : 1, p = a.clone().lerp(b, t).addScaledVector(s1, (R() - 0.5) * jag * 2 * e).addScaledVector(s2, (R() - 0.5) * jag * 2 * e); if (lift) p.add(lift(p)); pts.push(p); }
    return seam(pts, r);
  }
  /** Coloca g (con Y = eje del segmento a→b, origen en el centro) en la fracción t del segmento. */
  const limb = (g, a, b, t, o = {}) => ak.onSeg(g, a, b, t, o);
  /** Aro (brazalete / banda) alrededor del segmento a→b en la fracción t: radio R (elíptico sx/sz), alto h, espesor th. */
  function ringAt(a, b, t, R, h = 0.03, th = 0.01, o = {}) {
    if (h <= 0.016) { const g = G.torus(R - th * 0.3, Math.max(th, h) * 0.55, 3, S(18, 8)); if (o.sx || o.sz) g.scale(o.sx ?? 1, 1, o.sz ?? 1); return ak.onSeg(g, a, b, t, { off: o.off || [0, 0, 0], r: o.r || [0, 0, 0] }); } // aro fino: sección triangular (barato)
    return ak.onSeg(G.band(R, h, th, { seg: S(18, 8), sx: o.sx ?? 1, sz: o.sz ?? 1, simple: low }), a, b, t, { off: o.off || [0, 0, 0], r: o.r || [0, 0, 0] });
  }
  /** Placa extruida con polígono 2D (x,y): simétrica si `sym` (se da media silueta x ≥ 0). */
  function platePts(half, sym = true) { if (!sym) return half; const out = half.slice(); for (let i = half.length - 1; i >= 0; i--) { const q = half[i]; if (q[0] !== 0) out.push([-q[0], q[1]]); } return out; }
  /** Cúpula (hombrera, rótula, casquete): perfil de revolución de radio R y alto H con borde (lip). */
  function dome(R, H, { lip = 0.1, seg = S(18, 8), flat = 0, crease = 0 } = {}) {
    const pts = [[R, -R * lip * 0.4], [R * 1.02, R * lip * 0.4]]; const n = S(6, 3);
    for (let i = 1; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push([R * Math.cos(a) * (1 - flat * a * 0.3), R * lip * 0.4 + (H - R * lip * 0.4) * Math.sin(a)]); }
    return G.lathe(pts, seg, 0, Math.PI * 2, crease);
  }
  /** Perfil de lathe «cascarón» con espesor (para bandas cónicas: grebas, brazales): radios r0 (a) y r1 (b), alto h. */
  const cuff = (r0, r1, h, th = 0.008, seg = S(14, 7), crease = 0) => G.lathe(low ? [[r0 - th, -h / 2], [r0, -h / 2], [r1, h / 2], [r1 - th, h / 2], [r0 - th, -h / 2]] : [[r0 - th, -h / 2], [r0, -h / 2], [(r0 + r1) / 2 + 0.002, 0], [r1, h / 2], [r1 - th, h / 2], [(r0 + r1) / 2 - th, 0], [r0 - th, -h / 2]], seg, 0, Math.PI * 2, crease);
  /** Puntos sobre un arco: centro c, radio r, ángulos a0..a1 en el plano (eje u, eje v). */
  function arcPts(c, u, v, r, a0, a1, n = 8) { const out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push(c.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r)); } return out; }
  /** Hueso rugoso: roca desplazada, aplastada y alargada (placas de hueso, nudos, vértebras). */
  const bonelump = (r, s = [1, 1, 1], seed = 0, amp = 0.28) => G.rock(r, { detail: low ? 1 : 2, amp, freq: 2.6, s, seed });
  /** Fila de remaches sobre un arco. */
  function rivetArc(c, u, v, r, a0, a1, n, rr = 0.005) { const pts = []; for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (n === 1 ? 0.5 : i / (n - 1)); const p = c.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r); pts.push([p.x, p.y, p.z]); } return G.rivets(pts, rr, low ? 4 : 5); }
  /** Línea cerrada (anillo) que recorre un polígono 2D (x,y) algo más chico que el borde: filete de brasa/oro sobre una placa. z = altura sobre la placa. */
  function outline(pts, { inset = 0.12, z = 0, r = 0.0028 } = {}) {
    let cx = 0, cy = 0; for (const q of pts) { cx += q[0]; cy += q[1]; } cx /= pts.length; cy /= pts.length;
    const ring = pts.map((q) => V(cx + (q[0] - cx) * (1 - inset), cy + (q[1] - cy) * (1 - inset), z));
    const c = new T.CatmullRomCurve3(ring, true, 'catmullrom', 0.15);
    return G.tube(null, r, r, { radial: low ? 3 : 4, tubular: Math.max(low ? 8 : 12, pts.length * (low ? 1.5 : 5)) | 0, curve: c, closeStart: false });
  }
  /** PLACA DE ARMADURA completa: extruida con bisel (+ filete de brasa/oro opcional), curvada (wrap: {rx, rz}) y colocada (place(g) la mueve al hueso). Devuelve la geometría de la placa. */
  function armorPlate(bone, pts, o = {}) {
    const depth = o.depth ?? 0.02, bevel = o.bevel ?? depth * 0.34, plate = G.plate(pts, depth, bevel, { crease: o.crease ?? 38 });
    const fin = (g) => { let r = g; if (o.wrap) r = G.wrapE(r, o.wrap.rx, o.wrap.rz ?? o.wrap.rx); if (o.place) r = o.place(r) || r; return r; };
    const pg = fin(plate); ak.add(o.mat || 'metal', pg, bone, { color: o.color });
    if (o.trim && !(low && (o.lowSkip || o.trim === 'gold'))) { const tg = fin(outline(pts, { inset: o.trimInset ?? 0.12, z: depth / 2 + (o.trimR ?? 0.0028) * 0.2, r: o.trimR ?? 0.0028 })); ak.add(o.trim === 'gold' ? 'gold' : 'ember', tg, bone, { color: o.trimColor ?? (o.trim === 'gold' ? undefined : 0xff7a22) }); }
    return pg;
  }
  /** Caja: redondeada en Media/Alta; plana (12 triángulos) en Baja. */
  const blade = (len, w, th, o = {}) => G.blade(len, w, th, { n: low ? 4 : 8, ...o });
  const box = (w, h, d, r, seg = 1) => (low ? new T.BoxGeometry(w, h, d) : G.box(w, h, d, r, seg));
  return { V, ak, outline, armorPlate, box, blade, spikeAt, seam, crackLine, limb, ringAt, platePts, dome, cuff, arcPts, bonelump, rivetArc, basisQ, G, X, fbm, rng, TAU, S, low };
}
