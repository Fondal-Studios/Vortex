// Pantalla «TIENDA» (docs/TIENDA.md): el Cambista de Almas vende Huéspedes, planos, materiales, objetos y servicios a cambio de núcleos.
// Se engancha en el menú (ui.js: pantalla `tienda`). Pestañas: Huéspedes · Planos y materiales · Objetos · Servicios.
//   · saldo siempre visible · cada compra pide confirmación y responde «Comprado» con una frase del Cambista · los botones dicen por qué no se puede (núcleos / requisito)
//   · usable con mouse, táctil, teclado y mando: todo lo que se toca lleva la clase `tn-nav` (ui.js los recorre en orden). Estilos: public/tienda.css.
import { CHARACTERS, HOST_IDS, HABILIDADES, ROLES, ESSENCES } from '../sim/data.js';
import { ITEMS, RARITIES, MATERIALS, CALIDADES, SLOT_NAME, SETS, MATERIAL_IDS } from '../sim/items.js';
import { CAMBISTA, SERVICIOS, ESENCIAS_IDS, HUESPEDES_TIENDA, precioHuesped, reqHuesped, estadoHuesped, precioReroll, ventaMat, textoMat } from '../sim/tienda.js';
import { MODOS_ARBOL } from '../sim/progresion.js';
import * as Perfil from './perfil.js';
import * as Tienda from './tienda.js';
import { iconoSvg } from './inventario-ui.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const TABS = [['hue', 'Huéspedes'], ['pla', 'Planos y materiales'], ['obj', 'Objetos'], ['ser', 'Servicios']];
const ROL = { asalto: 'Asalto', asesina: 'Asesina', tanque: 'Tanque', control: 'Control', 'híbrido': 'Híbrido', gravedad: 'Gravedad y área', invocador: 'Invocadora', duelista: 'Duelista' };
const MODO_ES = { combo: 'Combo', disparo: 'Shooter' };
const nuc = (n) => `<span class="tn-n">${n}<i aria-hidden="true">◆</i></span>`;

export function buildTiendaScreen(menu) {
  const root = menu.root.querySelector('#tienda'); if (!root) return;
  root.classList.add('tn');
  root.innerHTML = `
    <button class="backbtn" type="button" aria-label="Volver al menú anterior"><span aria-hidden="true">‹</span> Volver</button>
    <div class="tn-wrap">
      <header class="tn-head">
        <div class="tn-merc"><i class="tn-coin" aria-hidden="true">◆</i><div><b>${esc(CAMBISTA.nombre)}</b><small>${esc(CAMBISTA.titulo)}</small></div></div>
        <p class="tn-bubble" id="tnfrase" aria-live="polite"></p>
        <div class="tn-saldo" id="tnsaldo" title="Tus núcleos: se ganan jugando y desguazando"></div>
      </header>
      <div class="tn-tabs" id="tntabs" role="tablist">${TABS.map(([k, n]) => `<button class="tn-tab tn-nav" type="button" role="tab" data-t="${k}">${n}<i class="tn-dot" hidden></i></button>`).join('')}</div>
      <div class="tn-body" id="tnbody"></div>
      <div class="tn-toast" id="tntoast" role="status" aria-live="polite" hidden></div>
      <div class="tn-modal" id="tnmodal" hidden><div class="tn-dlg" role="alertdialog" aria-modal="true"><p id="tnq"></p><div class="tn-dlgbtns"><button type="button" class="tn-btn tn-yes" id="tnyes">Sí, comprar</button><button type="button" class="tn-btn tn-no" id="tnno">No, todavía no</button></div></div></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  $('.backbtn').addEventListener('click', (e) => { e.stopPropagation(); menu.back(); });
  const tn = menu.tn = { dialogoAbierto: () => !$('#tnmodal').hidden,  tab: 'hue', host: HUESPEDES_TIENDA[0], arbolHost: 'axioma', arbolModo: 'combo', rerollSel: null, ask: null, toastT: 0, prevT: 0 };
  const sound = (k) => { try { menu.sound.ui(k); } catch { /* sin sonido */ } };
  const saldoTxt = () => `<span>Tus núcleos</span><b>${Tienda.saldo()}</b><i aria-hidden="true">◆</i>`;
  const decir = (t) => { $('#tnfrase').textContent = t; };

  /* ───── avisos de la pantalla: toast «Comprado» + frase del Cambista + saldo ───── */
  function toast(txt, ok = true) {
    const t = $('#tntoast'); t.textContent = txt; t.hidden = false; t.dataset.ok = ok ? '1' : '0'; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go');
    clearTimeout(tn.toastT); tn.toastT = setTimeout(() => { t.hidden = true; }, 2200);
  }
  function resultado(r, etiqueta) {
    if (r.ok) { sound('ok'); toast(`Comprado: ${etiqueta}`); decir(r.frase); } else { sound('back'); toast(r.motivo, false); decir(r.frase); }
    refreshSaldo(); render(true);
  }
  /** Confirmación antes de gastar: un diálogo con «Sí» / «No» (mouse, táctil, teclado y mando). */
  function confirmar(texto, precio, hacer) {
    tn.ask = hacer; $('#tnq').innerHTML = `${esc(texto)} <b>${nuc(precio)}</b>`; $('#tnmodal').hidden = false; sound('tick');
    tn.prevIdx = menu.idx; menu.focus(0, true);
  }
  const cerrarDialogo = () => { const abierto = tn.dialogoAbierto && tn.dialogoAbierto(); tn.ask = null; $('#tnmodal').hidden = true; if (abierto && tn.prevIdx != null) { menu.idx = tn.prevIdx; tn.prevIdx = null; } };
  $('#tnyes').addEventListener('click', (e) => { e.stopPropagation(); const f = tn.ask; cerrarDialogo(); if (f) f(); });
  $('#tnno').addEventListener('click', (e) => { e.stopPropagation(); cerrarDialogo(); sound('back'); });
  tn.cerrarDialogo = cerrarDialogo;
  function refreshSaldo() { $('#tnsaldo').innerHTML = saldoTxt(); const s = document.getElementById('saldo'); if (s) s.innerHTML = saldoTxt(); }

  /* ───── Huéspedes ───── */
  const habilidadPrincipal = (id) => { const c = CHARACTERS[id], h = HABILIDADES[id]; return h ? { name: h.name, desc: `${h.rol}. ${h.desc}` } : { name: c.esp.name, desc: c.esp.desc }; };
  function boton(est, precio, motivoReq) {
    if (est === 'poseido') return { txt: 'Ya es tuyo', cls: 'own', off: true };
    if (est === 'falta requisito') return { txt: 'Falta requisito', cls: 'req', off: true };
    if (est === 'sin nucleos') return { txt: 'No alcanzan núcleos', cls: 'poor', off: true };
    return { txt: `Comprar · ${precio} ◆`, cls: 'buy', off: false };
  }
  function renderHuespedes() {
    const p = Perfil.perfil(), sel = tn.host && HUESPEDES_TIENDA.includes(tn.host) ? tn.host : HUESPEDES_TIENDA[0], C = CHARACTERS[sel], est = estadoHuesped(p, sel), rq = reqHuesped(p, sel), b = boton(est, precioHuesped(sel));
    const rail = HUESPEDES_TIENDA.map((id) => {
      const c = CHARACTERS[id], e = estadoHuesped(p, id);
      const sub = { poseido: 'Tuyo', comprable: `${precioHuesped(id)} ◆ · ¡podés comprarlo!`, 'sin nucleos': `${precioHuesped(id)} ◆`, 'falta requisito': 'Falta un requisito' }[e];
      return `<button class="tn-chip tn-nav${id === sel ? ' sel' : ''}" type="button" data-host="${id}" data-estado="${e}" style="--c:${hex(c.color)}" aria-pressed="${id === sel}"><i class="tn-cdot"></i><span><b>${esc(c.name)}</b><small>${esc(sub)}</small></span><em aria-hidden="true">${e === 'poseido' ? '✓' : e === 'falta requisito' ? '🔒' : ''}</em></button>`;
    }).join('');
    const hp = habilidadPrincipal(sel), st = C.stats || {};
    const reqTxt = rq.texto ? `<p class="tn-req" data-ok="${rq.ok ? 1 : 0}"><b>${rq.ok ? '✓' : '✗'} Requisito:</b> ${esc(rq.texto)}</p>` : '<p class="tn-req" data-ok="1"><b>✓</b> Sin requisito: sólo núcleos.</p>';
    return `<div class="tn-hue" style="--c:${hex(C.color)}">
      <nav class="tn-rail" aria-label="Huéspedes en venta">${rail}</nav>
      <section class="tn-prev" aria-label="Vista del Huésped"><div class="tn-stage" id="tnstage"><div class="tn-ini" aria-hidden="true">${esc(C.name.slice(0, 1))}</div><iframe id="tnframe" title="Retrato 3D de ${esc(C.name)}" tabindex="-1" loading="lazy"></iframe></div></section>
      <section class="tn-info"><h2>${esc(C.name)}</h2><div class="tn-sub">${esc(C.title || '')}</div>
        <div class="tn-tags"><span class="tn-tag">${esc(ROL[C.role] || (ROLES[C.role] && ROLES[C.role].name) || C.role)}</span>${st.dificultad ? `<span class="tn-tag">Dificultad ${st.dificultad}/10</span>` : ''}</div>
        <p class="tn-desc">${esc(C.desc || '')}</p>
        <div class="tn-ab"><b>${esc(hp.name)}</b><span>${esc(hp.desc)}</span></div>${reqTxt}
        <div class="tn-buyrow"><div class="tn-price">${nuc(precioHuesped(sel))}</div><button class="tn-btn tn-nav ${b.cls}" type="button" data-comprar-host="${sel}" ${b.off ? 'aria-disabled="true"' : ''}>${b.txt}</button>
        ${est === 'poseido' ? `<button class="tn-btn tn-nav" type="button" data-ir="huesped">Elegirlo en Huésped</button>` : ''}</div></section></div>`;
  }
  function ponerRetrato() {
    const fr = root.querySelector('#tnframe'); if (!fr || tn.tab !== 'hue') return; const id = tn.host, quality = matchMedia('(pointer: coarse)').matches ? 'low' : (window.__api && window.__api.level === 'low' ? 'low' : 'medium');
    clearTimeout(tn.prevT); tn.prevT = setTimeout(() => { const f = root.querySelector('#tnframe'); if (!f || tn.host !== id || tn.tab !== 'hue') return; f.src = new URL(`public/huesped-arte.html?char=${id}&q=${quality}&cam=full&w=480&h=560`, location.href.replace(/[^/?#]*([?#].*)?$/, '')).href; }, 350);
  }

  /* ───── Planos y materiales ───── */
  function rowMat(m, of) {
    const M = MATERIALS[m.mat], cant = textoMat(m), off = m.comprado || Tienda.saldo() < m.precio, motivo = m.comprado ? 'Vendido' : Tienda.saldo() < m.precio ? 'No alcanzan núcleos' : `Comprar · ${m.precio} ◆`;
    return `<article class="tn-card${m.especial ? ' esp' : ''}${m.comprado ? ' done' : ''}" style="--c:${hex(M.color)}">${m.especial ? '<em class="tn-oferta">Oferta del día</em>' : ''}<div class="tn-ico mat" aria-hidden="true"><i style="background:linear-gradient(135deg,${hex(M.color)},${hex(M.dark)})"></i></div>
      <div class="tn-ct"><b>${esc(cant)}</b><small>${esc(M.lema)} · ${esc(CALIDADES[m.cal])}</small>${precioTxt(m)}</div>
      <button class="tn-btn tn-nav ${m.comprado ? 'own' : off ? 'poor' : 'buy'}" type="button" data-renglon="materiales:${m.k}" ${off ? 'aria-disabled="true"' : ''}>${motivo}</button></article>`;
  }
  const precioTxt = (r) => `<span class="tn-pr">${r.desc ? `<s>${r.base}</s> <em>−${r.desc} %</em> ` : ''}${nuc(r.precio)}</span>`;
  function rowPlano(r) {
    const it = ITEMS[r.id], R = RARITIES[it.r], conoce = Perfil.conoce(r.id), off = r.comprado || conoce || Tienda.saldo() < r.precio;
    const motivo = conoce ? 'Ya lo conocés' : r.comprado ? 'Vendido' : Tienda.saldo() < r.precio ? 'No alcanzan núcleos' : `Comprar · ${r.precio} ◆`;
    return `<article class="tn-card${r.especial ? ' esp' : ''}${r.comprado || conoce ? ' done' : ''}" style="--c:${R.css}">${r.especial ? '<em class="tn-oferta">Oferta del día</em>' : ''}<div class="tn-ico">${iconoSvg(it, 46)}</div>
      <div class="tn-ct"><b>Plano: ${esc(it.name)}</b><small style="color:${R.css}">${R.name} · ${esc(SLOT_NAME[it.slot])} · se construye en la Forja</small>${precioTxt(r)}</div>
      <button class="tn-btn tn-nav ${conoce || r.comprado ? 'own' : off ? 'poor' : 'buy'}" type="button" data-renglon="planos:${r.k}" ${off ? 'aria-disabled="true"' : ''}>${motivo}</button></article>`;
  }
  function renderPlanos(of) {
    const stock = []; for (const m of MATERIAL_IDS) for (let c = 0; c < 4; c++) { const n = Perfil.perfil().materiales[m][c]; if (n) stock.push({ m, c, n }); }
    const vender = stock.length ? stock.map((s) => `<div class="tn-sell"><span><b>${s.n}× ${esc(MATERIALS[s.m].name)}</b> <small>${esc(CALIDADES[s.c])}</small></span><button class="tn-btn tn-nav" type="button" data-vmat="${s.m}:${s.c}:1">Vender 1 · +${ventaMat(s.m, s.c)} ◆</button><button class="tn-btn tn-nav" type="button" data-vmat="${s.m}:${s.c}:${s.n}">Vender todo · +${ventaMat(s.m, s.c) * s.n} ◆</button></div>`).join('') : '<p class="tn-vacio">No tenés materiales para vender. Se consiguen en las partidas.</p>';
    return `<h3 class="tn-h">Materiales de hoy</h3><div class="tn-grid">${of.materiales.map((m) => rowMat(m, of)).join('')}</div>
      <h3 class="tn-h">Planos</h3><div class="tn-grid">${of.planos.map(rowPlano).join('')}</div>
      <h3 class="tn-h">Vender materiales <small>el Cambista paga el 35 % de lo que cuestan</small></h3><div class="tn-sells">${vender}</div>`;
  }

  /* ───── Objetos ───── */
  function rowObj(o) {
    const it = ITEMS[o.id], R = RARITIES[it.r], off = o.comprado || Tienda.saldo() < o.precio, lleno = Perfil.perfil().inventario.length >= 60;
    const motivo = o.comprado ? 'Vendido' : lleno ? 'Inventario lleno' : Tienda.saldo() < o.precio ? 'No alcanzan núcleos' : `Comprar · ${o.precio} ◆`, bloqueado = off || lleno;
    return `<article class="tn-card${o.especial ? ' esp' : ''}${o.comprado ? ' done' : ''}" style="--c:${R.css}">${o.especial ? '<em class="tn-oferta">Oferta del día</em>' : ''}<div class="tn-ico">${iconoSvg(it, 46)}</div>
      <div class="tn-ct"><b>${esc(it.name)}</b><small style="color:${R.css}">${R.name} · ${esc(SLOT_NAME[it.slot])} · calidad ${Math.round(o.q * 100)} %${it.set && SETS[it.set] ? ' · set ' + esc(SETS[it.set].name) : ''}</small><small class="tn-lore">${esc(it.lore || '')}</small>${precioTxt(o)}</div>
      <button class="tn-btn tn-nav ${o.comprado ? 'own' : bloqueado ? 'poor' : 'buy'}" type="button" data-renglon="objetos:${o.k}" ${bloqueado ? 'aria-disabled="true"' : ''}>${motivo}</button></article>`;
  }
  function renderObjetos(of) {
    const c = Tienda.previewSobrantes(0), r = Tienda.previewSobrantes(1);
    return `<h3 class="tn-h">Objetos de hoy</h3><div class="tn-grid">${of.objetos.map(rowObj).join('')}</div>
      <h3 class="tn-h">Desguace rápido <small>no toca lo bloqueado, favorito ni puesto</small></h3>
      <div class="tn-sells"><div class="tn-sell"><span><b>Sobrantes Comunes</b> <small>${c.n} pieza${c.n === 1 ? '' : 's'}</small></span><button class="tn-btn tn-nav" type="button" data-vsob="0" ${c.n ? '' : 'aria-disabled="true"'}>Desguazar · +${c.cores} ◆</button></div>
      <div class="tn-sell"><span><b>Comunes y Raras</b> <small>${r.n} pieza${r.n === 1 ? '' : 's'}</small></span><button class="tn-btn tn-nav" type="button" data-vsob="1" ${r.n ? '' : 'aria-disabled="true"'}>Desguazar · +${r.cores} ◆</button></div></div>`;
  }

  /* ───── Servicios ───── */
  function renderServicios() {
    const p = Perfil.perfil(), S = SERVICIOS, bot = Tienda.botiquines(), hostsOwn = HOST_IDS.filter((id) => Tienda.poseeHuesped(id));
    const ah = hostsOwn.includes(tn.arbolHost) ? tn.arbolHost : hostsOwn[0], pts = Tienda.puntosReinicio(ah, tn.arbolModo);
    const optsH = hostsOwn.map((id) => `<option value="${id}"${id === ah ? ' selected' : ''}>${esc(CHARACTERS[id].name)}</option>`).join('');
    const optsM = MODOS_ARBOL.map((m) => `<option value="${m}"${m === tn.arbolModo ? ' selected' : ''}>${MODO_ES[m] || m}</option>`).join('');
    const piezas = Tienda.retirables().sort((a, b) => ITEMS[b.id].r - ITEMS[a.id].r || b.q - a.q).slice(0, 40);
    const rsel = piezas.find((x) => x.u === tn.rerollSel) || piezas[0];
    const optsP = piezas.map((x) => `<option value="${x.u}"${rsel && x.u === rsel.u ? ' selected' : ''}>${esc(ITEMS[x.id].name)} · ${RARITIES[ITEMS[x.id].r].name} · ${Math.round(x.q * 100)} %</option>`).join('');
    const btn = (ok, txt, attr, extra = '') => `<button class="tn-btn tn-nav ${ok ? 'buy' : 'poor'}" type="button" ${attr} ${ok ? '' : 'aria-disabled="true"'}>${txt}${extra}</button>`;
    const ess = ESENCIAS_IDS.map((k) => `<div class="tn-sell"><span><b>${esc(ESSENCES[k].name)}</b> <small>tenés ${p.ess[k] || 0}</small></span>${btn(Tienda.saldo() >= S.esencia.compra, `Comprar 1 · ${S.esencia.compra} ◆`, `data-ess="${k}:1"`)}<button class="tn-btn tn-nav" type="button" data-ess="${k}:-1" ${(p.ess[k] || 0) > 0 ? '' : 'aria-disabled="true"'}>Vender 1 · +${S.esencia.venta} ◆</button></div>`).join('');
    return `<div class="tn-grid sv">
      <article class="tn-card"><div class="tn-ico" aria-hidden="true"><span class="tn-emo">✚</span></div><div class="tn-ct"><b>${S.botiquin.nombre}</b><small>${esc(S.botiquin.desc)}</small><small>Llevás <b>${bot}</b> de ${S.botiquin.max}.</small><span class="tn-pr">${nuc(S.botiquin.precio)}</span></div>
        ${btn(bot < S.botiquin.max && Tienda.saldo() >= S.botiquin.precio, bot >= S.botiquin.max ? 'Máximo' : Tienda.saldo() < S.botiquin.precio ? 'No alcanzan núcleos' : `Comprar · ${S.botiquin.precio} ◆`, 'data-svc="botiquin"')}</article>
      <article class="tn-card"><div class="tn-ico" aria-hidden="true"><span class="tn-emo">↺</span></div><div class="tn-ct"><b>${S.reinicio.nombre}</b><small>${esc(S.reinicio.desc)}</small>
        <span class="tn-sel"><label>Huésped <select id="tnarbolh" class="tn-nav">${optsH}</select></label><label>Árbol <select id="tnarbolm" class="tn-nav">${optsM}</select></label></span>
        <small>${pts ? `Devolvería <b>${pts}</b> punto${pts === 1 ? '' : 's'}.` : 'Ese árbol no tiene nodos elegidos.'}</small><span class="tn-pr">${nuc(S.reinicio.precio)}</span></div>
        ${btn(pts > 0 && Tienda.saldo() >= S.reinicio.precio, !pts ? 'Nada que reiniciar' : Tienda.saldo() < S.reinicio.precio ? 'No alcanzan núcleos' : `Reiniciar · ${S.reinicio.precio} ◆`, 'data-svc="reinicio"')}</article>
      <article class="tn-card"><div class="tn-ico" aria-hidden="true"><span class="tn-emo">⚄</span></div><div class="tn-ct"><b>${S.reroll.nombre}</b><small>${esc(S.reroll.desc)}</small>
        ${piezas.length ? `<span class="tn-sel"><label>Pieza <select id="tnreroll" class="tn-nav">${optsP}</select></label></span><span class="tn-pr">${nuc(precioReroll(ITEMS[rsel.id].r))}</span>` : '<small>No tenés piezas en el inventario.</small>'}</div>
        ${piezas.length ? btn(Tienda.saldo() >= precioReroll(ITEMS[rsel.id].r), Tienda.saldo() < precioReroll(ITEMS[rsel.id].r) ? 'No alcanzan núcleos' : `Tirar de nuevo · ${precioReroll(ITEMS[rsel.id].r)} ◆`, 'data-svc="reroll"') : ''}</article>
    </div><h3 class="tn-h">${S.esencia.nombre} <small>${esc(S.esencia.desc)}</small></h3><div class="tn-sells">${ess}</div>`;
  }

  /* ───── dibujo y eventos ───── */
  function render(keepFocus = false) {
    const of = Tienda.ofertaActual(), body = $('#tnbody'), y = body.scrollTop, idx = menu.idx;
    root.querySelectorAll('.tn-tab').forEach((b) => { const on = b.dataset.t === tn.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    const dot = root.querySelector('.tn-tab[data-t=hue] .tn-dot'); if (dot) dot.hidden = !HUESPEDES_TIENDA.some((id) => estadoHuesped(Perfil.perfil(), id) === 'comprable');
    body.innerHTML = tn.tab === 'hue' ? renderHuespedes() : tn.tab === 'pla' ? renderPlanos(of) : tn.tab === 'obj' ? renderObjetos(of) : renderServicios();
    body.dataset.tab = tn.tab; refreshSaldo(); bind(); if (tn.tab === 'hue' && !keepFocus) ponerRetrato(); if (tn.tab === 'hue' && keepFocus) { const f = root.querySelector('#tnframe'); if (f && !f.src) ponerRetrato(); }
    body.scrollTop = y; if (keepFocus) menu.focus(idx, true);
  }
  function bind() {
    const body = $('#tnbody'), stop = (fn) => (e) => { e.stopPropagation(); fn(e); };
    body.querySelectorAll('[data-host]').forEach((b) => b.addEventListener('click', stop(() => { tn.host = b.dataset.host; sound('tick'); render(true); ponerRetrato(); })));
    body.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', stop(() => { menu.go(b.dataset.ir); })));
    const negado = (b, tipo) => { if (b.getAttribute('aria-disabled') !== 'true') return false; sound('back'); const t = b.textContent; toast(t, false); decir(CAMBISTA.frases[tipo(t)][0]); return true; };
    const tipoDe = (t) => (/requisito/i.test(t) ? 'requisito' : /núcleos/i.test(t) ? 'pobre' : 'nada');
    body.querySelectorAll('[data-comprar-host]').forEach((b) => b.addEventListener('click', stop(() => {
      if (negado(b, tipoDe)) { const rq = reqHuesped(Perfil.perfil(), b.dataset.comprarHost); if (rq.texto && !rq.ok) decir(`${CAMBISTA.frases.requisito[0]} ${rq.texto}`); return; }
      const id = b.dataset.comprarHost; confirmar(`¿Comprar a ${CHARACTERS[id].name} por`, precioHuesped(id), () => resultado(Tienda.comprarHuesped(id), CHARACTERS[id].name));
    })));
    body.querySelectorAll('[data-renglon]').forEach((b) => b.addEventListener('click', stop(() => {
      if (negado(b, tipoDe)) return; const [g, k] = b.dataset.renglon.split(':'), of = Tienda.ofertaActual(), r = of[g].find((x) => x.k === k); if (!r) return;
      const nombre = g === 'materiales' ? textoMat(r) : g === 'planos' ? 'Plano: ' + ITEMS[r.id].name : ITEMS[r.id].name;
      confirmar(`¿Comprar ${nombre} por`, r.precio, () => resultado(Tienda.comprarRenglon(g, k), nombre));
    })));
    body.querySelectorAll('[data-vmat]').forEach((b) => b.addEventListener('click', stop(() => {
      const [m, c, n] = b.dataset.vmat.split(':'); const r = Tienda.venderMat(m, +c, +n); if (r.ok) { sound('ok'); toast(`Vendido: +${r.cores} núcleos`); decir(r.frase); } else { sound('back'); toast(r.motivo, false); } refreshSaldo(); render(true);
    })));
    body.querySelectorAll('[data-vsob]').forEach((b) => b.addEventListener('click', stop(() => {
      if (b.getAttribute('aria-disabled') === 'true') { sound('back'); toast('No hay sobrantes de esa rareza.', false); return; }
      const hasta = +b.dataset.vsob, pv = Tienda.previewSobrantes(hasta);
      confirmar(`¿Desguazar ${pv.n} pieza${pv.n === 1 ? '' : 's'} y cobrar`, pv.cores, () => { const r = Tienda.venderSobrantes(hasta); if (r.ok) { sound('ok'); toast(`Desguazadas ${r.n}: +${r.cores} núcleos`); decir(r.frase); } else { sound('back'); toast(r.motivo, false); } refreshSaldo(); render(true); });
    })));
    body.querySelectorAll('[data-ess]').forEach((b) => b.addEventListener('click', stop(() => {
      if (negado(b, tipoDe)) return; const [k, d] = b.dataset.ess.split(':'); const r = Tienda.cambiarEsencia(k, +d); if (r.ok) { sound('ok'); toast(+d > 0 ? 'Comprada 1 esencia' : 'Vendida 1 esencia'); decir(r.frase); } else { sound('back'); toast(r.motivo, false); } refreshSaldo(); render(true);
    })));
    body.querySelectorAll('[data-svc]').forEach((b) => b.addEventListener('click', stop(() => {
      if (negado(b, tipoDe)) return; const s = b.dataset.svc;
      if (s === 'botiquin') confirmar('¿Comprar un Botiquín inicial por', SERVICIOS.botiquin.precio, () => resultado(Tienda.comprarBotiquin(), 'Botiquín inicial'));
      if (s === 'reinicio') confirmar(`¿Reiniciar el árbol ${MODO_ES[tn.arbolModo]} de ${CHARACTERS[tn.arbolHost].name} por`, SERVICIOS.reinicio.precio, () => resultado(Tienda.comprarReinicio(tn.arbolHost, tn.arbolModo), 'Reinicio de nodos'));
      if (s === 'reroll') { const it = Perfil.instDe(tn.rerollSel) || Tienda.retirables()[0]; if (!it) return; const uid = it.u; confirmar(`¿Tirar de nuevo la calidad de ${ITEMS[it.id].name} (puede empeorar) por`, precioReroll(ITEMS[it.id].r), () => { const r = Tienda.retirarTirada(uid); if (r.ok) r.frase += ` (${Math.round(r.antes * 100)} % → ${Math.round(r.despues * 100)} %)`; resultado(r, 'Nueva tirada'); }); }
    })));
    const sh = body.querySelector('#tnarbolh'), sm = body.querySelector('#tnarbolm'), sr = body.querySelector('#tnreroll');
    if (sh) sh.addEventListener('change', () => { tn.arbolHost = sh.value; render(true); }); if (sm) sm.addEventListener('change', () => { tn.arbolModo = sm.value; render(true); }); if (sr) sr.addEventListener('change', () => { tn.rerollSel = sr.value; render(true); });
    [sh, sm, sr].forEach((s) => s && s.addEventListener('click', (e) => e.stopPropagation()));
  }
  root.querySelectorAll('.tn-tab').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); tn.tab = b.dataset.t; sound('tick'); render(true); }));
  tn.setTab = (t) => { if (TABS.some((x) => x[0] === t)) { tn.tab = t; render(); } };
  tn.enter = () => {
    cerrarDialogo(); const of = Tienda.ofertaActual(); const p = Perfil.perfil(); p.menu.tv = of.clave; Perfil.guardar();   // ya viste el stock de hoy
    if (!tn.host || !HUESPEDES_TIENDA.includes(tn.host)) tn.host = HUESPEDES_TIENDA[0];
    decir(CAMBISTA.saludo); render(); refreshSaldo();
  };
  tn.render = render;
}

export function showTienda(menu) { if (menu.tn) menu.tn.enter(); }
