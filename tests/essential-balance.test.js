import test from 'node:test';
import assert from 'node:assert/strict';
import { expandEssentialInput, essentialInteraction, essentialPower, HOLD_MS } from '../src/client/essential-controls.js';
import { Game } from '../src/sim/game.js';
import { HOST_IDS, COMBO_SETS } from '../src/sim/data.js';
import { hash, ahead } from './helpers.js';

test('interaction never steals power for an anchor, plates, distant drops or an unrelated objective',()=>{
 const me={id:1,pos:[0,0,0]}, state={obj:{state:'active'},objs:[{t:'ancla',p:[0,0,0]}],players:[me],lt:[]};
 assert.equal(essentialInteraction(state,me),false);
 state.lt=[[8,0,3,100,0,0,0]]; assert.equal(essentialInteraction(state,me),false);
 state.lt=[[8,0,3,2,0,0,0]]; assert.equal(essentialInteraction(state,me),true);
 state.lt[0][6]=2; assert.equal(essentialInteraction(state,me),false,'other player loot');
 assert.equal(essentialInteraction(state,me,{npc:true}),true);
});
test('beginner holds never trigger an alternative and advanced input is not mutated',()=>{
 const raw={a1:true,jump:true,esp:true,a2:true,mov:true,ult:true,ability:true,s3:true,dash:true};
 for(const duration of [0,359,360,500,5000]) {
  const out=expandEssentialInput(raw,{fire:duration,jump:duration,esp:duration},'combo');
  assert.equal(out.a1,true);assert.equal(out.jump,true);
  for(const k of ['a2','esp','mov','ult','ability','s3','dash'])assert.equal(out[k],false,k);
 }
 assert.equal(raw.ult,true,'complete control input preserved');
});
for(const char of HOST_IDS) for(const mode of ['shooter','combo']) test(`beginner basic combat: ${char} ${mode}`,()=>{
 const g=new Game({mapId:'m1',seed:17,magazines:true});g.phaseT=1e9;
 const p=g.addPlayer('test',null,{char,mode});p.shield=1000;p.ul=100;
 const m=g.spawnMonster('geoda',ahead(p,3),{noElite:true});m.passive=true;m.hp=m.maxhp=100000;m.open=true;
 for(let tick=0;tick<360;tick++){
  const input=expandEssentialInput({fire:true,a1:true,esp:true,s3:true,ability:true,ult:true,mov:true,a2:true},{fire:tick*1000/60},mode);
  g.setInput(p.id,input);g.step(1/60);
  assert.ok(!(p.ultT>0),'no hidden ultimate');
 }
 assert.ok(m.hp<100000,'primary attack damages target without any power');
});
