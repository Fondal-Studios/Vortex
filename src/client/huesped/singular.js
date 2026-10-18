import { tools } from '../huesped-piezas.js';
import { addEvolution } from '../huesped-evo-piezas.js';
export const BELLY = 0;
export function build(ak, ctx) {
  const t = tools(ak); const evo = addEvolution(ak, ctx, { t });
  return { update: (dt, tt, c) => { evo.update(dt, tt, c); } };
}
