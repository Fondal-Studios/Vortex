// Pantalla «ELEGÍ TU CAMINO»: al evolucionar se muestran los DOS caminos del próximo nivel (excluyentes) con qué hacen y cómo cambia
// tu cuerpo. Tocar uno envía input.evo = 1 | 2 a la simulación. En solitario la partida se pausa mientras elegís.
import { EVO_PATHS, EVO_TIERS, CHARACTERS } from '../sim/data.js';

const VIS_TXT = { garras: 'te crecen garras y espolones', placas: 'placas quitinosas te cubren el cuerpo', tendones: 'tendones luminosos recorren tus piernas', nucleo: 'un núcleo late en tu pecho', fusion: 'tu arma se funde con tu brazo', canones: 'te brotan conductos en la espalda', alas: 'alas de membrana se abren detrás tuyo', grietas: 'grietas de vacío se abren en tu piel' };
const VIS_ICO = { garras: '🦴', placas: '🛡', tendones: '⚡', nucleo: '💠', fusion: '🗡', canones: '🎯', alas: '🪽', grietas: '🌀' };

export function createEvoChoice(host, { onOpen, onClose } = {}) {
  const el = document.createElement('div'); el.id = 'evochoice'; el.className = 'hidden';
  host.appendChild(el);
  let open = false, pick = 0, pickT = 0;
  const close = () => { open = false; el.classList.add('hidden'); if (onClose) onClose(); };
  const api = {
    get open() { return open; },
    /** Abrir con el estado del jugador del snapshot (me). Devuelve false si no hay nada que elegir. */
    show(me) {
      if (!me || !(me.evn > 0) || (me.co | 0) < me.evn) return false;
      const tier = (me.evo | 0) + 1, opts = EVO_PATHS[tier]; if (!opts) return false;
      const C = CHARACTERS[me.char] || {}, prev = (me.pth || []).map((id, i) => (EVO_PATHS[i + 1] || []).find((o) => o.id === id)).filter(Boolean);
      el.innerHTML = `<div class="ec-in"><h3>EVOLUCIÓN · NIVEL ${tier}: ${EVO_TIERS[tier].name.toUpperCase()}</h3>
        <p class="ec-sub">${C.name || ''} va a mutar. <b>Elegí UN camino: el otro se cierra para siempre.</b> Cuesta ${me.evn} núcleos (tenés ${me.co | 0}).</p>
        <div class="ec-opts">${opts.map((o, i) => `<button class="ec-opt" data-i="${i + 1}"><span class="ec-ico">${VIS_ICO[o.vis] || '✺'}</span><b>${o.name}</b><span class="ec-d">${o.desc}</span><span class="ec-v">Tu cuerpo: ${VIS_TXT[o.vis] || 'cambia'}</span></button>`).join('')}</div>
        ${prev.length ? `<p class="ec-prev">Tu camino hasta ahora: ${prev.map((o) => `<i>${o.name}</i>`).join(' → ')}</p>` : ''}
        <button class="ec-cancel">Ahora no</button></div>`;
      el.querySelectorAll('.ec-opt').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pick = +b.dataset.i; pickT = performance.now(); close(); }));
      el.querySelector('.ec-cancel').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); close(); });
      el.classList.remove('hidden'); open = true; if (onOpen) onOpen();
      return true;
    },
    close,
    /** Valor para input.evo: 1 o 2 durante ~0,4 s después de elegir; 0 el resto del tiempo. */
    value() { if (pick && performance.now() - pickT < 400) return pick; pick = 0; return 0; },
  };
  return api;
}
