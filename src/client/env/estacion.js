// «LA ESTACIÓN» — andén subterráneo REALISTA del prólogo cinematográfico (materiales PBR con mapas de normales y rugosidad
// generados en canvas, azulejo de metro, vías con balasto, luminarias, cartelería, tren). Nada psicodélico: la
// estación es creíble hasta el instante del atropello. Pocas mallas fusionadas / instanciadas (presupuesto de la calidad Baja).
//
// Coordenadas: el andén A (el nuestro) va de z=0 a z=7, la vía en z≈-2.6 (hueco de 1,25 m), el andén B de z=-5.2 a z=-12.4.
// La estación mide x∈[-24, 24]. El tren viene del túnel de x=-24 y va hacia +x.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './noise.js';

export const ST = { X0: -24, X1: 24, ZA1: 7, ZB0: -12.4, ZB1: -5.2, YBED: -1.25, YTOP: 5.4, TRACK_Z: -2.6, RAIL_Z: [-1.88, -3.32], COLS_X: [-20, -12, -4, 4, 12, 20], COL_ZA: 4.2, COL_ZB: -8.8 };
const BAND = 1.35; // altura del zócalo de azulejo oscuro

/* ───────── texturas de canvas (color + normales + rugosidad) ───────── */
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(T, c, srgb) { const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t; }
/** Convierte un mapa de alturas (canvas, canal R) en un mapa de normales (Sobel). */
function normalFrom(hc, strength = 2) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data, out = mkCanvas(w, h), g = out.getContext('2d'), id = g.createImageData(w, h), d = id.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1)), dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0); return out;
}
const blur = (c, px) => { const o = mkCanvas(c.width, c.height), g = o.getContext('2d'); g.filter = `blur(${px}px)`; g.drawImage(c, 0, 0); return o; };

/** Azulejo de metro (soga 2:1, junta desfasada): mapas de color, normales y rugosidad. Cubre 1,2 m × 1,2 m. */
function subwayTiles(T, seed = 1) {
  const S = 512, r = rng(seed), col = mkCanvas(S, S), hgt = mkCanvas(S, S), rgh = mkCanvas(S, S), gc = col.getContext('2d'), gh = hgt.getContext('2d'), gr = rgh.getContext('2d');
  gc.fillStyle = '#8f938d'; gc.fillRect(0, 0, S, S); gh.fillStyle = '#000'; gh.fillRect(0, 0, S, S); gr.fillStyle = 'rgb(0,235,0)'; gr.fillRect(0, 0, S, S);
  const tw = S / 4, th = S / 8, gap = 5;
  for (let row = 0; row < 8; row++) for (let i = -1; i < 4; i++) {
    const x = i * tw + (row % 2 ? tw / 2 : 0), y = row * th, s = 232 + ((r() * 18) | 0) - 9;
    gc.fillStyle = `rgb(${s},${s + 1},${s - 3})`; gc.fillRect(x + gap / 2, y + gap / 2, tw - gap, th - gap);
    gh.fillStyle = '#fff'; gh.fillRect(x + gap / 2, y + gap / 2, tw - gap, th - gap); gr.fillStyle = `rgb(0,${46 + ((r() * 24) | 0)},0)`; gr.fillRect(x + gap / 2, y + gap / 2, tw - gap, th - gap);
    // brillo suave dentro de cada azulejo (bisel)
    const lg = gc.createLinearGradient(x, y, x + tw, y + th); lg.addColorStop(0, 'rgba(255,255,255,.12)'); lg.addColorStop(1, 'rgba(0,0,0,.1)'); gc.fillStyle = lg; gc.fillRect(x + gap / 2, y + gap / 2, tw - gap, th - gap);
  }
  for (let i = 0; i < 26; i++) { const x = r() * S, y = r() * S, rad = 30 + r() * 80, g = gc.createRadialGradient(x, y, 2, x, y, rad); g.addColorStop(0, `rgba(50,44,34,${0.08 + r() * 0.1})`); g.addColorStop(1, 'rgba(50,44,34,0)'); gc.fillStyle = g; gc.fillRect(0, 0, S, S); } // mugre
  for (let i = 0; i < 5; i++) { const x = r() * S; const g = gc.createLinearGradient(x, 0, x + 6, S); g.addColorStop(0, 'rgba(60,52,40,.0)'); g.addColorStop(0.5, 'rgba(60,52,40,.13)'); g.addColorStop(1, 'rgba(60,52,40,0)'); gc.fillStyle = g; gc.fillRect(x - 4, 0, 12, S); } // chorreaduras
  return { map: tex(T, col, true), normalMap: tex(T, normalFrom(blur(hgt, 1.6), 3.2)), roughnessMap: tex(T, rgh, false) };
}
/** Granito pulido en baldosas de 0,6 m con vetas, juntas y marcas de uso. Cubre 1,2 m. */
function floorTiles(T) {
  const S = 512, r = rng(23), col = mkCanvas(S, S), hgt = mkCanvas(S, S), rgh = mkCanvas(S, S), gc = col.getContext('2d'), gh = hgt.getContext('2d'), gr = rgh.getContext('2d');
  gh.fillStyle = '#fff'; gh.fillRect(0, 0, S, S);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const s = 128 + ((r() * 26) | 0); gc.fillStyle = `rgb(${s + 6},${s + 5},${s})`; gc.fillRect(x * 256, y * 256, 256, 256); }
  for (let i = 0; i < 5000; i++) { const s = r() > 0.5 ? 240 : 40; gc.fillStyle = `rgba(${s},${s},${s},${0.05 + r() * 0.12})`; gc.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3); }
  gc.strokeStyle = 'rgba(255,255,255,.07)'; gc.lineWidth = 1.5; for (let i = 0; i < 16; i++) { gc.beginPath(); gc.moveTo(r() * S, r() * S); gc.bezierCurveTo(r() * S, r() * S, r() * S, r() * S, r() * S, r() * S); gc.stroke(); }
  gc.fillStyle = 'rgba(25,23,20,.75)'; gh.fillStyle = '#000'; for (const p of [0, 256]) { gc.fillRect(p - 2, 0, 4, S); gc.fillRect(0, p - 2, S, 4); gh.fillRect(p - 2, 0, 4, S); gh.fillRect(0, p - 2, S, 4); }
  gr.fillStyle = 'rgb(0,100,0)'; gr.fillRect(0, 0, S, S); for (let i = 0; i < 70; i++) { gr.fillStyle = `rgba(0,${150 + ((r() * 90) | 0)},0,${0.15 + r() * 0.25})`; gr.beginPath(); gr.ellipse(r() * S, r() * S, 10 + r() * 60, 6 + r() * 28, r() * 3, 0, 6.29); gr.fill(); } // pisadas: menos brillo
  for (let i = 0; i < 12; i++) { const x = r() * S, y = r() * S, rad = 40 + r() * 90, g = gc.createRadialGradient(x, y, 2, x, y, rad); g.addColorStop(0, 'rgba(20,18,14,.16)'); g.addColorStop(1, 'rgba(20,18,14,0)'); gc.fillStyle = g; gc.fillRect(0, 0, S, S); }
  return { map: tex(T, col, true), normalMap: tex(T, normalFrom(blur(hgt, 1.2), 2)), roughnessMap: tex(T, rgh, false) };
}
/** Hormigón / balasto: ruido con cantos. */
function roughStone(T, seed, base, cells, rough, nStr = 2.4) {
  const S = 256, r = rng(seed), col = mkCanvas(S, S), hgt = mkCanvas(S, S), rgh = mkCanvas(S, S), gc = col.getContext('2d'), gh = hgt.getContext('2d'), gr = rgh.getContext('2d');
  gc.fillStyle = base; gc.fillRect(0, 0, S, S); gh.fillStyle = '#444'; gh.fillRect(0, 0, S, S); gr.fillStyle = `rgb(0,${rough},0)`; gr.fillRect(0, 0, S, S);
  for (let i = 0; i < cells; i++) { const x = r() * S, y = r() * S, rad = 2 + r() * (S / Math.sqrt(cells)) * 1.4, v = 80 + ((r() * 150) | 0); gh.fillStyle = `rgb(${v},${v},${v})`; gh.beginPath(); gh.ellipse(x, y, rad, rad * (0.6 + r() * 0.5), r() * 3, 0, 6.29); gh.fill(); const s = 70 + ((r() * 90) | 0); gc.fillStyle = `rgba(${s},${s - 2},${s - 6},.55)`; gc.beginPath(); gc.ellipse(x, y, rad, rad * 0.8, r() * 3, 0, 6.29); gc.fill(); }
  for (let i = 0; i < 1500; i++) { const s = r() > 0.5 ? 255 : 0; gc.fillStyle = `rgba(${s},${s},${s},.05)`; gc.fillRect(r() * S, r() * S, 2, 2); }
  return { map: tex(T, col, true), normalMap: tex(T, normalFrom(blur(hgt, 0.8), nStr)), roughnessMap: tex(T, rgh, false) };
}
function haloTex(T) {
  const c = mkCanvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

/* ───────── helpers de geometría ───────── */
function bakeUV(g, scale) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v; if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute('uv', new T_BufferAttr(uv, 2)); return g;
}
let T_BufferAttr = null;
function colorize(T, g, col) { const c = new T.Color(col), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; }
const noUV = (T, g) => { g.deleteAttribute('uv'); g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; };

/** Partes de una persona simple (sólo para el público LEJANO del andén B, que se ve en bruma). */
function farPerson(T, shirt, x, z, ry) {
  const P = [], cyl = (rt, rb, h, ty, sz = 1) => { const g = new T.CylinderGeometry(rt, rb, h, 6); g.translate(0, ty, 0); g.scale(1, 1, sz); return g; };
  const add = (g, p, c) => { g.translate(...p); g.rotateY(ry); g.translate(x, 0, z); noUV(T, g); colorize(T, g, c); P.push(g); };
  add(cyl(0.085, 0.065, 0.9, -0.45), [-0.1, 0.92, 0], 0x23262e); add(cyl(0.085, 0.065, 0.9, -0.45), [0.1, 0.92, 0], 0x23262e);
  add(cyl(0.2, 0.17, 0.66, 0, 0.62), [0, 1.24, 0], shirt); add(new T.SphereGeometry(0.115, 8, 6), [0, 1.67, 0], 0xc89878);
  add(cyl(0.058, 0.046, 0.62, -0.31), [-0.27, 1.52, 0], shirt); add(cyl(0.058, 0.046, 0.62, -0.31), [0.27, 1.52, 0], shirt);
  return P;
}

export function buildStation(T, { level = 'low' } = {}) {
  T_BufferAttr = T.BufferAttribute;
  const hi = level !== 'low';
  const group = new T.Group(); group.name = 'estacion';
  const disposables = []; const track = (o) => { disposables.push(o); return o; };
  const mat = (opts, maps) => { const m = new T.MeshStandardMaterial({ ...opts, ...maps }); return track(m); };

  /* — materiales PBR — */
  const tiles = subwayTiles(T, 3), tilesTeal = tiles, floor = floorTiles(T), conc = roughStone(T, 5, '#7d807f', 500, 215, 0.45), ballast = roughStone(T, 9, '#6c6a66', 700, 235);
  for (const set of [tiles, floor, conc, ballast]) for (const k in set) track(set[k]);
  const wallMat = mat({ color: 0xffffff, roughness: 1, metalness: 0, normalScale: new T.Vector2(1, 1), envMapIntensity: 0.9 }, tiles);
  const bandMat = mat({ color: 0x2f7b78, roughness: 1, metalness: 0, normalScale: new T.Vector2(1, 1), envMapIntensity: 1 }, tilesTeal);
  const floorMat = mat({ color: 0xffffff, roughness: 1, metalness: 0.05, vertexColors: true, envMapIntensity: 1.1 }, floor);
  const concMat = mat({ color: 0xc0c3c2, roughness: 1, metalness: 0, vertexColors: true }, conc);
  const ballastMat = mat({ color: 0xffffff, roughness: 1, metalness: 0, vertexColors: true }, ballast);
  const propMat = track(new T.MeshStandardMaterial({ roughness: 0.55, metalness: 0.45, vertexColors: true, envMapIntensity: 1 }));
  const railMat = track(new T.MeshStandardMaterial({ color: 0xb4b9c2, roughness: 0.28, metalness: 0.85, envMapIntensity: 1.2 }));
  const sleeperMat = track(new T.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.95 }));
  const tunnelMat = mat({ color: 0x5b5e60, roughness: 1, side: T.BackSide }, conc);
  const halo = track(haloTex(T));

  /* — suelo, andenes y lecho de balasto — */
  const slab = (w, h, d, x, y, z, col, mm, sc = 1.2) => { const g = new T.BoxGeometry(w, h, d); g.translate(x, y, z); bakeUV(g, sc); colorize(T, g, col); return g; };
  const floorMesh = track(new T.Mesh(mergeGeometries([slab(48, 1.3, 7, 0, -0.65, 3.5, 0xffffff), slab(48, 1.3, 7.2, 0, -0.65, -8.8, 0xe6e6e6)]), floorMat)); group.add(floorMesh);
  const ballastMesh = track(new T.Mesh(mergeGeometries([slab(48, 0.3, 5.2, 0, -1.4, -2.6, 0xb0aaa4, 0, 1.0)]), ballastMat)); group.add(ballastMesh);

  /* — paredes: zócalo de azulejo oscuro + azulejo blanco arriba — */
  const wl = [], bl = [];
  const wallPiece = (w, ya, yb, cx, cz, ry) => { // plano vertical de ancho w centrado en (cx,cz), girado ry, entre alturas ya..yb
    const g = new T.PlaneGeometry(w, yb - ya); g.rotateY(ry); g.translate(cx, (ya + yb) / 2, cz); bakeUV(g, 1.2); return g;
  };
  const wall = (w, cx, cz, ry) => { wl.push(wallPiece(w, BAND, ST.YTOP, cx, cz, ry)); bl.push(wallPiece(w, ST.YBED, BAND, cx, cz, ry)); };
  wall(48, 0, 7, Math.PI); wall(48, 0, -12.4, 0);
  const endWall = (x, ry) => { wall(7.8, x, -8.5, ry); wall(7.6, x, 3.2, ry); const g = wallPiece(4.0, 3.6, ST.YTOP, x, -2.6, ry); wl.push(g); };
  endWall(-24, Math.PI / 2); endWall(24, -Math.PI / 2);
  const ceilG = new T.PlaneGeometry(48, 19.4); ceilG.rotateX(Math.PI / 2); ceilG.translate(0, ST.YTOP, -2.7); bakeUV(ceilG, 2.4); colorize(T, ceilG, 0x8a8d8e);
  group.add(track(new T.Mesh(mergeGeometries(wl), wallMat)), track(new T.Mesh(mergeGeometries(bl), bandMat)), track(new T.Mesh(mergeGeometries([ceilG]), concMat)));

  /* — columnas cuadradas revestidas de azulejo (zócalo oscuro + blanco) — */
  const cw = [], cb = [], colliders = [];
  for (const x of ST.COLS_X) for (const z of [ST.COL_ZA, ST.COL_ZB]) {
    const up = new T.BoxGeometry(0.9, ST.YTOP - BAND, 0.9); up.translate(x, (ST.YTOP + BAND) / 2, z); bakeUV(up, 1.2); cw.push(up);
    const lo = new T.BoxGeometry(0.94, BAND - ST.YBED, 0.94); lo.translate(x, (BAND + ST.YBED) / 2, z); bakeUV(lo, 1.2); cb.push(lo);
    colliders.push({ x, z, r: 0.6 });
  }
  group.add(track(new T.Mesh(mergeGeometries(cw), wallMat)), track(new T.Mesh(mergeGeometries(cb), bandMat)));

  /* — utilería con color por vértice (metal/pintura): franja amarilla, bancos, ductos, bandejas, molduras, papeleras — */
  const pr = [], pb = (w, h, d, x, y, z, col) => { const g = new T.BoxGeometry(w, h, d); g.translate(x, y, z); noUV(T, g); colorize(T, g, col); pr.push(g); };
  const pc = (rt, rb, h, x, y, z, col, rot = null, seg = 12) => { const g = new T.CylinderGeometry(rt, rb, h, seg); if (rot) g.rotateZ(rot); g.translate(x, y, z); noUV(T, g); colorize(T, g, col); pr.push(g); };
  pb(48, 0.03, 0.55, 0, 0.015, 0.34, 0xe0b81c); pb(48, 0.03, 0.55, 0, 0.015, -5.47, 0xe0b81c); // franja amarilla de seguridad
  for (let x = -23.5; x < 23.5; x += 0.5) { pb(0.08, 0.034, 0.5, x, 0.02, 0.34, 0xa88a14); pb(0.08, 0.034, 0.5, x, 0.02, -5.47, 0xa88a14); } // tacto
  pb(48, 0.06, 0.07, 0, BAND, 6.97, 0x15181c); pb(48, 0.06, 0.07, 0, BAND, -12.37, 0x15181c); // moldura entre zócalo y azulejo
  pb(48, 0.12, 0.14, 0, 0.06, 6.93, 0x2a2d30); // zócalo inferior de goma
  for (const [x, z, flip] of [[-8, 6.5, 0], [6, 6.5, 0], [14.5, 6.5, 0], [-14, -11.9, 1], [3, -11.9, 1]]) { // bancos de metal perforado
    const s = flip ? -1 : 1; pb(2.2, 0.05, 0.5, x, 0.48, z, 0x6e747a); pb(2.2, 0.4, 0.04, x, 0.78, z + 0.23 * s, 0x6e747a);
    for (const dx of [-1.0, 0, 1.0]) pb(0.06, 0.48, 0.42, x + dx, 0.24, z, 0x2a2d30);
  }
  for (const [x, z] of [[-3, 6.4], [10, 6.4], [-16, -11.9]]) { pc(0.26, 0.24, 0.85, x, 0.425, z, 0x3a463e); pc(0.27, 0.27, 0.05, x, 0.87, z, 0x1c1f22); }
  for (let x = -20; x <= 20; x += 8) pb(0.45, 0.35, 19.4, x, 5.2, -2.7, 0x55595b);            // vigas del techo
  pb(48, 0.1, 0.6, 0, 5.26, 5.2, 0x3a3d40); pb(48, 0.1, 0.6, 0, 5.26, -10.8, 0x3a3d40);       // bandejas de cables
  pc(0.22, 0.22, 48, 0, 5.1, 6.4, 0x8d9296, Math.PI / 2, 14); pc(0.16, 0.16, 48, 0, 5.15, 5.8, 0xa9a49a, Math.PI / 2, 12); // ductos
  for (let x = -22; x <= 22; x += 4) { pb(0.05, 0.3, 0.06, x, 5.15, 6.4, 0x55595b); pb(0.05, 0.3, 0.06, x, 5.15, 5.8, 0x55595b); }
  for (const x of [-16, -6, 8, 18]) { pb(0.04, 0.5, 0.04, x - 1.0, 5.15, 1.0, 0x222428); pb(0.04, 0.5, 0.04, x + 1.0, 5.15, 1.0, 0x222428); } // soportes de carteles
  pb(0.9, 1.0, 0.1, 22.4, 1.0, 1.0, 0xc8341c); // extintor/alarma (mancha roja de contraste)
  const propMesh = track(new T.Mesh(mergeGeometries(pr), propMat)); group.add(propMesh);

  /* — vías: rieles con cabeza pulida y durmientes instanciados — */
  const rl = []; const rb = (w, h, d, y, z) => { const g = new T.BoxGeometry(w, h, d); g.translate(0, y, z); g.deleteAttribute('uv'); rl.push(noUV(T, g)); };
  for (const z of ST.RAIL_Z) { rb(168, 0.07, 0.07, -0.88, z); rb(168, 0.15, 0.035, -0.97, z); rb(168, 0.03, 0.16, -1.04, z); }
  group.add(track(new T.Mesh(mergeGeometries(rl), railMat)));
  const nSl = hi ? 210 : 140, sleepers = track(new T.InstancedMesh(new T.BoxGeometry(0.22, 0.14, 2.5), sleeperMat, nSl)), dm = new T.Object3D();
  for (let i = 0; i < nSl; i++) { dm.position.set(-84 + i * (168 / nSl), -1.12, ST.TRACK_Z); dm.updateMatrix(); sleepers.setMatrixAt(i, dm.matrix); }
  sleepers.frustumCulled = false; group.add(sleepers);

  /* — túneles: cáscara de hormigón + lámparas de servicio — */
  const shellGeo = bakeUV(new T.BoxGeometry(62, 4.85, 4.0), 2.4);
  for (const sx of [-1, 1]) { const m = track(new T.Mesh(shellGeo, tunnelMat)); m.position.set(sx * 55, 1.175, ST.TRACK_Z); group.add(m); }
  // el box de la cáscara se baquea en coordenadas locales: las posiciones ya están centradas, sirve para un hormigón uniforme
  const tl = hi ? 12 : 9, lampMat = track(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), lamps = track(new T.InstancedMesh(new T.BoxGeometry(0.4, 0.1, 0.14), lampMat, tl * 2)), lampX = [];
  for (let i = 0; i < tl; i++) for (const sx of [-1, 1]) { const x = sx * (28 + i * (hi ? 5 : 6.5)); lampX.push(x); dm.position.set(x, 3.4, ST.TRACK_Z - 1.6); dm.updateMatrix(); lamps.setMatrixAt(lampX.length - 1, dm.matrix); lamps.setColorAt(lampX.length - 1, new T.Color(0x000000)); }
  lamps.frustumCulled = false; group.add(lamps);

  /* — luminarias (instanciadas): carcasa + tubo; el brillo parpadea de a poco — */
  const fixRows = [[2.2, 12], [-8.8, 12], [-2.6, 6]], fix = [];
  for (const [z, n] of fixRows) for (let i = 0; i < n; i++) fix.push({ x: n === 6 ? -20 + i * 8 : -22 + i * 4, z, v: 1 });
  const fixMat = track(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), fixMesh = track(new T.InstancedMesh(new T.BoxGeometry(1.25, 0.05, 0.16), fixMat, fix.length));
  fix.forEach((f, i) => { dm.position.set(f.x, 5.2, f.z); dm.updateMatrix(); fixMesh.setMatrixAt(i, dm.matrix); fixMesh.setColorAt(i, new T.Color(1, 1, 1)); }); fixMesh.frustumCulled = false; group.add(fixMesh);
  const houseG = []; for (const f of fix) { const g = new T.BoxGeometry(1.45, 0.1, 0.3); g.translate(f.x, 5.29, f.z); noUV(T, g); colorize(T, g, 0x6d7276); houseG.push(g); }
  group.add(track(new T.Mesh(mergeGeometries(houseG), propMat)));

  /* — pantalla de horarios (canvas) — */
  const scrC = mkCanvas(512, 256), scrTex = track(new T.CanvasTexture(scrC)); scrTex.colorSpace = T.SRGBColorSpace; scrTex.anisotropy = 8;
  const screen = track(new T.Mesh(new T.PlaneGeometry(3.2, 1.6), new T.MeshBasicMaterial({ map: scrTex, toneMapped: false, color: 0xe8e8e8 }))); screen.position.set(0, 2.6, 6.88); screen.rotation.y = Math.PI; group.add(screen);
  const frame = new T.Mesh(new T.BoxGeometry(3.45, 1.85, 0.12), track(new T.MeshStandardMaterial({ color: 0x15181c, roughness: 0.5, metalness: 0.6 }))); frame.position.set(0, 2.6, 6.93); group.add(frame);
  let scrMode = '', scrStamp = -1;
  function drawScreen(mode, t) {
    const g = scrC.getContext('2d'), w = 512; g.fillStyle = '#05101a'; g.fillRect(0, 0, w, 256);
    const alert = mode === 'alerta'; g.fillStyle = alert ? '#ff5040' : '#3fe0d0'; g.font = 'bold 34px sans-serif'; g.textBaseline = 'top'; g.fillText('ANDÉN 3', 18, 12);
    g.font = 'bold 30px monospace'; g.textAlign = 'right'; g.fillText('18:42', w - 18, 14); g.textAlign = 'left'; g.fillStyle = '#183440'; g.fillRect(14, 58, w - 28, 2);
    const rows = alert ? [['18:42', 'TREN SIN PARADA', '¡CUIDADO!'], ['', 'MANTÉNGASE DETRÁS', ''], ['', 'DE LA LÍNEA AMARILLA', ''], ['18:47', 'CENTRO SUR', 'DEMORADO']]
      : [['18:38', 'CENTRO SUR', 'EN HORA'], ['18:42', 'EXPRESO SIN PARADA', '!'], ['18:47', 'CENTRO SUR', 'EN HORA'], ['18:55', 'CENTRO SUR', 'EN HORA']];
    g.font = '24px monospace'; const blink = Math.floor(t * 2.5) % 2 === 0;
    rows.forEach((r, i) => { const y = 72 + i * 44; g.fillStyle = alert && i < 3 ? (blink ? '#fff' : '#ff8a70') : (i === 1 ? '#ffcf40' : '#a8d8e0'); g.fillText(r[0], 18, y); g.fillText(r[1], 108, y); g.textAlign = 'right'; g.fillText(r[2], w - 18, y); g.textAlign = 'left'; });
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < 256; y += 3) g.fillRect(0, y, w, 1); // líneas de pantalla
    scrTex.needsUpdate = true;
  }
  function setScreen(mode, t = 0) { const stamp = mode === 'alerta' ? Math.floor(t * 2.5) : 0; if (mode === scrMode && stamp === scrStamp) return; scrMode = mode; scrStamp = stamp; drawScreen(mode, t); }
  setScreen('normal', 0);

  /* — carteles colgantes, cartelera publicitaria con luz propia — */
  const signC = mkCanvas(512, 256), sg = signC.getContext('2d');
  sg.fillStyle = '#101418'; sg.fillRect(0, 0, 512, 128); sg.fillStyle = '#fff'; sg.font = 'bold 64px sans-serif'; sg.textBaseline = 'middle'; sg.fillText('ANDÉN', 20, 66);
  sg.fillStyle = '#e6bd1c'; sg.beginPath(); sg.arc(400, 64, 50, 0, 6.29); sg.fill(); sg.fillStyle = '#101418'; sg.font = 'bold 74px sans-serif'; sg.fillText('3', 380, 68);
  sg.fillStyle = '#12703a'; sg.fillRect(0, 128, 256, 128); sg.fillStyle = '#fff'; sg.font = 'bold 44px sans-serif'; sg.fillText('SALIDA ↑', 14, 194);
  sg.fillStyle = '#e6bd1c'; sg.fillRect(256, 128, 256, 128); sg.fillStyle = '#101418'; sg.font = 'bold 30px sans-serif'; sg.fillText('CUIDADO', 290, 170); sg.fillText('BORDE DEL ANDÉN', 262, 214);
  const signTex = track(new T.CanvasTexture(signC)); signTex.colorSpace = T.SRGBColorSpace; signTex.anisotropy = 8;
  const sgeo = [], sign = (w, h, x, y, z, u0, v0, u1, v1, ry) => { const g = new T.PlaneGeometry(w, h); const uv = g.attributes.uv; uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); if (ry) g.rotateY(ry); g.translate(x, y, z); sgeo.push(g); };
  for (const x of [-16, -6, 8, 18]) { sign(2.6, 1.3, x, 4.3, 1.03, 0, 0.5, 1, 1, 0); sign(2.6, 1.3, x, 4.3, 0.97, 0, 0.5, 1, 1, Math.PI); }
  sign(2.4, 1.2, -9, 3.0, 6.94, 0.5, 0, 1, 0.5, Math.PI); sign(2.4, 1.2, 9, 3.0, -12.34, 0, 0, 0.5, 0.5, 0);
  group.add(track(new T.Mesh(mergeGeometries(sgeo), new T.MeshBasicMaterial({ map: signTex, toneMapped: false, color: 0xd8d8d8 }))));
  const adC = mkCanvas(1024, 256), ag = adC.getContext('2d'), adr = rng(8);
  [['#d83a4a', '#ffe9d0', 'CAFÉ NOVA'], ['#2b6fd0', '#fff', 'VIAJÁ MÁS'], ['#e8b030', '#201400', 'RADIO 98.1'], ['#2a9a7a', '#fff', 'FARMACIA']].forEach(([bg, fg, tx], i) => {
    const g2 = ag.createLinearGradient(i * 256, 0, i * 256 + 256, 256); g2.addColorStop(0, bg); g2.addColorStop(1, '#101010'); ag.fillStyle = g2; ag.fillRect(i * 256 + 6, 6, 244, 244);
    ag.fillStyle = fg; ag.font = 'bold 34px sans-serif'; ag.textAlign = 'center'; ag.fillText(tx, i * 256 + 128, 214); ag.beginPath(); ag.arc(i * 256 + 128, 100, 52 + adr() * 10, 0, 6.29); ag.globalAlpha = 0.85; ag.fill(); ag.globalAlpha = 1;
  });
  const adTex = track(new T.CanvasTexture(adC)); adTex.colorSpace = T.SRGBColorSpace; adTex.anisotropy = 8;
  const adG = [], ad = (i, x, z, ry) => { const g = new T.PlaneGeometry(1.3, 1.9); const uv = g.attributes.uv, u0 = i / 4, u1 = (i + 1) / 4; uv.setXY(0, u0, 1); uv.setXY(1, u1, 1); uv.setXY(2, u0, 0); uv.setXY(3, u1, 0); g.rotateY(ry); g.translate(x, 2.45, z); adG.push(g); };
  [-19, -14, -10.5, -3.5, 3.5, 7.5, 12.5, 16.5, 20].forEach((x, i) => { ad(i % 4, x, 6.9, Math.PI); ad((i + 2) % 4, x - 1.5, -12.33, 0); });
  group.add(track(new T.Mesh(mergeGeometries(adG), new T.MeshBasicMaterial({ map: adTex, toneMapped: false, color: 0xb8b8b8 }))));
  const adF = []; [-19, -14, -10.5, -3.5, 3.5, 7.5, 12.5, 16.5, 20].forEach((x) => { const g = new T.BoxGeometry(1.45, 2.05, 0.06); g.translate(x, 2.45, 6.96); noUV(T, g); colorize(T, g, 0x1a1d20); adF.push(g); const h = new T.BoxGeometry(1.45, 2.05, 0.06); h.translate(x - 1.5, 2.45, -12.4); noUV(T, h); colorize(T, h, 0x1a1d20); adF.push(h); });
  group.add(track(new T.Mesh(mergeGeometries(adF), propMat)));

  /* — público LEJANO del andén B (siluetas en bruma; el cercano es gente real con rig en prologo.js) — */
  const far = [], fc = [0x4a5a7a, 0x7a4a52, 0x5c7a5c, 0x8a8a92, 0x6a5a82, 0x7a6a4a];
  [[-8, -6.3, 0], [-6.5, -6.2, 0], [1, -6.3, 0], [10, -6.2, 0], [14, -9.5, 0], [-16, -6.4, 0], [18, -6.3, 0]].forEach(([x, z, ry], i) => far.push(...farPerson(T, fc[i % 6], x, z, ry)));
  group.add(track(new T.Mesh(mergeGeometries(far), track(new T.MeshStandardMaterial({ roughness: 0.9, vertexColors: true })))));

  /* — luces reales (pocas) — */
  const lights = [], hemi = new T.HemisphereLight(0xdfe9e6, 0x3a3d40, 0.5); group.add(hemi);
  for (const x of [14, 6, -2, -10, -18]) { const L = new T.PointLight(0xf0fff4, 38, 18, 1.5); L.position.set(x, 4.6, 2.6); group.add(L); lights.push(L); }
  const lightB = new T.PointLight(0xf0fff4, 20, 20, 1.5); lightB.position.set(0, 4.4, -8.8); group.add(lightB); lights.push(lightB);

  /* — tren — */
  const train = buildTrain(T, halo, track); train.group.position.set(-200, 0, ST.TRACK_Z); group.add(train.group);
  // resplandor de los faros que se ve al fondo del túnel antes de que el tren aparezca
  const glow = new T.Sprite(track(new T.SpriteMaterial({ map: halo, color: 0xfff0d0, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }))); glow.position.set(-26, 1.1, ST.TRACK_Z); glow.scale.setScalar(6); group.add(glow);

  const col = new T.Color(), hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  /** ctl: {t, flick 0..1 (parpadeo), trainX, tunnelGlow 0..1, dark 0..1} */
  function update(ctl) {
    const t = ctl.t, flick = ctl.flick ?? 0.15, dark = ctl.dark ?? 0;
    for (let i = 0; i < fix.length; i++) {
      const f = fix[i]; let v = 1; const slot = Math.floor(t * (i === 5 ? 16 : 6)); if (hash(slot + i * 17) > 1 - 0.05 * flick * (i === 5 ? 8 : 1)) v = 0.2 + 0.3 * hash(slot * 3 + i);
      if (i === 17) v *= 0.8 + 0.2 * Math.sin(t * 37); f.v = v * (1 - dark * 0.8);
      col.setRGB(2.2, 2.35, 2.2).multiplyScalar(f.v); fixMesh.setColorAt(i, col);
    }
    fixMesh.instanceColor.needsUpdate = true;
    lights.forEach((L, i) => { const v = fix[Math.min(fix.length - 1, 1 + i * 2)].v; L.intensity = (i === 5 ? 20 : 38) * (0.45 + 0.55 * v) * (1 - dark * 0.7); });
    hemi.intensity = 0.5 * (1 - dark * 0.6);
    const tx = ctl.trainX ?? -999;
    for (let i = 0; i < lampX.length; i++) { const d = Math.abs(lampX[i] - tx), on = Math.max(0, 1 - d / 30); col.setRGB(1.6, 1.45, 1.1).multiplyScalar(0.08 + on * 1.5 * (0.8 + 0.2 * hash(Math.floor(t * 14) + i))); lamps.setColorAt(i, col); }
    lamps.instanceColor.needsUpdate = true;
    const g = ctl.tunnelGlow ?? 0; glow.material.opacity = g * (0.7 + 0.3 * Math.sin(t * 23)); glow.scale.setScalar(4 + g * 10);
  }
  function dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); for (const d of disposables) d.dispose && d.dispose(); }
  return { group, update, setScreen, train, colliders, fixtures: fix, lights, halo, dispose, hemi };
}

/* ───────── el tren (PBR) ───────── */
function buildTrain(T, halo, track) {
  const group = new T.Group(); group.name = 'tren';
  const L = 12.4, N = 3, paintG = [], darkG = [], winG = [], stripeG = [], glassG = [];
  const B = (arr, w, h, d, x, y, z) => { const g = new T.BoxGeometry(w, h, d); g.translate(x, y, z); noUV(T, g); arr.push(g); return g; };
  for (let i = 0; i < N; i++) {
    const cx = -(i * L + L / 2);
    B(paintG, L - 0.4, 2.8, 2.9, cx, 0.85, 0); B(paintG, L - 1.2, 0.25, 2.4, cx, 2.35, 0);
    B(darkG, L - 1.2, 0.45, 2.4, cx, -0.75, 0); B(darkG, 2.4, 0.5, 2.6, cx - 3.6, -0.78, 0); B(darkG, 2.4, 0.5, 2.6, cx + 3.6, -0.78, 0);
    if (i < N - 1) B(darkG, 0.5, 2.3, 2.3, cx - L / 2, 0.6, 0);
    B(stripeG, L - 0.38, 0.18, 2.93, cx, 0.1, 0);
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { B(winG, 1.5, 0.85, 0.03, cx - 4.6 + k * 2.3, 1.25, s * 1.46); }
    for (const s of [-1, 1]) for (const dx of [-5.2, 5.2]) B(darkG, 1.1, 2.3, 0.03, cx + dx, 0.85, s * 1.46); // puertas
  }
  B(paintG, 1.2, 2.3, 2.7, 0.45, 0.8, 0);
  const ws = new T.PlaneGeometry(2.3, 1.0); ws.rotateY(Math.PI / 2); ws.translate(1.07, 1.35, 0); noUV(T, ws); glassG.push(ws);
  const mk = (arr, m) => { const mesh = new T.Mesh(mergeGeometries(arr), m); group.add(mesh); return mesh; };
  const paint = track(new T.MeshStandardMaterial({ color: 0xaeb6c2, roughness: 0.32, metalness: 0.55, emissive: 0x000000, envMapIntensity: 1.3 }));
  const dark = track(new T.MeshStandardMaterial({ color: 0x15171b, roughness: 0.8, metalness: 0.4 }));
  const win = track(new T.MeshBasicMaterial({ color: 0xffe2a0, toneMapped: false })), stripe = track(new T.MeshStandardMaterial({ color: 0xd0204a, roughness: 0.4, metalness: 0.2 }));
  const glass = track(new T.MeshStandardMaterial({ color: 0x0c1218, roughness: 0.08, metalness: 0.8, emissive: 0x2a2820 }));
  mk(paintG, paint); mk(darkG, dark); mk(winG, win); mk(stripeG, stripe); mk(glassG, glass);
  const hlG = []; for (const z of [-0.95, 0.95]) { const g = new T.SphereGeometry(0.17, 10, 8); g.translate(1.07, 0.1, z); noUV(T, g); hlG.push(g); }
  const hm = track(new T.MeshBasicMaterial({ color: new T.Color(4, 4, 3.4), toneMapped: false })); group.add(new T.Mesh(mergeGeometries(hlG), hm));
  const glare = [];
  for (const z of [-0.95, 0.95]) { const s = new T.Sprite(track(new T.SpriteMaterial({ map: halo, color: 0xfff2d0, blending: T.AdditiveBlending, depthWrite: false, transparent: true }))); s.position.set(1.25, 0.1, z); s.scale.setScalar(2); group.add(s); glare.push(s); }
  const beamMat = track(new T.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.05, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
  const beam = new T.Mesh(new T.CylinderGeometry(0.2, 3.4, 42, 16, 1, true), beamMat); beam.rotation.z = -Math.PI / 2; beam.position.set(1.2 + 21, 0.1, 0); group.add(beam);
  const spot = new T.SpotLight(0xfff2d0, 900, 70, 0.55, 0.6, 1.4); spot.position.set(1.3, 0.2, 0); spot.target.position.set(30, -0.8, 0); group.add(spot, spot.target);
  return { group, paint, glare, beam, beamMat, spot, length: L * N };
}
