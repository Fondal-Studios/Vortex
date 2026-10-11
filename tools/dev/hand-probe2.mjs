import { qualityOf } from '../../src/client/weapons/kit.js';
import { BUILD } from '../../src/client/weapons/guns.js';
import '../../src/client/weapons/guns2.js';
import '../../src/client/weapons/guns3.js';
// uso: node tools/dev/hand-probe2.mjs [high|low]  -> milisegundos y triángulos de la capa 'g' (manos) por arma
globalThis.document = globalThis.document || { createElement: () => ({ getContext: () => ({ createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {}, measureText: () => ({ width: 0 }) }), width: 0, height: 0 }) };
globalThis.__HANDDBG = true; const ql = process.argv[2] || 'high'; console.log('armas', BUILD.length);
for (let w = 0; w < BUILD.length; w++) { const t0 = Date.now(); try { const W = BUILD[w](qualityOf(ql), true); let tris = 0, calls = 0; W.group.traverse((o) => { if (o.isMesh && o.name.endsWith('.g')) { tris += o.geometry.attributes.position.count / 3; calls++; } }); console.log(w, Date.now() - t0, 'ms', 'manos', Math.round(tris), 'tris', calls, 'mallas'); } catch (e) { console.log(w, 'ERR', e.message.slice(0, 100)); } }
