// Interfaz de acceso estilo PlayStation 5: título → menú principal con tarjetas → sub-pantallas. Teclado, ratón, táctil y mando.
import { BESTIARY, TIPS } from './lore.js';
import { CHARACTERS, CHARACTER_IDS, ROLES, WEAPONS } from '../sim/data.js';
import { Equipo, saveEquipo, assignWeapon } from './equipo.js';
import { WEAPON_COLORS } from './shotfx.js';
import { buildHeroScreen, renderHeroScreen } from './heroes-ui.js';
import { buildHuespedScreen, showHuesped } from './huespedes-ui.js';
import { buildEvolucionScreen, showEvolucion } from './evolucion-ui.js';
import { buildTerritoriosScreen, showTerritorios } from './territorios-ui.js';
import { buildInventarioScreen, showInventario } from './inventario-ui.js';
import { buildGraficosScreen, showGraficos } from './graficos-ui.js';
import { buildTiendaScreen, showTienda } from './tienda-ui.js';
import { aplicarMarca } from './marca.js';
import { buildMain, buildHubs, refrescarInicio, dibujarMigas, vecino, guardarUltimo, leerUltimo } from './menu-hubs.js';
import { continuarDe, PANTALLAS } from './menu-nav.js';
import * as Perfil from './perfil.js';

const $ = (id) => document.getElementById(id);
export class MenuUI {
  constructor({ sound, actions }) {
    this.sound = sound; this.actions = actions; this.screen = 'title'; this.stack = []; this.idx = 0; this.active = true; this.relative = !location.pathname.endsWith('/') ? '' : '';
    this.root = $('menu'); aplicarMarca(); buildMain(this); buildHubs(this); this.addBackButtons(); this.bindEvents(); this.buildBestiary(); this.buildLoadout(); buildHuespedScreen(this); buildEvolucionScreen(this); buildTerritoriosScreen(this); buildInventarioScreen(this); buildGraficosScreen(this); buildTiendaScreen(this); this.refreshHuesped(); this.show('title'); this.updateStartLabel();
  }
  /** Botón «‹ Volver» visible en cada pantalla que no sea el título ni el menú principal (táctil, ratón y teclado). */
  addBackButtons() {
    this.root.querySelectorAll('.screen').forEach((sc) => {
      if (sc.id === 'title' || sc.id === 'main') return;
      const b = document.createElement('button'); b.className = 'backbtn'; b.type = 'button'; b.innerHTML = '<span aria-hidden="true">‹</span> Volver'; b.setAttribute('aria-label', 'Volver al menú anterior');
      b.addEventListener('click', (e) => { e.stopPropagation(); this.back(); }); sc.prepend(b);
    });
  }
  updateStartLabel() { const touch = matchMedia('(pointer: coarse)').matches; $('startlabel').textContent = touch ? 'Tocá la pantalla' : 'Presioná cualquier botón'; }
  /* ───── pantallas ───── */
  list(name = this.screen) {
    const q = { title: '#pressstart', story: '#story .card', arenas: '#arenas .card', coop: '#coopscr select, #coopscr .btn, #coopscr input', bestiary: '#bgrid .bcell', loadout: '#chlist .chcard, #slotbar .slot, #wlist .wcell', huesped: '#huesped .hs-nav', inventario: '#inventario .iv-nav', evolucion: '#evolucion .ev-nav', territorios: '#territorios .tr-nav', graficos: '#graficos .gr-nav', tienda: '#tienda .tn-nav', main: '#continuar, #mainlist .door', 'hub-jugar': '#hub-jugar #modeitem, #hub-jugar .hubcard, #hub-jugar .rstep', 'hub-huesped': '#hub-huesped .hubcard', 'hub-mundo': '#hub-mundo .hubcard', 'hub-ajustes': '#hub-ajustes .hubcard', options: '#options .panel label, #options .gfxgo, #options #gfxgo' }[name];
    if (name === 'tienda' && this.tn && this.tn.dialogoAbierto()) return [...this.root.querySelectorAll('#tnyes, #tnno')];   // con el cartel de confirmación abierto, sólo se navega entre Sí y No
    return [...this.root.querySelectorAll(q)];
  }
  show(name, push = true) {
    if (push && this.screen !== name && name !== 'title') this.stack.push(this.screen);
    const antes = this.screen; this.screen = name; this.root.dataset.dir = push ? 'fwd' : 'back';   // dirección de la transición corta (menu.css)
    this.root.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.dataset.screen === name));
    dibujarMigas(this, name); const inicio = name === 'main' || name.startsWith('hub-') || name === 'tienda'; const sal = $('saldo'); if (sal) sal.hidden = !inicio;
    if (inicio) refrescarInicio(this);
    this.idx = name === 'bestiary' ? 0 : 0; this.focus(this.idx, true);
    $('prompts').style.opacity = name === 'title' || name === 'tienda' || name === 'huesped' || name === 'evolucion' || name === 'territorios' || name === 'inventario' || name === 'graficos' ? 0 : 1;
    if (name === 'bestiary') this.selectBeast(0);
    if (name === 'loadout') this.renderLoadout();
    if (name === 'huesped') showHuesped(this);
    if (name === 'territorios') showTerritorios(this);
    if (name === 'graficos') showGraficos(this);
    if (name === 'evolucion') showEvolucion(this);
    if (name === 'tienda') showTienda(this);
    if (name === 'inventario') { try { const p = Perfil.perfil(); p.menu.iv = p.nu; Perfil.guardar(); } catch { /* sin perfil */ } const h = this.ivHost; this.ivHost = null; showInventario(this, h); }
    if (name === 'main') this.refreshHuesped();
  }
  /** Rótulo del menú principal: qué Huésped está elegido (el panel de Mi Huésped, Continuar y los avisos se recalculan). */
  refreshHuesped() { if (this.screen === 'main' || this.screen.startsWith('hub-') || this.screen === 'tienda') refrescarInicio(this); }
  back() {
    if (this.screen === 'title') return;
    if (this.screen === 'tienda' && this.tn && this.tn.dialogoAbierto()) { this.tn.cerrarDialogo(); this.sound.ui('back'); this.focus(this.idx, true); return; }   // Esc cierra primero el cartel de confirmación
    if (this.screen === 'main') return;   // en el inicio no hay a dónde volver (el título no se vuelve a mostrar)
    const prev = this.stack.pop(); this.sound.ui('back'); this.show(prev || 'main', false);
  }
  /** Salta a una pantalla de las migas de pan (reconstruye el camino de vuelta: Inicio › … ). */
  saltar(name) { if (!PANTALLAS[name]) return; const camino = []; for (let id = PANTALLAS[name].padre; id; id = PANTALLAS[id].padre) camino.unshift(id); this.stack = camino; this.sound.ui('tick'); this.show(name, false); }
  /** Botón grande «Continuar»: retoma lo último que jugaste (Historia o la última arena). */
  continuar() {
    const u = continuarDe(leerUltimo()); this.sound.ui('ok');
    if (u.tipo === 'arena') { guardarUltimo({ k: 'arena', id: u.id }); this.actions.arena(u.id); } else { guardarUltimo({ k: 'story' }); this.actions.story(); }
  }
  refocus() { this.focus(this.idx, true); }
  focus(i, silent = false) {
    const l = this.list(); if (!l.length) return; this.idx = (i + l.length) % l.length;
    l.forEach((e, k) => e.classList.toggle('focus', k === this.idx));
    const el = l[this.idx];
    if ((this.screen === 'graficos' || this.screen === 'tienda' || this.screen.startsWith('hub-')) && !silent && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });   // el panel de Gráficos es largo: seguir el foco con teclado y mando
    if (this.screen === 'bestiary') this.selectBeast(this.idx);
    if (!silent) this.sound.ui('tick');
  }
  buildBestiary() {
    $('bgrid').innerHTML = BESTIARY.map((b, i) => `<button class="bcell" data-i="${i}" style="--c:${b.color}"><span>${b.name}</span></button>`).join('');
    $('bgrid').querySelectorAll('.bcell').forEach((c) => { c.addEventListener('mouseenter', () => { if (this.screen === 'bestiary') this.focus(+c.dataset.i); }); c.addEventListener('click', () => this.selectBeast(+c.dataset.i)); });
  }
  selectBeast(i) {
    const b = BESTIARY[i]; if (!b) return; $('bname').textContent = b.name; $('brole').textContent = b.role + (b.boss ? ' · jefe' : '');
    $('bdesc').textContent = b.desc; $('bstats').innerHTML = `<dt>Vida</dt><dd>${b.hp}</dd><dt>Tipo</dt><dd>${b.fly ? 'volador' : 'terrestre'}</dd><dt>Consejo</dt><dd>${b.tip}</dd>`;
    const f = $('bview'), src = `./public/viewer.html?k=${b.kind}&turn=1&embed=1&big=1&q=${window.__api && window.__api.level === 'low' ? 'low' : 'medium'}`; if (f.dataset.k !== b.kind) { f.dataset.k = b.kind; f.src = new URL(src, document.baseURI).href; }
  }
  /* ───── equipo: personajes y armas ───── */
  buildLoadout() { buildHeroScreen(this); } // la pantalla de héroes vive en heroes-ui.js (+ public/heroes.css y public/hero-view.html)
  renderLoadout() { renderHeroScreen(this); }
  /* ───── entrada ───── */
  bindEvents() {
    this.root.querySelectorAll('[data-go]').forEach((b) => { b.addEventListener('mouseenter', () => { if (this.screen === 'main' || this.screen.startsWith('hub-')) this.focus(this.list().indexOf(b)); }); b.addEventListener('click', () => this.go(b.dataset.go)); });
    $('pressstart').addEventListener('click', () => this.confirmTitle());
    this.root.addEventListener('click', (e) => { if (this.screen === 'title' && this.active) this.confirmTitle(); });
    this.root.querySelectorAll('.card, .btn, #options label').forEach((c) => c.addEventListener('mouseenter', () => { const l = this.list(); const i = l.indexOf(c); if (i >= 0) this.focus(i); }));
    this.root.addEventListener('mouseover', (e) => { const t = e.target.closest && e.target.closest('.tn-nav'); if (t && this.screen === 'tienda') { const l = this.list(), i = l.indexOf(t); if (i >= 0 && i !== this.idx) this.focus(i, true); } });
    $('story').querySelector('.card').addEventListener('click', () => { guardarUltimo({ k: 'story' }); this.actions.story(); });
    this.root.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => { guardarUltimo({ k: 'arena', id: b.dataset.start }); this.actions.arena(b.dataset.start); }));
    // gesto táctil «atrás»: deslizar desde el borde izquierdo hacia la derecha (igual que el botón Volver, Esc o el botón ○ del mando)
    let sw = null;
    this.root.addEventListener('touchstart', (e) => { const t = e.touches[0]; sw = e.touches.length === 1 && t.clientX < 28 ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
    this.root.addEventListener('touchend', (e) => { if (!sw) return; const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = Math.abs(t.clientY - sw.y); sw = null; if (dx > 70 && dy < 60 && this.active && this.screen !== 'title') this.back(); }, { passive: true });
  }
  confirmTitle() { if (this.screen !== 'title') return; this.sound.init(); this.sound.resume(); this.sound.startMusic('m1'); this.sound.ui('ok'); this.show('main', false); }
  go(name) { this.sound.ui('ok'); this.show(name); }
  /** Acciones abstractas: up/down/left/right/ok/back */
  act(a) {
    if (!this.active) return; this.sound.init();
    if (this.screen === 'title') { if (a === 'ok' || a === 'any') this.confirmTitle(); return; }
    if (a === 'back') return this.back();
    const l = this.list(); if (!l.length) return; const cur = l[this.idx];
    if (this.screen === 'main' || this.screen.startsWith('hub-') || this.screen === 'tienda') {   // rejillas, pestañas y paneles: se va al vecino más cercano en esa dirección
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
    if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type !== 'range') { if (e.code === 'Escape' || e.code === 'Enter') { document.activeElement.blur(); e.preventDefault(); return true; } return false; }
    const m = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Enter: 'ok', Space: 'ok', Escape: 'back', Backspace: 'back' }[e.code];
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
