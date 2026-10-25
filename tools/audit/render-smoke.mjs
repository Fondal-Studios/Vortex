import fs from 'node:fs';
import assert from 'node:assert/strict';
import {launch} from '../browser.js';
import {startServer} from '../../server/server.js';
const local=process.argv.includes('--local') ? await startServer({port:0}) : null;
const base=(local && `http://localhost:${local.port}`) || process.env.AUDIT_URL || 'https://shower-psico-coop.onrender.com';
const out='docs/vortex-evidence/alpha-2026-10-25';
const label=local?'local':'render';
const browser=await launch();
const evidence={url:base,at:new Date().toISOString(),errors:[],checks:[]};
try {
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
 page.setDefaultTimeout(180000);
 page.on('pageerror',e=>evidence.errors.push(e.message));
 await page.goto(base+'/?q=low&autoq=0',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__api?.ui);
 await page.evaluate(()=>window.__api.ui.confirmTitle());
 for(const path of ['src/client/laboratorio.js','src/client/perfil.js','src/client/creatures/heraldo.js']){
  const remote=await page.evaluate(async path=>{const r=await fetch('/'+path,{cache:'no-store'});if(!r.ok)throw Error(r.status);return r.text();},path);
  assert.equal(remote,fs.readFileSync(path,'utf8'),path+' differs from audited commit');evidence.checks.push('source matches: '+path);
 }
 await page.evaluate(()=>window.__api.ui.show('modes'));
 await page.locator('#modes .card').first().waitFor({state:'visible'});
 await page.waitForTimeout(1200);
 evidence.modes=await page.locator('#modes').innerText();
 await page.screenshot({path:out+'/'+label+'-modes.png'});
 await page.evaluate(()=>window.__api.ui.show('laboratorio'));
 await page.waitForFunction(()=>window.__lab?.visor?.listo);
 await page.locator('#lbcamara').selectOption('perfil');
 evidence.camera=await page.locator('#lbcamara').inputValue();assert.equal(evidence.camera,'perfil');
 evidence.editor=await page.evaluate(()=>({valid:window.__lab.estado.validacion.ok,info:window.__lab.visor.info()}));
 assert.equal(evidence.editor.valid,true);
 await page.screenshot({path:out+'/'+label+'-editor.png'});
 assert.deepEqual(evidence.errors,[]);evidence.checks.push('mobile editor renders; compact camera works; no page errors');
 evidence.ok=true;
} catch(e){evidence.ok=false;evidence.failure=e.stack;process.exitCode=1;}finally{fs.writeFileSync(out+'/'+label+'-smoke.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));await browser.close();if(local)await local.close();}
