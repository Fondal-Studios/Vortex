import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LOADING_DURATION,LOADING_PANELS,loadingPanelAt} from '../src/client/loading-intro.js';
test('intro: cuatro viñetas de cinco segundos, legibles y sin spoilers del Heraldo',()=>{
 assert.equal(LOADING_DURATION,20);assert.equal(LOADING_PANELS.length,4);
 for(const [t,i] of [[0,0],[4.99,0],[5,1],[9.99,1],[10,2],[15,3],[20,3],[30,3]])assert.equal(loadingPanelAt(t),i);
 for(const p of LOADING_PANELS)assert.ok(p.text.length<=115);
 assert.doesNotMatch(JSON.stringify(LOADING_PANELS),/voluntario|parte tuya|último humano|atropell|accidente/);
 assert.match(fs.readFileSync('public/index.html','utf8'),/src\/client\/bootstrap.js/);
});
