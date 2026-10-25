import test from 'node:test';
import assert from 'node:assert/strict';
import {launch,browserAvailable} from '../tools/browser.js';
import {startServer} from '../server/server.js';
const available=browserAvailable();
test('campaña y códice: recuerdos por avance, sin spoilers en misiones libres, persistencia y móvil', {skip:!available,timeout:180000},async()=>{
 const srv=await startServer({port:0,silencio:true}),b=await launch();
 try{for(const [width,height] of [[1280,800],[844,390]]){
  const p=await b.newPage({viewport:{width,height},hasTouch:true,isMobile:width===844});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://localhost:${srv.port}/?q=low&autoq=0&nolock=1&bienvenida=0`);await p.waitForFunction(()=>window.__api?.ui);
  const initial=await p.evaluate(()=>{window.__api.ui.show('story');return document.getElementById('story').textContent;});
  assert.match(initial,/sin recuerdos/);assert.doesNotMatch(initial,/se fragmentó|entidades independientes|registro de tu entrada/i);
  await p.evaluate(()=>window.__api.ui.show('arena-codex'));
  assert.equal(await p.locator('[data-campaign-memories] details').count(),0);
  await p.evaluate(async()=>{const P=await import('/src/client/perfil.js');P.completarCapitulo('m1');window.__api.ui.show('arena-codex');});
  assert.equal(await p.locator('[data-campaign-memories] details').count(),1);
  await p.reload();await p.waitForFunction(()=>window.__api?.ui);await p.evaluate(()=>window.__api.ui.show('arena-codex'));
  assert.equal(await p.locator('[data-campaign-memories] details').count(),1);
  await p.evaluate(async()=>{const P=await import('/src/client/perfil.js');for(const id of ['m3','m4','m5','m6'])P.completarCapitulo(id);window.__api.ui.show('arena-codex');});
  assert.equal(await p.locator('[data-campaign-memories] details').count(),5);
  await p.locator('[data-campaign-memories] details').last().locator('summary').click();
  assert.match(await p.locator('[data-campaign-memories]').textContent(),/se convirtió en HERALDO/);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.evaluate(()=>window.__api.ui.show('arenas'));
  assert.doesNotMatch(await p.locator('#arenas').textContent(),/se fragmentó|se convirtió en HERALDO|registro de tu decisión/);
  await p.evaluate(async()=>{const P=await import('/src/client/perfil.js');P.nuevaCampana();window.__api.ui.show('arena-codex');});
  assert.equal(await p.locator('[data-campaign-memories] details').count(),0);
  if (width === 844) {
    await p.evaluate(async()=>{const P=await import('/src/client/perfil.js');P.elegirInicial('axioma');window.__api.ui.actions.arena('m2');});
    await p.waitForFunction(()=>window.__api?.session?.game);
    assert.equal(await p.evaluate(()=>!!window.__api.session.campaign),false);
    assert.match(await p.locator('#tutorial').textContent(),/Incursión independiente/);
    assert.doesNotMatch(await p.locator('#tutorial').textContent(),/comparten un origen|se fragmentó|último humano/);
  }
  assert.deepEqual(errors,[]);await p.close();
 }}finally{await b.close();await srv.close();}
});
