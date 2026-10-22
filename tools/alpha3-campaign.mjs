// Mechanics probes; skill changes aiming, not human understanding. No renderer/tutorial time.
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {Game} from '../src/sim/game.js';
import {makeBot} from '../src/sim/bot.js';
const out=process.argv[2]||'docs/vortex-evidence/alpha3-after.json',results=[];
for(let n=0;n<20;n++){
 const seed=1001+n,skill=[.35,.65,1,1.2][Math.floor(n/5)],g=new Game({mapId:'m1',seed,difficulty:1,calm:6,magazines:true,skillLevel:0});
 const p=g.addPlayer('probe',null,{char:'axioma',mode:'shooter'}),think=makeBot(g,p.id,{seed,skill});
 const unlocks=[],cards=[],objective=[];let previousSkill=0,firstKill=null,supports=0,ultimates=0,prevEsp=0,prevUlt=0,lastCards=null;
 for(let tick=0;tick<18000&&g.state==='playing';tick++){
  const i=think(1/60),near=g.monsters.filter(m=>!m.dead&&Math.hypot(m.pos.x-p.pos.x,m.pos.y-p.pos.y,m.pos.z-p.pos.z)<28).length;
  i.support= tick%60===0 && near>=2; i.ult=tick%60===0&&near>=2&&p.ul>=100;
  g.setInput(p.id,i);g.step(1/60);
  if(p.espCd>prevEsp+.01)supports++;if(p.ultT>0&&prevUlt<=0)ultimates++;prevEsp=p.espCd;prevUlt=p.ultT;
  if(g.stats.kills)firstKill??=g.time;
  if(g.skillLevel!==previousSkill){unlocks.push({level:g.skillLevel,time:+g.time.toFixed(2),wave:g.wave});previousSkill=g.skillLevel;}
  if(p.cards.length&&p.cards!==lastCards){cards.push({wave:g.wave,cards:JSON.parse(JSON.stringify(p.cards))});lastCards=p.cards;}
  if(g.objective&&g.objective.state==='done'&&!objective.some(o=>o.wave===g.wave))objective.push({wave:g.wave,type:g.objective.type});
  if(!Number.isFinite(p.pos.x+p.pos.y+p.pos.z))throw Error('nonfinite position');g.events.length=0;
 }
 const row={seed,skill,state:g.state,seconds:+g.time.toFixed(2),wave:g.wave,kills:g.stats.kills,firstKill,supports,ultimates,unlocks,cards,objective};results.push(row);console.log(seed,g.state,g.wave,supports,ultimates);
}
writeFileSync(out,JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'20 Axioma shooter probes, identical seeds and policy before/after PR5 adjustments; 300 gameplay seconds maximum; no human usability or retention',results},null,2)+'\n');
