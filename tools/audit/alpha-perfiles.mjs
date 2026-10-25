// Reproducible synthetic agents, NOT a human playtest. No game tuning, invulnerability or free upgrades.
import fs from 'node:fs';
import { Game } from '../../src/sim/game.js';
import { HOST_IDS } from '../../src/sim/data.js';
import { CAMPAIGN_ORDER } from '../../src/sim/campaign.js';
import { makeBot } from '../../src/sim/bot.js';
import { makeRng } from '../../src/sim/math.js';
const PROFILES = {
 principiante: { skill: .55, delayTicks: 9, fireDuty: .65, abilityDuty: .35, evadeDuty: .35 },
 intermedio: { skill: .95, delayTicks: 4, fireDuty: .85, abilityDuty: .7, evadeDuty: .75 },
 experto: { skill: 1.4, delayTicks: 1, fireDuty: 1, abilityDuty: 1, evadeDuty: 1 },
 control: { skill: 1.2, delayTicks: 0, fireDuty: 1, abilityDuty: 1, evadeDuty: 1 },
};
for (const name of ['principiante','intermedio','experto']) PROFILES[name+'_sin_retardo']={...PROFILES[name],delayTicks:0};
const [profile = 'control', out = '/tmp/alpha.jsonl', mapsArg = 'all', seedsArg = '1,2', hostsArg = 'all'] = process.argv.slice(2);
const maps = mapsArg === 'all' ? CAMPAIGN_ORDER : mapsArg.split(',');
const hosts = hostsArg === 'all' ? HOST_IDS : hostsArg.split(',');
const cfg = PROFILES[profile]; if (!cfg) throw Error('Unknown profile');
const dt = 1/30, horizon = 1501;
function play(mapId, char, seed) {
 const g = new Game({ mapId, seed, campaign: true, magazines: true, calm: 4, skillLevel: mapId === 'm1' ? 0 : 2 });
 const p = g.addPlayer(profile, null, { char, style: 'disparo', mode: 'shooter', kit: 0 });
 const bot = makeBot(g,p.id,{seed,skill:cfg.skill}), rng = makeRng(seed*199+17), queue=[];
 let fire=true, ability=true, evade=true, lastWindow=-1, firstKill=null, lastDmg=0, gap=0, lastDamageAt=0, maxEnemies=0, automaticClears=0;
 const stages=[], objectives=[], started=performance.now(); let lastStage=-1;
 while(g.state==='playing' && g.time<horizon){
  const window=Math.floor(g.time/.5);
  if(window!==lastWindow){ lastWindow=window;fire=rng.next()<cfg.fireDuty;ability=rng.next()<cfg.abilityDuty;evade=rng.next()<cfg.evadeDuty; }
  const input=bot(dt);input.mode='shooter'; input.fire=!!input.fire&&fire;
  input.esp=!!input.esp&&ability;input.dash=!!input.dash&&evade;input.jump=!!input.jump&&evade;
  // Keep the existing shooter bot's decision policy; do not invent an optimal hero-specific combo.
  input.support=!!input.esp;
  queue.push({...input});const delayed=queue.length>cfg.delayTicks?queue.shift():{};
  g.setInput(p.id,delayed);g.step(dt);
  if(g.wave!==lastStage){lastStage=g.wave;stages.push({wave:g.wave,at:+g.time.toFixed(2)});}
  if(g.stats.kills && firstKill===null) firstKill=+g.time.toFixed(2);
  if(p.st.dmg>lastDmg){lastDmg=p.st.dmg;lastDamageAt=g.time;}else if(g.phase!=='intermission'&&g.monsters.some(m=>!m.dead))gap=Math.max(gap,g.time-lastDamageAt);
  maxEnemies=Math.max(maxEnemies,g.monsters.filter(m=>!m.dead).length);
  for(const e of g.events){if(e.t==='objective')objectives.push({phase:e.ph,kind:e.kind,at:+g.time.toFixed(2)});if(e.t==='desint')automaticClears++;}
  g.events.length=0;
  if(![p.pos.x,p.pos.y,p.pos.z,p.hp,p.shield].every(Number.isFinite))throw Error('Non finite '+[mapId,char,seed]);
 }
 return {mapId,char,profile,seed,cfg,state:g.state,won:g.state==='won',censored:g.state==='playing',seconds:+g.time.toFixed(2),wave:g.wave,total:g.waveTotal,failure:g.operationFailure||null,kills:g.stats.kills,firstKill,maxCombatGap:+gap.toFixed(2),automaticClears,maxEnemies,hp:p.hp,shield:p.shield,contribution:p.st,stages,objectives,cpuMs:Math.round(performance.now()-started)};
}
for(const map of maps)for(const host of hosts)for(const seed of seedsArg.split(',').map(Number)){
 const r=play(map,host,seed);fs.appendFileSync(out,JSON.stringify(r)+'\n');console.log(`${profile} ${map} ${host} s${seed}: ${r.state} ${(r.seconds/60).toFixed(2)}min ${r.wave}/${r.total} ${r.failure||''}`);
}
