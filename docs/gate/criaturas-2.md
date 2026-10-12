# ART GATE — criaturas-2 (Gravitón, Obelisco, Aurora, Ariete, Espiral + jefes Coloso Prismático y Madre Geoda)

Capturas definitivas en `shots/gate/criaturas/` (se regeneran con `EXTRA=1 bash tools/criaturas2-gate.sh`; un solo Chromium, GL por software, ~25 min):

| Archivo | Qué muestra |
|---|---|
| `graviton.jpg`, `obelisco.jpg`, `aurora.jpg`, `ariete.jpg`, `espiral.jpg` | izq.: visor **Baja** (arriba) y **Alta** (abajo), reposo y ataque · der.: **EN ESCENA** real del juego (Baja, mapa 1), reposo y atacando |
| `coloso.jpg` | visor Baja: reposo · aviso del anillo (`wind`) · rayo del vacío (`ray`) · aturdido (`stagger`) · fase 2 (hp 50 %) · fase 3 (hp 20 %) |
| `coloso-escena.jpg` | EN ESCENA (IA real, mapa 1): reposo, rayo hacia el pilar marcado, aturdido, fase 2, fase 3 y la vista del jugador a nivel de suelo |
| `madre.jpg` | visor Baja: cerrada (`fire`) · con presión · escapando vapor (`vent`) · pariendo (`gestate`) · abierta (`open`) |
| `madre-escena.jpg` | EN ESCENA (IA real, mapa 2): cerrada con presión 10 % y 95 %, abierta, pariendo, válvulas |
| `combate-baja.jpg`, `combate-media.jpg` | fotograma de combate en PRIMERA PERSONA (la vista real) con cinco criaturas atacando a 14–32 m, calidad Baja y Media |
| `jefes-media.jpg` | los dos jefes EN ESCENA en calidad Media (con bloom y mapa de entorno) |

Herramientas nuevas (mías): `tools/criaturas2-sheet.mjs` (visor con medición, `&noface=1` para ver los jefes de lado), `tools/criaturas2-escena.mjs` (cámara libre en la escena real, IA real para jefes, mide hueco con el suelo), `tools/criaturas2-fp.mjs` (primera persona), `tools/criaturas2-tune.mjs` (calibra materiales EN ESCENA Media/Alta), `tools/criaturas2-test.mjs` (**prueba automática**: construye todo en Baja/Media/Alta, recorre todos los estados con vida alta/baja/escudo/aturdido, falla si hay excepciones, NaN o se pasa del presupuesto), `tools/criaturas2-gate.sh`.

## Qué estaba roto o a medias y qué se hizo

**Hallazgos de motor (afectan al juego, los resolví dentro de los modelos):**
1. **La caja de impacto del sim no coincidía con el Obelisco.** El sim usa una esfera de radio `r` centrada a 0.9·`r` del suelo (hitscan: 1.05·r + 0.35 + 0.012·distancia). El Obelisco tenía el ojo a ~4.5 m del piso (fuera de la esfera): **disparar a la cabeza no pegaba**. Ahora es más compacto (3–4 vértebras en vez de 5) y el ojo queda dentro de la caja; lo fino que sobresale (antenas de cristal) es sólo adorno.
2. **Los jefes miraban de canto.** `render.js › orient` sólo orienta en el plano horizontal (`m.u × m.f`): con el jugador muy abajo (Coloso, 34 m de altura) veías el lomo/vientre y no el ojo; en el Mapa 2 (jugador a 84 m *debajo* del jefe, `m.f` casi paralelo a `m.u`) la Madre quedaba **de canto, con la ventana abierta invisible**. Archivo nuevo `src/client/creatures/boss-face.js`: el cuerpo gira entero hacia la cámara en 3D (con «arriba» continuo, sin vuelcos). En el rayo del Coloso mira al pilar marcado, no a la cámara.
3. **Pastel en Media/Alta.** El sol, el bloom y el mapa de entorno del juego aclaraban el albedo (el Ariete parecía un cangrejo cocido). `bioMaterial` (en `obelisco-mat.js`) ahora baja albedo/relleno/clearcoat/rim en Media/Alta y sube el `lift`, **calibrado en escena** con `criaturas2-tune.mjs`. Baja queda como estaba.
4. **`setWound` no hacía nada en estas siete** (ningún material tenía `uWound`). Ahora el material bio trae heridas: manchas chamuscadas con borde incandescente que crecen con 1 − vida/vida máx.
5. **Visor del bestiario** (`src/client/viewer.js`, ajeno, 2 líneas): en Baja ya no pone mapa de entorno (el juego tampoco) → antes todo se veía lavado; pasa `viewer:true` a `tick` para que los jefes del bestiario sí puedan girarse.
6. Pies/suelo (lo que avisó criaturas-1): **Ariete y Obelisco medidos EN ESCENA** (`floorGap` ≈ 0): pisan el suelo; no flotan. Las voladoras no tienen suelo.

**Por criatura**
- **Gravitón:** ojo con párpado visible (no negro), tamaño ×1.35 (se lee a 20–30 m), onda de choque ×2 más grande (aviso del alcance real), calibrado en Media.
- **Obelisco:** ojo dorado con iris fibroso (acento complementario del cuerpo cian; se vuelve rojo al fijar el blanco), ya no es una bola negra con iris; pétalos-garra anchos de verdad (antes eran agujas de canto); armadura de las vértebras en quitina oscura con grietas luminosas (antes cintas blancas tipo «vendas»); antenas-lanza de cristal y baliza de luz para leerlo a 40–60 m; compacto para la caja de impacto.
- **Aurora:** ondas de curación hasta el alcance real (≈18 m), ×1.45, anillos menos opacos (en primera persona tapaban media pantalla).
- **Ariete:** el mejor de los cinco: heridas visibles (manchas ardientes), calibrado en Media (antes salmón pálido). Cuerno que apunta y arde hacia el jugador al avisar (muy legible de frente).
- **Espiral:** concha más clara y lavanda (el canon es 0xb48cff; antes casi negra), ×1.4.
- **Coloso:** gira hacia la cámara; ojo con iris visible (pupila más pequeña) y párpado ámbar (en el aturdimiento era una bola negra-morada); fases, escudo de resonancia, rayo hacia el pilar y aturdido confirmados EN ESCENA.
- **Madre:** rehecha la geometría de los pétalos: conchas **acopadas** con nervio central; **cerrada = botón blindado de lima con costuras que arden con la presión** (de lima a rojo), **abierta = flor carmesí con venas de lima y un ojo enorme** (el punto débil se ve desde 80 m); pupila menos dilatada, núcleo más grande, resplandor concentrado en el ojo (en Media un halo grande la dejaba color durazno).

## Notas por criterio (mín. = nota de la pieza)
(ver tabla al final; completada tras la revisión visual de las hojas)

## Costos medidos (gl.info del visor, Baja, una criatura sola) y prueba automática
Ver `/tmp/cgate2/*.txt` (regenerables) y la salida de `node tools/criaturas2-test.mjs`.

## Defectos abiertos
(ver abajo)

## Cambios requeridos en archivos ajenos
(ver abajo)
