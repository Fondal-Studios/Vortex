# VORTEX — Estructuras físicas y señalización de objetivos (diseño aprobado para implementación)

## Estado real
Los textos de objetivos de `src/sim/mision-config.js` se actualizaron en esta rama. **No se han creado aún mallas 3D, marcadores HUD nuevos ni una interacción explícita de inserción.** La lógica actual sigue usando `plate`, `ancla`, `core` y `altar` en `src/sim/objectives.js`.

## Contrato visual por objetivo
| Mecánica actual | Estructura 3D propuesta | Marcador HUD | Estado visible |
|---|---|---|---|
| secuencia | Consolas de datos y terminales | COMPUTADORA 1/3, 2/3, 3/3 | pendiente/conectando/conectada |
| secuencia en capítulos avanzados | Central de archivos | ARCHIVO | descarga 0–100 % |
| nucleo | Núcleo transportable + reactor con receptáculo | NÚCLEO → REACTOR | en suelo/transportado/insertado |
| ancla | Ancla de realidad, servidor, antena, reactor o incubadora según capítulo | DEFENDER + nombre | integridad + progreso de estabilización |
| sintonia | Placas de sincronización | PLACA A/B/C | activación y tiempo restante |
| cultivo | Incubadoras biológicas | INCUBADORA | crecimiento y amenazas |

## Reglas de implementación
1. Las estructuras son objetos físicos visibles desde primera y tercera persona; no solo iconos flotantes.
2. Los marcadores 3D y el minimapa deben distinguir objetivo principal, secundario y estructura dañada. Distancia solo si hay coordenadas verificadas.
3. HUD compacto: acción + estructura + progreso + integridad si corresponde. Indicador de interacción contextual a distancia útil.
4. El núcleo debe insertarse físicamente en un receptáculo: proximidad + interacción, con animación, confirmación servidor y estado replicado. Actualmente basta acercarse al altar; reemplazarlo sin romper el pase cooperativo ni la recuperación tras caída.
5. Defensas por capítulo: m1 ancla de realidad, m3 antena de vigilancia, m4 incubadora biológica, m5 servidor de memoria, m6 estabilizador genómico, m2 reactor de transferencia.
6. Cada variante debe mantener el contrato de derrota por destrucción y progreso de defensa. No crear mecánicas no validadas que bloqueen el capítulo.
7. Accesibilidad: texto además de color, símbolos distinguibles y opción de reducir destellos.

## Pruebas obligatorias
- Interacción de terminales en orden, coop y solitario.
- Núcleo: recoger, transferir, caer, recuperar, insertar una sola vez, desconexión del portador.
- Defensa: integridad sincronizada, destrucción, victoria, daño y señalización correcta.
- HUD en 390×844 horizontal, 1280×800, primera y tercera persona, distancia, oclusión y prioridad de marcadores.
- Rendimiento móvil físico y regresión de los objetivos existentes.

## Prioridad de implementación
P0: modelos proxy de consola/reactor/ancla + HUD + inserción confirmada.
P1: variantes por capítulo y animaciones.
P2: arte final, sonido y VFX.
