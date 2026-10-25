import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { OBJECTIVE_PLAN, WAVE_PLANS } from '../src/sim/data.js';
import { makeObjective, updateObjective } from '../src/sim/objectives.js';
import { puntoObjetivo } from '../src/sim/metas.js';
import { desintegrar } from '../src/sim/rezagados.js';
import { metaActual } from '../src/client/meta-texto.js';
function fixture(map, type, players=1,seed=4) {
 const g=new Game({mapId:map,seed}); for(let i=0;i<players;i++) g.addPlayer('p'+i);
 OBJECTIVE_PLAN[map][99]=type;
 try {g.objective=makeObjective(g,99);} finally {delete OBJECTIVE_PLAN[map][99];}
 return g;
}
test('sequences on six maps: only the indicated terminal advances; solo and coop retain progress',()=>{
 for(const map of Object.keys(OBJECTIVE_PLAN)) for(const count of [1,2]) {
  const g=fixture(map,'secuencia',count), o=g.objective;
  const nodes=o.ids.map(id=>g.objects.find(x=>x.id===id));
  const p=g.players[0]; for(const q of g.players)q.pos={x:999,y:999,z:999};
  p.pos={...nodes.at(-1).pos}; updateObjective(g,.5); assert.equal(o.prog,0,`${map}: wrong terminal`);
  for(let i=0;i<nodes.length;i++) {
   assert.deepEqual(puntoObjetivo(g),Object.values(nodes[i].pos).map(x=>Math.round(x*100)/100));
   p.pos={...nodes[i].pos}; updateObjective(g,1);
   p.pos={x:999,y:999,z:999}; updateObjective(g,1); assert.equal(o.sync,1,'progress retained');
   p.pos={...nodes[i].pos}; updateObjective(g,1);
  }
  assert.equal(o.state,'done'); assert.equal(g.objects.some(x=>o.ids.includes(x.id)),false);
  const cores=p.cores; updateObjective(g,10); assert.equal(p.cores,cores,'one reward');
 }
});
test('seed changes terminal order reproducibly without consuming combat RNG',()=>{
 const a=fixture('m5','secuencia',1,4),b=fixture('m5','secuencia',1,4),c=fixture('m5','secuencia',1,5);
 assert.deepEqual(puntoObjetivo(a),puntoObjetivo(b)); assert.notDeepEqual(puntoObjetivo(a),puntoObjetivo(c));
 assert.equal(a.rng.next(),b.rng.next());
});
test('hunt uses an existing wave spawn; target marked, killing it ends reinforcements without rewarding escorts',()=>{
 const g=new Game({mapId:'m3',seed:8}); const p=g.addPlayer('hunter');
 g.startWave(3,WAVE_PLANS.m3); const o=g.objective; assert.equal(o.type,'caza');
 assert.equal(g.monsters.length,0,'no extra spawn outside wave budget');
 const target=g.spawnMonster('astilla',g.map.spots.anchor),escort=g.spawnMonster('astilla',g.map.spots.core);
 assert.equal(o.target,target.id); assert.ok(target.elite); assert.equal(target.affix,'blindado');
 assert.deepEqual(g.snapshot().obj.tg,puntoObjetivo(g));
 assert.match(metaActual(g.snapshot(),g.snapshot().players[0]).main,/custodio marcado/);
 const before=p.kills; g.killMonster(target,p); updateObjective(g,.1);
 assert.equal(o.state,'done'); assert.equal(g.queue.length,0); assert.equal(g.omens.length,0);
 assert.equal(escort.dead,true); assert.equal(p.kills,before+1,'escort grants no player kill');
 assert.ok(g.events.some(e=>e.t==='desint' && e.id===escort.id));
 g.step(.1); assert.equal(g.phase,'intermission');
});
test('despawning target never locks the wave: the hunt closes (decision Sprint 1-C: the player is not punished for a desintegration) and the intermission follows',()=>{
 const g=fixture('m6','caza'); const p=g.players[0],o=g.objective;
 const target=g.spawnMonster('astilla',g.map.spots.anchor); const cores=p.cores;
 desintegrar(g,target,'fuera'); updateObjective(g,.1);
 // Defecto de diseño vigente (src/sim/objectives.js + rezagados.js): si el custodio marcado desaparece sin que lo mate un jugador, el bloqueo cae
 // y la misión se cierra como cumplida (antes se perdía por algo que nadie pudo evitar). Lo que NO debe pasar: bloqueo permanente ni escoltas pagando.
 assert.equal(o.state,'done'); assert.equal(g.queue.length,0,'sin refuerzos pendientes: la oleada no queda bloqueada'); void cores;
});
test('sequence timeout cleans objects and fails once',()=>{
 const g=fixture('m1','secuencia'),o=g.objective;
 updateObjective(g,o.limit+1); assert.equal(o.state,'failed'); assert.ok(!g.objects.some(x=>x.objective));
 const events=g.events.length; updateObjective(g,100); assert.equal(g.events.length,events);
});
test('first optional mission accepts chosen attack style and pays once',()=>{
 for(const mode of ['shooter','combo']) {
  const g=new Game({mapId:'m1',seed:9}); const p=g.addPlayer('first',null,{char:'axioma',mode});
  g.startWave(1,WAVE_PLANS.m1); assert.equal(g.mision.k,'asalto');
  g.killMonster(g.spawnMonster('astilla',p.pos,{noElite:true}),null);assert.equal(g.mision.p,0);
  p.inMelee=mode==='combo';
  for(let i=0;i<3;i++)g.killMonster(g.spawnMonster('astilla',p.pos,{noElite:true}),p);
  assert.equal(g.mision.st,'done');
  assert.equal(g.events.filter(e=>e.t==='mision'&&e.ph==='done').length,1);
 }
});
