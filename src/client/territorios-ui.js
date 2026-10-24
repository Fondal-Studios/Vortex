// Pantalla «TERRITORIOS»: el mapa del limbo con sus 6 lugares (folclore, estado y bendición). Se engancha en el menú (ui.js: pantalla `territorios`).
//   · estados: bloqueado (falta liberar el territorio previo) · disponible · liberado
//   · al liberar un territorio (ganar su mapa) se elige UNA de dos bendiciones; la otra queda cerrada para siempre
//   · lo guarda perfil.js; la partida lo recibe por `opts.bend` de addPlayer (src/sim/bendiciones.js). Estilos: public/territorios.css.
import { floraBriefing } from '../sim/flora-data.js';   // flora de la arena y plantas raras que pueden brotar (docs/FLORA.md)
import { TERRITORIOS, TERRITORIO_IDS, BENDICIONES, bendicionesDe } from '../sim/bendiciones.js';
import * as Perfil from './perfil.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ESTADO_ES = { bloqueado: 'Bloqueado', disponible: 'Disponible', liberado: 'Liberado' };

export function buildTerritoriosScreen(menu) {
  const root = menu.root.querySelector('#territorios'); if (!root) return;
  root.classList.add('tr');
  root.innerHTML = `
    <button class="backbtn" type="button" aria-label="Volver al menú anterior"><span aria-hidden="true">‹</span> Volver</button>
    <div class="tr-wrap">
      <nav class="tr-rail" id="trrail" aria-label="Territorios"></nav>
      <section class="tr-info" id="trinfo" aria-label="Detalle del territorio"></section>
    </div>`;
  const $ = (s) => root.querySelector(s);
  root.querySelector('.backbtn').addEventListener('click', (e) => { e.stopPropagation(); menu.back(); });
  const tr = menu.tr = { sel: 'm1' };

  function renderRail() {
    $('#trrail').innerHTML = TERRITORIO_IDS.map((id) => {
      const t = TERRITORIOS[id], est = Perfil.estadoTerritorio(id), b = Perfil.bendicionElegida(id);
      const sub = est === 'liberado' ? (b ? BENDICIONES[b].nombre : 'Elegí tu bendición') : ESTADO_ES[est];
      return `<button class="tr-chip tr-nav${id === tr.sel ? ' sel' : ''}" type="button" data-id="${id}" data-estado="${est}" style="--c:${t.color}" aria-pressed="${id === tr.sel}"><i class="tr-dot"></i><span class="tr-cn"><b>${esc(t.nombre)}</b><small>${esc(sub)}</small></span><em class="tr-ok" aria-hidden="true">${est === 'liberado' ? '✓' : est === 'bloqueado' ? '🔒' : ''}</em></button>`;
    }).join('');
    $('#trrail').querySelectorAll('.tr-chip').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); select(b.dataset.id); }));
  }
  function renderInfo() {
    const id = tr.sel, t = TERRITORIOS[id], est = Perfil.estadoTerritorio(id), elegida = Perfil.bendicionElegida(id);
    root.style.setProperty('--c', t.color);
    const falta = t.requiere.filter((r) => !Perfil.liberado(r)).map((r) => TERRITORIOS[r].nombre);
    const aviso = est === 'bloqueado' ? `Liberá primero: ${falta.map(esc).join(', ')}.` : est === 'disponible' ? `Completá la misión de este territorio para liberarlo.` : elegida ? 'Bendición elegida. Es permanente: la otra quedó cerrada.' : 'Liberado. Elegí UNA bendición: la otra se cierra para siempre.';
    const cards = bendicionesDe(id).map((bid) => {
      const b = BENDICIONES[bid], e = Perfil.estadoBendicion(bid);
      const tag = { elegida: 'Elegida', cerrada: 'Cerrada para siempre', elegible: 'Elegir', bloqueada: 'Bloqueada' }[e];
      return `<button class="tr-bend tr-nav" type="button" data-id="${bid}" data-estado="${e}"${e === 'elegible' ? '' : ' aria-disabled="true"'}><b>${esc(b.nombre)}</b><span>${esc(b.desc)}</span><small>${tag}</small></button>`;
    }).join('');
    $('#trinfo').innerHTML = `<header><h2>${esc(t.nombre)}</h2><div class="tr-tags"><span class="tr-tag" data-estado="${est}">${ESTADO_ES[est]}</span><span class="tr-tag">Jefe: ${esc(t.jefe)}</span></div></header>
      <p class="tr-folk">${esc(t.folclore)}</p><p class="tr-folk">🌿 ${floraBriefing(id).map(esc).join(' ')}</p><p class="tr-aviso">${aviso}</p><h4>Bendición del territorio</h4><div class="tr-bends">${cards}</div>`;
    $('#trinfo').querySelectorAll('.tr-bend').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); if (b.dataset.estado !== 'elegible') { menu.sound.ui('back'); return; }
      if (Perfil.elegirBendicion(id, b.dataset.id)) { menu.sound.ui('ok'); refresh(); }
    }));
  }
  function select(id) { if (!TERRITORIOS[id]) return; tr.sel = id; menu.sound.ui('tick'); refresh(); }
  function refresh() { renderRail(); renderInfo(); }
  tr.enter = () => { const pend = Perfil.bendicionPendiente(); if (pend.length) tr.sel = pend[0]; refresh(); };
  tr.select = select;
}

export function showTerritorios(menu) { if (menu.tr) menu.tr.enter(); }
