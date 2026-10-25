// DISEÑO ACTIVO del Laboratorio en este cliente (docs/EDITOR_HUESPEDES.md §3.4).
// El cuerpo del Híbrido Genómico (huesped-cuerpo.js, `char: 'laboratorio'`) no recibe el diseño dentro del jugador del snapshot (sólo viaja un índice corto `lb`):
// lo busca acá. Quien juega con un diseño (el Campo de pruebas, la partida solo, la red) lo registra con `setActivo` / `setDeSala`.
//   setActivo(build)          el diseño que dibuja MI Híbrido (partida individual y Campo de pruebas)
//   setDeSala(lb, build)      diseño de otro jugador de la sala, por su índice `lb` del snapshot (lo llena la capa de red)
//   buildDe(jugador)          → la build a dibujar para ese jugador del snapshot (o null: se dibuja el aspecto por defecto)
let activo = null; const sala = new Map();
export const setActivo = (b) => { activo = b || null; };
export const getActivo = () => activo;
export const setDeSala = (lb, b) => { if (b) sala.set(lb | 0, b); else sala.delete(lb | 0); };
export const limpiarSala = () => sala.clear();
export function buildDe(p) {
  if (p && p.labBuild) return p.labBuild;
  if (p && p.lb && sala.has(p.lb | 0)) return sala.get(p.lb | 0);
  return activo;
}
