// Operaciones compartidas por menú, simulación local y servidor autoritativo.
import { CAMPAIGN_ORDER, CAMPAIGN_LINKS } from './campaign.js';
import { misionConfig, esPaso } from './mision-config.js';
export { CAMPAIGN_ORDER };
// Las etapas (tipo, objetivo, oleadas, límites) se declaran en mision-config.js; aquí quedan los textos del capítulo y los PASOS con objetivo obligatorio.
export const OPERATIONS = {
 m1: { title: 'Islas — Despertar', arena: 'Vacío de Islas', type: 'Defensa y rescate', story: 'HERALDO detectó fragmentos de tu identidad amenazados por la IA custodio. Estabilizá un refugio y recuperalos.' },
 m2: { title: 'La última transferencia', arena: 'Cámara Fractal', type: 'Infiltración y extracción', story: 'Tu conciencia sigue atrapada en la red. Rompé el último bloqueo y prepará la transferencia.' },
 m3: { title: 'Apagar los ojos', arena: 'Laberinto Celestial', type: 'Sabotaje y defensa', story: 'Los ojos de la red vigilan cada intento de fuga. Reconectá los terminales y protegé el acceso liberado.' },
 m4: { title: 'El camino que respira', arena: 'Jardín de Carne', type: 'Apertura de ruta y rescate', story: 'La única ruta de evacuación está incompleta. Hacé crecer el puente antes de extraer el archivo del jardín.' },
 m5: { title: 'Voces de la plaza', arena: 'Plaza de los Ecos', type: 'Recuperación de memoria', story: 'Entre los ecos de Praga queda una grabación humana. Restaurá el archivo y protegé su transferencia.' },
 m6: { title: 'El vínculo del Osario', arena: 'Osario sin Techo', type: 'Recuperación del vínculo', story: 'La IA custodio aisló el vínculo con tu cuerpo sintético. Abrí su canal, rompé el bloqueo y llevalo al altar.' },
};

for (const id of CAMPAIGN_ORDER) Object.assign(OPERATIONS[id], CAMPAIGN_LINKS[id], { chapter: CAMPAIGN_ORDER.indexOf(id) + 1, story: CAMPAIGN_LINKS[id].before });

// `stages` = TODAS las etapas (Oleada X/Y); `steps` = las que traen un objetivo obligatorio (para briefings y menús).
for (const id of Object.keys(OPERATIONS)) {
  const cfg = misionConfig(id);
  OPERATIONS[id].stages = cfg.stages.map(({ kind, objective, title, desc }) => ({ kind, objective, title, desc }));
  OPERATIONS[id].steps = cfg.stages.filter(esPaso).map(({ kind, objective, title, desc }) => ({ kind: objective, title, desc }));
}
