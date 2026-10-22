import test from 'node:test';import assert from 'node:assert/strict';import {startServer} from '../server/server.js';import {NetClient} from '../src/client/net.js';
const until=async(fn)=>{const end=Date.now()+4000;while(Date.now()<end){if(fn())return true;await new Promise(r=>setTimeout(r,15));}return false;};
test('compact support and attack recovery survive two-client WebSocket transport',{timeout:12000},async()=>{
 const server=await startServer({port:0,silencio:true}),a=new NetClient(),b=new NetClient();
 try{
  await a.connect(`ws://127.0.0.1:${server.port}/ws`);a.send({t:'create',map:'m1',name:'A',char:'colmena',mode:'combo'});assert.ok(await until(()=>a.pid&&a.room));
  await b.connect(`ws://127.0.0.1:${server.port}/ws`);b.send({t:'join',room:a.room,name:'B',char:'axioma'});assert.ok(await until(()=>b.pid));
  const g=server.rooms.get(a.room).game,p=g.players.find(p=>p.id===a.pid);g.phase='wave';g.phaseT=600;g.spawnMonster('astilla',{x:90,y:2,z:90});p.ul=100;
  a.send({t:'in',i:{compact:true,mode:'combo',mov:true,support:true,ult:true,a1:true}});
  assert.ok(await until(()=>p.movCd>0&&p.espCd>0&&p.ultT>0),'all three powers execute');
  assert.ok(await until(()=>a.buf.some(x=>x.s.players.some(q=>q.id===a.pid&&q.mc>0&&q.ec>0))&&b.buf.some(x=>x.s.players.some(q=>q.id===a.pid&&q.mc>0&&q.ec>0))));
  const shared=a.buf.map(x=>x.s).find(s=>s.players.some(q=>q.id===a.pid&&q.mc>0)&&b.buf.some(x=>x.s.tick===s.tick));assert.ok(shared);const other=b.buf.find(x=>x.s.tick===shared.tick).s;assert.deepEqual(shared.players,other.players);assert.ok(Number.isFinite(shared.players.find(q=>q.id===a.pid).ac));
 }finally{a.salir();b.salir();await server.close();}
});
