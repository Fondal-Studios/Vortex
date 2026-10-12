// Mapa 4: JARDÍN DE CARNE — un planeta orgánico hecho de plataformas de tejido vivo unidas por rampas y puentes que
// «crecieron» entre ellas. Todo lo que se pisa es un DISCO (cilindro) para que la física existente (cyl) sirva tal cual:
//   · plataformas redondas (una tiene un foso en el medio: la Cámara del Latido),
//   · rampas/puentes = cadenas de discos solapados que suben o bajan poco a poco (máx. 0,5 u por disco → se camina sin saltar),
//   · columnas-nervio (cobertura alta), quistes (cobertura baja) y una grada central.
// El ACERTIJO («Cultivo»): el Umbral (isla del este) sólo se alcanza por un puente que NO existe al empezar. Hay tres capullos
// repartidos por el jardín; cada uno que se alimenta a tiros hasta florecer hace crecer un tramo del puente. Ver src/sim/cultivo.js.
//
// Un Game usa una INSTANCIA del mapa (`map.instance()`), porque el puente crece durante la partida y hay que añadir sólidos
// sólo en esa partida. El cliente dibuja la versión estática (sin puente) y el puente sale de los objetos 'puente' del snapshot.
import { v3, add, mul, makeRng } from './math.js';
import { G } from './data.js';

export const M4 = { THICK: 6, STEP: 1.8, RISE: 0.5, BR: 3.2, voidY: -60, PETALS: 6 };
const DOWN = v3(0, -G, 0);

/** Plataformas. `pit`: platos en anillo con un foso en el centro (zona de riesgo). */
export const PLATS = [
  { id: 'hub', name: 'El Corazón',         x: 0,   z: 0,   r: 24, top: 0 },
  { id: 'sie', name: 'La Siembra',         x: -54, z: 36,  r: 12, top: 3 },
  { id: 'gar', name: 'La Garganta',        x: -60, z: -24, r: 11, top: 2 },
  { id: 'tra', name: 'La Terraza',         x: -14, z: -50, r: 8,  top: 6 },
  { id: 'mir', name: 'El Mirador',         x: 22,  z: -72, r: 11, top: 12 },
  { id: 'cam', name: 'Cámara del Latido',  x: 58,  z: 4,   r: 16, top: 1, pit: true },
  { id: 'viv', name: 'El Vivero',          x: 36,  z: 54,  r: 12, top: 5 },
  { id: 'umb', name: 'El Umbral',          x: 84,  z: -48, r: 12, top: 7 },
];
/** Conexiones (rampas/puentes). `amp` = curvatura lateral. La última es el puente que se cultiva (3 tramos). */
const CONNS = [
  { id: 'hub-sie', a: 'hub', b: 'sie', amp: 3 },
  { id: 'hub-gar', a: 'hub', b: 'gar', amp: -3 },
  { id: 'hub-tra', a: 'hub', b: 'tra', amp: 2 },
  { id: 'tra-mir', a: 'tra', b: 'mir', amp: -3 },
  { id: 'hub-viv', a: 'hub', b: 'viv', amp: -2.5 },
  { id: 'hub-cam', a: 'hub', b: 'cam', amp: 2 },
  { id: 'viv-cam', a: 'viv', b: 'cam', amp: 3 },
  { id: 'sie-gar', a: 'sie', b: 'gar', amp: -4 },
  { id: 'cam-umb', a: 'cam', b: 'umb', amp: 2.5, bridge: true },
];
const SECTIONS = 3;

const P = Object.fromEntries(PLATS.map((p) => [p.id, p]));
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Partes (discos) de una plataforma. */
function partsOf(p) {
  if (!p.pit) return [{ x: p.x, z: p.z, r: p.r }];
  const n = M4.PETALS, ring = p.r * 0.656, pr = p.r * 0.36; // anillo de pétalos que deja un foso de ~4,7 de radio
  return Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; return { x: p.x + Math.cos(a) * ring, z: p.z + Math.sin(a) * ring, r: pr }; });
}
/** Punto de enganche de una conexión sobre la plataforma `p`, mirando hacia `toward`. */
function attach(p, toward) {
  const parts = partsOf(p);
  if (!p.pit) { const d = dist2(p, toward) || 1; const k = (p.r - 3) / d; return { x: p.x + (toward.x - p.x) * k, z: p.z + (toward.z - p.z) * k, part: 0 }; }
  let bi = 0, bd = Infinity;
  parts.forEach((q, i) => { const d = dist2(q, toward); if (d < bd) { bd = d; bi = i; } });
  const q = parts[bi], d = dist2(q, toward) || 1, k = q.r * 0.35 / d;
  return { x: q.x + (toward.x - q.x) * k, z: q.z + (toward.z - q.z) * k, part: bi };
}

/** Construye toda la geometría jugable a partir de PLATS/CONNS. */
function buildLayout() {
  const discs = [];                    // {x,z,r,top,kind,zone,sec?,idx?}
  const conns = [];
  for (const p of PLATS) partsOf(p).forEach((q, i) => discs.push({ x: q.x, z: q.z, r: q.r, top: p.top, kind: 'plat', zone: p.id, part: i }));
  for (const c of CONNS) {
    const A = P[c.a], B = P[c.b], pa = attach(A, B), pb = attach(B, A);
    const L = dist2(pa, pb), n = Math.max(2, Math.ceil(L / M4.STEP));
    const rise = (B.top - A.top) / n;
    if (Math.abs(rise) > M4.RISE + 1e-9) throw new Error(`mapa 4: ${c.id} demasiado empinada (${rise.toFixed(2)} por disco)`);
    const dx = (pb.x - pa.x) / L, dz = (pb.z - pa.z) / L, px = -dz, pz = dx;
    const chain = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, off = (c.amp || 0) * Math.sin(Math.PI * t);
      chain.push({ x: pa.x + dx * L * t + px * off, z: pa.z + dz * L * t + pz * off, top: A.top + (B.top - A.top) * t, idx: i });
    }
    // cada disco entre 1 y n-1 es parte del camino; el 0 y el n están dentro de las plataformas (ya existen)
    const rec = { id: c.id, a: c.a, b: c.b, n, pa, pb, chain, bridge: !!c.bridge, discIdx: [] };
    chain.forEach((q, i) => {
      if (i === 0 || i === n) return;
      const d = { x: q.x, z: q.z, r: M4.BR, top: q.top, kind: c.bridge ? 'bridge' : 'conn', zone: c.id, idx: i };
      rec.discIdx.push(discs.length); discs.push(d);
    });
    conns.push(rec);
  }
  // tramos del puente: reparte los discos intermedios en SECTIONS tramos consecutivos
  const br = conns.find((c) => c.bridge), sections = [];
  const total = br.discIdx.length, per = Math.ceil(total / SECTIONS);
  for (let s = 0; s < SECTIONS; s++) {
    const ids = br.discIdx.slice(s * per, Math.min(total, (s + 1) * per));
    ids.forEach((di) => { discs[di].sec = s; });
    const mid = discs[ids[Math.floor(ids.length / 2)]];
    sections.push({ ids, c: { x: mid.x, z: mid.z, y: mid.top } });
  }
  // coberturas: columnas-nervio (altas), quistes (bajos), grada del Corazón
  const covers = [];
  const ring = (id, n, rad, a0, f) => { const p = P[id]; for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2; covers.push(f({ x: p.x + Math.cos(a) * rad, z: p.z + Math.sin(a) * rad }, p, i)); } };
  ring('hub', 5, 12, 0.52, (c, p) => ({ ...c, r: 1.7, h: 9, top: p.top, kind: 'pilar' }));
  for (const a of [1.152, 3.665, 6.2]) covers.push({ x: Math.cos(a) * 9, z: Math.sin(a) * 9, r: 2.3, h: 1.5, top: 0, kind: 'quiste' }); // a mitad de camino entre columnas (≥ 3 u libres) // 9 u del centro: deja ≥ 2,9 u libres hasta la grada y las columnas
  covers.push({ x: 0, z: 0, r: 3.8, h: 1.7, top: 0, kind: 'grada' });
  const add1 = (id, dx, dz, r, h, kind) => { const p = P[id]; covers.push({ x: p.x + dx, z: p.z + dz, r, h, top: p.top, kind }); };
  add1('sie', 3, -4, 1.6, 1.4, 'quiste'); add1('sie', -5, 3, 1.2, 5, 'pilar');
  add1('gar', 4, 3, 1.3, 6, 'pilar'); add1('gar', -3, -5, 1.8, 1.4, 'quiste');
  add1('viv', -4, -3, 1.9, 1.5, 'quiste'); add1('viv', 5, 2, 1.3, 6, 'pilar');
  add1('mir', -4, 4, 2.0, 1.5, 'quiste'); add1('mir', 4, 3, 1.8, 1.5, 'quiste');
  add1('tra', 2, 2, 1.2, 4, 'pilar');
  add1('umb', 4, -3, 1.2, 6, 'pilar'); add1('umb', -3, 4, 1.7, 1.4, 'quiste');
  return { discs, conns, sections, covers, br };
}

const LAY = buildLayout();

/* ───────── navegación (grafo de puntos de ruta) ─────────
   Nodos: centro y enganches de cada plataforma + puntos cada 2 discos de cada conexión. Las criaturas terrestres y los bots
   siguen este grafo cuando el objetivo está en otra plataforma (o al otro lado del foso). Sin ello caminarían derecho al vacío. */
function buildNav(grown) {
  const nodes = [], byZone = {}, zoneNodes = (z) => (byZone[z] || (byZone[z] = []));
  const addNode = (x, z, y, zones) => { const k = nodes.length; nodes.push({ x, z, y, zones }); for (const zn of zones) zoneNodes(zn).push(k); return k; };
  const edges = []; // [a,b,usable]
  const platNodes = {};
  for (const p of PLATS) {
    const parts = partsOf(p);
    if (p.pit) { platNodes[p.id] = parts.map((q) => addNode(q.x, q.z, p.top, [p.id])); parts.forEach((_, i) => edges.push([platNodes[p.id][i], platNodes[p.id][(i + 1) % parts.length], true])); }
    else platNodes[p.id] = [addNode(p.x, p.z, p.top, [p.id])];
  }
  for (const c of LAY.conns) {
    const A = P[c.a], B = P[c.b], ids = [];
    for (let i = 0; i <= c.n; i += 2) ids.push(i);
    if (ids[ids.length - 1] !== c.n) ids.push(c.n);
    const ks = ids.map((i) => {
      const q = c.chain[i], zones = [c.id];
      if (i === 0) zones.push(c.a); if (i === c.n) zones.push(c.b);
      return addNode(q.x, q.z, q.top, zones);
    });
    for (let j = 0; j < ids.length - 1; j++) {
      const hi = Math.min(ids[j + 1], c.n - 1), ok = !c.bridge || hi <= grown;
      edges.push([ks[j], ks[j + 1], ok]);
    }
    // enganche con los nodos de la plataforma
    const link = (k, plat, part) => {
      if (plat.pit) edges.push([k, platNodes[plat.id][part], true]);
      else for (const o of platNodes[plat.id]) edges.push([k, o, true]);
      if (!plat.pit) platNodes[plat.id].push(k);
    };
    link(ks[0], A, c.pa.part); link(ks[ks.length - 1], B, c.pb.part);
  }
  // en plataformas redondas normales todos los nodos se ven entre sí (disco convexo)
  for (const p of PLATS) if (!p.pit) { const l = platNodes[p.id]; for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) edges.push([l[i], l[j], true]); }
  const N = nodes.length, INF = 1e9, D = new Float32Array(N * N).fill(INF), nxt = new Int16Array(N * N).fill(-1);
  for (let i = 0; i < N; i++) { D[i * N + i] = 0; nxt[i * N + i] = i; }
  for (const [a, b, ok] of edges) if (ok) { const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z); if (d < D[a * N + b]) { D[a * N + b] = D[b * N + a] = d; nxt[a * N + b] = b; nxt[b * N + a] = a; } }
  for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) { const dik = D[i * N + k]; if (dik >= INF) continue; for (let j = 0; j < N; j++) { const v = dik + D[k * N + j]; if (v < D[i * N + j]) { D[i * N + j] = v; nxt[i * N + j] = nxt[i * N + k]; } } }
  return { nodes, byZone, N, D, nxt, INF };
}

export function makeMap4() {
  const rng = makeRng(404);
  const solids = [];
  const floor = []; // discos pisables {x,z,r,top,zone,kind}
  const addFloor = (d, enabled = true) => {
    const s = { type: 'cyl', c: v3(d.x, d.top - M4.THICK / 2, d.z), r: d.r, y0: d.top - M4.THICK, y1: d.top, floor: true };
    return { s, enabled };
  };
  const discSolid = new Map();
  LAY.discs.forEach((d, i) => {
    const { s } = addFloor(d); discSolid.set(i, s);
    if (d.kind === 'bridge') return; // los tramos del puente se añaden al crecer
    solids.push(s); floor.push(d);
  });
  for (const c of LAY.covers) solids.push({ type: 'cyl', c: v3(c.x, c.top + c.h / 2, c.z), r: c.r, y0: c.top - 0.5, y1: c.top + c.h });

  const platCenter = (id, dy = 0) => v3(P[id].x, P[id].top + dy, P[id].z);
  const at = (id, dx, dz, dy = 0) => v3(P[id].x + dx, P[id].top + dy, P[id].z + dz);
  const spots = {
    anchor: at('gar', 0, 0, 0), core: at('viv', 0, -5, 0.9), altar: at('umb', 0, 0, 0.4),
    plates: [at('hub', -9, -9, 0.2), at('hub', 9, 9, 0.2), at('hub', 9, -9, 0.2), at('hub', -9, 9, 0.2)],
    eyes: (n) => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; return v3(Math.cos(a) * 22, 24 + (k % 2) * 6, Math.sin(a) * 22); }),
    boss: v3(0, 30, 0),
    /** Capullos del acertijo: tres rincones lejanos entre sí (el Vivero, la Garganta y el Mirador). */
    capullos: [at('viv', 5, 6, 1.6), at('gar', -5, -6, 1.6), at('mir', 0, -5, 1.6)],
    cultivoSite: v3(P.cam.x + 22, 4, P.cam.z - 30),
  };
  const cults = { sections: LAY.sections.map((s) => s.ids.length), open: LAY.sections.reduce((a, s) => a + s.ids.length, 0) };
  const baseNav = buildNav(0);

  const map = {
    id: 'm4', name: 'Jardín de Carne', solids, walls: undefined, zones: [], portals: [],
    layout: LAY, plats: PLATS, spots, cultivo: cults, floor,
    islands: PLATS.map((p) => ({ x: p.x, z: p.z, r: p.r, top: p.top, y0: p.top - M4.THICK, hang: false })),
    center: v3(20, 10, -10), bounds: 200, voidY: M4.voidY, bossAnchor: v3(0, 30, 0),
    grown: 0, nav: baseNav, walk: floor.slice(),
    playerSpawn(i) { return v3(P.sie.x + ((i % 4) - 1.5) * 2.5, P.sie.top + 0.9, P.sie.z + (i > 3 ? 3 : 0)); },
    gravityAt() { return DOWN; }, timeScaleAt() { return 1; },
    outOfBounds(p) { return p.y < this.voidY || Math.abs(p.x) > 200 || Math.abs(p.z) > 200; },
    islandAt() { return this.islands[0]; },

    /** Copia para una partida: sólidos propios (el puente crece) y navegación recalculable. */
    instance() {
      const inst = Object.create(map);
      inst.solids = solids.slice(); inst.walk = floor.slice(); inst.grown = 0; inst.nav = baseNav;
      return inst;
    },
    /** Activa los discos del puente hasta el número `k` (1..open). Devuelve cuántos se añadieron. */
    growTo(k) {
      k = Math.min(cults.open, Math.max(0, Math.floor(k)));
      if (k <= this.grown) return 0;
      const ids = LAY.br.discIdx; let n = 0;
      for (let j = this.grown; j < k; j++) { const di = ids[j], d = LAY.discs[di]; this.solids.push(discSolid.get(di)); this.walk.push(d); n++; }
      this.grown = k; this.nav = buildNav(k);
      return n;
    },
    bridgeOpen() { return this.grown >= cults.open; },

    /** Zona (id de plataforma o de conexión) bajo un punto; null si está en el aire/vacío. */
    zoneAt(pos, yTol = 2.6) {
      let best = null, bs = Infinity;
      const w = this.walk;
      for (let i = 0; i < w.length; i++) {
        const d = w[i], dx = pos.x - d.x, dz = pos.z - d.z;
        if (dx * dx + dz * dz > (d.r + 0.4) * (d.r + 0.4)) continue;
        const dy = Math.abs(pos.y - (d.top + 0.9));
        if (dy > yTol) continue;
        const sc = dy + (d.kind === 'plat' ? 0 : 0.4);
        if (sc < bs) { bs = sc; best = d.zone; }
      }
      return best;
    },
    /** ¿Hay suelo bajo (x,z) a una altura parecida a y? (para no caminar al vacío) */
    supported(x, z, y) {
      const w = this.walk;
      for (let i = 0; i < w.length; i++) {
        const d = w[i], dx = x - d.x, dz = z - d.z;
        if (dx * dx + dz * dz < d.r * d.r && d.top > y - 3.6 && d.top < y + 1.6) return true;
      }
      return false;
    },
    /** Ajusta una dirección de marcha para no salirse al vacío: prueba el rumbo, luego ±45°, ±90°. */
    guard(pos, dir, reach = 2.6) {
      const l = Math.hypot(dir.x, dir.z); if (l < 1e-6) return dir;
      const ux = dir.x / l, uz = dir.z / l, y = pos.y - 0.9;
      for (const a of [0, 0.7, -0.7, 1.45, -1.45]) {
        const c = Math.cos(a), s = Math.sin(a), vx = ux * c - uz * s, vz = ux * s + uz * c;
        if (this.supported(pos.x + vx * reach, pos.z + vz * reach, y)) return { x: vx * l, y: dir.y, z: vz * l };
      }
      return { x: 0, y: dir.y, z: 0 };
    },
    /** Siguiente punto de ruta de `from` hacia `to`, o null si puede ir derecho. 'none' si no hay camino. */
    navStep(from, to) {
      const zf = this.zoneAt(from, 3.2), zt = this.zoneAt(to, 4.5) || this.zoneAt({ x: to.x, y: from.y, z: to.z }, 9);
      if (!zf || !zt) return null;
      const platF = P[zf], single = platF && !platF.pit;
      if (zf === zt && single) return null;
      const nav = this.nav, N = nav.N, A = nav.byZone[zf] || [], B = nav.byZone[zt] || [];
      let best = nav.INF, ba = -1, bb = -1;
      for (const a of A) { const da = Math.hypot(nav.nodes[a].x - from.x, nav.nodes[a].z - from.z); for (const b of B) { const c = da + nav.D[a * N + b] + Math.hypot(nav.nodes[b].x - to.x, nav.nodes[b].z - to.z); if (c < best) { best = c; ba = a; bb = b; } } }
      if (ba < 0 || best >= nav.INF * 0.5) return 'none';
      if (ba === bb) return null;
      let cur = ba, guard = 0;
      while (cur !== bb && guard++ < 6) {
        const nx = nav.nxt[cur * N + bb]; if (nx < 0) return 'none';
        const nd = nav.nodes[nx];
        if (Math.hypot(nd.x - from.x, nd.z - from.z) > 2.4 || nx === bb) return { x: nd.x, y: nd.y + 0.9, z: nd.z };
        cur = nx;
      }
      const nd = nav.nodes[bb]; return { x: nd.x, y: nd.y + 0.9, z: nd.z };
    },
    /** Dirección que debe seguir una criatura terrestre (reemplaza `wish` sólo si apunta hacia el jugador y hay que dar un rodeo). */
    steer(game, m, wish) {
      const l = Math.hypot(wish.x, wish.z); if (l < 1e-6) return wish;
      let tgt = null, bd = Infinity;
      for (const p of game.players) { if (p.dead) continue; const d = Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z); if (d < bd) { bd = d; tgt = p; } }
      let out = wish;
      if (tgt) {
        const tx = (tgt.pos.x - m.pos.x) / (bd || 1), tz = (tgt.pos.z - m.pos.z) / (bd || 1);
        if ((wish.x * tx + wish.z * tz) / l > 0.3) { // quiere ir hacia el jugador
          const st = this.navStep(m.pos, tgt.pos);
          if (st === 'none') return { x: 0, y: 0, z: 0 };
          if (st) { const dx = st.x - m.pos.x, dz = st.z - m.pos.z, dl = Math.hypot(dx, dz) || 1; out = { x: dx / dl, y: 0, z: dz / dl }; }
        }
      }
      return this.guard(m.pos, out, m.r + 2);
    },

    spawnGround(r, ref) {
      const pool = PLATS.filter((p) => p.id !== 'umb' || this.bridgeOpen());
      const area = pool.map((p) => p.r * p.r);
      const tot = area.reduce((a, b) => a + b, 0);
      for (let i = 0; i < 16; i++) {
        let k = r.next() * tot, j = 0; while (j < pool.length - 1 && (k -= area[j]) > 0) j++;
        const p = pool[j], parts = partsOf(p), q = parts[Math.floor(r.next() * parts.length)];
        const a = r.range(0, 6.2832), rr = Math.sqrt(r.next()) * q.r * 0.75;
        const pt = v3(q.x + Math.cos(a) * rr, p.top + 1.4, q.z + Math.sin(a) * rr);
        // no encima de una columna/quiste
        if (LAY.covers.some((c) => Math.hypot(pt.x - c.x, pt.z - c.z) < c.r + 1.6)) continue;
        const d = Math.hypot(pt.x - ref.x, pt.z - ref.z);
        if (d > 28 && d < 85) return pt;
      }
      let best = null, bd = -1; // plan B: la plataforma más lejana
      for (const p of pool) { const d = Math.hypot(p.x - ref.x, p.z - ref.z); if (d > bd && d < 110) { bd = d; best = p; } }
      const q = partsOf(best || PLATS[0])[0]; return v3(q.x + 2, (best || PLATS[0]).top + 1.4, q.z + 2);
    },
    spawnAir(r, ref, up) { const a = r.range(0, 6.2832), d = r.range(25, 45); return add(add(ref, v3(Math.cos(a) * d, 0, Math.sin(a) * d)), mul(up, r.range(8, 18))); },
    /** Qué objetivo trae la oleada n (si el puente aún no existe, el Núcleo se cambia por el Cultivo). */
    objectiveFor(kind, g) { return kind === 'nucleo' && !(g.cult && g.cult.open) ? 'cultivo' : kind; },
    fx: () => ({}),
  };
  void rng;
  return map;
}
