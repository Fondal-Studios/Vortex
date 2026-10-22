import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {startServer} from '../server/server.js';
const out='docs/skills';fs.mkdirSync(out,{recursive:true});const srv=await startServer({port:0});const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/tmp/vortex-chrome/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});const errors=[],report={};
try{for(const touch of [false,true])for(const quality of ['low','high']){
 const p=await browser.newPage({viewport:touch?{width:844,height:390}:{width:1280,height:800},hasTouch:touch,isMobile:touch});p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>localStorage.setItem('cristal.tut.v2','1'));
 await p.goto(`http://localhost:${srv.port}/?auto=m1&god=1&nolock=1&cap=1&autoq=0&q=${quality}${touch?'&touch=1':''}`);await p.waitForFunction(()=>window.__api?.session);await p.evaluate(()=>window.__step(16.67));
 assert.equal(await p.evaluate(()=>window.__api.session.game.skillLevel),0);
 if(touch)assert.equal(await p.locator('.tc-esp').isVisible(),false);
 await p.screenshot({type:'jpeg',quality:82,path:`${out}/${touch?'touch':'desktop'}-${quality}-locked.jpg`});
 for(const wave of [1,3]){
 await p.evaluate(n=>{const g=window.__api.session.game;g.wave=n;g.phase='wave';g.queue=[];g.omens=[];g.monsters=[];g.objective=null;g.step(1/60);window.__step(16.67);},wave);
 await p.locator('#skillok').waitFor({state:'visible'});assert.equal(await p.evaluate(()=>window.__api.session.paused),true);
 await p.screenshot({type:'jpeg',quality:82,path:`${out}/${touch?'touch':'desktop'}-${quality}-unlock${wave}.jpg`});if(touch) await p.locator('#skillok').click(); else if(quality === 'high' && wave === 3) await p.evaluate(()=>{const pad=window.__api.pad, original=pad.menuEvents;pad.menuEvents=()=>['ok'];window.__step(16.67);pad.menuEvents=original;}); else await p.keyboard.press(wave === 1 ? 'Enter' : 'Escape');await p.evaluate(()=>window.__step(16.67));
 }
 await p.evaluate(()=>{window.__api.session.game.players[0].cards=[];window.__step(16.67);});
 if(touch){assert.equal(await p.locator('.tc-esp').isVisible(),true);assert.equal(await p.locator('.tc-ult').isVisible(),true);const actions=await p.locator('#touch .tc-btn:not(.tc-off)').evaluateAll(es=>es.map(e=>e.dataset.a));report.touchActions=actions;assert(!actions.includes('s3'));assert(!actions.includes('mov'));}
 else{await p.keyboard.down('q');await p.evaluate(()=>window.__step(16.67));assert.equal(await p.evaluate(()=>window.__api.session.game.players[0].input.esp),true);await p.keyboard.up('q');}
 await p.screenshot({type:'jpeg',quality:82,path:`${out}/${touch?'touch':'desktop'}-${quality}-ready.jpg`});
 report[`${touch?'touch':'desktop'}-${quality}`]='locked -> explained support -> explained ultimate';await p.close();
}assert.deepEqual(errors,[]);report.errors=errors;}finally{await browser.close();await srv.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}console.log(report);
