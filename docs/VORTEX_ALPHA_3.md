# VORTEX — Alfa 3: poderes progresivos, balance y recompensas

Fecha: 2026-10-22. Base: `main` `09dfac8a76d2bd38b340301134245ec73e109fc0`, con PR #5 integrado (apoyo después de superar oleada 1; ulti después de superar oleada 3). Rama de trabajo: `codex/vortex-alpha3-balance`.

## Qué se conserva

Dos poderes por Huésped, idénticos en Disparo y Melé; bloqueo autoritativo, explicación entre oleadas, guardado del desbloqueo y consulta en pausa. Minimapa, reanimación, identidad/cosméticos y cuentas de main se conservan. No se restablece el esquema de alfa 2 que eliminaba todos los poderes. La progresión actual añade botones separados al aprender: no se promete un máximo permanente de cuatro acciones.

## Qué se corrigió

1. **Máximo de tres recompensas accesibles.** El generador podía crear dos mutaciones, dos formas finales y un órgano aunque solo se aceptan índices 0–2. Ahora ofrece una pareja de ramas completa, no las dos a la vez, y hasta tres opciones en total.
2. **Aprendizaje gradual.** Las recompensas de las tres primeras oleadas de campaña son mejoras básicas gratuitas. La primera mejora disponible prioriza daño/cadencia del arma equipada. Órganos, mutaciones y formas se incorporan después; se mantiene su profundidad posterior. No cambia la dificultad ni las estadísticas de las habilidades.
3. **Desbloqueo antes de recompensa.** Se actualiza el nivel de habilidades antes de generar tarjetas. Una mejora exclusiva de duración de ulti no se ofrece mientras esta está bloqueada.
4. **Costo visible.** Los órganos muestran cantidad y tipo de esencias. Las tarjetas distinguen mejoras de Disparo y del cuerpo. La captura detectó avisos y badges tapando tarjetas: durante la elección pausada en solitario se ocultan esas capas; cooperativo conserva información de combate. El título ahora dice «Elegí una mejora», incluyendo cuerpo y armas. La interfaz aclara que se elige una y se descartan las otras.
5. **Elección protegida.** Una compra de órgano fallida conserva las opciones y avisa. La elección automática al terminar el respiro busca una mejora gratuita; no gasta esencias en un órgano sin confirmación.
6. **Continuidad recuperada.** Algunas correcciones de alfa 2 no estaban en la base integrada por PR #5. Se incorporan resumen de contexto/tarea/recompensa al saltar intro, despertar por capítulo, final de transferencia y nombres por arena. No se copia el antiguo controlador ni se pierden los dos poderes nuevos. El panel permite desplazamiento en pantallas bajas. Una prueba táctil detectó que la zona de cámara interceptaba su botón; se ocultan las zonas táctiles mientras está abierto, tanto para el resumen como para aprender poderes.

## Comparación reproducible antes/después

Se ejecutaron 20 sondas antes de editar y 20 después, con semillas 1001–1020, dificultad 1, Axioma Disparo, cargadores activos, hasta 300 segundos de simulación. Nivel de habilidades inicial 0. El bot solicita apoyo con enemigos próximos y ulti cargada; los bloqueos reales de la simulación deciden si puede usarlos. La puntería usa cuatro valores de skill. Esto no representa cuatro niveles humanos de comprensión. No se incluyen tiempo de carga, lectura de textos, tutorial o decisiones de un jugador real.

| Medida | PR #5 antes | Alfa 3 después |
|---|---:|---:|
| Activas al corte de 5 minutos | 18 | 18 |
| Derrotas antes del corte | 2 | 2 |
| Llegan a oleada 7 | 4 | 6 |
| Bajas promedio por sonda | 169,45 | 165,6 |
| Activaciones de apoyo, total | 274 | 249 |
| Activaciones de ulti, total | 106 | 108 |

No se afirma mejora de win rate: ninguna de esas partidas completó la campaña durante esta ventana. Los cambios de recompensas consumen RNG de otra manera, por lo que una misma semilla no implica la misma secuencia de enemigos después de divergir las decisiones. Las bajas menores no se interpretan automáticamente como peor combate ni llegar antes a una oleada como mayor diversión.

En las 20 sondas, apoyo se desbloqueó entre 22,45 y 28,8 s (media 25,36); ulti entre 107,13 y 129,35 s (media 115,11), excluyendo intro y lectura.

Las 20 sondas completaron ancla, sintonía y núcleo; 17 completaron secuencia antes del corte en la versión ajustada. Comparación válida entre estas dos variantes con política de bot idéntica. Los números históricos de alfa 2 usaban otro controlador de entradas sin poderes y no son una comparación causal con este PR.

## Verificación

- 66/66 pruebas dirigidas: recompensas, bloqueos, los ocho Huéspedes en ambos modos, poderes ejecutados, perfiles, objetivos, nombres y continuidad.
- 59/59 pruebas rápidas del núcleo.
- Navegador: resultado y capturas en `vortex-evidence/alpha3-ui/`. Recorrido con oleadas completadas por fixture, no una campaña ganada por un jugador. Incluye PC y táctil horizontal, desbloqueos 1/3, tres opciones, precio, fallo de compra sin perder elección, resumen al omitir y transición forzada a m2.
- Cooperativo: 4/4 pruebas aprobadas; resultado en `vortex-evidence/alpha3-coop.txt`; no se declara validada toda la suite, latencias o dispositivos físicos por esta entrega.
- Compilación estática ejecutada. No es despliegue ni publicación.

Comandos: `node tools/alpha3-campaign.mjs <salida.json>`; `node --test tests/campaign-clarity.test.js tests/alpha3-rewards.test.js tests/skill-path.test.js tests/metas.test.js tests/modos.test.js`; `npm run test:fast`; `node --test tests/coop.test.js`; `CHROMIUM=/ruta/chromium node tools/check-alpha3-ui.mjs`; `node tools/build-static.js`. En esta sesión el navegador portable usa @sparticuz/chromium y sus argumentos en un wrapper temporal. No es dependencia del juego. El script de alfa registra el commit base; los hashes de fuentes en ambos JSON distinguen exactamente la simulación evaluada.

## Puntuación de 20 perfiles ficticios

Las notas son hipótesis editoriales, no testimonios ni encuestas. Se mantienen los mismos perfiles y se explicitan los ajustes en `alpha3-personas.json`: la narrativa no recibe puntos nuevos por recuperar correcciones anteriores; el aprendizaje progresivo y la claridad de recompensas mejoran sus criterios correspondientes. La intención de volver NO equivale a retención D1/D7. Los bots no producen estas notas.

| Dimensión | Alfa 2 histórica | Alfa 3 hipotética |
|---|---:|---:|
| Historia | 79.0 | 79.0 |
| Comprensión de historia | 82.7 | 82.7 |
| Comprensión de campaña | 82.0 | 82.0 |
| Objetivos | 81.2 | 82.2 |
| Manejo | 78.6 | 80.6 |
| HUD | 74.6 | 77.6 |
| Primeros 5 minutos | 77 | 79 |
| Intención de volver | 68.8 | 72.8 |

H historia; CH comprensión de historia; CC comprensión de campaña; O objetivos; M manejo; HUD interfaz; 5m primera experiencia; V intención de volver.

| Perfil | H | CH | CC | O | M | HUD | 5m | V |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Principiante absoluto · PC | 78 | 78 | 78 | 77 | 74 | 71 | 74 | 66 |
| Principiante · móvil | 78 | 77 | 76 | 76 | 72 | 68 | 72 | 64 |
| Jugador de puzles · poco 3D | 81 | 84 | 82 | 79 | 76 | 75 | 77 | 70 |
| Casual · sesiones de cinco minutos | 75 | 77 | 78 | 80 | 80 | 77 | 72 | 59 |
| Casual · omite diálogos | 72 | 76 | 77 | 81 | 82 | 79 | 78 | 64 |
| Casual · lee toda la historia | 84 | 90 | 88 | 87 | 82 | 81 | 82 | 80 |
| Aficionado a ciencia ficción | 87 | 92 | 90 | 89 | 85 | 84 | 86 | 87 |
| Explorador · ignora la misión | 81 | 82 | 78 | 71 | 84 | 78 | 82 | 76 |
| Jugador de acción · mando habitual | 77 | 80 | 80 | 82 | 75 | 79 | 77 | 70 |
| Jugador móvil habitual | 78 | 81 | 81 | 81 | 83 | 78 | 81 | 74 |
| Experto en shooters rápidos | 74 | 85 | 87 | 88 | 87 | 84 | 83 | 77 |
| Experto en shooters tácticos | 74 | 86 | 87 | 89 | 84 | 81 | 79 | 71 |
| Experto en melee y combos | 80 | 83 | 84 | 83 | 80 | 80 | 82 | 77 |
| Veterano de roguelites | 79 | 84 | 85 | 89 | 87 | 83 | 85 | 84 |
| Competitivo · busca dominio | 71 | 81 | 83 | 86 | 81 | 79 | 78 | 67 |
| Indie experimental · tolera extrañeza | 89 | 90 | 86 | 84 | 85 | 81 | 88 | 90 |
| Narrativo · prioriza personajes | 85 | 89 | 83 | 79 | 77 | 78 | 78 | 78 |
| Lector lento · interfaz accesible | 80 | 78 | 77 | 80 | 75 | 66 | 70 | 60 |
| Experto móvil · pantalla pequeña | 77 | 81 | 81 | 81 | 80 | 72 | 77 | 67 |
| Veterano que vuelve tras una pausa | 81 | 80 | 78 | 81 | 83 | 78 | 79 | 75 |

## Decisión de producción y pendientes

Mantener el apoyo y la ulti progresivos. La batería no justifica bajar dificultad ni aumentar daño global para alcanzar una nota objetivo. Las correcciones de recompensas son verificables y evitan elecciones inaccesibles o gastos involuntarios. No todas las categorías superan 80.

Falta observar jugadores reales usando el apoyo recién aprendido, valorar su contribución por huésped y completar ambos capítulos con melee y disparo. El bot de esta alfa solo representa Axioma Disparo; las pruebas de ocho huéspedes son fixtures de combate, no ocho recorridos completos. La recompensa gratuita inicial de arma ayuda al disparo: siguen pendientes alternativas gratuitas equivalentes para quien permanezca exclusivamente en melee. No se ofrecen ahora nuevas mejoras de melee sin haber validado su balance.

La lectura del mundo, saturación del HUD en combate avanzado, búsqueda de enemigos finales, checkpoints y retención real siguen abiertos. Safari/iPhone físico y mandos físicos no están certificados. Estos límites impiden declarar una alfa humana aprobada o un juego comercial terminado.
