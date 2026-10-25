// Guion visual: se ve una fractura en el inicio; su significado se descubre junto a HERALDO.
import { CAMPAIGN_MEMORIES } from '../sim/campaign.js';
export const OPENING = {
 title: 'Despertar · señal fragmentada', motif: 'fracture',
 lines: [
  ['N', 'Otra vez esa luz. El mismo instante. Algo intenta hacerme entrar…', 5],
  ['N', 'Me estoy rompiendo. No sé qué queda del otro lado. Yo… quiero vivir.', 6],
  ['H', '¿Me escuchás? Soy HERALDO. La transferencia llegó a un Huésped. Podés moverte.', 6],
  ['N', 'No reconozco este cuerpo. Sacame de acá.', 4],
  ['H', 'Estás en VORTEX. Primero sobreviví. Después buscaremos una salida.', 5],
 ],
};
const visuals = {
 m1: ['Una señal responde', 'echo'], m3: ['Los que siguen adentro', 'prison'],
 m4: ['Un acuerdo entre mundos', 'bridge'], m5: ['El mismo recuerdo', 'shared'],
 m6: ['Dos voluntades', 'origin'], m2: ['La salida no es el final', 'exit'],
};
const leads = {
 m1: ['H', 'La señal viene del Laberinto. Si apagamos su vigilancia, podremos escucharla.', 5],
 m3: ['N', 'Entonces no estoy solo. Busquemos una forma de salir sin destruirlos a todos.', 5],
 m4: ['N', '¿Quién aceptó ese acuerdo? La grabación de la Plaza conserva una respuesta.', 5],
 m5: ['H', 'El Osario conserva el registro de entrada. Necesito saber por qué recuerdo tu vida.', 5],
 m6: ['N', 'Yo quiero sobrevivir. Vos querés completar la unión. Abramos el canal y decidamos por nosotros mismos.', 6],
 m2: ['H', 'Canal abierto. Otras conciencias siguen cautivas. Cruzar no termina lo que vinimos a hacer.', 6],
};
export const CHAPTER_FILMS = Object.freeze(Object.fromEntries(Object.entries(visuals).map(([id,[title,motif]]) => [id, {
 title, motif, arena: id, lines: [...CAMPAIGN_MEMORIES[id].lines.map(l=>[l[0],l[1],Math.max(l[2],Math.ceil(l[1].length/22))]), leads[id]],
}])));
export const filmDuration = film => film.lines.reduce((n,l)=>n+l[2]+.5,0)+2;
