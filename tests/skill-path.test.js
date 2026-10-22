import test from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../src/sim/game.js';import {SUPPORT,cleanSkillLevel} from '../src/shared/skill-path.js';import {CHARACTERS} from '../src/sim/data.js';
for(const char of Object.keys(SUPPORT))for(const mode of ['combo','shooter'])test(`${char} ${mode}: exactly support + ultimate, locked until earned`,()=>{
 const g=new Game({skillLevel:0}),p=g.addPlayer('Test',null,{char,mode});
 const all={support:true,mov:true,esp:true,s3:true,hab:true,ability:true,ult:true,jump:true,a1:true};
 g.setInput(p.id,all);for(const k of ['mov','esp','s3','hab','ability','ult'])assert.equal(p.input[k],false);assert.equal(p.input.jump,true);
 g.skillLevel=1;g.setInput(p.id,all);assert.equal(p.input[SUPPORT[char]],true);assert.equal(p.input.ult,false);
 g.skillLevel=2;g.setInput(p.id,all);assert.equal(p.input.ult,true);assert.deepEqual(['mov','esp','s3','hab','ability'].filter(k=>p.input[k]),[SUPPORT[char]]);assert.ok(CHARACTERS[char][SUPPORT[char]].desc);
 g.setInput(p.id,{esp:true,s3:true});assert.equal(p.input[SUPPORT[char]],false,'legacy keys cannot bypass adapter');assert.equal(g.snapshot().players[0].sk,2);
});
test('actual cleared waves earn skills; starting a wave does not',()=>{const g=new Game({skillLevel:0});g.addPlayer();for(const n of [1,2,3]){g.wave=n;g.phase='wave';g.phaseT=0;g.queue=[];g.omens=[];g.monsters=[];g.objective=null;g.step(1/60);assert.equal(g.skillLevel,n>=3?2:1);} });
test('profile preserves unlocks and rejects malformed values',async()=>{const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};const p=await import('../src/client/perfil.js');p.recargar();p.guardarHabilidades(1);p.guardarHabilidades(0);assert.equal(p.recargar().skillLevel,1);p.guardarHabilidades(2);assert.equal(p.recargar().skillLevel,2);for(const n of [-1,3,NaN,'2',Infinity])assert.equal(cleanSkillLevel(n),0);});
for(const char of Object.keys(SUPPORT))for(const mode of ['combo','shooter'])test(`${char} ${mode}: powers execute in the actual simulation`,()=>{const g=new Game({skillLevel:2}),p=g.addPlayer('Test',null,{char,mode});const eye=g.eyePos(p),dir=g.aimDir(p);const target=g.spawnMonster('astilla',{x:eye.x+dir.x*4,y:eye.y+dir.y*4,z:eye.z+dir.z*4});target.hp=target.maxhp=10000;target.passive=true;p.ul=100;g.setInput(p.id,{support:true,ult:true});g.step(1/60);assert.ok((SUPPORT[char]==='s3'?p.s3Cd:p.espCd)>0,'support consumes cooldown');assert.ok(p.ultT>0,'ultimate activates');});
