import fs from 'node:fs';
import assert from 'node:assert/strict';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const out='docs/operations-evidence';fs.mkdirSync(out,{recursive:true});
const srv=await startServer({port:0,silencio:true});let browser;const report=[];
try {
 browser=await launch();
 for(const [name,width,height,touch] of [['desktop',1280,800,false],['mobile',390,844,true]]) {
 const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://localhost:${srv.port}/?q=low&autoq=0&cap=1&nolock=1`);await page.waitForFunction(()=>window.__api?.ui,{timeout:45000});
 await page.evaluate(()=>window.__api.ui.confirmTitle());
 for(const screen of ['arenas','arena-codex']) {
 await page.evaluate(s=>window.__api.ui.show(s),screen);await page.waitForTimeout(400);
 const info=await page.evaluate(s=>{const e=document.getElementById(s);return {screen:s,cards:e.querySelectorAll('.card').length,overflowX:e.scrollWidth-e.clientWidth,buttons:[...document.querySelectorAll('#tbtabs button')].map(b=>b.textContent.trim())};},screen);
 assert.equal(info.cards,screen==='arenas'?7:6);assert.ok(info.overflowX<=2);report.push({name,...info});await page.screenshot({path:`${out}/${name}-${screen}.jpg`,type:'jpeg',quality:75});
 }
 await page.evaluate(()=>window.__api.ui.show('arenas'));
 if(touch) await page.setViewportSize({width:844,height:390});
 await page.locator('#arenas [data-start="m1"]').click();await page.waitForFunction(()=>window.__api.session?.game?.operation);
 assert.equal(await page.evaluate(()=>window.__api.session.game.operation.title),'Refugio de identidades');
 await page.evaluate(()=>{ const g=window.__api.session.game; g.phaseT=0; window.__api.session.paused=false; document.getElementById('tutorial').classList.add('hidden'); for(let i=0;i<5;i++)window.__step(17); });
 await page.waitForFunction(()=>window.__api.session.game.objective?.type==='secuencia');
 await page.screenshot({path:`${out}/${name}-mission-start.jpg`,type:'jpeg',quality:75});
 report.push({name,errors});assert.equal(errors.length,0,errors.join('\n'));
 await context.close();
 }
 fs.writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser?.close();await srv.close();}
