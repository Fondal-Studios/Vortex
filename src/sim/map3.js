// Mapa 3: Laberinto Celestial — un laberinto de muros de cristal flotando en el cielo. Los muros frenan a jugadores,
// balas y rayos; las criaturas (entidades cósmicas) los atraviesan. Puzzles: llevar el núcleo a través del laberinto.
import { v3, add, mul, norm, cross, makeRng } from './math.js';
import { G } from './data.js';

export const M3 = { N: 9, CELL: 16, WALL: 2, H: 12 };
const DOWN = v3(0, -G, 0);

/** Laberinto determinista (backtracker + bucles) → lista de muros [{x0,z0,x1,z1}] en coordenadas de mundo. */
export function genMaze(seed = 2024) {
  const { N, CELL } = M3, rng = makeRng(seed), half = (N * CELL) / 2;
  const vis = Array.from({ length: N }, () => Array(N).fill(false));
  // paredes: vertical[x][z] entre (x-1,z) y (x,z); horizontal[x][z] entre (x,z-1) y (x,z)
  const vw = Array.from({ length: N + 1 }, () => Array(N).fill(true)), hw = Array.from({ length: N }, () => Array(N + 1).fill(true));
  const stack = [[0, N - 1]]; vis[0][N - 1] = true;
  while (stack.length) {
    const [x, z] = stack[stack.length - 1], opts = [];
    if (x > 0 && !vis[x - 1][z]) opts.push([x - 1, z, 'v', x, z]);
    if (x < N - 1 && !vis[x + 1][z]) opts.push([x + 1, z, 'v', x + 1, z]);
    if (z > 0 && !vis[x][z - 1]) opts.push([x, z - 1, 'h', x, z]);
    if (z < N - 1 && !vis[x][z + 1]) opts.push([x, z + 1, 'h', x, z + 1]);
    if (!opts.length) { stack.pop(); continue; }
    const [nx, nz, k, ax, az] = opts[Math.floor(rng.next() * opts.length)];
    if (k === 'v') vw[ax][az] = false; else hw[ax][az] = false;
    vis[nx][nz] = true; stack.push([nx, nz]);
  }
  // bucles: abrir ~25 % de los muros interiores restantes (menos callejones sin salida)
  for (let x = 1; x < N; x++) for (let z = 0; z < N; z++) if (vw[x][z] && rng.next() < 0.12) vw[x][z] = false;
  for (let x = 0; x < N; x++) for (let z = 1; z < N; z++) if (hw[x][z] && rng.next() < 0.12) hw[x][z] = false;
  // plaza central 3×3 (celdas 3..5) sin muros interiores
  const c0 = Math.floor(N / 2) - 1, c1 = c0 + 2;
  for (let x = c0 + 1; x <= c1; x++) for (let z = c0; z <= c1; z++) vw[x][z] = false;
  for (let x = c0; x <= c1; x++) for (let z = c0 + 1; z <= c1; z++) hw[x][z] = false;
  const X = (i) => -half + i * CELL, Z = (j) => -half + j * CELL;
  // unir tramos colineales en muros largos
  const segs = [];
  for (let x = 0; x <= N; x++) { let j = 0; while (j < N) { if (vw[x][j]) { const s = j; while (j < N && vw[x][j]) j++; segs.push({ x0: X(x), z0: Z(s), x1: X(x), z1: Z(j) }); } else j++; } }
  for (let z = 0; z <= N; z++) { let i = 0; while (i < N) { if (hw[i][z]) { const s = i; while (i < N && hw[i][z]) i++; segs.push({ x0: X(s), z0: Z(z), x1: X(i), z1: Z(z) }); } else i++; } }
  return { segs, vw, hw, half, X, Z };
}

export function makeMap3() {
  const { N, CELL, WALL, H } = M3, maze = genMaze(), half = maze.half, rng = makeRng(31);
  const slab = { type: 'box', c: v3(0, -3, 0), h: v3(half + 2, 3, half + 2) };
  const solids = [slab], walls = [];
  for (const s of maze.segs) {
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, hx = Math.abs(s.x1 - s.x0) / 2 + WALL / 2, hz = Math.abs(s.z1 - s.z0) / 2 + WALL / 2;
    const b = { type: 'box', c: v3(cx, H / 2, cz), h: v3(hx, H / 2, hz), wall: true }; solids.push(b); walls.push(b);
  }
  const cellC = (i, j, y = 0.9) => v3(maze.X(i) + CELL / 2, y, maze.Z(j) + CELL / 2);
  const portals = [
    { a: cellC(0, 0, 0.9), b: cellC(N - 1, N - 1, 0.9), r: 2.2, hue: 0.55 },
    { a: cellC(N - 1, 0, 0.9), b: cellC(1, N - 3, 0.9), r: 2.2, hue: 0.8 },
  ].map((p) => ({ ...p, a: add(p.a, v3(3, 0, 3)), b: add(p.b, v3(-3, 0, -3)) }));
  const c = Math.floor(N / 2);
  const spots = {
    anchor: v3(0, 0, -10), core: add(cellC(N - 1, 0), v3(-4, 0, 4)), altar: v3(0, 0.4, 8),
    plates: [v3(-17, 0.2, -17), v3(17, 0.2, 17), v3(17, 0.2, -17), v3(-17, 0.2, 17)],
    eyes: (n) => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; return v3(Math.cos(a) * 22, 20 + (k % 2) * 6, Math.sin(a) * 22); }),
    boss: v3(0, 26, 0),
  };
  // RUTAS PARA CRIATURAS: los muros ahora frenan también a las criaturas (antes las «atravesaban»: solución equivocada, se veían
  // pasar por las paredes). Para que igual lleguen hasta el jugador, calculan por dónde ir con una búsqueda por celdas (todas las
  // rutas más cortas entre las 81 celdas, precalculadas una vez) y cruzan cada celda por la mitad del lado abierto.
  const NC = N * N, nextHop = new Int16Array(NC * NC).fill(-1), cellIx = (i, j) => i * N + j;
  const open = (i, j, k) => (k === 0 ? i > 0 && !maze.vw[i][j] : k === 1 ? i < N - 1 && !maze.vw[i + 1][j] : k === 2 ? j > 0 && !maze.hw[i][j] : j < N - 1 && !maze.hw[i][j + 1]);
  const DI = [-1, 1, 0, 0], DJ = [0, 0, -1, 1];
  for (let d = 0; d < NC; d++) { // anchura desde cada destino: nextHop[src*NC+dst] = celda vecina a la que hay que ir
    const q = [d]; nextHop[d * NC + d] = d;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], ci = Math.floor(c / N), cj = c % N;
      for (let k = 0; k < 4; k++) { if (!open(ci, cj, k)) continue; const nb = cellIx(ci + DI[k], cj + DJ[k]); if (nextHop[nb * NC + d] === -1) { nextHop[nb * NC + d] = c; q.push(nb); } }
    }
  }
  const cellOf = (p) => cellIx(Math.max(0, Math.min(N - 1, Math.floor((p.x + half) / CELL))), Math.max(0, Math.min(N - 1, Math.floor((p.z + half) / CELL))));
  const cellMid = (c) => ({ x: maze.X(Math.floor(c / N)) + CELL / 2, z: maze.Z(c % N) + CELL / 2 });
  /** ¿El segmento A→B (en planta) pasa libre de muros con margen `mg`? */
  const segLibre = (ax, az, bx, bz, mg) => {
    const dx = bx - ax, dz = bz - az;
    for (const w of walls) {
      let t0 = 0, t1 = 1, ok = true;
      const lo = [w.c.x - w.h.x - mg, w.c.z - w.h.z - mg], hi = [w.c.x + w.h.x + mg, w.c.z + w.h.z + mg], p0 = [ax, az], dd = [dx, dz];
      for (let k = 0; k < 2 && ok; k++) {
        if (Math.abs(dd[k]) < 1e-9) { if (p0[k] <= lo[k] || p0[k] >= hi[k]) ok = false; }
        else { let a = (lo[k] - p0[k]) / dd[k], b = (hi[k] - p0[k]) / dd[k]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 >= t1) ok = false; }
      }
      if (ok) return false;
    }
    return true;
  };
  return {
    id: 'm3', name: 'Laberinto Celestial', solids, walls, maze, portals, zones: [], islands: [{ x: 0, z: 0, r: half, top: 0, y0: -6, hang: false }],
    flyMin: H + 2.4, center: v3(0, 10, 0), bounds: half + 60, voidY: -60, bossAnchor: v3(0, 26, 0), spots,
    playerSpawn: (i) => add(cellC(0, N - 1), v3(((i % 4) - 1.5) * 2.5, 0, 0)),
    gravityAt() { return DOWN; }, timeScaleAt() { return 1; },
    /** Dirección de marcha de una criatura terrestre: derecho si no hay muros en medio; si no, por la ruta de celdas (se recalcula cada 0,3 s). */
    steer(game, m, wish) {
      const l = Math.hypot(wish.x, wish.z); if (l < 1e-6) return wish;
      let tgt = null, bd = Infinity;
      for (const p of game.players) { if (p.dead) continue; const d = Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z); if (d < bd) { bd = d; tgt = p; } }
      if (!tgt) return wish;
      const toT = (wish.x * (tgt.pos.x - m.pos.x) + wish.z * (tgt.pos.z - m.pos.z)) / (l * (bd || 1));
      let out = wish;
      if (toT > 0.3) { // sólo si la marcha es hacia el jugador (huir o rodear sigue su propio rumbo)
        if (!m._nv || game.time - m._nv.t > 0.3) {
          const mg = (m.r || 1) + 0.6; let wp = null;
          if (!segLibre(m.pos.x, m.pos.z, tgt.pos.x, tgt.pos.z, mg)) {
            const a = cellOf(m.pos), b = cellOf(tgt.pos), nx = nextHop[a * NC + b];
            if (nx >= 0 && nx !== a) {
              const ca = cellMid(a), cn = cellMid(nx), edge = { x: (ca.x + cn.x) / 2, z: (ca.z + cn.z) / 2 };   // punto medio del lado abierto
              wp = Math.hypot(edge.x - m.pos.x, edge.z - m.pos.z) > 3.2 && segLibre(m.pos.x, m.pos.z, edge.x, edge.z, mg * 0.8) ? edge : cn;
              if (wp === cn && !segLibre(m.pos.x, m.pos.z, cn.x, cn.z, mg * 0.5)) wp = edge;
            } else wp = cellMid(b);
          }
          m._nv = { t: game.time, wp };
        }
        const wp = m._nv.wp;
        if (wp) { const dx = wp.x - m.pos.x, dz = wp.z - m.pos.z, dl = Math.hypot(dx, dz) || 1; out = { x: dx / dl * l, y: 0, z: dz / dl * l }; }
      }
      return out;
    },
    outOfBounds(p) { return p.y < this.voidY || Math.abs(p.x) > half + 40 || Math.abs(p.z) > half + 40; },
    islandAt() { return this.islands[0]; },
    spawnGround(r, ref) {
      for (let i = 0; i < 14; i++) {
        const ci = Math.floor(r.next() * N), cj = Math.floor(r.next() * N), p = cellC(ci, cj, 1.4);
        const d = Math.hypot(p.x - ref.x, p.z - ref.z);
        if (d > 30 && d < 75) return p;
      }
      return cellC(Math.floor(r.next() * N), Math.floor(r.next() * N), 1.4);
    },
    spawnAir(r, ref, up) { const a = r.range(0, 6.2832), d = r.range(25, 45); return add(add(ref, v3(Math.cos(a) * d, 0, Math.sin(a) * d)), mul(up, r.range(8, 18))); },
    fx: () => ({}),
  };
}
void norm; void cross; void rng0;
function rng0() {}
