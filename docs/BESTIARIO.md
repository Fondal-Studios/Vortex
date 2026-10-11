# Bestiario — organismos del Vórtice

Catorce **organismos** (12 criaturas + 2 jefes), no formas geométricas: mitad **carne**, mitad **biocristal**. Cada uno **respira**, **parpadea**, **mira al jugador** con ojos húmedos, se mueve con peso (resortes, cinemática inversa en las patas, tentáculos que ondulan por shader), cojea cuando le queda poca vida, tiene un **aviso legible** antes de cada ataque y reacciona al daño. Todo es procedural (sin modelos importados): el kit común está en `src/client/organism.js` y cada criatura en `src/client/creatures/<nombre>.js`.

| Criatura | Rol | Vida¹ | Qué es | Patrón (lo que se lee) | Consejo |
|---|---|---|---|---|---|
| **Astilla** | corredor | 24 | Depredador-insecto de biocristal | zigzag, salta a 7–18 u, muerde | frágil |
| **Geoda** | tanque | 300 | Almeja acorazada, ojo-núcleo | rueda cerrada (20 % daño); cada ~5 s se abre ~2 s | dispará solo abierta |
| **Prisma** | volador | 58 | Mantarraya-polilla de alas translúcidas | orbita, **brilla 0,7 s**, pica | disparar en el aviso |
| **Lente** | a distancia | 72 | Ojo gigante sobre un tallo | la lente **se enciende 0,6 s** y dispara un proyectil lento | esquivar de costado |
| **Cuarzo** | invocador | 95 | Madre-pólipo con sacos de huevos | los sacos se hinchan **1 s** y suelta 2 Astillas | priorizarlo |
| **Espejo** | emboscador | 62 | Camaleón de piel espejada | casi invisible; parpadea detrás tuyo (gira 0,6 s antes) | se revela 2 s al recibir daño |
| **Racimo** | explosivo | 26 | Racimo de vejigas de gas | late más rápido al acercarse y estalla (36 de área) | matarlo lejos; daña vecinos |
| **Gravitón** | control | 115 | Embrión flotante | **carga 1,3 s** y invierte la gravedad 3,5 s | prioridad alta |
| **Obelisco** | francotirador | 140 | Torreta-planta con ojo-flor | **línea láser 1,6 s**, se fija 0,4 s antes y dispara un rayo veloz | moverse al fijarse |
| **Aurora** | sanadora | 90 | Medusa-ángel | canaliza 0,9 s: cura 30 % y escuda (×0,5) a aliados | matarla primero |
| **Ariete** | embestidor | 190 | Escarabajo-rinoceronte acorazado | patea 1 s, embiste en línea recta, queda **aturdido** (×1,5) | hacerse a un lado |
| **Espiral** | atractor | 120 | Nautilo de concha en espiral | carga 0,8 s y **arrastra** a los jugadores 2,6 s | resistir alejándose |
| **Coloso Prismático** | jefe (Vacío de Islas) | 3000 | Leviatán-ojo flotante, ~26 ojos, 10 tentáculos, anillos | 3 fases: anillos de orbes (aviso 0,8 s) → refuerzos y ráfagas → pulsos de gravedad | el núcleo siempre es vulnerable |
| **Madre Geoda** | jefe (Cámara Fractal) | 3200 | Flor-útero colosal | cerrada (15 % daño) dispara espirales; abierta pare Racimos | castigar la ventana abierta |

¹ Vida base en la oleada 1; escala +7 % por oleada (jefes: +70 % por jugador extra).

## Cómo se construyen (arte)
- **Piel viva** (`fleshMaterial`): PBR con sheen, clearcoat e iridiscencia; el vértice se deforma con ruido (respiración y pulso), el fragmento dibuja una red de venas y lunares **bioluminiscentes**.
- **Ojos** (`eye`): esclerótica húmeda, iris y pupila que siguen al jugador, párpados y parpadeo independiente.
- **Tentáculos** (`tentacle`): una sola malla que ondula por shader (1 draw call); **patas** con IK de 2 huesos; **mandíbulas** con dientes; **biocristales** que brotan de la piel.
- **Muerte**: la criatura se desinfla y estalla en esquirlas sólidas con ícor luminoso (sin gore).
- **Calidad Baja** (iPhone): menos segmentos, materiales estándar, sin aristas luminosas.

## Honestidad sobre el nivel visual
Son organismos procedurales de aspecto estilizado: **no alcanzan el nivel de modelos de un estudio AAA** (no hay escultura, texturas pintadas ni animación por esqueleto de animador). Lo más flojo según la revisión: el **Ariete** (patas gruesas, algo de «globo»), el **Obelisco** (tallo de «perlas»), y varios ojos aún muy caricaturescos. Capturas de cada uno en `shots/` y en el bestiario del juego (menú ▸ Bestiario, con vista 3D).
