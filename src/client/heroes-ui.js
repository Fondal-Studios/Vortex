// Pantalla de HÉROES (menú Equipo): selector de héroe de shooter actual.
//   · riel de héroes con glifo propio · escenario con vista 3D grande (public/hero-view.html) sobre fondo del color del héroe
//   · nombre, rol y lore corta (2 líneas) · las 3 habilidades con ícono SVG propio · barras de estadísticas (movilidad/daño/soporte/control)
//   · pestaña Armas: ranuras y lista de armas (el Haz es fijo) · todo táctil, con mouse y con teclado/mando (clases hx-nav)
// Sin imágenes externas: SVG/CSS/canvas propios. Lo usan buildLoadout/renderLoadout de ui.js.
import { CHARACTERS, CHARACTER_IDS, ROLES, WEAPONS } from '../sim/data.js';
import { Equipo, saveEquipo, assignWeapon } from './equipo.js';
import { WEAPON_COLORS } from './shotfx.js';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

/* ───────── lore (2 líneas, tono de HISTORIA.md: humor seco con un fondo inquietante) ───────── */
export const HERO_LORE = {
  egida: ['Fue el último en soltar el pasamanos del tren. Todavía no lo soltó del todo.', 'Lo que no puede frenar, lo empuja.'],
  lumen: ['Cosió con luz lo que el andén se llevó. Cree que nadie debería quedarse en el piso.', 'Cura primero. Pregunta después.'],
  forja: ['Armó su primera torreta con un banco de la estación y puro rencor. Funcionó.', 'Si algo no explota, todavía no lo terminó.'],
  vigia: ['Contó las ventanas del tren hasta que dejó de contarlas. Ahora cuenta enemigos.', 'Ve el hilo, le pone una marca y lo corta.'],
  nova:  ['Llegó al Vórtice de un salto y nunca más tocó el piso con ganas.', 'Dispara a lo que se mueve, y a lo que está por moverse.'],
  umbra: ['Se acuerda de un andén vacío donde nadie la miró. En el Vórtice, eso sirve.', 'Dobla el espacio como un papel: sin pedir permiso.'],
};
/* Estadísticas 1–5. Salen de los números del simulador (src/sim/characters.js, roles.js): ver docs/gate/heroes.md */
export const HERO_STATS = {
  egida: [3, 3, 3, 5], lumen: [4, 2, 5, 1], forja: [3, 5, 2, 3], vigia: [4, 3, 3, 2], nova: [5, 4, 2, 1], umbra: [3, 3, 4, 5],
};
const STAT_NAMES = ['Movilidad', 'Daño', 'Soporte', 'Control'];
const ROLE_ICON = { vanguardia: 'cupula', soporte: 'pulso', ingeniero: 'torreta', explorador: 'marca' };
const KEYS = { mov: 'F', esp: 'Clic der.', tac: 'Q' };
const KIND_ES = { hitscan: 'instantánea', projectile: 'proyectil', swarm: 'enjambre', mine: 'mina', pulse: 'onda' };

/* ───────── íconos de habilidad (SVG propios, trazo `currentColor`, 48×48) ───────── */
const S = (body) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const ICONS = {
  embestida: S('<path d="M31 7l11 5v13c0 8-5 13-11 16-6-3-11-8-11-16V12z"/><path d="M31 15v18M24 22l7-7 7 7" opacity=".7"/><path d="M3 17h11M1 24h13M5 31h9" opacity=".8"/>'),
  onda: S('<path d="M5 24L41 7M5 24L41 41"/><path d="M22 15a13 13 0 0 1 0 18"/><path d="M30 11a22 22 0 0 1 0 26" opacity=".8"/><path d="M38 8a31 31 0 0 1 0 32" opacity=".55"/><circle cx="9" cy="24" r="2.5" fill="currentColor"/>'),
  paso: S('<circle cx="9" cy="24" r="6"/><circle cx="39" cy="24" r="6"/><path d="M17 24h5M26 24h5" stroke-dasharray="1 5"/><path d="M26 19l5 5-5 5"/><path d="M39 15v-4M39 37v4M30 24h-1M48 24" opacity=".5"/><circle cx="39" cy="24" r="2" fill="currentColor"/>'),
  rayo: S('<path d="M4 33c7-17 13 9 20-7s14 3 20-14"/><path d="M13 5v12M7 11h12"/><circle cx="42" cy="12" r="2" fill="currentColor"/>'),
  propulsor: S('<path d="M24 3c6 7 8 15 6 23H18c-2-8 0-16 6-23z"/><path d="M18 21l-7 9h7M30 21l7 9h-7"/><path d="M20 31c0 6 4 12 4 12s4-6 4-12" opacity=".85"/><circle cx="24" cy="15" r="2.5" fill="currentColor"/>'),
  cohete: S('<circle cx="19" cy="27" r="9"/><circle cx="37" cy="13" r="3.2"/><circle cx="41" cy="27" r="3.2"/><circle cx="33" cy="40" r="3.2"/><path d="M3 43l9-9" opacity=".8"/><path d="M19 22v10M14 27h10" opacity=".6"/>'),
  deslizamiento: S('<path d="M3 14h20M1 22h26M5 30h18" opacity=".85"/><path d="M29 12l13 11-13 11"/><path d="M6 40h30" opacity=".5"/>'),
  riel: S('<circle cx="24" cy="24" r="11"/><path d="M24 3v10M24 35v10M3 24h10M35 24h10"/><circle cx="24" cy="24" r="2.5" fill="currentColor"/><path d="M3 45L45 3" opacity=".55"/>'),
  salto: S('<path d="M24 5v27M14 15L24 5l10 10"/><ellipse cx="24" cy="40" rx="15" ry="4.5"/><ellipse cx="24" cy="31" rx="9" ry="2.6" opacity=".6"/><circle cx="12" cy="24" r="1.6" fill="currentColor"/><circle cx="37" cy="20" r="1.6" fill="currentColor"/>'),
  rafaga: S('<path d="M7 41L42 8M7 41L46 20M7 41L47 32M7 41L31 4M7 41L18 3"/><circle cx="7" cy="41" r="3.2" fill="currentColor"/>'),
  fase: S('<path d="M17 41V21a9 9 0 0 1 18 0v20l-3.5-3-3 3-3-3-3 3-3-3z"/><circle cx="23" cy="22" r="1.7" fill="currentColor"/><circle cx="30" cy="22" r="1.7" fill="currentColor"/><path d="M12 38V22a8 8 0 0 1 3-6" opacity=".45"/><path d="M7 36V25a6 6 0 0 1 2-4" opacity=".25"/>'),
  singularidad: S('<ellipse cx="24" cy="24" rx="21" ry="8" transform="rotate(-22 24 24)"/><ellipse cx="24" cy="24" rx="14" ry="5" transform="rotate(-22 24 24)" opacity=".6"/><circle cx="24" cy="24" r="5.5" fill="currentColor"/><path d="M6 8c8 2 12 8 14 14M42 40c-8-2-12-8-14-14" opacity=".7"/>'),
  cupula: S('<path d="M5 36a19 19 0 0 1 38 0z"/><path d="M15 36l4-9h10l4 9M24 27v-9" opacity=".65"/><path d="M24 6v4M9 12l3 3M39 12l-3 3" opacity=".6"/>'),
  pulso: S('<circle cx="24" cy="24" r="5.5"/><circle cx="24" cy="24" r="12" opacity=".75"/><circle cx="24" cy="24" r="19" opacity=".4"/><path d="M24 19v10M19 24h10"/>'),
  torreta: S('<path d="M10 42h28l-5-11H15z"/><circle cx="24" cy="23" r="7"/><path d="M30 21l14-6"/><path d="M24 16V9M20 9h8" opacity=".7"/>'),
  marca: S('<circle cx="24" cy="29" r="12"/><path d="M24 3l-7 11h14z" fill="currentColor"/><path d="M24 21v16M16 29h16" opacity=".55"/>'),
};
/* ───────── glifos de héroe (emblema propio, 64×64) ───────── */
const G = (body) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const GLYPHS = {
  egida: G('<path d="M32 5l23 9v17c0 14-10 24-23 28C19 55 9 45 9 31V14z"/><path d="M32 19l12 22H20z" opacity=".8"/><path d="M32 5v54" opacity=".35"/>'),
  lumen: G('<path d="M32 6v52M6 32h52"/><circle cx="32" cy="32" r="11"/><circle cx="32" cy="32" r="21" opacity=".4"/><path d="M14 14l8 8M50 14l-8 8M14 50l8-8M50 50l-8-8" opacity=".55"/>'),
  forja: G('<path d="M32 5l23 13v28L32 59 9 46V18z"/><rect x="22" y="22" width="20" height="20" rx="2"/><path d="M27 22v-6M37 22v-6M27 42v6M37 42v6M22 27h-6M22 37h-6M42 27h6M42 37h6" opacity=".7"/><circle cx="32" cy="32" r="3" fill="currentColor"/>'),
  vigia: G('<circle cx="32" cy="32" r="25"/><circle cx="32" cy="32" r="15" opacity=".6"/><path d="M32 2v10M32 52v10M2 32h10M52 32h10" opacity=".7"/><path d="M18 22l10 6 14-12M28 28l-3 16 18-4" opacity=".9"/><circle cx="18" cy="22" r="2" fill="currentColor"/><circle cx="42" cy="16" r="2" fill="currentColor"/><circle cx="25" cy="44" r="2" fill="currentColor"/><circle cx="43" cy="40" r="2" fill="currentColor"/>'),
  nova: G('<path d="M32 3l6 23 23 6-23 6-6 23-6-23L3 32l23-6z"/><circle cx="32" cy="32" r="7"/><circle cx="32" cy="32" r="2.6" fill="currentColor"/><path d="M13 13l7 7M51 13l-7 7M13 51l7-7M51 51l-7-7" opacity=".5"/>'),
  umbra: G('<path d="M43 8a25 25 0 1 0 0 48 19 19 0 1 1 0-48z"/><path d="M24 30c3 4 7 4 10 0" opacity=".8"/><path d="M45 16c6 4 9 10 9 16s-3 12-9 16" opacity=".4"/><circle cx="26" cy="24" r="1.8" fill="currentColor"/><circle cx="36" cy="24" r="1.8" fill="currentColor"/>'),
};

let cssDone = false;
function injectCss() {
  if (cssDone) return; cssDone = true;
  if (document.querySelector('link[data-heroes]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.heroes = '1';
  l.href = new URL('public/heroes.css', location.href.replace(/[^/]*$/, '')).href; document.head.appendChild(l);
}
const pips = (n) => Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');

/** Arma el HTML de la pantalla y engancha los eventos. `menu` = instancia de MenuUI (sound, root, back, list, focus, cur, wcol). */
export function buildHeroScreen(menu) {
  injectCss();
  const root = menu.root.querySelector('#loadout'); root.classList.add('hx');
  const WC = WEAPON_COLORS.map(hex); menu.wcol = WC; menu.cur = 1; menu.hxTab = 'sk';
  root.innerHTML = `
    <header class="hx-top"><button class="hx-back hx-nav" type="button" data-act="back" aria-label="Volver">‹ <span>Volver</span></button><h3 class="hx-title">Elegí tu héroe</h3><span class="hx-hint">Tocá un héroe para elegirlo · arrastrá para girarlo</span></header>
    <div class="hx-body">
      <nav class="hx-rail" id="hxrail" aria-label="Héroes">${CHARACTER_IDS.map((id) => { const c = CHARACTERS[id]; return `<button class="hx-hero hx-nav" type="button" data-ch="${id}" style="--c:${hex(c.color)}" aria-label="${c.name}"><span class="hx-gl">${GLYPHS[id]}</span><span class="hx-hn"><b>${c.name}</b><small>${ROLES[c.role].name}</small></span></button>`; }).join('')}</nav>
      <section class="hx-stage" id="hxstage">
        <div class="hx-bg"><div class="hx-bgglow"></div><div class="hx-bggl" id="hxbggl"></div><div class="hx-bgring"></div></div>
        <iframe id="hxview" class="hx-view" title="Vista del héroe" loading="lazy" tabindex="-1"></iframe>
        <div class="hx-info">
          <div class="hx-badge" id="hxbadge">Tu héroe</div>
          <h2 id="hxname"></h2><div class="hx-role" id="hxrole"></div>
          <p class="hx-lore hx-lore-st" id="hxlore"></p>
          <div class="hx-kit" id="hxkit"></div>
        </div>
      </section>
      <section class="hx-sheet">
        <div class="hx-tabs" id="hxtabs"><button class="hx-tab hx-nav on" type="button" data-tab="sk">Habilidades</button><button class="hx-tab hx-nav" type="button" data-tab="wp">Armas</button></div>
        <div class="hx-pane on" data-pane="sk">
          <p class="hx-lore hx-lore-sh" id="hxlore2"></p>
          <div class="hx-skills" id="hxskills"></div>
          <div class="hx-stats" id="hxstats"></div>
        </div>
        <div class="hx-pane" data-pane="wp">
          <h4 class="hx-sub">Tus armas <small>El Haz es fijo · elegí 4 · tocá una ranura y después un arma</small></h4>
          <div class="hx-slots" id="slotbar"></div>
          <div class="hx-wlist" id="wlist">${WEAPONS.map((w, i) => i === 0 ? '' : `<button class="hx-w hx-nav" type="button" data-w="${i}" style="--c:${WC[i % WC.length]}"><b>${w.name}</b><small>${KIND_ES[w.kind] || w.kind}</small></button>`).join('')}</div>
          <p class="hx-wdesc" id="wdesc"></p>
        </div>
      </section>
    </div>`;
  const $ = (s) => root.querySelector(s);
  // navegación con teclado/mando: sólo los elementos visibles de esta pantalla
  const baseList = menu.list.bind(menu), baseFocus = menu.focus.bind(menu);
  menu.list = (name = menu.screen) => (name === 'loadout' ? [...root.querySelectorAll('.hx-nav')].filter((e) => e.offsetParent !== null) : baseList(name));
  menu.focus = (i, silent) => { baseFocus(i, silent); if (menu.screen === 'loadout') { const el = menu.list()[menu.idx]; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } };
  const act = (fn) => (e) => { e.stopPropagation && e.stopPropagation(); fn(e); };
  $('[data-act=back]').addEventListener('click', act(() => menu.back()));
  root.querySelectorAll('.hx-hero').forEach((b) => {
    b.addEventListener('click', act(() => { const changed = Equipo.char !== b.dataset.ch; Equipo.char = b.dataset.ch; saveEquipo(); menu.sound.ui(changed ? 'ok' : 'tick'); menu.renderLoadout(); }));
    b.addEventListener('mouseenter', () => { if (menu.screen === 'loadout') { const i = menu.list().indexOf(b); if (i >= 0) menu.focus(i, true); } });
  });
  root.querySelectorAll('.hx-tab').forEach((b) => b.addEventListener('click', act(() => { menu.hxTab = b.dataset.tab; menu.sound.ui('tick'); menu.renderLoadout(); })));
  root.querySelectorAll('.hx-w').forEach((b) => {
    b.addEventListener('click', act(() => { assignWeapon(menu.cur, +b.dataset.w); $('#wdesc').textContent = WEAPONS[+b.dataset.w].desc || ''; menu.sound.ui('ok'); menu.renderLoadout(); $('#wdesc').textContent = WEAPONS[+b.dataset.w].desc || ''; }));
    b.addEventListener('mouseenter', () => { $('#wdesc').textContent = WEAPONS[+b.dataset.w].desc || ''; });
  });
  // el 3D descansa cuando la pantalla no se ve
  const view = $('#hxview'); menu.hxView = view;
  new MutationObserver(() => { const on = root.classList.contains('on'); try { view.contentWindow && view.contentWindow.postMessage({ hv: 1, pause: !on }, '*'); } catch { /* sin acceso */ } }).observe(root, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('message', (e) => { if (e.data && e.data.hv && e.data.ready) { root.classList.add('hx-3d'); if (e.data.ready !== Equipo.char) { try { view.contentWindow.postMessage({ hv: 1, char: Equipo.char }, '*'); } catch { /* ok */ } } } if (e.data && e.data.hv && e.data.failed) root.classList.remove('hx-3d'); });
}

/** Rellena la pantalla con el héroe elegido (Equipo.char). Se llama al entrar y en cada cambio. */
export function renderHeroScreen(menu) {
  const root = menu.root.querySelector('#loadout'), $ = (s) => root.querySelector(s);
  const id = Equipo.char, C = CHARACTERS[id], R = ROLES[C.role], col = hex(C.color), prevId = root.dataset.hero; root.dataset.hero = id;
  root.style.setProperty('--c', col);
  $('#hxname').textContent = C.name; $('#hxrole').innerHTML = `<i>${GLYPHS[id] ? '' : ''}</i>${R.name} · ${R.ability}`;
  $('#hxbggl').innerHTML = GLYPHS[id];
  const lore = HERO_LORE[id] || []; $('#hxlore').innerHTML = lore.map((l) => `<span>${l}</span>`).join(''); $('#hxlore2').innerHTML = lore.map((l) => `<span>${l}</span>`).join('');
  const sk = (icon, key, name, desc, cd, kind) => `<button class="hx-skill" type="button" data-play="${kind}"><span class="hx-ico">${ICONS[icon]}</span><span class="hx-st"><span class="hx-sn"><b>${name}</b><kbd>${key}</kbd></span><span class="hx-sd">${desc}</span><span class="hx-cd">Recarga ${cd} s</span></span></button>`;
  $('#hxskills').innerHTML = sk(C.mov.id, KEYS.mov, C.mov.name, C.mov.desc, C.mov.cd, 'cast') + sk(C.esp.id, KEYS.esp, C.esp.name, C.esp.desc, C.esp.cd, 'cast') + sk(ROLE_ICON[C.role], KEYS.tac, R.ability, R.desc.split('.').slice(0, 2).join('.').trim() + '.', R.cd, 'cast');
  root.querySelectorAll('.hx-skill').forEach((b) => { b.onclick = () => { try { menu.hxView && menu.hxView.contentWindow.postMessage({ hv: 1, play: 'cast' }, '*'); } catch { /* ok */ } menu.sound.ui('tick'); }; });
  const st = HERO_STATS[id] || [3, 3, 3, 3];
  $('#hxstats').innerHTML = `<h4 class="hx-sub">Estadísticas</h4>` + STAT_NAMES.map((n, i) => `<div class="hx-stat"><span>${n}</span><span class="hx-pips">${pips(st[i])}</span><em>${st[i]}/5</em></div>`).join('');
  root.querySelectorAll('.hx-hero').forEach((b) => { b.classList.toggle('sel', b.dataset.ch === id); b.setAttribute('aria-pressed', b.dataset.ch === id ? 'true' : 'false'); });
  root.querySelectorAll('.hx-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === menu.hxTab));
  root.querySelectorAll('.hx-pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === menu.hxTab));
  const WC = menu.wcol;
  $('#slotbar').innerHTML = Equipo.slots.map((w, i) => `<button class="hx-slot hx-nav ${i === 0 ? 'fix' : ''} ${i === menu.cur ? 'cur' : ''}" type="button" data-s="${i}" style="--c:${WC[w % WC.length]}"><span>${i + 1}</span><b>${WEAPONS[w].name}</b></button>`).join('');
  $('#slotbar').querySelectorAll('.hx-slot').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); if (+b.dataset.s > 0) { menu.cur = +b.dataset.s; menu.sound.ui('tick'); menu.renderLoadout(); } }));
  root.querySelectorAll('.hx-w').forEach((b) => b.classList.toggle('in', Equipo.slots.includes(+b.dataset.w)));
  $('#hxkit').innerHTML = `<span class="hx-kl">Armas</span>` + Equipo.slots.map((w, i) => `<span class="hx-chip${i === 0 ? ' fix' : ''}" style="--c:${WC[w % WC.length]}">${WEAPONS[w].name}</span>`).join('');
  $('#hxbadge').textContent = 'Tu héroe';
  if (prevId && prevId !== id) { const stg = $('#hxstage'); stg.classList.remove('swap'); void stg.offsetWidth; stg.classList.add('swap'); }
  // vista 3D: se crea una sola vez; después sólo se cambia de héroe por mensaje
  const view = $('#hxview');
  if (!view.dataset.k) {
    view.dataset.k = id; const coarse = matchMedia('(pointer: coarse)').matches, q = coarse ? 'low' : (window.__api && window.__api.level === 'low' ? 'low' : 'medium');
    const go = () => { view.src = new URL(`public/hero-view.html?char=${id}&q=${q}`, location.href.replace(/[^/]*$/, '')).href; };
    if (coarse) setTimeout(go, 500); else go();
  } else { try { view.contentWindow && view.contentWindow.postMessage({ hv: 1, char: id }, '*'); } catch { /* ok */ } }
  $('#wdesc').textContent = $('#wdesc').textContent || '';
}
