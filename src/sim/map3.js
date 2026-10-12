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
  const mSolids = [slab]; // criaturas: sólo el suelo (atraviesan muros)
  return {
    id: 'm3', name: 'Laberinto Celestial', solids, walls, maze, portals, zones: [], islands: [{ x: 0, z: 0, r: half, top: 0, y0: -6, hang: false }],
    mapM: { solids: mSolids }, center: v3(0, 10, 0), bounds: half + 60, voidY: -60, bossAnchor: v3(0, 26, 0), spots,
    playerSpawn: (i) => add(cellC(0, N - 1), v3(((i % 4) - 1.5) * 2.5, 0, 0)),
    gravityAt() { return DOWN; }, timeScaleAt() { return 1; },
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
