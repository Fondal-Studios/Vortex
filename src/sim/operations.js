// Operaciones compartidas por menú, simulación local y servidor autoritativo.
import { CAMPAIGN_ORDER, CAMPAIGN_LINKS } from './campaign.js';
export { CAMPAIGN_ORDER };
const step = (kind, title, desc) => ({ kind, title, desc });
const link = () => step('secuencia', 'Reconectar el archivo', 'Seguí la flecha: ocupá cada terminal indicado durante 2 segundos.');
const defend = () => step('ancla', 'Proteger la zona segura', 'Permanecé en el círculo y mantenelo libre de enemigos durante 35 segundos acumulados. Si destruyen el ancla, la misión fracasa.');
const rescue = () => step('nucleo', 'Extraer el archivo de memoria', 'Recogé el núcleo de memoria y transportalo al altar de salida. No podés disparar mientras lo llevás; si caés, otro jugador puede recuperarlo.');
const hunt = () => step('caza', 'Romper el bloqueo', 'Eliminá al custodio marcado para desactivar las defensas de la IA.');
export const OPERATIONS = {
 m1: { title: 'Refugio de la conciencia', arena: 'Vacío de Islas', type: 'Defensa y rescate', story: 'HERALDO detectó fragmentos de tu identidad amenazados por la IA custodio. Estabilizá un refugio y recuperalos.', steps: [link(), defend(), rescue()] },
 m2: { title: 'La última transferencia', arena: 'Cámara Fractal', type: 'Infiltración y extracción', story: 'Tu conciencia sigue atrapada en la red. Rompé el último bloqueo y prepará la transferencia.', steps: [hunt(), link(), rescue()] },
 m3: { title: 'Apagar los ojos', arena: 'Laberinto Celestial', type: 'Sabotaje y defensa', story: 'Los ojos de la red vigilan cada intento de fuga. Reconectá los terminales y protegé el acceso liberado.', steps: [link(), hunt(), defend()] },
 m4: { title: 'El camino que respira', arena: 'Jardín de Carne', type: 'Apertura de ruta y rescate', story: 'La única ruta de evacuación está incompleta. Hacé crecer el puente antes de extraer el archivo del jardín.', steps: [step('cultivo', 'Abrir el puente vivo', 'Dispará a los tres capullos hasta que florezcan y defendelos de las criaturas.'), defend(), rescue()] },
 m5: { title: 'Voces de la plaza', arena: 'Plaza de los Ecos', type: 'Recuperación de memoria', story: 'Entre los ecos de Praga queda una grabación humana. Restaurá el archivo y protegé su transferencia.', steps: [link(), rescue(), defend()] },
 m6: { title: 'El vínculo del Osario', arena: 'Osario sin Techo', type: 'Recuperación del vínculo', story: 'La IA custodio aisló el vínculo con tu cuerpo sintético. Abrí su canal, rompé el bloqueo y llevalo al altar.', steps: [link(), hunt(), rescue()] },
};

for (const id of CAMPAIGN_ORDER) Object.assign(OPERATIONS[id], CAMPAIGN_LINKS[id], { chapter: CAMPAIGN_ORDER.indexOf(id) + 1, story: CAMPAIGN_LINKS[id].before });

OPERATIONS.m1.steps[2] = { ...OPERATIONS.m1.steps[2], title: 'Recuperar tu identidad' };
OPERATIONS.m6.steps[2] = { ...OPERATIONS.m6.steps[2], title: 'Recuperar el vínculo genómico' };
