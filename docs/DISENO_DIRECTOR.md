# Diseño del director — qué aprendimos de los shooters cooperativos por oleadas (y qué elegimos)

> Este estudio sale de mi conocimiento de estos juegos (diseño, estructura y reglas conocidas), **no de datos de ventas ni de partidas medidas**. Sirve para decidir *qué mecánicas funcionan y por qué*, no para citar cifras.

## 1. La pregunta de diseño
Un shooter de oleadas se vuelve aburrido cuando **todos hacen lo mismo** (disparar al que se mueve) y **nadie necesita a nadie**. Los juegos cooperativos que más se juegan resuelven esas dos cosas con *interdependencia*: que tu decisión importe para el resto y que el resto importe para vos.

## 2. Juegos estudiados y qué roban los buenos
| Juego (tipo) | Qué hace muy bien | Qué adaptamos acá |
|---|---|---|
| **Left 4 Dead 2** (campaña coop) | Un **Director de IA** que lee el estrés del equipo y regula el ritmo (picos y respiros); infectados especiales con roles que obligan a rescatarse entre sí; **caer y levantar** compañeros | **Director** de ritmo (§4.1); criaturas con rol que castigan al jugador aislado; **derribo con cuenta regresiva y reanimación** |
| **Deep Rock Galactic** (coop PvE) | **Clases con función única** que se complementan; recursos compartidos; objetivos variados; 'señales' (pings) | **4 roles** con habilidad propia (§4.2); **ping** contextual (§4.4); objetivos de misión (§4.3) |
| **Helldivers 2** (coop PvE) | Objetivos distintos por misión; **estratagemas** que se piden y se comparten; fuego aliado → coordinación | Habilidades desplegables (cúpula, torreta, pulso); mapa lleno de **objetivos**, no solo «matar» |
| **Halo: Firefight / Gears Horde** (oleadas) | Oleadas con **jefes de ronda**, ritmo claro, armas distintas, modificadores | Estructura de oleadas con jefe final; el jefe **cambia las reglas** de la pelea |
| **Call of Duty: Zombies** (oleadas) | Progresión por oleada, economía de puntos, **«huevos de Pascua»**: puzzles enormes que el grupo resuelve | **Puzzles cooperativos** dentro de la oleada (§4.3) con recompensa |
| **Vermintide 2** (coop PvE) | **Llevar un objeto** mientras el equipo te cubre; jefes con mecánicas distintas | **Núcleo de memoria**: uno lo lleva, otros cubren (§4.3) |
| **Risk of Rain 2** (roguelite coop) | **«Cargar el teletransportador»**: defender una zona mientras llega la horda | **Ancla de realidad**: defender y cargar (§4.3) |
| **Destiny 2** (incursiones) | Jefes con **fases y mecánicas de rol** (reflejar, sincronizar, destruir sacos) en vez de «más vida» | Coloso: **reflejar el rayo**; Madre: **purgar válvulas + romper huevos** (§4.5) |
| **Warframe / Back 4 Blood** | Variedad de objetivos y mejoras de equipo; sensación de progreso | Recompensas de equipo por objetivo; fragmentos de historia |
| **Overwatch / Apex** | **Roles legibles**, pings de equipo sin hablar | Roles con silueta reconocible; ping universal |

## 3. Pilares que salen del estudio
1. **Interdependencia real:** hay cosas que *solo* se logran entre varios (o con mucho riesgo en solitario).
2. **Cada rol aporta algo distinto** y se nota (en la silueta, en el HUD y en la pelea).
3. **Claridad:** todo ataque y todo objetivo avisa (brillo, línea, marca, ping). Morir nunca debe sentirse injusto.
4. **Ritmo dirigido:** picos y respiros; el director no castiga de más a quien ya está mal.
5. **Sentido:** cada oleada *quiere* algo (un objetivo) y entrega un pedazo de historia.
6. **Los jefes cambian las reglas**, no solo suben el número de vida.

## 4. Lo que se implementó (y cómo funciona)

### 4.1 Director de ritmo (estilo Left 4 Dead)
Mide el **estrés** del equipo (daño reciente, vida baja, caídos). Con estrés alto **espacia las apariciones y suelta más botiquines**; con estrés bajo y mucho tiempo sin presión **mete un pelotón de criaturas especiales**. Resultado: partidas que respiran y suben, sin que el jugador lo note.

### 4.2 Cuatro roles (estilo Deep Rock / Helldivers) — tecla **E** / botón / ○
| Rol | Habilidad (recarga) | Pasivo | Cuándo brilla |
|---|---|---|---|
| **Vanguardia** | **Cúpula** (24 s): escudo de 6 s que destruye proyectiles y reduce 40 % el daño a los de adentro | resiste más | proteger una Ancla o a un compañero caído |
| **Soporte** | **Pulso sanador** (20 s): cura 40 y repone escudo en radio 12; **reanima al instante** a quien esté a ≤ 4 | reanima en 1,5 s (los demás 3 s) | rescates y jefes |
| **Ingeniero** | **Torreta** (28 s): dispara sola 22 s | deja **caja de munición** al empezar cada oleada | defender zonas |
| **Explorador** | **Marca** (16 s): marca criaturas en radio 32 → **+30 % de daño** de todo el equipo 9 s y revela a los Espejos | +8 % velocidad | cazar prioridades (Aurora, Gravitón) |

### 4.3 Objetivos de oleada y puzzles cooperativos (con sentido)
Cada oleada puede traer un **objetivo**, además de sobrevivir. Si lo cumplís: **suministros, +25 % de daño 30 s al equipo y un fragmento de historia**. Si fallás (o se acaba el tiempo): sale una **oleada de castigo** y no hay recompensa — pero la partida sigue.
- **Ancla de realidad** *(defender)*: se carga mientras haya jugadores dentro del círculo (más jugadores → carga más rápido). Las criaturas la roen: **hay que cubrirla**.
- **Sintonía** *(puzzle de sincronía)*: placas lejos unas de otras (en el Mapa 1, en **islas distintas**: hay que usar portales). **Todas deben estar pisadas a la vez durante 3 s.** En coop se reparten; **en solitario** cada placa queda «viva» 10 s después de salir, así que se resuelve corriendo contra el reloj.
- **Núcleo de memoria** *(llevar y cubrir)*: lo carga **uno** (más lento y **sin poder disparar**) hasta un altar; el resto lo cubre y puede **pasarle el núcleo con ✕/E** cerca. En el Mapa 1 el altar está **en la isla-techo**: hay que usar el ascensor de gravedad invertida con el núcleo.

### 4.4 Ping (estilo Apex/Division) — tecla **G** / tocar con dos dedos / R3
Marca criatura, objetivo o lugar y **todos lo ven** (con distancia). Sin hablar, el equipo se coordina.

### 4.5 Jefes con mecánicas independientes (estilo Destiny)
- **Coloso Prismático**: tiene un **Escudo de Resonancia** (recibe 5 % del daño). Cada ~14 s carga un **Rayo del Vacío** hacia uno de los **resonadores** (pilares en la isla). Si un jugador **está parado en el pilar marcado** cuando llega el rayo, lo **refleja**: el escudo estalla y el Coloso queda **aturdido 8 s recibiendo ×2,5**. Si nadie sintoniza, el pilar cae y daña en área. (Fase 2: dos rayos a la vez → hace falta **un jugador por pilar**.)
- **Madre Geoda**: **blindada** (15 %) mientras su **presión** sube. Hay dos **válvulas** vivas en las paredes, **a ~50 u una de otra**: hay que **mantener las dos a la vez** (dos jugadores; en solitario, la primera queda activa 9 s mientras corrés a la otra) para **purgar** y dejarla **abierta 9 s**. Además cada ~18 s **pone huevos**: hay que **romperlos en 12 s** o eclosionan en Arietes.
Las dos peleas son **distintas entre sí** (reflejar y posicionarse vs. sincronizar y limpiar) y distintas del resto del juego.

### 4.6 Derribo y reanimación
Al llegar a 0 de vida **caés** y empieza una **cuenta regresiva de 25 s**. Un compañero cerca **3 s** te levanta con 50 de vida (el Soporte, 1,5 s o instantáneo con el Pulso). Si se agota, quedás **fuera hasta la próxima oleada**. En solitario, caer es perder.

### 4.7 Sentido (historia dentro del juego)
Cada objetivo cumplido **recupera un fragmento de recuerdo** que cuenta el Heraldo: qué es el Vórtice, por qué existen los dos corazones y quién fue él. Ver `src/sim/data.js › FRAGMENTS` y `HISTORIA.md`.

## 5. Qué no entró (y por qué)
Economía con compuertas de compra (CoD Zombies) y mejoras permanentes tipo roguelite (RoR2/B4B): requieren balance largo y persistencia; **quedan como siguiente fase**. Fuego aliado (Helldivers): se evitó para no frustrar al jugador novato.

## 6. Cómo se verifica
Pruebas automáticas de cada objetivo, cada habilidad, cada mecánica de jefe, el director y los pings (`tests/director.test.js`), y bots que **juegan los objetivos** de principio a fin (`tests/bots.test.js`). Sin partidas humanas: el balance sigue siendo de bot.
