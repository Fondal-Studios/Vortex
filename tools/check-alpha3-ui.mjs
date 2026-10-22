// Real browser checks. Forced clears verify learning flow, not human ability to beat a wave.
import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {startServer} from '../server/server.js';
const out='docs/vortex-evidence/alpha3-ui';fs.mkdirSync(out,{recursive:true});const server=await startServer({port:0,silencio:true});const report=[];let browser;
try{for(const touch of [false,true]){
 browser=await chromium.launch({executablePath:process.env.CHROMIUM,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:touch?{width:844,height:390}:{width:1280,height:800},hasTouch:touch,isMobile:touch});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('cristal.tut.v2','1'));
 await page.goto(`http://localhost:${server.port}/?auto=m1&god=1&nolock=1&cap=1&q=low${touch?'&touch=1':''}`);await page.waitForFunction(()=>window.__api?.session);await page.evaluate(()=>window.__step(16.67));
 for(const wave of [1,3]){
  await page.evaluate(w=>{const g=window.__api.session.game;g.wave=w;g.phase='wave';g.queue=[];g.omens=[];g.monsters=[];g.objective=null;g.step(1/60);window.__step(16.67);},wave);
  await page.locator('#skillok').click();await page.evaluate(()=>window.__step(16.67));
  assert.equal(await page.locator('#cardlist .ucard').count(),3);
  assert.equal(await page.evaluate(()=>window.__api.session.game.skillLevel),wave===1?1:2);
  await page.locator('#cardlist .ucard').first().click();await page.evaluate(()=>window.__step(16.67));
 }
 await page.evaluate(()=>{const g=window.__api.session.game,p=g.players[0];g.phase='intermission';g.phaseT=30;p.ess.cristal=20;p.cards=[{w:0,k:'dmg'},{w:0,k:'organ',t:'c',id:'placas'},{w:0,k:'rate'}];window.__step(16.67);});
 assert.match(await page.locator('#cardlist').innerText(),/Costo: 10 cristal/);
 assert.equal(await page.locator('#cards h3').innerText(),'ELEGÍ UNA MEJORA');
 assert.equal(await page.locator('#top').isVisible(),false);
 await page.screenshot({path:`${out}/${touch?'mobile':'desktop'}-rewards.jpg`,type:'jpeg',quality:78});
 await page.evaluate(()=>{window.__api.session.game.players[0].ess.cristal=0;});await page.locator('#cardlist .ucard').nth(1).click();await page.evaluate(()=>window.__step(16.67));
 assert.equal(await page.evaluate(()=>window.__api.session.game.players[0].cards.length),3);
 await page.locator('#cardlist .ucard').first().click();await page.evaluate(()=>window.__step(16.67));assert.equal(await page.evaluate(()=>window.__api.session.game.players[0].cards.length),0);
 await page.goto(`http://localhost:${server.port}/?prologo=1&skipintro=1&nolock=1&cap=1&q=low${touch?'&touch=1':''}`);
 await page.locator('#tutok').waitFor({state:'visible'});assert.match(await page.locator('#tutorial').innerText(),/conciencia.*VORTEX/);await page.locator('#tutok').click();
 await page.evaluate(()=>{window.__api.session.game.state='won';window.__step(16.67);window.__api.subs.skip();});
 await page.waitForFunction(()=>window.__api.session.campaign==='m2');await page.evaluate(()=>window.__api.subs.skip());
 await page.locator('#tutok').waitFor({state:'visible'});assert.match(await page.locator('#tutorial').innerText(),/Madre Geoda/);await page.locator('#tutok').click();
 assert.equal(await page.evaluate(()=>!!window.__api.session.paused),false);
 assert.deepEqual(errors,[]);report.push({touch,unlock1:true,unlock3:true,threeCards:true,visiblePrice:true,failedPurchaseRetainsChoices:true,freeChoiceWorks:true,chapterBriefAndTransition:true,errors});
 await browser.close();browser=null;
}}finally{if(browser)await browser.close();await server.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}console.log(JSON.stringify(report));
