import { JEFES } from '../sim/jefe-data.js';
// Contrato de identidad: presentación, nunca estadísticas de combate.
export const GAME_IDENTITY = Object.freeze({ name: 'VORTEX', promise: 'Tu conciencia. Otro cuerpo. Una salida.', pitch: 'Habitá un genoma vivo, dominá una realidad rota y recuperá tu conciencia.', loop: ['Elegí tu huésped', 'Leé la arena', 'Superá la oleada y su objetivo', 'Derrotá al guardián'], rule: 'El espectáculo enmarca la acción; nunca la oculta.' });
export const ARENA_IDENTITY = {
  m1: { name: 'Vacío de Islas', motif: 'Órbitas suspendidas', cue: 'Portales entre islas', action: 'Usá los portales para cruzar; mirá el borde antes de saltar.', color: '#19f0ff', accent: '#ff3df2', shape: 3, rhythm: 0.35 },
  m2: { name: 'Cámara Fractal', motif: 'Espejo interior', cue: 'La pared también es suelo', action: 'Seguí la curvatura y aprovechá los períodos sin peso.', color: '#9b5cff', accent: '#ffb52e', shape: 6, rhythm: 0.22 },
  m3: { name: 'Laberinto Celestial', motif: 'Cristal y vigilancia', cue: 'Pasillos entre ojos', action: 'Buscá pasos abiertos entre muros; evitá quedar encerrado.', color: '#3dffb8', accent: '#e8fbff', shape: 4, rhythm: 0.28 },
  m4: { name: 'Jardín de Carne', motif: 'Genoma en crecimiento', cue: 'Puentes que germinan', action: 'Alimentá los capullos para abrir los puentes.', color: '#b6ff2a', accent: '#ff2f5e', shape: 5, rhythm: 0.42 },
  m5: { name: 'Plaza de los Ecos', motif: 'Memoria invertida', cue: 'Fuente que cae al cielo', action: 'Usá la plaza para orientarte y rodeá los grupos de enemigos.', color: '#ffcf4a', accent: '#5b8bff', shape: 8, rhythm: 0.18 },
  m6: { name: 'Osario sin Techo', motif: 'Catedral de respaldo', cue: 'Losas claras hacia el altar', action: 'Seguí la nave y las losas claras; cuidá tus flancos.', color: '#efe6c8', accent: '#ff6a14', shape: 12, rhythm: 0.16 },
};
// El objetivo toma el nombre real del jefe, nunca una copia histórica del menú.
for (const [id, arena] of Object.entries(ARENA_IDENTITY)) arena.goal = `Superá las oleadas y vencé a ${JEFES[id].nombre}.`;
export const HOST_IDENTITY = {
  axioma: { role: 'Vanguardia', verb: 'Entrá y cortá', silhouette: 'Hombros blindados y cuchillas', tip: 'Acortá la distancia y encadená cortes. Reservá la descarga para el grupo.', material: '#93a8bc' },
  vesper: { role: 'Cazadora', verb: 'Flanqueá y rematá', silhouette: 'Garras y perfil afilado', tip: 'Buscá un enemigo aislado; entrá, golpeá y reposicionate.', material: '#a193b7' },
  micelio: { role: 'Bastión', verb: 'Resistí y controlá', silhouette: 'Cuerpo ancho y crecimiento fúngico', tip: 'Controlá el espacio cercano con tus puños y esporas.', material: '#b5aa7c' },
  umbra: { role: 'Control', verb: 'Atravesá y desplazá', silhouette: 'Sudario suspendido', tip: 'Usá la movilidad dimensional para salir del cerco y atacar desde otro ángulo.', material: '#a096bd' },
  seraf: { role: 'Híbrido', verb: 'Mantené distancia', silhouette: 'Corona y filamentos luminosos', tip: 'Aprovechá el alcance del látigo; no te quedes rodeado.', material: '#c7b485' },
  colmena: { role: 'Invocadora', verb: 'Criá y dirigí', silhouette: 'Quitina y alas de enjambre', tip: 'Dejá que el enjambre presione mientras elegís tu siguiente posición.', material: '#b68c84' },
  danzante: { role: 'Duelista', verb: 'Marcá el ritmo', silhouette: 'Máscara y listones', tip: 'Alterná ataques y desplazamientos; aprovechá la parada y el compás.', material: '#c18baf' },
  singular: { role: 'Gravedad', verb: 'Agrupá y aplastá', silhouette: 'Masa central y satélites', tip: 'Juntá enemigos para aprovechar tus golpes y efectos de área.', material: '#a59bb9' },
};
export const CONTENT_GATES = Object.freeze({
  host: ['silueta', 'rol', 'material', 'feedback', 'costo', 'cosmeticos'],
  arena: ['orientacion', 'regla', 'objetivo', 'contraste', 'costo'],
  game: ['primera_partida', 'navegacion', 'accesibilidad', 'no_pay_to_win', 'regresion'],
});
// Evidencia obligatoria y nota mínima: no permite aprobar con un promedio alto.
export function evaluateGate(type, scores, evidence) {
  const keys = CONTENT_GATES[type];
  if (!keys) return { pass: false, missing: ['tipo'] };
  const missing = keys.filter(k => !Number.isFinite(scores?.[k]) || scores[k] < 7 || scores[k] > 10 || typeof evidence?.[k] !== 'string' || !evidence[k].trim());
  return { pass: missing.length === 0, missing };
}
