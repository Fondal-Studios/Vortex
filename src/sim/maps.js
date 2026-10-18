import { v3, add, sub, mul, norm, len, dist, makeRng, cross, rotAround, dot } from './math.js';
import { G } from './data.js';

const DOWN = v3(0, -G, 0), UP = v3(0, G, 0);

/* ───────────── Mapa 1: Vacío de Islas (gravedad rota "zonal") ───────────── */
function makeMap1() {
  const solids = [], islands = [], zones = [], portals = [];
  const addIsland = (x, top, z, r, thick = 4, hang = false) => {
    solids.push({ type: 'cyl', c: v3(x, top - thick / 2, z), r, y0: top - thick, y1: top });
    islands.push({ x, z, r, top, y0: top - thick, hang });
  };
  addIsland(0, 0, 0, 26, 5);
  const tops = [4, -6, 10, 2, -3], ring = [];
  for (let k = 0; k < 5; k++) {
    const a = (k * 72 + 15) * Math.PI / 180, x = 62 * Math.cos(a), z = 62 * Math.sin(a);
    addIsland(x, tops[k], z, 13 + (k % 2) * 3);
    ring.push({ a, x, z, top: tops[k] });
  }
  // Islas con efectos físicos
  const lift = ring[2]; // 1) ascensor de gravedad invertida hacia una isla-techo
  addIsland(lift.x, lift.top + 26, lift.z, 15, 4, true);
  zones.push({ kind: 'flip', shape: 'cyl', c: v3(lift.x, lift.top, lift.z), r: 5, y0: lift.top - 1, y1: lift.top + 40 });
  const zg = ring[4]; // 2) esfera sin gravedad
  zones.push({ kind: 'zero', shape: 'sph', c: v3(zg.x, zg.top + 9, zg.z), r: 11 });
  const pl = ring[0]; // 3) planetoide con gravedad propia (se camina alrededor)
  const pc = v3(pl.x, pl.top + 22, pl.z), pr = 6;
  solids.push({ type: 'sph', c: pc, r: pr });
  zones.push({ kind: 'well', shape: 'sph', c: pc, r: 14 });
  // 4) burbujas de tiempo dilatado: las criaturas dentro van a 30% de velocidad
  zones.push({ kind: 'slow', shape: 'sph', c: v3(14, 3, -10), r: 9, scale: 0.3 });
  zones.push({ kind: 'slow', shape: 'sph', c: v3(ring[3].x, ring[3].top + 3, ring[3].z), r: 9, scale: 0.3 });
  // Portales (pares bidireccionales)
  ring.forEach((rg, k) => {
    const ca = Math.cos(rg.a), sa = Math.sin(rg.a);
    portals.push({ a: v3(19 * ca, 0.9, 19 * sa), b: v3(rg.x - ca * 7, rg.top + 0.9, rg.z - sa * 7), r: 2.2, hue: k / 5 });
  });
  portals.push({ a: v3(pl.x + 6, pl.top + 0.9, pl.z), b: v3(pc.x, pc.y + pr + 1, pc.z), r: 2.2, hue: 0.9 });
  portals.push({ a: v3(pc.x, pc.y - pr - 1, pc.z), b: v3(pl.x - 6, pl.top + 0.9, pl.z), r: 2.2, hue: 0.95 });
  // Portal de escape desde la isla-techo
  portals.push({ a: v3(lift.x + 10, lift.top + 26 - 4 - 0.9, lift.z), b: v3(0, 0.9, -12), r: 2.2, hue: 0.5 });

  // Puntos de objetivos y puzzles (Director). Todo en coordenadas de mundo.
  const top = (i) => (i === 0 ? 0 : tops[i - 1]);
  const plateAt = (k, dx, dz) => { const rg = ring[k]; return v3(rg.x + dx, rg.top + 0.2, rg.z + dz); };
  const lift2 = lift;
  const spots = {
    anchor: v3(0, 0, -9),
    plates: [v3(-12, 0.2, 6), plateAt(1, -3, 0), plateAt(3, -3, 0), plateAt(4, -3, 0)],
    core: v3(12, 0.9, 7),
    altar: v3(lift2.x - 8, lift2.top + 26 - 4 - 0.4, lift2.z),
    liftPad: v3(lift2.x, lift2.top + 0.9, lift2.z),
    resonators: (n) => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2 + 0.4; return v3(Math.cos(a) * 15, 0, Math.sin(a) * 15); }),
    boss: v3(0, 34, 0),
  };
  const inZone = (z, p) => z.shape === 'sph'
    ? dist(p, z.c) < z.r
    : Math.hypot(p.x - z.c.x, p.z - z.c.z) < z.r && p.y > z.y0 && p.y < z.y1;
  return {
    id: 'm1', name: 'Vacío de Islas', solids, islands, zones, portals,
    center: v3(0, 10, 0), bounds: 190, voidY: -70, bossAnchor: v3(0, 34, 0), spots, ring, lift: lift2,
    playerSpawn: (i) => v3(((i % 4) - 1.5) * 3, 0.9, 4),
    gravityAt(p) {
      for (const z of zones) {
        if (z.kind === 'slow' || !inZone(z, p)) continue;
        if (z.kind === 'flip') return UP;
        if (z.kind === 'zero') return v3(0, 0, 0);
        if (z.kind === 'well') return mul(norm(sub(z.c, p)), G);
      }
      return DOWN;
    },
    timeScaleAt(p) {
      for (const z of zones) if (z.kind === 'slow' && inZone(z, p)) return z.scale;
      return 1;
    },
    outOfBounds(p) { return p.y < this.voidY || dist(p, this.center) > this.bounds; },
    /** Isla "activa" bajo/al lado de un punto; cae a la central. */
    islandAt(p) {
      let best = islands[0], bd = Infinity;
      for (const is of islands) {
        const d = Math.hypot(p.x - is.x, p.z - is.z) - is.r;
        const vy = is.hang ? Math.abs(p.y - is.y0) : Math.abs(p.y - is.top);
        const score = Math.max(d, 0) + vy * 0.5;
        if (score < bd) { bd = score; best = is; }
      }
      return best;
    },
    spawnGround(rng, ref) {
      const is = this.islandAt(ref);
      for (let i = 0; i < 10; i++) {
        const a = rng.range(0, 6.2832), rr = Math.sqrt(rng.next()) * (is.r - 2.5);
        const p = v3(is.x + Math.cos(a) * rr, is.hang ? is.y0 - 1.3 : is.top + 1.4, is.z + Math.sin(a) * rr);
        if (dist(p, ref) > 30 || i === 9) return p;
      }
    },
    spawnAir(rng, ref, up) {
      const a = rng.range(0, 6.2832), d = rng.range(35, 55);
      return add(add(ref, v3(Math.cos(a) * d, 0, Math.sin(a) * d)), mul(up, rng.range(8, 18)));
    },
    fx: () => ({}),
  };
}

/* ───────────── Mapa 2: Cámara Fractal (gravedad radial hacia afuera) ───────────── */
function makeMap2(porEvento = false) {
  const C = v3(0, 0, 0), R = 85, rng = makeRng(77);
  const solids = [{ type: 'inner', c: C, R }];
  const hills = [];
  for (let i = 0; i < 18; i++) { // puntos pseudo-uniformes sobre la esfera
    const y = 1 - (i + 0.5) / 9, rad = Math.sqrt(Math.max(0, 1 - y * y)), th = i * 2.399963;
    const n = v3(Math.cos(th) * rad, y, Math.sin(th) * rad);
    if (n.y < -0.85) continue; // dejar libre el polo de aparición
    const r = 7 + rng.next() * 4;
    hills.push({ n, r });
    solids.push({ type: 'sph', c: mul(n, R + 3), r });
  }
  const south = v3(0, -1, 0);
  const at = (polar, azim, rad = R - 0.9) => { const s = Math.sin(polar); return v3(Math.cos(azim) * s * rad, -Math.cos(polar) * rad, Math.sin(azim) * s * rad); }; // polar 0 = polo sur
  const spots = {
    anchor: at(0.22, 1.2),
    plates: [at(0.75, 0.2), at(0.75, 1.0), at(0.8, 1.8), at(0.85, 2.6)],
    core: at(0.15, 3.0), altar: at(2.4, 0.5),
    valves: [at(0.3, 0.0), at(0.3, Math.PI)],   // ~50 u entre ellas
    resonators: () => [], boss: v3(0, 0, 0),
  };
  const TIDE = { period: 60, warn: 47, zeroAt: 50, zeroEnd: 59 };
  const phase = (t) => t % TIDE.period;
  // Instancia de PARTIDA (porEvento): la marea ya no es un reloj; sólo ocurre dentro del evento «Marea de Gravedad» (src/sim/eventos.js),
  // que fija tideWin = { warn, from, to } (tiempos absolutos de la partida). El mapa estático (cliente/pruebas) conserva el reloj de 60 s.
  return {
    tideWin: porEvento ? null : undefined,
    instance() { return makeMap2(true); },
    id: 'm2', name: 'Cámara Fractal', solids, hills, zones: [], portals: [],
    center: C, bounds: R + 6, voidY: -1e9, bossAnchor: v3(0, 0, 0), R, tide: TIDE, spots,
    playerSpawn: (i) => mul(norm(v3(((i % 4) - 1.5) * 0.04, -1, 0.05)), R - 0.9),
    zeroG(t) { return this.tideWin !== undefined ? !!(this.tideWin && t >= this.tideWin.from && t < this.tideWin.to) : phase(t) >= TIDE.zeroAt && phase(t) < TIDE.zeroEnd; },
    gravityAt(p, t) {
      if (this.zeroG(t)) return v3(0, 0, 0);
      const l = len(p);
      return l < 1e-3 ? v3(0, 0, 0) : mul(p, G / l); // "abajo" = hacia el cascarón
    },
    timeScaleAt() { return 1; },
    outOfBounds(p) { return len(p) > R + 4; },
    spawnGround(rng, ref) {
      const nref = norm(ref, v3(0, -1, 0));
      const ax = norm(cross(nref, rng.unit()), v3(1, 0, 0));
      for (let i = 0; i < 12; i++) {
        const n = rotAround(nref, ax, rng.range(0.35, 0.9));
        const p = mul(n, R - 1.4);
        if (!solids.some((s) => s.type === 'sph' && dist(p, s.c) < s.r + 1.5)) return p;
      }
      return mul(rotAround(nref, ax, 0.6), R - 1.4);
    },
    spawnAir(rng, ref, up) {
      const t = norm(cross(up, rng.unit()), v3(1, 0, 0));
      return add(add(ref, mul(up, rng.range(12, 30))), mul(t, rng.range(25, 45)));
    },
    fx(t) {
      if (this.tideWin !== undefined) { const w = this.tideWin; return { warn: !!(w && t >= w.warn && t < w.from), zero: this.zeroG(t) }; }
      return { warn: phase(t) >= TIDE.warn && phase(t) < TIDE.zeroAt, zero: phase(t) >= TIDE.zeroAt && phase(t) < TIDE.zeroEnd };
    },
  };
}

import { makeMap3 } from './map3.js';
import { makeMap4 } from './map4.js';
import { makeMap5 } from './map5.js'; // Plaza de los Ecos (Praga de ARCANUM, muerta)
import { makeMap6 } from './map6.js'; // Osario sin Techo (Sedlec de ARCANUM, muerto)
export const MAPS = { m1: makeMap1(), m2: makeMap2(), m3: makeMap3(), m4: makeMap4(), m5: makeMap5(), m6: makeMap6() };
export const MAP_IDS = Object.keys(MAPS);
