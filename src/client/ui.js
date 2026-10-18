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

const $ = (id) => document.getElementById(id);
const HERO = {
  story: ['Historia', 'Moriste en las vías y despertaste en el limbo. Pero seguís vivo: y todas las criaturas que añoran la vida quieren la tuya. Elegí el Huésped correcto y evolucioná sin errores para sobrevivir.', ['Solo', '2 capítulos', '2 jefes']],
  arenas: ['Arenas', 'Salteá la historia y andá directo a la acción en cualquiera de los cuatro mapas, con oleadas progresivas y un jefe cada uno. Nuevo: Jardín de Carne, un planeta vivo donde los caminos crecen.', ['Solo', 'Oleadas', 'Jefes']],
  coop: ['Cooperativo', 'Creá una sala o unite con un código. Hasta 4 Pasajeros, hordas que escalan con el grupo y reanimación entre compañeros.', ['1–4 jugadores', 'Wi-Fi / LAN']],
  bestiary: ['Bestiario', 'Quince organismos mitad carne, mitad cristal. Girá cada criatura en 3D y leé sus patrones, avisos y debilidades.', ['12 criaturas', '3 jefes']],
  huesped: ['Huésped', 'Elegí tu Huésped: uno de los 5 organismos biomecánicos (o un Veterano). Mirá su modelo en 3D, sus estadísticas y sus habilidades antes de entrar a la partida.', ['5 Huéspedes', 'Veteranos', 'Demostración']],
  territorios: ['Territorios', 'Los seis lugares robados del mundo, cada uno con su folclore. Liberalos venciendo a su jefe y elegí UNA bendición por territorio: la otra queda cerrada para siempre.', ['6 territorios', '12 bendiciones', 'Una por lugar']],
  inventario: ['Inventario', 'Lo que dropea en las partidas son MATERIALES orgánicos y PLANOS: en la Forja los convertís en armas de disparo, armas cuerpo a cuerpo, armadura y reliquias que maduran con tus bajas. Juntá sets de 2 y 4 piezas y probá todo sobre tu Huésped en 3D.', ['Materiales', 'Planos', 'Forja', 'Sets']],
  evolucion: ['Evolución', 'Gastá los núcleos que ganás en combate: evolucioná a tu Huésped (4 niveles, cada uno lo cambia a la vista) y fusioná con él una espada, hacha, martillo, lanza o daga que despierta su poder especial.', ['4 niveles', '15 armas', 'Fusión']],
  loadout: ['Equipo', 'Elegí entre 6 personajes, cada uno con un desplazamiento y un disparo especial propios, y armá tu arsenal con 14 armas. Tras cada oleada mejorás las armas que elegiste.', ['6 personajes', '15 armas', 'Mejoras']],
  modo: ['Modo de juego', 'Shooter es el de siempre: disparás, apuntás y usás tres habilidades. Combo hace del cuerpo a cuerpo lo principal: DOS botones de ataque que se encadenan en combos (cada Huésped tiene los suyos y los desbloquea al evolucionar) y UNA habilidad muy importante propia. Se cambia cuando quieras, también en Opciones y en la Pausa.', ['Shooter', 'Combo', 'Los 5 Huéspedes']],
  graficos: ['Gráficos', 'Elegí Baja, Media o Alta (iPhone → Baja o Media), ajustá la resolución, prendé o apagá sombras, brillo y partículas, limitá los FPS y mirá cuánto pesa cada cosa. Se aplica en vivo y se recuerda.', ['Baja · Media · Alta', 'Resolución', 'FPS']],
  options: ['Opciones', 'Controles, sensibilidad, volumen y subtítulos. Los gráficos tienen su propio menú.', ['PC', 'iPhone', 'Mando']],
};
const ART = { modo: './public/art/opciones.jpg', story: './public/art/historia.jpg', arenas: './public/art/arena-m1.jpg', coop: './public/art/coop.jpg', loadout: './public/art/opciones.jpg', huesped: './public/art/opciones.jpg', territorios: './public/art/opciones.jpg', graficos: './public/art/opciones.jpg', evolucion: './public/art/opciones.jpg', inventario: './public/art/opciones.jpg', bestiary: './public/art/bestiario.jpg', options: './public/art/opciones.jpg' };

export class MenuUI {
  constructor({ sound, actions }) {
    this.sound = sound; this.actions = actions; this.screen = 'title'; this.stack = []; this.idx = 0; this.active = true; this.relative = !location.pathname.endsWith('/') ? '' : '';
    this.root = $('menu'); this.addBackButtons(); this.bindEvents(); this.buildBestiary(); this.buildLoadout(); buildHuespedScreen(this); buildEvolucionScreen(this); buildTerritoriosScreen(this); buildInventarioScreen(this); buildGraficosScreen(this); this.refreshHuesped(); this.show('title'); this.updateStartLabel();
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
    const q = { title: '#pressstart', main: '#mainlist .item', story: '#story .card', arenas: '#arenas .card', coop: '#coopscr select, #coopscr .btn, #coopscr input', bestiary: '#bgrid .bcell', loadout: '#chlist .chcard, #slotbar .slot, #wlist .wcell', huesped: '#huesped .hs-nav', inventario: '#inventario .iv-nav', evolucion: '#evolucion .ev-nav', territorios: '#territorios .tr-nav', graficos: '#graficos .gr-nav', options: '#options .panel label, #options .gfxgo, #options #gfxgo' }[name];
    return [...this.root.querySelectorAll(q)];
  }
  show(name, push = true) {
    if (push && this.screen !== name && name !== 'title') this.stack.push(this.screen);
    this.screen = name;
    this.root.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.dataset.screen === name));
    this.idx = name === 'bestiary' ? 0 : 0; this.focus(this.idx, true);
    $('prompts').style.opacity = name === 'title' || name === 'huesped' || name === 'evolucion' || name === 'territorios' || name === 'inventario' || name === 'graficos' ? 0 : 1;
    if (name === 'bestiary') this.selectBeast(0);
    if (name === 'loadout') this.renderLoadout();
    if (name === 'huesped') showHuesped(this);
    if (name === 'territorios') showTerritorios(this);
    if (name === 'graficos') showGraficos(this);
    if (name === 'evolucion') showEvolucion(this);
    if (name === 'inventario') { const h = this.ivHost; this.ivHost = null; showInventario(this, h); }
    if (name === 'main') this.refreshHuesped();
  }
  /** Rótulo del menú principal: qué Huésped está elegido. */
  refreshHuesped() { const s = this.root.querySelector('[data-go=huesped] small'), c = CHARACTERS[Equipo.char]; if (s && c) s.textContent = 'Tu Huésped: ' + c.name + ' · ' + (c.title || c.desc); }
  back() { if (this.screen === 'title') return; const prev = this.stack.pop(); this.sound.ui('back'); this.show(prev || 'main', false); }
  focus(i, silent = false) {
    const l = this.list(); if (!l.length) return; this.idx = (i + l.length) % l.length;
    l.forEach((e, k) => e.classList.toggle('focus', k === this.idx));
    const el = l[this.idx]; if (this.screen === 'main') this.updateHero(el.dataset.go || el.dataset.hero);
    if (this.screen === 'graficos' && !silent && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });   // el panel de Gráficos es largo: seguir el foco con teclado y mando
    if (this.screen === 'bestiary') this.selectBeast(this.idx);
    if (!silent) this.sound.ui('tick');
  }
  updateHero(key) { const h = HERO[key]; if (!h) return; $('herotitle').textContent = h[0]; $('herodesc').textContent = h[1]; $('herochips').innerHTML = h[2].map((c) => `<span>${c}</span>`).join(''); const img = $('heroimg'); const url = ART[key]; if (img.dataset.k !== key) { img.dataset.k = key; img.style.opacity = 0; setTimeout(() => { img.src = url; img.style.opacity = 1; }, 120); } }
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
    this.root.querySelectorAll('[data-go]').forEach((b) => { b.addEventListener('mouseenter', () => { if (this.screen === 'main') this.focus(this.list().indexOf(b)); }); b.addEventListener('click', () => this.go(b.dataset.go)); });
    $('pressstart').addEventListener('click', () => this.confirmTitle());
    this.root.addEventListener('click', (e) => { if (this.screen === 'title' && this.active) this.confirmTitle(); });
    this.root.querySelectorAll('.card, .btn, #options label').forEach((c) => c.addEventListener('mouseenter', () => { const l = this.list(); const i = l.indexOf(c); if (i >= 0) this.focus(i); }));
    $('story').querySelector('.card').addEventListener('click', () => this.actions.story());
    this.root.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => this.actions.arena(b.dataset.start)));
  }
  confirmTitle() { if (this.screen !== 'title') return; this.sound.init(); this.sound.resume(); this.sound.startMusic('m1'); this.sound.ui('ok'); this.show('main', false); }
  go(name) { this.sound.ui('ok'); this.show(name); }
  /** Acciones abstractas: up/down/left/right/ok/back */
  act(a) {
    if (!this.active) return; this.sound.init();
    if (this.screen === 'title') { if (a === 'ok' || a === 'any') this.confirmTitle(); return; }
    if (a === 'back') return this.back();
    const l = this.list(); if (!l.length) return; const cur = l[this.idx];
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
