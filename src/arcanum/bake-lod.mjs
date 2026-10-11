// Herramienta de UN SOLO USO (Node): genera las mallas de bajo detalle (LOD) de las personas para iPhone / calidad «low».
// Salida (se commitea): assets/arcanum/narrative/lod.json + lod.bin  (mismo formato que model.json/*.bin; ya vienen con la
// máscara de ropa aplicada y sin la córnea de los ojos).
//
//   cd <repo> && npm i --no-save meshoptimizer          # sólo herramienta de build; no queda en package.json
//   node src/arcanum/bake-lod.mjs                         # (o: MESHOPT_DIR=/ruta/donde/instalaste node src/arcanum/bake-lod.mjs)
//
// Decimado por colapso de aristas (meshoptimizer.simplifyWithAttributes) con peso de normales y UV; la cabeza y las manos
// se simplifican por separado y con menos agresividad (en la cara se nota). Las posiciones no se mueven, así que
// piel/ropa/huesos/animaciones siguen valiendo igual. Presupuesto (triángulos): ver OBJETIVOS.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../assets/arcanum/narrative');
const req = createRequire(path.join(process.env.MESHOPT_DIR || process.cwd(), 'x.js'));
const { MeshoptSimplifier } = req('meshoptimizer');
await MeshoptSimplifier.ready;

const model = JSON.parse(fs.readFileSync(path.join(root, 'model.json'), 'utf8'));
const boneNames = model.bones.map((b) => b.name);
const masksBin = fs.readFileSync(path.join(root, 'body-masks.bin'));
const TYPES = { '<f4': Float32Array, '<u4': Uint32Array, '<u2': Uint16Array };

// Triángulos objetivo por pieza (low: ≈ 9 k en total con ropa, pelo, ojos y calzado).
const OBJETIVOS = {
  cuerpo: { cabeza: 1500, manos: 480, resto: 1500 }, // (el cuerpo ya viene sin la piel tapada por la ropa)
  ropa: { male_casualsuit01: 2300, female_elegantsuit01: 2000, male_worksuit01: 2300 },
  pelo: 0.45, calzado: 900, ojos: 280,
};

function loadMesh(name) {
  const m = model.meshes[name], buf = fs.readFileSync(path.join(root, m.file)), attrs = {};
  for (const [k, a] of Object.entries(m.attributes)) { const T = TYPES[a.type]; attrs[k] = { arr: new T(buf.buffer.slice(buf.byteOffset + a.offset, buf.byteOffset + a.offset + a.count * a.width * T.BYTES_PER_ELEMENT)), width: a.width, type: a.type }; }
  return attrs;
}
const dominant = (attrs, i) => { let best = 0; for (let k = 1; k < 4; k++) if (attrs.skinWeight.arr[i * 4 + k] > attrs.skinWeight.arr[i * 4 + best]) best = k; return boneNames[attrs.skinIndex.arr[i * 4 + best]]; };

/** Simplifica `index` hasta ≈ `target` triángulos; sólo se mueven (colapsan) los vértices con lock[v] = 0. */
function simplify(attrs, index, target, lock = null, error = 0.05) {
  const pos = attrs.position.arr, n = pos.length / 3, A = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) { A.set(attrs.normal.arr.subarray(i * 3, i * 3 + 3), i * 5); A.set(attrs.uv.arr.subarray(i * 2, i * 2 + 2), i * 5 + 3); }
  const [out] = MeshoptSimplifier.simplifyWithAttributes(index, pos, 3, A, 5, [0.6, 0.6, 0.6, 3.0, 3.0], lock, Math.min(index.length, Math.max(3, Math.round(target)) * 3), error, []);
  return out;
}
/** Cuerpo: cabeza (y > 1,44), manos y resto por separado; los vértices de unión se bloquean. */
function regionOf(attrs, v) {
  if (attrs.position.arr[v * 3 + 1] > 1.44) return 1;
  const b = dominant(attrs, v); return /^(finger|wrist|metacarpal)/.test(b) ? 2 : 0;
}
function simplifyBody(attrs, index) {
  const n = attrs.position.arr.length / 3, reg = new Uint8Array(n); for (let v = 0; v < n; v++) reg[v] = regionOf(attrs, v);
  const border = new Uint8Array(n);
  for (let t = 0; t < index.length; t += 3) { const a = reg[index[t]], b = reg[index[t + 1]], c = reg[index[t + 2]]; if (a !== b || b !== c) { border[index[t]] = border[index[t + 1]] = border[index[t + 2]] = 1; } }
  let cur = index;
  for (const [r, name] of [[1, 'cabeza'], [2, 'manos'], [0, 'resto']]) {
    const lock = new Uint8Array(n); let inside = 0;
    for (let v = 0; v < n; v++) lock[v] = reg[v] !== r || border[v] ? 1 : 0;
    for (let t = 0; t < cur.length; t += 3) if (reg[cur[t]] === r && reg[cur[t + 1]] === r && reg[cur[t + 2]] === r) inside++;
    const total = cur.length / 3, want = total - inside + OBJETIVOS.cuerpo[name];
    cur = simplify(attrs, cur, want, lock, 0.08);
  }
  return cur;
}

const out = { meshes: {} }, chunks = []; let offset = 0;
function pad4() { const p = (4 - (offset % 4)) % 4; if (p) { chunks.push(Buffer.alloc(p)); offset += p; } }
/** Compacta (sólo vértices usados) y escribe la malla en lod.bin. */
function emit(name, attrs, index) {
  const used = new Map(), list = []; for (const i of index) if (!used.has(i)) { used.set(i, list.length); list.push(i); }
  const meta = { file: 'lod.bin', attributes: {}, triangles: index.length / 3 };
  for (const [k, a] of Object.entries(attrs)) {
    if (k === 'index') continue; const T = a.arr.constructor, arr = new T(list.length * a.width);
    list.forEach((src, dst) => { for (let c = 0; c < a.width; c++) arr[dst * a.width + c] = a.arr[src * a.width + c]; });
    pad4(); meta.attributes[k] = { offset: offset, count: list.length, width: a.width, type: a.type }; const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); chunks.push(b); offset += b.length;
  }
  const idx = new Uint32Array(index.length); for (let i = 0; i < index.length; i++) idx[i] = used.get(index[i]);
  pad4(); meta.attributes.index = { offset, count: idx.length, width: 1, type: '<u4' }; chunks.push(Buffer.from(idx.buffer)); offset += idx.byteLength;
  out.meshes[name] = meta; console.log(name.padEnd(34), String(meta.triangles).padStart(6), 'triángulos', String(list.length).padStart(6), 'vértices');
}

// cuerpo: uno por prenda (con la piel tapada ya recortada) y uno desnudo
const body = loadMesh('body');
for (const outfit of Object.keys(model.bodyMasks)) {
  const m = model.bodyMasks[outfit]; const idx = new Uint32Array(masksBin.buffer.slice(masksBin.byteOffset + m.offset, masksBin.byteOffset + m.offset + m.count * 4));
  emit('body@' + outfit, body, simplifyBody(body, idx));
}
emit('body@none', body, simplifyBody(body, body.index.arr));
// ropa
for (const [o, t] of Object.entries(OBJETIVOS.ropa)) { const a = loadMesh(o); emit(o, a, simplify(a, a.index.arr, t, null, 0.06)); }
// pelo (tarjetas con alfa: menos agresivo) y cejas (tal cual)
for (const h of ['short01', 'short02', 'short04', 'bob02', 'long01', 'ponytail01']) { const a = loadMesh(h), n = a.index.arr.length / 3; emit(h, a, n < 1200 ? a.index.arr : simplify(a, a.index.arr, Math.max(900, n * OBJETIVOS.pelo), null, 0.06)); }
for (const e of ['eyebrow001', 'eyebrow010']) { const a = loadMesh(e); emit(e, a, a.index.arr); }
// calzado y ojos (sólo el globo; la córnea no se dibuja en low)
{ const a = loadMesh('shoes02'); emit('shoes02', a, simplify(a, a.index.arr, OBJETIVOS.calzado, null, 0.06)); }
{
  const a = loadMesh('HighPolyEyes'), idx = a.index.arr, uv = a.uv.arr, globe = [];
  for (let t = 0; t < idx.length; t += 3) { let u = 0, v = 0; for (let k = 0; k < 3; k++) { u += uv[idx[t + k] * 2]; v += uv[idx[t + k] * 2 + 1]; } if (!(u / 3 > 0.85 && v / 3 < 0.15)) globe.push(idx[t], idx[t + 1], idx[t + 2]); }
  emit('HighPolyEyes', a, simplify(a, new Uint32Array(globe), OBJETIVOS.ojos, null, 0.1));
}
fs.writeFileSync(path.join(root, 'lod.bin'), Buffer.concat(chunks));
fs.writeFileSync(path.join(root, 'lod.json'), JSON.stringify({ fuente: 'bake-lod.mjs (meshoptimizer) sobre las mallas MakeHuman CC0 de model.json', ...out }));
console.log('lod.bin', (offset / 1048576).toFixed(2), 'MB');
