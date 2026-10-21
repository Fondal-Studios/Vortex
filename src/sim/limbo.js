// ARENAS DEL LIMBO (mapas 5 y 6): constructor común de la simulación.
// Son escenarios de ARCANUM (la Praga vieja, el osario de Sedlec) que llegaron MUERTOS al limbo. Físicamente son arenas
// PLANAS y CERRADAS (sin caídas al vacío, sin laberintos): un piso a y = 0, muros de borde altos (fachadas, paredes del
// osario) y coberturas simples (cajas y cilindros) que frenan a jugadores, criaturas, balas y rayos.
//
// Qué recibe `def` (todo en metros; y = 0 es el piso):
//   rooms:  [{x0,x1,z0,z1}]                rectángulos caminables (la arena = su unión; se usan para spawns y límites)
//   walls:  [{x0,x1,z0,z1,h}]              muros de borde (cajas desde el piso hasta h)
//   covers: [{shape:'box',x,z,hx,hz,h,y0?} | {shape:'cyl',x,z,r,h,y0?}]  coberturas (y0 > 2.5 = techo/alero: no bloquea el paso)
//   zones:  [{kind:'leve',x,z,r,h,k}]      «gravedad rota leve»: dentro del cilindro la gravedad vale k·G (saltás alto, flotás)
//   spawn:  {x,z,dx,dz}                    aparición de los jugadores (y dirección hacia la arena)
//   spots, bossAnchor, navStep (opcional: espaciado de la grilla de navegación)
// Navegación: una grilla de puntos (cada `navStep` m) sobre las salas, sin los que caen dentro de una cobertura; aristas
// entre puntos cercanos con línea libre; caminos más cortos precalculados. Las criaturas terrestres y los bots la usan
// cuando la línea recta hacia su objetivo choca con algo (map.navStep), y `guard` rodea las coberturas chicas.
import { v3, add, mul } from './math.js';
import { G } from './data.js';

const DOWN = v3(0, -G, 0);

/** Obstáculos 2D (huella en planta) de muros y coberturas que bloquean el paso. */
function footprints(def) {
  const out = [];
  for (const w of def.walls) out.push({ t: 'b', x0: w.x0, x1: w.x1, z0: w.z0, z1: w.z1 });
  for (const c of def.covers) {
    if ((c.y0 || 0) > 2.5) continue; // alero/techo: se pasa por debajo
    if (c.shape === 'cyl') out.push({ t: 'c', x: c.x, z: c.z, r: c.r });
    else out.push({ t: 'b', x0: c.x - c.hx, x1: c.x + c.hx, z0: c.z - c.hz, z1: c.z + c.hz });
  }
  return out;
}
/** ¿El punto (x,z) cae dentro de algún obstáculo agrandado `m`? */
function insideAny(obs, x, z, m) {
  for (const o of obs) {
    if (o.t === 'c') { const dx = x - o.x, dz = z - o.z; if (dx * dx + dz * dz < (o.r + m) * (o.r + m)) return true; }
    else if (x > o.x0 - m && x < o.x1 + m && z > o.z0 - m && z < o.z1 + m) return true;
  }
  return false;
}
/** ¿El segmento A→B (en planta) pasa libre, con un margen `m` alrededor de cada obstáculo? */
function segClear(obs, ax, az, bx, bz, m) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  for (const o of obs) {
    if (o.t === 'c') {
      const t = L2 > 1e-9 ? Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.z - az) * dz) / L2)) : 0;
      const qx = ax + dx * t - o.x, qz = az + dz * t - o.z, rr = o.r + m;
      if (qx * qx + qz * qz < rr * rr) return false;
    } else { // segmento contra caja agrandada (método de las franjas)
      let t0 = 0, t1 = 1;
      const lo = [o.x0 - m, o.z0 - m], hi = [o.x1 + m, o.z1 + m], p = [ax, az], d = [dx, dz];
      let hit = true;
      for (let k = 0; k < 2 && hit; k++) {
        if (Math.abs(d[k]) < 1e-9) { if (p[k] <= lo[k] || p[k] >= hi[k]) hit = false; }
        else { let a = (lo[k] - p[k]) / d[k], b = (hi[k] - p[k]) / d[k]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 >= t1) hit = false; }
      }
      if (hit) return false;
    }
  }
  return true;
}
const inRooms = (rooms, x, z, m = 0) => rooms.some((r) => x > r.x0 + m && x < r.x1 - m && z > r.z0 + m && z < r.z1 - m);

/** Grilla de navegación + caminos más cortos (Floyd–Warshall; pocas decenas de nodos). */
function buildNav(def, obs, mNodo = 1.8, mArista = 1.1) {
  const step = def.navStep || 7, nodes = [];
  const bx0 = Math.min(...def.rooms.map((r) => r.x0)), bx1 = Math.max(...def.rooms.map((r) => r.x1));
  const bz0 = Math.min(...def.rooms.map((r) => r.z0)), bz1 = Math.max(...def.rooms.map((r) => r.z1));
  for (let x = bx0 + step / 2; x < bx1; x += step) for (let z = bz0 + step / 2; z < bz1; z += step) {
    if (inRooms(def.rooms, x, z, Math.min(1.6, mNodo - 0.2)) && !insideAny(obs, x, z, mNodo)) nodes.push({ x, z });
  }
  for (const p of def.navExtra || []) if (!insideAny(obs, p[0], p[1], Math.min(1.4, mNodo))) nodes.push({ x: p[0], z: p[1] });
  const N = nodes.length, INF = 1e9, D = new Float32Array(N * N).fill(INF), nxt = new Int16Array(N * N).fill(-1);
  for (let i = 0; i < N; i++) { D[i * N + i] = 0; nxt[i * N + i] = i; }
  const reach = step * 2.3;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const a = nodes[i], b = nodes[j], d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d > reach || !segClear(obs, a.x, a.z, b.x, b.z, mArista)) continue;
    D[i * N + j] = D[j * N + i] = d; nxt[i * N + j] = j; nxt[j * N + i] = i;
  }
  for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) { const dik = D[i * N + k]; if (dik >= INF) continue; for (let j = 0; j < N; j++) { const v = dik + D[k * N + j]; if (v < D[i * N + j]) { D[i * N + j] = v; nxt[i * N + j] = nxt[i * N + k]; } } }
  return { nodes, N, D, nxt, INF, reach };
}

export function makeLimboArena(def) {
  const solids = [], walls = [];
  const bx0 = Math.min(...def.rooms.map((r) => r.x0)), bx1 = Math.max(...def.rooms.map((r) => r.x1));
  const bz0 = Math.min(...def.rooms.map((r) => r.z0)), bz1 = Math.max(...def.rooms.map((r) => r.z1));
  const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2, hx = (bx1 - bx0) / 2 + 12, hz = (bz1 - bz0) / 2 + 12;
  // piso: una losa por sala, que llega justo hasta el pie de los muros (4 m). Fuera de los muros NO hay piso: si una criatura
  // se escapa (invocación pegada a un muro, empujones), cae al vacío y desaparece en vez de quedar trabada afuera.
  for (const r of def.rooms) solids.push({ type: 'box', c: v3((r.x0 + r.x1) / 2, -3, (r.z0 + r.z1) / 2), h: v3((r.x1 - r.x0) / 2 + 4, 3, (r.z1 - r.z0) / 2 + 4), floor: true });
  for (const w of def.walls) {
    const b = { type: 'box', c: v3((w.x0 + w.x1) / 2, w.h / 2, (w.z0 + w.z1) / 2), h: v3((w.x1 - w.x0) / 2, w.h / 2, (w.z1 - w.z0) / 2), wall: true, edge: true };
    solids.push(b); walls.push(b);
  }
  for (const c of def.covers) {
    const y0 = c.y0 || 0;
    const s = c.shape === 'cyl'
      ? { type: 'cyl', c: v3(c.x, y0 + c.h / 2, c.z), r: c.r, y0: y0 - (y0 > 0 ? 0 : 0.5), y1: y0 + c.h, cover: c.kind || 'cobertura' }
      : { type: 'box', c: v3(c.x, y0 + c.h / 2, c.z), h: v3(c.hx, c.h / 2, c.hz), wall: true, cover: c.kind || 'cobertura' };
    solids.push(s); walls.push(s);
  }
  const obs = footprints(def), nav = buildNav(def, obs), navBig = buildNav(def, obs, 3.1, 2.6),   // navBig: ruta para criaturas GRANDES (Almamula, Lobizón…): sólo por pasos anchos
     zones = (def.zones || []).map((z) => ({ ...z, shape: 'cyl', c: v3(z.x, 0, z.z), y0: -1, y1: z.h || 40 }));
  const inZone = (z, p) => Math.hypot(p.x - z.x, p.z - z.z) < z.r && p.y > z.y0 && p.y < z.y1;
  const area = def.rooms.map((r) => (r.x1 - r.x0) * (r.z1 - r.z0)), tot = area.reduce((a, b) => a + b, 0);
  const sp = def.spawn, sl = Math.hypot(sp.dx, sp.dz) || 1, sdx = sp.dx / sl, sdz = sp.dz / sl;

  const map = {
    id: def.id, name: def.name, solids, walls, zones, portals: [], rooms: def.rooms, covers: def.covers, wallDefs: def.walls, limbo: true,
    nav, navBig, obstacles: obs, spots: def.spots, bossAnchor: def.bossAnchor, center: v3(cx, 8, cz), bounds: Math.max(hx, hz) + 30, voidY: -30,
    bbox: { x0: bx0, x1: bx1, z0: bz0, z1: bz1 }, spawnAt: sp, deco: def.deco || {},
    playerSpawn(i) { const k = (i % 4) - 1.5; return v3(sp.x - sdz * k * 2.5 - sdx * (i > 3 ? 3 : 0), 0.9, sp.z + sdx * k * 2.5 - sdz * (i > 3 ? 3 : 0)); },
    gravityAt(p) { for (const z of zones) if (z.kind === 'leve' && inZone(z, p)) return v3(0, -G * z.k, 0); return DOWN; },
    timeScaleAt() { return 1; },
    outOfBounds(p) { return p.y < this.voidY || p.y > 160 || p.x < bx0 - 40 || p.x > bx1 + 40 || p.z < bz0 - 40 || p.z > bz1 + 40; },
    /** ¿Este punto (en planta) está dentro de la arena caminable y libre de coberturas? */
    walkable(x, z, m = 0.9) { return inRooms(def.rooms, x, z, m) && !insideAny(obs, x, z, m); },
    lineClear(a, b, m = 1) { return segClear(obs, a.x, a.z, b.x, b.z, m); },
    /** Siguiente punto de ruta de `from` hacia `to`; null = puede ir derecho; 'none' = no hay camino. */
    navStep(from, to, big = false) {
      const mg = big ? 2.4 : 0.95, nv = big ? navBig : nav;
      if (segClear(obs, from.x, from.z, to.x, to.z, mg)) return null;
      const { nodes, N, D, INF, reach } = nv;
      const vis = (p, lim) => { const out = []; for (let k = 0; k < N; k++) { const n = nodes[k], d = Math.hypot(n.x - p.x, n.z - p.z); if (d < lim && segClear(obs, p.x, p.z, n.x, n.z, mg)) out.push([k, d]); } return out; };
      let A = vis(from, reach), B = vis(to, reach);
      if (!A.length) A = vis(from, 200); if (!B.length) B = vis(to, 200);
      let best = INF, ba = -1, bb = -1;
      for (const [a, da] of A) for (const [b, db] of B) { const c = da + D[a * N + b] + db; if (c < best) { best = c; ba = a; bb = b; } }
      if (ba < 0 || best >= INF * 0.5) return 'none';
      // saltear los nodos que ya están a la vista y cerca (no zigzaguear por la grilla)
      let cur = ba, g = 0;
      while (cur !== bb && g++ < 8) { const nx = nv.nxt[cur * N + bb]; if (nx < 0) break; const n = nodes[nx]; if (!segClear(obs, from.x, from.z, n.x, n.z, mg)) break; cur = nx; }
      const n = nodes[cur]; if (Math.hypot(n.x - from.x, n.z - from.z) < 1.2 && cur === bb) return null;
      return { x: n.x, y: from.y, z: n.z };
    },
    /** navStep con respaldo: si no hay ruta por pasos anchos (criaturas grandes), usa la de las chicas. */
    pasoRuta(from, to, big) { const r = this.navStep(from, to, big); return r === 'none' && big ? this.navStep(from, to, false) : r; },
    /** Desvía una dirección de marcha para no empujar contra una cobertura o un muro (prueba ±30°, ±60°, ±90°, ±125°). */
    guard(pos, dir, reach = 2.6, mg = 0.85) {
      const l = Math.hypot(dir.x, dir.z); if (l < 1e-6) return dir;
      const ux = dir.x / l, uz = dir.z / l;
      for (const a of [0, 0.5, -0.5, 1.05, -1.05, 1.57, -1.57, 2.2, -2.2]) {
        const c = Math.cos(a), s = Math.sin(a), vx = ux * c - uz * s, vz = ux * s + uz * c;
        if (segClear(obs, pos.x, pos.z, pos.x + vx * reach, pos.z + vz * reach, mg) && inRooms(def.rooms, pos.x + vx * reach, pos.z + vz * reach, 0.2)) return { x: vx * l, y: dir.y, z: vz * l };
      }
      return dir;
    },
    /** Dirección de una criatura terrestre: si va hacia un jugador y hay algo en medio, sigue la grilla (recalcula cada 0,3 s). */
    steer(game, m, wish) {
      const l = Math.hypot(wish.x, wish.z); if (l < 1e-6) return wish;
      let tgt = null, bd = Infinity;
      for (const p of game.players) { if (p.dead) continue; const d = Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z); if (d < bd) { bd = d; tgt = p; } }
      let out = wish;
      if (tgt && (wish.x * (tgt.pos.x - m.pos.x) + wish.z * (tgt.pos.z - m.pos.z)) / (l * (bd || 1)) > 0.3) {
        if (!m._nv || game.time - m._nv.t > 0.3) m._nv = { t: game.time, wp: this.pasoRuta(m.pos, tgt.pos, (m.r || 1) > 1.45) };
        const st = m._nv.wp;
        if (st && st !== 'none') { const dx = st.x - m.pos.x, dz = st.z - m.pos.z, dl = Math.hypot(dx, dz) || 1; out = { x: dx / dl * l, y: 0, z: dz / dl * l }; }
      }
      return this.guard(m.pos, out, (m.r || 1) + 1.6, (m.r || 1) * 0.97 + 0.35);
    },
    spawnGround(r, ref) {
      for (let i = 0; i < 24; i++) {
        let k = r.next() * tot, j = 0; while (j < def.rooms.length - 1 && (k -= area[j]) > 0) j++;
        const rm = def.rooms[j], x = rm.x0 + 2.5 + r.next() * (rm.x1 - rm.x0 - 5), z = rm.z0 + 2.5 + r.next() * (rm.z1 - rm.z0 - 5);
        if (!inRooms(def.rooms, x, z, 2.2) || insideAny(obs, x, z, 1.8)) continue;
        if (def.noSpawn && def.noSpawn.some((q) => Math.hypot(x - q.x, z - q.z) < q.r)) continue;
        const d = Math.hypot(x - ref.x, z - ref.z);
        if (d > 26 && d < 80) return v3(x, 1.4, z);
      }
      let best = nav.nodes[0], bdd = -1; // plan B: el nodo más lejano (dentro de 80 m)
      for (const n of nav.nodes) { const d = Math.hypot(n.x - ref.x, n.z - ref.z); if (d > bdd && d < 80) { bdd = d; best = n; } }
      return v3(best.x, 1.4, best.z);
    },
    spawnAir(r, ref) {
      for (let i = 0; i < 16; i++) {
        const a = r.range(0, 6.2832), d = r.range(18, 38), x = ref.x + Math.cos(a) * d, z = ref.z + Math.sin(a) * d;
        if (!inRooms(def.rooms, x, z, 3)) continue;
        const y = Math.max(ref.y, 0) + r.range(7, 13);
        if (def.covers.some((c) => (c.shape === 'cyl' ? Math.hypot(x - c.x, z - c.z) < c.r + 2 : Math.abs(x - c.x) < c.hx + 2 && Math.abs(z - c.z) < c.hz + 2) && y < (c.y0 || 0) + c.h + 2)) continue;
        return v3(x, y, z);
      }
      const n = nav.nodes[Math.floor(r.next() * nav.nodes.length)]; return v3(n.x, 10, n.z);
    },
    fx: () => ({}),
  };
  void add; void mul;
  return map;
}
