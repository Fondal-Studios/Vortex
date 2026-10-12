// Pantalla «EVOLUCIÓN» (menú principal, junto a «Huésped»). Se engancha en ui.js: pantalla `evolucion`.
//   · riel con los 5 Huéspedes (cada uno tiene su propio nivel de evolución y su propia arma equipada: src/client/perfil.js)
//   · escenario 3D: el Huésped en su nivel actual con el arma equipada FUSIONADA en la mano (huespedes-evo.js + melee-models.js)
//   · barra de núcleos ahorrados y botón «Evolucionar» (costo EVO_COST) con vista previa del nivel siguiente y de sus cambios visibles
//   · catálogo de armas por pestañas (espadas, hachas, martillos, lanzas, dagas, innatas): modelo 3D girando, estadísticas, poder especial,
//     afinidad con el Huésped y precio; comprar con núcleos (perfil.comprarArma) y equipar (perfil.equipar)
// Un solo canvas WebGL cubre la pantalla y dibuja dos «ventanas» (scissor) sobre los recuadros del Huésped y del arma: así hay un solo contexto 3D.
// Estilos: public/evolucion.css (reutiliza el lenguaje de huespedes.css). Todo cabe sin superponerse: el panel de armas tiene scroll interno.
import { CHARACTERS, HOST_IDS, MELEE_TYPES, MELEE_WEAPONS, MELEE_AFFINITY, NATIVE_MELEE, EVO_COST, EVO_TIERS } from '../sim/data.js';
import { Equipo, saveEquipo } from './equipo.js';
import * as Perfil from './perfil.js';
import { buildHostEvo, EVO_VISUAL } from './huespedes-evo.js';
import { buildMelee, NATIVE_NAMES } from './melee-models.js';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TABS = [['espada', 'Espadas'], ['hacha', 'Hachas'], ['martillo', 'Martillos'], ['lanza', 'Lanzas'], ['daga', 'Dagas'], ['innata', 'Innatas']];
const TYPE_ES = { espada: 'Espada', hacha: 'Hacha', martillo: 'Martillo', lanza: 'Lanza', daga: 'Daga', innata: 'Innata' };
const SPECIAL_ES = {
  onda: 'Onda cortante', quema: 'Quemadura', atraviesa: 'Corte que atraviesa', sangrado: 'Sangrado', barrido: 'Barrido amplio', rapina: 'Robo de vida', sismo: 'Sismo', espora: 'Nube de esporas',
  aturde: 'Aturdimiento', linea: 'Punta en línea', estocada: 'Estocada con embestida', arrastra: 'Arrastre', veneno: 'Veneno', acuchilla: 'Puñalada por la espalda', destello: 'Destello',
};
const NATIVE_DESC = {
  cuchillas: 'Cuchillas de hueso y metal que nacen en los antebrazos de Axioma. Rápidas y limpias.', garras: 'Garras dobles de Vesper: cortes veloces y combos que se encadenan.',
  punos: 'Los puños de quitina de Micelio: lentos, enormes y con golpes que sacuden el suelo.', hoja_dim: 'La hoja dimensional de Umbra: atraviesa defensas y llega más lejos.',
  latigo: 'El látigo orgánico de Seraf: se estira para golpear a distancia.',
};
const CORE = '◆';
const HOSTS = () => HOST_IDS.filter((id) => CHARACTERS[id]);
const nativeOwner = (id) => Object.keys(NATIVE_MELEE).find((h) => NATIVE_MELEE[h] === id);
/** datos comparables de un arma (catálogo o innata) */
function dataOf(id) {
  const w = MELEE_WEAPONS[id];
  if (w) return { id, name: w.name, type: w.type, cost: w.cost, special: w.special, desc: w.desc, light: w.light, heavy: w.heavy, native: false };
  const h = nativeOwner(id), C = h && CHARACTERS[h]; if (!C) return null;
  return { id, name: NATIVE_NAMES[id] || id, type: 'innata', cost: 0, special: null, desc: NATIVE_DESC[id] || '', light: C.melee.light, heavy: C.melee.heavy, native: true, owner: h };
}
const ALL = () => [...Object.keys(MELEE_WEAPONS), ...Object.values(NATIVE_MELEE)].map(dataOf).filter(Boolean);
const MAXS = (() => { let a = { dl: 0, dh: 0, r: 0, v: 0 }; try { for (const d of ALL()) a = { dl: Math.max(a.dl, d.light.dmg), dh: Math.max(a.dh, d.heavy.dmg), r: Math.max(a.r, d.light.range, d.heavy.range), v: Math.max(a.v, 1 / d.light.cd) }; } catch { /* sin datos */ } return a; })();

export function buildEvolucionScreen(menu) {
  const root = menu.root.querySelector('#evolucion'); if (!root) return;
  root.classList.add('ev');
  const chip = (id) => { const c = CHARACTERS[id]; return `<button class="ev-chip ev-nav" type="button" data-id="${id}" style="--c:${hex(c.color)}" aria-pressed="false" aria-label="${c.name}"><i class="ev-dot"></i><span class="ev-cn"><b>${c.name}</b><small class="ev-lv"></small></span></button>`; };
  root.innerHTML = `
    <button class="backbtn" type="button" aria-label="Volver al menú anterior"><span aria-hidden="true">‹</span> Volver</button>
    <canvas id="evcanvas" aria-hidden="true"></canvas>
    <div class="ev-wrap">
      <nav class="ev-rail" id="evrail" aria-label="Huéspedes">${HOSTS().map(chip).join('')}</nav>
      <section class="ev-center" aria-label="Evolución del Huésped">
        <header class="ev-head" id="evhead">
          <div class="ev-h1"><h2 id="evname"></h2><span class="ev-tier" id="evtier"></span></div>
          <div class="ev-h2"><span class="ev-tag" id="evchosen" hidden>✓ Tu Huésped</span><button class="ev-tag ev-use ev-nav" type="button" id="evuse" hidden>Usar este Huésped</button><span class="ev-pips" id="evpips" aria-hidden="true"></span></div>
        </header>
        <div class="ev-stage" id="evstage" aria-label="Modelo 3D del Huésped: arrastrá para girarlo"><i class="ev-wave" aria-hidden="true"></i><span class="ev-peek-tag" id="evpeektag" hidden>Vista previa</span></div>
        <div class="ev-evolve" id="evevolve">
          <div class="ev-cores" id="evcoresrow"><span class="ev-core-n"><i aria-hidden="true">${CORE}</i> <b id="evcores">0</b> núcleos</span><span class="ev-bar" aria-hidden="true"><b id="evbar"></b></span></div>
          <div class="ev-next" id="evnext"></div>
          <div class="ev-actions"><button class="ev-btn ev-nav" type="button" id="evpeek" aria-pressed="false">Ver nivel siguiente</button><button class="ev-btn ev-main ev-nav" type="button" id="evbtn">Evolucionar</button></div>
        </div>
      </section>
      <aside class="ev-panel" id="evpanel" aria-label="Catálogo de armas cuerpo a cuerpo">
        <div class="ev-tabs" id="evtabs" role="tablist">${TABS.map(([k, n]) => `<button class="ev-tab ev-nav" type="button" role="tab" data-tab="${k}" aria-selected="false">${n}</button>`).join('')}</div>
        <div class="ev-list" id="evlist"></div>
        <div class="ev-detail">
          <div class="ev-prev" id="evprev" aria-label="Modelo 3D del arma: arrastrá para girarlo"></div>
          <div class="ev-info" id="evinfo"></div>
        </div>
        <div class="ev-buy" id="evbuy"><span class="ev-price" id="evprice"></span><button class="ev-btn ev-main ev-nav" type="button" id="evaction">Equipar</button></div>
      </aside>
    </div>`;
  const $ = (s) => root.querySelector(s);
  $('.backbtn').addEventListener('click', (e) => { e.stopPropagation(); menu.back(); });
  const ev = menu.ev = {
    char: 'axioma', tab: 'espada', sel: null, peek: false, THREE: null, renderer: null, failed: false, running: false,
    host: null, hostKey: '', prev: null, prevKey: '', sceneA: null, sceneB: null, camA: null, camB: null, frameA: [1.1, 2.4, 1], frameB: [0.5, 1.2],
    yawA: 0, yawB: 0, idleA: 0, idleB: 0, dragA: null, dragB: null, size: [0, 0], quality: 'low', fxT: 0,
  };
  const perfil = () => Perfil.perfil();
  const equippedId = (char) => perfil().melee[char] || NATIVE_MELEE[char];
  const evoOf = (char) => perfil().evo[char] || 0;

  /* ───── 3D ───── */
  async function ensureThree() {
    if (ev.THREE || ev.failed) return;
    try {
      const THREE = await import('three'), canvas = $('#evcanvas');
      const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
      const coarse = matchMedia('(pointer: coarse)').matches; ev.quality = coarse || (window.__api && window.__api.level === 'low') ? 'low' : 'medium';
      gl.setPixelRatio(Math.min(devicePixelRatio || 1, ev.quality === 'low' ? 1.5 : 2)); gl.setClearColor(0x000000, 0); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.2; gl.setScissorTest(true);
      const mkScene = (fov) => {
        const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(fov, 1, 0.05, 80);
        const hemi = new THREE.HemisphereLight(0xd4daff, 0x3a1f55, 2.1), key = new THREE.DirectionalLight(0xfff1e0, 3.2), rim = new THREE.DirectionalLight(0xffffff, 2.4), kick = new THREE.DirectionalLight(0xffffff, 1);
        key.position.set(2.2, 3.4, 4); rim.position.set(-3, 2.4, -3.5); kick.position.set(3, 0.4, -2); scene.add(hemi, key, rim, kick); return { scene, cam, rim, kick };
      };
      const A = mkScene(30), Bq = mkScene(26);
      Object.assign(ev, { THREE, renderer: gl, sceneA: A.scene, camA: A.cam, rimA: A.rim, kickA: A.kick, sceneB: Bq.scene, camB: Bq.cam, rimB: Bq.rim, kickB: Bq.kick });
      new ResizeObserver(() => { ev.size = [0, 0]; }).observe(root);
    } catch (err) { ev.failed = true; console.warn('Evolución: sin 3D —', err.message); }
  }
  const col3 = (c) => new ev.THREE.Color(c);
  function tint() {
    const C = CHARACTERS[ev.char], c = col3(C.color), w = col3(0xffffff);
    for (const [r, k] of [[ev.rimA, 0.45], [ev.kickA, 0.2], [ev.rimB, 0.45], [ev.kickB, 0.2]]) if (r) r.color.copy(c).lerp(w, k);
  }
  function fit(cam, cy, hh, ww, w, h) { // cámara que encuadra una caja de alto hh y ancho ww, centrada en cy
    const T = ev.THREE, fov = T.MathUtils.degToRad(cam.fov), asp = w / h; cam.aspect = asp;
    const dH = (hh / 2) / Math.tan(fov / 2), dW = (ww / 2) / (Math.tan(fov / 2) * asp), d = Math.max(dH, dW) * 1.06;
    cam.position.set(0, cy + hh * 0.04, d); cam.lookAt(0, cy, 0); cam.updateProjectionMatrix();
  }
  function bbox(obj) { const T = ev.THREE, b = new T.Box3().setFromObject(obj), s = new T.Vector3(); b.getSize(s); return { cy: (b.max.y + b.min.y) / 2, h: s.y, w: Math.max(s.x, s.z), top: b.max.y, bot: b.min.y }; }
  function setHost(force) {
    if (!ev.THREE) return;
    const shownEvo = ev.peek ? Math.min(4, evoOf(ev.char) + 1) : evoOf(ev.char), eq = perfil().melee[ev.char] || '', key = `${ev.char}|${shownEvo}|${eq}`;
    if (!force && key === ev.hostKey && ev.host) return;
    if (ev.host) { ev.sceneA.remove(ev.host.group); ev.host.dispose(); ev.host = null; }
    ev.hostKey = key; ev.host = buildHostEvo(ev.THREE, ev.char, { evo: shownEvo, melee: eq, quality: ev.quality });
    ev.sceneA.add(ev.host.group); ev.host.update(0.016, 0.3); tint();
    const b = bbox(ev.host.group.children[0]); ev.frameA = [b.cy, Math.max(1.6, b.h * 1.12), Math.max(1.2, b.w * 1.02)]; ev.size = [0, 0];
  }
  function setPrev(force) {
    if (!ev.THREE || !ev.sel) return;
    const tier = ev.peek ? Math.min(4, evoOf(ev.char) + 1) : evoOf(ev.char), key = `${ev.sel}|${tier}|${ev.char}`;
    if (!force && key === ev.prevKey && ev.prev) return;
    if (ev.prev) { ev.sceneB.remove(ev.prev.group); ev.prev.dispose(); ev.prev = null; }
    ev.prevKey = key; ev.prev = buildMelee(ev.THREE, ev.sel, { tier, quality: ev.quality, color: CHARACTERS[ev.char].color });
    ev.sceneB.add(ev.prev.group); ev.prev.update(0.016, 0.3);
    const b = bbox(ev.prev.group); ev.frameB = [b.cy, Math.max(0.5, b.h * 1.1), Math.max(0.4, b.w * 1.15)]; ev.size = [0, 0];
  }
  let last = 0;
  function loop(now) {
    if (!root.classList.contains('on') || document.hidden) { ev.running = false; return; }
    requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now; tick(dt, now / 1000);
  }
  function view(el, scene, cam, clipRect) { // dibuja `scene` en el recuadro `el` (recortado por clipRect si hace falta)
    const rr = root.getBoundingClientRect(), r = el.getBoundingClientRect(), H = rr.height;
    if (r.width < 6 || r.height < 6) return;
    const x = r.left - rr.left, y = H - (r.bottom - rr.top);
    let cx = x, cy = y, cw = r.width, ch = r.height;
    if (clipRect) { const l = Math.max(r.left, clipRect.left), rg = Math.min(r.right, clipRect.right), t = Math.max(r.top, clipRect.top), b = Math.min(r.bottom, clipRect.bottom); if (rg - l < 2 || b - t < 2) return; cx = l - rr.left; cw = rg - l; cy = H - (b - rr.top); ch = b - t; }
    ev.renderer.setViewport(x, y, r.width, r.height); ev.renderer.setScissor(cx, cy, cw, ch); ev.renderer.render(scene, cam);
  }
  function tick(dt, t) {
    if (!ev.renderer || ev.failed) return;
    const rr = root.getBoundingClientRect(); if (rr.width < 8 || rr.height < 8) return;
    if (ev.size[0] !== rr.width || ev.size[1] !== rr.height) {
      ev.size = [rr.width, rr.height]; ev.renderer.setSize(rr.width, rr.height, false);
      const sa = $('#evstage').getBoundingClientRect(), sb = $('#evprev').getBoundingClientRect();
      if (sa.width > 6) fit(ev.camA, ev.frameA[0], ev.frameA[1], ev.frameA[2], sa.width, sa.height); if (sb.width > 6) fit(ev.camB, ev.frameB[0], ev.frameB[1], ev.frameB[2], sb.width, sb.height);
    }
    ev.idleA += dt; ev.idleB += dt; if (!ev.dragA && ev.idleA > 2.5) ev.yawA += dt * 0.35; ev.idleB = ev.dragB ? 0 : ev.idleB; if (!ev.dragB) ev.yawB += dt * 0.7;
    if (ev.host) { ev.host.group.rotation.y = -0.3 + ev.yawA + (ev.dragA ? 0 : Math.sin(t * 0.5) * 0.12); ev.host.update(dt, t); }
    if (ev.prev) { ev.prev.group.rotation.y = ev.yawB; ev.prev.update(dt, t); }
    if (ev.fxT > 0) ev.fxT -= dt;
    ev.renderer.setScissor(0, 0, rr.width, rr.height); ev.renderer.setViewport(0, 0, rr.width, rr.height); ev.renderer.clear();
    view($('#evstage'), ev.sceneA, ev.camA, null);
    const pr = $('#evpanel').getBoundingClientRect(), bu = $('#evbuy').getBoundingClientRect(); view($('#evprev'), ev.sceneB, ev.camB, { left: pr.left, right: pr.right, top: pr.top, bottom: bu.top });
  }
  function start() { if (ev.running) return; ev.running = true; last = performance.now(); requestAnimationFrame(loop); }
  const drag = (el, k) => {
    el.addEventListener('pointerdown', (e) => { ev['drag' + k] = { x: e.clientX, u: ev['yaw' + k] }; ev['idle' + k] = 0; try { el.setPointerCapture(e.pointerId); } catch { /* ok */ } });
    el.addEventListener('pointermove', (e) => { const d = ev['drag' + k]; if (d) { ev['yaw' + k] = d.u + (e.clientX - d.x) * 0.012; ev['idle' + k] = 0; } });
    const end = () => { ev['drag' + k] = null; ev['idle' + k] = 0; }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  };
  drag($('#evstage'), 'A'); drag($('#evprev'), 'B');

  /* ───── interfaz ───── */
  const stat = (label, val, max, txt) => `<div class="ev-stat"><span class="ev-sl">${label}</span><span class="ev-sbar"><b style="width:${Math.max(4, Math.min(100, (val / max) * 100))}%"></b></span><em>${txt}</em></div>`;
  function renderRail() {
    root.querySelectorAll('.ev-chip').forEach((b) => {
      const id = b.dataset.id, on = id === ev.char; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('chosen', id === Equipo.char);
      b.querySelector('.ev-lv').textContent = `Nv. ${evoOf(id)}`;
    });
  }
  function renderHead() {
    const C = CHARACTERS[ev.char], evo = evoOf(ev.char); root.style.setProperty('--c', hex(C.color)); root.dataset.sel = ev.char;
    $('#evname').textContent = C.name; $('#evtier').innerHTML = `Nivel <b>${evo}</b> · ${esc(EVO_TIERS[evo].name)}`;
    $('#evpips').innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i <= evo ? 'on' : ''}"></i>`).join('');
    $('#evchosen').hidden = Equipo.char !== ev.char; $('#evuse').hidden = Equipo.char === ev.char;
  }
  function renderEvolve() {
    const evo = evoOf(ev.char), cores = perfil().cores, cost = Perfil.costeSiguiente(ev.char), max = evo >= 4, btn = $('#evbtn');
    $('#evcores').textContent = String(cores);
    $('#evbar').style.width = (max ? 100 : Math.min(100, (cores / cost) * 100)) + '%';
    if (max) {
      $('#evnext').innerHTML = `<b>Forma final alcanzada.</b> <span>${esc(EVO_TIERS[4].desc)}</span>`; btn.textContent = 'Nivel máximo'; btn.disabled = true; $('#evpeek').hidden = true;
    } else {
      const n = evo + 1, T = EVO_TIERS[n];
      $('#evnext').innerHTML = `<b>Nivel ${n} · ${esc(T.name)}</b> <span>${esc(T.desc)}</span> <em>Verás: ${esc(EVO_VISUAL[ev.char][n])}</em>`;
      btn.disabled = cores < cost; btn.textContent = cores >= cost ? `Evolucionar · ${cost} ${CORE}` : `Faltan ${cost - cores} ${CORE}`; $('#evpeek').hidden = false;
    }
    $('#evpeek').setAttribute('aria-pressed', ev.peek ? 'true' : 'false'); $('#evpeek').textContent = ev.peek ? 'Volver al nivel actual' : 'Ver nivel siguiente'; $('#evpeektag').hidden = !ev.peek;
    $('#evcoresrow').classList.toggle('ready', !max && cores >= cost);
  }
  const listFor = (tab) => (tab === 'innata' ? Object.values(NATIVE_MELEE) : Object.keys(MELEE_WEAPONS).filter((k) => MELEE_WEAPONS[k].type === tab));
  function state(d) { // 'equipada' | 'tuya' | 'comprable'
    if (d.native) return equippedId(ev.char) === d.id ? 'equipada' : d.owner === ev.char ? 'tuya' : 'ajena';
    return equippedId(ev.char) === d.id ? 'equipada' : Perfil.posee(d.id) ? 'tuya' : 'comprable';
  }
  function renderTabs() {
    root.querySelectorAll('.ev-tab').forEach((b) => { const on = b.dataset.tab === ev.tab; b.classList.toggle('sel', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
  }
  function renderList() {
    $('#evlist').innerHTML = listFor(ev.tab).map((id) => {
      const d = dataOf(id), st = state(d), aff = !d.native && (MELEE_AFFINITY[ev.char] || []).includes(d.type);
      const tag = st === 'equipada' ? '✓ Equipada' : st === 'tuya' ? 'Tuya' : st === 'ajena' ? 'De ' + CHARACTERS[d.owner].name : `${d.cost} ${CORE}`;
      return `<button class="ev-w ev-nav${id === ev.sel ? ' sel' : ''}${st === 'equipada' ? ' eq' : ''}${st === 'comprable' ? ' buy' : ''}" type="button" data-id="${id}" aria-pressed="${id === ev.sel}"><b>${esc(d.name)}</b><small>${tag}${aff ? ' · afín' : ''}</small></button>`;
    }).join('');
    $('#evlist').querySelectorAll('.ev-w').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); selectWeapon(b.dataset.id); }));
  }
  function renderDetail() {
    const d = dataOf(ev.sel); if (!d) return; const C = CHARACTERS[ev.char], st = state(d), aff = (MELEE_AFFINITY[ev.char] || []).includes(d.type);
    const spd = 1 / d.light.cd, rng = Math.max(d.light.range, d.heavy.range);
    const sp = d.special ? `<div class="ev-sp"><b>Poder especial: ${esc(SPECIAL_ES[d.special] || d.special)}</b><span>Se despierta al fusionarte (nivel 1) y se potencia en el nivel 3.</span></div>` : `<div class="ev-sp"><b>Arma innata</b><span>${d.owner ? 'Es parte del cuerpo de ' + esc(CHARACTERS[d.owner].name) + ': no se compra ni se cambia.' : ''}</span></div>`;
    const af = d.native ? '' : aff ? `<div class="ev-aff yes">★ Afinidad con ${esc(C.name)}: +15 % de daño</div>` : `<div class="ev-aff">Sin afinidad con ${esc(C.name)} (daño normal)</div>`;
    $('#evinfo').innerHTML = `<h3>${esc(d.name)} <span class="ev-type">${TYPE_ES[d.type]}</span></h3><p class="ev-desc">${esc(d.desc)}</p>${af}
      <div class="ev-stats">${stat('Daño ligero', d.light.dmg, MAXS.dl, d.light.dmg)}${stat('Daño pesado', d.heavy.dmg, MAXS.dh, d.heavy.dmg)}${stat('Alcance', rng, MAXS.r, rng.toFixed(1) + ' m')}${stat('Velocidad', spd, MAXS.v, spd.toFixed(1) + '/s')}</div>${sp}`;
    const btn = $('#evaction'), price = $('#evprice');
    if (st === 'equipada') { price.textContent = 'Equipada en ' + C.name; btn.textContent = 'Equipada ✓'; btn.disabled = true; }
    else if (st === 'ajena') { price.textContent = 'Innata de ' + CHARACTERS[d.owner].name; btn.textContent = 'No equipable'; btn.disabled = true; }
    else if (st === 'tuya') { price.textContent = d.native ? 'Tu arma innata' : 'La tenés'; btn.textContent = 'Equipar'; btn.disabled = false; }
    else { const c = perfil().cores; price.innerHTML = `Precio: <b>${d.cost}</b> ${CORE} · tenés ${c}`; btn.textContent = c >= d.cost ? `Comprar · ${d.cost} ${CORE}` : `Faltan ${d.cost - c} ${CORE}`; btn.disabled = c < d.cost; }
    btn.dataset.state = st;
  }
  function refresh() { renderRail(); renderHead(); renderEvolve(); renderTabs(); renderList(); renderDetail(); }
  function selectWeapon(id, quiet) { ev.sel = id; if (!quiet) menu.sound.ui('tick'); renderList(); renderDetail(); setPrev(); $('#evinfo').scrollTop = 0; }
  function selectTab(tab, quiet) {
    ev.tab = tab; const l = listFor(tab), eq = equippedId(ev.char); ev.sel = l.includes(eq) ? eq : l[0]; if (!quiet) menu.sound.ui('tick');
    renderTabs(); renderList(); renderDetail(); setPrev(); const p = $('#evpanel'); p.scrollTop = 0;
  }
  function selectChar(id, quiet) {
    if (!CHARACTERS[id] || !CHARACTERS[id].host) id = 'axioma'; ev.char = id; ev.peek = false; if (!quiet) menu.sound.ui('tick');
    const eq = equippedId(id), d = dataOf(eq); ev.tab = d ? d.type : 'espada'; ev.sel = eq;
    refresh(); setHost(); setPrev(true);
  }
  function celebrate() { // destello + onda sobre el escenario y la pose de habilidad del Huésped
    const st = $('#evstage'); st.classList.remove('flash'); void st.offsetWidth; st.classList.add('flash'); setTimeout(() => st.classList.remove('flash'), 1100);
    if (ev.host) ev.host.pose('skill');
  }
  $('#evbtn').addEventListener('click', (e) => {
    e.stopPropagation(); if (!Perfil.evolucionar(ev.char)) { menu.sound.ui('back'); return; }
    ev.peek = false; menu.sound.ui('ok'); refresh(); setHost(true); setPrev(true); celebrate();
    const evo = evoOf(ev.char); $('#evtier').classList.add('pop'); setTimeout(() => $('#evtier').classList.remove('pop'), 900); $('#evstage').dataset.msg = `EVOLUCIÓN: ${EVO_TIERS[evo].name}`;
  });
  $('#evpeek').addEventListener('click', (e) => { e.stopPropagation(); ev.peek = !ev.peek; menu.sound.ui('tick'); renderEvolve(); setHost(); setPrev(); });
  $('#evaction').addEventListener('click', (e) => {
    e.stopPropagation(); const d = dataOf(ev.sel), st = state(d); if (!d) return;
    if (st === 'comprable') { if (!Perfil.comprarArma(d.id)) { menu.sound.ui('back'); return; } menu.sound.ui('ok'); refresh(); return; }
    if (st === 'tuya') { if (d.native ? Perfil.equipar(ev.char, null) : Perfil.equipar(ev.char, d.id)) { menu.sound.ui('ok'); refresh(); setHost(true); if (ev.host) { ev.host.pose('melee'); } } }
  });
  $('#evuse').addEventListener('click', (e) => { e.stopPropagation(); Equipo.char = ev.char; saveEquipo(); menu.sound.ui('ok'); menu.refreshHuesped && menu.refreshHuesped(); renderRail(); renderHead(); });
  root.querySelectorAll('.ev-chip').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); selectChar(b.dataset.id); }));
  root.querySelectorAll('.ev-tab').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); selectTab(b.dataset.tab); }));
  new MutationObserver(() => { if (root.classList.contains('on')) start(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && root.classList.contains('on')) start(); });

  /** Al entrar: parte del Huésped elegido (o Axioma) */
  ev.enter = async () => {
    const id = CHARACTERS[Equipo.char] && CHARACTERS[Equipo.char].host ? Equipo.char : 'axioma'; ev.peek = false;
    selectChar(id, true); await ensureThree(); if (ev.failed) return;
    setHost(true); setPrev(true); start();
  };
  ev.select = selectChar; ev.selectTab = selectTab; ev.selectWeapon = selectWeapon; ev.refresh = refresh;
}

export function showEvolucion(menu) { if (menu.ev) menu.ev.enter(); }
