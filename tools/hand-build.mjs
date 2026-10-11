// Prepara la malla orgánica de la mano para el juego (se corre una vez; el resultado se versiona).
//   node tools/hand-build.mjs [lo_tris=1100] [hi_tris=3400]
// Entrada: assets/hands/fp_arm_source.json (MakeHuman CC0, ver assets/hands/CREDITS.md).
// Pasos: 1) pasa todo a un marco local de la mano (X = lado del pulgar, Y = dorso, Z = hacia los dedos; mano DERECHA),
//        2) recorta (mano + 11 cm de antebrazo), 3) funde los huesos del brazo en el hueso «mano»,
//        4) simplifica por colapso de aristas (quádricas) conservando pesos de dedos, 5) escribe JSON + módulo JS con los datos en base64.
import fs from 'node:fs';
const LO = +(process.argv[2] || 1100), HI = +(process.argv[3] || 3400);
const src = JSON.parse(fs.readFileSync('assets/hands/fp_arm_source.json', 'utf8'));
const b64 = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const n0 = src.count, P0 = b64(src.position, Float32Array), N0 = b64(src.normal, Float32Array), SI0 = b64(src.skinIndex, Uint8Array), SW0 = b64(src.skinWeight, Float32Array), IX0 = b64(src.index, Uint16Array);
const bp = Object.fromEntries(src.bones.map((b) => [b.name, b.pos]));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const W = bp.hand; let F = norm(sub(bp.middle1, W)); let D = src.dorsal.slice(); const k = dot(D, F); D = norm([D[0] - F[0] * k, D[1] - F[1] * k, D[2] - F[2] * k]); const X = cross(D, F);
const toC = (p) => { const v = sub(p, W); return [dot(v, X), dot(v, D), dot(v, F)]; }, toCn = (v) => [dot(v, X), dot(v, D), dot(v, F)];

// ── 1-3: recorte y marco local ───────────────────────────────────────────────
const keepV = new Int32Array(n0).fill(-1), P = [], N = [], SI = [], SW = [];
const mapBone = (b) => (b <= 2 ? 16 : b === 3 ? 0 : b - 3); // upperarm/forearm/twist -> hueso 16 («brazo»), hand -> 0, thumb1.. = 1..15
for (let i = 0; i < n0; i++) {
  const p = toC([P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]]); if (p[2] < -0.115) continue;
  keepV[i] = P.length; P.push(p); N.push(toCn([N0[i * 3], N0[i * 3 + 1], N0[i * 3 + 2]]));
  const acc = new Map(); for (let j = 0; j < 4; j++) { const w = SW0[i * 4 + j]; if (w > 0) acc.set(mapBone(SI0[i * 4 + j]), (acc.get(mapBone(SI0[i * 4 + j])) || 0) + w); }
  const arr = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4); const s = arr.reduce((t, e) => t + e[1], 0) || 1;
  SI.push(arr.map((e) => e[0])); SW.push(arr.map((e) => e[1] / s));
}
let faces = []; for (let t = 0; t < IX0.length / 3; t++) { const a = keepV[IX0[t * 3]], b = keepV[IX0[t * 3 + 1]], c = keepV[IX0[t * 3 + 2]]; if (a >= 0 && b >= 0 && c >= 0) faces.push([a, b, c]); }
console.log('recorte:', P.length, 'vértices,', faces.length, 'triángulos');
const bones = [{ name: 'hand', parent: -1, pos: toC(W) }];
for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) for (let j = 1; j <= 3; j++) bones.push({ name: f + j, parent: j === 1 ? 0 : bones.length - 1, pos: toC(bp[f + j]) });
bones.push({ name: 'arm', parent: -1, pos: toC(W) });
const tips = Object.fromEntries(Object.entries(src.tips).map(([k2, v]) => [k2, toC(v)]));

// ── 4: simplificación por quádricas ──────────────────────────────────────────
function simplify(P, N, SI, SW, faces, target) {
  const nv = P.length, pos = P.map((p) => p.slice()), nor = N.map((p) => p.slice());
  const wts = SW.map((w, i) => { const m = new Float64Array(17); SI[i].forEach((b, j) => { m[b] += w[j]; }); return m; });
  const F2 = faces.map((f) => f.slice()), alive = new Uint8Array(F2.length).fill(1), vf = Array.from({ length: nv }, () => new Set()); F2.forEach((f, i) => f.forEach((v) => vf[v].add(i)));
  const Q = Array.from({ length: nv }, () => new Float64Array(10)), addPlane = (q, a, b, c, d, w) => { const v = [a * a, a * b, a * c, a * d, b * b, b * c, b * d, c * c, c * d, d * d]; for (let i = 0; i < 10; i++) q[i] += v[i] * w; };
  const planeOf = (f) => { const A = pos[f[0]], B = pos[f[1]], C = pos[f[2]], u = sub(B, A), v = sub(C, A), nn = cross(u, v), ar = Math.hypot(...nn) / 2; if (ar < 1e-12) return null; const m = norm(nn); return { n: m, d: -dot(m, A), ar }; };
  F2.forEach((f) => { const pl = planeOf(f); if (!pl) return; for (const v of f) addPlane(Q[v], pl.n[0], pl.n[1], pl.n[2], pl.d, pl.ar); });
  const edgeFaces = new Map(), ek = (a, b) => (a < b ? a * 1e6 + b : b * 1e6 + a); F2.forEach((f, i) => { for (let e = 0; e < 3; e++) { const a = f[e], b = f[(e + 1) % 3], key = ek(a, b); if (!edgeFaces.has(key)) edgeFaces.set(key, []); edgeFaces.get(key).push(i); } });
  for (const [key, fl] of edgeFaces) if (fl.length === 1) { // borde abierto: plano perpendicular que lo protege
    const f = F2[fl[0]], pl = planeOf(f); if (!pl) continue; let a = -1, b = -1; for (let e = 0; e < 3; e++) { const x = f[e], y = f[(e + 1) % 3]; if (ek(x, y) === key) { a = x; b = y; } }
    const ed = sub(pos[b], pos[a]), pn = norm(cross(ed, pl.n)), d = -dot(pn, pos[a]), L = Math.hypot(...ed); for (const v of [a, b]) addPlane(Q[v], pn[0], pn[1], pn[2], d, 40 * L * L);
  }
  const ver = new Int32Array(nv), dead = new Uint8Array(nv), nb = (v) => { const s = new Set(); for (const fi of vf[v]) for (const w of F2[fi]) if (w !== v) s.add(w); return s; };
  const errAt = (q, p) => { const [x, y, z] = p; return q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x + q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y + q[7] * z * z + 2 * q[8] * z + q[9]; };
  const cand = (u, v) => {
    const q = Q[u].map((x, i) => x + Q[v][i]), mid = [(pos[u][0] + pos[v][0]) / 2, (pos[u][1] + pos[v][1]) / 2, (pos[u][2] + pos[v][2]) / 2], opts = [pos[u], pos[v], mid];
    const a = [[q[0], q[1], q[2]], [q[1], q[4], q[5]], [q[2], q[5], q[7]]], bb = [-q[3], -q[6], -q[8]];
    const det = a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
    if (Math.abs(det) > 1e-14) { const inv = (m) => { const c = (r, cc) => m[(r + 1) % 3][(cc + 1) % 3] * m[(r + 2) % 3][(cc + 2) % 3] - m[(r + 1) % 3][(cc + 2) % 3] * m[(r + 2) % 3][(cc + 1) % 3]; return [0, 1, 2].map((r) => [0, 1, 2].map((cc) => c(cc, r) / det)); };
      const iv = inv(a), o = [0, 1, 2].map((r) => iv[r][0] * bb[0] + iv[r][1] * bb[1] + iv[r][2] * bb[2]), L = Math.hypot(...sub(pos[u], pos[v])); if (Math.hypot(...sub(o, mid)) < L * 0.9) opts.push(o); }
    let best = null, be = Infinity; for (const o of opts) { const e = errAt(q, o); if (e < be) { be = e; best = o; } } return { p: best, e: Math.max(0, be), q };
  };
  // montículo binario
  const heap = []; const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa].e <= heap[i].e) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l].e < heap[m].e) m = l; if (r < heap.length && heap[r].e < heap[m].e) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const enqueue = (u, v) => { const c = cand(u, v); push({ e: c.e, u, v, vu: ver[u], vv: ver[v], p: c.p }); };
  const done = new Set(); for (const [key] of edgeFaces) { const u = Math.floor(key / 1e6), v = key % 1e6; enqueue(u, v); }
  let nf = F2.length;
  while (nf > target && heap.length) {
    const it = pop(); if (dead[it.u] || dead[it.v] || ver[it.u] !== it.vu || ver[it.v] !== it.vv) continue;
    const { u, v } = it, nu = nb(u), nvv = nb(v); let common = 0; for (const w of nu) if (nvv.has(w)) common++;
    const shared = [...vf[u]].filter((fi) => vf[v].has(fi)); if (shared.length === 0) continue;
    const bnd = shared.length === 1; if (common > (bnd ? 1 : 2)) continue;
    // no voltear triángulos
    let ok = true; const p = it.p;
    for (const [from, to] of [[u, v], [v, u]]) for (const fi of vf[from]) { if (shared.includes(fi)) continue; const f = F2[fi], old = planeOf(f); const m = f.map((x) => (x === from ? p : pos[x])); const un = sub(m[1], m[0]), vn = sub(m[2], m[0]), nn = cross(un, vn), l = Math.hypot(...nn); if (l < 1e-10) { ok = false; break; } if (old && dot(norm(nn), old.n) < 0.25) { ok = false; break; } }
    if (!ok) continue;
    // fusiona: v -> u
    const du = Math.hypot(...sub(p, pos[u])), dv = Math.hypot(...sub(p, pos[v])), tu = dv / (du + dv + 1e-12);
    for (let b = 0; b < 17; b++) wts[u][b] = wts[u][b] * tu + wts[v][b] * (1 - tu);
    nor[u] = norm([nor[u][0] * tu + nor[v][0] * (1 - tu), nor[u][1] * tu + nor[v][1] * (1 - tu), nor[u][2] * tu + nor[v][2] * (1 - tu)]);
    pos[u] = p.slice(); for (let i = 0; i < 10; i++) Q[u][i] += Q[v][i];
    for (const fi of [...vf[v]]) { if (shared.includes(fi)) { alive[fi] = 0; nf--; for (const x of F2[fi]) vf[x].delete(fi); continue; } F2[fi] = F2[fi].map((x) => (x === v ? u : x)); vf[v].delete(fi); vf[u].add(fi); }
    dead[v] = 1; ver[u]++; for (const w of nb(u)) { ver[w] += 0; enqueue(u, w); }
  }
  // compacta
  const map = new Int32Array(nv).fill(-1), oP = [], oN = [], oSI = [], oSW = [], oF = [];
  F2.forEach((f, i) => { if (!alive[i]) return; oF.push(f.map((v) => { if (map[v] < 0) { map[v] = oP.length; oP.push(pos[v]); oN.push(nor[v]); const arr = [...wts[v]].map((w, b) => [b, w]).sort((a, b) => b[1] - a[1]).slice(0, 4), s = arr.reduce((t, e) => t + e[1], 0) || 1; oSI.push(arr.map((e) => e[0])); oSW.push(arr.map((e) => e[1] / s)); } return map[v]; })); });
  return { P: oP, N: oN, SI: oSI, SW: oSW, F: oF };
}

// ── 5: salida ────────────────────────────────────────────────────────────────
function pack(m) {
  const n = m.P.length, pos = new Int16Array(n * 3), nor = new Int8Array(n * 3), si = new Uint8Array(n * 4), sw = new Uint8Array(n * 4), ix = new Uint16Array(m.F.length * 3);
  m.P.forEach((p, i) => { for (let a = 0; a < 3; a++) pos[i * 3 + a] = Math.round(p[a] * 10000); const nn = norm(m.N[i]); for (let a = 0; a < 3; a++) nor[i * 3 + a] = Math.round(nn[a] * 127); });
  m.SI.forEach((s, i) => { let acc = 0; for (let j = 0; j < 4; j++) { si[i * 4 + j] = s[j] ?? 0; const w = j < s.length ? Math.round(m.SW[i][j] * 255) : 0; sw[i * 4 + j] = w; acc += w; } sw[i * 4] += 255 - acc; });
  m.F.forEach((f, i) => { ix[i * 3] = f[0]; ix[i * 3 + 1] = f[1]; ix[i * 3 + 2] = f[2]; });
  const e = (a) => Buffer.from(a.buffer).toString('base64');
  return { n, tris: m.F.length, pos: e(pos), nor: e(nor), si: e(si), sw: e(sw), ix: e(ix) };
}
const out = { source: 'MakeHuman CC0 vía Duelo Arcano fp_arm.json; recortado y simplificado con tools/hand-build.mjs', frame: 'X lado del pulgar, Y dorso, Z hacia los dedos; mano derecha; origen en la muñeca; metros (pos = int16/10000)', bones: bones.map((b) => ({ ...b, pos: b.pos.map((x) => +x.toFixed(5)) })), tips: Object.fromEntries(Object.entries(tips).map(([k2, v]) => [k2, v.map((x) => +x.toFixed(5))])) };
for (const [name, tgt] of [['lo', LO], ['hi', HI]]) {
  const t0 = Date.now(), m = simplify(P, N, SI, SW, faces, tgt); out[name] = pack(m); console.log(name, m.P.length, 'vértices', m.F.length, 'triángulos', Date.now() - t0, 'ms');
  fs.writeFileSync(`assets/hands/hand_${name}.json`, JSON.stringify({ ...out, [name]: out[name] }));
}
const js = `// GENERADO por tools/hand-build.mjs a partir de assets/hands/fp_arm_source.json (MakeHuman CC0). No editar a mano.\n// Mano derecha en marco local: X lado del pulgar · Y dorso · Z hacia los dedos · origen en la muñeca · pos = int16/10000 m.\nexport const HAND_DATA = ${JSON.stringify(out)};\n`;
fs.writeFileSync('src/client/weapons/hand-data.js', js); console.log('hand-data.js', (js.length / 1024).toFixed(0), 'KB');
