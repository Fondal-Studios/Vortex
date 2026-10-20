// Pestaña «Herbario» del Bestiario (docs/FLORA.md → «Herbario»): las especies de plantas (22 casillas), las que ya descubriste y las que faltan, cuántas veces
// las viste y cosechaste, los hitos que dan mejoras pequeñas y permanentes, y la Forja de jardín (botiquín orgánico, cebo para fauna y semillas).
// Se monta sobre la pantalla del Bestiario de ui.js (misma rejilla `.bcell`, mismos mandos) junto a la pestaña Fauna (fauna-ui.js).
//   buildHerbarioTab(ui)   → agrega el botón «Herbario» a la barra de pestañas y el panel de detalle.
//   selectHerbario(ui, i)  → muestra la ficha de la casilla i.      mostrarHerbario(ui)
import * as Perfil from './perfil.js';
import { ESPECIES, ESP_POR_INDICE, HITOS, HITO_IDS, herbMods, FN, CODIGO, HERB_TOPE } from '../sim/flora-data.js';
import { MATERIALS, CALIDADES, CONSUMIBLES } from '../sim/items.js';
import { TERRITORIOS } from '../sim/bendiciones.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ICONO = { cura: '✿', ofensiva: '✸', toxica: '☣' };
const CSS = `
#bestiary.herb-on #bdetail{display:none!important}
#hb-card{display:none;position:absolute;right:5vw;top:14vh;bottom:8vh;width:min(36vw,520px);overflow:auto;padding:14px 16px;border-radius:20px;background:radial-gradient(circle at 50% 0%,#1d6a3acc,#07140eee 70%);box-shadow:0 0 0 1px #ffffff26,0 30px 80px #000b;color:#fff;font:14px/1.4 system-ui,sans-serif;z-index:5}
#bestiary.herb-on #hb-card{display:block}
#hb-card h2{margin:0;font-weight:300;letter-spacing:.2em;text-transform:uppercase;font-size:clamp(17px,2vw,26px)}
#hb-card .orb{width:84px;height:84px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:38px;background:radial-gradient(circle at 35% 30%,#fff,var(--c1,#888) 55%,#000 100%);box-shadow:0 0 36px var(--c1,#fff);animation:hborb 3s ease-in-out infinite alternate}
@keyframes hborb{from{transform:scale(.96)}to{transform:scale(1.05)}}
#hb-card .tag{display:inline-block;padding:1px 9px;border-radius:999px;border:1px solid #ffffff55;font-size:11px;letter-spacing:.1em;margin:3px 4px 3px 0}
#hb-card .tag.rara{border-color:#ffe27a;color:#ffe27a}
#hb-card p{margin:6px 0}
#hb-card .box{padding:8px 10px;border-radius:12px;border:1px solid var(--c1,#fff);background:#0006;margin:6px 0}
#hb-card .box b{color:var(--c1,#fff)}
#hb-card ul{list-style:none;margin:6px 0 0;padding:0}#hb-card li{opacity:.55;padding:1px 0}#hb-card li.ok{opacity:1;color:#9dffb0}
#hb-card .bar{height:6px;border-radius:3px;background:#ffffff26;overflow:hidden;margin:4px 0}#hb-card .bar i{display:block;height:100%;background:var(--c1,#fff)}
#hb-card .forja{display:grid;gap:6px;margin-top:6px}
#hb-card .forja div{font-size:12px;padding:6px 8px;border-radius:10px;background:#ffffff12;border:1px solid #ffffff22;display:flex;gap:8px;align-items:center;justify-content:space-between}
#hb-card .forja small{opacity:.8}
#hb-card button.fab{font:700 12px system-ui,sans-serif;color:#041;background:#9dffb0;border:0;border-radius:999px;padding:5px 12px;cursor:pointer;min-height:32px}
#hb-card button.fab:disabled{opacity:.4;cursor:default}
.bcell.hbq::before{opacity:.12}.bcell.hbq span{opacity:.6}
@media (pointer:coarse),(max-width:900px){#hb-card{right:2vw;left:2vw;width:auto;top:auto;bottom:6px;max-height:44vh;padding:10px 12px}}
`;
const lugar = (S) => (S.mapa ? (TERRITORIOS[S.mapa] ? TERRITORIOS[S.mapa].nombre : S.mapa) : 'Rara: ' + (S.rara.evento === 'aurora_bendita' ? 'Bendición de la Aurora' : S.rara.evento === 'eclipse' ? 'Eclipse' : S.rara.mision ? 'misión opcional cumplida' : 'oleada del jefe'));
const visto = (id) => ((Perfil.herbario().vistas || {})[id] || 0) > 0;
const matTxt = (c) => `${MATERIALS[c.mat].name} (calidad ${CALIDADES[c.q]}+)`;
const costo = (R) => R.mats.map((x) => `${x.n}× ${MATERIALS[x.mat].name} (${CALIDADES[x.cal]}+)`).join(' · ') + ` · ${R.cores} núcleos`;

function rejilla() {
  const h = Perfil.herbario();
  $('bgrid').innerHTML = ESP_POR_INDICE.map((id, i) => { const S = ESPECIES[id], n = (h.vistas || {})[id] || 0; return `<button class="bcell ${n ? '' : 'hbq'}" data-i="${i}" style="--c:${n ? CODIGO[S.col] : '#6a6a8a'}"><span class="fi" style="position:absolute;right:6px;top:4px;font-size:15px;z-index:1">${n ? ICONO[S.fn] : '?'}</span><span>${n ? S.nombre : '???'}</span><small style="position:relative;opacity:.75;font-size:10px">${n ? (S.rara ? 'RARA' : '×' + n) : lugar(S).slice(0, 18)}</small></button>`; }).join('');
  $('bgrid').querySelectorAll('.bcell').forEach((c) => { c.addEventListener('mouseenter', () => { if (window.__ui && window.__ui.screen === 'bestiary') window.__ui.focus(+c.dataset.i); }); c.addEventListener('click', () => selectHerbario(window.__ui, +c.dataset.i)); });
}
function hitosHtml() {
  const h = Perfil.herbario(), m = herbMods(h.hitos), tope = HERB_TOPE;
  return `<h4 style="margin:12px 0 0;letter-spacing:.14em;font-weight:600">MEJORAS DEL HERBARIO · ${h.hitos.length}/${HITO_IDS.length}</h4>
    <p style="opacity:.8;margin:2px 0 0;font-size:12px">Curación de plantas +${Math.round(m.cura * 100)} % (tope ${Math.round(tope.cura * 100)}) · Daño de plantas −${Math.round(m.resis * 100)} % (tope ${Math.round(tope.resis * 100)}) · Cosecha +${m.cos} · Calidad +${Math.round(m.calidad * 100)} %. Son chicas a propósito.</p>
    <ul>${HITO_IDS.map((id) => { const H = HITOS[id], ok = h.hitos.includes(id), ef = Object.entries(H.mod).filter(([, v]) => v).map(([k, v]) => ({ cura: `curación +${Math.round(v * 100)} %`, resis: `daño de plantas −${Math.round(v * 100)} %`, cos: `+${v} cosecha`, calidad: `calidad +${Math.round(v * 100)} %` })[k]).join(', '); return `<li class="${ok ? 'ok' : ''}">${ok ? '✔' : '○'} ${esc(H.nombre)}: ${esc(H.txt)} → ${ef}</li>`; }).join('')}</ul>`;
}
function forjaHtml(filtro) {
  const ids = Object.keys(CONSUMIBLES).filter((id) => !filtro || filtro(id));
  return `<h4 style="margin:12px 0 0;letter-spacing:.14em;font-weight:600">FORJA DE JARDÍN</h4><p style="opacity:.8;margin:2px 0 0;font-size:12px">Fabricá con materiales vegetales al instante. Botiquines: ${Perfil.perfil().consum.botiquin}/5 · Cebos: ${Perfil.florita().cebos}/20.</p>
    <div class="forja">${ids.map((id) => { const C = CONSUMIBLES[id], st = Perfil.estadoConsumible(id), n = C.da.semilla ? (Perfil.florita().semillas[C.da.semilla] || 0) : null; return `<div><span><b>${C.icono} ${esc(C.nombre)}</b>${n != null ? ` ×${n}` : ''}<br><small>${esc(C.desc)}<br>${esc(costo(C))}</small></span><button class="fab" data-fab="${id}" type="button"${st.ok ? '' : ` disabled title="${esc(st.motivo)}"`}>Fabricar</button></div>`; }).join('')}</div>`;
}
function atarForja(ui, i) { $('hb-card').querySelectorAll('button.fab').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const r = Perfil.forjarConsumible(b.dataset.fab); if (ui && ui.sound) ui.sound.ui(r.ok ? 'ok' : 'tick'); selectHerbario(ui, i); })); }
export function selectHerbario(ui, i) {
  const id = ESP_POR_INDICE[i], card = $('hb-card'); if (!card) return;
  const h = Perfil.herbario(), tot = ESP_POR_INDICE.filter(visto).length, cos = Object.values(h.cosechas || {}).reduce((a, b) => a + b, 0);
  if (!id) { card.innerHTML = `<h2>Herbario</h2><p>${tot}/${ESP_POR_INDICE.length} especies · ${cos} cosechas</p>${hitosHtml()}${forjaHtml((c) => !c.startsWith('semilla_'))}`; atarForja(ui, i); return; }
  const S = ESPECIES[id], n = (h.vistas || {})[id] || 0, c = (h.cosechas || {})[id] || 0, orbe = `style="--c1:${n ? CODIGO[S.col] : '#555'}"`;
  if (!n) { card.innerHTML = `<div class="orb" ${orbe}>?</div><h2>???</h2><p><span class="tag">${esc(lugar(S))}</span>${S.rara ? '<span class="tag rara">RARA</span>' : ''}</p><p>Todavía no la viste. ${S.rara ? 'Sólo brota en una ocasión especial: mirá el aviso del mapa.' : 'Buscala en esa arena: las plantas se ven a 14 m.'}</p>${hitosHtml()}`; return; }
  card.innerHTML = `<div class="orb" ${orbe}>${ICONO[S.fn]}</div><h2>${esc(S.nombre)}</h2>
    <p><span class="tag" style="border-color:${CODIGO[S.col]}">${FN[S.fn]}</span><span class="tag">${esc(lugar(S))}</span>${S.rara ? '<span class="tag rara">RARA</span>' : ''}</p>
    <p>${esc(S.folk)}</p>
    <div class="box" style="--c1:${CODIGO[S.col]}"><b>Qué hace:</b> ${esc(S.desc)}</div>
    <p><b>Cómo avisa:</b> ${esc(S.tele)}</p><p><b>Contrajuego:</b> ${esc(S.contra)}</p>
    <p><b>Cosecha (USAR):</b> ${S.cos.n[0]}–${S.cos.n[1]}× ${esc(matTxt({ mat: S.cos.mat, q: S.cos.q }))}${S.rara ? ' · semilla y plano de jardín' : ''}${S.fn === 'ofensiva' ? ' · ¡te despierta a la planta!' : ''}</p>
    <p>Vista ${n} ${n === 1 ? 'vez' : 'veces'} · cosechada ${c} ${c === 1 ? 'vez' : 'veces'}</p>${hitosHtml()}${S.rara ? '' : forjaHtml((cid) => cid === 'semilla_' + id)}`;
  atarForja(ui, i);
}
export function mostrarHerbario(ui) {
  ui.btab = 'h'; const sec = $('bestiary'); sec.classList.remove('fauna-on'); sec.classList.add('herb-on');
  document.querySelectorAll('.bt-tab').forEach((b) => b.classList.toggle('on', b.dataset.t === 'h'));
  rejilla(); ui.idx = 0; if (ui.focus) ui.focus(0, true); selectHerbario(ui, -1);   // primero el resumen (especies, mejoras, Forja de jardín)
}
export function buildHerbarioTab(ui) {
  if ($('hb-card')) return;
  const sec = $('bestiary'), bar = $('btabs'); if (!sec || !bar) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const card = document.createElement('div'); card.id = 'hb-card'; sec.appendChild(card);
  const b = document.createElement('button'); b.className = 'bt-tab'; b.dataset.t = 'h'; b.type = 'button'; b.textContent = 'Herbario'; bar.appendChild(b);
  b.addEventListener('click', (e) => { e.stopPropagation(); mostrarHerbario(ui); if (ui.sound) ui.sound.ui('tick'); });
}
