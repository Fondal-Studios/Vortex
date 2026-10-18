// PANTALLA «GRÁFICOS» (menú principal › Gráficos y botón en la Pausa): presets Baja / Media / Alta / Automático, resolución, interruptores con su costo,
// Claridad, medidor de FPS y «bajar sola si va lento». La lógica pura está en graficos.js (probada); acá sólo hay pantalla y conexión con el juego.
// Mismo lenguaje visual que territorios-ui.js / huespedes-ui.js (estilos: public/graficos.css). Táctil, ratón, teclado y mando: todo son botones grandes.
import * as GF from './graficos.js';
import { LEVELS, cfg, setOverrides, saveQuality, isTouchDevice } from './quality.js';
import { settings, setSetting } from './settings.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NIVEL_A_PRESET = { low: 'baja', medium: 'media', high: 'alta' };

/** Estado compartido con main.js (un solo panel en menú y otro en Pausa leen/escriben lo mismo). */
export const G = {
  e: GF.cargar(), equipo: { tactil: false, nucleos: 4 }, renderer: null, auto: null, nivel: 'high', banner: null, alNivel: null, fijadoPorUrl: false, paneles: [], medidor: null, autoUrl: true,
};
const equipoReal = () => ({ tactil: isTouchDevice(), nucleos: navigator.hardwareConcurrency || 4 });

/** ANTES de crear el Renderer: lee lo guardado, deja los cambios sobre el nivel en quality.js y devuelve el nivel inicial.
 *  Si la dirección trae ?q=baja|media|alta (low|medium|high) manda ella y no se aplican ajustes guardados (pruebas y herramientas). */
export function preparar(params = new URLSearchParams(location.search)) {
  G.equipo = equipoReal();
  const q = params.get('q');
  if (q && LEVELS[q]) { G.fijadoPorUrl = true; G.e = GF.elegirPreset(GF.cargar(), NIVEL_A_PRESET[q]); setOverrides(null); G.nivel = q; return q; }
  let e = GF.cargar();
  try { // migración: quien ya había elegido calidad con el selector viejo conserva su elección
    if (!localStorage.getItem(GF.KEY)) { const v = localStorage.getItem('cristal.calidad.v1'); if (v && NIVEL_A_PRESET[v]) e = GF.elegirPreset(e, NIVEL_A_PRESET[v]); }
  } catch { /* sin almacenamiento */ }
  G.e = e;
  const { nivel, ov } = GF.resolver(e, G.equipo);
  setOverrides(ov); G.nivel = nivel; return nivel;
}
/** DESPUÉS de crear el Renderer. `alNivel(nivel)` avisa a main.js que cambió el nivel base (selectores viejos, AutoQuality). */
export function conectar({ renderer, auto, banner, alNivel }) {
  Object.assign(G, { renderer, auto, banner, alNivel });
  if (auto) auto.enabled = G.fijadoPorUrl ? auto.enabled : !!G.e.auto && G.autoUrl;
  ponerMedidor(G.e.medidor);
}
export const fpsTope = () => cfg().fps || 60;

/** Aplica un estado nuevo: guarda, cambia lo que se puede en vivo y reconstruye sólo si hace falta. `claves`: ajustes que cambiaron (para saber si hay que reconstruir). */
export function aplicar(nuevo, claves = []) {
  const antes = G.nivel, e = GF.sanear(nuevo), { nivel, ov } = GF.resolver(e, G.equipo);
  G.e = e; GF.guardar(e); if (!G.fijadoPorUrl) saveQuality(nivel);
  setOverrides(ov); G.nivel = nivel;
  const R = G.renderer, soloLeer = claves.every((k) => k === 'fps' || k === 'lod');   // FPS y distancia de dibujo los lee el bucle en cada cuadro; medidor/auto no tocan el render
  if (R && !(soloLeer && nivel === antes)) {
    const rebuild = nivel !== antes || claves.some((k) => GF.OPCIONES[k] && !GF.OPCIONES[k].vivo) || claves.includes('preset');
    if (claves.length === 1 && claves[0] === 'escala' && nivel === antes) R.applyScale();
    else R.applyQuality(nivel, { rebuild });
  }
  if (G.auto && !G.fijadoPorUrl) G.auto.enabled = !!e.auto && G.autoUrl;
  if (G.alNivel && nivel !== antes) G.alNivel(nivel);
  ponerMedidor(e.medidor);
  refrescarTodo();
}
export const elegirPreset = (id) => aplicar(GF.elegirPreset(G.e, id), ['preset']);
export const ajustar = (id, v) => aplicar(GF.ajustar(G.e, id, v, G.equipo), [id]);
/** Para main.js: el nivel cambió por fuera (selector viejo, AutoQuality). Se refleja como preset sin reconstruir de nuevo. */
export function nivelCambiado(nivel, { guardar = true } = {}) {
  G.nivel = nivel; const e = GF.elegirPreset(G.e, NIVEL_A_PRESET[nivel]);
  if (guardar) { G.e = e; GF.guardar(e); } else G.e = { ...e, medidor: G.e.medidor };
  setOverrides(null); ponerMedidor(G.e.medidor); refrescarTodo();
}
/** Automático en Baja: baja la resolución de a poco (60 % es el piso). No se guarda. */
export function bajarEscalaAuto() {
  const act = GF.valorDe(G.e, 'escala', G.equipo), nueva = GF.escalaMasBaja(act); if (nueva == null) return false;
  const e = GF.ajustar(G.e, 'escala', nueva, G.equipo), { nivel, ov } = GF.resolver(e, G.equipo);
  G.e = e; setOverrides(ov); if (G.renderer) G.renderer.applyScale(); refrescarTodo();
  if (G.banner) G.banner(`Rendimiento bajo: resolución al ${nueva} %`, 2500); return true;
}

/* ───────── medidor de FPS (flotante, opcional) ───────── */
function ponerMedidor(on) {
  if (typeof document === 'undefined') return;
  if (!on) { if (G.medidor) { G.medidor.el.remove(); clearInterval(G.medidor.iv); G.medidor = null; } return; }
  if (G.medidor) return;
  const el = document.createElement('div'); el.id = 'fpsmeter'; el.setAttribute('aria-live', 'off'); document.body.appendChild(el);
  const pintar = () => { const f = Math.round(window.__fps || 0), t = fpsTope(); el.textContent = `${f} FPS`; el.dataset.c = GF.colorFps(f, t); document.querySelectorAll('.gr-fpsnow').forEach((n) => { n.textContent = `${f} FPS`; n.dataset.c = el.dataset.c; }); };
  pintar(); G.medidor = { el, iv: setInterval(pintar, 500) };
}

/* ───────── panel ───────── */
const barras = (c) => '▮'.repeat(c) + '▯'.repeat(3 - c);
function panelHtml() {
  const rec = GF.presetRecomendado(G.equipo);
  const presets = GF.PRESET_IDS.map((id) => {
    const P = GF.PRESETS[id];
    return `<button class="gr-card gr-nav" type="button" data-preset="${id}" role="radio" aria-checked="false"><span class="gr-ic" aria-hidden="true">${P.icono}</span><b>${esc(P.nombre)}</b><em>${esc(P.quien)}</em><span class="gr-d">${esc(P.desc)}</span><i class="gr-tag" hidden></i></button>`;
  }).join('');
  const fila = (O) => {
    const ctl = O.tipo === 'switch'
      ? `<button class="gr-opt gr-nav" type="button" data-op="${O.id}" data-v="true">Sí</button><button class="gr-opt gr-nav" type="button" data-op="${O.id}" data-v="false">No</button>`
      : O.pasos.map((p, i) => `<button class="gr-opt gr-nav" type="button" data-op="${O.id}" data-i="${i}">${esc(p.t)}</button>`).join('');
    return `<div class="gr-row" data-row="${O.id}"><div class="gr-info"><b>${esc(O.nombre)}</b><span class="gr-cost" data-c="${O.costo}" title="Cuánto pesa en el equipo">${barras(O.costo)} ${GF.COSTO_TXT[O.costo]}</span>${O.vivo ? '' : '<em class="gr-rebuild">⟳ reconstruye la escena</em>'}<small>${esc(O.nota)}</small></div><div class="gr-seg" role="group" aria-label="${esc(O.nombre)}">${ctl}</div></div>`;
  };
  const sec = (ids) => ids.map((id) => fila(GF.OPCIONES[id])).join('');
  return `<div class="gr-wrap">
    <header class="gr-head"><div><h2>Gráficos</h2><p class="gr-sum" data-sum></p></div><div class="gr-fpsnow" data-c="ok" title="FPS en este momento">— FPS</div></header>
    <h3 class="gr-h">Elegí cómo se ve</h3>
    <div class="gr-presets" role="radiogroup" aria-label="Preset de gráficos">${presets}</div>
    <p class="gr-rec" data-rec>Para tu equipo recomendamos <b>${esc(GF.PRESETS[rec].nombre)}</b>${G.equipo.tactil ? ' (es un equipo táctil: teléfono o tablet)' : ''}.</p>
    <h3 class="gr-h">Resolución</h3>
    <div class="gr-row gr-escala"><div class="gr-info"><b>Escala de resolución</b><span class="gr-cost" data-c="3" title="Cuánto pesa en el equipo">${barras(3)} mucho</span><small>Qué tan nítida es la imagen. 100 % es lo que trae el preset; bajarla es lo que más FPS te da en el teléfono. <span data-px></span></small></div>
      <div class="gr-slider"><button class="gr-step gr-nav" type="button" data-esc="-1" aria-label="Bajar resolución">−</button><input class="gr-range" type="range" min="${GF.ESCALA.min}" max="${GF.ESCALA.max}" step="${GF.ESCALA.paso}" aria-label="Escala de resolución" list="gr-marcas"><button class="gr-step gr-nav" type="button" data-esc="1" aria-label="Subir resolución">+</button><output class="gr-out" data-esc-out></output></div></div>
    <datalist id="gr-marcas"><option value="50"></option><option value="100"></option><option value="150"></option></datalist>
    <div class="gr-marcas" aria-hidden="true"><span>50 %</span><span>100 %</span><span>150 %</span></div>
    <h3 class="gr-h">Efectos <small>(cada uno dice cuánto pesa)</small></h3>
    ${sec(['sombras', 'bloom', 'postproc', 'nieblaAire', 'particulas', 'nieblasFx', 'humanos', 'decorado', 'lod', 'fps'])}
    <h3 class="gr-h">Ayudas</h3>
    <div class="gr-row" data-row="claridad"><div class="gr-info"><b>Claridad</b><span class="gr-cost" data-c="0">${barras(0)} casi nada</span><small>Más luz de relleno y borde de luz sobre el Huésped y los enemigos, para no perderlos entre los colores. «Alta» ayuda en pantallas chicas o con sol.</small></div><div class="gr-seg" role="group" aria-label="Claridad"><button class="gr-opt gr-nav" type="button" data-cl="normal">Normal</button><button class="gr-opt gr-nav" type="button" data-cl="alta">Alta</button></div></div>
    <div class="gr-row" data-row="medidor"><div class="gr-info"><b>Medidor de FPS</b><span class="gr-cost" data-c="0">${barras(0)} casi nada</span><small>Un numerito en la esquina con los cuadros por segundo. Verde: bien · ámbar: justo · rojo: va lento.</small></div><div class="gr-seg" role="group" aria-label="Medidor de FPS"><button class="gr-opt gr-nav" type="button" data-med="true">Sí</button><button class="gr-opt gr-nav" type="button" data-med="false">No</button></div></div>
    <div class="gr-row" data-row="auto"><div class="gr-info"><b>Bajar sola si va lento</b><span class="gr-cost" data-c="0">${barras(0)} casi nada</span><small>Si pasan 5 segundos seguidos con menos de 24 FPS, baja un escalón (y en Baja, la resolución de a poco). Apagalo si preferís que no toque nada.</small></div><div class="gr-seg" role="group" aria-label="Bajar sola si va lento"><button class="gr-opt gr-nav" type="button" data-auto="true">Sí</button><button class="gr-opt gr-nav" type="button" data-auto="false">No</button></div></div>
    <aside class="gr-nota"><b>¿Qué pesa más?</b><ul>${GF.NOTA_COSTOS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><p>Lo que elijas se guarda en este dispositivo. Los cambios con ⟳ reconstruyen la escena (se nota un instante).</p></aside>
    <div class="gr-acc"><button class="gr-btn gr-nav" type="button" data-reset>Restablecer a lo recomendado</button></div>
  </div>`;
}

/** Construye el panel dentro de `cont` y lo conecta. Devuelve { refrescar }. */
export function construirPanel(cont, { sonido = null } = {}) {
  cont.innerHTML = panelHtml();
  const $ = (s) => cont.querySelector(s), $$ = (s) => [...cont.querySelectorAll(s)];
  const tick = () => { try { sonido && sonido.ui && sonido.ui('tick'); } catch { /* sin sonido */ } };
  const parar = (f) => (ev) => { ev.stopPropagation(); tick(); f(ev); };
  $$('[data-preset]').forEach((b) => b.addEventListener('click', parar(() => elegirPreset(b.dataset.preset))));
  $$('[data-op]').forEach((b) => b.addEventListener('click', parar(() => {
    const O = GF.OPCIONES[b.dataset.op]; ajustar(O.id, O.tipo === 'switch' ? b.dataset.v === 'true' : O.pasos[+b.dataset.i].v);
  })));
  const rango = $('.gr-range');
  rango.addEventListener('input', (ev) => { ev.stopPropagation(); ajustar('escala', +rango.value); });
  $$('[data-esc]').forEach((b) => b.addEventListener('click', parar(() => ajustar('escala', GF.valorDe(G.e, 'escala', G.equipo) + (+b.dataset.esc) * GF.ESCALA.paso))));
  $$('[data-cl]').forEach((b) => b.addEventListener('click', parar(() => { setSetting('claridad', b.dataset.cl); if (G.renderer) G.renderer.applyClaridad(b.dataset.cl); refrescarTodo(); })));
  $$('[data-med]').forEach((b) => b.addEventListener('click', parar(() => aplicar(GF.conMedidor(G.e, b.dataset.med === 'true')))));
  $$('[data-auto]').forEach((b) => b.addEventListener('click', parar(() => aplicar(GF.conAuto(G.e, b.dataset.auto === 'true')))));
  $('[data-reset]').addEventListener('click', parar(() => { setSetting('claridad', 'normal'); if (G.renderer) G.renderer.applyClaridad('normal'); aplicar(GF.restablecer(G.e), ['preset']); }));
  const marcar = (b, on) => { b.classList.toggle('on', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
  function refrescar() {
    const e = G.e, { nivel, ov } = GF.resolver(e, G.equipo), fin = { ...LEVELS[nivel], ...ov }, rec = GF.presetRecomendado(G.equipo);
    $('[data-sum]').textContent = GF.resumen(e, G.equipo);
    $$('[data-preset]').forEach((b) => {
      const id = b.dataset.preset, sel = e.preset === id && !GF.personalizados(e), sel2 = e.preset === id;
      b.classList.toggle('sel', sel2); b.setAttribute('aria-checked', sel2 ? 'true' : 'false');
      const tag = b.querySelector('.gr-tag'); tag.hidden = !(sel2 || id === rec);
      tag.textContent = sel2 ? (sel ? 'Elegido' : 'Elegido + ajustes propios') : 'Recomendado para tu equipo';
      tag.dataset.k = sel2 ? 'sel' : 'rec';
    });
    for (const O of Object.values(GF.OPCIONES)) {
      const v = GF.valorDe(e, O.id, G.equipo), raiz = $(`[data-row="${O.id}"]`); if (!raiz) continue;
      const cambiado = O.id in e.ajustes; raiz.classList.toggle('mod', cambiado);
      if (O.tipo === 'switch') raiz.querySelectorAll('[data-v]').forEach((b) => marcar(b, (b.dataset.v === 'true') === !!v));
      else raiz.querySelectorAll('[data-i]').forEach((b) => { const p = O.pasos[+b.dataset.i]; marcar(b, p.v === v || (O.id === 'humanos' && p.v === v)); });
    }
    const esc_ = GF.valorDe(e, 'escala', G.equipo); rango.value = esc_; $('[data-esc-out]').textContent = esc_ + ' %';
    const dpr = (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1), pr = GF.pixelRatioDe(fin, dpr), w = Math.round((innerWidth || 0) * pr), h = Math.round((innerHeight || 0) * pr);
    $('[data-px]').textContent = `Ahora se dibuja a ≈ ${w} × ${h} px.`;
    $$('[data-cl]').forEach((b) => marcar(b, b.dataset.cl === (settings().claridad || 'normal')));
    $$('[data-med]').forEach((b) => marcar(b, (b.dataset.med === 'true') === !!e.medidor));
    $$('[data-auto]').forEach((b) => marcar(b, (b.dataset.auto === 'true') === !!e.auto));
    $('[data-reset]').disabled = !GF.personalizados(e) && e.preset === 'auto';
  }
  const p = { refrescar, cont }; G.paneles.push(p); refrescar(); return p;
}
export function refrescarTodo() { for (const p of G.paneles) { try { p.refrescar(); } catch { /* panel viejo */ } } }

/* ───────── pantalla del menú principal ───────── */
export function buildGraficosScreen(menu) {
  const root = menu.root.querySelector('#graficos'); if (!root) return;
  root.classList.add('gr');
  const cont = document.createElement('div'); cont.className = 'gr-host'; root.appendChild(cont);
  menu.gr = construirPanel(cont, { sonido: menu.sound });
}
export function showGraficos(menu) { if (menu.gr) { menu.gr.refrescar(); const c = menu.gr.cont; if (c.parentNode) c.parentNode.scrollTop = 0; } }

/* ───────── superposición dentro de la partida (botón de la Pausa) ───────── */
let over = null;
export function abrirEnPausa(sonido = null) {
  if (over) return;
  over = document.createElement('div'); over.id = 'graf-over'; over.className = 'ps gr'; over.setAttribute('role', 'dialog'); over.setAttribute('aria-label', 'Gráficos');
  over.innerHTML = '<button class="backbtn gr-back" type="button" aria-label="Volver a la pausa"><span aria-hidden="true">‹</span> Volver</button><div class="gr-scroll"><div class="gr-host"></div></div>';
  document.body.appendChild(over);
  const panel = construirPanel(over.querySelector('.gr-host'), { sonido });
  const cerrar = () => { if (!over) return; G.paneles = G.paneles.filter((x) => x !== panel); document.removeEventListener('keydown', onKey, true); over.remove(); over = null; };
  const onKey = (ev) => { if (ev.code === 'Escape') { ev.stopPropagation(); ev.preventDefault(); cerrar(); } };
  document.addEventListener('keydown', onKey, true);
  over.querySelector('.gr-back').addEventListener('click', (ev) => { ev.stopPropagation(); cerrar(); });
  over.addEventListener('click', (ev) => ev.stopPropagation());
  return panel;
}
export const cerrarPausa = () => { const b = over && over.querySelector('.gr-back'); if (b) b.click(); };
