# La Base — «El Santuario»

La Base es un **mapa-hub caminable** (como el Orbiter de Warframe): un santuario-nave del limbo, sin oleadas ni enemigos ni armas, al que volvés entre partidas.
Cada pantalla que ya existía (Forja, Tienda, Huésped, Territorios, Bestiario…) tiene acá una **estación física**: te parás al lado y tocás **USAR** (E en PC).
**No reemplaza al menú**: todas las pantallas siguen en el menú; la Base es una forma más inmersiva de llegar a ellas.

- Entrar: menú **Jugar › La Base**, la URL `?state=base`, o el botón **Entrar a la Base** al terminar una partida (ajuste en **Opciones › Al terminar una partida**; por defecto «Entrar a la Base»).
- Salir: botón **Salir** (vuelve al título), **Menú** (abre el menú encima de la Base) o **Jugar** (abre las Arenas) del HUD de la Base. Desde cualquier pantalla abierta en la Base, **Volver** o Esc te devuelve al mapa.
- Controles: los mismos de siempre (WASD / palanca, mouse / cámara de la mano, **E / USAR**, **P / 👁** cambia 1.ª ↔ 3.ª persona). Sin disparo, sin habilidades, sin modo Melé: los botones de combate no hacen nada (la simulación los apaga) y el HUD táctil esconde todo salvo palanca, salto, USAR y pausa.

## El plano

Un salón de 80 × 84 m partido en salas por tabiques bajos (cada tabique deja huecos de 6 m; hacia el centro todo está abierto):

```
        NO  Sala de Trofeos │ Norte: LA FORJA BIOLÓGICA │ NE  Jardín + Faunario
        ────────────────────┼───────────────────────────┼─────────────────────
        O   Mercado         │  HUB: Mesa de Territorios │ E   Sala de los Capullos
        (Cambista, Herrero, │                           │     (Armero: los Huéspedes)
         Sanadora)          │                           │
        ────────────────────┼───────────────────────────┼─────────────────────
        SO  Puerta de Coop. │ Sur: aparición y la Guía  │ SE  Polígono de Práctica
```

Un camino dorado en el piso lleva de la aparición a la Mesa y de ahí a los lados. Al acercarte a una estación se enciende su disco de color en el piso y aparece su cartel arriba (siempre mira hacia vos).
Un **puntito dorado «!»** sobre el cartel avisa que hay algo para vos.

## Estaciones

| Estación | Qué ves | USAR abre | Puntito «!» cuando… |
|---|---|---|---|
| **La Forja Biológica** (norte) | 5 cubas de vidrio sobre una consola. La **grande del centro** muestra la pieza que se está cultivando: sube el líquido y flota la pieza con el color de su material; al terminar **brilla y pulsa** (y la luz rosa de la sala se vuelve dorada). Las 4 chicas muestran tu stock de Hueso, Quitina, Carne y Espora. | **Inventario › pestaña Forja** (ahí mismo se recoge) | el cultivo ya terminó |
| **El Cambista de Almas** (oeste) | Puesto con toldo y el Cambista (humano espectral). | **Tienda** | hay stock nuevo o un Huésped comprable |
| **Los Capullos** (este) | Un capullo colgante por cada Huésped; con alma de su color si lo poseés, apagado si no; el elegido late más fuerte. Un espejo-remolino del color del Huésped elegido. | mini-menú: **Elegir Huésped · Evolución · Equipo y armas** (la maestría y la progresión se ven en la pantalla Huésped) | tenés puntos de progresión sin gastar |
| **Mesa de Territorios** (centro) | Holograma con las 6 arenas: dorada si ya la liberaste. | mini-menú: **Elegir destino y jugar (Arenas, con la ruta de objetivos) · Territorios y bendiciones · La Historia** | territorio nuevo o bendición para elegir |
| **Jardín y Herbario** (noreste) | 6 macetas; cada planta crece con el reloj y se rodea de un aro dorado cuando se puede cosechar. | **Panel del Jardín** (abajo) | hay cosecha lista |
| **Faunario** (noreste) | 3 vivarios de vidrio con criaturas dormidas de luz. | **Bestiario** (donde vive el Códice de Fauna, ver `docs/FAUNA.md`) | — |
| **Polígono de Práctica** (sureste) | Maniquíes de paja con blanco. | **Campo de pruebas** (el modo práctica existente: `startSolo('m1', { practice: true })`; maniquíes que reaparecen, munición y vida infinitas) | — |
| **Sala de Trofeos** (noroeste) | 4 vitrinas con **gemas del color de la rareza** de tus objetos más fuertes (16 como máximo; las legendarias doradas primero). | mini-menú: **Objetos y armas · Sets equipados · Bestiario** | botín nuevo en el inventario |
| **Puerta de Cooperativo** (suroeste) | Un portal de remolino violeta. | pantalla **Cooperativo** (código de sala) | — |

Personajes ambientales (humanos de Arcanum, `humans.js`, con las frases de `src/sim/base.js › PERSONAJES`; USAR cerca de ellos dice una frase corta, rotan en orden): **el Cambista**, **el Herrero de Huesos**, **la Sanadora** y **la Guía del Santuario** (junto a la aparición).
Los capullos de los Huéspedes y las cubas se actualizan solos cada ~0,4 s desde lo guardado (`recolectarDatos` en `src/client/base-hud.js` → `base-fx.js`).

## El jardín (cultivos con reloj real)

- 6 macetas. En el panel elegís una **semilla**, la sembrás en una maceta vacía (cuesta núcleos) y esperás: **corre el reloj real aunque cierres el juego**. Al terminar, **Cosechar** suma materiales al stock de la Forja (calidad Fina o Excelente: lo Perfecto sólo lo dan las plantas raras de las arenas).
- Semillas: Brote de Raíz, Hongo Lumínico, Fruto Carnoso, Flor de Geoda y las de la flora de las arenas (`docs/FLORA.md`: Zarza Mansa, Árbol de Savia Chico, Flor de Luz de Maceta, Pino de Resina, Fruto de Néctar, Flor de Polen, Planta Espejo Chica, Raíz de Hierro). El catálogo está en `src/sim/base.js › PLANTAS_TODAS`: una planta cuyo material no exista se ignora, así que agregar materiales nuevos sólo pide una fila.
- **Determinismo y tope**: nada usa `g.rng`. El estado de una maceta (`macetaEstado`) sólo depende de lo guardado (`{ p: planta, t0: hora de siembra en ms }`) y del reloj que se le pase; una hora de siembra en el futuro (reloj raro) cuenta desde «ahora» (no regala tiempo) y el tiempo transcurrido tiene tope de 7 días (`TOPE_TIEMPO`).
- La **Forja** reusa su cultivo de siempre (`perfil().cultivo`, también con reloj real): la Base sólo lo dibuja en la cuba grande.

## Código

| Archivo | Qué hace |
|---|---|
| `src/sim/base.js` | La **simulación**: plano (reusa `makeLimboArena` de `limbo.js`: colisiones, grilla de navegación), muros del borde generados de la unión de salas, tabiques y decorado como `covers` con `kind`, `ESTACIONES`, `PERSONAJES`, `estacionCerca` / `interaccionCerca`, jardín (`PLANTAS`, `macetaEstado`), `initBase` / `stepBase` / `baseStep` (llamados desde `Game`). Sin azar. |
| `src/sim/maps.js` | Registra `MAPS.base` **no enumerable**: Game y Renderer lo ven, pero `MAP_IDS` y las listas de arenas no (las pruebas que recorren todas las arenas no lo cuentan). |
| `src/sim/game.js` | 5 líneas: `initBase` (si `map.base`), sin oleadas (`stepBase`), sin armas (`baseSinArmas`) y USAR (`baseStep`). Evento `estacion {pid, id}` y `habla {pid, id, tx}`. |
| `src/client/env/base.js` | El **dibujo estático**: suelo con shader (sin luz: baldosas, ondas desde el centro, un disco de color bajo cada estación, caminos), muros con costillas y venas de luz, columnas, costillas-arco sobre la nave, props por `kind`, cubas/vidrios/capullos/macetas/gemas instanciados, carteles en un atlas, cielo (`limboSky`), rayos de luz, motas. |
| `src/client/base-fx.js` | La **animación**: cubas, pieza flotante, pines de la Mesa, capullos, plantas del jardín, gemas, puntitos «!» y resalte del piso cerca de una estación. |
| `src/client/base-hud.js` | El **HUD propio y mínimo** (saldo, materiales, objetivo sugerido, Jugar · Menú · Salir, cartel «E · Usar», mini-menús, panel del Jardín, frases, tutorial) y su parte pura (`recolectarDatos`, `avisosEstaciones`, `objetivoBase`, `mmss`). Sólo engancha con `main.js` en `startBase / baseAbrir / baseCerrar / baseFrame`. |
| `src/client/perfil.js` | `base = { vis, tut, jardin[6] }` (saneado al cargar; un perfil viejo se abre igual), `visitarEstacion`, `tutorialBaseListo`, `sembrar`, `cosechar`, `jardinEstado`, `avisosBase`. |
| `src/client/menu-nav.js` · `menu-hubs.js` · `ui.js` | Tarjeta «La Base» en el hub Jugar (con puntito), `ui.go('base')` → entra al mapa, y `ui.desdeBase` para que «Volver» cierre el menú y regrese al mapa. |
| `src/client/render.js` · `audio.js` · `post.js` · `quality.js` | Enganches puntuales: `loadBase()`, `baseFx.update`, NPC rehechos como humanos al cargar el kit, música calma de la Base (pentatónica mayor, sin pulso de combate), preajuste de color cálido y `MAP_OSCURO.base`. |

## Presupuesto de dibujo (Baja)

Medido con `renderer.info` en Chromium por software (`node tools/base-captura.mjs shots/base low`, una vista tras otra; cada cuadro incluye el post-proceso). Objetivo: **escenario ≤ 60 llamadas y ≤ 40 000 triángulos; el Huésped aparte ≤ 45 / 20 000**. El desglose oculta por turnos los NPC y el Huésped.

| Baja, máximo de 15 vistas | llamadas | triángulos | presupuesto |
|---|---|---|---|
| Sólo el mapa (suelo, muros, props, cubas, carteles, cielo…) | 27 | 22 641 | |
| 4 NPC (figuras fusionadas «livianas») | 12 | 1 264 | |
| **Escenario = mapa + NPC** | **39** | **23 905** | ≤ 60 / ≤ 40 000 ✔ |
| **Huésped** (3.ª persona, armadura, aura) | **20** | **15 374** | ≤ 45 / ≤ 20 000 ✔ |
| Cuadro entero (todo junto) | 59 | 39 279 | |

`tests/base-render.test.js` vuelve a medir (mapa + NPC, con el cuerpo del Huésped oculto) y falla si Baja pasa de 60 / 40 000 (mide 39 / 23 905).
**Por qué NPC livianos en Baja**: los humanos de Arcanum cuestan ~11 llamadas y ~5 000 triángulos cada uno (con los 4 a la vista, el escenario pasaba de 89 llamadas y 69 000 triángulos). En Baja `env/base.js` registra `objects.npcLite` (una figura fusionada de túnica + cabeza + prop de su oficio, 3 llamadas con su aro de luz) y `objects.js › buildNpc` la usa; en **Media/Alta** los NPC son los humanos espectrales de siempre.
**Media/Alta** suman detalle: más costillas-arco, más luces de relleno (2 luces puntuales cálidas, 4+ rayos de luz), halos, más motas y burbujas, y el bloom se contiene (`strength ≤ 0,22`, umbral 1,05) porque la misma luz lavaba la imagen y el Huésped dejaba de leerse. Medido en Alta (sin presupuesto propuesto): sólo el mapa 40 llamadas / 28 184 triángulos; los humanos de alta resolución pesan mucho (los 4 NPC juntos ≈ 107 llamadas y 282 000 triángulos; el Huésped ≈ 27 llamadas y 90 000), así que el cuadro entero llega a 174 llamadas y 400 000 triángulos. Es un costo de los humanos de Arcanum en Alta, igual en cualquier arena con NPC; si hiciera falta, la salida es usar los NPC livianos también en Media.

Mecanismo: dos mallas fusionadas (sólido con luz + brillo sin luz), `InstancedMesh` para cubas, capullos, macetas, gemas y vidrios, **un atlas** con los 9 carteles y los puntitos, un shader de suelo sin luz y luz del Renderer (hemisférica + sol + contraluz) más la luz de relleno del Huésped.

## Legibilidad (`tools/legibilidad.mjs`)

`node tools/legibilidad.mjs shots/leg-base low,high base normal`. Criterio: ratio WCAG ≥ 1,5 **o** ΔE ≥ 30 entre la silueta del Huésped y su fondo.
Medido en 960×720 con el Huésped de siempre (Axioma, evolución 0, Claridad Normal):

| Calidad | ratio (cuerpo) | ratio (borde) | ΔE | luma de la imagen | saturación |
|---|---|---|---|---|---|
| Baja | **4,08** | 2,73 | **52** | 167 | 0,32 |
| Alta | **4,77** | 2,91 | **58** | 156 | 0,34 |

Legible en las dos (cuerpo oscuro sobre piso violeta/azul claro). Los enemigos que la herramienta siembra para medir (no hay en la Base) también pasan.

## Probado / no probado

Probado: `node --test tests/base.test.js` (16 pruebas: registro no enumerable, plano cerrado y sin zonas aisladas, rangos y acceso de cada estación y personaje, **caminata con la física real** desde la aparición a cada uno y de vuelta, sin oleadas ni daño ni disparos, USAR → eventos con sus frases en orden, **determinismo y `g.rng` intacto**, jardín (reloj, tope, hora futura), perfil (migración, saneo, persistencia de cultivos, avisos), tarjeta del menú y partes puras del HUD) y `node --test tests/base-render.test.js` (navegador por software: presupuesto, recorrido real USAR → pantalla → Volver, panel del Jardín, capturas).
Capturas reales con Chromium por software en 1280×720 y 844×390, Baja y Alta (`tools/base-captura.mjs`).

**No probado**: iPhone / táctil real (sólo emulación de tamaño 844×390 con el HUD táctil), **cooperativo real** (la puerta abre el panel de siempre; **la Base no muestra a otros jugadores**: no hay siluetas ni presencia multijugador, la Base es siempre de uno solo), GPU real (todo se midió con SwiftShader: los cuadros por segundo reales no se conocen), el modo Combo/Melé dentro de la Base (se fuerza Disparo y se apagan las armas), pantalla de carga larga con perfiles muy llenos (≥ 300 objetos).

## Limitaciones y cosas que quedan

- **Cooperativo**: sin presencia multijugador. Integrarlo pide que el servidor (`server/`) acepte una sala «base» sin oleadas; la simulación ya es apta (sin azar), pero queda fuera de esta entrega. La estación sólo abre el panel de salas.
- **Polígono**: reusa el Campo de pruebas existente (sale de la Base: al terminar, Menú › Jugar › La Base). Los maniquíes de la Base son decorado; el medidor de daño no está.
- Los capullos muestran una silueta de alma por Huésped (no su modelo 3D completo): el Huésped elegido es tu propio personaje, visible en 3.ª persona.
- Se puede salir de la Base sin guardar nada: no tiene partida (`bankProfile` la ignora), sólo el perfil de siempre.

## Notas para quien siga

- **Capturas**: `shots/base/*.jpg` (Baja 1280×720 y 844×390, Alta 1280×720 a resolución interna 0,6) salen de `node tools/base-captura.mjs shots/base low 1280 720 --jpg` (y `high … --pr=0.6`, `low 844 390 --hud`). La capa del Huésped es una tela con física: al «teletransportar» a la cámara de cada vista se estira como un palo; la herramienta avanza cuadros hasta que se asienta (si en una captura vieja ves un palo negro largo, es eso, no un arma).
- **Aviso de consola** `toNonIndexed(): already non-indexed` en Baja y Alta: viene de `flora-fx.js` (la flora de las arenas), no de la Base.
- **Pruebas de otros agentes que fallan hoy por su trabajo en curso** (no tocan la Base): `tests/hud.test.js` (HUD de partida y desborde del Bestiario) y `tests/huespedes-ui.test.js` (texto cortado con los Huéspedes nuevos).
- Los capullos y las cubas leen el perfil cada ~0,4 s (`session.datosT` en `main.js › baseFrame`); `onCambio` del HUD fuerza una lectura inmediata tras sembrar o cosechar.
- Para sumar una estación: agregarla a `ESTACIONES` (posición, rango, color, `pantalla` / `acciones` / `panel` / `accion`), una cobertura con su `kind` en `COVERS`, su dibujo en `env/base.js` (un `else if (k === …)`) y, si debe avisar, su clave en `avisosEstaciones`. Las pruebas de `tests/base.test.js` verifican solas que sea alcanzable caminando y que su pantalla exista.
