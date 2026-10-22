import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {startServer} from '../server/server.js';
const out='docs/vortex-evidence/four-action-hud';fs.mkdirSync(out,{recursive:true});const server=await startServer({port:0,silencio:true});let browser;const report=[];
try { for(const [name,width,height,touch] of [['desktop',1280,800,false],['mobile',844,390,true],['small-mobile',667,375,true]]) {
 browser=await chromium.launch({executablePath:process.env.CHROMIUM,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('cristal.tut.v2','1'));
 await page.goto(`http://localhost:${server.port}/?auto=m1&god=1&nolock=1&cap=1&q=low${touch?'&touch=1':''}`);await page.waitForFunction(()=>window.__api?.session);await page.evaluate(()=>{window.__api.subs.skip();for(let n=0;n<10;n++)window.__step(100);});
 if(await page.locator('#tutok').isVisible())await page.locator('#tutok').click();
 // Unlock fixture avoids conflating UI checks with player progression or difficulty.
 await page.evaluate(()=>{const s=window.__api.session;s.game.skillLevel=2;s.skillExplained=2;s.initialSkills=2;s.game.phase='wave';s.game.phaseT=600;s.game.players[0].ul=100;s.game.players[0].cards=[];const m=s.game.spawnMonster('astilla',{x:90,y:2,z:90});m.hp=m.maxhp=100000;m.passive=true;window.__step(16.67);});
 const result=await page.evaluate(touch=>{
   const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';};
   const els=[...document.querySelectorAll(touch?'#touch .tc-btn':'#huesped .hs')].filter(visible);
   const combat=els.filter(e=>touch?['fire','mov','esp','ult'].includes(e.dataset.a):e.dataset.k!=='s3');
   return {combat:combat.map(e=>({key:touch?e.dataset.a:e.dataset.k,images:e.querySelectorAll('img').length,rect:JSON.parse(JSON.stringify(e.getBoundingClientRect()))})),all:els.map(e=>e.dataset.a||e.dataset.k)};
 },touch);
 if(result.combat.length!==4){await page.screenshot({path:`${out}/debug.jpg`});console.log(await page.evaluate(()=>({hud:document.querySelector('#hud').outerHTML.slice(0,300),h:document.querySelector('#huesped')?.outerHTML,session:{intro:window.__api.session.intro,paused:window.__api.session.paused}})));}
 assert.equal(result.combat.length,4,JSON.stringify(result));for(const b of result.combat){assert.equal(b.images,1);assert.ok(b.rect.x>=0&&b.rect.y>=0&&b.rect.right<=width&&b.rect.bottom<=height);}
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const a=result.combat[i].rect,b=result.combat[j].rect;assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,'overlap');}
 if(touch){
  await page.mouse.click(80,height-70);await page.mouse.click(80,height-70);assert.equal(await page.evaluate(()=>window.__api.touch.read().jump),true,'double tap preserves jump');
  const b=page.locator('.tc-esp');const r=await b.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.evaluate(()=>{for(let i=0;i<4;i++)window.__step(16.67);});await page.mouse.up();
  if(!(+(await b.getAttribute('data-cd'))>0)){await page.screenshot({path:`${out}/debug-input.jpg`});console.log(name,await page.evaluate(()=>({state:window.__api.touch.st,input:window.__api.session.game.players[0].input,paused:window.__api.session.paused,skill:window.__api.session.game.skillLevel,cd:window.__api.session.game.players[0].espCd,body:document.body.className})));}
  assert.ok(+(await b.getAttribute('data-cd'))>0,'real support input consumes cooldown');
  const mb=page.locator('.tc-mov'),mr=await mb.boundingBox();await page.mouse.move(mr.x+mr.width/2,mr.y+mr.height/2);await page.mouse.down();await page.evaluate(()=>{for(let i=0;i<4;i++)window.__step(16.67);});await page.mouse.up();assert.ok(+(await mb.getAttribute('data-cd'))>0,'movement cooldown');
  await page.evaluate(()=>window.__api.touch.setContext({use:true}));assert.equal(await page.locator('.tc-esp img').count(),1,'relabel keeps illustration');
 }
 await page.screenshot({path:`${out}/${name}.jpg`,type:'jpeg',quality:82});
 await page.evaluate(()=>{window.__api.setGameMode('combo');window.__step(16.67);});
 assert.match(await page.locator(touch?'.tc-fire':'#huesped [data-k="fire"]').innerText(),/MELÉ|cuerpo a cuerpo/i);
 if(touch){await page.evaluate(()=>{const s=window.__api.session;s.game.skillLevel=0;s.initialSkills=0;s.skillExplained=0;window.__step(16.67);});assert.equal(await page.locator('.tc-esp').getAttribute('aria-disabled'),'true');assert.equal(await page.locator('.tc-mov').getAttribute('aria-disabled'),'false');}
 assert.deepEqual(errors,[]);report.push({name,...result,errors});await browser.close();browser=null;
 }} finally {if(browser)await browser.close();await server.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}console.log(JSON.stringify(report));
