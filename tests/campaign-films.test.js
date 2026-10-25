import test from 'node:test';
import assert from 'node:assert/strict';
import {OPENING,CHAPTER_FILMS,filmDuration} from '../src/client/campaign-films.js';
import {CAMPAIGN_ORDER} from '../src/sim/campaign.js';
import {campaignConfig,misionConfig} from '../src/sim/mision-config.js';
import {Game} from '../src/sim/game.js';
test('apertura sensorial y seis cierres: subtítulos legibles, sin revelar el origen al entrar',()=>{
 assert.doesNotMatch(JSON.stringify(OPENING),/fragmento tuyo|parte tuya|voluntario|atropell|tren/i);
 assert.match(JSON.stringify(OPENING),/quiero vivir/);
 for(const id of CAMPAIGN_ORDER){const f=CHAPTER_FILMS[id];assert.ok(f.title&&f.motif);assert.ok(filmDuration(f)>=15&&filmDuration(f)<50);for(const line of f.lines)assert.ok(line[1].length/line[2]<=25);}
 assert.match(JSON.stringify(CHAPTER_FILMS.m6),/ni nos obliga a volver a unirnos/);
 assert.match(JSON.stringify(CHAPTER_FILMS.m2),/siguen cautivas/);
});
test('extender campaña no muta los contratos ni hace más resistentes a los jefes',()=>{
 for(const id of CAMPAIGN_ORDER){const original=JSON.stringify(misionConfig(id)), c=campaignConfig(id);
 assert.equal(new Game({mapId:id,operation:true}).cfg.stages[0].span,misionConfig(id).stages[0].span);
 assert.deepEqual(c.stages.at(-1),misionConfig(id).stages.at(-1));
 assert.ok(c.stages.some((s,i)=>s.span>misionConfig(id).stages[i].span));
 assert.equal(JSON.stringify(misionConfig(id)),original);}
});
