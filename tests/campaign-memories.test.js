import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_ORDER, CAMPAIGN_LINKS, campaignMemories, completeChapter} from '../src/sim/campaign.js';
import {INTERLUDES, ENDING, independentBrief, wakeForMap} from '../src/client/story.js';
import * as Perfil from '../src/client/perfil.js';
test('recuerdos: no hay spoilers antes de ganar; progreso inválido no salta revelaciones',()=>{
 assert.deepEqual(campaignMemories(null),[]);
 assert.deepEqual(campaignMemories({completed:['m6']}),[]);
 let p=null;
 for(const [i,id] of CAMPAIGN_ORDER.entries()){
  const before=campaignMemories(p);p=completeChapter(p,id);const after=campaignMemories(p);
  assert.equal(after.length,i+1);assert.equal(after.at(-1).id,id);
  assert.deepEqual(after.slice(0,-1),before);
 }
});
test('revelación gradual: primero indicios, luego cautivos y por último origen compartido',()=>{
 const m=id=>campaignMemories({completed:CAMPAIGN_ORDER.slice(0,CAMPAIGN_ORDER.indexOf(id)+1)});
 assert.doesNotMatch(JSON.stringify(m('m1')),/asimiladas|voluntario|se convirtió en HERALDO/);
 assert.match(JSON.stringify(m('m3')),/conciencias humanas asimiladas/);
 assert.doesNotMatch(JSON.stringify(m('m5')),/se convirtió en HERALDO/);
 assert.match(JSON.stringify(m('m6')),/se convirtió en HERALDO/);
 assert.match(JSON.stringify(m('m6')),/No sabía que venía de vos/);
 assert.match(JSON.stringify(m('m6')),/ni nos obliga a volver a unirnos/);
 assert.doesNotMatch(CAMPAIGN_LINKS.m6.before,/fragmentó|nació de/);
 for(const [i,id] of CAMPAIGN_ORDER.slice(1).entries()) assert.deepEqual(INTERLUDES[id].slice(0,-1),m(CAMPAIGN_ORDER[i]).at(-1).lines);
 assert.match(JSON.stringify(ENDING),/todavía no es su liberación/);
});
test('recuerdos persisten con campaña y no cambian por botín independiente; reinicio no borra equipo',()=>{
 const previous=globalThis.localStorage, storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
 try{
  Perfil.recargar();Perfil.perfil().cores=123;Perfil.completarCapitulo('m1');
  assert.equal(campaignMemories(Perfil.recargar().campaign).length,1);
  Perfil.perfil().cores+=30;Perfil.guardar();assert.equal(campaignMemories(Perfil.recargar().campaign).length,1);
  Perfil.nuevaCampana();assert.deepEqual(campaignMemories(Perfil.recargar().campaign),[]);assert.equal(Perfil.perfil().cores,153);
 }finally{globalThis.localStorage=previous;Perfil.recargar();}
});

test('misiones independientes y coop: briefings e introducciones no revelan el origen de HERALDO',()=>{
 for (const id of CAMPAIGN_ORDER) {
  const text=JSON.stringify([independentBrief(id),wakeForMap(id,false)]);
  assert.doesNotMatch(text,/fragmentó|comparten un origen|voluntario|último humano|recuerdo compartido/i);
  assert.match(text,/independiente/i);
 }
});
