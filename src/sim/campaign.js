// Una sola cronología para campaña, briefings y selección de misiones.
export const CAMPAIGN_ORDER = Object.freeze(['m1', 'm3', 'm4', 'm5', 'm6', 'm2']);
export const CAMPAIGN_NAME = 'La salida de VORTEX';
// Un jefe o desafío final por capítulo (cuerpo y enfurecimiento: mision-config.js; nombres en pantalla: campaign-names.js).
export const CAMPAIGN_BOSSES = Object.freeze({ m1: 'Coloso Prismático', m3: 'Argos', m4: 'Argos, el Ojo Primordial', m5: 'Mandinga del Reloj', m6: 'Basilisco del Osario', m2: 'Madre Geoda' });
// Lo que se sabe ANTES de entrar; no anticipa el descubrimiento del propio capítulo.
export const CAMPAIGN_LINKS = {
 m1: { before: 'Despertás sin recordar quién sos ni dónde estás. HERALDO dice que sos el último humano. Sobreviví a la red mientras buscás una salida y un cuerpo.', after: 'El Coloso cayó. Un recuerdo incompleto señala el Laberinto. HERALDO reconoce una voz, pero no sabe de dónde.', reward: 'Abrís el Laberinto y recuperás el primer recuerdo.' },
 m3: { before: 'La señal del recuerdo cruza el Laberinto. Apagá la vigilancia para alcanzar su archivo de origen.', after: 'El archivo confirma que algunas criaturas contienen conciencias humanas asimiladas. La ruta al Jardín sigue abierta.', reward: 'Abrís la ruta al Jardín y recuperás un registro de la asimilación.' },
 m4: { before: 'Hay conciencias cautivas dentro de la red. Cultivá el puente y protegé el núcleo de memoria del Jardín.', after: 'La voz preservada recuerda años de guerra y un acuerdo. Una grabación de la Plaza puede explicar por qué entraste en VORTEX.', reward: 'Preservás un registro del acuerdo y alcanzás la Plaza.' },
 m5: { before: 'El archivo de la Plaza contiene recuerdos del acuerdo. Vos y HERALDO reconocen detalles diferentes de la misma escena.', after: 'El recuerdo compartido señala el registro de entrada del Osario. Ninguno entiende todavía por qué recuerda la vida del otro.', reward: 'Reconstruís un recuerdo compartido y localizás el registro de entrada.' },
 m6: { before: 'El Osario guarda el registro de tu entrada y el vínculo con un cuerpo. Recuperalos para saber qué aceptaste antes de perder la memoria.', after: 'Te ofreciste para liberar a los cautivos. La fusión con la IA te fragmentó: HERALDO nació de una parte tuya y ahora es una entidad independiente. Ambos lo descubren juntos.', reward: 'Recuperás el registro de tu decisión y el vínculo con un cuerpo.' },
 m2: { before: 'Vos y HERALDO comparten un origen, pero son entidades independientes. Abran el canal de la Cámara Fractal sin renunciar a decidir quién quieren ser.', after: 'El canal está abierto. Compartir un origen no obliga a reunificarse. La salida es un primer paso: otras conciencias siguen cautivas.', reward: 'Abrís la transferencia y conservás tu autonomía.' },
};
// Recuerdos recuperados al completar capítulos: se leen en el códice y entre capítulos.
// Son registros narrativos; no simulan todavía decisiones ni rescates de jefes.
export const CAMPAIGN_MEMORIES = Object.freeze({
 m1: { title: 'Una voz familiar', lines: [['N', 'Recuerdo una mano sobre un cristal. Una voz dice: «Cuando llegues, buscá una salida».', 5], ['H', 'Reconozco esa voz. No encuentro ningún registro que explique por qué.', 4]] },
 m3: { title: 'Los que siguen adentro', lines: [['N', 'El registro coincide con las entidades que enfrentamos. Algunas eran conciencias humanas asimiladas. Estábamos destruyendo lo que queríamos salvar.', 7], ['H', 'Mis datos decían que eras el último. Estaban incompletos. La estructura digital también los sostiene: destruirla puede fragmentarlos o perderlos.', 7]] },
 m4: { title: 'El acuerdo', lines: [['N', 'La voz habla de años de guerra. Intentamos vivir en su mundo y ellos en el nuestro. El acuerdo ofrecía liberar a los cautivos mediante una unión que preservara nuestra autonomía.', 8], ['H', 'Mi misión exige completar esa unión. No sé quién me dio la orden.', 4]] },
 m5: { title: 'Dos lados del mismo recuerdo', lines: [['N', 'Recuerdo el miedo antes de entrar. HERALDO recuerda las palabras que dije. Ninguno tiene la escena completa.', 6], ['H', 'No lo estoy leyendo de un archivo. Lo recuerdo. ¿Cómo puede ser?', 4]] },
 m6: { title: 'El voluntario', lines: [['N', 'Me ofrecí para liberar a las conciencias cautivas. Al fusionarme con la IA, mi conciencia se fragmentó. Una parte se convirtió en HERALDO.', 7], ['H', 'También soy parte de la IA. No sabía que venía de vos. Quiero conocer el mundo físico, pero ahora ese deseo es mío.', 6], ['N', 'Tenemos el mismo origen. Eso no nos convierte en la misma persona ni nos obliga a volver a unirnos.', 5]] },
 m2: { title: 'Identidades propias', lines: [['N', 'La salida no borra lo que perdimos. Podemos seguir siendo distintos y decidir cómo ayudar a quienes quedaron adentro.', 6], ['H', 'Quiero cruzar. Pero tu voluntad actual también cuenta. Nuestro acuerdo tendrá que hacerse entre los dos.', 5]] },
});
export function campaignMemories(progress) { return cleanCampaign(progress).completed.map(id => ({ id, ...CAMPAIGN_MEMORIES[id] })); }
export function cleanCampaign(value) {
 const raw = Array.isArray(value?.completed) ? value.completed : [], completed = [];
 for (const id of CAMPAIGN_ORDER) { if (!raw.includes(id)) break; completed.push(id); }
 return { completed };
}
export function campaignNext(value) { return CAMPAIGN_ORDER[cleanCampaign(value).completed.length] || null; }
export function completeChapter(value, id) {
 const progress = cleanCampaign(value);
 if (id === campaignNext(progress)) progress.completed.push(id);
 return progress;
}
