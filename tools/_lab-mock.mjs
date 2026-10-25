import fs from 'node:fs';
import * as T from 'three';
globalThis.document = globalThis.document || { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, }) , width: 0, height: 0 }) };
const { GEN, construirInstancia, QF } = await import('../src/client/huesped/lab-piezas.js');
const { PARTES, ANCLAS, ORDEN_PARTES } = await import('../src/shared/host-build-catalogo.js');
const { instancias } = await import('../src/shared/host-build.js');
const m = JSON.parse(fs.readFileSync('assets/arcanum/narrative/model.json', 'utf8')), W = {};
m.bones.forEach((b, i) => { const p = b.parent < 0 ? [0, 0, 0] : W[m.bones[b.parent].name]; W[b.name] = [p[0] + b.pos[0], p[1] + b.pos[1], p[2] + b.pos[2]]; });
export function mockAk(quality) {
  let side = null; const rec = { calls: {}, tris: 0, items: [] };
  const mx = (v) => (side === 'R' ? new T.Vector3(-v.x, v.y, v.z) : v.clone());
  const ak = { quality, low: quality === 'low', s: (n, min = 3) => Math.max(min, Math.round(n * (quality === 'low' ? 0.5 : quality === 'high' ? 1.25 : 1))), T,
    P(n) { const c = side ? `${n}_L_h` : `${n}_h`; const w = W[c] || W[`${n}_h`]; if (!w) throw new Error('P ' + n); return new T.Vector3(...w); },
    onSeg: (g) => g,
    add(mat, g, bone, o) { const n = (g.index ? g.index.count : g.attributes.position.count) / 3; rec.tris += n; rec.calls[mat] = (rec.calls[mat] || 0) + n; rec.items.push([mat, bone, n]); return g; },
    one(s, fn) { side = s; fn(); side = null; }, both(fn) { for (const s of ['L', 'R']) { side = s; fn(s); } side = null; },
    chain(name, parent, pts) { return { bones: pts.map((p, i) => ({ name: `${name}${side ? '_' + side : ''}${i}` })) }; },
    mount() { return { add() {} }; }, halo() { rec.halos = (rec.halos || 0) + 1; return {}; }, rec };
  return ak;
}
export function medir(id, ancla, quality = 'low', lado = null) {
  const d = PARTES[id], A = ANCLAS[ancla], ak = mockAk(quality);
  const build = { partes: [{ p: id, a: ancla, sim: 'ninguna', ...(A.lados === 2 ? { l: 'der' } : {}), t: { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1 }, c: { mat: d.variantesMat[0], tinte: null } }] };
  const ins = instancias(build)[0]; const ctx = { pal: { primario: '#7a3a1c', secundario: '#2b2430', emisivo: '#ff7a22' } };
  construirInstancia(ak, ins, ctx); return ak.rec;
}
if (process.argv[1].endsWith('_lab-mock.mjs')) {
  for (const id of ORDEN_PARTES) { const d = PARTES[id], a = d.anclas[0]; const out = []; for (const q of ['low', 'medium', 'high']) { try { const r = medir(id, a, q); out.push(Math.round(r.tris)); } catch (e) { out.push('ERR ' + e.message.slice(0, 50)); } } console.log(id.padEnd(20), a.padEnd(10), 'tabla', d.tris.low, d.tris.medium, d.tris.high, '| medido', out.join(' '), '| mats', Object.keys(medir(id, a, 'low').calls).join(','), 'esperado', d.mats.join(',')); }
}
