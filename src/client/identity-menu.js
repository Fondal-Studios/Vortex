import { loadEnvHDRI } from './ph.js';
import { GAME_IDENTITY, ARENA_IDENTITY, HOST_IDENTITY } from '../shared/identity.js';
import { COSMETICS, ownsCosmetic, purchaseCosmetic, equipCosmetic } from '../shared/cosmetics.js';
import { CHARACTERS } from '../sim/data.js';
import * as Perfil from './perfil.js';
import { Equipo } from './equipo.js';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

export function buildIdentityMenu(menu) {
  const main = menu.root.querySelector('#main .mainwrap');
  const intro = document.createElement('p'); intro.className = 'identity-promise'; intro.textContent = GAME_IDENTITY.promise; main.prepend(intro);
  const door = document.createElement('button'); door.type = 'button'; door.className = 'door'; door.dataset.go = 'mercado';
  door.innerHTML = '<span class="door-t"><b>Colección cosmética</b><small>Tu estilo · sin ventajas de combate</small></span>'; menu.root.querySelector('#mainlist').append(door);
  for (const [id, a] of Object.entries(ARENA_IDENTITY)) {
    const card = menu.root.querySelector(`[data-start="${id}"]`); if (!card) continue;
    card.style.setProperty('--identity', a.color); card.classList.add('arena-identity');
    card.querySelector('small').innerHTML = `<strong>${esc(a.cue)}</strong><span>${esc(a.action)}</span><em class="meta">${esc(a.goal)}</em>`;
  }
  const root = document.createElement('section'); root.id = 'mercado'; root.className = 'screen'; root.dataset.screen = 'mercado';
  root.innerHTML = `<div class="market-shell"><header class="market-head"><div><p class="market-kicker">VORTEX / ARCHIVO DE IDENTIDADES</p><h2>La misma conciencia.<br>Otra expresión.</h2><p>Acabados cosméticos. Tu poder se gana jugando.</p></div></header>
    <div class="market-layout"><section class="market-stage"><canvas aria-label="Vista 3D del acabado seleccionado"></canvas><p class="market-load" role="status">Cargando huésped…</p><div class="market-caption"><b></b><span></span></div><div class="market-preview-controls"><button type="button" class="market-nav" data-turn="-1" aria-label="Girar a la izquierda">↶</button><button type="button" class="market-nav" data-turn="1" aria-label="Girar a la derecha">↷</button><button type="button" class="market-nav" data-original>Comparar original</button></div></section>
    <section class="market-catalog"><label>Huésped<select class="market-nav" id="market-host">${Object.keys(HOST_IDENTITY).map(id=>`<option value="${id}">${esc(CHARACTERS[id].name)} · ${esc(HOST_IDENTITY[id].role)}</option>`).join('')}</select></label><p class="market-balance"></p><div class="market-items"></div><p class="market-status" role="status" aria-live="polite"></p><div class="market-policy"><b>Comprás expresión, nunca poder.</b><p>Sin daño, velocidad, vida, experiencia ni ventajas de visibilidad. Los núcleos se ganan jugando y no se venden por dinero.</p><p>Las ediciones futuras todavía no están a la venta. La colección actual se guarda en este navegador y sólo vos ves tu acabado durante la partida.</p></div></section></div></div>`;
  menu.root.append(root);
  let host = HOST_IDENTITY[Equipo.char] ? Equipo.char : 'axioma', selected = `${host}_archivo`, token = 0, body, gl, scene, camera, kit, kitPromise, T, mod, raf = 0, last = 0, yaw = 0, comparison = false, pending = null;
  const $ = s => root.querySelector(s);
  const status = text => { $('.market-status').textContent = text; };

  function cards() {
    const p = Perfil.perfil(); $('#market-host').value = host;
    $('.market-balance').textContent = `${p.cores} núcleos disponibles · precios fijos`;
    $('.market-caption b').textContent = CHARACTERS[host].name; $('.market-caption span').textContent = HOST_IDENTITY[host].silhouette;
    $('.market-items').innerHTML = Object.values(COSMETICS).filter(c=>c.host===host).map(c=>{
      const own = ownsCosmetic(p,c.id), equipped = (p.cosmetics.equipped[host] || `${host}_archivo`) === c.id;
      return `<article class="market-item ${selected===c.id?'selected':''}" style="--swatch:${c.metal}"><button type="button" class="market-nav market-look" data-preview="${c.id}" aria-pressed="${selected===c.id}"><i aria-hidden="true"></i><span><b>${esc(c.name)}</b><small>${equipped?'Equipado':own?'En tu colección':c.channel==='planned'?'Próximamente · precio por definir':`${c.price} núcleos`}</small></span></button><button type="button" class="market-nav market-action" data-buy="${c.id}" ${c.channel==='planned'||equipped?'disabled':''}>${equipped?'Equipado':own?'Equipar':pending===c.id?`Confirmar ${c.price} ◆`:'Adquirir'}</button></article>`;
    }).join('');
    $('[data-original]').textContent = comparison ? 'Ver acabado' : 'Comparar original';
    if (menu.screen === 'mercado') menu.refocus();
  }
  async function preview() {
    const seq = ++token; $('.market-load').hidden = false; $('.market-load').textContent = 'Cargando huésped…';
    try {
      if (!gl) {
        T = await import('three'); mod = await import('./huesped-cuerpo.js'); const humans = await import('./humans.js');
        if (seq !== token) return;
        gl = new T.WebGLRenderer({ canvas: $('canvas'), alpha: true, antialias: true, powerPreference: 'low-power' }); gl.setPixelRatio(Math.min(devicePixelRatio || 1,1.5)); gl.toneMapping = T.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1;
        scene = new T.Scene();
        loadEnvHDRI(gl, 'small_cathedral_02').then(env => { scene.environment=env; scene.environmentIntensity=0.8; }).catch(()=>{});
        camera = new T.PerspectiveCamera(32,1,0.1,30);
        scene.add(new T.HemisphereLight(0xe1e9ff,0x242132,2.2)); const light = new T.DirectionalLight(0xfff2df,3); light.position.set(3,5,4); scene.add(light); const rim = new T.DirectionalLight(0xc6daff,2); rim.position.set(-3,2,-3); scene.add(rim);
        kitPromise = humans.loadHumanKit({quality:'low'});
        kit = await kitPromise;
      }
      if (!kit && kitPromise) kit = await kitPromise;
      if (seq !== token || !kit) return;
      if(body){scene.remove(body.object);body.dispose();body=null;}
      const pl = {char:host,evo:0,pth:[],mr:1};
      const b = mod.createHostBody(T,kit,pl,{quality:'low',camera,cosmetic:comparison?null:selected}); scene.add(b.object); body=b; await b.ready;
      if(seq!==token) {scene.remove(b.object);b.dispose();return;}
      if (!b.isReady) throw Error('modelo no disponible');
      const frame=mod.FRAME[host]||[1,2.6,2.2]; camera.position.set(0,frame[0]+0.1,Math.max(frame[1],frame[2])*2.3);camera.lookAt(0,frame[0],0);
      $('.market-load').hidden=true; start();
    } catch { if(seq===token){$('.market-load').textContent='No se pudo cargar el modelo 3D. Probá volver a entrar.';} }
  }
  function start(){ if(raf || !root.classList.contains('on'))return; last=performance.now(); raf=requestAnimationFrame(frame); }
  function frame(now){raf=0;if(!root.classList.contains('on')||document.hidden)return;const dt=Math.min(0.05,(now-last)/1000);last=now;
    if(gl&&body?.isReady){const r=$('canvas').getBoundingClientRect();if(r.width&&r.height){gl.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();body.object.rotation.y=yaw;body.update(dt);gl.render(scene,camera);}}
    raf=requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)start();});
  root.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.preview){selected=b.dataset.preview;comparison=false;pending=null;cards();preview();}
    if(b.dataset.turn){yaw+=Number(b.dataset.turn)*0.5;}
    if(b.hasAttribute('data-original')){comparison=!comparison;cards();preview();}
    if(b.dataset.buy){const id=b.dataset.buy,p=Perfil.perfil();if(ownsCosmetic(p,id)){equipCosmetic(p,host,id);Perfil.guardar();selected=id;comparison=false;pending=null;status('Equipado. Se aplica al huésped en tercera persona.');cards();preview();}
      else if(pending!==id){pending=id;status(`Confirmá la compra por ${COSMETICS[id].price} núcleos. No modifica tus estadísticas.`);cards();}
      else {const result=purchaseCosmetic(p,id);if(result.ok){Perfil.guardar();menu.refreshHuesped();}pending=null;status(result.reason);cards();}}
  });
  $('#market-host').onchange=e=>{host=e.target.value;selected=Perfil.perfil().cosmetics.equipped[host]||`${host}_archivo`;comparison=false;pending=null;status('');cards();preview();};
  menu.market = { enter(){cards();preview();}, leave(){++token;cancelAnimationFrame(raf);raf=0;}, get body(){return body;}, get selected(){return selected;} };
}
