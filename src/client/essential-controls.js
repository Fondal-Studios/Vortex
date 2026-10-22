// Cuatro acciones visibles. Las acciones derivadas conservan las reglas del servidor.
export const HOLD_MS = 360;
export function essentialPower(mode, choice) {
  return ['esp', 's3', 'ability'].includes(choice) ? choice : mode === 'combo' ? 's3' : 'esp';
}
export function essentialActions() {
  return ['fire', 'jump', 'use', 'mode', 'pause'];
}
export const thirdForMode = (mode) => mode === 'combo';

/** Beginner inputs have no hold alternatives. Advanced skills stay in the complete scheme. */
export function expandEssentialInput(input, held = {}, mode = 'shooter') {
  const out = { ...input };
  for (const key of ['a2','mov','esp','s3','ability','ult','dash','melee','ads','crouch','autoc']) out[key] = false;
  if (mode === 'combo') { out.a1 = !!(input.a1 || input.fire); out.fire = false; }
  else { out.fire = !!input.fire; out.a1 = false; }
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
