// Automated mechanics probes, NOT fictional players or a human usability study.
import { writeFileSync } from 'node:fs';
import { Game } from '../src/sim/game.js';
import { expandEssentialInput } from '../src/client/essential-controls.js';
import { makeBot } from '../src/sim/bot.js';
const beginner=process.argv.includes('--beginner'), results=[];
for (let i=0;i<20;i++) {
 const seed=1001+i, skill=[0.35,0.65,1,1.2][Math.floor(i/5)];
 const g=new Game({mapId:'m1',seed,difficulty:1,calm:6,magazines:true});
 const p=g.addPlayer('probe',null,{mode:'shooter'}), think=makeBot(g,p.id,{seed,skill});
 let firstKill=null, lastKills=0, lastKillAt=0, maxCombatGap=0;
 const objectives=[], seen=new Set(), waves={};
 for(let tick=0;tick<18000 && g.state==='playing';tick++) {
  const input=think(1/60);g.setInput(p.id,beginner ? expandEssentialInput(input,{},'shooter') : input);g.step(1/60);
  if(g.stats.kills>lastKills){firstKill??=g.time;lastKills=g.stats.kills;lastKillAt=g.time;}
  if(g.phase==='wave')maxCombatGap=Math.max(maxCombatGap,g.time-lastKillAt);else lastKillAt=g.time;
  waves[g.wave]??=+g.time.toFixed(2);
  if(g.objective){const o=g.objective,key=`${g.wave}:${o.type}:${o.state}`;if(!seen.has(key)){seen.add(key);objectives.push({wave:g.wave,type:o.type,state:o.state,time:+g.time.toFixed(2)});}}
  if(!Number.isFinite(p.pos.x+p.pos.y+p.pos.z))throw Error('Nonfinite position');
  g.events.length=0;
 }
 const r={probe:i+1,seed,skill,char:p.char,state:g.state,seconds:+g.time.toFixed(2),wave:g.wave,kills:g.stats.kills,hp:p.hp,firstKill:firstKill===null?null:+firstKill.toFixed(2),maxCombatGap:+maxCombatGap.toFixed(2),waves,objectives};
 results.push(r); console.log(JSON.stringify(r));
}
writeFileSync(beginner ? 'docs/vortex-evidence/alpha2-campaign-bots.json' : 'docs/vortex-evidence/alpha-campaign-bots.json',JSON.stringify({version: beginner ? 'working tree: beginner controls cycle 2' : '18b1e1e', beginner,scope:'20 m1 shooter mechanics probes; no renderer, UI, tutorial, prologue, profile progression, human reading or retention; bots know routes and mechanics; skill only affects aim; all use same host; stops at death/win or 300 gameplay seconds; no m2 transition modeled',results},null,2)+'\n');
