import crypto from 'node:crypto';
import {promisify} from 'node:util';
import {Pool} from 'pg';
const scrypt=promisify(crypto.scrypt), hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const secret=()=>crypto.randomBytes(32).toString('base64url');
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function passwordHash(password,salt=crypto.randomBytes(16).toString('hex')) {
  const key=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return `${salt}:${key.toString('hex')}`;
}
async function verify(password,stored){const value=await passwordHash(password,stored.split(':')[0]);return crypto.timingSafeEqual(Buffer.from(value),Buffer.from(stored));}
const validPassword=p=>typeof p==='string'&&p.length>=12&&Buffer.byteLength(p)<=256;
const COOKIE='vortex_session';
/** PostgreSQL only in production: never silently fall back to ephemeral Render disk. */
export async function createAccounts({databaseUrl=process.env.DATABASE_URL,db:injected,trustProxy=false}={}) {
  if(!databaseUrl&&!injected)return {enabled:false,handle:async(req,res)=>{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Cuentas no disponibles: falta configurar la base persistente.'}));},close:async()=>{}};
  const db=injected||new Pool({connectionString:databaseUrl,max:4,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
  await db.query(`CREATE TABLE IF NOT EXISTS vortex_accounts (id UUID PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, recovery TEXT NOT NULL, profile JSONB, revision INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await db.query(`CREATE TABLE IF NOT EXISTS vortex_sessions (token TEXT PRIMARY KEY, account_id UUID NOT NULL REFERENCES vortex_accounts(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL)`);
  await db.query('ALTER TABLE vortex_accounts ADD COLUMN IF NOT EXISTS auth_version BIGINT NOT NULL DEFAULT 0');
  await db.query('ALTER TABLE vortex_sessions ADD COLUMN IF NOT EXISTS auth_version BIGINT NOT NULL DEFAULT 0');
  await db.query('CREATE INDEX IF NOT EXISTS vortex_sessions_account ON vortex_sessions(account_id)');
  const dummy=await passwordHash(secret()),limits=new Map();let active=0;
  const timer=setInterval(()=>{const now=Date.now();for(const [k,v] of limits)if(v.until<now)limits.delete(k);db.query('DELETE FROM vortex_sessions WHERE expires_at < now()').catch(()=>{});},60000);timer.unref();
  async function body(req){if(!String(req.headers['content-type']).startsWith('application/json'))throw fail(415,'Se requiere JSON.');let n=0,chunks=[];for await(const chunk of req){n+=chunk.length;if(n>98304)throw fail(413,'Datos demasiado grandes.');chunks.push(chunk);}try{const b=JSON.parse(Buffer.concat(chunks).toString());if(!b||Array.isArray(b)||typeof b!=='object')throw Error();return b;}catch{throw fail(400,'JSON inválido.');}}
  function throttle(req){const ip=trustProxy?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0]:req.socket.remoteAddress;const now=Date.now(),v=limits.get(ip)||{until:now+60000,n:0};if(v.until<now){v.until=now+60000;v.n=0;}if(++v.n>15||limits.size>=10000&&!limits.has(ip))throw fail(429,'Demasiados intentos. Esperá un minuto.');limits.set(ip,v);}
  function token(req){return String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
  async function account(req){const t=token(req);if(!/^[A-Za-z0-9_-]{43}$/.test(t))throw fail(401,'Iniciá sesión.');const r=await db.query('SELECT a.id,a.username,a.profile,a.revision,a.password FROM vortex_accounts a JOIN vortex_sessions s ON s.account_id=a.id WHERE s.token=$1 AND s.expires_at>now() AND s.auth_version=a.auth_version',[hash(t)]);if(!r.rows[0])throw fail(401,'La sesión venció. Iniciá sesión.');return r.rows[0];}
  function cookie(req,res,t,age=604800){const secure=!!req.socket.encrypted||(trustProxy&&req.headers['x-forwarded-proto']==='https');res.setHeader('Set-Cookie',`${COOKIE}=${t}; Path=/api/account; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`);}
  async function session(req,res,id,password){const t=secret();const r=await db.query("INSERT INTO vortex_sessions(token,account_id,auth_version,expires_at) SELECT $1,id,auth_version,now()+interval '7 days' FROM vortex_accounts WHERE id=$2 AND password=$3 RETURNING token",[hash(t),id,password]);if(!r.rows.length)throw fail(401,'La contraseña cambió. Iniciá sesión de nuevo.');cookie(req,res,t);}
  return {enabled:true,close:async()=>{clearInterval(timer);if(!injected)await db.end();},async handle(req,res){
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const reply=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
    try{
      const origin=req.headers.origin;
      // Auth is deliberately same-origin: no credentialed wildcard CORS.
      if(origin){let u;try{u=new URL(origin);}catch{throw fail(403,'Origen inválido.');}if(u.host!==req.headers.host)throw fail(403,'Abrí las cuentas desde el servidor del juego.');}
      if(req.headers['sec-fetch-site']==='cross-site')throw fail(403,'Origen inválido.');
      const route=req.url.split('?')[0].replace('/api/account','');
      if(req.method==='GET'&&route==='/me'){const a=await account(req);return reply(200,{id:a.id,username:a.username,profile:a.profile,revision:a.revision});}
      if(req.method!=='POST')throw fail(405,'Método no permitido.');
      if(req.headers['x-vortex-account']!=='1')throw fail(403,'Solicitud inválida.');
      throttle(req);const b=await body(req);
      if(route==='/logout'){await db.query('DELETE FROM vortex_sessions WHERE token=$1',[hash(token(req))]);cookie(req,res,'',0);return reply(200,{ok:true});}
      if(route==='/profile'){const a=await account(req);if(!b.profile||Array.isArray(b.profile)||typeof b.profile!=='object'||!Number.isSafeInteger(b.revision))throw fail(400,'Perfil inválido.');
        // Backup of earned/local progress, NOT an entitlement or payment ledger.
        const r=await db.query('UPDATE vortex_accounts SET profile=$1,revision=revision+1 WHERE id=$2 AND revision=$3 RETURNING revision',[JSON.stringify(b.profile),a.id,b.revision]);if(!r.rows.length)throw fail(409,'Hay un guardado más reciente. Volvé a abrir Cuenta antes de guardar.');return reply(200,{revision:r.rows[0].revision});}
      if(!['/register','/login','/recover','/password'].includes(route))throw fail(404,'Ruta desconocida.');
      if(active>=4)throw fail(429,'Servidor ocupado. Reintentá en un momento.');active++;
      try {
        if(route==='/password'){const a=await account(req);if(!validPassword(b.password)||typeof b.currentPassword!=='string'||Buffer.byteLength(b.currentPassword)>256)throw fail(400,'Usá una contraseña de 12 a 256 bytes.');if(!await verify(b.currentPassword,a.password))throw fail(401,'Contraseña actual incorrecta.');await db.query('UPDATE vortex_accounts SET password=$1,auth_version=auth_version+1 WHERE id=$2',[await passwordHash(b.password),a.id]);await db.query('DELETE FROM vortex_sessions WHERE account_id=$1',[a.id]);cookie(req,res,'',0);return reply(200,{ok:true});}
        const username=typeof b.username==='string'?b.username.trim().toLowerCase():'';
        if(!/^[a-z0-9_]{3,24}$/.test(username)||!validPassword(b.password))throw fail(400,'Usuario: 3–24 letras, números o _. Contraseña: mínimo 12 caracteres, máximo 256 bytes.');
        if(route==='/register'){
          const recovery=secret(),id=crypto.randomUUID(),password=await passwordHash(b.password);try{await db.query('INSERT INTO vortex_accounts(id,username,password,recovery) VALUES($1,$2,$3,$4)',[id,username,password,hash(recovery)]);}catch(e){if(e.code==='23505')throw fail(409,'Ese usuario no está disponible.');throw e;}
          await session(req,res,id,password);return reply(201,{id,username,recovery,revision:0,profile:null});
        }
        const a=(await db.query('SELECT * FROM vortex_accounts WHERE username=$1',[username])).rows[0];
        if(route==='/recover'){
          const code=typeof b.recovery==='string'?b.recovery:'';if(!a||!crypto.timingSafeEqual(Buffer.from(hash(code)),Buffer.from(a.recovery)))throw fail(401,'Usuario o código incorrecto.');
          const recovery=secret(),pass=await passwordHash(b.password);const r=await db.query('UPDATE vortex_accounts SET password=$1,recovery=$2,auth_version=auth_version+1 WHERE id=$3 AND recovery=$4 RETURNING id',[pass,hash(recovery),a.id,a.recovery]);if(!r.rows.length)throw fail(401,'Código ya utilizado.');await db.query('DELETE FROM vortex_sessions WHERE account_id=$1',[a.id]);await session(req,res,a.id,pass);return reply(200,{username:a.username,recovery,revision:a.revision,profile:a.profile});
        }
        const ok=await verify(b.password,a?.password||dummy);if(!a||!ok)throw fail(401,'Usuario o contraseña incorrectos.');await session(req,res,a.id,a.password);return reply(200,{id:a.id,username:a.username,profile:a.profile,revision:a.revision});
      }finally{active--;}
    }catch(e){reply(e.status||503,{error:e.status?e.message:'No se pudo acceder a las cuentas. Reintentá más tarde.'});}
  }};
}
