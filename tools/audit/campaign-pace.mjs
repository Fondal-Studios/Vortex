// Comparación emparejada: mismo motor/bot/semilla; sólo cambia la configuración de ritmo.
import fs from 'node:fs';
import {Game} from '../../src/sim/game.js';
import {misionConfig} from '../../src/sim/mision-config.js';
import {CAMPAIGN_ORDER} from '../../src/sim/campaign.js';
import {botEstilo} from '../jefe-bots.js';
const rows=[];
for(const mapId of CAMPAIGN_ORDER)for(const previous of [true,false]){
 const g=new Game({mapId,seed:1,campaign:true,magazines:true,calm:4,skillLevel:mapId==='m1'?0:2});if(previous)g.cfg=misionConfig(mapId);
 const p=g.addPlayer('Control',null,{char:'axioma',style:'disparo',mode:'shooter',kit:0}),bot=botEstilo(g,p.id,'shooter',{seed:1});
 while(g.state==='playing'&&g.time<1501){const i=bot(1/30);i.support=!!(i.esp||i.s3);g.setInput(p.id,i);g.step(1/30);g.events.length=0;}
 rows.push({mapId,previous,state:g.state,seconds:+g.time.toFixed(2),kills:g.stats.kills});
}
fs.mkdirSync('docs/vortex-evidence/campaign-comic',{recursive:true});fs.writeFileSync('docs/vortex-evidence/campaign-comic/pace.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
