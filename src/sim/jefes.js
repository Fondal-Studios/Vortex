// FACHADA de los jefes: lo único que game.js y ai.js importan (docs/JEFES.md). Une la IA adaptativa (jefe-ia.js) con las mecánicas por fases (jefe-mec.js).
import { iaInit, iaTick, iaGolpe, iaMult, iaSnap, iaPista, iaMemoria } from './jefe-ia.js';
import { mecInit, mecTick, mecMult, mecGolpe, mecSnap, mecNucleo, mecBajo, mecMov, mecSilencio, mecAtrapado } from './jefe-mec.js';
import { JEFES, POSTURAS, FASE_UMBRALES } from './jefe-data.js';

/** Fuente del daño de un jugador: 'melee' | 'skill' | 'gun'. */
export const fuenteDanio = (g, by) => g.dmgSrc || (by && by.inMelee ? 'melee' : 'gun');

/** Nace el jefe: crea su IA y sus mecánicas. `g.jefeMem` (opcional) trae la memoria del intento anterior. */
export function jefeInit(g, m) { iaInit(g, m, g.jefeMem || null); mecInit(g, m); iaPista(g, m); }
/** Un paso del jefe (lo llama su comportamiento en ai.js antes de sus ataques de siempre). Devuelve la fase para los ataques viejos (1..3). */
export function jefeTick(g, m, dt) { if (!m.ia) jefeInit(g, m); iaTick(g, m, dt); mecTick(g, m, dt); return Math.min(3, m.mec.f); }
/** Multiplicador del daño recibido por el jefe (ventanas + adaptación). */
export function jefeMult(g, m, by) { if (!m.ia) return 1; const s = fuenteDanio(g, by); return Math.max(0.2, iaMult(g, m, s) * mecMult(g, m, s, by) * (1 + 1.5 * (m.ia.enr || 0))); }   // enfurecido = imprudente: recibe hasta +150 % (el enrage acelera el final, nunca lo alarga)
/** Anota un golpe (a cualquier criatura) para el perfil del jugador y aplica los efectos colaterales de las posturas. */
export function jefeGolpe(g, victim, by, dealt) {
  const b = g.boss; if (!b || b.dead || !b.ia || !by || !by.input) return;
  iaGolpe(g, b, by, victim, dealt);
  if (victim === b) mecGolpe(g, b, by, dealt, fuenteDanio(g, by));
}
/** Multiplicador de velocidad de un jugador (raíces del jefe). */
export const jefeVel = (g, p) => (mecAtrapado(g, p) ? 0.12 : 1);
export { mecMov as jefeMov, mecBajo as jefeBajo, mecNucleo as jefeNucleo, mecSilencio as jefeSilencio, iaMemoria as jefeMemoria, JEFES, POSTURAS, FASE_UMBRALES };

/** Resumen COMPACTO para el snapshot del jefe (lo dibuja la barra y las marcas del cliente). */
export function jefeSnap(m) {
  if (!m.ia) return {};
  const ia = iaSnap(m), me = mecSnap(m);
  return { ia, mc: me, f: m.mec.f };
}
