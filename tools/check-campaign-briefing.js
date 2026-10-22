// Browser integration with forced chapter victory; not a human playthrough.
import assert from 'node:assert/strict';
import {launch} from './browser.js';
import {startServer} from '../server/server.js';
const server=await startServer({port:0,silencio:true});let browser;
try{
 browser=await launch();const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://localhost:${server.port}/?prologo=1&input=touch&nolock=1&q=low`);
 await page.locator('#pg-skip').click({timeout:60000});
 await page.locator('#tutok').waitFor({state:'visible'});
 assert.match(await page.locator('#tutorial').innerText(),/conciencia.*VORTEX/);
 assert.equal(await page.evaluate(()=>window.__api.session.paused),true);
 await page.screenshot({path:'shots/alpha2/briefing-m1.png'});
 await page.locator('#tutok').click();assert.equal(await page.evaluate(()=>!!window.__api.session.paused),false);
 console.log('skip actual prologue: briefing visible, pauses and resumes solo');
 await page.evaluate(()=>window.__api.session.game.state='won');
 await page.waitForFunction(()=>window.__api.session.ended && window.__api.subs.active);
 await page.evaluate(()=>window.__api.subs.skip());
 await page.waitForFunction(()=>window.__api.session.campaign==='m2');
 await page.evaluate(()=>window.__api.subs.skip());
 await page.locator('#tutok').waitFor({state:'visible'});
 const text=await page.locator('#tutorial').innerText();assert.match(text,/Madre Geoda/);assert.doesNotMatch(text,/venc.*Coloso/i);
 await page.locator('#tutok').click();assert.equal(await page.evaluate(()=>!!window.__api.session.paused),false);
 assert.deepEqual(errors,[]);console.log('forced m1 victory: m2 goal correct, briefing closes without pause lock; zero page errors');
}finally{if(browser)await browser.close();await server.close();}
