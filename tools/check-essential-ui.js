// Prueba REAL de navegador. Requiere Chromium/WebGL; no simula una prueba de iPhone físico.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const out=process.argv[2] || 'shots/essential'; fs.mkdirSync(out,{recursive:true});
const server=await startServer({port:0,silencio:true}); let browser;
try {
 for(const [name,width,height,touch] of [['pc',1280,720,false],['iphoneSE',667,375,true],['iphone13',844,390,true],['tablet',1024,768,true]]) {
  browser=await launch();
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
  const page=await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>localStorage.setItem('cristal.tut.v2','1'));
  await page.goto(`http://localhost:${server.port}/?auto=m1&bot=0&god=1&nolock=1&guia=0&q=low&input=${touch?'touch':'mouse'}`);
  await page.waitForFunction(()=>window.__api?.session?.lastMe,{timeout:30000});
  await page.addStyleTag({content:'.tc-btn{animation:none!important;transition:none!important}'});
  for(const mode of ['shooter','combo']) {
   await page.evaluate(mode=>{const a=window.__api;a.setSetting('advanced',false);a.setGameMode(mode);a.touch.applyLayout();},mode);
   await page.waitForFunction(mode=>window.__api.renderer.third===(mode==='combo'),mode);
   const report=await page.evaluate(()=>{
    const visible=[...document.querySelectorAll('#touch .tc-btn')].filter(e=>e.getClientRects().length);
    const boxes=visible.map(e=>({id:e.dataset.a,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));
    const issues=[];
    for(const r of boxes) if(r.w<44 || r.h<44 || r.x<0 || r.y<0 || r.x+r.w>innerWidth+1 || r.y+r.h>innerHeight+1) issues.push(`bounds ${r.id}`);
    for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>2 && Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>2) issues.push(`overlap ${a.id}/${b.id}`);}
    return {actions:boxes.filter(r=>r.id!=='pause').length,issues};
   });
   if(touch) {assert.equal(report.actions,4,`${name}/${mode}`);assert.deepEqual(report.issues,[],`${name}/${mode}`);}
   await page.screenshot({path:`${out}/${name}-${mode}.png`});
   console.log(`${name} ${mode}: camera ok; ${report.actions} actions; bounds ok`);
  }
  assert.deepEqual(errors,[],name); await context.close(); await browser.close(); browser=null;
 }
} finally {if(browser) await browser.close();await server.close();}
