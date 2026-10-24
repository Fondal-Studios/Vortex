import assert from 'node:assert/strict';
import {launch} from './browser.js';
import {startServer} from '../server/server.js';
const srv=await startServer({port:0,silencio:true});const browser=await launch();
try {for(const [width,height] of [[844,390],[667,375],[1024,768]]){
 const c=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`http://localhost:${srv.port}/?auto=m1&q=low&autoq=0&cap=1&nolock=1`);await p.waitForFunction(()=>window.__api?.session);
 const result=await p.evaluate(()=>{document.getElementById('tutok')?.click();window.__api.session.paused=false;window.__step(17);window.__step(17);
 const t=window.__api.touch,r=document.getElementById('weapons').getBoundingClientRect();
 const tap=(x,y,id)=>{t.down({target:t.host,clientX:x,clientY:y,pointerId:id,timeStamp:performance.now(),preventDefault(){}});const kind=t.ptrs.get(id)?.kind;t.up({pointerId:id});return kind;};
 return {left:r.left,top:r.top,bottom:r.bottom,height:r.height,move:tap(110,innerHeight-120,101),weapon:tap(r.left+r.width/2,r.top+r.height/2,102),outside:t.weaponAt(r.left+r.width/2,r.bottom+2,false)};});
 assert.equal(result.move,'move');assert.equal(result.weapon,'wbar');assert.equal(result.outside,-1);assert.ok(result.height>=44);assert.ok(result.bottom<height-180);assert.deepEqual(errors,[]);
 if(width===844)await p.screenshot({path:'/tmp/vortex-weapon-spacing.jpg',type:'jpeg',quality:75});console.log(JSON.stringify({viewportWidth:width,viewportHeight:height,...result}));await c.close();
}}finally{await browser.close();await srv.close();}
