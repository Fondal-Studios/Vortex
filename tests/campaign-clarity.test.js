import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chapterBrief,wakeForMap,RUTAS,VICTORY} from '../src/client/story.js';
import {metaActual} from '../src/client/meta-texto.js';
for(const map of new Set(Object.values(RUTAS).flat())) test(`chapter ${map}: context, actionable goal and reward`,()=>{
 const c=chapterBrief(map);assert.ok(c.context.length>20);assert.ok(c.task.length>20);assert.ok(c.reward.length>20);
 const wake=wakeForMap(map).map(l=>l[1]).join(' ');
 if(map!=='m1')assert.doesNotMatch(wake,/venc[ée].*Coloso/i);
});
test('final keeps the transfer premise',()=>{
 assert.match(VICTORY.epilogue,/transferencia/i);
 assert.doesNotMatch(Object.values(VICTORY).join(' '),/tren pasó|vuelta al andén|mundo de los vivos/i);
});
test('chapter and objective priorities survive snapshot changes',()=>{
 const state={state:'playing',phase:'intermission',map:'m2',wave:0,intermission:5};
 assert.match(metaActual(state,{}).next,/Madre Geoda/);
 state.phase='wave';state.wave=3;state.waveTotal=8;state.obj={state:'active',type:'nucleo',left:40};
 assert.match(metaActual(state,{}).main,/Acercate/);assert.doesNotMatch(metaActual(state,{}).main,/Oleada/);assert.match(metaActual(state,{}).next,/40 s/);
});
// Integration wiring checks, explicitly not a browser usability test.
test('skip cancels subtitle callback before finishing; campaign always shows reviewable briefing',()=>{
 const source=fs.readFileSync(new URL('../src/client/main.js',import.meta.url),'utf8');
 assert.match(source,/subs.cb = null; subs.skip\(\)/);
 assert.match(source,/showTutorial\(!!session.campaign\)/);
 assert.match(source,/startWake\(Story.wakeForMap\(session.map\)\)/);
 assert.doesNotMatch(source,/De vuelta al andén|VOLVISTE AL MUNDO DE LOS VIVOS|El tren pasó de largo/);
});

import {Game} from '../src/sim/game.js';
import {BOSS_OF} from '../src/sim/data.js';
import {TERRITORIOS} from '../src/sim/bendiciones.js';
import {BOSS_NAMES} from '../src/sim/campaign-names.js';
test('arena boss identity agrees in simulation snapshots and territory descriptions',()=>{
 for(const mapId of Object.keys(BOSS_NAMES)){
  const g=new Game({mapId});g.addPlayer('test');g.spawnMonster(BOSS_OF[mapId],g.map.bossAnchor);
  assert.equal(g.snapshot().boss.name,BOSS_NAMES[mapId]);assert.equal(TERRITORIOS[mapId].jefe,BOSS_NAMES[mapId]);
 }
});
