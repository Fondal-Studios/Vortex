import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {startServer} from '../server/server.js';
const out=path.resolve(process.env.IDENTITY_SHOTS||'/tmp/vortex-identity');fs.mkdirSync(out,{recursive:true});
const srv=await startServer({port:0}),browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const report={arenas:[],errors:[]};
try{for(const quality of (process.env.IDENTITY_QUALITIES?.split(',') || ['low','high']))for(const map of (process.env.IDENTITY_MAPS?.split(',') || ['m1','m2','m3','m4','m5','m6'])){
 const p=await browser.newPage({viewport:{width:800,height:450}});p.setDefaultTimeout(90000);p.on('pageerror',e=>report.errors.push(`${map}/${quality}: ${e.message}`));p.on('console',m=>{if(m.type()==='error')report.errors.push(`${map}/${quality}: ${m.text()}`)});
 await p.goto(`http://localhost:${srv.port}/?auto=${map}&god=1&nolock=1&q=${quality}&cap=1`);await p.waitForFunction(()=>window.__api?.session?.game);await p.evaluate(()=>window.__step(16.67));await p.waitForFunction(()=>window.__api.renderer.humansKit||window.__api.renderer.humansFailed);
 await p.evaluate(async()=>{const {session:s,renderer:r}=window.__api;r.setThird(true);r.cuerpoMod=await import('/src/client/huesped-cuerpo.js');s.game.phaseT=9999;r.syncPlayers(s.game.snapshot(),s.pid,0.016);const e=r.ents.ply.get(s.pid);await e?.body?.ready;});
 await p.waitForTimeout(1200);
 const data=await p.evaluate(()=>{const {session:s,renderer:r}=window.__api;r.render(s.game.snapshot(),0.016,s.pid,s.look);return{map:s.game.snapshot().map,scene:{...r.gl.info.render},body:r.ents.ply.get(s.pid)?.body?.stats(),organs:r.avfx?.items?.length};});
 if(process.env.IDENTITY_CLOSEUP){
  await p.evaluate(()=>{const r=window.__api.renderer,it=r.avfx.items.find(x=>x.kind==='boca'||x.kind==='pulmon');if(!it)return;r.scene.updateMatrixWorld(true);const V=r.camera.position.constructor,rad=it.o.r||5;const target=it.g.localToWorld(new V(0,1,0));r.camera.position.copy(it.g.localToWorld(new V(rad*0.5,rad*1.1,rad*1.8)));r.camera.up.set(it.o.u.x,it.o.u.y,it.o.u.z);r.camera.lookAt(target);const U=it.zona.material.uniforms;U.uAct.value=1;U.uFill.value=.65;if(U.uDens)U.uDens.value=.4;r.gl.render(r.scene,r.camera);document.querySelectorAll('body > :not(canvas):not(script)').forEach(el=>{if(!el.querySelector('canvas'))el.style.visibility='hidden';});});
  await p.screenshot({path:path.join(out,`organ-${map}-${quality}.png`),timeout:90000});
 }else await p.screenshot({path:path.join(out,`arena-${map}-${quality}.png`),timeout:90000});report.arenas.push({quality,...data});console.log(map,quality,JSON.stringify(data));await p.close();
}}finally{fs.writeFileSync(path.join(out,process.env.IDENTITY_CLOSEUP?'organs-report.json':'arenas-report.json'),JSON.stringify(report,null,2));await browser.close();await srv.close();}
console.log(JSON.stringify({errors:report.errors}));if(report.errors.length)process.exitCode=1;
