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
test('hold alternatives respect threshold, preserve immediate primary and do not activate themselves',()=>{
 assert.equal(expandEssentialInput({a1:true},{fire:HOLD_MS-1},'combo').a1,true);
 assert.deepEqual(expandEssentialInput({a1:true},{fire:HOLD_MS},'combo'),{a1:false,a2:true});
 assert.deepEqual(expandEssentialInput({jump:true},{jump:400}),{jump:false,mov:true});
 assert.deepEqual(expandEssentialInput({s3:true},{s3:400},'combo','s3'),{s3:false,ult:true});
 assert.deepEqual(expandEssentialInput({fire:false,jump:false},{fire:1000,jump:1000}),{fire:false,jump:false});
 assert.equal(essentialPower('combo','ability'),'ability'); assert.equal(essentialPower('combo','bad'),'s3');
});

// Same explicit action timeline through either control scheme, real authoritative simulation.
// Tests equivalence, not human win rate or equal versatility of one equipped power vs all powers.
for(const char of HOST_IDS) for(const mode of ['shooter','combo']) test(`combat parity: ${char} ${mode}, damage/cooldowns/charge/combos`,()=>{
 const make=()=>{const g=new Game({mapId:'m1',seed:17,magazines:true});g.phaseT=1e9;const p=g.addPlayer('test',null,{char,mode});p.shield=1000;p.ul=100;
  const m=g.spawnMonster('geoda',ahead(p,3),{noElite:true});m.passive=true;m.hp=m.maxhp=100000;m.open=true;return {g,p,m};};
 const a=make(),b=make(),power=essentialPower(mode); let usedUlt=false,usedSecondary=false;
 for(let tick=0;tick<360;tick++) {
  const cycle=tick%90, held=cycle*1000/60, active=cycle<70;
  const raw={mode,fire:mode==='shooter'&&active,a1:mode==='combo'&&active,jump:tick>=120&&tick<160,[power]:tick>=200&&tick<250};
  const times={fire:held,jump:(tick-120)*1000/60,[power]:(tick-200)*1000/60};
  const simple=expandEssentialInput(raw,times,mode,power);
  const full={...raw};
  if(mode==='combo'&&active&&held>=360){full.a1=false;full.a2=true;}
  if(raw.jump&&times.jump>=360){full.jump=false;full.mov=true;}
  if(raw[power]&&times[power]>=360){full[power]=false;full.ult=true;}
  a.g.setInput(a.p.id,simple); b.g.setInput(b.p.id,full); a.g.step(1/60);b.g.step(1/60); usedUlt ||= a.p.ultT>0; usedSecondary ||= COMBO_SETS[char].some(m=>m.id===a.p.cb.last&&m.seq.at(-1)==='a2');
 }
 assert.equal(hash(a.g.snapshot()),hash(b.g.snapshot()));
 assert.ok(usedUlt,'charged ultimate can be used'); if(mode==='combo') assert.ok(usedSecondary,'secondary attack executed');
 assert.ok(a.m.hp<100000,'attacks actually damage a target');
});
