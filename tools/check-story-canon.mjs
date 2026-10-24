import assert from 'node:assert/strict';
import {launch} from './browser.js';
import {startServer} from '../server/server.js';
const srv=await startServer({port:0,silencio:true}),b=await launch();
try{for(const query of ['prologo=1','prologo=1&classic_intro=1','prologo=1&skipprologo=1']){
 const p=await b.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`http://localhost:${srv.port}/?${query}&q=low&autoq=0&cap=1&nolock=1`);await p.waitForFunction(()=>window.__api?.session);
 const result=await p.evaluate(()=>{window.__step(1000);const first=window.__api.subs.cur?.text;const intro=window.__api.session.intro;const old=!!window.__prologo;window.__api.subs.skip();for(let i=0;i<10;i++)window.__step(100);return {first,intro,old,after:window.__api.session.intro,brief:document.getElementById('story').textContent};});
 assert.match(result.first,/última conciencia humana/);assert.equal(result.old,false);assert.ok(!result.after);assert.match(result.brief,/futuro remoto/);assert.doesNotMatch(result.brief,/accidente/i);assert.deepEqual(errors,[]);console.log(query, JSON.stringify({first:result.first, old:result.old, after:result.after, errors}));await p.close();
}}finally{await b.close();await srv.close();}
