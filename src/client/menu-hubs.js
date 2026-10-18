// Menú principal en CUATRO puertas (JUGAR · MI HUÉSPED · MUNDO · AJUSTES) + «Continuar», migas de pan, saldo y puntitos de aviso.
// Dibuja el inicio y los 4 «hubs» desde src/client/menu-nav.js (única fuente) y los deja listos para que ui.js los recorra con teclado, mando, mouse o toque.
import { CHARACTERS } from '../sim/data.js';
import { PUERTAS, HUBS, migas, continuarDe, avisos, avisosPuertas, rutaObjetivos } from './menu-nav.js';
import { Equipo } from './equipo.js';
import { settings } from './settings.js';
import * as Perfil from './perfil.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ULTIMO = 'pacto.ultimo.v1';
/** Las imágenes de las tarjetas van como variable CSS: se pasan a dirección completa porque ahí las rutas relativas se leen desde el .css, no desde la página. */
const url = (u) => `url('${new URL(u, document.baseURI).href}')`;
export const guardarUltimo = (u) => { try { localStorage.setItem(ULTIMO, JSON.stringify(u)); } catch { /* sin almacenamiento */ } };
export const leerUltimo = () => { try { return JSON.parse(localStorage.getItem(ULTIMO) || 'null'); } catch { return null; } };

/** Dibuja la pantalla de inicio: marca, botón Continuar y las 4 puertas. */
export function buildMain(menu) {
  const main = menu.root.querySelector('#main'); if (!main) return;
  main.querySelector('#mainlist').innerHTML = PUERTAS.map((d) => `<button class="door" type="button" data-go="${d.hub}" data-door="${d.id}" title="${esc(d.desc)}" style="--art:${url(d.art)}"><i class="dot" data-aviso-puerta="${d.id}" hidden></i><span class="door-t"><b>${esc(d.titulo)}</b><small>${esc(d.desc)}</small></span></button>`).join('');
  main.querySelector('#continuar').addEventListener('click', (e) => { e.stopPropagation(); menu.continuar(); });
}

/** Crea las 4 pantallas «hub» dentro del menú. */
export function buildHubs(menu) {
  for (const [id, H] of Object.entries(HUBS)) {
    const sec = menu.root.querySelector('#' + id); if (!sec) continue; sec.classList.add('hub');
    const extra = id === 'hub-jugar' ? `<button id="modeitem" class="modebar" type="button" data-hero="modo" data-mode="shooter" title="Shooter: disparás y apuntás. Combo: el cuerpo a cuerpo manda, con dos ataques encadenados y una habilidad."><span class="mb-l"><b>Modo de juego: Shooter</b><small>Disparás, apuntás y usás habilidades</small></span><span class="mb-pills" aria-hidden="true"><i data-m="shooter">Shooter</i><i data-m="combo">Combo</i></span></button>` : '';
    const estado = id === 'hub-huesped' ? '<div class="hub-status" id="hubstatus" aria-live="polite"></div>' : '';
    const ruta = id === 'hub-jugar' ? '<section class="ruta-obj" aria-label="Ruta de objetivos"><h4>Tu ruta</h4><div id="rutaobj" class="ruta-list"></div></section>' : '';
    sec.innerHTML = `<h3 class="stitle">${esc(H.titulo)}</h3><p class="hub-sub">${esc(H.sub)}</p>${extra}${estado}
      <div class="hubgrid" data-n="${H.items.length}">${H.items.map((it) => `<button class="hubcard" type="button" data-go="${it.go}" title="${esc(it.desc)}" style="--art:${url(it.art)}"><i class="dot" ${it.aviso ? `data-aviso="${it.aviso}"` : ''} hidden></i><b>${esc(it.titulo)}</b><small>${esc(it.desc)}</small>${it.saldo ? '<em class="hc-saldo" data-saldo></em>' : ''}</button>`).join('')}</div>${ruta}`;
  }
}

/** Puntitos de aviso, saldo, Continuar, estado del Huésped y ruta: se recalcula cada vez que se entra a una pantalla del inicio. */
export function refrescarInicio(menu) {
  let p; try { p = Perfil.perfil(); } catch { return; }
  const a = avisos(p), puertas = avisosPuertas(a), r = menu.root;
  r.querySelectorAll('[data-aviso-puerta]').forEach((d) => { const n = puertas[d.dataset.avisoPuerta] || 0; d.hidden = !n; d.title = n ? `${n} novedad${n === 1 ? '' : 'es'}` : ''; });
  const TXT = { botin: 'Botín nuevo en el inventario', puntos: 'Puntos de progresión sin gastar', huesped: 'Hay un Huésped que ya podés comprar', tienda: 'Stock nuevo en la Tienda', bendicion: 'Tenés una bendición para elegir', mision: 'Se abrió un territorio nuevo' };
  r.querySelectorAll('.hubcard [data-aviso]').forEach((d) => {
    const k = d.dataset.aviso, n = k === 'tienda' ? a.tienda + a.huesped : a[k] || 0; d.hidden = !n; d.title = n ? (k === 'tienda' && a.huesped ? TXT.huesped : TXT[k]) : '';
  });
  const c = CHARACTERS[Equipo.char], u = continuarDe(leerUltimo(), c ? c.name : ''), modo = settings().mode === 'combo' ? 'modo Combo' : 'modo Shooter';
  const cont = r.querySelector('#continuar'); if (cont) { cont.querySelector('b').textContent = u.titulo; cont.querySelector('small').textContent = `${u.sub} · ${modo}`; }
  const sal = r.querySelector('#saldo'); if (sal) sal.innerHTML = `<span>Tus núcleos</span><b>${p.cores}</b><i aria-hidden="true">◆</i>`;
  r.querySelectorAll('[data-saldo]').forEach((e) => { e.textContent = `Tenés ${p.cores} núcleos`; });
  const st = r.querySelector('#hubstatus');
  if (st && c) { const mr = Perfil.rangoMaestria(Equipo.char), evo = p.evo[Equipo.char] || 0; st.innerHTML = `<span class="hs-dot" style="background:#${c.color.toString(16).padStart(6, '0')}"></span><b>Tu Huésped: ${esc(c.name)}</b> <small>${esc(c.title || '')} · evolución ${evo}/4 · maestría ${mr}</small>`; }
  const rr = r.querySelector('#rutaobj');
  if (rr) rr.innerHTML = rutaObjetivos(p).map((s) => `<button class="rstep${s.hecho ? ' ok' : ''}" type="button" data-go="${s.go}"><i aria-hidden="true">${s.hecho ? '✓' : '○'}</i><span>${esc(s.texto)}</span></button>`).join('');
  // los pasos de la ruta se crean cada vez: se les engancha el clic acá
  rr && rr.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); menu.go(b.dataset.go); }));
}

/** Migas de pan clicables: «Inicio › Mi Huésped › Inventario». En Inicio y en el título no se muestran. */
export function dibujarMigas(menu, pantalla) {
  const el = menu.root.querySelector('#crumbs'); if (!el) return;
  const m = migas(pantalla); el.hidden = m.length < 2; if (m.length < 2) { el.innerHTML = ''; return; }
  el.innerHTML = m.map((x, i) => (i === m.length - 1 ? `<span class="cr-now" aria-current="page">${esc(x.nombre)}</span>` : `<button type="button" class="cr-go" data-cr="${x.id}">${esc(x.nombre)}</button><i aria-hidden="true">›</i>`)).join('');
  el.querySelectorAll('[data-cr]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); menu.saltar(b.dataset.cr); }));
}

/** Navegación espacial: de todos los elementos, el más cercano en esa dirección (arriba/abajo/izq./der.), para rejillas, pestañas y paneles. -1 si no hay. */
export function vecino(list, idx, dir) {
  const cur = list[idx]; if (!cur) return -1;
  const rc = cur.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2; let best = -1, bs = Infinity;
  list.forEach((e, i) => {
    if (i === idx) return; const r = e.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return; const x = r.left + r.width / 2, y = r.top + r.height / 2, dx = x - cx, dy = y - cy;
    const ok = dir === 'down' ? dy > rc.height * 0.25 : dir === 'up' ? dy < -rc.height * 0.25 : dir === 'right' ? dx > rc.width * 0.25 : dx < -rc.width * 0.25; if (!ok) return;
    const main = dir === 'down' || dir === 'up' ? Math.abs(dy) : Math.abs(dx), cross = dir === 'down' || dir === 'up' ? Math.abs(dx) : Math.abs(dy), s = main + cross * 2.2;
    if (s < bs) { bs = s; best = i; }
  });
  return best;
}
