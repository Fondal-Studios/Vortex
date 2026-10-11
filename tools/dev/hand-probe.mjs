import * as THREE from 'three';
import { Kit, qualityOf } from '/home/user/Shower-psico/src/client/weapons/kit.js';
import { rightHand, triggerFinger, supportHand } from '/home/user/Shower-psico/src/client/weapons/hands.js';
const q = qualityOf('high'); const k = new Kit(q); k.part('main');
k.prof('b', [[-0.06, -0.012], [0.04, -0.012], [0.034, -0.182], [-0.085, -0.182]], 0.044, 0, { c: 0x222222 });
const g = { zc: 0.0, top: -0.014, d: 0.112, hw: 0.022 };
const t0 = Date.now(); const piv = rightHand(k, g, 0xffffff); console.log('pivot', piv, Date.now() - t0, 'ms');
supportHand(k, [0, 0, -0.3], 0.03, 0xffffff);
k.part('trigger', piv); triggerFinger(k, g, piv, 0.03);
for (const [n, p] of Object.entries(k.parts)) { for (const L of ['b','g']) { let tris = 0; const bb = new THREE.Box3(); for (const gg of p[L]) { tris += gg.attributes.position.count / 3; gg.computeBoundingBox(); bb.union(gg.boundingBox); } console.log(n, L, p[L].length, 'geoms', tris, 'tris', bb.min.toArray().map(x=>+x.toFixed(3)), bb.max.toArray().map(x=>+x.toFixed(3))); } }
console.log(k.parts.main.g.map(g=>g.attributes.position.count/3).join(','));
