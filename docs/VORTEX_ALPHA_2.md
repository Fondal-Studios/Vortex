# VORTEX — Continuidad narrativa y alfa simulada 2

2026-10-22. Rama `codex/vortex-block0-audit`, PR #1. Parte de la alfa previa `307f34845798176d6dbb1c6069ca4b7b56a96224`. Cambios preparados para revisión; no merge ni publicación.

## Cambios implementados

- Despertar específico por capítulo; m2 ya no ordena derrotar al Coloso después de vencerlo. Final, trofeo y epílogo describen la misma transferencia de conciencia.
- Resumen de campaña siempre accesible al terminar o saltar la introducción: contexto, tarea y recompensa, sin temporizador. Pausa el juego en solitario y se puede consultar desde «Misión y controles».
- Se cancela el callback pendiente de subtítulos al saltar, para evitar terminar dos veces la introducción y restaurar un estado de pausa incorrecto.
- Principiante en táctil, teclado y mando: atacar, saltar, usar y cambiar modo. Movimiento y cámara continúan aparte. Disparo en primera persona, espada en tercera. Se mantiene la elección de armas/evolución/recompensas existente: no se afirma haber reducido todos los menús a cuatro decisiones.
- Mantener no invoca otro ataque, movilidad o definitiva. Las habilidades avanzadas, ataque secundario y sprint dejan de entrar por el esquema principiante. El autoataque previo tampoco se ejecuta en este esquema. Disparar sigue requiriendo acción explícita.
- Poderes y definitivas conservados íntegramente en controles completos; no se eliminó el código ni se calificó cada habilidad como inútil. Se retiró su carga de aprendizaje de la primera experiencia. El perfil de controles completos ya guardado se respeta.
- Objetivo activo con verbo primero; oleada y tiempo en segunda línea. El núcleo explica recogida por proximidad. La meta inicial de m2 señala a la Madre Geoda.

## Segunda pasada: problemas encontrados al renderizar

La primera captura reveló que otra capa del HUD reemplazaba el objetivo por un texto de territorio antiguo: «Mandinga» en Islas. Se creó `campaign-names.js` como identidad por arena y se unificaron los nombres en la simulación y territorios. Compartir la IA del jefe entre mapas no obliga a compartir su nombre. El HUD inicial ya no sobrescribe la meta de capítulo con ese texto.

El aviso de planta descubierta tapaba gran parte del centro. Se acortó en principiante y se redujo el tamaño/posición de las notificaciones. El texto largo permanece en el Herbario y en el esquema completo.

La prueba de clic real encontró un bloqueo: la zona táctil quedaba por encima de «Jugar» en el resumen. Se ocultan los controles mientras el resumen está abierto, se sube el orden visual del panel y se restauran al cerrarlo. La repetición confirmó que el botón recibe el clic y reanuda la partida.

## Validación ejecutada

- 48/48 pruebas de narrativa, nombres de jefes, entradas esenciales, combate básico de ocho Huéspedes en dos modos, objetivos y misiones. Incluyen comprobaciones de integración por código: estas no se presentan como interacción real.
- 59/59 pruebas rápidas de simulación. Total: 107 pruebas seleccionadas, sin omisiones. No es la suite completa.
- Compilación estática realizada; no equivale a publicar.
- Navegador Chromium con renderizado por software: PC 1280×720, móvil 667×375, móvil 844×390 y tablet 1024×768, en disparo y melee. Verificó cámara, cuatro acciones táctiles, tamaño mínimo 44 px, límites y ausencia de solapamiento entre botones; cero errores de página en esos escenarios. No verifica toda superposición de HUD, fluidez real ni Safari físico.
- Prueba real de clic en «Saltar» del prólogo: resumen visible, pausa y reanudación correctas. Victoria de m1 forzada por fixture para comprobar transición a m2, su objetivo y cierre del resumen sin bloqueo. Esta prueba no demuestra que una persona pueda vencer al jefe.
- 20 sondas de 300 segundos máximos, mismas semillas 1001–1020, Axioma disparo, dificultad 1, ahora con filtro principiante. 16 seguían jugando y cuatro perdieron. Antes eran 18 y dos. No representan humanos ni tasas de abandono.
- Retirar poderes tuvo un costo en esas sondas. Se preserva dificultad 1: no se reduce a ciegas para obtener una puntuación mejor. Se requiere probar supervivencia y diversión con principiantes, más huéspedes y campaña completa.

Reproducción: `node --test tests/campaign-clarity.test.js tests/essential-controls.test.js tests/essential-balance.test.js tests/mission-variety.test.js tests/metas.test.js`, `npm run test:fast`, `node tools/alpha-campaign.js --beginner`, `node tools/build-static.js`. Para navegador, instalar Chromium y configurar `BROWSER_EXECUTABLE`, luego `node tools/check-essential-ui.js shots/alpha2` y `node tools/check-campaign-briefing.js`. En esta sesión se usó el binario portable de @sparticuz/chromium con sus argumentos de lanzamiento tras fallar la descarga estándar de Playwright. No se agrega como dependencia del juego.

## Nueva puntuación — 20 perfiles ficticios

Se vuelven a valorar las mismas necesidades de los 20 perfiles de la alfa anterior. Son juicios editoriales sobre cambios concretos, no respuestas recogidas ni una muestra humana. Los bots son una batería separada. La nota de retorno sigue siendo intención hipotética: no es retención D1/D7 ni porcentaje. No hay evidencia para declarar que todas las dimensiones superan 80.

| Dimensión | Alfa 1 | Alfa 2 | Evidencia y límite |
|---|---:|---:|---|
| Historia | 72.2 | 79.0 | Final y nombres coherentes; la profundidad dramática sigue siendo limitada. |
| Comprensión de historia | 63.9 | 82.7 | Resumen recuperable incluso al omitir; comprensión humana pendiente. |
| Comprensión de campaña | 62.5 | 82.0 | Capítulo y recompensa explícitos; transición comprobada con victoria forzada. |
| Objetivos | 62.2 | 81.2 | Prioridad visual y nombres corregidos; navegación espontánea aún pendiente. |
| Manejo | 60.3 | 78.6 | Sin alternativas ocultas; cuatro botones probados. Costo de retirar habilidades aún sin balance humano. |
| HUD | 58.6 | 74.6 | Capturas y controles comprobados; persisten inventario/progreso y ruido del mundo. |
| Primeros 5 minutos | 63.0 | 77 | Menos confusión de entrada; no hubo sesiones humanas de cinco minutos. |
| Intención de volver | 59.6 | 68.8 | No se midieron regresos; simplificar no prueba que la experiencia invite a repetir. |

### Valoraciones individuales hipotéticas

H historia; CH comprensión de historia; CC comprensión de campaña; O objetivos; M manejo; HUD interfaz; 5m primera experiencia; V intención de volver.

| Perfil | H | CH | CC | O | M | HUD | 5m | V |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Principiante absoluto · PC | 78 | 78 | 78 | 76 | 72 | 68 | 72 | 62 |
| Principiante · móvil | 78 | 77 | 76 | 75 | 70 | 65 | 70 | 60 |
| Jugador de puzles · poco 3D | 81 | 84 | 82 | 78 | 74 | 72 | 75 | 66 |
| Casual · sesiones de cinco minutos | 75 | 77 | 78 | 79 | 78 | 74 | 70 | 55 |
| Casual · omite diálogos | 72 | 76 | 77 | 80 | 80 | 76 | 76 | 60 |
| Casual · lee toda la historia | 84 | 90 | 88 | 86 | 80 | 78 | 80 | 76 |
| Aficionado a ciencia ficción | 87 | 92 | 90 | 88 | 83 | 81 | 84 | 83 |
| Explorador · ignora la misión | 81 | 82 | 78 | 70 | 82 | 75 | 80 | 72 |
| Jugador de acción · mando habitual | 77 | 80 | 80 | 81 | 73 | 76 | 75 | 66 |
| Jugador móvil habitual | 78 | 81 | 81 | 80 | 81 | 75 | 79 | 70 |
| Experto en shooters rápidos | 74 | 85 | 87 | 87 | 85 | 81 | 81 | 73 |
| Experto en shooters tácticos | 74 | 86 | 87 | 88 | 82 | 78 | 77 | 67 |
| Experto en melee y combos | 80 | 83 | 84 | 82 | 78 | 77 | 80 | 73 |
| Veterano de roguelites | 79 | 84 | 85 | 88 | 85 | 80 | 83 | 80 |
| Competitivo · busca dominio | 71 | 81 | 83 | 85 | 79 | 76 | 76 | 63 |
| Indie experimental · tolera extrañeza | 89 | 90 | 86 | 83 | 83 | 78 | 86 | 86 |
| Narrativo · prioriza personajes | 85 | 89 | 83 | 78 | 75 | 75 | 76 | 74 |
| Lector lento · interfaz accesible | 80 | 78 | 77 | 79 | 73 | 63 | 68 | 56 |
| Experto móvil · pantalla pequeña | 77 | 81 | 81 | 80 | 78 | 69 | 75 | 63 |
| Veterano que vuelve tras una pausa | 81 | 80 | 78 | 80 | 81 | 75 | 77 | 71 |

## Estado respecto del objetivo >80

No aprobado todavía. Repetir asignaciones de notas sin nueva evidencia no sería otra alfa útil. La siguiente iteración debe resolver:

1. Balance principiante: comparación reproducible en más huéspedes y pelea con ambos jefes, seguida de observación humana. Con cuatro derrotas en vez de dos no se puede afirmar equivalencia de potencia.
2. Recompensas: algunas mejoras de poderes siguen teniendo menos utilidad en principiante. Deben explicitar compatibilidad o filtrarse sin perder progresión al volver a controles completos.
3. HUD y orientación: observar combate activo y búsqueda de últimos enemigos, no solo posiciones de botones. Las capturas no certifican eliminación de todo solapamiento.
4. Primera experiencia y retorno: sesiones humanas sin indicaciones externas, con lectura opcional del resumen, y seguimiento efectivo de regresos.
5. Auditoría restante: textos de NPC y archivos antiguos, checkpoints de campaña y pruebas físicas de Safari/iPhone siguen pendientes. El prólogo no se acortó; el resumen permite omitirlo conservando contexto.

El criterio no será subir las notas por iteración, sino corregir un problema observado, repetir su prueba y revisar la nota solo cuando cambie su fundamento. Esta entrega deja dos pasadas de corrección y una alfa nueva recuperables.
