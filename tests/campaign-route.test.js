import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_ORDER, CAMPAIGN_BOSSES, CAMPAIGN_LINKS, cleanCampaign, campaignNext, completeChapter } from '../src/sim/campaign.js';
import { OPERATIONS } from '../src/sim/operations.js';
import { Game } from '../src/sim/game.js';
import { WAVE_PLANS, BOSS_OF } from '../src/sim/data.js';
import { metaActual } from '../src/client/meta-texto.js';
import { continuarDe } from '../src/client/menu-nav.js';
import * as Perfil from '../src/client/perfil.js';

test('one six-chapter route provides causal links and ends at the exit',()=>{
 assert.equal(new Set(CAMPAIGN_ORDER).size,6);assert.equal(CAMPAIGN_ORDER.at(-1),'m2');
 for(const [i,id] of CAMPAIGN_ORDER.entries()) { assert.equal(OPERATIONS[id].chapter,i+1);assert.equal(OPERATIONS[id].story,CAMPAIGN_LINKS[id].before);assert.ok(CAMPAIGN_LINKS[id].after.length>40); }
});
test('progress is sequential, idempotent, recoverable and rejects chapter skips',()=>{
 let p=cleanCampaign(null);assert.equal(campaignNext(p),'m1');assert.deepEqual(completeChapter(p,'m2'),p);
 for(const id of CAMPAIGN_ORDER){p=completeChapter(p,id);assert.deepEqual(completeChapter(p,id),p);p=cleanCampaign(JSON.parse(JSON.stringify(p)));}
 assert.equal(campaignNext(p),null);assert.equal(p.completed.length,6);
 assert.deepEqual(cleanCampaign({completed:['m1','m5','bad',null]}),{completed:['m1']});
 assert.deepEqual(cleanCampaign({completed:'m1'}),{completed:[]});
});
test('every chapter, campaign or individual, ends with its own final boss after all its waves',()=>{
 for(const id of CAMPAIGN_ORDER){
 const g=new Game({mapId:id,campaign:true,seed:4});g.addPlayer('P');assert.ok(g.operation);assert.equal(g.waveTotal,OPERATIONS[id].stages.length);assert.ok(CAMPAIGN_BOSSES[id],'jefe final en '+id);
 for(let n=1;n<g.waveTotal;n++){if(g.cult)g.cult.open=true;g.startWave(n,WAVE_PLANS[id]);const st=OPERATIONS[id].stages[n-1];assert.equal(g.objective?g.objective.type:null,st.objective);g.objects=g.objects.filter(o=>!(g.objective&&g.objective.ids.includes(o.id)));}
 g.startWave(g.waveTotal,WAVE_PLANS[id]);assert.equal(g.objective,null);assert.equal(g.queue[0],g.cfg.boss.kind);g.spawnFromQueue();
 const s=g.snapshot();assert.equal(s.operation.boss,true);assert.equal(metaActual(s,s.players[0]).kind,'jefe');
 g.queue=[];g.omens=[];g.updateWaves(.01);assert.equal(g.state,'playing','guardian must still be defeated');
 g.killMonster(g.monsters.find(m=>m.def.boss),g.players[0]);g.monsters=g.monsters.filter(m=>!m.dead);g.updateWaves(.01);assert.equal(g.state,'won');
 const solo=new Game({mapId:id,operation:true});assert.equal(solo.waveTotal,g.waveTotal,'la misión individual tiene el mismo jefe final');assert.equal(solo.campaign,false);
 }
});
test('existing profiles keep inventory/currency; chapter checkpoint survives reload; restart only resets campaign',()=>{
 const storage=new Map();const old=globalThis.localStorage;globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 try {
 localStorage.setItem('cristal.perfil.v1',JSON.stringify({cores:1234,skillLevel:2,terr:{}}));
 assert.deepEqual(Perfil.recargar().campaign,{completed:[]});assert.equal(Perfil.perfil().cores,1234);
 Perfil.completarCapitulo('m1');assert.equal(campaignNext(Perfil.recargar().campaign),'m3');
 assert.match(continuarDe({k:'story'},'',Perfil.perfil().campaign).sub,/Capítulo 2/);
 Perfil.completarCapitulo('m6');assert.equal(campaignNext(Perfil.perfil().campaign),'m3');
 Perfil.nuevaCampana();assert.equal(campaignNext(Perfil.recargar().campaign),'m1');assert.equal(Perfil.perfil().cores,1234);assert.equal(Perfil.perfil().skillLevel,2);
 } finally {globalThis.localStorage=old;Perfil.recargar();}
});
