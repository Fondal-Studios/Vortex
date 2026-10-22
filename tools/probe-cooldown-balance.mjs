import fs from 'node:fs';import {Game} from '../src/sim/game.js';import {makeBot} from '../src/sim/bot.js';import {HOST_IDS} from '../src/sim/data.js';
const results=[];
for(const char of HOST_IDS)for(const mode of ['shooter','combo']){
 const g=new Game({mapId:'m1',seed:2718,skillLevel:0,magazines:true}),p=g.addPlayer('probe',null,{char,mode}),think=makeBot(g,p.id,{seed:2718,skill:1});const casts=[];
 for(let tick=0;tick<18000&&g.state==='playing';tick++){
  const i=think(1/60);i.mode=mode;i.support=tick%60===0;i.mov=tick%240===0;i.ult=tick%60===0&&p.ultCd<=0;
  g.setInput(p.id,i);g.step(1/60);for(const e of g.drainEvents())if(e.t==='skill'&&e.k==='ult'&&e.pid===p.id)casts.push(+g.time.toFixed(2));
  if(!Number.isFinite(p.ultCd)||p.ultCd<0)throw Error('Invalid timer '+char);
 }
 results.push({char,mode,seconds:+g.time.toFixed(2),wave:g.wave,state:g.state,kills:g.stats.kills,casts,ultCooldown:+p.ultCd.toFixed(2)});
}
fs.mkdirSync('docs/vortex-evidence/clean-hud',{recursive:true});fs.writeFileSync('docs/vortex-evidence/clean-hud/balance.json',JSON.stringify({scope:'16 deterministic bots, one seed, m1 only, maximum 300 game seconds; no human comprehension or retention measurement; modes requested explicitly',results},null,2));console.log(JSON.stringify(results));
