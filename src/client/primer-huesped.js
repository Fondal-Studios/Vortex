// Pantalla «ELEGÍ TU PRIMER HUÉSPED» (Sprint 1 · docs/ONBOARDING.md): una sola vez, antes de la primera misión. Elegís UNO de los 3 iniciales;
// el resto se desbloquea con la campaña, los desafíos y la Tienda. Se guarda en el perfil (perfil.js › elegirInicial) y NO se cambia después.
import { INICIALES, fichaInicial } from '../sim/desbloqueos.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const retrato = (id) => new URL(`../../public/portraits/${id}.png`, import.meta.url).href;

/** Dibuja el selector y devuelve { cerrar }. `onElegir(id)` se llama al confirmar (ahí se guarda en el perfil y arranca la cinemática). */
export function mostrarPrimerHuesped({ sound = null, onElegir, root = document.body, preseleccion = null } = {}) {
  const el = document.createElement('div'); el.id = 'primerhuesped'; el.className = 'ph-root'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'ph-t');
  const fichas = INICIALES.map(fichaInicial).filter(Boolean); let sel = preseleccion && INICIALES.includes(preseleccion) ? preseleccion : null;
  el.innerHTML = `<h2 id="ph-t">Elegí tu primer Huésped</h2>
    <p class="ph-sub">Tu conciencia necesita un cuerpo para actuar dentro de VORTEX. Elegí con cuál empezás: es tu primer Huésped para siempre. Los demás se desbloquean jugando.</p>
    <div class="ph-cards" role="group" aria-label="Huéspedes iniciales">${fichas.map((f) => `<button type="button" class="ph-card" data-id="${f.id}" aria-pressed="false" style="--c:${hex(f.color)}">
      ${f.recomendado ? '<span class="ph-tag">Recomendado para empezar</span>' : ''}
      <div class="ph-img"><img src="${retrato(f.id)}" alt="Retrato de ${esc(f.nombre)}" loading="eager"></div>
      <h3>${esc(f.nombre)}<small>${esc(f.titulo)}</small></h3>
      <dl><dt>Rol</dt><dd>${esc(f.rol)} · dificultad ${esc(f.dificultad)}</dd><dt>Estilo y arma</dt><dd>${esc(f.estilo)}</dd><dt>Habilidad principal</dt><dd><b>${esc(f.principal.nombre)}</b>: ${esc(f.principal.texto)}</dd><dt>Su historia</dt><dd>${esc(f.historia)}</dd></dl></button>`).join('')}</div>
    <div class="ph-foot"><button type="button" class="ph-go" id="phgo" disabled>Elegí un Huésped</button>
    <p class="ph-note">Más adelante conseguís a los otros con la campaña (cada capítulo entrega uno), con desafíos y con núcleos en la Tienda. No hay compras con dinero real.</p></div>`;
  root.appendChild(el);
  const go = el.querySelector('#phgo'), cards = [...el.querySelectorAll('.ph-card')];
  const pintar = () => { cards.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.id === sel))); const f = fichas.find((x) => x.id === sel); go.disabled = !f; go.textContent = f ? `Empezar con ${f.nombre}` : 'Elegí un Huésped'; };
  const elegir = (id) => { sel = id; if (sound && sound.ui) sound.ui('tick'); pintar(); };
  cards.forEach((c) => c.addEventListener('click', (e) => { e.stopPropagation(); elegir(c.dataset.id); }));
  go.addEventListener('click', (e) => { e.stopPropagation(); if (!sel) return; if (sound && sound.ui) sound.ui('ok'); const id = sel; cerrar(); if (onElegir) onElegir(id); });
  const tecla = (e) => {
    if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { const i = Math.max(0, INICIALES.indexOf(sel)); elegir(INICIALES[(i + 1) % INICIALES.length]); e.preventDefault(); }
    else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { const i = sel ? INICIALES.indexOf(sel) : 0; elegir(INICIALES[(i + INICIALES.length - 1) % INICIALES.length]); e.preventDefault(); }
    else if (e.code === 'Enter' && sel && document.activeElement === document.body) { go.click(); e.preventDefault(); }
    e.stopPropagation();
  };
  addEventListener('keydown', tecla, true);
  function cerrar() { removeEventListener('keydown', tecla, true); el.remove(); }
  pintar(); (cards[0] || go).focus({ preventScroll: true });
  return { cerrar, el, elegir };
}
