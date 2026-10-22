# VORTEX — Alfa simulada de campaña: 20 perfiles

Fecha: 2026-10-22. Versión analizada: `18b1e1e`, árbol `257ab3544de424c94cf66d6e1a39b6e1ce53c0d0`, rama `codex/vortex-block0-audit`, PR #1. No es una evaluación de la versión publicada ni de cambios de otras ramas.

## Qué hicimos y qué significan las notas

Se revisaron los textos y el flujo de campaña, las entradas simplificadas y la construcción del HUD. Se ejecutaron 20 sondas automáticas de hasta 300 segundos de juego en m1. Además, se construyeron 20 perfiles ficticios y se les asignaron valoraciones editoriales según sus necesidades. **No hubo 20 jugadores humanos, ni 20 partidas completas de campaña, ni observación de comprensión humana.** Los perfiles no corresponden uno a uno a los bots. El bot sabe navegar y resolver objetivos; bajar su parámetro `skill` cambia su puntería, no lo convierte en un principiante.

Las notas son hipótesis de diseño, de 1 a 100: 50 indica fricción importante; 70, experiencia utilizable con carencias; 90, experiencia clara y pulida. No son mediciones ni un pronóstico estadístico. Las medias solo resumen estas valoraciones; no expresan precisión empírica. «Intención de volver» es atractivo hipotético para otra sesión, **no porcentaje de retención D1/D7**. El promedio no sustituye la scorecard ponderada anterior.

No se verificaron visualmente esta versión, su legibilidad en un iPhone físico, el confort de cámara, audio ni rendimiento gráfico. La automatización anterior de navegador está bloqueada por ausencia de Chromium; no se atribuye ese bloqueo al juego. La confianza es media en el diagnóstico del flujo/textos y baja en las notas de HUD, manejo, diversión y retorno.

## Diagnóstico ejecutivo

La premisa ya tiene dirección: una conciencia digitalizada debe escapar de una IA que borra identidades. La campaña ofrece un destino concreto y variedad mecánica. Sin embargo, todavía exige aprender demasiadas capas a la vez y conserva contradicciones narrativas comprobables. Es razonable esperar mejor recepción en jugadores expertos o amantes de lo experimental que en principiantes. Eso es una hipótesis de segmentación, no una conclusión sobre una muestra real.

El principal problema no es la falta de contenido: es la distancia entre «sobreviví y vencé al jefe» y saber qué hacer ahora, con qué botón y por qué importa. No daría por cerrada la alfa de usabilidad.

## Media de las 20 valoraciones hipotéticas

| Dimensión | Nota /100 | Motivo principal |
|---|---:|---|
| Historia | 72.2 | Premisa atractiva; poco desarrollo dramático y restos del final anterior. |
| Comprensión de historia | 63.9 | Exposición rápida; omitir el prólogo también omite el despertar explicativo. |
| Comprensión de campaña | 62.5 | Ruta corta definida, pero el segundo capítulo vuelve a mencionar una tarea ya completada. |
| Objetivos | 62.2 | Hay marcadores y tareas diversas; la estructura de oleadas compite con el propósito narrativo. |
| Manejo | 60.3 | Cuatro botones contienen alternativas por pulsación larga y cambios contextuales. |
| HUD | 58.6 | Menos duplicados, pero subsisten capas de combate, progreso, jefe y recompensas; legibilidad sin verificar. |
| Primeros 5 minutos | 63.0 | Entrada con identidad, seguida de bastante exposición y aprendizaje simultáneo. |
| Intención de volver | 59.6 | Hay curiosidad y variedad; comprensión, continuidad y repetición son riesgos abiertos. |

## Los 20 perfiles: todas las notas son hipotéticas

H = historia; CH = comprensión de historia; CC = comprensión de campaña; O = objetivos; M = manejo; HUD = interfaz; 5m = primera experiencia; V = intención de volver.

| ID | Perfil | H | CH | CC | O | M | HUD | 5m | V |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 01 | Principiante absoluto · PC | 70 | 52 | 48 | 50 | 42 | 48 | 50 | 45 |
| 02 | Principiante · móvil | 72 | 55 | 52 | 51 | 40 | 45 | 48 | 44 |
| 03 | Jugador de puzles · poco 3D | 76 | 69 | 59 | 57 | 46 | 53 | 55 | 52 |
| 04 | Casual · sesiones de cinco minutos | 67 | 50 | 52 | 55 | 54 | 56 | 49 | 43 |
| 05 | Casual · omite diálogos | 55 | 30 | 42 | 55 | 60 | 59 | 57 | 48 |
| 06 | Casual · lee toda la historia | 80 | 76 | 70 | 67 | 58 | 62 | 67 | 66 |
| 07 | Aficionado a ciencia ficción | 83 | 80 | 73 | 69 | 63 | 65 | 72 | 75 |
| 08 | Explorador · ignora la misión | 77 | 68 | 60 | 50 | 65 | 58 | 68 | 63 |
| 09 | Jugador de acción · mando habitual | 71 | 65 | 65 | 64 | 50 | 61 | 62 | 57 |
| 10 | Jugador móvil habitual | 72 | 65 | 65 | 64 | 62 | 58 | 65 | 61 |
| 11 | Experto en shooters rápidos | 65 | 67 | 70 | 72 | 78 | 68 | 72 | 68 |
| 12 | Experto en shooters tácticos | 65 | 70 | 72 | 73 | 73 | 65 | 67 | 61 |
| 13 | Experto en melee y combos | 73 | 67 | 69 | 67 | 66 | 64 | 70 | 69 |
| 14 | Veterano de roguelites | 71 | 68 | 70 | 73 | 77 | 67 | 74 | 75 |
| 15 | Competitivo · busca dominio | 62 | 65 | 68 | 71 | 70 | 63 | 67 | 60 |
| 16 | Indie experimental · tolera extrañeza | 87 | 78 | 72 | 68 | 72 | 65 | 81 | 83 |
| 17 | Narrativo · prioriza personajes | 81 | 77 | 68 | 62 | 54 | 60 | 65 | 65 |
| 18 | Lector lento · interfaz accesible | 74 | 48 | 51 | 54 | 48 | 43 | 47 | 42 |
| 19 | Experto móvil · pantalla pequeña | 69 | 65 | 65 | 63 | 59 | 51 | 60 | 54 |
| 20 | Veterano que vuelve tras una pausa | 74 | 62 | 58 | 60 | 69 | 62 | 65 | 62 |

## Reseñas y riesgos por perfil — ficción editorial

**01. Principiante absoluto · PC.** La premisa intriga, pero moverme, mirar y leer a la vez me supera. Abandonaría si no puedo practicar antes de recibir daño.

**02. Principiante · móvil.** Cuatro botones ayudan; las pulsaciones largas siguen siendo varias reglas. Abandonaría por activar otra acción sin querer.

**03. Jugador de puzles · poco 3D.** Me interesa rescatar una conciencia; me cuesta orientarme entre islas. Abandonaría si la flecha no explica cómo llegar.

**04. Casual · sesiones de cinco minutos.** Quiero una tarea pequeña y terminarla rápido. Abandonaría si interrumpir la campaña implica repetir demasiado.

**05. Casual · omite diálogos.** Entiendo que hay que sobrevivir, pero no por qué. Abandonaría si saltar el prólogo me deja sin contexto.

**06. Casual · lee toda la historia.** Entiendo la amenaza de la IA; el recordatorio del Coloso me contradice. Abandonaría si los objetivos contradicen lo que ya hice.

**07. Aficionado a ciencia ficción.** La conciencia digital y el huésped tienen potencial; falta dramatizarlos. Abandonaría si la historia se reduce a instrucciones de combate.

**08. Explorador · ignora la misión.** Quiero investigar el mundo sin sentir que estoy fallando un cronómetro. Abandonaría si explorar solo demora la misma oleada.

**09. Jugador de acción · mando habitual.** El cambio de perspectiva es interesante, pero debo reaprender entradas. Abandonaría si mi dispositivo habitual no tiene un manejo comprobado.

**10. Jugador móvil habitual.** Hay menos botones; necesito distinguir siempre qué hará el tercero. Abandonaría por cambios contextuales poco previsibles.

**11. Experto en shooters rápidos.** El combate llega rápido después de la introducción; quiero lectura limpia. Abandonaría por perseguir enemigos residuales o perderlos entre efectos.

**12. Experto en shooters tácticos.** Quiero decidir cuándo atacar y ver amenazas antes de recibir daño. Abandonaría si el ruido visual impide tomar decisiones.

**13. Experto en melee y combos.** Cambiar a tercera persona encaja; A1 antes de A2 puede quitar precisión. Abandonaría si una pulsación larga compromete un ataque no deseado.

**14. Veterano de roguelites.** Las tareas cambian, pero quiero decisiones y recompensas distintas. Abandonaría si las variantes siguen sintiéndose como limpiar oleadas.

**15. Competitivo · busca dominio.** La equivalencia de daño no demuestra igualdad de control entre esquemas. Abandonaría por limitaciones poco claras del esquema simplificado.

**16. Indie experimental · tolera extrañeza.** La identidad surrealista justifica cierta desorientación, no objetivos ambiguos. Abandonaría si simplificar borra la personalidad del mundo.

**17. Narrativo · prioriza personajes.** Tengo una premisa, pero todavía poca relación emocional con HERALDO. Abandonaría si el final contradice el recorrido.

**18. Lector lento · interfaz accesible.** Necesito controlar el ritmo del texto y distinguir una instrucción principal. Abandonaría si un subtítulo desaparece antes de entenderlo.

**19. Experto móvil · pantalla pequeña.** Pausar para cambiar el poder y sostener botones exige precisión táctil. Abandonaría si dedos y efectos ocultan información clave.

**20. Veterano que vuelve tras una pausa.** Necesito recordar capítulo, objetivo y modo sin volver a estudiar el sistema. Abandonaría si retomar obliga a reconstruir el contexto.

## Primeros cinco minutos: recorrido inferido, no captura de una sesión humana

1. **Entrada:** la estación da identidad y una pregunta narrativa. El prólogo 3D termina a los 38,4 s configurados. Tiene un tramo interactivo; no corresponde llamarlo completamente pasivo.
2. **Despertar:** cuatro parlamentos de 4 + 4 + 4 + 4,5 s, más 0,5 s cada uno, añaden aproximadamente 18,5 s. Son unos 56,9 s de secuencia prevista hasta terminar el despertar, sin cargas, pausas ni lectura del tutorial. No es un tiempo de primera baja medido en navegador.
3. **Aprendizaje:** el tutorial explica movimiento, ataque, mantener botones y cambiar modo. Pausa en solitario, algo positivo. Sigue siendo una explicación concentrada, no una práctica gradual que compruebe comprensión.
4. **Primer combate:** la simulación genera enemigos pronto. El jugador tiene que combinar orientación, puntería, vida, objetivo y lectura de amenazas. Los bots no permiten establecer cuánto cuesta a una persona.
5. **Primera recompensa y siguientes tareas:** aparecen elecciones de mejoras y objetivos distintos. Hay diversidad funcional, pero nombres como linaje, órgano, mutación y evolución añaden carga semántica. La variedad necesita también cambios reconocibles de ritmo y propósito.

El escenario especialmente frágil es «quiero jugar ya»: `onSkip` del prólogo llama a `skipIntro(true)`, que termina la introducción en vez de presentar un resumen del despertar. El banner conserva la tarea principal, pero no reemplaza la explicación de conciencia/IA/Huésped.

## Pruebas realmente ejecutadas

Comando reproducible desde la raíz: `node tools/alpha-campaign.js`. Node, simulación a 60 pasos/s, semillas 1001–1020, dificultad 1, cargadores activados, 6 s iniciales de calma, un Axioma en modo disparo, sin mejoras persistentes. Cinco semillas por cada valor de puntería 0,35 / 0,65 / 1 / 1,2. Las semillas distintas impiden atribuir diferencias exclusivamente a skill. El bot usa entradas directas, no pulsa la interfaz simplificada.

- 20 ejecuciones terminaron sin error del script ni posiciones no finitas.
- 18 seguían jugando en la oleada 6 al llegar a 300 s; dos perdieron en la oleada 5, a 226,62 y 205,20 s. Ninguna completó m1 en esa ventana. Esto no mide la probabilidad humana de ganar ni la duración total de campaña.
- Primera baja entre 8,15 y 8,92 s de simulación, media 8,51 s, **excluyendo prólogo y tutorial**.
- Ancla, sintonía y núcleo completados en las 20 sondas. Secuencia iniciada en 18 y completada en 17 antes del corte; la restante seguía activa, no se clasifica como fallo.
- La mayor separación sin bajas durante una fase de oleada fue 17,05 s. Esa medida puede incluir desplazamiento u objetivos; no demuestra enemigos atascados ni ausencia de ese bug en otros mapas.
- No se ejecutaron en esta batería m2, melee, cambio de modo, decisiones de menú ni controles táctiles. La caza de m2 y las transiciones completas quedan fuera de estos resultados. Las pruebas previas de equivalencia de acciones no equivalen a facilidad de manejo.

Datos sin procesar: `docs/vortex-evidence/alpha-campaign-bots.json`. No se calculó FPS a partir de tiempo de CPU headless.

## Hallazgos prioritarios y criterio de cierre

| Prioridad | Hallazgo y evidencia | Cambio recomendado | Criterio para validarlo |
|---|---|---|---|
| P1 | `startSolo` lanza WAKE_SHORT en m2 y este vuelve a ordenar vencer al Coloso después del interludio que anuncia su muerte. Verificado por flujo de código. | Despertar y recordatorio por capítulo. | Ningún texto de m2 pide completar m1; prueba de transición y lectura del recorrido. |
| P1 | Trofeo «De vuelta al andén», título «VOLVISTE AL MUNDO DE LOS VIVOS» y epílogo «El tren pasó de largo» chocan con transferencia sin regreso al pasado. Verificado en `endGame`/`showEnd`. | Un único desenlace: identidad liberada y transferencia. | Todos los textos de victoria son coherentes con ENDING. |
| P1 | Saltar prólogo omite WAKE. Verificado. | Resumen persistente de una frase y objetivo del capítulo. | Quien omite puede explicar quién es y qué busca; validación con personas. |
| P1 | Poder inmediato y definitiva al mantener 360 ms; salto seguido de movilidad; A1 seguido de A2. Verificado en `expandEssentialInput`. | Practicar cada gesto por separado; comparar con diseño de acciones inequívocas antes de cambiar el balance. | Al menos 8/10 nuevos testers ejecutan la acción pedida sin activar involuntariamente otra; umbral de aceptación propuesto, no resultado. |
| P1 | Subtítulos avanzan por tiempo fijo; texto y conceptos densos. Verificado. | Avance manual opcional y resumen consultable. | Texto completo accesible al ritmo elegido, sin perderlo al pausar. |
| P1 | Objetivo de campaña, objetivo temporal y misión opcional exigen jerarquía. Riesgo de diseño; impacto visual no verificado. | Una instrucción dominante con verbo, blanco y progreso; secundarias al desplegar. | 8/10 testers señalan qué hacer y adónde ir sin ayuda en 10 s; criterio propuesto. |
| P2 | Botón poder cambia a usar cerca de ciertas interacciones. Implementación comprobada, confusión hipotética. | Mantener posición y señal inequívoca del contexto; comprobar táctil real. | Ninguna sustitución bajo un dedo ya pulsado; testers identifican la acción antes de tocar. |
| P2 | Elecciones de linaje/órganos/mutaciones/evolución añaden vocabulario temprano. Verificado en tarjetas. | Introducir conceptos progresivamente y describir efecto concreto primero. | Primera elección se comprende sin consultar documentación. |
| P2 | Variantes de objetivos siguen insertadas en oleadas. Verificado. | Vincular cada variante a una consecuencia narrativa y variar momentos de presión/descanso. | Jugadores distinguen el propósito de dos misiones sin usar solo «matar enemigos». |
| P2 | Perseguir enemigos finales y colisiones: preocupación previa del usuario. Esta batería no reproduce ni descarta ambos. | Prueba específica de restos, recorrido y geometría en cada mapa. | Ningún enemigo requerido queda inaccesible; registrar semilla, posición y ruta cuando falla. |

## Retención: qué puede afirmarse

Existe un atractivo hipotético por la identidad y el combate; también riesgo de abandono por confusión, sobrecarga de acciones y repetición. La nota de intención no debe convertirse en «X % vuelve mañana». Las dos muertes automáticas tampoco son abandonos.

Para medirlo: alfa humana separada de 20 participantes, sin ayuda inicial del moderador, registrando entrada, primer movimiento, primera baja, muerte, objetivo, uso de modo y salida. Preguntar a los 5 minutos «¿quién sos?, ¿qué querés conseguir?, ¿qué hacés ahora?, ¿adónde vas?». Recoger respuesta abierta antes de mostrar opciones. Probar lectura con y sin prólogo, PC y iPhone físico; grabar acciones solo con consentimiento. Retención D1 y D7 requiere observar regresos efectivos con denominador de jugadores iniciales, no pedir una intención. Con 20 personas, además, los resultados son exploratorios.

## Recomendación de producción

Antes de añadir más contenido: corregir continuidad de capítulo/final, conservar contexto al omitir la introducción y validar una tarea con cuatro acciones comprensibles. Luego, ejecutar una alfa humana breve en PC e iPhone y observar errores, no solo preferencias. La variedad ya incorporada necesita un jugador que la entienda.

Esta entrega agrega evaluación y sondas reproducibles; no modifica el comportamiento del juego ni declara una mejora de diversión demostrada.
