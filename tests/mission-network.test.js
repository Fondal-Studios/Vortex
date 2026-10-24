import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server/server.js';
import { NetClient } from '../src/client/net.js';
import { WAVE_PLANS } from '../src/sim/data.js';
const until=async(fn)=>{const end=Date.now()+4000;while(Date.now()<end){if(fn())return true;await new Promise(r=>setTimeout(r,15));}return false;};
test('two real WebSocket clients receive identical operation and objective snapshots', {timeout:12000},async()=>{
 const server=await startServer({port:0,silencio:true}),a=new NetClient(),b=new NetClient();
 try{
  await a.connect(`ws://127.0.0.1:${server.port}/ws`);a.send({t:'create',map:'m3',name:'A'});assert.ok(await until(()=>a.room));
  await b.connect(`ws://127.0.0.1:${server.port}/ws`);b.send({t:'join',room:a.room,name:'B'});assert.ok(await until(()=>b.pid));
  const game=server.rooms.get(a.room).game;
  // Fixture jumps to the relevant waves; it does not represent human completion.
  for(const [wave,type] of [[1,'secuencia'],[2,'caza'],[3,'ancla']]){
   game.startWave(wave,WAVE_PLANS.m3);
   assert.ok(await until(()=>a.buf.some(x=>x.s.obj?.type===type)&&b.buf.some(x=>x.s.obj?.type===type)));
   const common=a.buf.map(x=>x.s).find(s=>s.obj?.type===type&&b.buf.some(y=>y.s.tick===s.tick));
   assert.ok(common);const twin=b.buf.find(x=>x.s.tick===common.tick).s;
   assert.deepEqual(common.operation,twin.operation); assert.equal(common.operation.title,'Apagar los ojos'); assert.deepEqual(common.obj,twin.obj); assert.ok(Array.isArray(common.obj.tg)||common.obj.tg===null);
   if(type==='secuencia'){assert.equal(common.obj.stage,0);assert.ok(common.obj.total>=2);}
  }
 }finally{a.salir();b.salir();await server.close();}
});
