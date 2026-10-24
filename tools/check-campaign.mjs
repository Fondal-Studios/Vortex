import fs from 'node:fs';
import assert from 'node:assert/strict';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const out='docs/campaign-evidence';fs.mkdirSync(out,{recursive:true});
const srv=await startServer({port:0,silencio:true});let browser;const report=[];
try {
 browser=await launch();
 for(const [name,width,height,touch] of [['desktop',1280,800,false],['mobile',390,844,true]]) {
 const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('vortex.bienvenida.v1','1'));
 const url=`http://localhost:${srv.port}/?q=low&autoq=0&cap=1&nolock=1&skipintro=1`;
 async function open(){await page.goto(url);await page.waitForFunction(()=>window.__api?.ui);await page.evaluate(()=>window.__api.ui.confirmTitle());}
 await open();await page.locator('#elegir').click();assert.ok(await page.locator('#modes.on').count());
 for(const screen of ['modes','story','arenas']) {
 await page.evaluate(s=>window.__api.ui.show(s),screen);await page.waitForTimeout(250);
 const info=await page.evaluate(s=>{const e=document.getElementById(s);return {screen:s,overflowX:e.scrollWidth-e.clientWidth,chapters:[...e.querySelectorAll('[data-chapter]')].map(x=>x.dataset.chapter),missions:[...e.querySelectorAll('[data-start]')].map(x=>x.dataset.start)};},screen);
 assert.ok(info.overflowX<=2);if(screen==='story')assert.deepEqual(info.chapters,['m1','m3','m4','m5','m6','m2']);if(screen==='arenas')assert.deepEqual(info.missions,['m1','m3','m4','m5','m6','m2']);report.push({name,...info});
 await page.screenshot({path:`${out}/${name}-${screen}.jpg`,type:'jpeg',quality:75});
 }
 await page.evaluate(()=>window.__api.ui.show('story'));
 if(touch)await page.setViewportSize({width:844,height:390});
 await page.locator('#campaign').click();await page.waitForFunction(()=>window.__api.session?.campaign==='m1');
 assert.equal(await page.evaluate(()=>window.__api.session.game.waveTotal),4);
 await page.evaluate(()=>{document.getElementById('tutok')?.click();window.__api.session.game.phaseT=0;for(let i=0;i<5;i++)window.__step(17);});
 assert.equal(await page.evaluate(()=>window.__api.session.game.objective.type),'secuencia');
 // Inject terminal results only to test client checkpoint wiring (simulation rules have separate tests).
 await page.evaluate(()=>{window.__api.session.game.state='won';window.__step(17);});
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('cristal.perfil.v1')).campaign.completed),['m1']);
 await open();await page.locator('#elegir').click();await page.locator('#modes [data-go="story"]').click();
 assert.match(await page.locator('#campaign').textContent(),/capítulo 2/);
 await page.locator('#campaign').click();await page.waitForFunction(()=>window.__api.session?.campaign==='m3');
 await page.evaluate(()=>{document.getElementById('tutok')?.click();window.__api.session.game.state='lost';window.__step(17);});
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('cristal.perfil.v1')).campaign.completed),['m1']);
 await open();await page.locator('#elegir').click();await page.locator('#modes [data-go="arenas"]').click();await page.locator('#arenas [data-start="m2"]').click();
 await page.waitForFunction(()=>window.__api.session?.map==='m2');assert.equal(await page.evaluate(()=>window.__api.session.campaign),null);
 await page.evaluate(()=>{document.getElementById('tutok')?.click();window.__api.session.game.state='won';window.__step(17);});
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('cristal.perfil.v1')).campaign.completed),['m1']);
 // Continue through the remaining campaign chapters using fixture victories.
 await open();await page.evaluate(()=>window.__api.ui.continuar()); // last mode is individual; use explicit campaign.
 await page.evaluate(()=>window.__api.ui.actions.story());
 for(const id of ['m3','m4','m5','m6','m2']){
 await page.waitForFunction(id=>window.__api.session?.campaign===id,id);
 await page.evaluate(()=>{document.getElementById('tutok')?.click();window.__api.session.game.state='won';window.__step(17);window.__api.subs.skip();});
 }
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('cristal.perfil.v1')).campaign.completed),['m1','m3','m4','m5','m6','m2']);
 assert.equal(await page.locator('#endtitle').textContent(),'CONCIENCIA A SALVO');
 report.push({name,checkpointReload:true,defeatPreservesCheckpoint:true,individualDoesNotAdvance:true,fullCampaignTransitionFixture:true,errors});assert.equal(errors.length,0,errors.join('\n'));
 await context.close();
 }
 fs.writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser?.close();await srv.close();}
