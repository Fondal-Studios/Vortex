# Bestiario del limbo — almas en pena y espíritus folclóricos (dueño, 2026-10-14)

Todas las criaturas son **seres que perdieron la vida y la añoran**: quieren la del Pasajero. Estética «realismo espiritual»
(docs/CONCEPTO_ARTE.md): cuerpos translúcidos, velos, huesos, luz interior; un **núcleo de luz** = punto débil. Ids internos sin cambios.

| id | Nombre | Rol | Idea visual / folclore | Esencia |
|---|---|---|---|---|
| astilla | **Ánima** | corredor | alma en pena flaca y veloz, sudario rasgado, deja estela | carne |
| geoda | **Almamula** | tanque | mula sin cabeza envuelta en cadenas y fuego; se cierra en caparazón de huesos | cristal |
| prisma | **Luz Mala** | volador | esfera de luz que se lanza en picada desde la oscuridad | cristal |
| lente | **La Llorona** | a distancia | mujer de velo blanco que dispara lamentos (proyectiles de lágrima) | ojo |
| cuarzo | **Salamanquera** | invocador | bruja de la Salamanca que convoca ánimas | cristal |
| espejo | **Pombero** | emboscador | duende peludo de sombrero que se vuelve invisible y silba | ojo |
| racimo | **Fuego Fatuo** | explosivo | llamita azul que corre y estalla | carne |
| graviton | **El Familiar** | control | perro negro gigante de ojos de brasa que tuerce la gravedad | vacío |
| obelisco | **La Viuda** | francotirador | figura de luto inmóvil, mira y dispara de lejos | ojo |
| aurora | **Difunta** | sanadora | santa milagrosa errante que cura a las otras almas | ojo |
| ariete | **Lobizón** | embestidor | séptimo hijo convertido en lobo, carga a cuatro patas | carne |
| espiral | **El Silbón** | atractor | gigante flaco con un saco de huesos que arrastra con su silbido | vacío |
| coloso | **El Mandinga** | jefe 1 | el diablo criollo, enorme, de fuego y sombra | cristal |
| madre | **La Madre de las Ánimas** | jefe 2 | madre colosal que pare almas | carne |
| argos | **El Basilisco** | jefe 3 | serpiente-gallo de mirada mortal (sus ojos son el combate) | ojo |

## Fauna (los únicos vivos del limbo)
Aparte de las almas en pena de arriba, cada arena tiene **fauna consumible**: bichos chicos y psicodélicos que no quieren tu vida (salvo tres que muerden si los pisás) y que el Huésped puede comer para transformarse. Se estudian en **Bestiario › pestaña Fauna**. Lista completa, formas e híbridos en **docs/FAUNA.md**.

## Colisión con el mundo y política «sin teletransportes» (dueño, 2026-10-21)

El dueño jugó y reportó dos cosas: *«los enemigos no colisionan con las paredes»* y *«si alguno se teletransporta, no habría que cambiarlo, porque hace muy difícil rastrearlos cuando estás por liquidar la horda»*.

### Colisión: qué pasaba y cómo quedó
- **Causa raíz medida** (bots jugando 400 s por arena, centro de la criatura dentro de un sólido): en el **mapa 3 (Laberinto)** entre el 5 % y el 30 % de los cuadros de cada especie estaban *dentro de un muro* (Almamula 30 %, Difunta…); en m1, m2, m5 y m6 casi 0 %. El motivo: `map3.js` le daba a las criaturas un mapa aparte (`mapM`) con **sólo el suelo** («las criaturas atraviesan los muros»), una decisión de diseño vieja que ya no queremos. Además, otras cosas movían criaturas sin colisión: la esquiva del Pombero (3 m de golpe), el arrastre de la niebla cian, los nacimientos pegados a un muro y las invocadas del otro lado de una pared.
- **Ahora** (`src/sim/colision.js`): todas las criaturas —terrestres, voladoras y jefes— chocan contra **los mismos sólidos** que frenan al jugador y a las balas (`map.solids`: muros del laberinto, fachadas, coberturas, islas, colinas, techos). Radio de colisión = radio del modelo × 0,9 (suelo) o × 0,8 (aire) —los factores de siempre, para no mover el equilibrio del juego—, × 1,15 si es élite (el cliente dibuja a las élites 1,22 más grandes).
- **Sin «tunelear»**: el movimiento se hace en sub-pasos según la velocidad (nunca más de 0,45 radios por sub-paso); las esquivas/arrastres usan `empujar()` con barrido; al final de cada tick `resolverTodas()` saca de cualquier sólido a quien haya quedado adentro y, cada 16 ticks, `liberar()` rescata rincones de varios sólidos. Los nacimientos se corrigen al crearse; las invocadas que quedarían del otro lado de un muro aparecen pegadas a su invocadora.
- **Sin que se atasquen** (rodear en vez de empujar): el laberinto tiene **ruta por celdas** (`map3.steer`: rutas más cortas precalculadas entre las 81 celdas, cruzando por el medio del lado abierto); el limbo ya tenía grilla y ahora usa una **segunda ruta para las grandes** (`navBig`, sólo pasos anchos) y un margen de `guard` según el tamaño; m1/m2 usan **antenas** (`desvio`: miran adelante y prueban ±35°, ±70°, ±110°); y el **desatascador** (`desatascar`): si quiere avanzar y casi no se mueve ~1 s, sale por el rumbo más libre durante 1,2 s. Los voladores del laberinto cruzan por encima de los muros (`map.flyMin`). *Probado con bots: las antenas en los voladores los volvían inalcanzables (subían ante cada pared), así que los voladores sólo deslizan.*
- Los proyectiles enemigos ya se detenían en los sólidos (`blocked`, `game.updateProjectiles`, con sub-pasos); no cambió.

### Teletransportes: qué se quitó y qué quedó
| Antes | Ahora |
|---|---|
| «Rezagados» del Vórtice: a los 6 s (≤ 4 quedan) o 25 s sin bajas, las criaturas a > 28 m se **reubicaban** junto al jugador con evento `blink` | **Acoso** (`src/sim/rezagados.js`): ganan velocidad creciente (×1 → ×1,6 en 10 s, y un piso de ~11 m/s para las lentas) y van **derecho al jugador** por la ruta del mapa; a < 22 m (12 m en el tramo final y sólo con línea de vista) vuelven a pelear normal |
| Criatura lejos (> 95 m, o > 55 m e inmóvil) 7 s: se reubicaba | Pasa a **acoso** (no se mueve de golpe) |
| Criatura fuera del mapa: moría sin efecto | **Desintegración visible** (`desint`, sin botín, cuenta como baja) |
| Esquiva del Pombero al recibir un golpe: salto de 3 m en un tick | Deslizamiento de 0,15 s con colisión |
| Emboscada del Pombero: aviso 0,6 s, sin marca | **Aviso 0,9 s**, marca en el piso del punto de llegada, **rastro** hasta ahí (evento `tele`), el Pombero se descubre mientras avisa; **no** se teletransporta ni se camufla en el tramo final de la oleada (≤ 8 criaturas, sin cola) ni en acoso |

- **Marcadores**: las últimas criaturas (≤ 6, sin jefe) y las que acosan llevan un **faro de luz** vertical y un halo dibujados *a través de paredes* (ámbar = últimas, magenta = acosando) y una **flecha de radar grande con la distancia** (se incluyen las camufladas). Radar: `client/radar.js`; faro: `render.js › faro()`.
- **Atascadas**: si una criatura en acoso casi no se mueve en 5 s (lejos o sin verla), o lleva 20 s cerca pero sin línea de vista, se **desintegra** (efecto + evento `desint`, sin botín). Nunca se la mueve.
- **Nacimientos con aviso**: los refuerzos de la cola nacen 1,1 s después de su `omen`; ahora el cliente dibuja ese aviso (anillo que late en el punto de nacimiento). Los refuerzos que invocan los jefes aparecen donde la invocación, no «saltan».
- La Difunta (sanadora) sola ya no se esconde lejos: orbita cerca, a tiro.

## Los jefes de cada arena (mecánicas e IA adaptativa)
Cada arena tiene su jefe con 4 fases, telegrafías, un momento único y una IA que se adapta a tu estilo (melé / tirador / habilidades / esquivador). Todo el detalle en **docs/JEFES.md**.
| Arena | Jefe | Cuerpo | Momento único |
|---|---|---|---|
| m1 | El Mandinga | coloso | Pisotón: cae y deja el núcleo al descubierto |
| m2 | La Madre de las Ánimas | madre | El Parto: huevos protectores y raíces |
| m3 | El Basilisco | argos | Mirada Total: sólo los muros te salvan |
| m4 | El Basilisco del Jardín | argos | Floración de ojos: ojos que revientan |
| m5 | El Mandinga del Reloj | coloso | Las doce campanadas y la medianoche |
| m6 | El Basilisco del Osario | argos | La Procesión de huesos |
