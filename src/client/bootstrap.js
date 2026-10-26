import {startLoadingIntro} from './loading-intro.js';
const q=new URLSearchParams(location.search);
// Enlaces de partida/cooperativo y herramientas conservan el acceso directo.
const direct=q.has('auto')||q.has('cap')||q.has('sala')||q.has('prologo')||q.has('state')||q.get('loadingintro')==='0';
const ready=import('./main.js');
if(!direct)startLoadingIntro({ready});
else ready.catch(()=>{const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='No pudimos cargar VORTEX. Recargá la página para reintentar.';document.body.appendChild(p);});
