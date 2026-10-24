// Dibujo del menú (docs/MENU.md): INICIO (botón enorme + 5 puertas), la BARRA SUPERIOR única (volver · pestañas de la sección · Modo · Gráficos · núcleos),
// los puntitos de aviso y la navegación espacial. Los datos viven en src/client/menu-nav.js (única fuente). ui.js recorre todo con teclado, mando, mouse o toque.
import { CHARACTERS } from '../sim/data.js';
import { PUERTAS, SECCIONES, SECCION_DE, tabActiva, continuarDe, avisos, avisosPuertas, rutaObjetivos } from './menu-nav.js';
import { Equipo } from './equipo.js';
import * as Perfil from './perfil.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ULTIMO = 'pacto.ultimo.v1';
export const guardarUltimo = (u) => { try { localStorage.setItem(ULTIMO, JSON.stringify(u)); } catch { /* sin almacenamiento */ } };
export const leerUltimo = () => { try { return JSON.parse(localStorage.getItem(ULTIMO) || 'null'); } catch { return null; } };

/** Iconos de línea (24×24, el color lo pone el texto): un solo lenguaje visual para todas las puertas. */
export const ICONOS = {
  base: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M10 20v-5.5h4V20"/></svg>',
  huesped: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.8-4 3.7-6 7.5-6s6.7 2 7.5 6"/><path d="M12 14v3"/></svg>',
  coleccion: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg>',
  coop: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="8.5" r="3"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M2.5 19c.6-3.4 3-5 6-5s5.4 1.6 6 5"/><path d="M15 14.2c3-.4 5.6.9 6.5 4.8"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8"/></svg>',
  jugar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
  mapa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>',
};

/** Dibuja el inicio: botón enorme + «Elegir partida» + las 5 puertas. */
export function buildMain(menu) {
  const main = menu.root.querySelector('#main'); if (!main) return;
  main.querySelector('#mainlist').innerHTML = PUERTAS.map((d) => `<button class="door" type="button" data-go="${d.go}" data-door="${d.id}" title="${esc(d.desc)}" style="--tint:${d.color}"><i class="dot" data-aviso-puerta="${d.id}" hidden></i><span class="door-ico">${ICONOS[d.icono] || ''}</span><span class="door-t"><b>${esc(d.titulo)}</b><small>${esc(d.desc)}</small></span></button>`).join('');
  main.querySelector('#continuar').addEventListener('click', (e) => { e.stopPropagation(); menu.continuar(); });
  const pr = main.querySelector('#proximo'); if (pr) pr.addEventListener('click', (e) => { e.stopPropagation(); if (pr.dataset.go) menu.go(pr.dataset.go); });
}

/** La barra superior única: Modo · Gráficos · núcleos (clic = Tienda). Las pestañas se dibujan en dibujarBarra(). */
export function buildBarra(menu) {
  const bar = menu.root.querySelector('#topbar'); if (!bar) return;
  const g = bar.querySelector('#tbgfx'); if (g) { g.innerHTML = ICONOS.ajustes; g.addEventListener('click', (e) => { e.stopPropagation(); menu.irTab({ go: 'graficos' }); }); }
  const s = bar.querySelector('#saldo'); if (s) s.addEventListener('click', (e) => { e.stopPropagation(); if (menu.screen !== 'tienda') menu.go('tienda'); });
}

/** Barra superior de la pantalla actual: se esconde en el título; en el inicio sólo muestra las herramientas; en una sección muestra sus pestañas (la activa resaltada, con puntito si hay aviso). */
export function dibujarBarra(menu, pantalla) {
  const bar = menu.root.querySelector('#topbar'); if (!bar) return;
  const visible = pantalla !== 'title'; bar.hidden = !visible; menu.root.dataset.barra = visible ? '1' : '0';
  const sid = SECCION_DE[pantalla], S = sid && SECCIONES[sid], tabs = bar.querySelector('#tbtabs'), sec = bar.querySelector('#tbsec');
  menu.root.dataset.tabs = S ? '1' : '0'; menu.root.dataset.sec = sid || '';
  if (sec) sec.textContent = S ? S.titulo : '';
  if (!S) { tabs.innerHTML = ''; tabs.hidden = true; delete tabs.dataset.sec; return; }
  tabs.hidden = false;
  const act = tabActiva(pantalla, { btab: menu.btab, ivtab: menu.iv && menu.iv.tab });
  if (tabs.dataset.sec !== sid) {
    tabs.dataset.sec = sid;
    tabs.innerHTML = S.tabs.map((t, i) => `<button class="tb-tab" type="button" role="tab" data-i="${i}"${t.aviso ? ` data-aviso="${t.aviso}"` : ''}><span>${esc(t.t)}</span><i class="dot" hidden></i></button>`).join('');
    tabs.querySelectorAll('.tb-tab').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); menu.sound.ui('tick'); menu.irTab(S.tabs[+b.dataset.i]); }));
  }
  tabs.querySelectorAll('.tb-tab').forEach((b, i) => { const on = i === act; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; if (on && b.scrollIntoView) { try { const t = tabs.getBoundingClientRect(), r = b.getBoundingClientRect(); if (r.left < t.left || r.right > t.right) tabs.scrollLeft += (r.left + r.right) / 2 - (t.left + t.right) / 2; } catch { /* sin medidas */ } } });
  pintarAvisosPestanas(menu);
  const marcaMas = () => tabs.classList.toggle('mas', tabs.scrollWidth > tabs.clientWidth + 2 && tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 4);   // sombra a la derecha = hay más pestañas
  marcaMas(); if (!tabs.dataset.sc) { tabs.dataset.sc = '1'; tabs.addEventListener('scroll', marcaMas, { passive: true }); addEventListener('resize', marcaMas); }
}
/** Puntitos de las pestañas (sólo donde hay algo útil por hacer). */
function pintarAvisosPestanas(menu) {
  let a; try { a = avisos(Perfil.perfil()); } catch { return; }
  const TXT = { huesped: 'Hay un Huésped que ya podés comprar', botin: 'Botín nuevo en el inventario', puntos: 'Puntos de progresión sin gastar', bendicion: 'Tenés una bendición para elegir', mision: 'Se abrió un territorio nuevo' };
  menu.root.querySelectorAll('#tbtabs .tb-tab[data-aviso]').forEach((b) => { const k = b.dataset.aviso, n = a[k] || 0, d = b.querySelector('.dot'); d.hidden = !n || b.classList.contains('on') && k === 'botin'; b.title = n ? TXT[k] : ''; });
}

/** Puntitos, núcleos, «Continuar» y «Próximo paso»: se recalcula cada vez que se entra al inicio (y al elegir Huésped o modo). */
export function refrescarInicio(menu) {
  let p; try { p = Perfil.perfil(); } catch { return; }
  const a = avisos(p), puertas = avisosPuertas(a), r = menu.root;
  r.querySelectorAll('[data-aviso-puerta]').forEach((d) => { const n = puertas[d.dataset.avisoPuerta] || 0; d.hidden = !n; d.title = n ? `${n} novedad${n === 1 ? '' : 'es'}` : ''; });
  const c = CHARACTERS[Equipo.char], u = continuarDe(leerUltimo(), c ? c.name : '', p.campaign);
  const cont = r.querySelector('#continuar'); if (cont) { cont.querySelector('b').textContent = u.titulo; cont.querySelector('small').textContent = u.sub; }
  const sal = r.querySelector('#saldo'); if (sal) sal.innerHTML = `<span>Núcleos</span><b>${p.cores}</b><i aria-hidden="true">◆</i>`;
  const hu = r.querySelector('[data-door="huespedes"] small'); if (hu && c) hu.textContent = `Ahora: ${c.name} · elegir, evolucionar, comprar`;
  const pr = r.querySelector('#proximo');
  if (pr) { const s = rutaObjetivos(p, 7).find((x) => !x.hecho); pr.hidden = !s; if (s) { pr.dataset.go = s.go; pr.querySelector('span').textContent = s.texto; } }
  pintarAvisosPestanas(menu);
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
