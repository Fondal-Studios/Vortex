import test from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../src/sim/game.js';import {makeCards,upgOf,applyCard} from '../src/sim/loadout.js';import {LINEAGE,WAVE_PLANS} from '../src/sim/data.js';
const setup=()=>{const g=new Game({skillLevel:0}),p=g.addPlayer('test');g.phaseT=1e9;return {g,p};};
test('early campaign: three free basic choices, first improves equipped weapon',()=>{
 for(let seed=1;seed<=100;seed++)for(const wave of [1,2,3]){
  const g=new Game({seed,skillLevel:wave<3?1:2}),p=g.addPlayer('test');g.wave=wave;p.weapon=p.slots[2];p.ess={carne:999,cristal:999,ojo:999,vacio:999};
  const cards=makeCards(g,p);assert.equal(cards.length,3);assert.equal(cards[0].w,p.weapon);assert.ok(cards.every(c=>['dmg','rate','mag'].includes(c.k)));
  assert.equal(new Set(cards.map(c=>`${c.w}:${c.k}`)).size,3);
 }
});
test('late mutation/lineage eligibility never generates unreachable cards or splits a branch pair',()=>{
 for(let seed=1;seed<=100;seed++){
  const {g,p}=setup();g.wave=6;g.skillLevel=2;const u=upgOf(p,0);u.mod='precision';u.dmg=LINEAGE.req.lvl;u.rate=2;p.worg[0]=['glandula_osea'];p.ess={carne:999,cristal:999,ojo:999,vacio:999};
  g.rng.next=()=>0;const cards=makeCards(g,p);assert.equal(cards.length,3);assert.equal(cards.filter(c=>c.k==='forma').length,2);assert.equal(cards.filter(c=>c.k==='mut').length,0);assert.notEqual(cards[0].k,'organ');
 }
});
test('failed organ purchase retains choices and successful selection consumes exactly once',()=>{
 const {g,p}=setup();p.cards=[{w:0,k:'dmg'},{w:0,k:'organ',t:'c',id:'placas'}];p.ess.cristal=0;
 g.setInput(p.id,{pick:1});g.step(1/60);assert.equal(p.cards.length,2);assert.ok(g.events.some(e=>e.t==='rewardUnavailable'));assert.equal(p.corg.length,0);
 p.ess.cristal=10;g.setInput(p.id,{pick:1});g.step(1/60);assert.equal(p.cards.length,0);assert.equal(p.ess.cristal,0);assert.deepEqual(p.corg,['placas']);
 g.setInput(p.id,{pick:1});g.step(1/60);assert.equal(p.ess.cristal,0);
});
test('timed automatic selection never spends essence on a paid first card',()=>{
 const {g,p}=setup();p.cards=[{w:0,k:'organ',t:'c',id:'placas'},{w:0,k:'dmg'}];p.ess.cristal=50;g.startWave(2,WAVE_PLANS.m1);
 assert.equal(p.ess.cristal,50);assert.equal(upgOf(p,0).dmg,1);assert.equal(p.corg.length,0);
});
test('locked ultimate cannot receive its duration-only organ as a reward',()=>{
 const {g,p}=setup();g.wave=6;g.skillLevel=1;p.ess={carne:999,cristal:999,ojo:999,vacio:999};
 g.rng.next=()=>0;g.rng.pick=pool=>pool.at(-1);
 assert.ok(!makeCards(g,p).some(c=>c.id==='espiraculo'));
});
