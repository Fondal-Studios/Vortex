// Cliente del «Limbo vivo» (docs/MUNDO_VIVO.md): NPC del respiro, afijos de élite y linajes de armas.
// La parte pura (sin THREE ni DOM) se prueba en tests/mundo-cliente.test.js; el panel usa DOM sólo al crearse.
import { NPC_INFO, NPC_KINDS } from '../sim/npcs.js';
import { AFFIXES, LINEAGE } from '../sim/data.js';

export const NPC_RANGE = 7; // misma distancia que valida la simulación (npcStep: dist < 7)
export const NPC_COLORS = { cambista: 0xffd45a, sanadora: 0x7dffb0, herrero: 0xff9a5a };

const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** El NPC más cercano a menos de `range` del jugador (objs del snapshot con t === 'npc'), o null. */
export function npcNear(state, me, range = NPC_RANGE) {
  if (!state || !me || me.dead || !me.pos) return null;
  let best = null, bd = range;
  for (const o of state.objs || []) { if (o.t !== 'npc' || !NPC_INFO[o.nk]) continue; const d = d3(o.p, me.pos); if (d < bd) { bd = d; best = o; } }
  return best;
}

/** Datos de pantalla del afijo de una élite: { id, name, color, label } o null si no tiene. */
export function affixInfo(af) {
  const a = af && AFFIXES[af]; if (!a) return null;
  return { id: af, name: a.name, color: a.color, label: a.name.toUpperCase() };
}
export const hexCss = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);

/** Linaje del arma actual del jugador (snapshot: sl = ranuras, ug[i][5] = forma, w = arma en mano): { id, name, color } o null. */
export function lineageOf(me) {
  if (!me || !Array.isArray(me.sl) || !Array.isArray(me.ug)) return null;
  const i = me.sl.indexOf(me.w), u = i >= 0 ? me.ug[i] : 0, id = Array.isArray(u) ? u[5] : null, f = id && LINEAGE.forms[id];
  return f ? { id, name: f.name, color: f.color } : null;
}
/** Estilo del viewmodel para un linaje: tinte, intensidad del halo y hacia dónde se van las brasas (alba sube, ocaso cae). */
export function lineageStyle(id) {
  const f = LINEAGE.forms[id]; if (!f) return null;
  return { color: f.color, glow: id === 'alba' ? 0.55 : 0.45, ember: id === 'alba' ? 1 : -1, rate: id === 'alba' ? 0.11 : 0.15 };
}

/** Texto del resultado de un trato (evento npcdeal: { kind, offer, ok }). */
export function dealText(e) {
  const info = NPC_INFO[e && e.kind]; if (!info) return 'No pasó nada.';
  const of = e.offer === 2 && info.forja ? info.forja[0] : info.offers[e.offer === 1 ? 1 : 0];
  return e.ok ? `Trato hecho con ${info.name}: ${of.text}.` : `No pudo ser (${of.cost}). Revisá si te alcanza o si ya no es el momento.`;
}

/** Panel de ofertas. onClose opcional. `take()` entrega el pedido UNA sola vez (la simulación repite el trato si el input se mantiene). */
export function createNpcPanel(host, { onToggle } = {}) {
  const el = document.createElement('div'); el.id = 'npcpanel'; el.className = 'hidden'; host.appendChild(el);
  const hint = document.createElement('div'); hint.id = 'npchint'; hint.className = 'hidden'; host.appendChild(hint);
  let open = false, kind = null, pending = null, msgT = 0;
  const stop = (e) => e.stopPropagation();
  for (const t of ['mousedown', 'mouseup', 'pointerdown', 'touchstart']) el.addEventListener(t, stop);
  const close = () => { if (!open) return; open = false; el.classList.add('hidden'); if (onToggle) onToggle(false); };
  const choose = (n) => { if (!open || (n !== 0 && n !== 1 && !(n === 2 && NPC_INFO[kind] && NPC_INFO[kind].forja))) return false; pending = { offer: n }; return true; };
  const api = {
    get open() { return open; },
    get kind() { return kind; },
    show(k) {
      const info = NPC_INFO[k]; if (!info) return false; kind = k; open = true;
      el.innerHTML = `<div class="np-in"><h3>${info.name}</h3><p class="np-says">«${info.says}»</p>
        <div class="np-offers">${[...info.offers, ...(info.forja || [])].map((o, i) => `<button class="np-offer" data-i="${i}" type="button"><kbd>${i + 1}</kbd><span>${o.text}</span><em>${o.cost}</em></button>`).join('')}</div>
        <p class="np-msg" id="npmsg"></p><button class="np-close" type="button">Irme</button></div>`;
      el.querySelectorAll('.np-offer').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); choose(+b.dataset.i); }));
      el.querySelector('.np-close').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); close(); });
      el.classList.remove('hidden'); if (onToggle) onToggle(true); return true;
    },
    close, choose,
    /** Pedido para input.npc: { offer } una vez, después null. */
    take() { const p = pending; pending = null; return p; },
    result(e) { const m = el.querySelector('#npmsg'); if (!m) return; m.textContent = dealText(e); m.className = 'np-msg ' + (e.ok ? 'ok' : 'no'); msgT = performance.now(); },
    /** Cartel «E · hablar» mientras hay un NPC cerca (touch: el botón USAR ya aparece solo). */
    setHint(info, touch) {
      if (!info || open) { hint.classList.add('hidden'); return; }
      hint.textContent = touch ? `${info.name}: tocá USAR` : `[E] Hablar con ${info.name}`; hint.classList.remove('hidden');
    },
  };
  void msgT;
  return api;
}
export { NPC_INFO, NPC_KINDS };
