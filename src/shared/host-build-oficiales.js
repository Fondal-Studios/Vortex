// VISTA DE SOLO LECTURA de los Huéspedes OFICIALES para el editor (EH-15, docs/EDITOR_HUESPEDES.md §2.1 y §3.6).
// En E1 los 8 oficiales se pueden VER (con las anclas dibujadas encima) y usar sus acabados que ya existen. Nada más:
// no se cambia su silueta, ni sus proporciones, ni sus piezas, ni sus habilidades. Esta vista se GENERA de su definición
// (CHARACTERS + HOST_IDENTITY); no es formato de autoría, no se guarda y sale congelada (Object.freeze profundo).
import { CHARACTERS, HOST_IDS } from '../sim/data.js';
import { HOST_IDENTITY } from './identity.js';
import { FINISHES } from './cosmetics.js';
import { ANCLAS, ORDEN_ANCLAS, RIG } from './host-build-catalogo.js';

const congelar = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) congelar(o[k]); } return o; };
export const OFICIALES = Object.freeze([...HOST_IDS]);
export const esOficial = (id) => typeof id === 'string' && OFICIALES.includes(id);

/** Vista de un oficial → objeto congelado, o null si no es uno de los 8. Se genera en cada llamada (copias, nunca referencias a CHARACTERS). */
export function describirOficial(id) {
  if (!esOficial(id)) return null;
  const C = CHARACTERS[id], I = HOST_IDENTITY[id] || {};
  return congelar({
    schema: 'vortex.hostdef', v: 1, kind: 'official', id, rig: RIG,
    fuente: [`CHARACTERS.${id}`, `huesped/${id}.js`, `HOST_IDENTITY.${id}`],
    nombre: C.name, titulo: C.title, rol: C.role, etiqueta: 'Huésped oficial',
    locked: ['silueta', 'diseno', 'habilidades', 'proporciones'],
    personalizable: { acabado: true, paleta: false, anclas: [] },                                  // E1: solo los acabados que ya existen
    acabados: Object.entries(FINISHES).filter(([, f]) => f.channel === 'earned').map(([k, f]) => ({ id: k, nombre: f.name })),
    stats: { ...C.stats },                                                                           // descriptivas (data.js), no de combate
    habilidades: ['mov', 'esp', 's3', 'ult'].filter((k) => C[k]).map((k) => ({ ranura: k, id: C[k].id, nombre: C[k].name })),
    identidad: { rol: I.role || '', silueta: I.silhouette || '' },
    // Las anclas del rig se muestran para entender dónde se acoplarían piezas; en un oficial TODAS están bloqueadas.
    anclas: ORDEN_ANCLAS.map((a) => ({ id: a, nombre: ANCLAS[a].nombre, lados: ANCLAS[a].lados, huesos: { ...ANCLAS[a].huesos }, estado: 'bloqueada' })),
  });
}
/** Las 8 vistas, en el orden del juego. */
export const listarOficiales = () => OFICIALES.map(describirOficial);
