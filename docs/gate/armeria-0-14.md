# ART GATE — armería 0..14 (Haz, Prisma, Ráfaga, Nova, Aguja, Pulso, Gemelas, Solar, Fractal, Enjambre, Cometa, Vórtice, Lanza, Cetro, Eclipse)

Capturas definitivas en `shots/gate/armas/` (1ª persona con manos, banco `public/weapons.html`):
- `wNN_<low|high>_<844|1280>_<idle|fire>.jpg` y la hoja `sheet_NN.jpg` (arriba Baja 844×390 reposo/disparo, abajo Alta 1280×720 reposo/disparo). Es el estado REAL (agarre de la mano de apoyo por encima del cañón, como lo deja hands.js hoy).
- `shots/gate/armas/agarre-inferior/…` = las mismas capturas con `?over=0` (la mano de apoyo agarra POR DEBAJO del cañón). Es el estado al que se llega si hands.js cambia ese valor por defecto (ver «Cambios requeridos»). Mis notas de abajo se dan para este estado; con el agarre actual el antebrazo tapa la mitad delantera del arma en 10 de las 15 y las notas bajan 1-2 puntos (Silueta y Modelado ≤ 5).
- Escena real (juego completo, Baja): `node tools/gate-armeria.mjs <carpeta> low 0,10` (revisadas Haz y Cometa: se ven grandes y legibles dentro del mapa; sin errores).

Se regeneran con: `node tools/gate-armas.js 0,1,…,14 low,high shots/gate/armas [consulta extra, ej. over=0]` (un solo Chromium), `node tools/costo-armas.js` (gl.info), `node tools/strip-armas.js <id> <low|high> salida.jpg` (tira de retroceso/fogonazo a 1, 3, 6, 10, 18 y 40 cuadros), `node tools/compose-armas.js` + `python3 tools/compose-write.py tools/compose-out.json` (resuelve la composición en pantalla).

## Qué quedó hecho (y qué heredé del agente anterior, que se cortó)
Heredado y revisado: `forge.js` (fábrica común), `arm1.js/arm2.js/arm3.js` (las 15 armas ya rehechas con piezas funcionales: correderas, tambores, bobinas, anillos que giran, cristales con núcleo, pantalla de munición, paneles con calcomanías procedurales). Eso ya estaba bien modelado; lo que fallaba era cómo se VEÍA en pantalla.

Hecho por mí en esta pasada:
1. **Composición** (el problema que reportó el dueño: arma chica, pegada abajo, boca al centro tapando la mira):
   - FOV propio del viewmodel `VM_FOV = 60°` en `weapons-vm.js`: con el FOV vertical 82° del juego, en un celular apaisado (844×390 ≈ 124° horizontales) el arma se veía diminuta. La raíz del arma se ensancha en x/y alrededor de la cámara (como un FOV más cerrado, sin tocar render.js ni la cámara). Se adapta sola si `camera.fov` cambia.
   - `compose.js` (generado): posición/escala/giro por arma resueltos con `tools/compose-armas.js`, que pone la boca en una zona fija de la pantalla (≈ x +0.10…0.16, y −0.12 NDC: a la derecha y debajo de la mira, apuntando levemente hacia ella; el centro queda libre). Cortas (Haz, Pulso, Gemelas) escala 1.4–1.8; largas 1.3–1.6; Nova/Aguja/Lanza (muy largas) 1.15–1.35. El arma ocupa ≈ 40-50 % del cuarto inferior derecho.
2. **Fogonazo inconfundible incluso en Baja** (`weapons-vm.js`, `fx.js`): destello con forma propia por arma (estrella, abanico, anillo, bola…) más grande, halo de color, y un **haz de luz** nuevo (`makeBeam`: dos cintas cruzadas desde la boca hacia donde apunta, siempre de frente) que no depende del bloom. Sin prueba de profundidad: no queda tapado por el brazo. Dura ≈ 0.1–0.2 s. Los de tamaño > 1 (Nova, Cometa, Vórtice, Eclipse) se acotan para que no tapen toda la pantalla. Se corrigió además un bug de `setQuality` (referenciaba `it.flash`, que no existe).
3. **Costo**: los sprites del fogonazo/haz, las esquirlas y los puntos de vapor se ocultan cuando no hay nada vivo, así que el reposo gasta 3-5 llamadas menos que antes.
4. **Materiales** (`kit.js`, `forge.js`): el metal oscuro salía lavanda pálido por un término de «reflejo de estudio» fingido (`hi`) que sumaba blanco aunque el color base fuese casi negro. Ahora el grafito se ve grafito, el reflejo se tiñe con el color canon del arma y los acentos (paneles, circuitos, núcleo) contrastan. Acero de paleta más oscuro. Resultado: «metal oscuro + un color dominante saturado + un acento complementario», como pide la biblia.
5. **Placa trasera automática** (`autoRear` en `forge.js`): desde la 1ª persona se ve la cara trasera del arma; ahora toda arma recibe marco hundido, ventilas, bobina vertical que se enciende al disparar, luz de estado y tornillos (~40 tris en Baja, ~120 en Alta, sin llamadas de dibujo nuevas).
6. **Modelos**: Fractal (carapacho superior con rombos, aletas laterales, cristales), Cetro (tallos y bulbos de savia más gruesos), Gemelas (cañones más separados).

## Notas por criterio (agarre inferior; mín. = nota de la pieza)
Nadie independiente las puntuó todavía (falta el paso 4 del gate): son mis notas, con la vara de shooters actuales y sin inflarlas.

| Arma | Silueta | Modelado | Materiales/luz | Coherencia | Animación/feedback | Costo | Mín. |
|---|---|---|---|---|---|---|---|
| 0 Haz | 7 | 6 | 7 | 7 | 8 | 9 | 6 |
| 1 Prisma | 7 | 7 | 7 | 7 | 8 | 9 | 7 |
| 2 Ráfaga | 7 | 7 | 7 | 7 | 7 | 9 | 7 |
| 3 Nova | 8 | 7 | 7 | 7 | 8 | 8 | 7 |
| 4 Aguja | 7 | 7 | 7 | 7 | 8 | 9 | 7 |
| 5 Pulso | 6 | 6 | 7 | 7 | 8 | 9 | 6 |
| 6 Gemelas | 6 | 6 | 7 | 7 | 7 | 9 | 6 |
| 7 Solar | 7 | 7 | 7 | 7 | 8 | 9 | 7 |
| 8 Fractal | 6 | 6 | 7 | 7 | 7 | 9 | 6 |
| 9 Enjambre | 7 | 7 | 7 | 7 | 8 | 9 | 7 |
| 10 Cometa | 7 | 7 | 7 | 7 | 8 | 9 | 7 |
| 11 Vórtice | 8 | 7 | 7 | 7 | 8 | 9 | 7 |
| 12 Lanza | 8 | 7 | 7 | 7 | 8 | 9 | 7 |
| 13 Cetro | 6 | 6 | 7 | 7 | 7 | 9 | 6 |
| 14 Eclipse | 7 | 7 | 7 | 7 | 8 | 9 | 7 |

**Honestidad: NO llegué a 8 en ninguna.** Mediana ≈ 7, mínimo 6 (Haz, Pulso, Gemelas, Fractal, Cetro). Son modelos procedurales de cajas biseladas, perfiles extruidos y cristales: buenos para un indie estilizado, no la calidad de Destiny 2 / Halo Infinite. Con el agarre actual (mano por encima) las notas de Silueta/Modelado de las armas largas bajan a 5 porque el antebrazo tapa el cañón.

## Costos medidos (gl.info, arma + manos en 1ª persona; `tools/costo-armas.js`)
- **Baja** (reposo → disparando): llamadas 6–12 → 10–15 (15 disparando en Haz, Nova, Aguja, Gemelas y Eclipse) · triángulos 3.1k–7.1k (máx. Nova 7 140 disparando). Dentro de ≤ 16 llamadas y ≤ 8k triángulos, aunque con poco margen en Nova (7.1k) y en las de 15 llamadas.
- **Alta**: 20–26 llamadas (24–29 disparando), 9k–18.5k triángulos (Nova 18.4k). Sin errores ni avisos de consola en las 15 armas × Baja/Alta × 2 resoluciones, ni al cambiar de arma, `setQuality`, `setUpgrades` y `setHandStyle` (prueba de humo).

## Defectos abiertos
- Silueta de Gemelas, Pulso, Fractal y Cetro es la más floja: desde atrás (que es como se ve en 1ª persona) los dos cañones de Gemelas se leen como uno, Pulso es un bloque con cañón, Fractal y Cetro son «varas» finas con mucha parte oculta por la mano.
- El receptor trasero de casi todas es un bloque achaflanado; la placa trasera automática lo mejora pero sigue siendo geométrico (no hay normal maps ni detalle de tornillería fina).
- Algunas piezas «de cristal» (lente de la mira de Aguja, tapa de Solar) son un polígono plano pálido, poco vidrioso.
- Fogonazos de Nova/Prisma/Cometa en el cuadro 1 (pico) casi blanquean la parte central de la pantalla en Alta (el bloom lo amplifica); es intencional («los disparos se ven») pero puede cansar con ráfagas.
- El fogonazo es sólo del lado del arma: la traza del disparo, el impacto y el fogonazo de pantalla son de `combatfx` (no es mío).
- No verifiqué el recorte contra paredes (arma entrando en geometría del mapa) ni el cambio de arma en escena real, sólo en el banco.
- El archivo viejo `guns.js` conserva las versiones antiguas de las armas 0..4 (sin uso; `BUILD` toma `arm1/2/3.js` + `guns3.js`); `guns2.js` tampoco se usa. Se pueden borrar cuando se quiera.

## Cambios requeridos en archivos ajenos
1. **`src/client/weapons/hands.js` (línea ~87, `solveSupport`)**: `const over = QP('over') !== '0';` hace que la mano de apoyo agarre POR ENCIMA del cañón y el antebrazo (grueso) tape la mitad delantera de casi todas las armas largas y la boca donde sale el fogonazo. Con `over=0` (agarre inferior) el arma se ve entera y el brazo queda debajo. Pido que el valor por defecto sea el agarre inferior (`=== '1'` para activar «por encima»). Es una línea. Todas mis capturas de `agarre-inferior/` y mis notas lo suponen.
2. **Antebrazo (hands.js/hand-gear.js)**: es muy grueso y, en Nova, el manguito termina visiblemente cortado a media pantalla (se ve el borde hueco de la manga). Debe extenderse hasta salir del cuadro (≈ 0.6 unidades de arma más) o acabar fuera de pantalla.
3. Ninguno en `render.js`/`main.js`: el FOV del viewmodel se resuelve dentro de `weapons-vm.js` (`VM_FOV`, escala x/y de la raíz). Si alguien pone otro `camera.fov` (zoom de Aguja, por ejemplo) el arma se adapta sola.
