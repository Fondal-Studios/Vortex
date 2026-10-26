// Intro liviana: se ejecuta antes de importar el motor, sin Three ni recursos nuevos.
export const LOADING_DURATION = 20;
export const LOADING_PANELS = Object.freeze([
 {title:'La transferencia',text:'Una conciencia entra en VORTEX. El destino de la transferencia es desconocido.',kind:'signal'},
 {title:'Algo se fragmenta',text:'El ingreso se repite. La señal se rompe. Una parte sólo quiere sobrevivir.',kind:'fracture'},
 {title:'Un cuerpo prestado',text:'Podés habitar un Huésped. El cuerpo cambia. Tu conciencia sigue adentro.',kind:'hosts'},
 {title:'Una voz en el bucle',text:'HERALDO ofrece una salida. Sobreviví, recuperá tus recuerdos y descubrí si podés confiar en él.',kind:'guide'},
]);
export const loadingPanelAt = seconds => Math.min(3,Math.max(0,Math.floor(seconds/5)));
export function startLoadingIntro({ready,root=document.body,manual=false}={}){
 const el=document.createElement('section');el.id='loading-comic';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Introducción a VORTEX');
 el.innerHTML=`<header><span>VORTEX · SEÑAL ENTRANTE</span><button type="button" data-skip>Saltar intro</button></header>
 <figure><div class="lc-signal" aria-hidden="true">◉</div><div class="lc-shards" aria-hidden="true">◇ ◇ ◇</div><div class="lc-hosts"><img src="/public/portraits/axioma.png" alt="Huésped Axioma"><img src="/public/portraits/vesper.png" alt="Huésped Vesper"><img src="/public/portraits/micelio.png" alt="Huésped Micelio"></div><img class="lc-guide" src="/public/art/story-heraldo.png" alt="HERALDO"><figcaption aria-live="polite" aria-atomic="true"><b></b><p></p></figcaption></figure>
 <footer><span data-page></span><progress max="20" value="0" aria-label="Duración de la introducción"></progress><span data-time></span><p data-state role="status">Preparando VORTEX…</p><button type="button" data-retry hidden>Reintentar carga</button></footer>`;
 root.appendChild(el);const previous=document.activeElement;
 const state={active:true,elapsed:0,index:0,ready:false,skipped:false,error:false};window.__loadingIntro=state;
 const skip=el.querySelector('[data-skip]'),status=el.querySelector('[data-state]'),retry=el.querySelector('[data-retry]');let raf=0,last=performance.now();
 const controls=[...document.body.children].filter(n=>n!==el&&n.tagName!=='SCRIPT');const old=controls.map(n=>n.inert);controls.forEach(n=>n.inert=true);
 function render(){state.index=loadingPanelAt(state.elapsed);const panel=LOADING_PANELS[state.index];el.dataset.kind=panel.kind;el.querySelector('figcaption b').textContent=panel.title;el.querySelector('figcaption p').textContent=panel.text;el.querySelector('[data-page]').textContent=`${state.index+1} / 4`;el.querySelector('progress').value=state.elapsed;el.querySelector('[data-time]').textContent=Math.ceil(Math.max(0,20-state.elapsed))+' s';}
 function finish(){if(!state.active||!state.ready||state.error||(!state.skipped&&state.elapsed<20))return;state.active=false;cancelAnimationFrame(raf);removeEventListener('keydown',key,true);document.removeEventListener('visibilitychange',visibility);controls.forEach((n,i)=>n.inert=old[i]);el.remove();if(previous?.isConnected)previous.focus({preventScroll:true});window.dispatchEvent(new Event('vortex:intro-complete'));}
 function skipIntro(){state.skipped=true;skip.disabled=true;status.textContent=state.ready?'Entrando…':'Intro saltada. Esperando que termine la carga…';finish();}
 function key(e){e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();skipIntro();}if(e.code==='Tab'){const buttons=[...el.querySelectorAll('button:not(:disabled):not([hidden])')];if(buttons.length){e.preventDefault();buttons[0].focus();}}}
 function step(dt){if(!state.active||state.error||document.hidden)return;state.elapsed=Math.min(20,state.elapsed+Math.max(0,dt));render();if(state.elapsed===20&&!state.ready)status.textContent='La intro terminó. Seguimos preparando VORTEX…';finish();}
 function loop(now){raf=requestAnimationFrame(loop);step((now-last)/1000);last=now;}
 function visibility(){last=performance.now();}
 addEventListener('keydown',key,true);document.addEventListener('visibilitychange',visibility);skip.onclick=skipIntro;retry.onclick=()=>location.reload();render();skip.focus({preventScroll:true});if(!manual)raf=requestAnimationFrame(loop);
 Promise.resolve(ready).then(()=>{state.ready=true;status.textContent='VORTEX listo · podés saltar la intro';finish();},()=>{state.error=true;cancelAnimationFrame(raf);status.textContent='No pudimos cargar VORTEX. Revisá tu conexión y reintentá.';skip.hidden=true;retry.hidden=false;retry.focus();});
 return {state,step,skip:skipIntro};
}
