// Equipo del jugador: personaje + 4 armas elegidas (el Haz va siempre en la ranura 1). Se guarda en el navegador.
import { CHARACTER_IDS, WEAPONS } from '../sim/data.js';
import { poseeHuesped } from '../sim/tienda.js';
import { perfil, elegirInicial } from './perfil.js';
import { esElegibleInicial } from '../sim/desbloqueos.js';
const KEY = 'cristal.equipo.v1';
export const Equipo = { char: 'axioma', slots: [0, 1, 2, 3, 4] };
export const HUESPED_KEY = 'cristal.huesped.v1'; // el Huésped elegido en la pantalla de selección (src/client/huespedes-ui.js)
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && CHARACTER_IDS.includes(s.char)) { Equipo.char = s.char; if (Array.isArray(s.slots) && s.slots.length === 5) Equipo.slots = s.slots.map((w) => (w >= 0 && w < WEAPONS.length ? w : 0)); } } catch { /* sin almacenamiento */ }
try { const h = localStorage.getItem(HUESPED_KEY); if (h && CHARACTER_IDS.includes(h)) Equipo.char = h; } catch { /* sin almacenamiento */ }
export function saveEquipo() { try { localStorage.setItem(KEY, JSON.stringify(Equipo)); localStorage.setItem(HUESPED_KEY, Equipo.char); } catch { /* ok */ } }
/** Pone el arma `id` en la ranura `slot` (1..4); si ya estaba en otra ranura, se intercambian. La ranura 0 es siempre el Haz. */
export function assignWeapon(slot, id) {
  if (slot < 1 || slot > 4 || id === 0) return false;
  const j = Equipo.slots.indexOf(id), old = Equipo.slots[slot];
  if (j > 0) Equipo.slots[j] = old;
  Equipo.slots[slot] = id; saveEquipo(); return true;
}
/** Si el Huésped elegido no es tuyo (todavía no lo desbloqueaste), vuelve al Huésped inicial. Devuelve true si tuvo que cambiarlo.
 *  Sprint 1: un jugador NUEVO (sin Huésped inicial) no se toca acá: lo decide la pantalla «Elegí tu primer Huésped».
 *  `forzar` = entradas automáticas (?auto=, pruebas, enlaces directos a una partida): se le asigna el Huésped actual si es inicial (o Axioma) para no frenar el arranque. */
export function asegurarHuesped(forzar = false) {
  const p = perfil();
  if (!p.inicial) {
    if (!forzar) return false;
    elegirInicial(esElegibleInicial(Equipo.char) ? Equipo.char : 'axioma');
  }
  if (poseeHuesped(perfil(), Equipo.char)) return false;
  Equipo.char = perfil().inicial; saveEquipo(); return true;
}
asegurarHuesped();
