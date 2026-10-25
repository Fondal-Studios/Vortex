// Secuencias de cómic: arte existente, lectura manual, sin vídeo ni escena WebGL adicional.
import { CHARACTERS } from '../sim/data.js';
import { OPENING, filmDuration } from './campaign-films.js';
export const DURACION = filmDuration(OPENING); // lectura automática orientativa; nunca una espera obligatoria
export const LINEAS = OPENING.lines;

export function iniciarTransferencia({ char = 'axioma', subs = null, sound = null, onDone = () => {}, root = document.body, manual = false, film = OPENING } = {}) {
 const C=CHARACTERS[char]||CHARACTERS.axioma;
 const portrait=['axioma','vesper','micelio','umbra','seraf','danzante','singular','colmena'].includes(char)?char:'axioma';
 const previous=document.activeElement;
 const el=document.createElement('section');el.id='transfer';el.className='comic';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Cómic: '+film.title);
 el.innerHTML=`<header class="comic-head"><div><small>VORTEX · FRAGMENTOS</small><h2></h2></div><button class="tr-skip" type="button">Saltar ›</button></header>
 <div class="comic-page"><figure class="comic-panel"><img class="comic-arena" alt=""><div class="comic-enemy" aria-hidden="true"></div><div class="comic-rings" aria-hidden="true"><i></i><i></i><i></i></div><div class="comic-sparks" aria-hidden="true">◇ ◇ ◇</div><img class="comic-actor" alt=""><span class="comic-stamp"></span><figcaption class="comic-caption" aria-live="polite" aria-atomic="true"><b></b><p></p></figcaption></figure><aside class="comic-strip" aria-label="Viñetas"></aside></div>
 <footer class="comic-nav"><button type="button" data-prev>← Anterior</button><button type="button" data-auto aria-pressed="false">Lectura automática</button><span data-count aria-live="polite"></span><button type="button" data-next>Siguiente →</button></footer>`;
 el.querySelector('h2').textContent=film.title;root.appendChild(el);document.body.classList.add('tr-on');
 if(subs){subs.cb=null;subs.skip();}
 const E={t:0,done:false,skipped:false,index:0,auto:false,el,frame:0,kind:'comic',panels:film.lines.length};window.__transfer=E;
 let ask=0,raf=0,last=performance.now(),panelTime=0;
 const skip=el.querySelector('.tr-skip'),next=el.querySelector('[data-next]'),prev=el.querySelector('[data-prev]'),auto=el.querySelector('[data-auto]');
 const thumbs=film.lines.map((line,i)=>{const b=document.createElement('button');b.type='button';b.textContent=String(i+1).padStart(2,'0');b.setAttribute('aria-label','Viñeta '+(i+1));b.addEventListener('click',()=>show(i));el.querySelector('.comic-strip').appendChild(b);return b;});
 function show(i){
  E.index=i;panelTime=0;const [who,text]=film.lines[i],opening=film===OPENING;
  el.dataset.motif=opening?['loop','fracture','host','host','enemy'][i]:film.motif;
  el.querySelector('.comic-arena').src='/public/art/arena-'+(film.arena||'m1')+'.jpg';
  el.querySelector('.comic-arena').alt=opening?'El entorno desconocido de VORTEX':'Un recuerdo del lugar que acabás de atravesar';
  const actor=el.querySelector('.comic-actor');actor.src=who==='H'?'/public/art/story-heraldo.png':'/public/portraits/'+portrait+'.png';actor.alt=who==='H'?'HERALDO':C.name;
  el.querySelector('.comic-caption b').textContent=who==='H'?'HERALDO':opening&&i<2?'CONCIENCIA':'VOS';
  el.querySelector('.comic-caption p').textContent=text;
  el.querySelector('.comic-stamp').textContent=opening?['TRANSFERENCIA','SEÑAL FRACTURADA','UN CUERPO AJENO','QUIERO SALIR','SOBREVIVÍ'][i]:film.title;
  prev.disabled=i===0;next.textContent=i===film.lines.length-1?'Continuar →':'Siguiente →';
  el.querySelector('[data-count]').textContent=(i+1)+' / '+film.lines.length;
  thumbs.forEach((b,j)=>b.setAttribute('aria-current',j===i?'step':'false'));
 }
 function finish(skipped){if(E.done)return;E.done=true;E.skipped=!!skipped;cancelAnimationFrame(raf);removeEventListener('keydown',key,true);document.removeEventListener('visibilitychange',visible);el.remove();document.body.classList.remove('tr-on');if(previous?.isConnected)previous.focus({preventScroll:true});onDone(E);}
 function advance(){if(E.index===film.lines.length-1)finish(false);else show(E.index+1);}
 function requestSkip(){if(ask>0)return finish(true);ask=3;skip.textContent='Tocá de nuevo para saltar';skip.classList.add('ask');}
 function key(e){if(E.done)return;if(e.code==='Tab'){const all=[...el.querySelectorAll('button:not(:disabled)')];if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0].focus();}return;}
  if(['Escape','ArrowRight','ArrowLeft','Enter','Space'].includes(e.code)){e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();requestSkip();}else if(e.code==='ArrowLeft'){e.preventDefault();if(E.index)show(E.index-1);}else if(e.code==='ArrowRight'){e.preventDefault();advance();}else if(document.activeElement?.tagName!=='BUTTON'){e.preventDefault();advance();}}
 }
 const visible=()=>{last=performance.now();};document.addEventListener('visibilitychange',visible);addEventListener('keydown',key,true);
 skip.onclick=requestSkip;next.onclick=advance;prev.onclick=()=>{if(E.index)show(E.index-1);};auto.onclick=()=>{E.auto=!E.auto;auto.setAttribute('aria-pressed',String(E.auto));auto.textContent=E.auto?'Pausar lectura':'Lectura automática';panelTime=0;};
 function step(dt){if(E.done||document.hidden)return;E.t+=dt;E.frame++;if(ask>0){ask-=dt;if(ask<=0){skip.textContent='Saltar ›';skip.classList.remove('ask');}}if(E.auto){panelTime+=dt;if(panelTime>=film.lines[E.index][2]+.5)advance();}}
 function loop(now){raf=requestAnimationFrame(loop);step(Math.min(.1,(now-last)/1000));last=now;}
 show(0);next.focus({preventScroll:true});if(!manual)raf=requestAnimationFrame(loop);
 if(sound){try{sound.init();sound.resume();sound.heartbeat?.();}catch{/* lectura sin audio */}}
 return {estado:E,step,stop:()=>finish(true),skip:()=>finish(true),skipConfirmado:()=>{requestSkip();requestSkip();}};
}
