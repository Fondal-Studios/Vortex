# ART GATE — criaturas-1 (Astilla, Geoda, Prisma, Lente, Cuarzo, Espejo, Racimo)

Capturas definitivas: `shots/gate/criaturas/<criatura>.jpg` (izq.: visor Baja arriba / Alta abajo, reposo y ataque; der.: EN ESCENA del juego, Baja, reposo y ataque).
Se regeneran con `tools/criaturas-gate.sh` (usa `tools/criaturas-sheet.mjs` = visor con gl.info y `tools/criaturas-escena.mjs` = escena real m1 con criatura pasiva y estado forzado).

## Qué cambió
- **Bug de suelo (todas las terrestres):** el sim pone el centro a 0.9·r del piso y el modelo tenía los pies en su origen: flotaban. Ahora cada modelo baja 0.9 (`rootObj.position.y = -0.9`) y pisa el suelo.
- **Material común (`geoda-bio.js`):** relleno propio `lift` (no quedan negras en Baja), `rim`, herida continua `uWound` (se engancha a `kit.setWound` de render.js: oscurece y enciende grietas naranjas según 1-hp), compensación de albedo en Media/Alta (antes pastel), `tint()` para llevar el tono al color canon.
- **Geoda:** cerrada era una roca casi negra; ahora cochinilla acorazada violeta con 11 bandas superpuestas y cresta de cristal; abierta, interior magenta con ojo-núcleo naranja (contraste = punto débil). Se quitaron las bolas negras flotantes.
- **Astilla:** de casi negra a quitina verde-azulada con aristas y venas canon 0x44ffd0; escala 1.25 y halo que se enciende al saltar.
- **Prisma:** cuerpo ahora rosa (canon), escala 1.15. **Lente:** amarillo/dorado canon, 0.92. **Cuarzo:** naranja canon, 0.95. **Racimo:** más grande (1.05) y rojizo. **Espejo:** escala 1.2.
- **Avisos más legibles (a 20 m):** Lente (halo y lente del cañón mucho más fuertes), Cuarzo (sacos +46 %, halo, sombrero sube más, larvas arden).

## Notas por criterio (mín. = nota de la pieza)
| Criatura | Silueta | Modelado | Materiales/luz | Coherencia | Animación | Costo | Mín. |
|---|---|---|---|---|---|---|---|
| Astilla | 8 | 7 | 7 | 8 | 8 | 9 | 7 |
| Geoda | 8 | 7 | 7 | 8 | 7 | 9 | 7 |
| Prisma | 8 | 7 | 7 | 8 | 8 | 9 | 7 |
| Lente | 9 | 8 | 7 | 8 | 8 | 9 | 7 |
| Cuarzo | 7 | 7 | 7 | 7 | 8 | 9 | 7 |
| Espejo | 7 | 8 | 7 | 7 | 8 | 9 | 7 |
| Racimo | 8 | 7 | 6 | 7 | 8 | 9 | 6 |
Honestidad: no llegué a 8 de mínimo en ninguna. Son procedurales estilizadas, buenas para un indie, no AAA. Ninguna nota la dio un crítico independiente (falta ese paso del gate).

## Costos medidos (gl.info, visor, una criatura sola)
Baja: Astilla 11 calls / 4.2k tris · Geoda 7 / 5.0k · Prisma 11 / 2.7k · Lente 8 / 2.9k · Cuarzo 13 / 4.0k · Espejo 12 / 3.9k · Racimo 10 / 2.9k. Alta: 7–14 calls, 6.5k–14k tris (Geoda 13.9k). Todo dentro de ≤40 calls y ≤15k tris. Sin errores de consola. En escena Baja: ~40–45 calls y ~31k tris totales con la criatura (mapa incluido).

## Defectos abiertos
- Racimo en Alta sigue durazno/naranja pálido (membranas translúcidas aclaradas por el entorno), no carmesí.
- Espejo camuflado (st.c) a 10 m es muy tenue; es intencional pero casi ilegible.
- Geoda abierta: las bandas se ven como astillas finas de canto; ojo a veces tapado por el párpado en el parpadeo.
- Geoda: el sim no avisa la apertura (roll→open sin estado previo), no hay anticipación posible desde el cliente.
- Cuarzo: cara pequeña, aspecto "hongo" más que "madre-pólipo".
- No se verificó muerte (la hace render.js) ni élite (m.el).
- Alta en escena real no capturada (sólo Baja en escena).

## Cambios requeridos en archivos ajenos
- Las demás criaturas de pie (Ariete, Obelisco, etc.) probablemente flotan igual: aplicar `root.position.y = -0.9` (o que render.js baje el pivote 0.9·m.r).
- `kit.setWound` no afecta materiales sin `uWound`; los míos ya lo tienen. Nada más.
