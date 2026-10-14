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

## Mapas del limbo robados de ARCANUM (5 y 6)
Dos escenarios de ARCANUM (`/duelo-arcano`, sólo lectura) rehechos como **arenas del limbo**: escenarios MUERTOS pero ALUCINADOS
(psicodelia a pleno sobre materiales con textura). Física: arenas **planas y cerradas** (sin vacío, sin laberintos), muros de borde
altos, coberturas simples (cajas y cilindros) y una zona de **gravedad rota leve** (35 %: saltás alto y flotás). Código común de
simulación: `src/sim/limbo.js` (`makeLimboArena`: salas, muros, coberturas, grilla de navegación con caminos más cortos para
criaturas y bots, `guard` para rodear coberturas, spawns dentro de la arena; el piso sólo llega hasta los muros: lo que se escapa cae
y desaparece). Visual común: `src/client/env/limbo-kit.js` (material «muerto» con grietas de luz que cambian de color, cielo
alucinado con geometría sagrada, raíces luminosas, objetos flotantes, charcos y rayos de luz, chorros que suben).
Para agregar otro: definí salas/muros/coberturas/zonas en `src/sim/mapN.js` con `makeLimboArena`, registralo en `maps.js` y
`data.js` (WAVE_PLANS, BOSS_OF, OBJECTIVE_PLAN), y dibujalo en `src/client/env/mapN.js` (export `build(r, map)`; `render.js`
lo carga con `loadLimbo`).

### Mapa 5 — Plaza de los Ecos (de la Praga de ARCANUM: `src/world/praga.js`, `praga-build.js`)
La calle empedrada desemboca en la plaza del reloj: fachadas barrocas pastel (sus perfiles de cornisa, imposta y frontón están copiados
de `praga-build.js`), faroles de hierro, las torres de Týn al norte (con las puntas despegadas, flotando), la torre del Reloj con el
reloj astronómico detenido y el portal del más allá a su pie, la fuente cuyo agua **cae hacia arriba**.
- **Espacio táctico:** la Calle (sur, aparición, embudo defendible) → la Plaza (rectángulo abierto) con LA FUENTE en el centro (zona de
  gravedad rota, r 10), los Soportales al oeste (corredor cubierto por pilares), la torre del Reloj al este y cuatro cuadrantes con UNA
  cobertura alta (pedestal / quiosco) y UNA baja (puesto / carro) cada uno. Bordes: fachadas continuas de 18 m.
- **Objetivos:** oleada 2 Sintonía (placas en cuadrantes opuestos), 3 y 6 Ancla (frente a la boca de la Calle), 5 Núcleo (de los
  Soportales al portal del Reloj, cruzando la fuente). **Jefe:** El Mandinga (resonadores en anillo alrededor de la fuente).
- **Folclore — qué almas penan acá y por qué:** una ciudad que se murió de noche, con las luces prendidas. Las **Ánimas** son los
  transeúntes que siguen caminando la calle; la **Luz Mala** y los **Fuegos Fatuos** son las llamas de los faroles que se apagaron y
  salieron a buscar quién las encienda; la **Llorona** llora en la fuente; los **Pombero** se esconden en las sombras de los
  Soportales; las **Viudas** miran desde las ventanas; la **Salamanquera** es lo que quedó de los alquimistas de Praga; el **Lobizón**
  sale del callejón y el **Silbón** llega al final. Arriba de todo, el **Mandinga**: el pacto que el relojero firmó para que el reloj
  nunca se detuviera… y se detuvo. (`WAVE_PLANS.m5`: astilla, prisma, racimo, lente, espejo, obelisco, cuarzo, ariete, espiral.)

### Mapa 6 — Osario sin Techo (del osario de Sedlec de ARCANUM: `prague-route.js`, `escenografia.js`, `ruta-paisaje.js`)
Una iglesia de huesos en **cruz**: muros de bóveda con nichos de calaveras, bandas de fémures al pie de los muros (la «masa de huesos»
de ARCANUM), pirámides de calaveras, guirnaldas, la araña de huesos que flota y gira sobre el crucero, el altar con la **grieta** del
más allá. La bóveda se cayó hacia arriba: sus nervaduras y sillares flotan sobre la cruz.
- **Espacio táctico:** nave sur (aparición, bancos bajos, pilares) → crucero (4 pirámides de calaveras como cobertura alta, gravedad
  rota bajo la araña) → nave norte (sarcófagos con pasillo central, altar). Brazos oeste y este con un osario (bajo) y una columna de
  calaveras (alta). **Losas claras** marcan los dos ejes de la cruz: desde cualquier punto se ve el camino. Muros de 14 m.
- **Objetivos:** oleada 2 y 6 Ancla (brazo este), 3 Núcleo (del fondo del brazo oeste al altar), 5 Sintonía. **Jefe:** El Basilisco
  (flota alto sobre el crucero; sus ojos orbitan por encima de los muros).
- **Folclore — qué almas penan acá y por qué:** los huesos que no descansan. Las **Ánimas** y los **Fuegos Fatuos** (luces de
  cementerio) salen de las pilas; la **Almamula** arrastra cadenas entre los osarios; el **Lobizón** ronda las criptas; la **Difunta**
  es la santa milagrosa del altar que sigue curando… a las otras almas; la **Salamanquera** las convoca desde los nichos; el
  **Familiar** es el perro negro del camposanto; el **Silbón** llega con su saco de huesos a buscar los que faltan. Y en la grieta del
  altar mira el **Basilisco**. (`WAVE_PLANS.m6`: astilla, racimo, geoda, ariete, aurora, cuarzo, graviton, espiral.)

### En el menú y en la campaña
- **Arenas**: dos tarjetas nuevas (`public/index.html`, arte `public/art/arena-m5.jpg` / `arena-m6.jpg`) y en el selector del cooperativo.
- **Campaña**: `src/client/story.js` → `RUTAS` y `INTERLUDES`. La ruta corta de siempre es `m1 → m2`; con **`?ruta=larga`** la historia
  pasa por los dos escenarios robados: `m1 → m5 → m6 → m2`, cada uno con su interludio del Heraldo (`main.js` → `endGame` toma el
  capítulo siguiente de la ruta). Para que la larga sea la de siempre basta cambiar `RUTAS.corta`.
- **Pruebas:** `node --test tests/limbo-mapas.test.js` (registro, límites, transitabilidad física caminando con la física real, gravedad
  rota, bots que ganan sin trabarse y bots torpes que pierden). **Capturas y medición:** `node tools/shot-limbo.js m5|m6 [carpeta] low|high
  [--sin-criaturas] [--sin-cuerpo]` (imprime llamadas de dibujo y triángulos de la escena y del mapa solo).
