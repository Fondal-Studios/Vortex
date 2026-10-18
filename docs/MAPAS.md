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

## Identidad de arena: el mapa es un organismo (paleta e iconografía)
Cada arena tiene un **organismo vivo** (nombre, folclore, órganos, fases: ver `docs/MUNDO_VIVO.md` → «Arenas vivas»). Para que se distingan **de un vistazo**, cada una tiene su propia **paleta de identidad** (un color de *ayuda* y uno de *amenaza*, que también son los del halo y el cuerpo de sus órganos) y su propia **silueta** (iconografía). Los colores salen de `ARENAS_VIVAS[mapa].color/color2` en `src/sim/data.js` y de la tabla `PAL` de `src/client/arenas-vivas-fx.js`.

| Arena | Organismo | Color de ayuda | Color de amenaza | Icono / silueta | Cómo reconocerlo de lejos |
|---|---|---|---|---|---|
| **m1** Vacío de Islas | El Corazón de Isla | cian `#19f0ff` | magenta `#ff3df2` | **Medusa**: campana, zarcillos que cuelgan, anillos de luz | Una medusa flotando sobre la isla central y un carril de luz cian hacia el portal |
| **m2** Cámara Fractal | El Espejo que Respira | violeta `#9b5cff` | ámbar `#ffb52e` | **Iris**: octaedros facetados con satélites en órbita | Cristales que giran en el cascarón y una bruma que cambia de violeta a ámbar |
| **m3** Laberinto Celestial | La Garganta del Laberinto | menta `#3dffb8` | blanco hielo `#e8fbff` | **Ondas de sonido**: garganta de cristal con anillos concéntricos | Tubos y anillos verde menta en la plaza central; el haz del silbido es blanco |
| **m4** Jardín de Carne | La Madre Raíz | verde ácido `#b6ff2a` | rojo carne `#ff2f5e` | **Corazón anatómico**: lóbulos, vasos y raíces | Un corazón rojo latiendo sobre la grada; esporas verdes que sanan, rojas que queman |
| **m5** Plaza de los Ecos | El Reloj Hambriento | oro farol `#ffcf4a` | azul cobalto `#5b8bff` | **Reloj**: esfera con 12 marcas, péndulo y manecilla | Esfera dorada con péndulo junto a la torre y una manecilla azul sobre la fuente |
| **m6** Osario sin Techo | El Osario Insomne | marfil `#efe6c8` | brasa `#ff6a14` | **Jaula de costillas** con un corazón encendido | Costillas color hueso sobre el altar, ceniza tibia que sana o naranja ardiente que quema |

**Lenguaje común (no cambia entre arenas, para que se lea siempre):** lo que **ayuda** son anillos suaves que suben y un faro de luz del color de ayuda; lo que **amenaza** son **franjas de peligro** del color de amenaza con borde blanco que se llena hasta el golpe. Todo está autoiluminado: ninguna zona queda oscura.

### Qué pasa en cada arena (resumen)
- **m1 — Corazón de Isla:** el corazón suelta un anillo de luz de 8 m cada ~9 s (aviso 1,6 s); la Linterna de Luz Mala da escudo si peleás en su luz; la Corriente de Luz te hace correr ×1,3 hacia el portal del este.
- **m2 — Espejo que Respira:** el Núcleo de Eco sólo se deja dañar cuando el Fuelle **inspira**; la bruma del Fuelle sana en calma y envenena si el Espejo está furioso; el Iris da +25 % de daño.
- **m3 — Garganta del Laberinto:** el Silbido barre una línea de sonido (muros y paredes la frenan); el Coro cura a quien lo alimenta con bajas; la Siringe silencia al organismo si la rompés.
- **m4 — Madre Raíz:** el Zarcillo clava una raíz donde estabas (y daña a las criaturas); el Pulmón de Esporas sana o frena según el humor del Jardín; el corazón se regenera rápido.
- **m5 — Reloj Hambriento:** el Péndulo da la campanada (anillo de 8 m, aviso 1,8 s); la Manecilla de la Fuente gira como un reloj (las coberturas la frenan); los Adoquines de Luz aceleran de la Calle a la Plaza.
- **m6 — Osario Insomne:** manos de hueso brotan donde estás quieto (aviso 1,5 s); el Respiradero respira ceniza que sana o quema; el Costillar da +25 % de daño; el corazón roto **vuelve a los 26 s**.
Capturas de cada órgano en cada fase: `node tools/shot-arenas.js todas shots/arenas low --fase=furioso,aviso`.

## Luz de las arenas (dueño, 2026-10-18)
**Idea:** cada arena tiene su **propia luz**: dirección y color del sol, un **contraluz** de otro color, **luces puntuales de ambiente ligadas a sus órganos vivos** y un **ciclo suave día → ocaso → eclipse del limbo**. La psicodelia flashera sigue a tope; lo que cambia es el *tono* y el *ánimo*, no la lectura.
**Código:** `src/client/luz-arenas.js` (datos `LUZ` + funciones puras probadas en `tests/luz-arenas.test.js` + la clase `LuzArenas` que `render.js` actualiza cada cuadro).

### La luz de cada arena
| Arena | Luz de día (la medida por `tools/legibilidad.mjs`) | Ocaso | Eclipse | Luz del órgano (Baja: sólo la primera) |
|---|---|---|---|---|
| **m1** Vacío de Islas | sol frío y alto desde atrás a la izquierda · contraluz magenta | sol rosado que se hunde tras las islas · contraluz cian | sol violeta apagado · contraluz magenta fuerte | corazón (magenta si está furioso, cian si no) · Linterna cian que sigue a quien corre por la Corriente de Luz |
| **m2** Cámara Fractal | sol interior ámbar-rosa (la luz sale del centro de la esfera) | violeta frío · contraluz ámbar | sólo brillan los bordes del espejo | Núcleo de Eco · Fuelle de Espejo |
| **m3** Laberinto Celestial | cenital blanco-menta con rayos oblicuos · contraluz rosa | dorado · contraluz menta | blanco hielo · contraluz menta | Siringe de Cristal · Coro de Cristal |
| **m4** Jardín de Carne | luz tibia rosada de costado · contraluz verde ácido | rojo carne | casi negro rojizo con el corazón latiendo | Corazón del Jardín · Pulmón de Esporas |
| **m5** Plaza de los Ecos | sol bajo azulado detrás de la torre del reloj · contraluz rosa | oro de farol · contraluz dorado | azul cobalto frío · contraluz dorado | Péndulo del Reloj · Adoquines de Luz (sigue al jugador a lo largo del carril) |
| **m6** Osario sin Techo | marfil que entra por la nave desde el fondo · contraluz turquesa | brasa naranja | rojo ceniza · contraluz de brasa | Corazón Calcificado · Respiradero de Brasas |

### Reglas (para no perder la legibilidad que ya se logró)
- **El día es la luz base de cada mapa, intacta.** `luz-arenas.js` guarda lo que fijó el constructor del mapa (en m3-m6 es asíncrono) y mezcla *sobre* eso; en día no cambia nada (la prueba lo exige).
- **Ocaso y eclipse sólo cambian tono y dirección:** el sol nunca baja de ×0,72, el cielo de relleno nunca de ×0,94, el contraluz sube (×1,25-1,3 al ocaso, ×1,7-1,8 en el eclipse) y el sol gira ≤ 40° (así el disco del cielo sigue cerca). Cuando el sol baja, **sube el relleno que sigue al Huésped** (hasta ×1,6: lo que se oscurece lo compensa su propia luz, ver «Claridad» en `docs/CONCEPTO_ARTE.md`).
- **Ciclo:** sigue el avance del mundo (oleada 1 = día, mitad = ocaso, jefe = ocaso profundo) más un pulso lento de 90 s que nunca baja de «día» en la oleada 1. El evento **«Eclipse»** lo lleva al eclipse completo mientras dura. `?ciclo=dia|ocaso|eclipse` lo congela (capturas y mediciones: `CICLO=ocaso node tools/legibilidad.mjs …`).
- **Luces de órgano:** 2 `PointLight` siempre en la escena (intensidad 0 si no hacen falta: no se recompilan los materiales), **una en Baja**. Color de la paleta de la arena (ayuda · amenaza), intensidad 46-62 × la fase (dormido 0,35 · despierto 0,7 · furioso 1,15 con latido más rápido · ofrenda 0,9); casi apagada si el órgano está roto.
- Capturas: `node tools/shot-nieblas.mjs todas shots/nieblas low ocaso luz`.

## Nieblas de colores por arena
Cada arena tiene 2 nieblas temáticas (más las nubes de los pulmones y las de los eventos): ver la tabla completa y las reglas en `docs/MUNDO_VIVO.md` → «Nieblas tóxicas de colores». m1 cian + vacío · m2 magenta + ámbar · m3 blanca + cian · m4 ácida + magenta · m5 ámbar + blanca · m6 vacío + ácida. Las nubes se ven sobre el suelo de cada mapa con un aro del color de la niebla (siempre visible, aun con las nubes apagadas en Baja).
