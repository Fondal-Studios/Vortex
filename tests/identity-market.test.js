import test from 'node:test';
import assert from 'node:assert/strict';
import { HOST_IDS } from '../src/sim/data.js';
import { MAP_IDS } from '../src/sim/maps.js';
import { HOST_IDENTITY, ARENA_IDENTITY, CONTENT_GATES, evaluateGate } from '../src/shared/identity.js';
import { COSMETICS, cleanCosmetics, purchaseCosmetic, equipCosmetic } from '../src/shared/cosmetics.js';
import { applyCosmeticMaterials } from '../src/client/cosmetic-material.js';
import * as T from 'three';

test('identity covers every live arena and host, with unique motifs and silhouettes',()=>{
 assert.deepEqual(Object.keys(HOST_IDENTITY).sort(),[...HOST_IDS].sort()); assert.deepEqual(Object.keys(ARENA_IDENTITY).sort(),[...MAP_IDS].sort());
 assert.equal(new Set(Object.values(ARENA_IDENTITY).map(a=>a.cue)).size,MAP_IDS.length);
 assert.equal(new Set(Object.values(HOST_IDENTITY).map(h=>h.silhouette)).size,HOST_IDS.length);
});
test('cosmetic purchase debits exactly once, equipment is host-bound, gameplay untouched',()=>{
 const p={cores:400,hp:100,evo:{axioma:2},cosmetics:cleanCosmetics(null)}, before=JSON.stringify(p.evo);
 assert.equal(purchaseCosmetic(p,'axioma_porcelana').ok,true);assert.equal(p.cores,220);
 assert.equal(purchaseCosmetic(p,'axioma_porcelana').ok,false);assert.equal(p.cores,220);
 assert.equal(equipCosmetic(p,'vesper','axioma_porcelana'),false);assert.equal(equipCosmetic(p,'axioma','axioma_porcelana'),true);
 assert.equal(equipCosmetic(p,'axioma','axioma_obsidiana'),false);assert.equal(p.hp,100);assert.equal(JSON.stringify(p.evo),before);
});
test('planned products, malformed balances and unknown products cannot be purchased',()=>{
 for(const cores of [NaN,Infinity,-1,1.2,0]){const p={cores};assert.equal(purchaseCosmetic(p,'axioma_porcelana').ok,false);assert.ok(Object.is(p.cores,cores));}
 const p={cores:10000};for(const id of ['axioma_aurico','bad','__proto__']) assert.equal(purchaseCosmetic(p,id).ok,false); assert.equal(p.cores,10000);
});
test('migration drops forged planned ownership, wrong-host equip and unknown IDs',()=>{
 const c=cleanCosmetics({owned:['axioma_aurico','bad','axioma_porcelana','axioma_porcelana'],equipped:{axioma:'axioma_aurico',vesper:'axioma_porcelana',seraf:'seraf_archivo'}});
 assert.deepEqual(c,{owned:['axioma_porcelana'],equipped:{seraf:'seraf_archivo'}});
});
test('finishes change surfaces, never emission, opacity, geometry or ability identity',()=>{
 const kit={mats:{metal:new T.MeshStandardMaterial({emissive:0x123456}),bone:new T.MeshStandardMaterial(),gold:new T.MeshStandardMaterial(),light:new T.MeshBasicMaterial({color:0xabcdef})}};
 for(const c of Object.values(COSMETICS)) {applyCosmeticMaterials(kit,c.host,c.id);assert.equal(kit.mats.metal.emissive.getHex(),0x123456);assert.equal(kit.mats.metal.opacity,1);assert.equal(kit.mats.light.color.getHex(),0xabcdef);}
 Object.values(kit.mats).forEach(m=>m.dispose());
});
test('gates fail on absent evidence or a single weak criterion, regardless of average',()=>{
 for(const [type,keys] of Object.entries(CONTENT_GATES)){const scores=Object.fromEntries(keys.map(k=>[k,8])),evidence=Object.fromEntries(keys.map(k=>[k,'capture.png']));assert.equal(evaluateGate(type,scores,evidence).pass,true);scores[keys[0]]=6;assert.equal(evaluateGate(type,scores,evidence).pass,false);scores[keys[0]]=10;delete evidence[keys[1]];assert.equal(evaluateGate(type,scores,evidence).pass,false);}
});
test('every host has a render surface covered by its finish, including mirror and organic shells',()=>{
 const surfaces={axioma:'metal',vesper:'bone',micelio:'bark',umbra:'mirror',seraf:'gold',colmena:'marble',danzante:'bone',singular:'stone'};
 for(const [host,surface] of Object.entries(surfaces)){const m=new T.MeshStandardMaterial({vertexColors:true}),kit={mats:{[surface]:m}};applyCosmeticMaterials(kit,host,`${host}_porcelana`);const porcelain=m.color.getHex();applyCosmeticMaterials(kit,host,`${host}_obsidiana`);assert.notEqual(m.color.getHex(),porcelain,host);assert.equal(m.opacity,1);m.dispose();}
});
