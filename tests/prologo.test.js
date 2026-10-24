import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Story from '../src/client/story.js';
import {CAMPAIGN_LINKS} from '../src/sim/campaign.js';
import {OPERATIONS} from '../src/sim/operations.js';
test('canon: una única conciencia humana en el futuro, sin accidente ni otros supervivientes',()=>{
 const texts=JSON.stringify([Story.WAKE,Story.ENDING,Story.CHAPTERS,CAMPAIGN_LINKS,OPERATIONS]);
 assert.match(texts,/última conciencia humana/);assert.match(texts,/futuro remoto/);
 assert.doesNotMatch(texts,/accidente|atropell|andén|tren no fren|otros como vos|demás cautivos|detectó conciencias/i);
 assert.match(JSON.stringify(Story.ENDING),/cuerpo sintético/);
});
test('todas las aperturas completas usan el despertar, sin rutas al atropello',()=>{
 const main=fs.readFileSync('src/client/main.js','utf8');
 assert.match(main,/if \(kind === 'full'\) startWake\(Story.WAKE\)/);
 assert.doesNotMatch(main,/startPrologue|Story\.INTRO_TRAIN|Story\.trainCine|sound\.train\(/);
});
