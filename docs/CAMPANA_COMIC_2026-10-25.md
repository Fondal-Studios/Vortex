# Campaña: Fragmentos — cómic y ritmo

## Alcance implementado

La transferencia inicial y los seis cierres de capítulo usan una secuencia de viñetas estáticas. Hay cinco viñetas iniciales y tres o cuatro por cierre. Lectura manual por defecto, anterior/siguiente, selección de viñeta, teclado, mando, lectura automática opcional y salto con doble confirmación. No se añade vídeo, generación de imágenes, voz sintética nueva ni un segundo contexto WebGL. El mundo 3D deja de renderizarse mientras el cómic cubre la pantalla.

La apertura muestra el bucle y la fractura antes de explicar nada. El protagonista expresa «quiero vivir» y recibe un objetivo inmediato: sobrevivir y buscar una salida. La explicación del voluntariado y del origen común de Heraldo permanece en Osario; ambos lo descubren gradualmente y no deben reunificarse.

| Momento | Qué entiende el jugador |
|---|---|
| Entrada | Algo se fragmentó durante una transferencia; tengo otro cuerpo y quiero sobrevivir. |
| Después de Islas | Una voz familiar responde desde el Laberinto. |
| Después de Laberinto | Algunas entidades enfrentadas contienen conciencias humanas asimiladas. |
| Después de Jardín | Hubo años de guerra y un acuerdo entre mundos. |
| Después de Plaza | Protagonista y Heraldo recuerdan partes de una misma experiencia. |
| Después de Osario | Entramos voluntariamente; Heraldo nació de un fragmento fusionado con IA y tiene voluntad propia. |
| Final | Se abre una salida; quedan cautivos y las dos identidades continúan siendo independientes. |

No se presenta el rescate de jefes como una mecánica terminada. Los recuerdos conservan su consulta en el códice. Las misiones independientes no reproducen los cierres de la campaña.

## Arte reutilizado y límite visual

Referencia consultada en Fondal-Studios/Duelo-Arcano: `assets/ui/logo/arcanum-portada.svg`, rama main. Se retoman el violeta oscuro, oro/papel cálido y acentos de luz. Se componen viñetas con bordes de tinta, trama y cartelas, usando los retratos actuales de los ocho huéspedes, los seis fondos de arenas, la hoja de bestiario y la captura existente del Heraldo (`shots/heraldo-custodio.png`, reutilizada en `public/art/story-heraldo.png`).

Es una composición de cómic con recursos actuales, **no una nueva colección de ilustraciones dibujadas**. No se generaron imágenes con IA. Si luego se decide mejorar la ilustración, se pueden sustituir los recursos de cada viñeta sin rehacer el guion ni el reproductor. El huésped del laboratorio usa por ahora el retrato de respaldo Axioma; la escena no pretende representar su diseño personalizado.

La tarjeta Campaña deja de usar `historia.jpg`, que incluía el subtítulo del tren cancelado. Usa Islas. El encuadre ampliado de las viñetas evita los bordes con HUD de las capturas heredadas.

## Duración: extensión medida, no espera obligatoria

`campaignConfig()` deriva una configuración propia sin mutar las misiones independientes. Sólo los tramos de combate/evento tienen 15 segundos más de distribución y 20% más de presupuesto de enemigos, aproximadamente manteniendo su densidad. No se aumenta vida de jefes ni se alargan objetivos o tiempos máximos. No se obliga a leer durante un mínimo de segundos.

Comparación emparejada con Axioma tirador, semilla 1, mismo bot y motor, sin progresión de equipo acumulada entre capítulos:

| Capítulo | Configuración anterior | Nueva campaña |
|---|---:|---:|
| Islas | 8,26 min | 9,02 min |
| Laberinto | 10,30 min | 10,78 min |
| Jardín | 10,06 min | 10,57 min |
| Plaza | 9,27 min | 10,52 min |
| Osario | 9,68 min | 10,48 min |
| Fractal | 9,92 min | 10,78 min |
| Total de combate | **57,50 min** | **62,15 min** |

Las doce partidas se completan. Datos: `docs/vortex-evidence/campaign-comic/pace.json`; reproducción: `node tools/audit/campaign-pace.mjs`. El tiempo de lectura es adicional y depende del jugador. Este control no demuestra cuánto tardará un humano con equipo avanzado: la partida de media hora reportada por Nano requiere comparar su progreso/equipamiento. No se anuncia una duración humana de una hora garantizada.

## Verificación

Resultados de pruebas se adjuntan en `docs/vortex-evidence/campaign-comic/`. La prueba de transición fuerza el estado de victoria para comprobar navegación, progreso y cierre; no se cuenta como una partida ganada por un bot. Las simulaciones de duración sí recorren las etapas y el jefe final.

Pendientes del rework amplio: Islas enfocada principalmente en supervivencia, objetivos dominantes distintos por capítulo, rescates especiales y medición con jugadores físicos. Este bloque entrega la narración visual y un ajuste moderado de duración; no declara terminado todo ese rework.

### Resultado del bloque

- 31 pruebas de guion, canon, recuerdos, configuración y duración: pasan.
- 23 pruebas de guardado, ledger y ruta: pasan.
- 3 pruebas de navegador de cómic/transición/códice: pasan. Se repiten las 2 del cómic tras el ajuste visual final: pasan.
- Onboarding completo (elección de Vesper → cómic → tutorial → combate → recarga): pasa, 216,6 s en Chromium por software.
- Cuatro tamaños comprobados: 1280×720, 844×390, 667×375 y 390×844. Capturas revisadas en `shots/campaign-comic/`.
- Build estático correcto: 49,3 MB. No se declara aprobada la suite global ni rendimiento en teléfono físico.
