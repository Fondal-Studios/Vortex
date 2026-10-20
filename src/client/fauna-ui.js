// Pestaña «Fauna» del Bestiario (docs/FAUNA.md → «Códice de Fauna»): las 20 especies (20 casillas), las que ya comiste y las que faltan, el contador y los hitos de cada una,
// el ADN, y los 12 híbridos con su pista («❄ + ⚡ = ???»). Se monta sobre la pantalla del Bestiario de ui.js (misma rejilla `.bcell`, mismos mandos) sin cambiar su HTML.
//   buildFaunaTab(ui)   → agrega la barra «Criaturas · Fauna» (también con las teclas F / ] / [) y el panel de detalle.
//   selectFauna(ui, i)  → muestra la ficha de la casilla i.      mostrarTab(ui, 'c'|'f')
import * as Perfil from './perfil.js';
import { ESPECIES, ESPECIE_IDS, FORMAS, HIBRIDOS_DEF, HIBRIDOS, HITOS, proximoHito, bonoCodice } from '../sim/fauna-data.js';
import { TERRITORIOS } from '../sim/bendiciones.js';

const $ = (id) => document.getElementById(id);
const CSS = `
#btabs{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translateX(-50%);display:flex;gap:8px;z-index:6}
.bt-tab{font:700 13px system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#fff;background:#ffffff14;border:1px solid #ffffff33;border-radius:999px;padding:7px 18px;cursor:pointer}
.bt-tab.on{background:#ffffff33;border-color:#fff;box-shadow:0 0 18px #ffffff55}
#bestiary.fauna-on #bdetail{display:none!important}
#fa-card{display:none;position:absolute;right:5vw;top:14vh;bottom:8vh;width:min(36vw,520px);overflow:auto;padding:14px 16px;border-radius:20px;background:radial-gradient(circle at 50% 0%,#2a2f8acc,#0a0d2aee 70%);box-shadow:0 0 0 1px #ffffff26,0 30px 80px #000b;color:#fff;font:14px/1.4 system-ui,sans-serif;z-index:5}
#bestiary.fauna-on #fa-card{display:block}
#fa-card h2{margin:0;font-weight:300;letter-spacing:.2em;text-transform:uppercase;font-size:clamp(17px,2vw,26px)}
#fa-card .orb{width:92px;height:92px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:40px;background:radial-gradient(circle at 35% 30%,var(--c2,#fff),var(--c1,#888) 55%,#000 100%);box-shadow:0 0 36px var(--c1,#fff);animation:faorb 3s ease-in-out infinite alternate}
@keyframes faorb{from{transform:scale(.96)}to{transform:scale(1.05)}}
#fa-card .tag{display:inline-block;padding:1px 9px;border-radius:999px;border:1px solid #ffffff55;font-size:11px;letter-spacing:.1em;margin:3px 4px 3px 0}
#fa-card .tag.pel{border-color:#ff5a6a;color:#ffb0b8}#fa-card .tag.rara{border-color:#ffe27a;color:#ffe27a}
#fa-card p{margin:6px 0}#fa-card .form{padding:8px 10px;border-radius:12px;border:1px solid var(--fc,#fff);background:#0006}#fa-card .form b{color:var(--fc,#fff)}
#fa-card ul{list-style:none;margin:6px 0 0;padding:0}#fa-card li{opacity:.55;padding:1px 0}#fa-card li.ok{opacity:1;color:#9dffb0}
#fa-card .bar{height:6px;border-radius:3px;background:#ffffff26;overflow:hidden;margin:4px 0}#fa-card .bar i{display:block;height:100%;background:var(--c1,#fff)}
#fa-card .hib{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:6px}#fa-card .hib div{font-size:12px;padding:5px 8px;border-radius:10px;background:#ffffff12;border:1px solid #ffffff22}#fa-card .hib div.ok{border-color:#ff7ae6;background:#ff7ae622}
.bcell.faq::before{opacity:.12}.bcell.faq span{opacity:.6}
.bcell .fi{position:absolute;right:6px;top:4px;font-size:15px;z-index:1}.bcell small{position:relative;opacity:.75;font-size:10px}
@media (pointer:coarse),(max-width:900px){#fa-card{right:2vw;left:2vw;width:auto;top:auto;bottom:6px;max-height:44vh;padding:10px 12px}#bgrid{width:96vw!important;grid-template-columns:repeat(5,1fr)!important}}
`;

const lugar = (sp) => (sp.mapa === '*' ? 'Cualquier arena (rara)' : (TERRITORIOS[sp.mapa] ? TERRITORIOS[sp.mapa].nombre : sp.mapa));
const conocida = (id) => ((Perfil.fauna().c || {})[id] || 0) > 0;

/** Rejilla de la pestaña Fauna dentro de #bgrid (misma clase `.bcell` que las criaturas: los mandos siguen funcionando). */
function rejilla() {
  const f = Perfil.fauna();
  $('bgrid').innerHTML = ESPECIE_IDS.map((id, i) => { const s = ESPECIES[id], n = (f.c || {})[id] || 0; return `<button class="bcell ${n ? '' : 'faq'}" data-i="${i}" style="--c:${n ? s.c1 : '#6a6a8a'}"><span class="fi">${n ? FORMAS[s.forma].icono : '?'}</span><span>${n ? s.nombre : '???'}</span><small>${n ? '×' + n : lugar(s).split(' ')[0]}</small></button>`; }).join('');
  $('bgrid').querySelectorAll('.bcell').forEach((c) => { c.addEventListener('mouseenter', () => { if (window.__ui && window.__ui.screen === 'bestiary') window.__ui.focus(+c.dataset.i); }); c.addEventListener('click', () => selectFauna(window.__ui, +c.dataset.i)); });
}
function hibridos() {
  const f = Perfil.fauna(), hib = f.hib || [];
  return `<h4 style="margin:12px 0 0;letter-spacing:.14em;font-weight:600">HÍBRIDOS · ${hib.length}/${HIBRIDOS_DEF.length}</h4><p style="opacity:.75;margin:2px 0 0;font-size:12px">Comé dos bichos de formas compatibles, uno después del otro, y se funden.</p><div class="hib">${HIBRIDOS_DEF.map((h) => { const ok = hib.includes(h.id); return `<div class="${ok ? 'ok' : ''}">${FORMAS[h.a].icono} + ${FORMAS[h.b].icono} = ${ok ? `<b>${HIBRIDOS[h.id].icono} ${h.nombre}</b>` : '???'}</div>`; }).join('')}</div>`;
}
export function selectFauna(ui, i) {
  const id = ESPECIE_IDS[i], card = $('fa-card'); if (!card) return;
  const f = Perfil.fauna(), tot = f.tot || 0, adn = Object.values(f.adn || {}).reduce((a, b) => a + b, 0);
  if (!id) { card.innerHTML = `<h2>Códice de Fauna</h2><p>${ESPECIE_IDS.filter(conocida).length}/${ESPECIE_IDS.length} especies · ${tot} comidas · ${adn} ADN</p>${hibridos()}`; return; }
  const s = ESPECIES[id], n = (f.c || {})[id] || 0, F = FORMAS[s.forma], prox = proximoHito(n), bono = bonoCodice(n);
  const orbe = `style="--c1:${n ? s.c1 : '#555'};--c2:${n ? s.c2 : '#222'}"`;
  if (!n) { card.innerHTML = `<div class="orb" ${orbe}>?</div><h2>???</h2><p><span class="tag">${lugar(s)}</span>${s.rara ? '<span class="tag rara">RARA</span>' : ''}</p><p>Todavía no comiste ninguna. Buscala en esa arena, en el respiro entre oleadas, y acercate a ella con cuidado.</p>${hibridos()}`; return; }
  const prog = prox ? Math.min(100, Math.round(100 * n / prox.n)) : 100, dur = Math.round(s.dur * bono.durK + bono.durMas);
  card.innerHTML = `<div class="orb" ${orbe}>${F.icono}</div><h2>${s.nombre}</h2>
    <p><span class="tag">${lugar(s)}</span>${s.peligrosa ? '<span class="tag pel">⚠ PELIGROSA: muerde</span>' : ''}${s.rara ? '<span class="tag rara">RARA</span>' : ''}</p>
    <p>${s.folclore}</p><p><i>«${s.frase}»</i></p>
    <p><b>Cómo atraparla:</b> ${s.pista}</p>
    <div class="form" style="--fc:${F.color}"><b>${F.icono} ${F.nombre}</b> · dura ${dur} s<br>${F.desc}</div>
    <p style="margin-top:10px"><b>Comida ${n} ${n === 1 ? 'vez' : 'veces'}</b> · ADN ${(f.adn || {})[s.forma] || 0}${prox ? ` · próximo hito: ${prox.n}` : ' · ¡todos los hitos!'}</p><div class="bar" style="--c1:${s.c1}"><i style="width:${prog}%"></i></div>
    <ul>${HITOS.map((h) => `<li class="${n >= h.n ? 'ok' : ''}">${n >= h.n ? '✔' : '○'} ${h.n}: ${h.txt}</li>`).join('')}</ul>${hibridos()}`;
}
export function mostrarTab(ui, t) {
  ui.btab = t; const sec = $('bestiary'); sec.classList.toggle('fauna-on', t === 'f'); sec.classList.remove('herb-on');   // (el Herbario, flora-ui.js, usa su propia clase)
  document.querySelectorAll('.bt-tab').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
  if (t === 'f') { rejilla(); ui.idx = 0; if (ui.focus) ui.focus(0, true); selectFauna(ui, 0); }
  else { ui.buildBestiaryCriaturas(); ui.idx = 0; if (ui.focus) ui.focus(0, true); ui.selectBeast(0); }
}
export function buildFaunaTab(ui) {
  if ($('btabs')) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const sec = $('bestiary'); if (!sec) return;
  const bar = document.createElement('div'); bar.id = 'btabs'; bar.innerHTML = '<button class="bt-tab on" data-t="c" type="button">Criaturas</button><button class="bt-tab" data-t="f" type="button">Fauna</button>'; sec.appendChild(bar);
  const card = document.createElement('div'); card.id = 'fa-card'; sec.appendChild(card);
  bar.querySelectorAll('.bt-tab').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); mostrarTab(ui, b.dataset.t); if (ui.sound) ui.sound.ui('tick'); }));
  window.__ui = ui; ui.btab = 'c';
  addEventListener('keydown', (e) => { if (ui.screen !== 'bestiary' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return; if (e.code === 'KeyF' || e.code === 'BracketRight' || e.code === 'BracketLeft') { e.preventDefault(); mostrarTab(ui, ui.btab === 'f' ? 'c' : 'f'); } });
}
