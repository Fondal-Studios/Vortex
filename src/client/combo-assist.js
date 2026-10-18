// Auto-golpe del modo Combo para novatos (ajuste «Modo simple»): con un enemigo cerca y de frente, el ATAQUE 1 se encadena solo.
// Función pura (sin DOM) para poder probarla en node: tests/combos.test.js. La habilidad y el ATAQUE 2 los decide siempre el jugador.
const norm3 = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };

/** ¿Hay un enemigo al alcance de A1? Cuerpo a cuerpo: ≤ 3,6 m + su radio y de frente. Seraf (flechas): cualquiera bajo la mira. */
export function comboTarget(state, me, onTarget = false) {
  if (!me || !state || !state.monsters) return false;
  if (me.char === 'seraf') return !!onTarget;
  const h = me.h || [0, 0, 1];
  for (const m of state.monsters) {
    if (m.c) continue;   // camuflado
    const d = [m.p[0] - me.pos[0], m.p[1] - me.pos[1], m.p[2] - me.pos[2]], l = Math.hypot(d[0], d[1], d[2]);
    if (l >= (m.r || 1) + 3.6) continue;
    const n = norm3(d[0], d[1], d[2]);
    if (n[0] * h[0] + n[1] * h[1] + n[2] * h[2] > 0.35) return true;
  }
  return false;
}
/** Pone `inp.a1` (mantenido: la simulación lo repite y encadena la cadena A1·A1·A1…). Devuelve true si ayudó. */
export function comboAssist(inp, state, me, { onTarget = false } = {}) {
  if (!me || me.dead || !me.md) return false;
  if (!comboTarget(state, me, onTarget)) return false;
  inp.a1 = true; return true;
}
