import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { WAVE_PLANS } from '../src/sim/data.js';
import { feedCapullo, tickCultivo } from '../src/sim/cultivo.js';
import { OPERATIONS } from '../src/sim/operations.js';
import { updateObjective } from '../src/sim/objectives.js';
import { metaActual } from '../src/client/meta-texto.js';
import { SECCIONES } from '../src/client/menu-nav.js';
const g_cfg=(map)=>new Game({mapId:map,operation:true}).cfg.stages;
function setup(map='m1', count=1) { const g=new Game({mapId:map,operation:true,seed:12}); for(let i=0;i<count;i++)g.addPlayer('P'+i); return g; }
function complete(g) {
 const o=g.objective, p=g.players[0], objects=()=>o.ids.map(id=>g.objects.find(x=>x.id===id));
 if(o.type==='secuencia') for(const t of objects()){p.pos={...t.pos};updateObjective(g,2.1);}
 if(o.type==='ancla'){p.pos={...objects()[0].pos};updateObjective(g,36);}
 if(o.type==='nucleo'){const [core,altar]=objects();p.pos={...core.pos};updateObjective(g,.1);p.pos={...altar.pos};updateObjective(g,.1);}
 if(o.type==='caza'){const m=g.spawnMonster('astilla',g.map.spots.anchor);g.killMonster(m,p);updateObjective(g,.1);}
 if(o.type==='cultivo'){for(const ob of objects())for(let i=0;i<20;i++)feedCapullo(g,ob,50,p);for(let i=0;i<4;i++)tickCultivo(g,5);updateObjective(g,.1);}
 assert.equal(o.state,'done',g.mapId+': '+o.type+' etapa '+g.wave);
 g.monsters=g.monsters.filter(m=>!m.dead);
}
// Las misiones son declarativas (src/sim/mision-config.js): cada etapa trae su tipo y objetivo. Se busca la primera etapa de un objetivo dado.
const etapaDe = (map, obj) => OPERATIONS[map].stages.findIndex(s => s.objective === obj) + 1;
test('all six operations complete only after every wave and the final boss, solo and four players',()=>{
 for(const map of Object.keys(OPERATIONS))for(const count of [1,4]){
 const g=setup(map,count),stages=g_cfg(map);
 for(let n=1;n<=g.waveTotal;n++){
 if(n>1 && g.cult)g.cult.open=true;
 g.startWave(n,WAVE_PLANS[map]);const st=stages[n-1];
 g.queue=[];g.omens=[];g.monsters=[];
 const s=JSON.parse(JSON.stringify(g.snapshot()));assert.equal(s.operation.title,OPERATIONS[map].title);assert.match(metaActual(s,s.players[0]).main,/Oleada/);
 if(st.objective){
  assert.equal(g.objective.type,st.objective);g.updateWaves(.01);assert.equal(g.state,'playing');assert.equal(g.phase,'wave','empty combat does not complete objective');
  if(st.objective==='resistir'){g.players[0].pos={...g.map.playerSpawn(0)};updateObjective(g,st.dur+1);assert.equal(g.objective.state,'done');}
  else complete(g);
 } else { assert.equal(g.objective,null); }
 g.updateWaves(.01);assert.equal(g.state,n===g.waveTotal?'won':'playing',map+' etapa '+n);
 }
 }
});
test('contested defense stops progress and destruction loses mission without rewards',()=>{
 const g=setup();g.startWave(etapaDe('m1','ancla'),WAVE_PLANS.m1);const o=g.objective,a=g.objects.find(x=>x.id===o.ids[0]);g.players[0].pos={...a.pos};
 const m=g.spawnMonster('astilla',a.pos);updateObjective(g,1);assert.equal(o.prog,0);assert.ok(a.hp<a.maxhp);
 a.hp=1;const cores=g.players[0].cores;updateObjective(g,1);assert.equal(g.state,'lost');assert.equal(g.players[0].cores,cores);assert.match(g.snapshot().operation.failure,/destruida/);
});
test('timeout fails once and a new game resets operation progress',()=>{
 const g=setup();g.startWave(etapaDe('m1','secuencia'),WAVE_PLANS.m1);updateObjective(g,151);assert.equal(g.state,'lost');assert.equal(g.objects.some(x=>x.objective),false);
 const count=g.events.length;updateObjective(g,100);assert.equal(g.events.length,count);assert.equal(setup().wave,0);
});
test('rescue survives carrier death and disconnection; no duplicate completion reward',()=>{
 for(const disconnect of [false,true]){
 const g=setup('m1',2);g.startWave(etapaDe('m1','nucleo'),WAVE_PLANS.m1);const o=g.objective,[core,altar]=o.ids.map(id=>g.objects.find(x=>x.id===id));const [a,b]=g.players;
 a.pos={...core.pos};b.pos={x:999,y:999,z:999};updateObjective(g,.1);assert.equal(core.carrier,a.id);
 if(disconnect)g.removePlayer(a.id);else a.dead=true;
 updateObjective(g,.1);assert.equal(core.carrier,0);b.pos={...core.pos};updateObjective(g,.1);assert.equal(core.carrier,b.id);
 b.pos={...altar.pos};updateObjective(g,.1);assert.equal(o.state,'done');assert.equal(b.carry,0);const reward=b.cores;updateObjective(g,1);assert.equal(b.cores,reward);
 }
});
test('campaign and practice retain old pacing; codex contains arenas, play menu missions',()=>{
 const g=new Game({mapId:'m1'});assert.equal(g.operation,null);assert.equal(g.waveTotal,WAVE_PLANS.m1.length+1);
 assert.equal(new Game({mapId:'m1',practice:true,operation:true}).operation,null);
 assert.ok(SECCIONES.partidas.tabs.some(t=>t.t==='Misiones'));assert.ok(!SECCIONES.partidas.tabs.some(t=>t.t==='Arenas'));assert.ok(SECCIONES.coleccion.tabs.some(t=>t.go==='arena-codex'));
});
