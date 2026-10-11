// ARCANUM NPC FACTORY — piezas procedurales propias (sin assets externos).
// Las capas de tela, barbas, capuchas, guantes y botas se DERIVAN de la anatomía/ropa MakeHuman:
// copian su skinning, por eso siguen las animaciones compartidas sin un rig nuevo.
// Los accesorios rígidos (sombreros, cinturón, joyas) se agrupan por hueso y se fusionan para reducir draw calls.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { deformPoint, HEAD_CENTER } from './deform.js';
import { LAYERS, CAPES, HEADWEAR, STAFFS, BEARDS, AFFINITIES, GLOVES, fabricId } from './library.js';

const ARM = /^(upperarm|lowerarm|wrist|finger|metacarpal)/, HAND = /^(wrist|finger|metacarpal)/, LEG = /^(upperleg|lowerleg|foot|toe)/;
const TORSO = /^(spine|pelvis|clavicle|breast|neck01|shoulder01|root)/;
const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const col = (hex) => new T.Color(hex);

// ---------- texturas compartidas (canvas, sin archivos) ----------
let fabricTex = null, strandTex = null;
export function fabricTexture() {
  if (fabricTex || typeof document === 'undefined') return fabricTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#e2e2e2'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) for (let x = 0; x < 128; x += 2) { const v = 214 + ((x * 7 + y * 13) % 11) + ((x ^ y) & 7) * 2; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1 + ((x + y) & 1), 1); }
  for (let i = 0; i < 260; i++) { const v = 150 + (i * 37) % 60; g.fillStyle = `rgba(${v},${v},${v},.12)`; g.fillRect((i * 53) % 128, (i * 97) % 128, 1, 6 + (i % 9)); }
  fabricTex = new T.CanvasTexture(c); fabricTex.wrapS = fabricTex.wrapT = T.RepeatWrapping; fabricTex.colorSpace = T.SRGBColorSpace; fabricTex.anisotropy = 4;
  return fabricTex;
}
export function strandTexture() {
  if (strandTex || typeof document === 'undefined') return strandTex;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  // Mechones verticales finos que se repiten sin costura (se dibujan desplazados ±S). Primero los oscuros (fondo),
  // después los claros: la barba tiene profundidad en vez de rayas blancas parejas.
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 2600; i++) {
    const x = (i * 71.3 + pass * 37) % S, len = 22 + (i * 13) % 70, y = (i * 29.7) % S, v = pass ? 170 + (i * 31) % 85 : 120 + (i * 17) % 60;
    const a = pass ? 0.55 + ((i * 17) % 45) / 100 : 0.8, bend = ((i % 9) - 4) * 1.1;
    g.strokeStyle = `rgba(${v},${v},${v},${a})`; g.lineWidth = pass ? 0.8 + 0.6 * (i % 3 === 0) : 1.4;
    for (const dx of [0, -S, S]) for (const dy of [0, -S]) { g.beginPath(); g.moveTo(x + dx, y + dy); g.quadraticCurveTo(x + dx + bend, y + dy + len / 2, x + dx + bend * 0.4, y + dy + len); g.stroke(); }
  }
  strandTex = new T.CanvasTexture(c); strandTex.wrapS = strandTex.wrapT = T.RepeatWrapping; strandTex.colorSpace = T.SRGBColorSpace;
  return strandTex;
}

// ---------- constructor de geometría con skinning ----------
const DEFAULT_FAB = [4, 1];
class Skinned {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.si = []; this.sw = []; this.sway = []; this.f = []; this.idx = []; }
  get count() { return this.p.length / 3; }
  // fab = [id de tela, distancia (m) al borde de la prenda]: relieve, costuras y desgaste (src/npc/materials.js).
  vertex(p, n, uv, color, si, sw, sway = 0, alpha = 1, fab = DEFAULT_FAB) {
    this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.uv.push(uv[0], uv[1]); this.c.push(color.r, color.g, color.b, alpha);
    this.si.push(si[0], si[1], si[2], si[3]); this.sw.push(sw[0], sw[1], sw[2], sw[3]); this.sway.push(sway); this.f.push(fab[0], fab[1]); return this.count - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  geometry() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 4));
    g.setAttribute('skinIndex', new T.Uint16BufferAttribute(this.si, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(this.sw, 4));
    g.setAttribute('sway', new T.Float32BufferAttribute(this.sway, 1)); g.setAttribute('npcFab', new T.Float32BufferAttribute(this.f, 2)); g.setIndex(this.idx); g.computeBoundingSphere(); return g;
  }
}

// Perfil anatómico (cuerpo + ropa ya deformados): extensión del tronco/piernas por altura.
export function makeProfile(sources) {
  const bins = new Map(), key = (y) => Math.round(y / 0.02);
  for (const { pos, dominant } of sources) for (let i = 0; i < pos.length / 3; i++) {
    if (ARM.test(dominant[i])) continue;
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], k = key(y);
    let b = bins.get(k); if (!b) bins.set(k, b = { minX: 9, maxX: -9, minZ: 9, maxZ: -9, front: -9, back: 9 });
    b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x); b.minZ = Math.min(b.minZ, z); b.maxZ = Math.max(b.maxZ, z);
    if (Math.abs(x) < 0.06) { b.front = Math.max(b.front, z); b.back = Math.min(b.back, z); }
  }
  const at = (y) => { for (let d = 0; d < 6; d++) for (const s of [0, -1, 1]) { const b = bins.get(key(y) + s * d); if (b) return b; } return { minX: -0.15, maxX: 0.15, minZ: -0.1, maxZ: 0.12, front: 0.12, back: -0.1 }; };
  return { at, halfX: (y) => { const b = at(y); return Math.max(-b.minX, b.maxX); }, front: (y) => { const b = at(y); return b.front > -9 ? b.front : b.maxZ; }, back: (y) => { const b = at(y); return b.back < 9 ? b.back : b.minZ; } };
}

// Copia triángulos seleccionados de una malla con skinning y los desplaza por su normal.
function shell(out, src, { select, offset, color, sway = () => 0, alpha = () => 1, uvScale = 6, tela = null, edge = () => 1, uvShift = 0 }) {
  const fid = tela == null ? 4 : fabricId(tela);
  const n = src.pos.length / 3, map = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (select(i, src.pos[i * 3], src.pos[i * 3 + 1], src.pos[i * 3 + 2])) map[i] = -2;
  const idx = src.index;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2]; if (map[a] === -1 || map[b] === -1 || map[c] === -1) continue;
    const v = [a, b, c].map((i) => {
      if (map[i] >= 0) return map[i];
      const x = src.pos[i * 3], y = src.pos[i * 3 + 1], z = src.pos[i * 3 + 2], nx = src.nrm[i * 3], ny = src.nrm[i * 3 + 1], nz = src.nrm[i * 3 + 2], o = offset(i, x, y, z);
      const p = [x + nx * o, y + ny * o, z + nz * o];
      map[i] = out.vertex(p, [nx, ny, nz], [Math.atan2(x, z) / Math.PI * uvScale * 0.5 + uvShift, y * uvScale + uvShift * 0.37], typeof color === 'function' ? color(i, x, y, z) : color,
        [src.si[i * 4], src.si[i * 4 + 1], src.si[i * 4 + 2], src.si[i * 4 + 3]], [src.sw[i * 4], src.sw[i * 4 + 1], src.sw[i * 4 + 2], src.sw[i * 4 + 3]], sway(i, x, y, z), alpha(i, x, y, z), [fid, edge(i, x, y, z)]);
      return map[i];
    });
    out.tri(v[0], v[1], v[2]);
  }
}

// Superficie tubular abierta (faldas, capas, barba colgante): rings[k] = {y, pts:[[x,z],...], w:[si,sw]}
function loft(out, rings, { color, closed = true, uvScale = 4, tela = null, hem = false }) {
  const start = out.count, cols = rings[0].pts.length, fid = tela == null ? 4 : fabricId(tela), hemY = rings[rings.length - 1].y;
  rings.forEach((r, k) => {
    // Distancia al borde: a lo largo del anillo hasta la abertura (prendas abiertas) y hasta el dobladillo.
    const s = [0]; for (let j = 1; j < cols; j++) s.push(s[j - 1] + Math.hypot(r.pts[j][0] - r.pts[j - 1][0], r.pts[j][1] - r.pts[j - 1][1]));
    r.edge = s.map((d) => Math.min(closed ? 1 : Math.min(d, s[cols - 1] - d), hem ? Math.abs(r.y - hemY) : 1));
  });
  rings.forEach((r, k) => r.pts.forEach(([x, z], j) => {
    const nx = x, nz = z - (r.cz || 0), l = Math.hypot(nx, nz) || 1;
    const w = r.weights(x, z);
    out.vertex([x, r.y, z], [nx / l, 0, nz / l], [j / (cols - 1) * uvScale, r.y * uvScale], color, w[0], w[1], r.sway || 0, r.alpha ?? 1, [fid, r.edge[j]]);
  }));
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < cols - (closed ? 0 : 1); j++) {
    const j2 = (j + 1) % cols, a = start + k * cols + j, b = start + k * cols + j2, c = start + (k + 1) * cols + j, d = start + (k + 1) * cols + j2;
    out.tri(a, c, b); out.tri(b, c, d);
  }
}

const W1 = (bi, name) => [[bi[name] ?? 0, 0, 0, 0], [1, 0, 0, 0]];
function blend(bi, pairs) { // [[bone, weight], ...] → normalizado, máx. 4
  const list = pairs.filter(([b, w]) => bi[b] != null && w > 0.001).slice(0, 4), tot = list.reduce((s, [, w]) => s + w, 0) || 1;
  const si = [0, 0, 0, 0], sw = [0, 0, 0, 0]; list.forEach(([b, w], i) => { si[i] = bi[b]; sw[i] = w / tot; }); if (!list.length) { si[0] = bi.spine05_h; sw[0] = 1; } return [si, sw];
}

/**
 * Capas con skinning derivadas del cuerpo/ropa: túnica/abrigo, capa, capucha, guantes, botas, mandil.
 * body/outfit: {pos, nrm, index, si, sw, dominant} ya deformados con las proporciones del NPC.
 */
export function buildClothLayers({ def, body, outfit, bi, profile, palette, detail }) {
  const out = new Skinned(), layer = LAYERS[def.layer] || {}, cape = CAPES[def.cape] || {}, segs = [12, 16, 20, 28, 32][detail] || 20;
  const primary = col(palette.primario), secondary = col(palette.secundario), accent = col(palette.acento), leather = col(palette.cuero);
  const clothSrc = outfit || body;
  if (layer.torso) {
    const bell = layer.mangas === 'campana';
    shell(out, clothSrc, { color: primary, uvScale: 7, tela: layer.tela,
      select: (i, x, y) => (TORSO.test(clothSrc.dominant[i]) || /^(upperarm|lowerarm)/.test(clothSrc.dominant[i])) && y > 0.9 && y < 1.47,
      offset: (i, x, y) => { const d = clothSrc.dominant[i]; return 0.014 + (bell && /^lowerarm02/.test(d) ? 0.05 : bell && /^lowerarm01/.test(d) ? 0.022 : 0) + (y > 1.41 ? 0.006 : 0); } });
    // Falda/faldón: anillos desde la cadera hasta el dobladillo; ensanche suave y apertura frontal para abrigos.
    const top = 1.0, hem = Math.max(0.05, layer.falda), rows = Math.max(4, Math.round((top - hem) / 0.07)), gap = layer.abierta ? 0.2 : 0;
    const rings = [];
    let rx = 0, rzF = 0, rzB = 0;
    for (let k = 0; k <= rows; k++) {
      const t = k / rows, y = top - (top - hem) * t;
      const b = profile.at(y), flare = (top - y) * (layer.falda < 0.3 ? 0.11 : 0.05);
      rx = Math.max(rx, profile.halfX(y) + 0.035 + flare); rzF = Math.max(rzF, b.maxZ + 0.035 + flare * 0.6); rzB = Math.min(rzB, b.minZ - 0.035 - flare * 0.8);
      const cz = (rzF + rzB) / 2, rz = (rzF - rzB) / 2, pts = [];
      for (let j = 0; j <= segs; j++) { const a = gap + (Math.PI * 2 - 2 * gap) * j / segs; pts.push([Math.sin(a) * rx, cz + Math.cos(a) * rz]); }
      rings.push({ y, cz, pts, sway: t * t, weights: (x) => { const s = Math.min(1, Math.max(0, 0.5 + x / (2 * rx))), leg = 0.55 * smooth(t, 0.15, 1);
        return blend(bi, [['spine05_h', 1 - leg], [t > 0.55 ? 'lowerleg01_L_h' : 'upperleg01_L_h', leg * s], [t > 0.55 ? 'lowerleg01_R_h' : 'upperleg01_R_h', leg * (1 - s)]]); } });
    }
    loft(out, rings, { color: primary, closed: !gap, uvScale: 6, tela: layer.tela, hem: true });
    // Ribete de color secundario en el dobladillo (silueta legible a distancia).
    const last = rings[rings.length - 1], trim = { ...last, y: last.y + 0.035, pts: last.pts.map(([x, z]) => [x * 0.995, z * 0.995]) };
    loft(out, [trim, last], { color: secondary, closed: !gap, uvScale: 6, tela: layer.tela, hem: true });
  }
  if (layer.mandil) {
    const rows = 10, rings = [];
    for (let k = 0; k <= rows; k++) {
      const t = k / rows, y = 1.33 - t * 0.85, half = 0.12 + t * 0.07, f = profile.front(Math.max(y, 0.5)) + 0.03 + (y < 0.95 ? 0.02 * t : 0), pts = [];
      for (let j = 0; j <= 6; j++) { const u = -1 + 2 * j / 6; pts.push([u * half, f - u * u * 0.05]); }
      rings.push({ y, cz: f - 0.2, pts, sway: t * 0.5, weights: () => blend(bi, t < 0.35 ? [['spine01_h', 1 - t], ['spine03_h', t]] : [['spine05_h', 0.6], ['upperleg01_L_h', 0.2], ['upperleg01_R_h', 0.2]]) });
    }
    loft(out, rings, { color: leather.clone().lerp(primary, 0.35), closed: false, uvScale: 5, tela: layer.tela, hem: true });
  }
  if (cape.bajo != null && def.cape === 'esclavina') {
    // Esclavina: manto corto cerrado sobre hombros (cono suave), con skinning de tronco y clavículas.
    const rows = 8, rings = [], sh = Math.max(profile.halfX(1.36), 0.19) + 0.045;
    for (let k = 0; k <= rows; k++) {
      // Sube por el cuello, se abre sobre los hombros y cae casi vertical: manto, no pantalla de lámpara.
      const t = k / rows, y = 1.48 - t * 0.3, open = smooth(t, 0, 0.5), b = profile.at(Math.max(1.28, y)), cz = (b.maxZ + b.minZ) / 2 - 0.005;
      const rx = 0.08 + (sh - 0.08) * open + t * 0.015, rz = 0.075 + ((b.maxZ - b.minZ) / 2 + 0.03 - 0.075) * open + t * 0.01, pts = [];
      for (let j = 0; j <= segs; j++) { const a = Math.PI * 2 * j / segs; pts.push([Math.sin(a) * rx, cz + Math.cos(a) * rz]); }
      rings.push({ y, cz, pts, sway: t * 0.35, weights: () => blend(bi, t < 0.3 ? [['spine01_h', 0.6], ['neck01_h', 0.4]] : [['spine01_h', 0.7], ['clavicle_L_h', 0.15], ['clavicle_R_h', 0.15]]) });
    }
    loft(out, rings, { color: secondary, closed: true, uvScale: 5, tela: cape.tela, hem: true });
  } else if (cape.bajo != null) {
    const rows = Math.max(6, Math.round((1.43 - cape.bajo) / 0.08)), rings = [];
    for (let k = 0; k <= rows; k++) {
      const t = k / rows, y = 1.43 - (1.43 - cape.bajo) * t, half = Math.max(profile.halfX(Math.min(y, 1.38)), 0.19) + 0.03 + t * 0.12, back = Math.min(profile.back(Math.max(y, 0.4)), profile.back(1.0)) - 0.05 - t * 0.05, pts = [];
      for (let j = 0; j <= segs / 2; j++) { const u = -1 + 2 * j / (segs / 2); pts.push([u * half, back + u * u * (0.12 - t * 0.04)]); }
      rings.push({ y, cz: back + 0.3, pts, sway: t * t * 1.4, weights: () => blend(bi, t < 0.2 ? [['spine01_h', 0.7], ['clavicle_L_h', 0.15], ['clavicle_R_h', 0.15]] : [['spine01_h', 1 - t], ['spine05_h', t]]) });
    }
    loft(out, rings, { color: secondary.clone().lerp(primary, 0.3), closed: false, uvScale: 5, tela: cape.tela, hem: true });
  }
  if (def.hat === 'capucha') {
    const face = (x, y, z) => z > 0.045 && Math.abs(x) < 0.07 && y < 1.68;
    shell(out, body, { color: secondary, tela: HEADWEAR.capucha.tela, select: (i, x, y, z) => y > 1.46 && Math.abs(x) < 0.12 && !face(x, y, z) && !HAND.test(body.dominant[i]), offset: (i, x, y, z) => 0.05 + (z < 0.01 && y > 1.6 ? 0.025 : 0) });
    shell(out, clothSrc, { color: secondary, tela: HEADWEAR.capucha.tela, select: (i, x, y) => TORSO.test(clothSrc.dominant[i]) && y > 1.3 && y < 1.47, offset: (i, x, y) => 0.03 });
  }
  if (def.gloves && def.gloves !== 'ninguno') {
    const ritual = def.gloves === 'ritual', c = ritual ? secondary.clone().lerp(col('#111014'), 0.5) : leather;
    shell(out, body, { color: c, tela: GLOVES[def.gloves]?.tela || 'cuero', select: (i) => HAND.test(body.dominant[i]) || (ritual && /^lowerarm02/.test(body.dominant[i])), offset: () => 0.0035 });
  }
  if (def.boots && def.boots !== 'ninguna') {
    const topY = def.boots === 'botas' ? 0.46 : 0.36;
    // Caña de la bota sobre el pantalón (malla de ropa) y pie sobre el cuerpo: se ve «metido en la bota».
    const boot = leather.clone().multiplyScalar(0.8), legs = outfit && outfit.dominant.some((d, i) => /^lowerleg/.test(d) && outfit.pos[i * 3 + 1] < topY);
    if (legs) shell(out, outfit, { color: boot, tela: 'cuero', edge: (i, x, y) => Math.max(0, topY - y), select: (i, x, y) => /^lowerleg/.test(outfit.dominant[i]) && y < topY && y > 0.12, offset: (i, x, y) => 0.006 + 0.008 * smooth(y, topY - 0.08, topY) });
    shell(out, body, { color: boot, tela: 'cuero', edge: (i, x, y) => (legs ? 1 : Math.max(0, topY - y)), select: (i, x, y) => LEG.test(body.dominant[i]) && y < (legs ? 0.16 : topY), offset: (i, x, y) => 0.013 + 0.012 * smooth(y, 0.1, 0.3) });
  }
  return out.count ? out.geometry() : null;
}

/** Barba procedural: capas que siguen la piel (sin clipping) + parte colgante para barbas largas. */
export function buildBeard({ def, body, bi, profile, color, detail }) {
  const b = BEARDS[def.beard]; if (!b?.capas) return null;
  const strands = new Skinned(), base = new Skinned(), c = col(color), dark = c.clone().multiplyScalar(0.62), capas = new Set(b.capas), g = b.grosor;
  const inLayer = (x, y, z) => {
    const ax = Math.abs(x);
    if (capas.has('bigote') && y > 1.505 && y < 1.534 && ax < 0.04 && z > 0.118) return 0.8;
    if (capas.has('menton') && y > 1.425 && y < 1.5 && ax < 0.048 && z > 0.0 && !(ax < 0.027 && y > 1.486 && z > 0.125)) return 1;
    if (capas.has('mejillas') && y > 1.43 && ((y < 1.535 && ax > 0.03 && ax < 0.088 && z > -0.012) || (ax > 0.066 && ax < 0.088 && y < 1.585 && z > -0.012 && z < 0.07))) return 0.7;
    return 0;
  };
  // Distancia (en aristas) al borde de la región: los bordes se deshilachan en vez de cortar en seco.
  const n = body.pos.length / 3, sel = new Uint8Array(n), hop = new Uint8Array(n).fill(9), idx = body.index, P = body.pos;
  for (let i = 0; i < n; i++) { const y = P[i * 3 + 1]; if (y > 1.4 && Math.abs(P[i * 3]) < 0.1 && inLayer(P[i * 3], y, P[i * 3 + 2]) > 0) sel[i] = 1; }
  for (let t = 0; t < idx.length; t += 3) { const v = [idx[t], idx[t + 1], idx[t + 2]]; if (v.some((i) => sel[i]) && v.some((i) => !sel[i])) for (const i of v) if (sel[i]) hop[i] = 0; }
  for (let pass = 1; pass < 3; pass++) for (let t = 0; t < idx.length; t += 3) { const v = [idx[t], idx[t + 1], idx[t + 2]]; if (v.some((i) => hop[i] === pass - 1)) for (const i of v) if (sel[i] && hop[i] > pass) hop[i] = pass; }
  const density = (i) => [0.28, 0.62, 0.85][hop[i]] ?? 1;
  const select = (i) => sel[i] === 1, off = (i, x, y, z) => g * inLayer(x, y, z) + 0.0015;
  // Varias cáscaras de mechones (técnica de «pelaje por capas»): cada una más afuera, más clara y más rala → volumen
  // y puntas que se deshilachan, sin draw calls extra (van todas en la misma malla). 1 en Bajo, 2 en Medio, 3 en Alto/Ultra.
  const nShells = detail >= 3 ? 3 : detail >= 2 ? 2 : 1;
  for (let k = 0; k < nShells; k++) {
    const f = nShells === 1 ? 1 : 0.45 + 0.55 * k / (nShells - 1), tip = c.clone().lerp(col('#ffffff'), 0.06 * k).multiplyScalar(nShells === 1 ? 1 : 0.86 + 0.14 * k / (nShells - 1));
    shell(strands, body, { color: tip, uvScale: 22, select, offset: (i, x, y, z) => off(i, x, y, z) * f, alpha: (i) => density(i) * (1 - 0.16 * k), uvShift: k * 0.31 });
  }
  shell(base, body, { color: dark, select: (i) => sel[i] && hop[i] >= 1, offset: (i, x, y, z) => off(i, x, y, z) * 0.45 + 0.0008 });
  if (b.largo > 0) {
    const rows = Math.max(3, Math.round(b.largo / 0.03)), cols = [6, 8, 10, 12, 14][detail] || 10, rings = [];
    for (let k = 0; k <= rows; k++) {
      const t = k / rows, y = 1.47 - b.largo * t, half = 0.058 * (1 - t * 0.72), front = Math.max(profile.front(Math.min(y, 1.44)), 0.06) + 0.012 + g * 0.6, depth = (0.045 - 0.025 * t), pts = [];
      for (let j = 0; j <= cols; j++) { const a = -Math.PI / 2 + Math.PI * j / cols; pts.push([Math.sin(a) * half, front - depth + Math.cos(a) * depth + (y > 1.44 ? 0.03 * (y - 1.44) / 0.03 : 0)]); }
      rings.push({ y, cz: front - depth * 2, pts, sway: t * 0.3, alpha: 1 - 0.65 * smooth(t, 0.6, 1), weights: () => blend(bi, [['jaw_h', (1 - t) * 0.7], ['head_h', 0.3 + t * 0.2], ['spine01_h', t * 0.5]]) });
    }
    loft(strands, rings, { color: c, closed: false, uvScale: 6 });
    const inner = rings.slice(0, -1).map((r) => ({ ...r, alpha: 1, pts: r.pts.map(([x, z]) => [x * 0.86, z - 0.006]) }));
    loft(base, inner, { color: dark, closed: false, uvScale: 6 });
  }
  return { strands: strands.geometry(), base: base.count ? base.geometry() : null };
}

// ---------- accesorios rígidos ----------
const piece = (geo, color, matrix, tela = 'fieltro') => { if (matrix) geo.applyMatrix4(matrix); const n = geo.attributes.position.count, c = new T.Color(color), arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; } geo.setAttribute('color', new T.BufferAttribute(arr, 3)); const fa = new Float32Array(n * 2), fid = fabricId(tela); for (let i = 0; i < n; i++) { fa[i * 2] = fid; fa[i * 2 + 1] = 1; } geo.setAttribute('npcFab', new T.BufferAttribute(fa, 2)); if (!geo.index) { const idx = []; for (let i = 0; i < n; i++) idx.push(i); geo.setIndex(idx); } for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color', 'npcFab'].includes(k)) geo.deleteAttribute(k); return geo; };
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));

/**
 * Accesorios rígidos agrupados por hueso: {bone → {matte:[geo], metal:[geo], gem:[geo]}} en coordenadas del mundo en reposo.
 * actor.js los convierte al espacio local del hueso y fusiona cada grupo en una sola malla.
 */
export function buildRigid({ def, profile, palette, affinity, hairVisible, detail }) {
  const groups = {}, add = (bone, kind, geo) => { ((groups[bone] ||= { matte: [], metal: [], gem: [] })[kind]).push(geo); };
  const seg = [8, 12, 16, 24, 32][detail] || 16, primary = palette.primario, secondary = palette.secundario, accent = palette.acento, metal = palette.metal, leather = palette.cuero;
  const gem = affinity.gema;
  const [hx, hy, hz] = HEAD_CENTER, head = def.body.head || 1, hr = hairVisible ? 1.07 : 1.0;
  const crownY = hy + 0.062 * head + (hairVisible ? 0.012 : 0), rx = 0.096 * head * hr, rz = 0.112 * head * hr, cz = hz - 0.002;
  const hat = HEADWEAR[def.hat] || {};
  const ht = hat.tela || 'fieltro', ellipse = (geo, y) => piece(geo, primary, M(hx, y, cz, 0, 0, 0, rx / 0.1, 1, rz / 0.1), ht);
  if (def.hat === 'mago') {
    const pts = [], n = 10; for (let k = 0; k <= n; k++) { const t = k / n; pts.push(new T.Vector2(0.1 * Math.pow(1 - t, 1.25) + 0.004, t * hat.alto)); }
    const cone = new T.LatheGeometry(pts, seg); const p = cone.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = y / hat.alto; p.setZ(i, p.getZ(i) - 0.12 * t * t); p.setX(i, p.getX(i) + 0.02 * t * t); }
    // [puesta] el sombrero se asienta 2 cm más arriba y el ala se inclina HACIA ATRÁS (antes dormía 0,08 rad hacia adelante): con la
    // cabeza algo gacha del anciano el ala le tapaba los ojos en todos los planos de frente; así se le ve la cara bajo el ala.
    const alza = 0.02;
    cone.computeVertexNormals(); add('head_h', 'matte', ellipse(cone, crownY - 0.03 + alza));
    add('head_h', 'matte', piece(new T.CylinderGeometry(0.1 + hat.ala, 0.1 + hat.ala, 0.008, seg * 2), primary, M(hx, crownY - 0.03 + alza, cz, -0.1, 0, 0, rx / 0.1, 1, rz / 0.1), ht));
    add('head_h', 'matte', piece(new T.CylinderGeometry(0.101, 0.101, 0.03, seg), accent, M(hx, crownY - 0.01 + alza, cz, 0, 0, 0, rx / 0.1, 1, rz / 0.1), 'seda'));
  } else if (def.hat === 'ala-ancha' || def.hat === 'copa') {
    const copa = def.hat === 'copa', h = hat.alto;
    const alza = copa ? 0 : 0.02; // [puesta] el ala ancha se asienta 2 cm más arriba, algo menos caída y inclinada hacia atrás: no tapa los ojos
    add('head_h', 'matte', ellipse(new T.CylinderGeometry(copa ? 0.106 : 0.098, 0.1, h, seg), crownY - 0.03 + alza + h / 2));
    add('head_h', 'matte', ellipse(new T.CylinderGeometry(copa ? 0.106 : 0.09, copa ? 0.106 : 0.09, 0.006, seg), crownY - 0.03 + alza + h));
    const brim = new T.CylinderGeometry(0.1 + hat.ala, 0.1 + hat.ala, 0.007, seg * 2), bp = brim.attributes.position;
    for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), z = bp.getZ(i), r = Math.hypot(x, z); if (r > 0.12) bp.setY(i, bp.getY(i) + (copa ? 0.025 * Math.pow(Math.abs(x) / r, 3) : -0.007 * Math.pow(Math.abs(z) / r, 2)) * (r - 0.12) / hat.ala); }
    brim.computeVertexNormals(); add('head_h', 'matte', piece(brim, primary, M(hx, crownY - 0.03 + alza, cz, copa ? 0 : -0.1, 0, 0, rx / 0.1, 1, rz / 0.1), ht));
    add('head_h', 'matte', piece(new T.CylinderGeometry(0.1015, 0.1015, 0.022, seg), copa ? secondary : accent, M(hx, crownY - 0.015 + alza, cz, 0, 0, 0, rx / 0.1, 1, rz / 0.1), 'seda'));
  } else if (def.hat === 'boina') {
    add('head_h', 'matte', piece(new T.SphereGeometry(0.11, seg, seg / 2), primary, M(hx + 0.012, crownY + 0.012, cz - 0.01, 0, 0, 0.18, rx / 0.1 * 1.12, 0.38, rz / 0.1 * 1.05), ht));
    add('head_h', 'matte', piece(new T.TorusGeometry(0.1, 0.008, 6, seg), secondary, M(hx, crownY - 0.012, cz, Math.PI / 2, 0, 0, rx / 0.1, rz / 0.1, 1), ht));
  } else if (def.hat === 'birrete') {
    add('head_h', 'matte', piece(new T.CylinderGeometry(0.1, 0.1, 0.05, seg), primary, M(hx, crownY + 0.0, cz, 0, 0, 0, rx / 0.1, 1, rz / 0.1), ht));
    add('head_h', 'matte', piece(new T.BoxGeometry(0.29, 0.012, 0.29), primary, M(hx, crownY + 0.03, cz, 0, Math.PI / 4, 0), ht));
    add('head_h', 'metal', piece(new T.CylinderGeometry(0.004, 0.006, 0.11, 6), accent, M(hx + 0.13, crownY - 0.025, cz + 0.06)));
  } else if (def.hat === 'casquete') {
    add('head_h', 'matte', piece(new T.SphereGeometry(0.1, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI * 0.32), primary, M(hx, crownY - 0.05, cz - 0.01, 0, 0, 0, rx / 0.1 * 1.02, 1, rz / 0.1 * 1.02), ht));
  } else if (def.hat === 'diadema') {
    add('head_h', 'metal', piece(new T.TorusGeometry(0.1, 0.0045, 6, seg * 2), metal, M(hx, crownY - 0.045, cz, Math.PI / 2 + 0.22, 0, 0, rx / 0.1 * 1.01, rz / 0.1 * 1.01, 1)));
    add('head_h', 'gem', piece(new T.OctahedronGeometry(0.013), gem, M(hx, crownY - 0.06, cz + rz + 0.003, 0, 0, 0, 1, 1.4, 0.6)));
  }
  const acc = new Set(def.accessories || []);
  if (acc.has('gafas')) {
    for (const s of [-1, 1]) {
      add('head_h', 'metal', piece(new T.TorusGeometry(0.0175 * head, 0.0018, 5, seg), metal, M(s * 0.032 * head, 1.588, 0.164 + (head - 1) * 0.06)));
      add('head_h', 'metal', piece(new T.CylinderGeometry(0.0015, 0.0015, 0.1, 4), metal, M(s * 0.067 * head, 1.592, 0.115, Math.PI / 2, 0, 0)));
    }
    add('head_h', 'metal', piece(new T.CylinderGeometry(0.0015, 0.0015, 0.03, 4), metal, M(0, 1.593, 0.166, 0, 0, Math.PI / 2)));
  }
  // Cinturón y sus colgantes: elipse calculada sobre la ropa real (sin atravesarla).
  if (def.belt && def.belt !== 'ninguno') {
    const y = 0.985, pb = profile.at(y), bx = profile.halfX(y) - 0.002, bf = pb.maxZ + 0.01, bb = pb.minZ - 0.008, bcz = (bf + bb) / 2, brz = (bf - bb) / 2;
    const ring = new T.EllipseCurve(0, bcz, bx, brz, 0, Math.PI * 2), loop = new T.CatmullRomCurve3(ring.getPoints(seg * 2).slice(0, -1).map((p) => new T.Vector3(p.x, y, p.y)), true);
    add('spine05_h', 'matte', piece(new T.TubeGeometry(loop, seg * 3, 0.012, 4, true), leather, null, 'cuero'));
    add('spine05_h', 'metal', piece(new T.BoxGeometry(0.04, 0.032, 0.008), metal, M(0, y, bf + 0.004)));
    const side = (s, dy = -0.045) => [s * bx * 0.92, y + dy, bcz + brz * 0.25];
    if (def.belt === 'bolsas') for (const s of [-1, 1]) add('spine05_h', 'matte', piece(new T.BoxGeometry(0.06, 0.07, 0.035), leather, M(...side(s), 0, s * 0.35, 0), 'cuero'));
    if (def.belt === 'alquimia') for (let k = 0; k < 4; k++) { const a = -0.9 + k * 0.6, x = Math.sin(a) * bx, z = bcz + Math.cos(a) * brz + 0.01; add('spine05_h', 'gem', piece(new T.CylinderGeometry(0.012, 0.016, 0.06, 8), k % 2 ? gem : '#9bd06a', M(x, y - 0.04, z))); }
    if (acc.has('farol')) { add('spine05_h', 'metal', piece(new T.CylinderGeometry(0.025, 0.03, 0.075, 6), metal, M(-bx * 0.95, y - 0.09, bcz + 0.02))); add('spine05_h', 'gem', piece(new T.SphereGeometry(0.018, 8, 6), '#ffc874', M(-bx * 0.95, y - 0.09, bcz + 0.02))); }
    if (acc.has('frascos')) for (let k = 0; k < 2; k++) add('spine05_h', 'gem', piece(new T.SphereGeometry(0.02, 8, 6), k ? '#7fd1a8' : gem, M(bx * 0.75 - k * 0.04, y - 0.07, bf - 0.01, 0, 0, 0, 1, 1.25, 1)));
    if (acc.has('pergamino')) add('spine05_h', 'matte', piece(new T.CylinderGeometry(0.014, 0.014, 0.16, 8), '#d9ccaa', M(bx * 0.4, y - 0.03, bb - 0.02, 0, 0, Math.PI / 2 - 0.3), 'lino'));
    if (def.grimoire === 'cinturon') { add('spine05_h', 'matte', piece(new T.BoxGeometry(0.03, 0.16, 0.12), secondary, M(bx + 0.012, y - 0.1, bcz, 0, 0, 0.08), 'cuero')); add('spine05_h', 'metal', piece(new T.BoxGeometry(0.032, 0.02, 0.122), metal, M(bx + 0.012, y - 0.05, bcz, 0, 0, 0.08))); }
  }
  if (acc.has('amuleto')) {
    const fy = 1.27, front = profile.front(fy) + 0.022, curve = new T.CatmullRomCurve3([[-0.07, 1.43, -0.03], [-0.075, 1.38, 0.05], [-0.035, 1.31, front - 0.006], [0, fy, front], [0.035, 1.31, front - 0.006], [0.075, 1.38, 0.05], [0.07, 1.43, -0.03], [0, 1.445, -0.06]].map((p) => new T.Vector3(...p)), true);
    add('spine01_h', 'metal', piece(new T.TubeGeometry(curve, seg * 2, 0.0022, 4, true), metal));
    add('spine01_h', 'metal', piece(new T.CylinderGeometry(0.019, 0.019, 0.006, seg), metal, M(0, fy - 0.022, front + 0.004, Math.PI / 2, 0, 0)));
    add('spine01_h', 'gem', piece(new T.OctahedronGeometry(0.012), gem, M(0, fy - 0.022, front + 0.01, 0, 0, 0, 1, 1.3, 0.55)));
  }
  if (acc.has('estola')) for (const s of [-1, 1]) {
    const pts = [[s * 0.06, 1.445, -0.02], [s * 0.085, 1.42, 0.04], [s * 0.075, 1.3, profile.front(1.3) + 0.02], [s * 0.07, 1.1, profile.front(1.1) + 0.03], [s * 0.07, 0.92, profile.front(0.95) + 0.045]].map((p) => new T.Vector3(...p));
    const geo = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 16, 0.026, 4, false); geo.scale(1, 1, 1); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const dz = p.getZ(i) - (profile.front(p.getY(i)) + 0.03); if (p.getY(i) < 1.38) p.setZ(i, p.getZ(i) - dz * 0.6); } geo.computeVertexNormals();
    add('spine01_h', 'matte', piece(geo, AFFINITIES[def.magicAffinity]?.tinte || accent, null, 'seda'));
  }
  if (acc.has('cuello-alto')) {
    const geo = new T.CylinderGeometry(0.105, 0.088, 0.13, seg, 1, true, Math.PI * 0.32, Math.PI * 1.36);
    add('spine01_h', 'matte', piece(geo, secondary, M(0, 1.45, -0.005, -0.12, 0, 0, 1, 1, 0.95), 'lana'));
  }
  if (acc.has('anillo')) add('finger4-1_L_h', 'metal', piece(new T.TorusGeometry(0.0085, 0.0022, 5, 10), metal));
  return groups;
}

// Objetos que se recolocan cada cuadro siguiendo manos/cuerpo (báculo apoyado, varita, grimorio, orbe).
export function buildHeld({ def, palette, affinity, detail }) {
  const seg = [6, 8, 10, 12, 16][detail] || 10, out = {};
  const mk = (parts) => { const geos = parts.map(([g, c, m, tela]) => piece(g, c, m, tela || 'madera')); const g = mergeGeometries(geos); geos.forEach((x) => x.dispose()); return g; };
  const st = STAFFS[def.staff];
  if (st?.largo) {
    const L = st.largo, wood = st.cabeza === 'pomo' ? '#1d1a1c' : '#5a412c', parts = [[new T.CylinderGeometry(0.014, 0.018, L, seg), wood, M(0, L / 2, 0)]];
    if (st.cabeza === 'cristal') { parts.push([new T.TorusGeometry(0.04, 0.009, 5, seg), wood, M(0, L + 0.02, 0)]); }
    if (st.cabeza === 'piedra') parts.push([new T.DodecahedronGeometry(0.06), '#7d7466', M(0, L + 0.03, 0, 0.3, 0.5, 0)]);
    if (st.cabeza === 'anillo') parts.push([new T.TorusGeometry(0.05, 0.006, 5, seg * 2), palette.metal, M(0, L + 0.04, 0)]);
    if (st.cabeza === 'pomo') parts.push([new T.SphereGeometry(0.025, seg, seg / 2), palette.metal, M(0, L + 0.01, 0)]);
    out.staff = { geo: mk(parts), length: L, tip: [0, L + 0.03, 0], gem: st.cabeza === 'cristal' || st.cabeza === 'anillo' };
    if (out.staff.gem) out.staffGem = mk([[new T.OctahedronGeometry(st.cabeza === 'cristal' ? 0.03 : 0.018), affinity.gema, M(0, L + (st.cabeza === 'cristal' ? 0.03 : 0.04), 0, 0, 0, 0, 1, 1.6, 1)]]);
  }
  if (def.wand && def.wand !== 'ninguna') out.wand = mk([[new T.CylinderGeometry(0.004, 0.0075, 0.3, 6), def.wand === 'tallada' ? '#3b2a1e' : '#6b4a32', M(0, 0.15, 0)], [new T.SphereGeometry(0.009, 6, 4), palette.metal, M(0, 0.01, 0)]]);
  if (def.grimoire === 'mano' || def.grimoire === 'flotante') out.book = mk([[new T.BoxGeometry(0.17, 0.035, 0.23), palette.secundario, M(), 'cuero'], [new T.BoxGeometry(0.16, 0.03, 0.22), '#dacfb2', M(0.006, 0, 0), 'lino'], [new T.BoxGeometry(0.04, 0.004, 0.04), palette.metal, M(0, 0.019, 0)]]);
  if ((def.accessories || []).includes('orbe')) out.orb = mk([[new T.IcosahedronGeometry(0.05, 1), affinity.gema, M()]]);
  return out;
}
