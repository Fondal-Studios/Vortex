// Versión COMPACTA de «Evolución» para usar en partida (menú de pausa → «Evolución»): esencias absorbidas y órganos del campeón y de las armas equipadas.
// Comprar acá manda input.organ a la simulación (main.js: request({t,w,id})); las reglas son las mismas que fuera de partida (organError).
//   const m = createEvoMenu(document.body, { getMe: () => session.lastMe, request: (o) => { organReq = o; } });  m.open(); m.close(); m.isOpen()
import { WEAPONS, WEAPON_ORGANS, CHAMP_ORGANS, ESSENCES, WEAPON_ORGAN_SLOTS, champOrganSlots, CHARACTERS } from '../sim/data.js';
import { organError } from '../sim/organos.js';

const KEYS = ['carne', 'cristal', 'ojo', 'vacio'];
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = `
#evomenu{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:#05020dd8;backdrop-filter:blur(6px);font:13px system-ui,sans-serif;color:#e6ebff}
#evomenu.on{display:flex}
#evomenu .em-box{width:min(560px,94vw);max-height:92vh;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:16px;background:#0c0822f2;border:1px solid #ffffff3a;box-shadow:0 0 40px #000}
#evomenu h3{margin:0;font-size:15px;letter-spacing:.2em;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;gap:8px}
#evomenu .em-x{min-width:44px;min-height:44px;border-radius:22px;border:1px solid #ffffff55;background:#ffffff18;color:#fff;font:700 14px system-ui;cursor:pointer}
#evomenu .em-ess{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
#evomenu .em-ess span{display:flex;flex-direction:column;align-items:center;padding:3px;border-radius:8px;border:1px solid var(--e);background:#ffffff0c;line-height:1.1}
#evomenu .em-ess b{font-size:15px}#evomenu .em-ess small{font-size:9px;color:#aeb8e0;text-align:center}
#evomenu .em-tabs{display:flex;gap:5px;flex-wrap:wrap}
#evomenu .em-tab{flex:1 1 auto;min-height:40px;padding:0 8px;border-radius:10px;border:1px solid #ffffff33;background:#ffffff10;color:#dfe6ff;font:700 11px system-ui;cursor:pointer;text-transform:uppercase}
#evomenu .em-tab.sel{background:#ffd45a;color:#07030f;border-color:#ffd45a}
#evomenu .em-list{display:flex;flex-direction:column;gap:6px;overflow-y:auto;min-height:0;padding-right:2px}
#evomenu .em-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;align-items:center;padding:7px 9px;border-radius:10px;background:#ffffff0c;border-left:3px solid #ffffff44}
#evomenu .em-row.ok{border-left-color:#ffd45a;background:#ffd45a14}#evomenu .em-row.has{border-left-color:#6dff9a}#evomenu .em-row.no{opacity:.7}
#evomenu .em-row b{font-size:12px}#evomenu .em-row p{margin:0;font-size:11px;color:#c6cfef;line-height:1.3;grid-column:1}
#evomenu .em-c{display:flex;flex-wrap:wrap;gap:4px;font-size:10px}#evomenu .em-c i{font-style:normal;padding:1px 6px;border-radius:99px;border:1px solid var(--e)}
#evomenu .em-buy{grid-column:2;grid-row:1/span 3;min-width:92px;min-height:40px;border-radius:20px;border:1px solid #ffffff55;background:#ffffff16;color:#fff;font:700 10px system-ui;cursor:pointer}
#evomenu .em-buy:not(:disabled){background:#ffd45a;color:#07030f;border-color:#ffd45a}#evomenu .em-buy:disabled{opacity:.5;cursor:default}
#evomenu .em-lug{font-size:11px;color:#dfe6ff}
`;
const ESTADO = { tiene: 'Ya crecido ✓', comprable: 'Hacer crecer', 'sin esencias': 'Faltan esencias', 'grupo ocupado': 'Grupo ocupado', 'sin lugar': 'Sin lugar', incompatible: 'No compatible' };

/** Jugador mínimo para organError a partir del snapshot (ess:[4], wg:[[…]] alineado con sl, cg, evo). */
const fake = (me) => ({ ess: Object.fromEntries(KEYS.map((k, i) => [k, (me.ess || [])[i] | 0])), worg: Object.fromEntries((me.sl || []).map((w, i) => [w, (me.wg || [])[i] || []])), corg: me.cg || [], evo: me.evo | 0 });

export function createEvoMenu(host, { getMe, request, sound } = {}) {
  const doc = host.ownerDocument || document;
  if (!doc.getElementById('evomenu-style')) { const s = doc.createElement('style'); s.id = 'evomenu-style'; s.textContent = CSS; doc.head.appendChild(s); }
  const el = doc.createElement('div'); el.id = 'evomenu'; el.innerHTML = '<div class="em-box" role="dialog" aria-label="Evolución"><h3><span>Evolución</span><button class="em-x" type="button" aria-label="Cerrar">✕</button></h3><div class="em-ess"></div><div class="em-tabs"></div><div class="em-list"></div></div>'; host.appendChild(el);
  let tab = 'c', timer = 0, pending = 0, last = '';
  const q = (s) => el.querySelector(s);
  function render() {
    const me = getMe && getMe(); const list = q('.em-list'); if (!me || me.ess == null) { list.innerHTML = '<p>Sin datos todavía: jugá un momento y volvé.</p>'; return; }
    const P = fake(me), sig = JSON.stringify([P, tab, me.sl]); if (sig === last && el.querySelector('.em-row')) return; last = sig;
    q('.em-ess').innerHTML = KEYS.map((k, i) => `<span style="--e:${hex(ESSENCES[k].color)}"><b>${P.ess[k]}</b><small>${esc(ESSENCES[k].name)}</small></span>`).join('');
    const slots = (me.sl || []).map((w, i) => ({ w, i })).filter((x) => x.w != null);
    q('.em-tabs').innerHTML = `<button class="em-tab${tab === 'c' ? ' sel' : ''}" data-tab="c">${esc((CHARACTERS[me.char] || {}).name || 'Campeón')}</button>` + slots.map(({ w, i }) => `<button class="em-tab${tab === 'w' + i ? ' sel' : ''}" data-tab="w${i}">${i + 1} · ${esc(WEAPONS[w].name)}</button>`).join('');
    const rows = []; let head = '';
    if (tab === 'c') { const max = champOrganSlots(P.evo); head = `<span class="em-lug">Lugares: ${P.corg.length}/${max} (1 + nivel de evolución)</span>`; for (const [id, O] of Object.entries(CHAMP_ORGANS)) rows.push(row('c', 0, id, O, organError(P, 'c', 0, id), P)); }
    else { const i = +tab.slice(1), w = (me.sl || [])[i]; if (w != null) { head = `<span class="em-lug">Lugares: ${(P.worg[w] || []).length}/${WEAPON_ORGAN_SLOTS}</span>`; for (const [id, O] of Object.entries(WEAPON_ORGANS)) rows.push(row('w', w, id, O, organError(P, 'w', w, id), P)); } }
    list.innerHTML = head + rows.join('');
    el.querySelectorAll('.em-tab').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
    el.querySelectorAll('.em-buy').forEach((b) => b.addEventListener('click', () => { request && request({ t: b.dataset.t, w: +b.dataset.w, id: b.dataset.id }); sound && sound.ui('ok'); pending = performance.now(); }));
  }
  function row(t, w, id, O, err, P) {
    const afford = Object.entries(O.cost).every(([k, n]) => P.ess[k] >= n), st = err ? (/ya lo tiene/.test(err) ? 'tiene' : /mismo tipo/.test(err) ? 'grupo ocupado' : /lugar/.test(err) ? 'sin lugar' : 'incompatible') : afford ? 'comprable' : 'sin esencias';
    return `<div class="em-row ${st === 'comprable' ? 'ok' : st === 'tiene' ? 'has' : 'no'}"><b>${esc(O.name)}</b><span class="em-c">${Object.entries(O.cost).map(([k, n]) => `<i style="--e:${hex(ESSENCES[k].color)}">${n} ${esc(ESSENCES[k].name)}</i>`).join('')}</span><p>${esc(O.desc)}</p><button class="em-buy" type="button" data-t="${t}" data-w="${w}" data-id="${id}"${st === 'comprable' ? '' : ' disabled'}>${ESTADO[st]}</button></div>`;
  }
  q('.em-x').addEventListener('click', () => api.close());
  const api = {
    el, isOpen: () => el.classList.contains('on'),
    open() { el.classList.add('on'); last = ''; render(); clearInterval(timer); timer = setInterval(render, 600); },
    close() { el.classList.remove('on'); clearInterval(timer); },
    dispose() { clearInterval(timer); el.remove(); },
  };
  void pending; return api;
}
