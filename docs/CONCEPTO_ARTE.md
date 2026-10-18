# Concepto artístico — «PSICODELIA ESPIRITUAL» (corrección del dueño, 2026-10-14)

> **CORRECCIÓN IMPORTANTE:** NO pasamos de psicodelia a realismo. El mundo sigue siendo **FLASHERO y psicodélico**; sólo
> lo hacemos **un poco más realista** (materiales con textura, luz y volumen creíbles) para que se vea más rico, pero el color
> intenso, las geometrías imposibles, los cielos alucinados y los efectos de luz siguen siendo protagonistas. Donde abajo dice
> «sobrio» o «contenida», leer: **psicodelia a pleno sobre una base material más creíble**.

(Texto original, con la corrección de arriba aplicada:)

> Psicodelia sí, pero **más realista y espiritual**. El Vórtice no es una discoteca de neón: es el **umbral entre la vida y la muerte**,
> un lugar sagrado, antiguo y vivo, que se ve **real** (piedra, mármol, hueso, oro, carne, cristal, tela) y donde lo psicodélico
> aparece como **luz, energía y geometría imposible**, no como color plano en todas partes.

## Pilares
1. **Materia real.** Superficies con materiales fotográficos (PBR): mármol veteado, piedra gastada, oro envejecido, hueso, porcelana,
   tela, cristal con refracción. Nada de colores planos ni cajas lisas. Fuente: texturas y cielos HDRI **CC0 de Poly Haven**
   (libres para uso comercial, sin atribución obligatoria).
2. **La luz es el espíritu.** Lo sobrenatural se expresa con luz: rayos volumétricos, polvo suspendido, halos, auras, partículas que
   ascienden, reflejos dorados. Iluminación por imagen (HDRI) + una luz principal cálida + rebote frío.
3. **Lo orgánico es sagrado.** El tejido vivo (venas, membranas, raíces, ojos) crece **sobre** la arquitectura sagrada como algo que
   la reclama: templos de mármol invadidos por raíces luminosas. Late suave, no grita.
4. **Psicodelia a pleno (corregido).** La psicodelia vive en: el cielo (nebulosas, auroras, geometría sagrada lenta), los portales, las
   habilidades, la evolución del jugador y los momentos de clímax (jefes, definitivas). En el resto, la paleta es **sobria**.
5. **Legibilidad absoluta.** Enemigos, proyectiles, caminos y bordes se leen siempre (contraste de luminancia y silueta).

## Paleta
Base desaturada (blancos hueso, mármol, grises cálidos, azules profundos) · **acentos de luz**: oro `#f2c66d`, celeste espiritual
`#9fe8ff`, violeta del Vórtice `#b07bff`, rojo vital `#ff5a6e` (sólo para peligro y carne viva).

## Personajes (Huéspedes)
Cuerpos humanos **reales** (base con esqueleto y animaciones: la fábrica de personas de ARCANUM, CC0 MakeHuman) **intervenidos**:
máscaras rituales de porcelana o hueso, filigrana dorada, piel translúcida con luz interior, telas que flotan, armaduras que
nacen del cuerpo. Cada evolución agrega algo **físico** (placas, alas de luz, grietas de vacío) visible en 3ª persona.

## Enemigos
Criaturas del umbral: cristal, carne y hueso **con anatomía creíble** (peso, articulaciones, respiración), con un núcleo de luz
como punto débil. Menos «gema flotante», más «ser».

## Cómo se acerca a la calidad de Warframe (lo alcanzable en web)
- **Materiales y luz fotográficos:** Poly Haven (texturas 1K/2K + HDRI) + PBR de Three.js + sombras + oclusión ambiental + bloom.
- **Cuerpos animados reales:** esqueleto y clips de ARCANUM en vez de figuras de bloques.
- **Post-proceso cinematográfico** en Media/Alta (grading, rayos de luz, profundidad de campo en menús).
- **Lo que NO alcanzamos sin artistas 3D:** modelos esculpidos a mano con detalle de Warframe. El paso siguiente para eso sería
  encargar o generar (herramientas de IA 3D) modelos glTF de los 5 Huéspedes y las criaturas, que el motor ya puede mostrar.

## Referencias de tono (no copiar)
Warframe (templos Orokin: blanco y oro), Destiny 2 (Ciudad Ensoñada), Hellblade (espiritualidad), Control (arquitectura imposible),
Journey (luz y silencio), Scorn (biomecánica, sólo como acento).

## Folclore por mapa (dueño)
Cada mapa es un **escenario robado de ARCANUM** (no se vuelve a producir desde cero) convertido en limbo, y tiene **su propio folclore**:
las criaturas de ese mapa son las almas y espíritus de ese lugar. `docs/BESTIARIO_LIMBO.md` lista las criaturas; cada mapa elige su elenco.

## Los Huéspedes: lo MEJOR logrado del juego
Son **guardianes que habitan entre el mundo de los muertos y el de los vivos**. El Pasajero hace un **pacto** con uno: ellos necesitan
un cuerpo vivo para volver a cruzar al mundo; nosotros necesitamos su poder para salir del limbo → **simbiosis**. Visualmente son la pieza
más cuidada del juego (más detalle, mejor material, mejor animación que cualquier criatura), y **cambian con el mapa** (aspecto regional
según el folclore del lugar) **y con sus evoluciones** (cada camino elegido se ve en el cuerpo).

## REWORK DE LOS HUÉSPEDES (dueño, 2026-10-14)
Los Huéspedes **no son soldados ni biomecanoides**: son **almas o bestias en pena del limbo** (guardianes entre muertos y vivos) con las
que el Pasajero pacta. Rediseño total, la pieza mejor lograda del juego (más detalle que cualquier criatura), flashero/psicodélico:
- **Axioma — el Guerrero Caído:** alma de un guerrero en pena, armadura de hueso y brasas que arde sin consumirse, filos de espíritu.
- **Vesper — la Bestia Cazadora:** bestia felina/lupina de ojos fosforescentes, cuerpo traslúcido, nervios de luz violeta.
- **Micelio — el Coloso Raíz:** bestia antigua del bosque muerto, cuerpo de raíces, hongos y cortezas que laten.
- **Umbra — el Errante:** alma sin cuerpo fijo, sudario de sombra y fragmentos de espejo flotando; existe en varios planos.
- **Seraf — el Ángel Caído:** alma alada de luz dorada y filamentos, aureola quebrada.
Cada uno: silueta inconfundible, partes sueltas/flotantes, luz interior, partículas propias, animación de bestia o espectro (no de maniquí),
y **evoluciones que se ven**: cada camino de `pth` y cada órgano `cg` cambian el cuerpo. Aspecto regional por mapa (folclore del lugar).

## Legibilidad (Claridad)

La psicodelia sigue a tope, pero el jugador tiene que ver dónde está el Huésped y los enemigos. Se resuelve con luz, no con quitar color:
relleno que sigue al Huésped, charco de luz bajo los pies y resplandor detrás, borde de luz más fuerte en el cuerpo, contorno por profundidad
(claro sobre fondos oscuros, oscuro sobre fondos claros) y un piso tintado en las sombras (conserva el tono de cada mapa). Los mapas ya claros
(m4–m6) reciben menos relleno (`MAP_OSCURO` en `src/client/quality.js`). Ajuste del jugador: «Claridad» Normal/Alta (pausa, o `?claridad=alta`).
Medición: `node tools/legibilidad.mjs <carpeta> low,high m1,m2,m3,m4,m5,m6 normal|alta` (contraste silueta/fondo: ratio de luma ≥ 1,5 o ΔE ≥ 30).

## Luz y nieblas por arena
Cada arena tiene su luz propia (dirección y color del sol, contraluz, luces de sus órganos y un ciclo día → ocaso → eclipse que **no toca el día medido**): ver `docs/MAPAS.md` → «Luz de las arenas». Las **nieblas de colores** (verde ácido, cian, magenta, ámbar, blanca y del vacío) son zonas con función de juego, no decorado: ver `docs/MUNDO_VIVO.md` → «Nieblas tóxicas de colores». Los gráficos se eligen en el menú **Gráficos** (`docs/GRAFICOS.md`).
