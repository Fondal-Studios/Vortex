# Onboarding (Sprint 1): primer Huésped → cinemática → tutorial

Estado: **implementado y probado en simulación y en Chromium (ver «Pruebas»)**. No probado: iPhone real, personas reales, cooperativo.

## Flujo de primera ejecución
Menú › Campaña › Comenzar → **«Elegí tu primer Huésped»** (`src/client/primer-huesped.js`) → **cinemática de transferencia** (`src/client/transferencia.js`, 24 s) → **tutorial jugable** de «Islas — Despertar» (`src/sim/tutorial.js` + `src/client/tutorial-ui.js`) → oleadas reales.
- El selector aparece una sola vez (antes de Campaña, Misiones, Base o Cooperativo). El elegido se guarda en `perfil.inicial`; **no se cambia** después. Sólo se puede elegir entre Axioma, Vesper y Micelio.
- Se elige Huésped **sólo antes de la misión**: en partida no hay selector (el campo de pruebas, con `H`, es la única excepción y no suma progreso).
- Enlaces de prueba: `?auto=`/`?skipintro` no muestran nada de esto; `?tutorial=1` fuerza el tutorial, `?tutorial=0` lo apaga, `?cine=0` apaga sólo la cinemática.

## Desbloqueo de Huéspedes (`src/sim/desbloqueos.js`)
| Huésped | Campaña | Desafío (arenas, sin dinero) | Tienda (núcleos) |
|---|---|---|---|
| Axioma | cap. 1 Islas (si ya es tuyo: el siguiente inicial que falte) | Voluntad de hierro: ganar con 40+ bajas | no se vende |
| Vesper | cap. 2 Laberinto (idem) | Cazadora del Coloso: derrotar al Coloso en modo Disparo | no se vende |
| Micelio | por reemplazo en cap. 1–2 | Raíz del Coloso: derrotar al Coloso en modo Melé | no se vende |
| Colmena | cap. 3 Jardín | Savia del Jardín: ganar en el Jardín de Carne | 600 (rango 3 de maestría) |
| Danzante | cap. 4 Plaza | Compás de la Plaza: ganar en la Plaza en modo Melé | 600 |
| Seraf | cap. 5 Osario | Lo que el Osario guarda: ganar en el Osario | 500 |
| Singular | cap. 6 Cámara Fractal (final) | Órbita completa: derrotar a la Madre Geoda | 750 (rango 3) |
| Umbra | cap. 6 Cámara Fractal (final, junto a Singular) | Sin ojos que te vean: ganar en el Laberinto | 500 |

Los 3 iniciales llegan en los primeros capítulos aunque hayas elegido otro. Repetir un capítulo no duplica nada. **Ningún Huésped se compra con dinero real**: la Tienda sólo cobra núcleos ganados jugando (hay prueba automática). Los desafíos se evalúan al terminar una misión en solitario (`Perfil.registrarDesafios`).

## Migración de perfiles
`migrarPerfil()` (desbloqueos.js): perfil sin `inicial` **y sin historial** = jugador nuevo; **con historial** (núcleos, maestría, campaña, evolución, inventario, Huésped elegido…) = veterano: conserva los 3 iniciales y todo lo que ya poseía (lógica de `migrarHuespedes` de tienda.js), su inicial es el que tenía elegido o Axioma, y **no repite cinemática ni tutorial**. Versión de perfil: 3.

## Cinemática (24 s)
Vacío de VORTEX → la luz (conciencia) se acerca al cuerpo del Huésped (`createHostBody`) → la transferencia (un resplandor suave, sin parpadeos) → el Huésped despierta. Cuatro líneas de HERALDO como subtítulos; sin tren ni atropello (canon de `VORTEX_STORY.md`). Saltable: primer toque pide confirmar, el segundo salta. «Reducir efectos» / `prefers-reduced-motion`: menos partículas, cámara fija. Arranca al instante; el cuerpo 3D carga en segundo plano.

## Tutorial (~3 min)
Nueve pasos con verificación real (la simulación ve la acción): caminar 8 m · girar la cámara · saltar 2 veces · ataque básico al blanco · destruirlo (disparo o combo) · primera habilidad (movilidad) · esquivar el círculo rojo · usar el terminal (USAR) · curarse con el botiquín. Mientras dura no empiezan las oleadas ni corre el límite de la misión (`game.tutorialT`). Se puede saltar (con confirmación), se guarda el paso y no se repite. La 2.ª habilidad y la definitiva siguen desbloqueándose por oleada (1 y 3) con su aviso didáctico. No agrega botones: el 4.º botón pasa a USAR junto al terminal, como con cualquier interacción.

## Cámara
La 3.ª persona es la cámara inicial en todos los modos. Cambiar Disparo/Melé **ya no cambia la cámara**; Ajustes › «Cámara automática por modo» (apagado) devuelve el comportamiento anterior. El botón de cámara 1.ª/3.ª y la tecla P siguen igual.
