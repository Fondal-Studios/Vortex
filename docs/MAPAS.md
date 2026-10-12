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

## Mapa 4 — Jardín de Carne (planeta orgánico: los caminos crecen)
Ocho plataformas de tejido vivo con desniveles reales (de la Siembra a +3 hasta el Mirador a +12) unidas por rampas y puentes que parecen haber «crecido» entre ellas. `src/sim/map4.js` define la geometría (todo lo que se pisa es un disco: rampas = cadenas de discos que suben ≤ 0,5 u por paso, así se camina sin saltar), `src/client/env/map4.js` la dibuja EXACTAMENTE sobre esos discos.
- **Espacio táctico:** El Corazón (centro, 5 columnas-nervio altas de cobertura + 3 quistes bajos + grada), la Siembra (aparición, defendible), la Garganta (oeste), la Terraza → el Mirador (punto de observación elevado, callejón sin salida), la Cámara del Latido (este, con un **foso** en el centro: zona de riesgo), el Vivero (sureste) y el Umbral (isla del este, sólo alcanzable con el puente cultivado). Hay rutas alternativas (Siembra → Corazón directo o por la Garganta; Corazón → Cámara directo o por el Vivero). Caerse al vacío cuesta 25 de vida y reaparecés en la Siembra.
- **Acertijo «Cultivo: puente vivo»** (`src/sim/cultivo.js`, oleada 2): hay 3 capullos (Vivero, Garganta, Mirador). Se **alimentan disparándoles** (cada impacto suma daño/900, tope 50 por impacto: ~40 tiros de Haz). Sin comer 4 s se marchitan y las criaturas terrestres cercanas los **roen**. Al 100 % **florecen** (quedan fijos) y hacen crecer un tramo (7 discos, 5 s) del puente entre la Cámara del Latido y el Umbral; hasta que no están los 3 tramos el Umbral es inalcanzable (los discos aún no son sólidos y se ve su «fantasma»). Al completarse: cofre del Umbral (vida + munición) y la oleada 5 trae el **Núcleo de memoria**, cuyo altar está en el Umbral. Si se acaba el tiempo (260 s) el progreso se conserva y la oleada 5 repite el Cultivo.
- **Pistas progresivas:** a los 45 s sin que ningún capullo coma, un marcador señala el capullo más cercano; a los 90 s, otra pista explica la regla; a los 135 s se marca dónde nacerá el puente (cada una, 45 s después de la anterior; alimentar reinicia la cuenta).
- **Feedback:** el capullo se abre y se enciende un punto más de su anillo de 12 por cada 8 %; tiembla y se pone rojo si lo roen; al florecer estalla en verde ácido y emite un faro de luz; cada tramo del puente nace con discos que brotan uno a uno.
- **Oleadas:** 6 + jefe (Argos, el Ojo Primordial, sobre El Corazón: las columnas frenan su Mirada). Criaturas terrestres siguen rampas y puentes (grafo de rutas) y no caminan al vacío; los bots de prueba (`tests/map4.test.js`) completan el mapa.
- **Visual (Baja):** suelo de tejido con venas que laten desde el Corazón y se encienden cerca de vos, tallos/raíces nerviosas que se retraen y brillan cuando te acercás (todo por uniformes, sin objetos nuevos por cuadro), hongos y cristales bioluminiscentes, membranas translúcidas, bancos de niebla bajo las plataformas, planetas de carne lejanos y un cielo propio (rojos profundos, magentas, verde ácido). Capturas: `node tools/shot-map4.js shots/map4 low`.
