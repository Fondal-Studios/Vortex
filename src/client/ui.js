import { buildOperations, refreshCampaignMenu } from './operations-ui.js';
import { buildAccountMenu } from './account-menu.js';
import { buildIdentityMenu } from './identity-menu.js';
// Interfaz de acceso estilo PlayStation 5: título → menú principal con tarjetas → sub-pantallas. Teclado, ratón, táctil y mando.
import { BESTIARY, TIPS } from './lore.js';
import { buildHerbarioTab, selectHerbario } from './flora-ui.js';   // pestaña «Herbario» del Bestiario (flora interactiva, docs/FLORA.md)
import { buildFaunaTab, selectFauna } from './fauna-ui.js';   // pestaña «Fauna» del Bestiario (Códice de Fauna)
import { CHARACTERS, CHARACTER_IDS, ROLES, WEAPONS } from '../sim/data.js';
import { Equipo, saveEquipo, assignWeapon } from './equipo.js';
import { WEAPON_COLORS } from './shotfx.js';
import { buildHeroScreen, renderHeroScreen } from './heroes-ui.js';
import { buildHuespedScreen, showHuesped } from './huespedes-ui.js';
import { buildLaboratorioScreen, showLaboratorio, hideLaboratorio } from './laboratorio.js';   // Laboratorio: editor 3D del Híbrido (docs/EDITOR_HUESPEDES.md)
import { buildEvolucionScreen, showEvolucion } from './evolucion-ui.js';
import { buildTerritoriosScreen, showTerritorios } from './territorios-ui.js';
import { buildInventarioScreen, showInventario } from './inventario-ui.js';
import { buildGraficosScreen, showGraficos } from './graficos-ui.js';
import { buildTiendaScreen, showTienda } from './tienda-ui.js';
import { aplicarMarca } from './marca.js';
import { buildMain, buildBarra, dibujarBarra, refrescarInicio, vecino, guardarUltimo, leerUltimo } from './menu-hubs.js';
import { continuarDe, SECCIONES, SECCION_DE, tabActiva } from './menu-nav.js';
import { crearBienvenida, debeSaludar } from './menu-bienvenida.js';
import * as Perfil from './perfil.js';

const $ = (id) => document.getElementById(id);
export class MenuUI {
  constructor({ sound, actions }) {
    this.sound = sound; this.actions = actions; this.screen = 'title'; this.stack = []; this.idx = 0; this.active = true; this.relative = !location.pathname.endsWith('/') ? '' : '';
    this.root = $('menu'); aplicarMarca(); buildMain(this); buildBarra(this); buildIdentityMenu(this); buildAccountMenu(this); buildOperations(this); this.bindEvents(); this.buildBestiary(); this.buildLoadout(); buildHuespedScreen(this); buildLaboratorioScreen(this); buildEvolucionScreen(this); buildTerritoriosScreen(this); buildInventarioScreen(this); buildGraficosScreen(this); buildTiendaScreen(this); this.addBackButtons(); this.bv = crearBienvenida(this); this.vigilarPestanas(); this.refreshHuesped(); this.show('title'); this.updateStartLabel();
  }
  /** Botón «‹ Volver» visible en cada pantalla que no sea el título ni el menú principal (táctil, ratón y teclado). */
  addBackButtons() {
    this.root.querySelectorAll('.screen').forEach((sc) => {
      if (sc.id === 'title' || sc.id === 'main' || sc.querySelector(':scope > .backbtn, .backbtn')) return;   // (algunas pantallas traen el suyo en su plantilla; el Equipo se arma después y no lo trae)
      const b = document.createElement('button'); b.className = 'backbtn'; b.type = 'button'; b.innerHTML = '<span aria-hidden="true">‹</span> Volver'; b.setAttribute('aria-label', 'Volver al menú anterior');
      b.addEventListener('click', (e) => { e.stopPropagation(); this.back(); }); sc.prepend(b);
    });
  }
  updateStartLabel() { const touch = matchMedia('(pointer: coarse)').matches; $('startlabel').textContent = touch ? 'Tocá la pantalla' : 'Presioná cualquier botón'; }
  /* ───── pantallas ───── */
  list(name = this.screen) {
    const q = { mercado: '#mercado .market-nav:not(:disabled)', title: '#pressstart', modes: '#modes .card', story: '#story [data-campaign]:not(:disabled):not([hidden])', arenas: '#arenas .card', 'arena-codex': '#arena-codex .card', coop: '#coopscr .panel:not([hidden]) select, #coopscr .panel:not([hidden]) .btn, #coopscr .panel:not([hidden]) input', bestiary: '#bgrid .bcell', loadout: '#chlist .chcard, #slotbar .slot, #wlist .wcell', huesped: '#huesped .hs-nav', laboratorio: '#laboratorio .lb-nav', inventario: '#inventario .iv-nav', evolucion: '#evolucion .ev-nav', territorios: '#territorios .tr-nav', graficos: '#graficos .gr-nav', tienda: '#tienda .tn-nav', main: '#continuar, #elegir, #proximo:not([hidden]), #mainlist .door', options: '#options .panel label, #options summary' }[name];
    if (name === 'tienda' && this.tn && this.tn.dialogoAbierto()) return [...this.root.querySelectorAll('#tnyes, #tnno')];   // con el cartel de confirmación abierto, sólo se navega entre Sí y No
    const l = [...this.root.querySelectorAll(q)];
    return name === 'options' ? l.filter((e) => e.getClientRects().length > 0) : l;   // (los ajustes táctiles plegados no cuentan)
  }
  show(name, push = true) {
    if (this.screen === 'mercado') this.market?.leave();
    if (push && this.screen !== name && name !== 'title') this.stack.push(this.screen);
    if (['story', 'modes', 'main', 'arena-codex'].includes(name)) refreshCampaignMenu(this);
    const antes = this.screen; if (antes === 'laboratorio' && name !== 'laboratorio') hideLaboratorio(this); this.screen = name; this.root.dataset.dir = push ? 'fwd' : 'back';
    this.root.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.dataset.screen === name)); this.root.dataset.pantalla = name;
    dibujarBarra(this, name); this.root.dataset.inicio = name === 'main' ? '1' : '0';   // barra superior única: volver · pestañas · Modo · Gráficos · núcleos
    refrescarInicio(this);   // (núcleos y puntitos de la barra se recalculan en cada pantalla)
    this.idx = name === 'bestiary' ? 0 : 0; this.focus(this.idx, true);
    $('prompts').style.opacity = name === 'mercado' || name === 'title' || name === 'tienda' || name === 'huesped' || name === 'laboratorio' || name === 'evolucion' || name === 'territorios' || name === 'inventario' || name === 'graficos' ? 0 : 1;
    if (name === 'bestiary') this.selectBeast(0);
    if (name === 'loadout') this.renderLoadout();
    if (name === 'huesped') showHuesped(this);
    if (name === 'laboratorio') showLaboratorio(this);
    if (name === 'territorios') showTerritorios(this);
    if (name === 'graficos') showGraficos(this);
    if (name === 'evolucion') showEvolucion(this);
    if (name === 'tienda') showTienda(this);
    if (name === 'mercado') this.market.enter();
    if (name === 'inventario') { try { const p = Perfil.perfil(); p.menu.iv = p.nu; Perfil.guardar(); } catch { /* sin perfil */ } const h = this.ivHost; this.ivHost = null; showInventario(this, h); }
    if (name === 'main') this.refreshHuesped();
    if (name === 'coop' && this.actions.coop) this.actions.coop();   // Cooperativo: prueba el servidor y muestra la sala (coop-ui.js)
  }
  /** Rótulo del menú principal: qué Huésped está elegido (el panel de Mi Huésped, Continuar y los avisos se recalculan). */
  refreshHuesped() { if (this.screen !== 'title') refrescarInicio(this); }
  back() {
    if (this.screen === 'title') return;
    if (this.desdeBase && (this.screen === 'main' || !this.stack.length)) { this.sound.ui('back'); this.desdeBase(); return; }   // abierto desde la Base (main.js › baseAbrir): el último «Volver» cierra el menú y vuelve al mapa
    if (this.screen === 'tienda' && this.tn && this.tn.dialogoAbierto()) { this.tn.cerrarDialogo(); this.sound.ui('back'); this.focus(this.idx, true); return; }   // Esc cierra primero el cartel de confirmación
    if (this.screen === 'main') return;   // en el inicio no hay a dónde volver (el título no se vuelve a mostrar)
    const prev = this.stack.pop(); this.sound.ui('back'); this.show(prev || 'main', false);
  }
  /** Cambia de pestaña dentro de la sección (barra superior): reemplaza la pantalla SIN apilar, así «Volver» sigue yendo al inicio (o a la Base). */
  irTab(def) {
    if (!def) return; const cambia = def.go !== this.screen;
    if (cambia) { this.root.dataset.dir = 'fwd'; this.show(def.go, false); }
    if (def.btab) { const b = this.root.querySelector(`#btabs .bt-tab[data-t="${def.btab}"]`); if (b && this.btab !== def.btab) b.click(); }
    if (def.ivtab && this.iv && this.iv.setTab && this.iv.tab !== def.ivtab) this.iv.setTab(def.ivtab);
    dibujarBarra(this, this.screen);
  }
  /** Pestaña anterior / siguiente de la sección (Q / E, LB / RB del mando). */
  cambiarTab(d) {
    const S = SECCIONES[SECCION_DE[this.screen]]; if (!S) return; const i = tabActiva(this.screen, { btab: this.btab, ivtab: this.iv && this.iv.tab });
    const j = i + d; if (j < 0 || j >= S.tabs.length) return; this.sound.ui('tick'); this.irTab(S.tabs[j]);
  }
  /** Las pestañas internas del Bestiario (Criaturas · Fauna · Herbario) y del Inventario se cambian por dentro de sus pantallas: se mira cuándo para que la barra marque la correcta. */
  vigilarPestanas() {
    const sync = () => { if (this.screen === 'bestiary' || this.screen === 'inventario') dibujarBarra(this, this.screen); };
    for (const [sel, filtro] of [['#bestiary', ['class']], ['#ivtabs', ['class']]]) { const el = this.root.querySelector(sel); if (el) new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: filtro, subtree: sel === '#ivtabs' }); }
  }
  /** Botón grande «Continuar»: retoma lo último que jugaste (Historia o la última arena). */
  continuar() {
    const u = continuarDe(leerUltimo(), '', Perfil.perfil().campaign); this.sound.ui('ok');
    if (u.tipo === 'modes') { this.go('modes'); return; }
    if (u.tipo === 'arena') { guardarUltimo({ k: 'arena', id: u.id }); this.actions.arena(u.id); } else { guardarUltimo({ k: 'story' }); this.actions.story(); }
  }
  refocus() { this.focus(this.idx, true); }
  focus(i, silent = false) {
    const l = this.list(); if (!l.length) return; this.idx = (i + l.length) % l.length;
    l.forEach((e, k) => e.classList.toggle('focus', k === this.idx));
    const el = l[this.idx];
    if ((this.screen === 'modes' || this.screen === 'story' || this.screen === 'arenas' || this.screen === 'arena-codex' || this.screen === 'mercado' || this.screen === 'graficos' || this.screen === 'tienda' || this.screen === 'main') && !silent && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });   // el panel de Gráficos es largo: seguir el foco con teclado y mando
    if (this.screen === 'bestiary') this.selectBeast(this.idx);
    if (!silent) this.sound.ui('tick');
  }
  buildBestiary() { this.buildBestiaryCriaturas(); buildFaunaTab(this); buildHerbarioTab(this); }
  buildBestiaryCriaturas() {
    $('bgrid').innerHTML = BESTIARY.map((b, i) => `<button class="bcell" data-i="${i}" style="--c:${b.color}"><span>${b.name}</span></button>`).join('');
    $('bgrid').querySelectorAll('.bcell').forEach((c) => { c.addEventListener('mouseenter', () => { if (this.screen === 'bestiary') this.focus(+c.dataset.i); }); c.addEventListener('click', () => this.selectBeast(+c.dataset.i)); });
  }
  selectBeast(i) {
    if (this.btab === 'h') return selectHerbario(this, i);   // pestaña Herbario del Bestiario
    if (this.btab === 'f') return selectFauna(this, i);   // pestaña Fauna del Bestiario
    const b = BESTIARY[i]; if (!b) return; $('bname').textContent = b.name; $('brole').textContent = b.role + (b.boss ? ' · jefe' : '');
    $('bdesc').textContent = b.desc; $('bstats').innerHTML = `<dt>Vida</dt><dd>${b.hp}</dd><dt>Tipo</dt><dd>${b.fly ? 'volador' : 'terrestre'}</dd><dt>Consejo</dt><dd>${b.tip}</dd>`;
    const f = $('bview'), src = `./public/viewer.html?k=${b.kind}&turn=1&embed=1&big=1&q=${window.__api && window.__api.level === 'low' ? 'low' : 'medium'}`; if (f.dataset.k !== b.kind) { f.dataset.k = b.kind; f.src = new URL(src, document.baseURI).href; }
  }
  /* ───── equipo: personajes y armas ───── */
  buildLoadout() { buildHeroScreen(this); } // la pantalla de héroes vive en heroes-ui.js (+ public/heroes.css y public/hero-view.html)
  renderLoadout() { renderHeroScreen(this); }
  /* ───── entrada ───── */
  bindEvents() {
    this.root.querySelectorAll('[data-go]').forEach((b) => { b.addEventListener('mouseenter', () => { if (this.screen === 'main') this.focus(this.list().indexOf(b)); }); b.addEventListener('click', () => this.go(b.dataset.go)); });
    $('pressstart').addEventListener('click', () => this.confirmTitle());
    this.root.addEventListener('click', (e) => { if (this.screen === 'title' && this.active) this.confirmTitle(); });
    this.root.querySelectorAll('.card, .btn, #options label').forEach((c) => c.addEventListener('mouseenter', () => { const l = this.list(); const i = l.indexOf(c); if (i >= 0) this.focus(i); }));
    this.root.addEventListener('mouseover', (e) => { const t = e.target.closest && e.target.closest('.tn-nav'); if (t && this.screen === 'tienda') { const l = this.list(), i = l.indexOf(t); if (i >= 0 && i !== this.idx) this.focus(i, true); } });
    this.root.querySelectorAll('[data-campaign]').forEach(b => b.addEventListener('click', () => { guardarUltimo({ k: 'story' }); this.actions.story(b.dataset.campaign === 'new'); }));
    this.root.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => { guardarUltimo({ k: 'arena', id: b.dataset.start }); this.actions.arena(b.dataset.start); }));
    // gesto táctil «atrás»: deslizar desde el borde izquierdo hacia la derecha (igual que el botón Volver, Esc o el botón ○ del mando)
    let sw = null;
    this.root.addEventListener('touchstart', (e) => { const t = e.touches[0]; sw = e.touches.length === 1 && t.clientX < 28 ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
    this.root.addEventListener('touchend', (e) => { if (!sw) return; const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = Math.abs(t.clientY - sw.y); sw = null; if (dx > 70 && dy < 60 && this.active && this.screen !== 'title') this.back(); }, { passive: true });
  }
  confirmTitle() { if (this.screen !== 'title') return; this.sound.init(); this.sound.resume(); this.sound.startMusic('m1'); this.sound.ui('ok'); this.show('main', false); if (debeSaludar()) this.bv.abrir(); }
  go(name) { this.sound.ui('ok'); if (name === 'base') { if (this.actions.base) this.actions.base(); return; } this.show(name); }   // «La Base» no es una pantalla del menú: es un mapa (main.js › startBase)
  /** Acciones abstractas: up/down/left/right/ok/back */
  act(a) {
    if (!this.active) return; this.sound.init();
    if (this.screen === 'title') { if (a === 'ok' || a === 'any') this.confirmTitle(); return; }
    if (this.bv && this.bv.abierto()) { if (a === 'ok') this.bv.siguiente(); else if (a === 'back') this.bv.cerrar(); return; }   // la bienvenida de la primera vez tiene el foco
    if (a === 'back') return this.back();
    if (a === 'tabprev' || a === 'tabnext') return this.cambiarTab(a === 'tabnext' ? 1 : -1);
    const l = this.list(); if (!l.length) return; const cur = l[this.idx];
    if (this.screen === 'main' || this.screen === 'tienda' || this.screen === 'mercado' || this.screen === 'arenas') {   // rejillas, pestañas y paneles: se va al vecino más cercano en esa dirección
      if (a === 'ok') { this.sound.ui('ok'); if (cur.tagName === 'SELECT') return this.stepSelect(cur, 1); return cur.click(); }
      if ((a === 'left' || a === 'right') && cur.tagName === 'SELECT') return this.stepSelect(cur, a === 'right' ? 1 : -1);
      const j = vecino(l, this.idx, a); if (j >= 0) this.focus(j); return;
    }
    const grid = this.screen === 'bestiary' ? 5 : 1, horiz = this.screen === 'story' || this.screen === 'arenas';
    if (a === 'down') return this.focus(this.idx + (horiz ? 0 : grid));
    if (a === 'up') return this.focus(this.idx - (horiz ? 0 : grid));
    if (a === 'right') { if (cur && cur.tagName === 'SELECT') return this.stepSelect(cur, 1); if (cur && cur.closest('label') && cur.querySelector && cur.querySelector('input[type=range]')) return this.stepRange(cur.querySelector('input'), 1); return this.focus(this.idx + (this.screen === 'bestiary' || horiz || this.screen === 'graficos' ? 1 : 0)); }
    if (a === 'left') { if (cur && cur.tagName === 'SELECT') return this.stepSelect(cur, -1); if (cur && cur.querySelector && cur.querySelector('input[type=range]')) return this.stepRange(cur.querySelector('input'), -1); return this.focus(this.idx - (this.screen === 'bestiary' || horiz || this.screen === 'graficos' ? 1 : 0)); }
    if (a === 'ok') { this.sound.ui('ok'); if (cur.matches('label')) { const s = cur.querySelector('select'); if (s) this.stepSelect(s, 1); return; } if (cur.tagName === 'INPUT') { cur.focus(); return; } cur.click(); }
  }
  stepSelect(sel, d) { sel.selectedIndex = (sel.selectedIndex + d + sel.options.length) % sel.options.length; sel.dispatchEvent(new Event('change')); this.sound.ui('tick'); }
  stepRange(inp, d) { inp.value = Math.max(+inp.min, Math.min(+inp.max, +inp.value + d)); inp.dispatchEvent(new Event('input')); this.sound.ui('tick'); }
  handleKey(e) {
    if (!this.active || (this.root.classList.contains('hidden'))) return false;
    if (this.screen === 'laboratorio' && this.lb && this.lb.tecla(e)) return true;   // el editor atiende sus propias teclas (deshacer, cámaras, gizmo…)
    if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type !== 'range') { if (e.code === 'Escape' || e.code === 'Enter') { document.activeElement.blur(); e.preventDefault(); return true; } return false; }
    const m = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Enter: 'ok', Space: 'ok', Escape: 'back', Backspace: 'back', KeyQ: 'tabprev', PageUp: 'tabprev', KeyE: 'tabnext', PageDown: 'tabnext' }[e.code];
    if (this.screen === 'title') { this.act('any'); e.preventDefault(); return true; }
    if (!m) return false; this.act(m); e.preventDefault(); return true;
  }
}

/* ───── pantalla de carga con consejos ───── */
export function showLoading(ms, then) {
  const el = $('loading'); el.classList.remove('hidden'); $('ltip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  const f = $('lfill'); f.style.width = '0%'; let t0 = performance.now();
  const iv = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); f.style.width = (k * 100) + '%'; if (k >= 1) { clearInterval(iv); setTimeout(() => { el.classList.add('hidden'); then(); }, 120); } }, 50);
}

/* ───── trofeos ───── */
const KEY = 'cristal.trofeos.v1';
let got = new Set(); try { got = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { /* sin almacenamiento */ }
export function trophy(id, title, desc, sound) {
  if (got.has(id)) return; got.add(id); try { localStorage.setItem(KEY, JSON.stringify([...got])); } catch { /* ok */ }
  const d = document.createElement('div'); d.className = 'trophy'; d.innerHTML = `<i>🏆</i><div><b>${title}</b><small>${desc}</small></div>`; $('trophies').appendChild(d);
  if (sound) sound.ui('trophy'); setTimeout(() => d.remove(), 2600);
}
