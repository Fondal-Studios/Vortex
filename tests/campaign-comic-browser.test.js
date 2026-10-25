import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launch,browserAvailable} from '../tools/browser.js';
import {startServer} from '../server/server.js';
const available=browserAvailable(),out='shots/campaign-comic';
test('cómic: lectura manual, viñetas, teclado, salida única y cuatro tamaños sin desbordes', {skip:!available,timeout:240000},async()=>{
 const srv=await startServer({port:0}),b=await launch();fs.mkdirSync(out,{recursive:true});
 try{const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`http://localhost:${srv.port}/?q=low&autoq=0&nolock=1&bienvenida=0`);await p.waitForFunction(()=>window.__api);
 for(const [width,height] of [[1280,720],[844,390],[667,375],[390,844]]){
  await p.setViewportSize({width,height});
  await p.evaluate(async()=>{const M=await import('/src/client/transferencia.js');window.comicDone=0;window.comic=M.iniciarTransferencia({manual:true,onDone:()=>window.comicDone++});window.comic.step(80);});
  assert.equal(await p.evaluate(()=>window.__transfer.index),0,'no auto-avanza mientras se lee');
  await p.locator('[data-next]').click();assert.match(await p.locator('.comic-caption').innerText(),/quiero vivir/);
  await p.keyboard.press('ArrowLeft');assert.equal(await p.evaluate(()=>window.__transfer.index),0);
  assert.ok(await p.evaluate(()=>document.querySelector('#transfer').scrollWidth<=innerWidth+1));
  const buttons=await p.locator('#transfer button:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,top:r.top};}));
  assert.ok(buttons.every(r=>r.left>=0&&r.right<=width+1&&r.top>=0&&r.bottom<=height+1));
  await p.screenshot({path:`${out}/opening-${width}.png`});
  await p.locator('.tr-skip').click();assert.equal(await p.evaluate(()=>window.comicDone),0);await p.locator('.tr-skip').click();
  await p.evaluate(()=>window.comic.skip());assert.equal(await p.evaluate(()=>window.comicDone),1);assert.equal(await p.locator('#transfer').count(),0);
 }
 await p.setViewportSize({width:844,height:390});
 for(const id of ['m1','m3','m4','m5','m6','m2']){
  await p.evaluate(async id=>{const M=await import('/src/client/transferencia.js'),F=await import('/src/client/campaign-films.js');window.comic=M.iniciarTransferencia({manual:true,film:F.CHAPTER_FILMS[id]});},id);
  await p.waitForFunction(()=>[...document.querySelectorAll('#transfer img')].every(i=>i.complete&&i.naturalWidth>0));
  if(id==='m3')await p.screenshot({path:`${out}/cautivos-844.png`});
  await p.locator('#transfer [data-auto]').click();await p.evaluate(()=>{for(let i=0;i<600;i++)window.comic.step(.1);});assert.equal(await p.locator('#transfer').count(),0);
 }
 assert.deepEqual(errors,[]);
 }finally{await b.close();await srv.close();}
});
test('campaña: victoria → cómic → siguiente capítulo exactamente una vez; final vuelve a resultados', {skip:!available,timeout:240000},async()=>{
 const srv=await startServer({port:0}),b=await launch();
 try{const p=await b.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`http://localhost:${srv.port}/?q=low&autoq=0&nolock=1&bienvenida=0&tutorial=0&skipintro=1`);await p.waitForFunction(()=>window.__api);
 await p.evaluate(async()=>{const P=await import('/src/client/perfil.js');P.elegirInicial('axioma');window.__api.ui.actions.story(true);});
 await p.waitForFunction(()=>window.__api.session?.game);
 for(const id of ['m1','m3','m4','m5','m6','m2']){
  assert.equal(await p.evaluate(()=>window.__api.session.campaign),id);
  await p.evaluate(()=>{const s=window.__api.session;s.paused=false;document.getElementById('tutorial').classList.add('hidden');s.game.state='won';});
  await p.waitForFunction(()=>document.querySelector('#transfer'));
  assert.equal(await p.evaluate(()=>window.__api.session.ended),true);
  await p.locator('.tr-skip').click();await p.locator('.tr-skip').click();
  if(id!=='m2')await p.waitForFunction(id=>window.__api.session.campaign!==id,id);
 }
 await p.waitForFunction(()=>!document.getElementById('end').classList.contains('hidden'));
 assert.equal(await p.evaluate(async()=>{const P=await import('/src/client/perfil.js');return P.perfil().campaign.completed.length;}),6);
 assert.equal(await p.locator('#transfer').count(),0);assert.deepEqual(errors,[]);
 }finally{await b.close();await srv.close();}
});
