// Pantalla «INVENTARIO» (docs/INVENTARIO.md): objetos, materiales, planos, Forja biológica y sets. Se engancha en el menú (ui.js: pantalla `inventario`) y se abre también
// desde la pantalla de Huésped. Patrón de territorios-ui.js / huespedes-ui.js: riel de Huéspedes a la izquierda, panel con pestañas a la derecha, vista previa 3D propia.
//   · Objetos: rejilla con filtros por tipo y rareza, ficha con comparación contra lo puesto, equipar / quitar / bloquear / favorito / desguazar / fusionar
//   · Materiales: stock por calidad (Burdo · Fino · Excelente · Perfecto) · Planos: los que conocés y los que faltan · Forja: receta = plano + materiales + núcleos, cultivo con tiempo
//   · Sets: cuántas piezas de cada familia llevás y qué bonos de 2 y 4 piezas tenés. Usable con táctil, mouse, teclado y mando. Estilos: public/inventario.css.
import { CHARACTERS, HOST_IDS } from '../sim/data.js';
import {
  ITEMS, ITEM_IDS, RARITIES, MATERIALS, MATERIAL_IDS, CALIDADES, SLOT_NAME, SLOTS, TYPE_NAME, TYPES, FASES, SETS, SET_IDS, RECETAS, PLANOS, LIMITE_INVENTARIO, MAT_STOCK_MAX,
  lineasStats, lineasArma, lineasPasivos, lineasSinergias, proximaFase, progresoFase, faseDe, itemStats, poder, desguaceValor, costoTexto, setCounts, setActivos, fxTxt, STAT_ES, ADD_KEYS,
} from '../sim/items.js';
import * as Perfil from './perfil.js';
import { Equipo } from './equipo.js';
import { tickMenuBeat } from './shaders.js';
import { loadEnvHDRI } from './ph.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const hosts = () => HOST_IDS.filter((id) => CHARACTERS[id]);
const TIPO_FILTRO = [['todo', 'Todo'], ...TYPES.map((t) => [t, TYPE_NAME[t]])];
const RAREZA_FILTRO = [['todo', 'Todas'], ...RARITIES.map((r, i) => [String(i), r.name])];
const ICONO = {
  gun: 'M2 11h12l3-2h3v3h-2l-2 1h-3v4h-3v-4H2z', melee: 'M12 1l2.2 3.4V14h-4.4V4.4zM7 14h10v2H7zM11 16h2v6h-2z', head: 'M4 15a8 8 0 0116 0v4h-4v-3H8v3H4z', torso: 'M6 3l3 2h6l3-2 3 4-3 3v11H6V10L3 7z',
  arms: 'M3 9h9l3-3 5 4-5 8-3-3-4 3H3z', legs: 'M7 2h10l-1 9 1.5 11h-4.5L12 13l-1 9H6.5L8 11z', relic: 'M12 1l3 6.5 7 1-5 4.7 1.4 7L12 17l-6.4 3.2L7 13.2 2 8.5l7-1z',
};
/** Ícono SVG de un objeto: silueta de su ranura con el degradé de su material y borde del color de su rareza. */
export function iconoSvg(it, size = 44) {
  const M = MATERIALS[it.mat], R = RARITIES[it.r], id = 'g' + it.id;
  return `<svg class="iv-ico" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex(M.color)}"/><stop offset="1" stop-color="${hex(M.dark)}"/></linearGradient></defs><path d="${ICONO[it.slot]}" fill="url(#${id})" stroke="${R.css}" stroke-width="1.1" stroke-linejoin="round"/><circle cx="19" cy="5" r="2.2" fill="${hex(M.glow)}" opacity=".9"/></svg>`;
}
const pct = (v, key) => (ADD_KEYS.includes(key) ? `${v >= 0 ? '+' : ''}${Math.round(v * 10) / 10}` : `${v >= 0 ? '+' : ''}${Math.round(v * 1000) / 10} %`);
/** Diferencias de bonos entre dos instancias (a = candidata, b = puesta o null): [{ k, d }] ordenadas. */
export function comparar(a, b) {
  const A = itemStats(a).st, B = b ? itemStats(b).st : {}, out = [];
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) { const add = ADD_KEYS.includes(k), va = A[k] ?? (add ? 0 : 1), vb = B[k] ?? (add ? 0 : 1); let d = add ? va - vb : va - vb; if (k === 'dmgIn' || k === 'cd') d = -d; if (Math.abs(d) > 1e-6) out.push({ k, d }); }
  return out;
}
export const faseTxt = (it, k) => FASES[faseDe(it, k)];

export function buildInventarioScreen(menu) {
  const root = menu.root.querySelector('#inventario'); if (!root) return;
  root.classList.add('iv');
  root.innerHTML = `
    <button class="backbtn" type="button" aria-label="Volver al menú anterior"><span aria-hidden="true">‹</span> Volver</button>
    <div class="iv-wrap">
      <nav class="iv-rail" id="ivrail" aria-label="Huéspedes">${hosts().map((id) => `<button class="iv-chip iv-nav" type="button" data-id="${id}" style="--c:${hex(CHARACTERS[id].color)}" aria-pressed="false"><i class="iv-dot"></i><span><b>${esc(CHARACTERS[id].name)}</b><small id="ivsub-${id}"></small></span></button>`).join('')}</nav>
      <section class="iv-stage-box" aria-label="Vista del Huésped"><div class="iv-stage" id="ivstage"><canvas id="ivcanvas" aria-label="Modelo 3D del Huésped con su equipo: arrastrá para girarlo"></canvas><div class="iv-fallback" id="ivfb" hidden></div></div>
        <div class="iv-slots" id="ivslots" role="list" aria-label="Equipo puesto"></div><div class="iv-note" id="ivnote" aria-live="polite"></div></section>
      <section class="iv-main" aria-label="Inventario">
        <div class="iv-bank" id="ivbank"></div>
        <div class="iv-tabs" id="ivtabs" role="tablist">${[['obj', 'Objetos'], ['mat', 'Materiales'], ['pla', 'Planos'], ['for', 'Forja'], ['set', 'Sets']].map(([k, n]) => `<button class="iv-tab iv-nav" type="button" role="tab" data-t="${k}">${n}</button>`).join('')}</div>
        <div class="iv-body" id="ivbody"></div>
      </section>
    </div>`;
  const $ = (s) => root.querySelector(s);
  $('.backbtn').addEventListener('click', (e) => { e.stopPropagation(); menu.back(); });
  const iv = menu.iv = { host: 'axioma', tab: 'obj', tipo: 'todo', rar: 'todo', sel: null, selRec: null, fusion: null, probar: null, THREE: null, failed: false, running: false, user: 0, idle: 0, drag: null, quality: 'low', tick: null };

  const sound = (k) => { try { menu.sound.ui(k); } catch { /* sin sonido */ } };
  const pl = () => { const pp = Perfil.paraPartida(iv.host), eq = Perfil.equipoDe(iv.host); return { char: iv.host, name: CHARACTERS[iv.host].name, evo: pp.evo || 0, pth: pp.path || [], cg: pp.corg || [], mw: '', mr: pp.maestria || 1, eq: eqStr(eq) }; };
  const eqStr = (eq, quita = null, pone = null) => { const m = { ...eq }; if (quita) delete m[quita]; if (pone) m[ITEMS[pone.id].slot] = pone; return Object.values(m).map((i) => `${i.id}.${faseDe(ITEMS[i.id], i.k)}`).join(','); };

  /* ───── 3D ───── */
  async function ensureThree() {
    if (iv.THREE || iv.failed) return;
    try {
      const THREE = await import('three'), canvas = $('#ivcanvas');
      const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
      iv.quality = matchMedia('(pointer: coarse)').matches || (window.__api && window.__api.level === 'low') ? 'low' : 'medium';
      gl.setPixelRatio(Math.min(devicePixelRatio || 1, iv.quality === 'low' ? 1.5 : 2)); gl.setClearColor(0x000000, 0); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.2;
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
      const hemi = new THREE.HemisphereLight(0xd4daff, 0x3a1f55, 2.1), key = new THREE.DirectionalLight(0xfff1e0, 3.2), rim = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2.2, 3.4, 4); rim.position.set(-3, 2.4, -3.5); scene.add(hemi, key, rim);
      const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.2, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, ...add, opacity: 0.7 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
      Object.assign(iv, { THREE, renderer: gl, scene, cam, ring, rim });
      loadEnvHDRI(gl, 'small_cathedral_02').then((t) => { scene.environment = t; scene.environmentIntensity = 0.9; }).catch(() => {});
      new ResizeObserver(() => frame()).observe($('#ivstage'));
    } catch (err) { iv.failed = true; console.warn('Inventario: sin 3D —', err.message); }
  }
  function frame() {
    const st = $('#ivstage'), w = st.clientWidth, h = st.clientHeight; if (!iv.cam || w < 8 || h < 8) return;
    iv.renderer.setSize(w, h, false); iv.cam.aspect = w / h; const f = { axioma: [1.02, 2.3, 1.9], micelio: [1.25, 2.95, 2.3] }[iv.host] || [1.0, 2.3, 1.9], fov = iv.THREE.MathUtils.degToRad(iv.cam.fov);
    const d = Math.max((f[1] / 2) / Math.tan(fov / 2), ((f[2]) / 2) / (Math.tan(fov / 2) * iv.cam.aspect)) * 1.04; iv.cam.position.set(0, f[0] + 0.15, d); iv.cam.lookAt(0, f[0], 0); iv.cam.updateProjectionMatrix();
  }
  async function modelo() {
    if (!iv.THREE) return; const tok = iv.tok = (iv.tok || 0) + 1;
    try {
      if (!iv.hk) { const hm = await import('./humans.js'), mod = await import('./huesped-cuerpo.js'); iv.hk = { hm, mod, kit: await hm.loadHumanKit({ quality: iv.quality, movil: iv.quality === 'low' }) }; }
      if (tok !== iv.tok) return;
      const p = pl(); if (iv.probar) p.eq = eqStr(Perfil.equipoDe(iv.host), null, iv.probar);
      const b = iv.hk.mod.createHostBody(iv.THREE, iv.hk.kit, p, { quality: iv.quality, camera: iv.cam }); iv.scene.add(b.object); await b.ready;
      if (tok !== iv.tok) { iv.scene.remove(b.object); b.dispose(); return; }
      if (iv.body) { iv.scene.remove(iv.body.object); iv.body.dispose(); }
      iv.body = b; iv.bodyP = p; const C = CHARACTERS[iv.host], col = new iv.THREE.Color(C.color); iv.rim.color.copy(col).lerp(new iv.THREE.Color(0xffffff), 0.45); iv.ring.material.color.copy(col); frame();
    } catch (err) { console.warn('Inventario: vista previa no disponible —', err.message); iv.failed = true; $('#ivcanvas').hidden = true; const fb = $('#ivfb'); fb.hidden = false; fb.textContent = CHARACTERS[iv.host].name; }
  }
  let last = 0;
  function loop(now) {
    if (!root.classList.contains('on') || document.hidden) { iv.running = false; return; }
    requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now;
    if (iv.renderer && iv.body) { iv.idle += dt; if (!iv.drag && iv.idle > 2.5) iv.user += dt * 0.35; iv.body.object.rotation.y = -0.3 + iv.user; tickMenuBeat(now / 1000); iv.body.update(dt, iv.bodyP, { speed: 0, pitch: 0 }); iv.ring.rotation.z += dt * 0.4; iv.renderer.render(iv.scene, iv.cam); }
    // Forja: la cuenta regresiva se refresca sola
    const f = Perfil.cultivoFalta(); if (iv.tab === 'for' && f !== iv.lastF) { iv.lastF = f; renderBody(); }
  }
  function start() { if (iv.running) return; iv.running = true; last = performance.now(); requestAnimationFrame(loop); }
  const cv = $('#ivcanvas');
  cv.addEventListener('pointerdown', (e) => { iv.drag = { x: e.clientX, u: iv.user }; iv.idle = 0; try { cv.setPointerCapture(e.pointerId); } catch { /* ok */ } });
  cv.addEventListener('pointermove', (e) => { if (iv.drag) { iv.user = iv.drag.u + (e.clientX - iv.drag.x) * 0.012; iv.idle = 0; } });
  const endDrag = () => { iv.drag = null; iv.idle = 0; }; cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

  /* ───── piezas comunes ───── */
  const celda = (inst, sel) => { const it = ITEMS[inst.id], on = Perfil.puestoEn(inst.u); return `<button class="iv-cell iv-nav${sel ? ' sel' : ''}${on ? ' worn' : ''}" type="button" data-u="${inst.u}" style="--r:${RARITIES[it.r].css}" aria-label="${esc(it.name)}, ${RARITIES[it.r].name}${inst.lk ? ', bloqueado' : ''}">${iconoSvg(it, 40)}<span class="iv-ph">${'●'.repeat(faseDe(it, inst.k) + 1)}</span>${inst.fv ? '<em class="iv-fv" aria-hidden="true">★</em>' : ''}${inst.lk ? '<em class="iv-lk" aria-hidden="true">🔒</em>' : ''}${on ? `<em class="iv-on" aria-hidden="true">${esc(CHARACTERS[on.char].name.slice(0, 2))}</em>` : ''}</button>`; };
  function renderBank() {
    const p = Perfil.perfil(), mats = MATERIAL_IDS.reduce((a, m) => a + Perfil.stockMin(m, 0), 0);
    $('#ivbank').innerHTML = `<span><b>${p.cores}</b> núcleos</span><span><b>${Perfil.inventario().length}</b>/${LIMITE_INVENTARIO} objetos</span><span><b>${mats}</b> materiales</span><span><b>${Perfil.planos().length}</b> planos</span>`;
    for (const id of hosts()) { const n = Object.keys(Perfil.equipoDe(id)).length, el = root.querySelector('#ivsub-' + id); if (el) el.textContent = `${n} pieza${n === 1 ? '' : 's'} puesta${n === 1 ? '' : 's'}`; }
  }
  function renderSlots() {
    const eq = Perfil.equipoDe(iv.host);
    $('#ivslots').innerHTML = SLOTS.map((s) => { const it = eq[s], d = it && ITEMS[it.id]; return `<button class="iv-slot iv-nav${it ? ' full' : ''}" type="button" data-s="${s}" role="listitem" style="--r:${d ? RARITIES[d.r].css : '#ffffff33'}" aria-label="${SLOT_NAME[s]}: ${d ? esc(d.name) : 'vacía'}">${d ? iconoSvg(d, 30) : `<svg class="iv-ico" width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONO[s]}" fill="none" stroke="#ffffff44" stroke-width="1.2"/></svg>`}<small>${SLOT_NAME[s].replace('Arma cuerpo a cuerpo', 'Melé').replace('Arma de disparo', 'Disparo')}</small></button>`; }).join('');
    $('#ivslots').querySelectorAll('.iv-slot').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const it = eq[b.dataset.s]; if (it) { iv.tab = 'obj'; iv.sel = it.u; iv.tipo = 'todo'; iv.rar = 'todo'; render(); sound('tick'); } }));
    const act = setActivos(Object.entries(eq).map(([, i]) => ({ id: i.id }))), cnt = setCounts(Object.values(eq).map((i) => ({ id: i.id })));
    $('#ivnote').innerHTML = Object.keys(cnt).map((s) => `<span class="iv-setchip${cnt[s] >= 4 ? ' on4' : cnt[s] >= 2 ? ' on2' : ''}" style="--c:${hex(MATERIALS[SETS[s].mat].glow)}">${esc(SETS[s].name)} ${cnt[s]}/5</span>`).join('') || '<span class="iv-muted">Sin sets todavía: juntá 2 o 4 piezas de la misma familia.</span>'; void act;
  }

  /* ───── pestaña Objetos ───── */
  function filtrados() {
    return Perfil.inventario().filter((i) => { const it = ITEMS[i.id]; return (iv.tipo === 'todo' || it.type === iv.tipo) && (iv.rar === 'todo' || it.r === +iv.rar); })
      .sort((a, b) => (b.fv - a.fv) || ITEMS[b.id].r - ITEMS[a.id].r || poder(b) - poder(a));
  }
  function ficha(inst) {
    const it = ITEMS[inst.id], R = RARITIES[it.r], M = MATERIALS[it.mat], on = Perfil.puestoEn(inst.u), puesto = Perfil.equipoDe(iv.host)[it.slot], err = Perfil.equipoErrorDe ? '' : '';
    const dif = comparar(inst, puesto && puesto.u !== inst.u ? puesto : null), pr = progresoFase(it, inst.k), prox = proximaFase(inst), v = desguaceValor(inst);
    const bloqueada = it.host && it.host !== iv.host, motivo = bloqueada ? `Sólo la puede llevar ${CHARACTERS[it.host].name}.` : '';
    const cmp = puesto && puesto.u !== inst.u ? `<h5>Comparado con lo que llevás (${esc(ITEMS[puesto.id].name)})</h5><ul class="iv-diff">${dif.map((d) => `<li class="${d.d > 0 ? 'up' : 'down'}"><span>${esc(STAT_ES[d.k])}</span><b>${d.d > 0 ? '▲' : '▼'} ${pct(d.d, d.k)}</b></li>`).join('') || '<li class="iv-muted">Sin diferencias de bonos.</li>'}</ul>` : '';
    const sets = it.set ? `<p class="iv-set" style="--c:${hex(MATERIALS[SETS[it.set].mat].glow)}"><b>${esc(SETS[it.set].name)}</b> · 2 piezas: ${esc(fxTxt(SETS[it.set].b2.fx))} · 4 piezas: ${esc(fxTxt(SETS[it.set].b4.fx))}</p>` : '';
    return `<div class="iv-card" style="--r:${R.css};--m:${hex(M.glow)}">
      <header>${iconoSvg(it, 56)}<div><h4>${esc(it.name)}</h4><div class="iv-tags"><span class="iv-tag r">${R.name}</span><span class="iv-tag">${TYPE_NAME[it.type]}</span><span class="iv-tag m">${M.name}</span><span class="iv-tag">${SLOT_NAME[it.slot]}</span>${it.host ? `<span class="iv-tag f">Firma de ${esc(CHARACTERS[it.host].name)}</span>` : ''}</div></div></header>
      <p class="iv-lore">${esc(it.lore)}</p>
      <div class="iv-fase"><b>${FASES[pr.fase]}</b> · ${pr.k} bajas ${pr.max ? '· fase máxima' : `· faltan ${pr.falta} para «${FASES[pr.fase + 1]}»`}<span class="iv-bar"><i style="width:${Math.round(pr.frac * 100)}%"></i></span></div>
      ${prox ? `<p class="iv-prox"><b>Al madurar:</b> ${esc(prox.txt)}</p>` : ''}
      <h5>Bonos</h5><ul class="iv-stats">${lineasStats(inst).map((l) => `<li>${esc(l)}</li>`).join('') || '<li class="iv-muted">Sin bonos fijos.</li>'}</ul>
      ${lineasArma(inst).map((l) => `<p class="iv-arma">${esc(l)}</p>`).join('')}
      ${lineasPasivos(inst).length ? `<h5>Rasgos</h5><ul class="iv-pas">${lineasPasivos(inst).map((p) => `<li class="${p.on ? 'on' : 'off'}"><b>${esc(p.name)}</b> ${esc(p.txt)}${p.on ? '' : ` <em>(se desbloquea en fase ${FASES[p.f]})</em>`}</li>`).join('')}</ul>` : ''}
      ${lineasSinergias(inst).map((l) => `<p class="iv-syn">${esc(l)}</p>`).join('')}${sets}${cmp}
      ${it.sig ? `<p class="iv-sig"><b>Cómo se consigue:</b> ${esc(it.sig.texto)} Con eso el jefe suelta su plano raro; después se construye en la Forja.</p>` : ''}
      <div class="iv-acts">
        ${on ? `<button class="iv-btn iv-nav" data-a="quitar">Quitar de ${esc(CHARACTERS[on.char].name)}</button>` : `<button class="iv-btn main iv-nav" data-a="poner"${motivo ? ' disabled' : ''}>Equipar a ${esc(CHARACTERS[iv.host].name)}</button>`}
        ${on ? '' : `<button class="iv-btn iv-nav" data-a="probar">${iv.probar && iv.probar.u === inst.u ? 'Quitar vista previa' : 'Probar en el modelo'}</button>`}
        <button class="iv-btn iv-nav" data-a="lock">${inst.lk ? 'Desbloquear' : 'Bloquear'}</button><button class="iv-btn iv-nav" data-a="fav">${inst.fv ? '★ Quitar favorito' : '☆ Favorito'}</button>
        <button class="iv-btn iv-nav" data-a="fusion"${on ? ' disabled' : ''}>${iv.fusion === inst.u ? 'Cancelar fusión' : 'Fusionar…'}</button>
        <button class="iv-btn danger iv-nav" data-a="desguazar"${inst.lk || on ? ' disabled' : ''}>Desguazar (+${v.cores} núcleos, ${Object.entries(v.mats || {}).map(([m, x]) => `${x.n}× ${MATERIALS[m].name}`).join(', ')})</button>
      </div>${motivo ? `<p class="iv-warn">${esc(motivo)}</p>` : ''}
      ${iv.fusion ? '<p class="iv-prox">Elegí en la rejilla OTRA pieza de la misma ranura para fusionarla en ésta: se consume y la que conservás hereda bajas y calidad.</p>' : ''}</div>`;
  }
  function tabObjetos() {
    const list = filtrados(), inv = Perfil.inventario(), sel = inv.find((i) => i.u === iv.sel) || null;
    return `<div class="iv-filters"><div class="iv-fgroup" role="group" aria-label="Filtrar por tipo">${TIPO_FILTRO.map(([k, n]) => `<button class="iv-f iv-nav${iv.tipo === k ? ' on' : ''}" type="button" data-ft="${k}">${n}</button>`).join('')}</div>
      <div class="iv-fgroup" role="group" aria-label="Filtrar por rareza">${RAREZA_FILTRO.map(([k, n]) => `<button class="iv-f iv-nav${iv.rar === k ? ' on' : ''}" type="button" data-fr="${k}">${n}</button>`).join('')}</div>
      <button class="iv-f iv-nav" type="button" data-a="sobrantes" title="Desguaza todo lo Común que no esté puesto, bloqueado ni favorito">Desguazar sobrantes Comunes</button></div>
      <div class="iv-split"><div class="iv-grid" id="ivgrid">${list.map((i) => celda(i, i.u === iv.sel)).join('') || '<p class="iv-muted iv-empty">No hay objetos con estos filtros. Los objetos se construyen en la pestaña Forja con planos y materiales que encontrás en las partidas.</p>'}</div>
      <aside class="iv-detail" id="ivdetail">${sel ? ficha(sel) : '<p class="iv-muted iv-empty">Elegí un objeto para ver su ficha, compararlo y equiparlo.</p>'}</aside></div>`;
  }
  function accionObjeto(a, inst) {
    const it = ITEMS[inst.id];
    if (a === 'poner') { const e = Perfil.equiparItem(iv.host, inst.u); $('#ivnote').dataset.msg = e; if (e) msg(e); else { iv.probar = null; sound('ok'); modelo(); } }
    else if (a === 'quitar') { const on = Perfil.puestoEn(inst.u); if (on) Perfil.desequipar(on.char, on.slot); sound('back'); if (on && on.char === iv.host) modelo(); }
    else if (a === 'probar') { iv.probar = iv.probar && iv.probar.u === inst.u ? null : inst; sound('tick'); modelo(); }
    else if (a === 'lock') { Perfil.bloquear(inst.u); sound('tick'); }
    else if (a === 'fav') { Perfil.favorito(inst.u); sound('tick'); }
    else if (a === 'fusion') { iv.fusion = iv.fusion === inst.u ? null : inst.u; sound('tick'); }
    else if (a === 'desguazar') { const v = Perfil.desguazar(inst.u); if (v) { iv.sel = null; sound('ok'); msg(`${it.name} desguazado: +${v.cores} núcleos y materiales.`); } else sound('back'); }
    render();
  }
  function msg(t) { const n = $('#ivnote'); n.dataset.msg = t; n.innerHTML = `<span class="iv-toast">${esc(t)}</span>`; clearTimeout(iv.mt); iv.mt = setTimeout(() => renderSlots(), 3500); }
  function bindObjetos() {
    $('#ivbody').querySelectorAll('[data-ft]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); iv.tipo = b.dataset.ft; sound('tick'); render(); }));
    $('#ivbody').querySelectorAll('[data-fr]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); iv.rar = b.dataset.fr; sound('tick'); render(); }));
    const so = $('#ivbody').querySelector('[data-a=sobrantes]'); if (so) so.addEventListener('click', (e) => { e.stopPropagation(); const t = Perfil.desguazarSobrantes(0); msg(t.n ? `Desguazaste ${t.n} Comunes: +${t.cores} núcleos.` : 'No hay Comunes sobrantes.'); sound(t.n ? 'ok' : 'back'); render(); });
    $('#ivbody').querySelectorAll('.iv-cell').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (iv.fusion && iv.fusion !== b.dataset.u) { const r = Perfil.fusionar(iv.fusion, b.dataset.u); if (r.ok) { iv.sel = iv.fusion; msg(`Fusión lista: calidad ${Math.round(r.q * 100)} %, ${r.k} bajas.`); sound('ok'); } else { msg(r.motivo); sound('back'); } iv.fusion = null; render(); return; }
      iv.sel = b.dataset.u; sound('tick'); render();
    }));
    $('#ivbody').querySelectorAll('.iv-acts [data-a]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); if (b.disabled) return; const inst = Perfil.instDe(iv.sel); if (inst) accionObjeto(b.dataset.a, inst); }));
  }

  /* ───── Materiales y planos ───── */
  function tabMateriales() {
    const m = Perfil.materiales();
    return `<p class="iv-help">Lo que cae en las partidas son sobre todo <b>materiales</b>. Cada uno tiene calidad (${CALIDADES.join(' · ')}); las recetas piden una calidad mínima. Tope: ${MAT_STOCK_MAX} de cada calidad.</p>
      <div class="iv-mats">${MATERIAL_IDS.map((id) => { const M = MATERIALS[id]; return `<div class="iv-mat" style="--m:${hex(M.glow)}"><header><i></i><div><b>${esc(M.name)}</b><small>${esc(M.lema)}</small></div></header><p>${esc(M.texto)}</p><div class="iv-qs">${CALIDADES.map((c, q) => `<span class="${m[id][q] ? '' : 'z'}" title="${c}"><small>${c}</small><b>${m[id][q]}</b></span>`).join('')}</div></div>`; }).join('')}</div>`;
  }
  function tabPlanos() {
    const rows = ITEM_IDS.slice().sort((a, b) => ITEMS[a].r - ITEMS[b].r || SLOTS.indexOf(ITEMS[a].slot) - SLOTS.indexOf(ITEMS[b].slot));
    return `<p class="iv-help">Un <b>plano</b> te enseña a construir un objeto en la Forja (no se gasta). Los Comunes se conocen de entrada; el resto cae de élites, misiones, eventos, ofrendas y jefes. Las armas firma sólo vienen del jefe de su mapa.</p>
      <div class="iv-plist">${rows.map((id) => { const it = ITEMS[id], k = Perfil.conoce(id); return `<button class="iv-plan iv-nav${k ? ' known' : ''}" type="button" data-id="${id}" style="--r:${RARITIES[it.r].css}" ${k ? '' : 'aria-disabled="true"'}>${iconoSvg(it, 30)}<span><b>${k ? esc(it.name) : '???'}</b><small>${RARITIES[it.r].name} · ${SLOT_NAME[it.slot]}${k ? '' : it.host ? ' · plano raro de jefe' : ' · sin descubrir'}</small></span></button>`; }).join('')}</div>`;
  }

  /* ───── Forja ───── */
  function tabForja() {
    const cu = Perfil.perfil().cultivo, f = Perfil.cultivoFalta(), cand = ITEM_IDS.filter((id) => Perfil.conoce(id)).sort((a, b) => ITEMS[a].r - ITEMS[b].r || SLOTS.indexOf(ITEMS[a].slot) - SLOTS.indexOf(ITEMS[b].slot));
    if (iv.selRec && !Perfil.conoce(iv.selRec)) iv.selRec = null; iv.selRec ||= cand[0] || null;
    const estado = cu ? `<div class="iv-cult"><b>Cultivando: ${esc(ITEMS[cu.item].name)}</b><span>${f ? `Faltan ${f} s` : '¡Listo para recoger!'}</span>
      <span class="iv-bar"><i style="width:${Math.round((1 - f / Math.max(1, cu.dur)) * 100)}%"></i></span><div class="iv-acts">${f ? `<button class="iv-btn iv-nav" data-a="acelerar">Acelerar (${Math.ceil(f / 2)} núcleos)</button>` : '<button class="iv-btn main iv-nav" data-a="recoger">Recoger la pieza</button>'}</div></div>` : '<p class="iv-help">La Forja biológica <b>cultiva</b> la pieza unos segundos. El resultado tiene una calidad al azar acotada (mejor con materiales de más calidad), siempre la misma para la misma receta y el mismo número de forja.</p>';
    const R = iv.selRec ? Perfil.estadoReceta(iv.selRec) : null, it = iv.selRec && ITEMS[iv.selRec];
    const det = R ? `<div class="iv-card" style="--r:${RARITIES[it.r].css}"><header>${iconoSvg(it, 48)}<div><h4>${esc(it.name)}</h4><div class="iv-tags"><span class="iv-tag r">${RARITIES[it.r].name}</span><span class="iv-tag">${SLOT_NAME[it.slot]}</span></div></div></header>
      <p class="iv-lore">${esc(it.lore)}</p><h5>Receta (plano + materiales + núcleos)</h5><ul class="iv-rec">${R.faltan.map((x) => `<li class="${x.tiene >= x.n ? 'ok' : 'no'}"><span>${x.n}× ${esc(MATERIALS[x.mat].name)} (${CALIDADES[x.cal]} o mejor)</span><b>${x.tiene}/${x.n}</b></li>`).join('')}<li class="${Perfil.perfil().cores >= R.receta.cores ? 'ok' : 'no'}"><span>Núcleos</span><b>${Perfil.perfil().cores}/${R.receta.cores}</b></li></ul>
      <p class="iv-muted">Cultivo: ${R.receta.tiempo} s.${R.receta.especial ? ' ' + esc(R.receta.especial) : ''}</p>
      <div class="iv-acts"><button class="iv-btn main iv-nav" data-a="forjar"${R.ok ? '' : ' disabled'}>Construir</button></div>${R.ok ? '' : `<p class="iv-warn">${esc(R.motivo)}</p>`}</div>` : '<p class="iv-muted iv-empty">No conocés ningún plano todavía.</p>';
    return `${estado}<div class="iv-split"><div class="iv-plist">${cand.map((id) => { const x = ITEMS[id], ok = Perfil.estadoReceta(id).ok; return `<button class="iv-plan iv-nav known${id === iv.selRec ? ' sel' : ''}${ok ? ' can' : ''}" type="button" data-id="${id}" style="--r:${RARITIES[x.r].css}">${iconoSvg(x, 30)}<span><b>${esc(x.name)}</b><small>${RARITIES[x.r].name} · ${SLOT_NAME[x.slot]}${ok ? ' · podés construirla' : ''}</small></span></button>`; }).join('')}</div><aside class="iv-detail">${det}</aside></div>`;
  }
  function bindForja() {
    $('#ivbody').querySelectorAll('.iv-plan.known').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); iv.selRec = b.dataset.id; sound('tick'); render(); }));
    $('#ivbody').querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); if (b.disabled) return; const a = b.dataset.a;
      if (a === 'forjar') { const r = Perfil.forjar(iv.selRec); if (r.ok) { sound('ok'); msg(`Cultivando ${ITEMS[iv.selRec].name}… calidad ${Math.round(r.q * 100)} %.`); } else { sound('back'); msg(r.motivo); } }
      else if (a === 'acelerar') { if (Perfil.acelerar()) sound('ok'); else { sound('back'); msg('No te alcanzan los núcleos.'); } }
      else if (a === 'recoger') { const r = Perfil.recoger(); if (r) { sound('ok'); iv.sel = r.uid || null; msg(r.conv ? `${ITEMS[r.item].name}: ${r.repetida ? 'ya la tenías' : 'inventario lleno'}, se convirtió en recursos.` : `¡Nueva pieza: ${ITEMS[r.item].name}!`); } }
      render();
    }));
  }

  /* ───── Sets ───── */
  function tabSets() {
    const eq = Perfil.equipoDe(iv.host), cnt = setCounts(Object.values(eq).map((i) => ({ id: i.id })));
    return `<p class="iv-help">Un <b>set</b> es una familia de 4 piezas de armadura y un arma del mismo material. Con 2 piezas y con 4 se activan bonos, y el cuerpo cambia: las vetas brillan más y, con 4, el set «despierta» (aura y anillos de luz).</p>
      <div class="iv-sets">${SET_IDS.map((sid) => { const S = SETS[sid], n = cnt[sid] || 0, M = MATERIALS[S.mat]; return `<div class="iv-set-card${n >= 4 ? ' on4' : n >= 2 ? ' on2' : ''}" style="--m:${hex(M.glow)}"><header><b>${esc(S.name)}</b><span>${n}/5</span></header><p class="iv-lore">${esc(S.lore)}</p>
        <div class="iv-pieces">${S.items.map((id) => { const it = ITEMS[id], has = Object.values(eq).some((i) => i.id === id), own = Perfil.inventario().some((i) => i.id === id); return `<span class="${has ? 'has' : own ? 'own' : ''}" title="${esc(it.name)}">${iconoSvg(it, 26)}<small>${has ? 'puesta' : own ? 'la tenés' : Perfil.conoce(id) ? 'plano' : '—'}</small></span>`; }).join('')}</div>
        <p class="${n >= 2 ? 'on' : ''}"><b>2 piezas:</b> ${esc(fxTxt(S.b2.fx))}</p><p class="${n >= 4 ? 'on' : ''}"><b>4 piezas:</b> ${esc(fxTxt(S.b4.fx))}${(S.b4.pa || []).length ? ' · rasgo ' + esc(S.b4.pa.map((p) => p.id).join(', ')) : ''}</p><p class="iv-muted">${esc(S.vis)}</p></div>`; }).join('')}</div>`;
  }

  /* ───── ensamble ───── */
  function renderBody() {
    const b = $('#ivbody'); iv.lastF = Perfil.cultivoFalta();
    b.innerHTML = { obj: tabObjetos, mat: tabMateriales, pla: tabPlanos, for: tabForja, set: tabSets }[iv.tab]();
    if (iv.tab === 'obj') bindObjetos(); else if (iv.tab === 'for') bindForja();
    b.querySelectorAll('.iv-plan:not(.known)').forEach((x) => x.addEventListener('click', (e) => { e.stopPropagation(); sound('back'); }));
    if (iv.tab === 'pla') b.querySelectorAll('.iv-plan.known').forEach((x) => x.addEventListener('click', (e) => { e.stopPropagation(); iv.tab = 'for'; iv.selRec = x.dataset.id; sound('tick'); render(); }));
  }
  function render() {
    root.style.setProperty('--c', hex(CHARACTERS[iv.host].color));
    root.querySelectorAll('.iv-chip').forEach((b) => { const on = b.dataset.id === iv.host; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    root.querySelectorAll('.iv-tab').forEach((b) => { const on = b.dataset.t === iv.tab; b.classList.toggle('sel', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    renderBank(); renderSlots(); renderBody();
  }
  root.querySelectorAll('.iv-chip').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); iv.host = b.dataset.id; iv.probar = null; iv.user = 0; sound('tick'); render(); modelo(); }));
  root.querySelectorAll('.iv-tab').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); iv.tab = b.dataset.t; sound('tick'); render(); }));
  new MutationObserver(() => { if (root.classList.contains('on')) start(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && root.classList.contains('on')) start(); });

  /** Al entrar: parte del Huésped elegido (o `host` que pida la pantalla de Huésped). */
  iv.enter = async (host) => {
    iv.host = CHARACTERS[host] && CHARACTERS[host].host ? host : CHARACTERS[Equipo.char] && CHARACTERS[Equipo.char].host ? Equipo.char : 'axioma'; iv.probar = null; iv.fusion = null;
    render(); await ensureThree(); if (iv.failed) { $('#ivcanvas').hidden = true; const fb = $('#ivfb'); fb.hidden = false; fb.textContent = CHARACTERS[iv.host].name; return; }
    frame(); modelo(); start();
  };
  iv.render = render; iv.select = (u) => { iv.sel = u; iv.tab = 'obj'; render(); }; iv.setTab = (t) => { iv.tab = t; render(); };
}

export function showInventario(menu, host) { if (menu.iv) menu.iv.enter(host); }
void SLOTS; void TYPES;
