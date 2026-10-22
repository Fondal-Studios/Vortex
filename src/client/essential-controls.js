// Cuatro acciones visibles. Las acciones derivadas conservan las reglas del servidor.
export const HOLD_MS = 360;
export function essentialPower(mode, choice) {
  return ['esp', 's3', 'ability'].includes(choice) ? choice : mode === 'combo' ? 's3' : 'esp';
}
export function essentialActions(mode, context = {}, choice) {
  return ['fire', 'jump', context.use ? 'use' : essentialPower(mode, choice), 'mode', 'pause'];
}
export const thirdForMode = (mode) => mode === 'combo';

/** Una pulsación comienza inmediatamente; mantener agrega la alternativa, sin daño/cooldown extra. */
export function expandEssentialInput(input, held = {}, mode = 'shooter', power = essentialPower(mode)) {
  const out = { ...input };
  if (mode === 'combo' && input.a1 && held.fire >= HOLD_MS) { out.a1 = false; out.a2 = true; }
  if (input.jump && held.jump >= HOLD_MS) { out.jump = false; out.mov = true; }
  if (input[power] && held[power] >= HOLD_MS) { out[power] = false; out.ult = true; }
  return out;
}

/** Anclas/placas/capullos no requieren USAR. Nunca quitar el poder sólo por existir un objetivo. */
export function essentialInteraction(state, me, extra = {}) {
  if (!state || !me || me.dead) return false;
  const near = (p, r) => Array.isArray(p) && Math.hypot(p[0]-me.pos[0],p[1]-me.pos[1],p[2]-me.pos[2]) < r;
  return !!(extra.npc || extra.fauna || extra.flora ||
    (state.players || []).some(q=>q.id!==me.id && ((q.dead && near(q.pos,3)) || (q.carry && near(q.pos,2.8)))) ||
    (state.lt || []).some(o=>o[2]>=2 && (!o[6] || o[6]===me.id) && near([o[3],o[4],o[5]],4.6)));
}
