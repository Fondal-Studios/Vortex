// Operaciones compartidas por menú, simulación local y servidor autoritativo.
const step = (kind, title, desc) => ({ kind, title, desc });
const link = () => step('secuencia', 'Reconectar el archivo', 'Seguí la flecha: ocupá cada terminal indicado durante 2 segundos.');
const defend = () => step('ancla', 'Proteger la zona segura', 'Permanecé en el círculo y mantenelo libre de enemigos durante 35 segundos acumulados. Si destruyen el ancla, la misión fracasa.');
const rescue = () => step('nucleo', 'Extraer la conciencia', 'Recogé el núcleo de memoria y transportalo al altar de salida. No podés disparar mientras lo llevás; si caés, otro jugador puede recuperarlo.');
const hunt = () => step('caza', 'Romper el bloqueo', 'Eliminá al custodio marcado para desactivar las defensas de la IA.');
export const OPERATIONS = {
 m1: { title: 'Refugio de identidades', arena: 'Vacío de Islas', type: 'Defensa y rescate', story: 'HERALDO detectó conciencias que la IA custodio está borrando. Estabilizá un refugio y sacalas de la red.', steps: [link(), defend(), rescue()] },
 m2: { title: 'La memoria cautiva', arena: 'Cámara Fractal', type: 'Infiltración y extracción', story: 'Una identidad sigue atrapada en un archivo fractal. Rompé su bloqueo y recuperá su memoria intacta.', steps: [hunt(), link(), rescue()] },
 m3: { title: 'Apagar los ojos', arena: 'Laberinto Celestial', type: 'Sabotaje y defensa', story: 'Los ojos de la red vigilan cada intento de fuga. Reconectá los terminales y protegé el acceso liberado.', steps: [link(), hunt(), defend()] },
 m4: { title: 'El camino que respira', arena: 'Jardín de Carne', type: 'Apertura de ruta y rescate', story: 'La única ruta de evacuación está incompleta. Hacé crecer el puente antes de sacar la conciencia del jardín.', steps: [step('cultivo', 'Abrir el puente vivo', 'Dispará a los tres capullos hasta que florezcan y defendelos de las criaturas.'), defend(), rescue()] },
 m5: { title: 'Voces de la plaza', arena: 'Plaza de los Ecos', type: 'Recuperación de memoria', story: 'Entre los ecos de Praga queda una voz humana. Restaurá el archivo y protegé su transferencia.', steps: [link(), rescue(), defend()] },
 m6: { title: 'La última transferencia', arena: 'Osario sin Techo', type: 'Liberación de conciencia', story: 'La IA custodio aisló una conciencia en el osario. Abrí su canal, rompé el bloqueo y llevala al altar.', steps: [link(), hunt(), rescue()] },
};
