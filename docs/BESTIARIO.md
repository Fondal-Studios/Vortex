# Bestiario

Ocho criaturas + dos jefes. Todas son **cristal**: modelos 3D procedurales (prismas, octaedros, icosaedros, anillos) con un shader facetado de iridiscencia (`src/client/shaders.js › crystalMaterial`). Cada una tiene **rol**, **patrón legible**, **debilidad**, **animación**, **voz** (síntesis WebAudio) y **pruebas** en `tests/ai.test.js`.

| Criatura | Rol | Vida¹ | Patrón (lo que el jugador lee) | Debilidad / consejo | Voz |
|---|---|---|---|---|---|
| **Astilla** | Corredor | 24 | Zigzag veloz; salta cuando está a 7–18 u. Muerde 8 | Frágil: Haz/Ráfaga | chirrido cuadrado agudo |
| **Geoda** | Tanque | 300 | Rueda **cerrada** (casi inmune, 20 % daño) y cada 4,8 s se **abre ~2 s**: quieta y brillante | Dispará sólo con la geoda abierta; Nova/Aguja | rugido grave |
| **Prisma** | Volador | 58 | Orbita alto, **brilla 0,7 s** (aviso) y pica a 30 u/s | Disparar durante el aviso | tono ascendente |
| **Lente** | A distancia | 72 | Mantiene 20–32 u; su lente **se enciende 0,6 s** antes del disparo (proyectil lento y esquivable) | Cubrirse / ráfaga de lado | barrido sinusoidal |
| **Cuarzo** | Invocador | 95 | Huye; **canaliza 1 s** (cristales crecen) y suelta 2 Astillas (máx. 4 vivas) | Matarlo primero | acorde triangular |
| **Espejo** | Emboscador | 62 | **Casi invisible** a distancia; parpadea detrás del jugador (aviso: giro de paneles 0,6 s) | Se revela 2 s al recibir daño; mirar atrás al oír el timbre | timbre agudo |
| **Racimo** | Explosivo | 26 | Corre recto y detona (36 u. de daño en área). **Explota al morir** y daña a vecinos | Matarlo lejos; usarlo contra la horda | pitido cuadrado |
| **Gravitón** | Control | 115 | Flota; **carga 1,3 s** (anillo expansivo) y **invierte la gravedad** de todos 3,5 s | Prioridad de objetivo | zumbido que sube |
| **Coloso Prismático** (jefe M1) | Jefe | 3000 | 3 fases: anillos de orbes con huecos (aviso 0,8 s) → + ráfagas dirigidas y refuerzos → + pulsos de gravedad | Núcleo siempre vulnerable | bajo + ruido |
| **Madre Geoda** (jefe M2) | Jefe | 3200 | Ciclo: **cerrada** (15 % daño) lanza espirales; **abierta** (vulnerable) pare Racimos. Fase 3 invierte la gravedad | Castigar la ventana abierta | tono profundo + armónico |

¹ Vida base en oleada 1; escala +7 % por oleada (jefes: +70 % por jugador extra).

**Costos y desbloqueos** (`src/sim/data.js`): cada oleada tiene un *presupuesto* repartido entre las criaturas habilitadas (sorteo inversamente proporcional al costo, con tope para las caras: Geoda ≤ 1+n/2, Gravitón/Cuarzo ≤ 1+n/3).

**Revisión visual:** `shots/monstruo-*.jpg` y `shots/bestiario-completo.jpg` (se generan con `npm run shots`).
