# VORTEX — P0 combate y campaña · plan de ejecución

Estado: iniciado; **ninguna corrección de gameplay se declara implementada** por este documento.

## Hallazgos verificados en el código
- `src/sim/mision-config.js`: seis capítulos, ocho etapas cada uno, duración objetivo declarada 8–12 minutos por capítulo; total teórico 48–72 minutos, no 90–120.
- `src/sim/campaign.js`: secuencia m1 → m3 → m4 → m5 → m6 → m2 y progresión por capítulos completados.
- `docs/COMBAT_POLISH.md`: ya existen proyectiles diferenciados, confirmación de críticos, remates melee y pruebas específicas. No duplicar sistemas.
- `docs/CAMPAIGN_AUDIT.md`: pruebas automatizadas y navegación verificadas en auditoría previa, pero sin validación humana de duración real.

## P0-A: combate
1. Rastrear eventos de ataque, impacto y daño desde `src/sim` hasta `src/client/combatfx.js`, `shotfx.js` y audio.
2. Garantizar que el sonido de impacto solo se dispare con contacto confirmado; distinguir swing al aire, bloqueo, daño y muerte.
3. Evaluar ventanas de combo, cancelaciones, recuperación, hitstop visual y lectura del impacto, por huésped.
4. Validar 1ª y 3ª persona, táctil y teclado, con baja/alta calidad y multijugador.
5. Crear pruebas de regresión para daño único, atribución correcta, audio condicionado y ausencia de efectos duplicados.

## P0-B: campaña
1. Ejecutar `tools/audit/campaign-pace.mjs` y `tools/audit/medicion-capitulos.mjs` y contrastar tiempos con 20 partidas humanas.
2. Diseñar duración objetivo total de 90–120 minutos **sin** aumentar artificialmente HP, spawns o esperas.
3. Ampliar cada capítulo con objetivos específicos, consecuencias narrativas y una mecánica memorable; conservar seis mapas y orden actual.
4. Revisar puntos de control, repetición tras derrota y presentación de habilidades para reducir frustración.
5. Añadir pruebas de transiciones, recompensas, guardado y duración máxima, sin confundir tiempo simulado con tiempo humano.

## Puertas de aceptación
- No regresiones en suites de combate/campaña existentes.
- Sin impactos fantasma ni sonidos de daño al aire.
- Combos diferenciados y comprensibles por huésped, verificados con captura y jugadores.
- Campaña completa entre 90 y 120 min de mediana en muestra humana; ninguna etapa se alarga solo por espera.
- Pruebas en móvil físico y cooperativo antes de fusionar a producción.

## Próximo cambio de código
Priorizar la cadena de eventos contacto→daño→audio del melee, con prueba automática reproducible, seguida del rediseño de objetivos de campaña. No fusionar este plan por sí solo como si fuera una corrección P0.
