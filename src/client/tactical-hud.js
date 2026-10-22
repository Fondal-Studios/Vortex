import {mapMarkers,projectMap,reviveTarget} from '../shared/tactical.js';
import {settings,setSetting} from './settings.js';
const symbols={host:['▲','Vos','#f4f5ff'],ally:['●','Aliado','#8cead2'],down:['✚','Caído','#8cead2'],enemy:['×','Enemigo','#ff939a'],elite:['◆','Élite','#ffc379'],boss:['★','Jefe','#ff939a'],objective:['■','Objetivo','#e5dd9c'],mission:['⚑','Misión','#d6b3ff']};
export function createTacticalHUD(parent) {
  const root=document.createElement('section');root.id='tactical-hud';root.innerHTML=`<div class="tactical-map"><div class="tactical-title">RADAR TÁCTICO <span>↑ frente · 90 m</span></div><canvas width="360" height="360" aria-label="Minimapa: posición, aliados, enemigos y objetivos"></canvas><details><summary>Símbolos · opacidad</summary><div class="tactical-settings"><div class="tactical-legend"></div><label>Opacidad <input aria-label="Opacidad del minimapa" type="range" min="20" max="100" step="5"></label><small>↑ / ↓ otra altura · borde = fuera de alcance</small></div></details></div><button type="button" class="revive-action" hidden><strong>Revivir</strong><span></span><progress max="3" value="0"></progress></button>`;
  root.hidden=true;parent.append(root);const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),map=root.querySelector('.tactical-map'),btn=root.querySelector('button'),slider=root.querySelector('input');
  for(const [s,label,c] of Object.values(symbols)){const e=document.createElement('span');e.textContent=`${s} ${label}`;e.style.color=c;root.querySelector('.tactical-legend').append(e);}
  const opacity=()=>{slider.value=String(Math.max(20,Math.min(100,(Number(settings().minimapOpacity)||.85)*100)));map.style.opacity=Number(slider.value)/100;};opacity();slider.oninput=()=>{setSetting('minimapOpacity',Number(slider.value)/100);opacity();};
  let held=false,target=null,last=0;const release=()=>{held=false;};
  btn.onpointerdown=e=>{e.preventDefault();e.stopPropagation();held=true;btn.setPointerCapture(e.pointerId);};
  for(const ev of ['pointerup','pointercancel','lostpointercapture','blur'])btn.addEventListener(ev,release);
  window.addEventListener('blur',release);document.addEventListener('visibilitychange',release);
  for(const event of ['pointerdown','mousedown','click'])root.addEventListener(event,e=>e.stopPropagation());root.addEventListener('keydown',e=>e.stopPropagation());
  btn.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();held=true;}};btn.onkeyup=release;
  return {held:()=>held&&!!target, update(state,me,coop,mapData){
    opacity();root.hidden=!state||!me;if(root.hidden){target=null;release();return;}
    const next=coop?reviveTarget(state.players,me):null;if(next?.id!==target?.id)release();target=next;btn.hidden=!target;
    if(target){btn.querySelector('span').textContent=`${target.name||'Aliado'} · mantener E / botón`;btn.querySelector('progress').value=target.rv||0;}
    if(performance.now()-last<100)return;last=performance.now();
    ctx.clearRect(0,0,360,360);ctx.save();ctx.beginPath();ctx.arc(180,180,164,0,Math.PI*2);ctx.clip();ctx.fillStyle='#0c1424';ctx.fillRect(0,0,360,360);
    ctx.strokeStyle='#6f849833';ctx.lineWidth=1;for(const r of [55,110,164]){ctx.beginPath();ctx.arc(180,180,r,0,Math.PI*2);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(16,180);ctx.lineTo(344,180);ctx.moveTo(180,16);ctx.lineTo(180,344);ctx.stroke();
    // Terrain footprints orient with the player's gravity; never mask marker silhouettes.
    for(const s of mapData?.solids||[]){if(!s.c)continue;const p=projectMap([s.c.x,s.c.y,s.c.z],me);if(p.edge)continue;ctx.fillStyle='#728b9b18';ctx.strokeStyle='#728b9b45';ctx.beginPath();if(s.r)ctx.arc(180+p.x*151,180+p.y*151,Math.min(150,s.r/90*151),0,Math.PI*2);else if(s.h){for(const [i,[x,z]] of [[-1,-1],[1,-1],[1,1],[-1,1]].entries()){const q=projectMap([s.c.x+x*s.h.x,s.c.y,s.c.z+z*s.h.z],me);ctx[i?'lineTo':'moveTo'](180+q.x*151,180+q.y*151);}ctx.closePath();}ctx.fill();ctx.stroke();}
    ctx.textAlign='center';ctx.textBaseline='middle';
    for(const m of mapMarkers(state,me)){if(!Array.isArray(m.p)||m.p.length!==3)continue;const p=projectMap(m.p,me),[symbol,,color]=symbols[m.kind],x=180+p.x*151+(m.kind==='mission'?10:0),y=180+p.y*151+(m.kind==='mission'?-10:0);ctx.font=`bold ${m.kind==='host'?32:['boss','elite','objective'].includes(m.kind)?28:23}px system-ui`;ctx.lineWidth=4;ctx.strokeStyle='#0a1020';ctx.strokeText(symbol,x,y);ctx.fillStyle=color;ctx.fillText(symbol,x,y);if(Math.abs(p.height)>7){ctx.font='15px system-ui';ctx.fillText(p.height>0?'↑':'↓',x+13,y-10);}}
    ctx.restore();
  }};
}
