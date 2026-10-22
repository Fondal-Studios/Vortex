import test from 'node:test';import assert from 'node:assert/strict';import {Game} from '../src/sim/game.js';import {HOST_IDS,CHARACTERS} from '../src/sim/data.js';import {updateHost} from '../src/sim/huespedes.js';import {beginUltimateCooldown,refundUltimate} from '../src/sim/ultimate-cooldown.js';
for(const char of HOST_IDS)for(const mode of ['shooter','combo'])test(`${char} ${mode}: no mana, wait then reuse, no spam bypass`,()=>{
 const g=new Game({skillLevel:2}),p=g.addPlayer('timer',null,{char,mode});assert.equal(p.ul,undefined);
 g.setInput(p.id,{ult:true});updateHost(g,p,1/60);assert.ok(p.ultT>0);assert.ok(p.ultCd>=CHARACTERS[char].ult.cd*.8);const full=p.ultCd;
 g.setInput(p.id,{ult:false});updateHost(g,p,.1);g.setInput(p.id,{ult:true});updateHost(g,p,.1);assert.ok(p.ultCd<full,'press cannot restart timer');
 g.setInput(p.id,{});for(let n=0;n<Math.ceil(full*60)+2;n++)updateHost(g,p,1/60);assert.equal(p.ultCd,0);assert.equal(p.ultT,0);
 g.setInput(p.id,{ult:true});updateHost(g,p,1/60);assert.ok(p.ultT>0,'recharges without any kills or resource');
 const snap=g.snapshot().players[0];assert.ok(snap.ud>0);assert.ok(!('ul' in snap));if(char==='colmena')assert.ok(snap.uc>=3,'swarm capacity not overwritten by cooldown');
});
test('all recovery bonuses and refunds have a per-cast balance cap',()=>{
 const p={ultT:12};beginUltimateCooldown(p,60,12,100);assert.equal(p.ultCd,60);const initial=p.ultCd;for(let i=0;i<100;i++)refundUltimate(p,999);assert.ok(Math.abs(p.ultCd-(initial-9.6))<1e-8);assert.equal(refundUltimate(p,100),0);assert.ok(p.ultCd>p.ultT);
});
test('locked campaign ultimate cannot be used even when timer is ready',()=>{const g=new Game({skillLevel:1}),p=g.addPlayer('locked',null,{char:'axioma'});g.setInput(p.id,{ult:true});updateHost(g,p,.1);assert.equal(p.ultT,0);});
