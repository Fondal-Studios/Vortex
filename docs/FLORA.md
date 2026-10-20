# Flora interactiva y vegetación psicodélica (dueño, 2026-10-20)

> «Agregar VEGETACIÓN en los mapas, psicodélica, que también debería poder INTERACTUAR con el Huésped, ya sea curando, atacando o envenenando, con todo el entorno: con los enemigos y con el Huésped.»
> Agregado del dueño: ciertas plantas se **cosechan** y son **material de forja**; algunas son **raras** y sólo aparecen en ocasiones concretas.

**En una frase:** cada arena tiene un jardín de 22–26 plantas vivas (3 especies propias por arena, con su folclore) que **curan, muerden, atrapan, envenenan, reflejan disparos o arden**; avisan antes de actuar, rebrotan después de marchitarse, reaccionan al fuego, al hielo, a las nieblas y a los órganos de la arena, y se **cosechan con USAR** para forjar sets y consumibles de jardín.

Archivos: `src/sim/flora-data.js` (datos puros: especies, reglas, Herbario) · `src/sim/flora.js` (simulación determinista, rng propio `g.flRng`) · `src/client/flora-fx.js` + `src/client/env/flora-kit.js` (dibujo) · `src/client/flora-ui.js` (pestaña Herbario) · `src/sim/items.js` (materiales vegetales, sets y consumibles de jardín) · `src/client/perfil.js` (Herbario, semillas, Forja de jardín) · `tests/flora.test.js`, `tests/flora-bots.test.js`, `tests/flora-render.test.js` · `tools/shot-flora.mjs` (capturas).

## Reglas de diseño (las que no se rompen)
1. **Legibilidad primero.** Código de color fijo: **verde / cian / dorado = ayuda** · **rojo / magenta = daño** · **violeta / ácido = veneno y control**. Las plantas son autoiluminadas (nunca oscurecen el suelo), cada una tiene un aro de acción en el piso y lo alto que se interpone entre la cámara y el Huésped se **disuelve** (tramado).
2. **Aviso antes de actuar.** Toda planta ofensiva avisa **≥ 1 s** (`FLORA.telMin`): se abre, se pone roja/magenta, parpadea y un círculo se llena hasta la acción. Las zarzas no hieren hasta pasados 0,5 s adentro, y la savia sólo frena.
3. **Contrajuego siempre:** se pueden **evitar** (el aviso se ve), **destruir** (dan botín) o **usar a favor** (las ofensivas también hieren a las criaturas, las nubes frenan o envenenan a los enemigos).
4. **Balance modesto.** Las curas son chicas y con enfriamiento (4 s entre dos para el mismo Huésped); la flor sólo se come sola si estás por debajo del 72 % de vida+escudo; el veneno **nunca baja de 8** de vida; los bots siguen ganando las 6 arenas.
5. **No son sólidos.** Nunca tapan caminos, disparos, apariciones ni objetivos (igual que los órganos de las arenas vivas); además nacen lejos de ellos (ofensivas: ≥ 16 m de las apariciones y ≥ 10 m de los objetivos, nunca sobre las sendas rectas aparición→objetivo).
6. **Determinismo.** Mismas semilla → mismas plantas y mismo estado. `g.rng` no se toca (rng propio derivado de la semilla). Nada actúa en el campo de pruebas (`practice`).

## Estados
`0 brote` (crece, inofensiva) → `1 madura` (actúa) → `2 armando` (**aviso**) → `3 marchita` → vuelve a `0 brote` tras `rebrota` s (×1,5 si la destruyeron) · `4 ausente` (casilla libre de una rara). Un tiempo de crecimiento (`brote`) separa cada rebrote de volver a estar madura.

## Las 22 especies
Tres por arena + cuatro raras. Código de color y función en cada fila. (Números de cada especie: `src/sim/flora-data.js`.)

#### m1 · Vacío de Islas
| Planta | Función · color | Qué hace | Cómo avisa | Contrajuego | Cosecha (USAR) |
|---|---|---|---|---|---|
| **Flor de Luz Mala** (×7) | Curativa · cian | Florece donde se apagó un ánima. Si estás herido, su luz tibia te cura vida y escudo (y se marchita). | Se abre y brilla cian cuando está lista; cerrada y gris, todavía no. | Los enemigos a distancia la rompen: comela antes. Con USAR la cosechás (pétalo de luz). | 1–2× petalo |
| **Liana Aferradora** (×8) | Ofensiva · magenta | Si algo pasa cerca, sus lianas se enroscan al suelo y lo atrapan un instante (Huésped o criatura). | Un anillo magenta se cierra durante 1,1 s antes de atrapar. | Salí del anillo antes de que se cierre, rompela de lejos o llevá enemigos hasta ella. | 1–2× fibra |
| **Hongo de Ánima** (×7) | Tóxica / especial · violeta | Se hincha con el aliento de quien pasa y suelta una nube de esporas venenosas que se queda un rato. | La seta se hincha y se pone violeta durante 1,2 s antes de soltar la nube. | Reventala de lejos para que la nube caiga sobre los enemigos. El veneno de la nube no te baja de 8 de vida. | 1–2× polen |

#### m2 · Cámara Fractal
| Planta | Función · color | Qué hace | Cómo avisa | Contrajuego | Cosecha (USAR) |
|---|---|---|---|---|---|
| **Fruto de Eco** (×6) | Curativa · dorado | Un fruto dorado que repite lo que le cantás: al comerlo cargás parte de la definitiva y acelerás tus habilidades. | Brilla dorado y late cuando está maduro. | Se come al pasar (si te falta definitiva). Los enemigos a distancia lo rompen. | 1–2× nectar |
| **Planta Espejo** (×5) | Tóxica / especial · cian | Sus hojas son espejos: devuelven los proyectiles enemigos que pasan cerca. Cada reflejo la agrieta. | Las hojas giran hacia el disparo y destellan al reflejar. | Parate detrás de ella: los disparos de los enemigos vuelven. No refleja los tuyos. | 1–1× hoja_espejo |
| **Zarza de Cristal** (×10) | Ofensiva · magenta | Un matorral de filos de cristal: hiere y frena a quien se queda adentro (a vos y a las criaturas). | Las púas se erizan y el anillo del suelo queda marcado todo el tiempo. | Cruzala rápido (el daño empieza a los 0,5 s) o rodeala; atraé enemigos para que se frenen. | 1–2× fibra |

#### m3 · Laberinto Celestial
| Planta | Función · color | Qué hace | Cómo avisa | Contrajuego | Cosecha (USAR) |
|---|---|---|---|---|---|
| **Brote del Coro** (×7) | Curativa · verde | Un brote que canta bajito: te da escudo y, 6 segundos, recibís 20 % menos de daño. | Verde brillante y con anillos de sonido cuando está listo. | Se come al pasar si te falta escudo. Los enemigos a distancia lo rompen. | 1–2× savia |
| **Flor del Sueño** (×6) | Tóxica / especial · violeta | Exhala una nube narcótica que adormece: te ralentiza a la mitad y deja a las criaturas casi quietas. | Cierra los pétalos y se pone violeta 1,2 s antes de exhalar. | Mantenete a más de 9 m o fuera de la nube. Atraé a los enemigos adentro: es control gratis. | 1–2× polen |
| **Vejiga Silbadora** (×9) | Ofensiva · rojo | Una vejiga llena de aire que estalla cuando la golpean (o la rozan): daña a todo lo que tenga cerca. | Se hincha, silba y parpadea rojo 1,1 s antes de reventar. | Disparale de lejos, o llevá enemigos hasta ella. Evitá rozarla. | 1–2× fibra |

#### m4 · Jardín de Carne
| Planta | Función · color | Qué hace | Cómo avisa | Contrajuego | Cosecha (USAR) |
|---|---|---|---|---|---|
| **Bulbo Vital** (×6) | Curativa · verde | Un bulbo tibio que cura despacio a quien se queda cerca, hasta agotar su reserva y marchitarse. | Late verde y su anillo en el suelo se achica a medida que se agota. | Curación lenta, no instantánea. Los enemigos lo pisotean: defendelo. | 1–2× savia |
| **Boca del Jardín** (×8) | Ofensiva · rojo | Planta carnívora: si algo pasa cerca abre la boca y muerde. Muerde igual al Huésped distraído que a una criatura. | Abre la boca y un anillo rojo se cierra 1,2 s antes del mordisco. | Retrocedé al ver el anillo, destruila de lejos o llevá criaturas a su boca. | 1–1× raiz_hierro |
| **Árbol de Savia** (×7) | Tóxica / especial · acido | Chorrea savia pegajosa: quien pisa el charco camina al 60 % (vos y las criaturas). Es inflamable. | El charco ámbar del suelo se ve siempre. | Rodealo, o atraé enemigos al charco. Con fuego arde (y suelta resina). | 1–2× resina |

#### m5 · Plaza de los Ecos
| Planta | Función · color | Qué hace | Cómo avisa | Contrajuego | Cosecha (USAR) |
|---|---|---|---|---|---|
| **Fruto de la Hora** (×6) | Curativa · dorado | Un fruto que maduró fuera de hora: al comerlo recuperás tiempo (tus habilidades se recargan antes) y algo de energía. | Dorado y con un tictac visible cuando está maduro. | Se come al pasar. Los enemigos a distancia lo rompen. | 1–2× nectar |
| **Hiedra del Relojero** (×9) | Ofensiva · magenta | Una hiedra de espinas finas que trepa por las fachadas y el suelo: hiere y frena. Se quema. | Espinas erizadas y anillo magenta siempre visible. | Cruzala rápido, quemala o llevá enemigos adentro. | 1–2× fibra |
| **Arbusto de Brasas** (×7) | Tóxica / especial · rojo | Un arbusto de ramas al rojo, inflamable: si lo golpean con fuego (o una explosión) arde y prende a las plantas de al lado. | Chispea 1 s antes de arder. | Prendelo de lejos con un arma de fuego cuando haya criaturas cerca; evitá pelear al lado. | 1–2× resina |

#### m6 · Osario sin Techo
| Planta | Función · color | Qué hace | Cómo avisa | Contrajuego | Cosecha (USAR) |
|---|---|---|---|---|---|
| **Lirio del Osario** (×7) | Curativa · cian | Un lirio blanco entre los huesos: su polen frío te da sobre todo escudo, y algo de vida. | Abierto y blanco azulado cuando está listo. | Se come al pasar si te falta escudo. Cosechalo con USAR. | 1–2× petalo |
| **Boca de Hueso** (×6) | Ofensiva · rojo | Una carnívora con dientes de hueso: tarda más en morder, pero muerde fuerte y a todos los que estén en la boca. | Abre la mandíbula 1,5 s, con un anillo rojo que se cierra. | Es lenta: retrocedé al ver el aviso. Destruila de lejos. | 1–2× raiz_hierro |
| **Cardo de Ceniza** (×8) | Ofensiva · magenta | Un cardo de cenizas encendidas: estalla con un golpe y deja fuego que prende a las plantas cercanas y a las criaturas. | Se pone al rojo y chispea 1,1 s antes de estallar. | Disparale de lejos cuando haya criaturas cerca. Evitá el fuego que deja. | 1–2× polen |

#### Raras (eventos, misiones, jefe)
| Planta | Cuándo brota | Qué hace | Cosecha |
|---|---|---|---|
| **Flor de la Aurora** | Evento Bendición de la Aurora (dentro de su zona dorada) | Brota dentro de la zona dorada de la Bendición de la Aurora: la mejor flor curativa. Pétalos Perfectos. | 2–3× petalo (calidad 3) + semilla + plano |
| **Loto del Eclipse** | Evento Eclipse (cerca de cada Huésped) | Se abre sólo con el Eclipse, cerca de vos. Néctar Perfecto y mucho escudo, pero se marchita pronto. | 2–3× nectar (calidad 3) + semilla + plano |
| **Retoño del Pacto** | Al cumplir una misión opcional | Brota cuando cumplís una misión opcional: la tierra agradece. Resina Perfecta. | 2–3× resina (calidad 3) + semilla + plano |
| **Corona del Jefe** | En la oleada del jefe | Una carnívora enorme que brota en la oleada del jefe. Muerde fuerte, pero su raíz-hierro es de calidad Perfecta. | 2–3× raiz_hierro (calidad 3) + semilla + plano |


## Qué hace cada comportamiento (`tipo`)
| Tipo | Comportamiento |
|---|---|
| `cura` | Si estás herido (< 72 %) y te acercás, te cura vida y escudo y se marchita. Con USAR la cosechás sin gastarla en vos. |
| `escudo` | Escudo grande y **−20 % de daño recibido durante 6 s**. |
| `energia` | Carga la definitiva y reduce el tiempo de recarga de tus habilidades (y algo de vida). |
| `aura` | Cura despacio a quien se queda cerca hasta agotar su reserva (55); después se marchita. |
| `muerde` | Planta carnívora: si algo entra en su radio (Huésped **o criatura**) abre la boca 1,2–1,5 s y muerde a todo lo que esté en ella. Cooldown 3,5–5 s. |
| `liana` | Aviso de 1,1 s y atrapa a todo lo de su círculo: Huésped −88 % de velocidad 1,6 s (+ daño); criaturas casi quietas 3 s (+ daño). Se agota tras 4 usos. |
| `zarza` | Frena a todo el que está adentro y, pasados 0,5 s, hiere cada 0,6 s (Huésped y criaturas). |
| `explosiva` | Un golpe (o rozarla) la arma: 1,1 s de aviso y estalla (daño a Huésped, criaturas y **plantas vecinas**; la Cardo de Ceniza deja fuego). |
| `hongo` | Se hincha 1,2 s y suelta una **nube de veneno** de 7 s (Huésped: daño que no mata y −15 % de velocidad; criaturas: veneno). |
| `narcotica` | Exhala cada 12 s (con aviso de 1,2 s) una **nube de sueño**: Huésped −50 % de velocidad; criaturas casi quietas. |
| `espejo` | Devuelve **los proyectiles enemigos** que pasan cerca (4 reflejos; cada uno la agrieta). No refleja los tuyos. |
| `savia` | Charco pegajoso: todo el que lo pisa camina al 60 %. Inflamable. |
| `brasas` | Dormida hasta que la golpea fuego o una explosión grande: 1 s de chispas y arde 6 s hiriendo y propagando el fuego. |

## Interacción con el Huésped, las criaturas y el entorno
**Huésped:** cura, escudo, energía/definitiva, mordisco, picadura, atrape, veneno (con piso de 8 de vida), sueño, lentitud, fuego. Las mejoras del Herbario achican el daño y agrandan la cura (topes más abajo).

**Criaturas:** las plantas ofensivas hieren y frenan a lo que pasa (jefes exentos); las nubes envenenan o duermen; el fuego las quema (`dotKind: 'burn'`). A su vez, **las criaturas pisotean las curativas** (una criatura encima la destruye en pocos segundos) y **sus disparos las rompen** (los proyectiles enemigos dañan a las plantas; la Planta Espejo los devuelve).

**Armas del Huésped:** el rayo (hitscan), los proyectiles que pasan, las explosiones y el cuerpo a cuerpo dañan a las plantas **ofensivas y tóxicas** sin frenarse (las **curativas no reciben tus disparos, golpes ni explosiones**: así no las rompés sin querer cuando disparás a lo que hay detrás; sólo las rompen las criaturas, el fuego y la niebla ácida); el **elemento** del arma (`brasa`/`solar` = fuego, `glaciar` = hielo, `plaga` = veneno) se pasa a la planta.

**Cadenas elementales:**
- **Fuego:** prende a las plantas inflamables (`infl`), que arden 6 s, hieren y **propagan el fuego** a las vecinas (≤ 4,2 m, 40 %/s). Una explosión grande (≥ 40) prende al Arbusto de Brasas.
- **Hielo:** congela (6 s): una planta congelada **no actúa** y el siguiente golpe fuerte la **rompe** (le saca la mitad de la vida).
- **Niebla ácida** (`src/sim/nieblas.js`): marchita (2,5 s adentro) a las plantas no tóxicas. **Niebla cian:** triplica el crecimiento y hace **florecer** a las marchitas antes de tiempo.
- **Órganos vivos** (`src/sim/arenas-vivas.js`): una Boca llena y el aliento sano de los pulmones **riegan** (×2 de crecimiento); el aliento **tóxico** del pulmón furioso marchita.
- **Eventos de oleada** (`src/sim/eventos.js`): *Lluvia de Astillas* riega (×2); *Eclipse* hace brillar a las flores, agranda el radio de aviso de las ofensivas (×1,25) y trae el Loto del Eclipse; *Bendición de la Aurora* acelera el rebrote dentro de su zona, potencia las curas (×1,4) y trae la Flor de la Aurora.
- **Fauna** (`src/sim/fauna.js`, `docs/FAUNA.md`): los **rastros** de las formas (fuego → quema, escarcha → congela, veneno → daña, raíces → nutren ×2) tocan a las plantas; los **herbívoros pastando** se comen las curativas maduras (4 s) y la API `floraAlimento()` deja que otras piezas las usen como alimento/ADN (`floraElemento()` aplica fuego/hielo/veneno/explosión a las plantas de una zona).

## Cosecha, materiales vegetales y rarezas
- **USAR** (E / botón USAR) sobre una planta madura a ≤ 2,6 m la **cosecha**: entrega a la mochila de la partida 1–3 unidades de su material vegetal con calidad (Burdo/Fino/Excelente/Perfecto) y la planta rebrota. Cosechar lo peligroso (carnívoras, lianas, explosivas, hongos, flor del sueño) **la despierta**: te llevás el material pero el mordisco/estallido llega igual (aviso incluido).
- **Destruir** una planta madura da botín (60 % de lo cosechable y calidad −1).
- Materiales nuevos (`MATERIALS_FLORA` en `src/sim/items.js`, `FLORA_MAT_IDS`): **Fibra viva, Savia, Pétalo de luz, Resina, Néctar, Hoja espejo, Raíz-hierro, Polen psicodélico**. `MATERIAL_IDS` sigue siendo los 7 orgánicos (botín general, tienda y sets viejos no cambian); `TODOS_MAT_IDS` los suma. Se guardan en `perfil.materiales` por calidad (`sumarMat`).
- **Plantas raras** (máx. 4 vivas, duran 80 s, calidad ≥ Excelente, siempre dan **semilla** y un **plano de jardín**): Flor de la Aurora (evento Aurora) · Loto del Eclipse (evento Eclipse) · Retoño del Pacto (al cumplir una misión opcional) · Corona del Jefe (oleada del jefe). Se anuncian en el briefing con `floraBriefing(mapId)`.
- **Briefing:** `floraBriefing(mapId)` devuelve las líneas «Flora de la arena…» y «Plantas raras…» para la pantalla de ruta/mapa. Ya se muestra en la pantalla **Territorios** (`src/client/territorios-ui.js`, línea «🌿 Flora de la arena…» bajo el folclore); la ficha de cada planta rara del Herbario dice cuándo brota.

### Recetas, planos y sets de jardín (contrato de `docs/INVENTARIO.md` intacto)
- 13 objetos nuevos con `jardin: [[material, cantidad]]`: **Set Savia** (Capucha, Coraza, Guantes, Botas, Maza de Savia; base *Raíz*; b2 +3 vida entre oleadas · b4 +5 y −3 % de daño y regeneración) y **Set Flor de Luz** (Corona, Peto, Brazales, Sandalias, Cetro de Pétalos; base *Cristal*; b2 +8 % escudo · b4 +10 % escudo, +4 % habilidades y definitiva y Fervor), **Cerbatana de Espinas** (disparo, veneno), **Semilla de Jardín** y **Corazón de Flor** (reliquias). Todos Raros o Épicos (ninguno Legendario ni firma); topes de `CAPS` y de rareza intactos.
- Receta = la mitad del material base + materiales vegetales (calidad mínima = rareza − 1) + núcleos de su rareza (40 / 90). Los **planos** no son iniciales: salen de las plantas raras y del botín general. `PLANOS_JARDIN` los lista.
- **Consumibles de jardín** (`CONSUMIBLES`, fabricación instantánea con `Perfil.forjarConsumible(id)`; interfaz en Herbario → Forja de jardín): **Botiquín orgánico** (+1 botiquín inicial, tope 5), **Cebo para fauna** (`perfil.flora.cebos`, tope 20; la fauna lo gasta con `Perfil.usarCebo()`) y **una Semilla por cada planta común** (`perfil.flora.semillas[especie]`). Las semillas de las raras no se fabrican: sólo se encuentran.

## Herbario (pestaña del Bestiario)
`perfil.herbario = { vistas, cosechas, hitos }`. Una planta se **descubre** al verla a ≤ 14 m (cartel «Nueva planta en el Herbario»). Hitos (ids en `HITOS`): 3/8/14/22 especies, 10/40 cosechas, 1 y 4 raras. Dan mejoras **pequeñas y permanentes** con tope (`HERB_TOPE`): **curación de plantas +15 %**, **daño de plantas −15 %**, **+1 cosecha**, **+15 % de probabilidad de mejor calidad**. Viajan a la partida como `opts.herb` (ids; el servidor `server/server.js` los acota a 12 y la simulación descarta los falsos con `herbMods`).

## Presupuestos
**Simulación (`LIMITS.flora = 40`):** 22–26 plantas por arena + 4 casillas de raras ≤ 30; hasta 6 nubes; las interacciones con Huésped y criaturas se miden a 10 Hz; los proyectiles se revisan cada tick. Medido: ≈ 0,1 ms por tick de flora.
**Render en Baja** (`tests/flora-render.test.js`, `renderer.info`, escena con sólo la flora menos escena vacía, con 2 nubes de esporas visibles): **≤ 8 llamadas y ≤ 4 000 triángulos agregados** (en la práctica 5 llamadas). Las cinco llamadas: (1) plantas + decorado en una malla fusionada con shader (mece, abre, encoge y pinta cada planta según su estado; tramado por la cámara), (2) marcas de suelo, (3) pasto bioluminiscente que se aplasta al paso, (4) hojas y esporas flotando (puntos), (5) nubes de esporas. Media y Alta suben densidad, detalle y pasto (`vegDens`).
**Menú de Gráficos** (`src/client/graficos.js`): **«Vegetación decorativa»** (interruptor, `cfg().veg`) apaga decorado, pasto y hojas (las plantas del juego y sus avisos se dibujan siempre) y **«Densidad de vegetación»** (Poca / Normal / Mucha, `cfg().vegDens`; Baja = Poca, Media = Normal, Alta = Mucha). Se aplican en vivo (sólo reconstruyen la vegetación).

## Contrato con el resto
- **Snapshot** `fl = { v, s:[[estado, vida %, banderas, progreso %]], nb:[[tipo 0 veneno/1 sueño, x,y,z, r, vida restante %]], b:[[jugador, banderas]], l? }`. `l` (disposición: `[[especie, x,y,z, ux,uy,uz]]`, casilla `-1` = ausente) sólo viaja la primera vez, cada ~1,5 s y cuando una rara brota; la casilla `i` es siempre la misma planta. Banderas de planta: 1 congelada · 2 ardiendo · 4 eclipse · 16 cosechable · 32 rara. Banderas del Huésped: 1 frenado · 2 atrapado · 4 escudo · 8 veneno · 16 sueño · 32 curándose. ≈ 1 KB por snapshot.
- **Eventos del bus** `{ t:'flora', a, sp, id, p, … }`: `cura` `escudo` `energia` `arma` (tel) `muerde` `ata` `pincha` `estalla` `suelta` `refleja` `arde` `hiela` `rompe` `marchita` `brota` `rebrota` `florece` `cosecha` (m, n, q) `rota` `rara` `nube` `comida`.
- **API de la simulación** (`src/sim/flora.js`): `initFlora`, `tickFlora`, `flSnap`, `flVel`, `flRecibe`, `floraRayo`, `floraExplosion`, `floraMelee`, `floraElemento(g, pos, r, elem, by)`, `floraAlimento(g, pos, r, consumir)`, `danarPlanta`, `applyHerb`, `layoutFlora`, `sitioLibre`, `CTL` (apagar flora / ofensivas / curación para pruebas A/B).
- **Ganchos en `game.js`:** `initFlora`/`tickFlora` junto a las arenas vivas y las nieblas, `flVel` en la velocidad, `flRecibe` en `hurtPlayer`, `floraRayo` en `hitscan`, `floraExplosion` en `explode`, `fl` en el snapshot y `applyHerb` en `addPlayer` (y `huespedes.js` → `floraMelee`).
- **HUD (selector que toqué):** únicamente un cartel nuevo **`#flchip`** (dentro de `#hud`, `src/client/flora-fx.js`; mismo patrón que `#ngchip`, 232 px desde arriba a la izquierda, debajo del de las nieblas) que sólo aparece con una planta interactiva a mano o con un efecto de planta sobre el Huésped. Además `main.js` suma `session.floraUsar` al contexto del botón USAR táctil. **No se reestructuró nada del HUD.**
- **Perfil** (`cristal.perfil.v1`, sigue `ver: 2`): `herbario`, `flora = { semillas, cebos }` y `materiales` con los 8 vegetales; perfiles viejos abren con todo vacío. API: `herbario()`, `florita()`, `verPlanta(esp)`, `cosechaPlanta(esp)`, `estadoConsumible(id)`, `forjarConsumible(id)`, `usarCebo()`.

### Contrato para LA BASE (el Jardín de «El Santuario»)
`src/sim/base.js` ya tiene el jardín de 6 macetas (`PLANTAS`, `macetaEstado`; docs/BASE.md). Esta entrega le sumó **8 plantas de maceta** (una por material vegetal: fibra, savia, pétalo, resina, néctar, polen, hoja espejo, raíz-hierro; calidad hasta Excelente) y cambió su filtro a `MATERIALS[p.mat]` para que acepte los materiales vegetales. Para ir más lejos, quien construya la Base tiene:
1. `Perfil.florita().semillas[especie]` (cantidad por especie; `CONSUMIBLES.semilla_<especie>` las fabrica en la Forja de jardín y las plantas raras las sueltan) y `ESPECIES[especie].cos` (qué material y cuánto da cosechada) para que una **semilla** acelere o mejore una maceta (idea: gasta 1 semilla → −50 % de tiempo o +1 de calidad; las semillas de raras = calidad Perfecta).
2. `floraAlimento` / `ESPECIES[...].fn` para decidir si una planta de la Base es peligrosa (las ofensivas no tienen que atacar en la Base: ahí no hay `Game` con flora, `g.map.base` no inicializa fauna y la flora sólo existe en `ARENA_FLORA`).
3. El dibujo reutilizable: `formaPlanta(forma, especie, paleta, detalle)` en `src/client/env/flora-kit.js` devuelve las piezas de cualquier planta para mostrarla en una maceta (hay que fusionarlas con `.hornear(matriz, id, base)` y usar el shader de `flora-fx.js`, o dibujarlas con un material común).
4. Herbario: `Perfil.verPlanta(esp)` para que ver una planta en la Base también la descubra.

## Pruebas y mediciones
`node --test tests/flora-ui.test.js` (pestaña Herbario y opciones de Gráficos, en Chromium) · `node --test tests/flora.test.js` (20 pruebas: catálogo, colocación, determinismo, curativas, ofensivas, tóxicas, explosiva, cadenas del entorno, órganos y eventos, cosecha, raras, enemigos, armas, límites, snapshot, Herbario, recetas, perfil y Forja de jardín) · `node --test tests/flora-bots.test.js` (los bots ganan las 6 arenas; de a una arena con `--test-name-pattern="m4"`) · `node --test tests/flora-render.test.js` (presupuesto de render, Chromium por software) · capturas: `node tools/shot-flora.mjs [mapa|todas] [carpeta] [low|medium|high] [jardin|aviso|nubes|cerca]`.
También deben seguir verdes: `estilos`, `huespedes`, `combos`, `mundo`, `nieblas`, `arenas-vivas`, `eventos`, `limbo-mapas`, `inventario`, `graficos`, `fauna`.

## No probado
iPhone real, cooperativo real con 2+ clientes (sólo la lógica; el servidor acota `herb`), GPU real (todo se midió con Chromium por software), el aspecto fino con el movimiento (sólo capturas).
