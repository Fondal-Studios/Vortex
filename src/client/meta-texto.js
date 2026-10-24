// Textos de la META actual del jugador (una línea arriba del HUD). Funciones PURAS sobre el snapshot: sin DOM, para poder probarlas.
import { TERRITORIOS, BENDICIONES, bendicionesDe } from '../sim/bendiciones.js';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v || 0)) * 100)} %`;

/** Meta del OBJETIVO de oleada en curso (ancla, sintonía, núcleo, cultivo). */
export function textoObjetivo(o, me) {
  if (!o) return '';
  const carga = me && me.carry;
  switch (o.type) {
    case 'ancla': return `Cargá el Ancla: quedate dentro del círculo (${pct(o.prog)})`;
    case 'sintonia': return `Pisá todas las placas a la vez (${pct(o.prog)})`;
    case 'nucleo': return carga ? 'Llevá el núcleo al altar' : (o.prog > 0.02 ? 'Llevá el núcleo al altar (alguien lo lleva)' : 'Recogé el núcleo y llevalo al altar');
    case 'cultivo': return 'Alimentá los capullos disparándoles hasta que florezcan';
    default: return o.title || 'Cumplí el objetivo';
  }
}

/**
 * La meta principal ahora mismo. Devuelve { main, next, kind } o null si no hay nada que decir (fin de partida).
 *  kind: 'espera' | 'mejora' | 'oleada' | 'objetivo' | 'jefe'. `next` = lo que viene después (texto corto).
 */
export function metaActual(state, me) {
  if (!state || state.state === 'won' || state.state === 'lost') return null;
  const w = state.wave || 0, W = state.waveTotal || 1, esJefe = w >= W && state.phase === 'wave';
  const tag = `Oleada ${Math.max(1, w)}/${W}`;
  if (state.phase === 'intermission') {
    if (me && me.cards && me.cards.length) return { kind: 'mejora', main: 'Elegí una mejora', next: w + 1 >= W ? 'Luego: el jefe' : `Luego: oleada ${w + 1}/${W}` };
    const sig = w + 1, jefe = sig >= W;
    if (!w) return { kind: 'espera', main: `Prepará tu Huésped · empieza en ${Math.ceil(state.intermission)} s`, next: 'Meta: sobrevivir cada oleada y vencer al jefe' };
    return { kind: 'espera', main: `Respiro · ${jefe ? 'viene el jefe' : `oleada ${sig}/${W}`} en ${Math.ceil(state.intermission)} s`, next: jefe ? 'Luego: derrotar al jefe' : 'Aprovechá: recogé munición y vida' };
  }
  if (esJefe) {
    const b = state.boss;
    return { kind: 'jefe', main: b ? `Derrotá a ${b.name} (${Math.max(0, Math.round(100 * b.hp / (b.max || 1)))} % de su vida)` : 'Derrotá al jefe', next: 'Luego: liberar el territorio' };
  }
  const quedan = state.left || 0;
  const o = state.obj && state.obj.state === 'active' ? state.obj : null;
  if (o) return { kind: 'objetivo', main: `${tag} · ${textoObjetivo(o, me)}`, next: quedan ? `Además: ${plural(quedan, 'criatura', 'criaturas')} en pie` : 'Luego: terminar con las criaturas' };
  return { kind: 'oleada', main: quedan ? `${tag} · Eliminá ${plural(quedan, 'criatura', 'criaturas')}` : `${tag} · Casi: ya no queda ninguna`, next: w + 1 >= W ? 'Luego: el jefe' : 'Luego: respiro y mejora' };
}

/** Marcador de la mini-misión secundaria de la oleada (o null). */
export function textoMision(mis) {
  if (!mis) return null;
  const base = { melee: `Golpe a golpe: matá ${mis.n} con melé`, intacto: 'Intocable: superá la oleada sin recibir daño', elite: 'Caza mayor: eliminá al élite (brilla distinto)', alimento: 'Alimentación: comé a la criatura RARA que brilla (USAR / E)' }[mis.k] || 'Misión';
  const cuenta = mis.k === 'melee' ? ` (${mis.p}/${mis.n})` : '';
  const premio = `+${mis.rc} núcleos`;
  if (mis.st === 'done') return { cls: 'done', txt: `✔ ${base.split(':')[0]} cumplida · ${premio}` };
  if (mis.st === 'failed') return { cls: 'fail', txt: `✖ ${base.split(':')[0]} perdida` };
  return { cls: '', txt: `★ Opcional · ${base}${cuenta} · ${premio}` };
}

/** Qué se gana al liberar un territorio (para selección de mapa y briefing). null si el mapa no es un territorio. */
export function metaMapa(mapId) {
  const t = TERRITORIOS[mapId]; if (!t) return null;
  const bs = bendicionesDe(mapId).map((id) => BENDICIONES[id].nombre);
  return { nombre: t.nombre, jefe: t.jefe, bendiciones: bs, texto: `Meta: vencé a ${t.jefe} y liberá ${t.nombre}. Premio: una bendición permanente a elegir (${bs.join(' o ')}).` };
}

/** Los pasos de la guía de primera partida (en orden), con su disparador. Textos cortos. */
export const PASOS_GUIA = [
  { id: 'meta', txt: '1/4 · Sobreviví: acabá con todas las criaturas de cada oleada. Tu meta actual siempre está arriba.' },
  { id: 'mejora', txt: '2/4 · Mejorá: al terminar cada oleada elegís una mejora de arma. Con los núcleos, tu Huésped evoluciona.' },
  { id: 'objetivo', txt: '3/4 · Objetivos: casi cada oleada trae uno (Ancla, placas, núcleo). La flecha te marca adónde ir.' },
  { id: 'jefe', txt: '4/4 · Jefe y territorio: la última oleada es un jefe. Vencerlo libera el territorio y te da una bendición.' },
];
