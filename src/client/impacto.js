// AC-07 · SONIDO DE IMPACTO SOLO CON COLISIÓN CONFIRMADA.
// La simulación es la única que sabe si un ataque dio en algo: emite `hit` (daño aplicado a una criatura/jefe), `arhit` (daño a un órgano
// de arena viva) y, en las habilidades de área, `boom` / `orbburst` con `hit` = cuántos blancos tocó. Un barrido o un disparo que no
// toca nada NO produce ninguno de esos eventos con blancos, así que no suena a golpe (sólo el «whoosh» corto de audio.melee).
// Este módulo es la única puerta por la que main.js convierte eventos de la simulación en sonidos de impacto; tests/impacto.test.js la cubre.

/** ¿El evento describe un contacto real? Sin campo `hit` (explosiones de proyectil, de flora…) la propia colisión ya es el evento. */
export function contactoConfirmado(e) {
  if (!e) return false;
  if (e.t === 'hit' || e.t === 'arhit') return e.d === undefined || e.d > 0;
  if (e.t === 'boom' || e.t === 'orbburst') return e.hit === undefined || e.hit > 0;
  // Un swing/combo sin recuento explícito nunca demuestra contacto.
  if (e.t === 'melee' || e.t === 'combo') return Number.isFinite(e.hit) && e.hit > 0;
  return false;
}

/** ¿Este cuadro trae un golpe cuerpo a cuerpo (`melee`/`combo`) con contacto confirmado? Su capa de audio (combo-fx / hostfx-melee) ya pone EL impacto del golpe. */
export function hayMeleeConfirmado(events) {
  if (!events) return false;
  for (const e of events) if ((e.t === 'melee' || e.t === 'combo') && e.hit > 0) return true;
  return false;
}

/** Reproduce el sonido de impacto de un evento de la simulación. Devuelve true si sonó.
 *  `meleeCubre` (= hayMeleeConfirmado del cuadro): el daño de un golpe cuerpo a cuerpo (`hit` con src 'melee') NO suena aparte, porque el golpe ya trae su impacto
 *  (un golpe = un impacto, aunque alcance a varias criaturas). */
export function sonarImpacto(sound, e, meleeCubre = false) {
  if (!sound || !contactoConfirmado(e)) return false;
  if (e.t === 'hit' && e.src === 'melee' && meleeCubre) return false;
  if (e.t === 'hit' || e.t === 'arhit') { sound.hit(e.p); return true; }
  if (e.t === 'boom' || e.t === 'orbburst') { sound.boom(e.p); return true; }
  return false;
}
