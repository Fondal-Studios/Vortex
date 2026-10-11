# Mapas

Cada mapa tiene arte propio, música propia (generativa), oleadas progresivas, un jefe y mecánicas de física rota exclusivas. Las definiciones (geometría, zonas, gravedad) viven en `src/sim/maps.js` y las **comparte** la simulación y el render.

## Mapa 1 — Vacío de Islas (perdido en el espacio / otra dimensión)
Islas flotantes sobre un vacío estrellado con formas gigantes que giran a lo lejos (guiño a OReilly: escalas imposibles).
- **Gravedad zonal.** El suelo central es normal; el resto cambia según dónde pisás:
  - **Ascensor invertido:** el círculo cian de una isla invierte la gravedad; caés *hacia arriba* a una isla-techo y caminás cabeza abajo. Al salir del círculo volvés a caer.
  - **Esfera sin gravedad:** flotás y conservás el impulso.
  - **Planetoide con gravedad propia:** se camina por toda su superficie (el «abajo» apunta al centro).
  - **Burbujas de tiempo lento:** las criaturas dentro se mueven al 30 %.
  - **Portales:** pares bidireccionales entre islas y planetoide.
  - **El vacío:** caerse cuesta 25 de daño y reaparecés en la isla central.
- **Oleadas:** 6 + jefe (Coloso Prismático sobre la isla central).
- **Música:** escala lidia, pads y arpegios con eco largo.

## Mapa 2 — Cámara Fractal (decisión propia, ver D-05)
Una **esfera hueca** de 85 u de radio: se camina por el *interior* y el suelo está en todas partes. Sobre el cascarón crecen colinas y espigas de cristal; el cascarón «respira» con un shader fractal.
- **Gravedad radial** hacia el cascarón: podés caminar hacia arriba por las paredes y cruzar el «techo».
- **La marea:** cada 60 s (aviso a los 47 s, cero-G de 50 a 59 s) la gravedad se apaga: las criaturas terrestres flotan y el combate pasa a 3D. Es exclusiva de este mapa.
- **Oleadas:** 6 + jefe (Madre Geoda, flotando en el centro).
- **Música:** escala frigia, bajo pulsante más agresivo.

**Por qué distinto del Mapa 1:** el primero es *geometría fragmentada con reglas locales*; el segundo es *una sola superficie continua con una regla global que cambia en el tiempo*. Cambia el movimiento, la lectura del espacio y el tipo de amenaza (la horda llega por todos lados, no por una isla).
