import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { applyEquip } from '../src/sim/items-fx.js';
import { animDe } from '../src/client/combo-anim.js';
import { v3 } from '../src/sim/math.js';
test('equipment branches animate as spin and thrust',()=>{
 assert.equal(animDe('axioma','tijera').a,'giro');
 assert.equal(animDe('axioma','estocada_doble').a,'embestida');
 assert.notEqual(animDe('axioma','tajo_gemelo').a,animDe('axioma','tijera').a);
});
test('attack speed changes firing cooldown; unequip restores neutral',()=>{
 const g=new Game({mapId:'m1',seed:8}); const p=g.addPlayer('t',null,{char:'axioma'});
 p.cd=0;g.firePlayer(p);const base=p.cd;
 applyEquip(p,[{s:'arms',id:'tendones_relampago',q:0.5,k:0}],g);p.cd=0;g.firePlayer(p);
 assert.ok(p.cd<base);assert.ok(p.bn.melee<1);assert.ok(p.bn.gun<1);
 applyEquip(p,[],g);p.cd=0;g.firePlayer(p);assert.equal(p.cd,base);
});
test('projectile snapshots preserve authoritative weapon and owner',()=>{
 const g=new Game({mapId:'m1',seed:8});
 for(const [pid,wid] of [[1,9],[2,12]])g.addProjectile({owner:'p',pid,wid,kind:'nova',pos:v3(0,2,0),vel:v3(0,0,10),r:0.5,life:2,dmg:1});
 assert.deepEqual(g.snapshot().projectiles.map(q=>[q.pid,q.w]),[[1,9],[2,12]]);
});
test('heavy finisher emits critical; follow-up never inherits it',()=>{
 const g=new Game({mapId:'m1',seed:3});g.phaseT=1e9;
 const p=g.addPlayer('t',null,{char:'axioma',mode:'combo',evo:2});
 const m=g.spawnMonster('astilla',{x:p.pos.x+p.heading.x*2.6,y:p.pos.y+0.5,z:p.pos.z+p.heading.z*2.6},{noElite:true});m.passive=true;m.hp=m.maxhp=1e6;
 const events=[];
 for(const button of ['a1','a1','a2'])for(let i=0;i<24;i++) {g.setInput(p.id,{mode:'combo',[button]:i<3});g.step(1/60);events.push(...g.snapshot().events);}
 assert.ok(events.some(e=>e.t==='hit'&&e.cr),'server emits true critical');
 assert.equal(!!g.critNow,false);
 g.events=[];g.damageMonster(m,10,p,m.pos);assert.ok(g.snapshot().events.some(e=>e.t==='hit'&&!e.cr));
});
