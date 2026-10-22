import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../server/server.js';
const out=path.resolve(process.env.IDENTITY_SHOTS || '/tmp/vortex-identity');fs.mkdirSync(out,{recursive:true});
const srv=await startServer({port:0});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const errors=[],report={hosts:{},screens:[],errors};
try {
 const page=await browser.newPage({viewport:{width:1100,height:820}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(`http://localhost:${srv.port}/?q=low&cap=1&nolock=1`);await page.waitForFunction(()=>window.__api?.ui);
 await page.evaluate(async()=>{const P=await import('/src/client/perfil.js');P.perfil().cores=1000;window.__api.ui.show('mercado');});
 await page.waitForFunction(()=>window.__api.ui.market?.body?.isReady);
 await page.screenshot({path:path.join(out,'market-desktop.png')});
 await page.locator('[data-buy="axioma_porcelana"]').click();await page.locator('[data-buy="axioma_porcelana"]').click();await page.locator('[data-buy="axioma_porcelana"]').click();
 assert.equal(await page.evaluate(async()=>{const p=(await import('/src/client/perfil.js')).perfil();return p.cores===820&&p.cosmetics.equipped.axioma==='axioma_porcelana';}),true);
 assert.equal(await page.locator('[data-buy="axioma_aurico"]').isDisabled(),true);
 assert.equal(await page.locator('#saldo b').textContent(),'820');
 const hosts=await page.evaluate(async()=>Object.keys((await import('/src/shared/identity.js')).HOST_IDENTITY));
 for(const host of (process.env.IDENTITY_QUICK ? [] : hosts)){
  await page.locator('#market-host').selectOption(host);await page.waitForFunction(h=>window.__api.ui.market.body?.isReady&&window.__api.ui.market.body.object.name==='huesped-'+h,host);
  report.hosts[host]=await page.evaluate(()=>window.__api.ui.market.body.stats());
  for(const finish of ['archivo','porcelana','obsidiana','aurico']){
   await page.locator(`[data-preview="${host}_${finish}"]`).click();await page.waitForFunction(()=>window.__api.ui.market.body?.isReady&&document.querySelector('.market-load').hidden);
   await page.locator('.market-stage').screenshot({path:path.join(out,`${host}-${finish}.png`)});
  }
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'market-mobile.png'),fullPage:true});
 const overflow=await page.evaluate(()=>{const el=document.querySelector('#mercado');return el.scrollWidth>el.clientWidth+1;});assert.equal(overflow,false);
 await page.locator('#market-host').selectOption('axioma');await page.waitForFunction(()=>window.__api.ui.market.body?.isReady&&document.querySelector('.market-load').hidden);
 await page.reload();await page.waitForFunction(()=>window.__api?.ui);assert.equal(await page.evaluate(async()=>{const p=(await import('/src/client/perfil.js')).perfil();return p.cores===820&&p.cosmetics.equipped.axioma==='axioma_porcelana';}),true);
 await page.evaluate(()=>window.__api.ui.show('arenas'));await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'arenas-menu-mobile.png')});
 assert.equal(await page.evaluate(()=>{const ui=window.__api.ui;ui.focus(ui.list().findIndex(el=>el.dataset.start==='m6'),false);const r=ui.list()[ui.idx].getBoundingClientRect();return r.bottom<=innerHeight+1&&r.top>=0;}),true);
 await page.setViewportSize({width:1100,height:820});await page.evaluate(()=>window.__api.ui.show('main'));await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'main-desktop.png')});
 await page.close();
 assert.deepEqual(errors,[]);report.status='pass';
} finally {fs.writeFileSync(path.join(out,process.env.IDENTITY_QUICK?'quick-report.json':'report.json'),JSON.stringify(report,null,2));await browser.close();await srv.close();}
console.log(JSON.stringify(report));
