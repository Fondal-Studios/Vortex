import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startServer} from '../server/server.js';
test('Permanent accounts: real PostgreSQL persistence, sessions, recovery and optimistic saves',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'vortex-accounts-'));let db=await PGlite.create(dir),srv=await startServer({port:0,accountDb:db,autoTick:false}),cookie='';
 const call=async(route,data,extra={})=>{const r=await fetch(`http://localhost:${srv.port}/api/account/${route}`,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','X-Vortex-Account':'1',cookie,...extra},body:data?JSON.stringify(data):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,body:await r.json()};};
 try{
  assert.equal((await call('register',{username:'nano',password:'short'})).status,400);
  const a=await call('register',{username:'nano',password:'a strong password 123'});assert.equal(a.status,201);assert.ok(a.body.recovery);const recovery=a.body.recovery,firstCookie=cookie;
  assert.equal((await call('register',{username:'NANO',password:'another password 123'})).status,409);
  assert.equal((await call('profile',{revision:0,profile:{cores:42}})).status,200);
  assert.equal((await call('profile',{revision:0,profile:{cores:0}})).status,409);
  assert.equal((await call('profile',{revision:1,profile:{}},{Origin:'https://evil.example'})).status,403);
  assert.equal((await call('profile',{revision:1,profile:{}},{'X-Vortex-Account':''})).status,403);
  await srv.close();await db.close();db=await PGlite.create(dir);srv=await startServer({port:0,accountDb:db,autoTick:false});
  const saved=await call('me');assert.equal(saved.body.profile.cores,42);assert.equal(saved.body.revision,1);
  assert.equal((await call('logout',{})).status,200);assert.equal((await call('me')).status,401);
  assert.equal((await call('login',{username:'nano',password:'wrong password 123'})).status,401);
  assert.equal((await call('login',{username:'nano',password:'a strong password 123'})).status,200);
  const oldCookie=cookie;const reset=await call('recover',{username:'nano',password:'new password 456',recovery});assert.equal(reset.status,200);assert.notEqual(reset.body.recovery,recovery);
  assert.equal((await call('me',undefined,{cookie:oldCookie})).status,401);
  assert.equal((await call('me',undefined,{cookie:firstCookie})).status,401);
  assert.equal((await call('recover',{username:'nano',password:'third password 789',recovery})).status,401);
  const row=(await db.query('SELECT password,recovery FROM vortex_accounts')).rows[0];assert.ok(!row.password.includes('password'));assert.notEqual(row.recovery,reset.body.recovery);
  assert.equal((await call('password',{currentPassword:'new password 456',password:'changed password 987'})).status,200);
  assert.equal((await call('me')).status,401);
  assert.equal((await call('login',{username:'nano',password:'new password 456'})).status,401);
  assert.equal((await call('login',{username:'nano',password:'changed password 987'})).status,200);
  await db.query('UPDATE vortex_sessions SET expires_at=now()-interval \'1 day\'');assert.equal((await call('me')).status,401);
 }finally{await srv.close();await db.close();await rm(dir,{recursive:true,force:true});}
});
test('No database fails closed, never offers temporary accounts',async()=>{const srv=await startServer({port:0,databaseUrl:'',autoTick:false});try{const r=await fetch(`http://localhost:${srv.port}/api/account/me`);assert.equal(r.status,503);}finally{await srv.close();}});

test('Account API bounds payload and repeated attempts',async()=>{const db=await PGlite.create(),srv=await startServer({port:0,accountDb:db,autoTick:false});try{const url=`http://localhost:${srv.port}/api/account/register`,headers={'Content-Type':'application/json','X-Vortex-Account':'1'};const large=await fetch(url,{method:'POST',headers,body:JSON.stringify({username:'test',password:'x'.repeat(100000)})});assert.equal(large.status,413);for(let i=0;i<14;i++){const r=await fetch(url,{method:'POST',headers,body:JSON.stringify({username:'test',password:'short'})});assert.equal(r.status,400);}const r=await fetch(url,{method:'POST',headers,body:'{}'});assert.equal(r.status,429);}finally{await srv.close();await db.close();}});
