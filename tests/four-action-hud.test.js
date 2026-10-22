import test from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../src/sim/game.js';import {SUPPORT} from '../src/shared/skill-path.js';import {combatSkills,skillImage} from '../src/client/skill-images.js';
for(const char of Object.keys(SUPPORT))for(const mode of ['shooter','combo'])test(`${char} ${mode}: four illustrated actions and cooldown enforcement`,()=>{
 const actions=combatSkills(char,mode,2);assert.deepEqual(actions.map(a=>a.key),['fire','mov','esp','ult']);assert.equal(new Set(actions.map(a=>a.id)).size,4);for(const a of actions){assert.ok(a.name);assert.match(decodeURIComponent(skillImage(a.id)),/<svg/);}
 const g=new Game({skillLevel:0}),p=g.addPlayer('HUD',null,{char,mode});g.setInput(p.id,{mov:true});g.step(1/60);assert.ok(p.movCd>0,'defence available before wave 1');const cd=p.movCd;
 for(let n=0;n<10;n++){g.setInput(p.id,{mov:n%2===0});g.step(1/60);}assert.ok(p.movCd<cd,'spam cannot restart cooldown');
 const coop=new Game(),q=coop.addPlayer('Coop',null,{char,mode});coop.setInput(q.id,{compact:true,support:true,mov:true});assert.equal(q.input[SUPPORT[char]],true,'same physical support in both modes');assert.equal(q.input.mov,true);assert.equal(q.input.hab,false);
 const locked=combatSkills(char,mode,0);assert.equal(locked[1].locked,undefined);assert.equal(locked[2].locked,true);assert.equal(locked[3].locked,true);
});
