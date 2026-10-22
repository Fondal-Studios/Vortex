// Bienvenida de la PRIMERA vez: 3 pasos (Elegí Huésped → Jugá → Volvé a la Base). Se salta con «Saltar» (o Esc) y no vuelve a salir.
// En pruebas automáticas (navigator.webdriver) no sale, salvo con ?bienvenida=1 (así los tests de navegador no chocan con el cartel).
const CLAVE = 'vortex.bienvenida.v1';
export const PASOS = [
  { n: '1', titulo: 'Elegí tu Huésped', texto: 'Tu conciencia habita un cuerpo de genoma humano e IA: el Huésped. Empezás con Axioma y lo cambiás cuando quieras en HUÉSPEDES.', extra: { go: 'huesped', t: 'Elegir ahora' } },
  { n: '2', titulo: 'Jugá', texto: 'En Historia, vencé al Coloso para recuperar tu identidad y a la Madre Geoda para abrir la salida de VORTEX. El objetivo actual aparece arriba.' },
  { n: '3', titulo: 'Volvé a la Base', texto: 'Entre incursiones, mejorá tu Huésped en la Base. No necesitás dominar todos sus sistemas para volver a combatir.' },
];
export function debeSaludar(search = location.search, vio = null) {
  if (/[?&]bienvenida=1/.test(search)) return true;
  if (/[?&]bienvenida=0/.test(search)) return false;
  let visto = vio; if (visto === null) { try { visto = !!localStorage.getItem(CLAVE); } catch { visto = false; } }
  if (visto) return false;
  return !(typeof navigator !== 'undefined' && navigator.webdriver);
}
const marcarVisto = () => { try { localStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento */ } };

/** Crea el cartel dentro del menú y devuelve { abrir, cerrar, abierto, siguiente }. */
export function crearBienvenida(menu) {
  const el = document.createElement('div'); el.id = 'bienvenida'; el.className = 'bv'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'bvt');
  el.innerHTML = '<div class="bv-box"><p class="bv-paso" id="bvp"></p><h2 id="bvt"></h2><p id="bvx"></p><div class="bv-dots" aria-hidden="true"><i></i><i></i><i></i></div><div class="bv-btns"><button type="button" class="bv-skip" id="bvskip">Saltar</button><button type="button" class="bv-extra" id="bvextra" hidden></button><button type="button" class="bv-next" id="bvnext">Siguiente ›</button></div></div>';
  menu.root.appendChild(el);
  const $ = (id) => el.querySelector('#' + id); let i = 0;
  const pintar = () => {
    const P = PASOS[i]; $('bvp').textContent = `Paso ${P.n} de ${PASOS.length}`; $('bvt').textContent = P.titulo; $('bvx').textContent = P.texto;
    el.querySelectorAll('.bv-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    const ex = $('bvextra'); ex.hidden = !P.extra; if (P.extra) ex.textContent = P.extra.t;
    $('bvnext').textContent = i === PASOS.length - 1 ? '¡Listo!' : 'Siguiente ›';
  };
  const B = { abierto: () => !el.hidden };
  B.cerrar = (ir) => { if (el.hidden) return; el.hidden = true; marcarVisto(); menu.refocus && menu.refocus(); if (ir) menu.go(ir); };
  B.siguiente = () => { if (i >= PASOS.length - 1) return B.cerrar(); i++; menu.sound.ui('tick'); pintar(); };
  B.abrir = () => { i = 0; pintar(); el.hidden = false; $('bvnext').focus({ preventScroll: true }); };
  $('bvnext').addEventListener('click', (e) => { e.stopPropagation(); B.siguiente(); });
  $('bvskip').addEventListener('click', (e) => { e.stopPropagation(); menu.sound.ui('back'); B.cerrar(); });
  $('bvextra').addEventListener('click', (e) => { e.stopPropagation(); const P = PASOS[i]; B.cerrar(P.extra && P.extra.go); });
  return B;
}
