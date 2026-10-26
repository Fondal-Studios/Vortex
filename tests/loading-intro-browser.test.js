import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startServer} from '../server/server.js';
import {launch,browserAvailable} from '../tools/browser.js';
const available=browserAvailable();
test('carga real: viñetas antes del motor, 20 s, menú listo y móvil legible', {skip:!available,timeout:120000},async()=>{
 const srv=await startServer({port:0}),b=await launch();fs.mkdirSync('shots/loading-intro',{recursive:true});
 try{const p=await b.newPage({viewport:{width:844,height:390},hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 // Retrasar el motor prueba que la intro arranca mientras sigue cargando, no después.
 await p.route('**/src/client/main.js',async route=>{await new Promise(r=>setTimeout(r,3500));await route.continue();});
 await p.goto(`http://localhost:${srv.port}/?q=low&autoq=0&nolock=1&bienvenida=0`,{waitUntil:'domcontentloaded'});
 await p.waitForSelector('#loading-comic');assert.equal(await p.evaluate(()=>!!window.__api),false);
 await p.waitForFunction(()=>window.__loadingIntro.index===1);await p.screenshot({path:'shots/loading-intro/fragmentacion-844.png'});
 await p.waitForFunction(()=>window.__loadingIntro.index===2);await p.screenshot({path:'shots/loading-intro/huespedes-844.png'});
 assert.ok(await p.locator('#loading-comic').evaluate(e=>e.scrollWidth<=innerWidth+1));
 await p.waitForFunction(()=>!window.__loadingIntro.active,null,{timeout:60000});
 const state=await p.evaluate(()=>window.__loadingIntro);assert.equal(state.elapsed,20);assert.equal(state.skipped,false);assert.equal(state.ready,true);
 await p.waitForFunction(()=>window.__api?.ui);assert.deepEqual(errors,[]);
 }finally{await b.close();await srv.close();}
});
test('carga: saltar espera al motor; error recuperable; teclado no alcanza al juego; sin solapamientos', {skip:!available,timeout:120000},async()=>{
 const srv=await startServer({port:0}),b=await launch();
 try{const p=await b.newPage();await p.goto(`http://localhost:${srv.port}/?loadingintro=0&q=low&nolock=1&bienvenida=0`);await p.waitForFunction(()=>window.__api);
 for(const [width,height] of [[390,844],[667,375],[1280,720]]){
 await p.setViewportSize({width,height});await p.evaluate(async()=>{const M=await import('/src/client/loading-intro.js');window.hits=0;window.addEventListener('keydown',()=>window.hits++);window.intro=M.startLoadingIntro({manual:true,ready:new Promise(resolve=>window.resolveLoad=resolve)});});
 await p.keyboard.press('ArrowRight');assert.equal(await p.evaluate(()=>window.hits),0);
 await p.evaluate(()=>window.intro.step(10));await p.screenshot({path:`shots/loading-intro/huespedes-${width}.png`});
 const bounds=await p.locator('#loading-comic button:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right,r.top,r.bottom];}));assert.ok(bounds.every(([l,r,t,b])=>l>=0&&r<=width+1&&t>=0&&b<=height+1));
 await p.locator('#loading-comic [data-skip]').click();assert.equal(await p.locator('#loading-comic').count(),1);await p.evaluate(()=>window.resolveLoad());await p.waitForSelector('#loading-comic',{state:'detached'});assert.equal(await p.locator('#menu').evaluate(e=>e.inert),false);
 }
 await p.evaluate(async()=>{const M=await import('/src/client/loading-intro.js');window.intro=M.startLoadingIntro({manual:true,ready:Promise.reject(Error('simulated network failure'))});});
 await p.waitForSelector('#loading-comic [data-retry]',{state:'visible'});assert.match(await p.locator('#loading-comic [data-state]').innerText(),/No pudimos cargar/);
 }finally{await b.close();await srv.close();}
});
