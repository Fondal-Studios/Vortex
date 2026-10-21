# Jefes: fases, mecánicas e inteligencia adaptativa

> Pedido del dueño (tras jugar): «Los jefes como que no tienen muchas mecánicas; tendrían que tener. Estaría buenísimo que estén provistos con una
> INTELIGENCIA ARTIFICIAL que se adecue a la forma de jugar del jugador —si es melé, si es shooter— y que vaya cambiando.»

Cada una de las 6 arenas tiene **su** jefe, con **4 fases** por vida, un repertorio de ataques con **telegrafía de al menos 1 s**, ventanas donde queda
expuesto, partes destruibles, una mecánica de equipo para cooperativo, un **momento único** y **enfurecimiento por tiempo**. Además **lee cómo jugás**
(melé / tirador / habilidades / esquivador) y **cambia de postura** para contrarrestarte, avisándote para que puedas contra-adaptarte.

## En palabras simples (para el dueño)
- **Antes:** los jefes flotaban lejos, tiraban orbes y poco más; con el puño no se les podía ni llegar.
- **Ahora:** cada jefe tiene **4 fases** (cambia de conducta al 75 %, 50 % y 25 % de vida), **marcas rojas/naranjas en el suelo** que avisan dónde va a pegar (siempre con tiempo para reaccionar),
  momentos en que **baja al suelo y queda expuesto** (ahí le pegás con todo, también con el puño), partes que se rompen (huevos, ojos, pilares) y **un momento único** que es la firma de cada jefe.
- **Aprende de vos:** mira cómo jugás (¿pegás de cerca? ¿disparás de lejos? ¿usás poderes? ¿sólo esquivás?) y se «endurece» contra eso (hasta un 25 % como mucho) y usa ataques pensados para molestarte.
  Te lo dice con un cartel («¡El Mandinga aprende de ti! Se endurece contra tu puño») y con un icono + texto bajo su barra de vida.
- **Podés ganarle la mano:** si **cambiás de modo** (Disparo ↔ Melé) se desconcierta 10 s y recibe más daño. Nunca se vuelve imposible ni inmune.
- **Probado con bots** de cada estilo (tirador, melé, habilidades, esquivador) en las 6 arenas. Lo que NO se pudo probar acá: jugarlo a mano, el iPhone y el cooperativo real por internet.

Código: `src/sim/jefe-data.js` (datos y textos) · `src/sim/jefe-ia.js` (la IA) · `src/sim/jefe-mec.js` (fases y ataques) · `src/sim/jefes.js` (fachada que
usan `game.js` y `ai.js`) · `src/client/jefes-fx.js` (marcas, barra, banners, cine) · `tools/jefe-bots.js` (bots por estilo) · pruebas `tests/jefes*.test.js`.

## Reglas de diseño (políticas)
- **Sin teletransportes.** El jefe nunca cambia de lugar de golpe: sólo se mueve con velocidad limitada (picadas a 40 u/s, caídas a 31 u/s, subidas a 9 u/s,
  la Madre se asoma a 17 u/s). Hay una prueba que mide el mayor desplazamiento por cuadro (`salto` < 1,2 u).
- **Telegrafía ≥ 1 s** para todo ataque nuevo: una **marca en el suelo** que se llena (aro + disco con el color del ataque), un sonido que sube de tono y,
  si hace falta, un texto con el consejo («Salí de las marcas del suelo»). Los ataques viejos (anillos de orbes) ahora avisan 1 s.
- **Todo con contrajuego:** moverse, saltar la onda, cubrirse detrás de un muro, romper una parte (ojos, huevos), juntar al equipo, o **cambiar de modo**.
- **Determinista, sin `g.rng`:** el jefe usa un generador propio derivado de la semilla (`ia.rs`, un entero que viaja con el estado).
- **Presupuesto de render (Baja):** los efectos de jefe agregan ≤ 16 llamadas y ≤ 6 000 triángulos (en la práctica 6 llamadas y ≈ 2 200 triángulos: tres
  `InstancedMesh` para las marcas, una esfera de escudo y un halo de núcleo). Prueba: `tests/jefes-render.test.js` (usa `renderer.info` en Chromium).

## Los 6 jefes

| Arena | Jefe (cuerpo) | Fases (por vida: 100 / 75 / 50 / 25 %) | Momento único (entra en la fase 3) | Usa de su arena |
|---|---|---|---|---|
| m1 Vacío de Islas | **El Mandinga** (Coloso) | El Trato · Brasas del Pacto · Pisotón · Furia del Mandinga | **PISOTÓN**: se alza, cae, la onda sólo pega a quien está en el suelo (¡saltala!) y queda con el **núcleo al descubierto** (escudo fuera) | órganos del Corazón de Isla · niebla del vacío · fuego sobre la flora |
| m2 Cámara Fractal | **La Madre de las Ánimas** (Madre) | La Gestación · El Parto · Raíces · Madre Furiosa | **EL PARTO**: 5–8 huevos protectores (daño ×0,6 mientras vivan); si los rompés todos queda **abierta** y expuesta 6 s. Además **raíces** que atrapan | órganos del Espejo que Respira · niebla alucinógena |
| m3 Laberinto Celestial | **El Basilisco** (Argos) | Ojos Abiertos · El Laberinto Mira · Mirada Total · Párpados Rotos | **MIRADA TOTAL**: la arena se oscurece 3 s y un haz gira 360° durante 7 s; **sólo los muros te salvan** | órganos de la Garganta · niebla blanca |
| m4 Jardín de Carne | **El Basilisco del Jardín** (Argos) | Capullo de Ojos · Floración · Raíces y Mirada · Marchitez Furiosa | **FLORACIÓN DE OJOS**: brotan ojos en el suelo que disparan miradas cortas y **revientan** a los 16 s curando al jefe; si los rompés todos queda expuesto | Madre Raíz (órganos) · niebla ácida · fuego sobre la flora |
| m5 Plaza de los Ecos | **El Mandinga del Reloj** (Coloso) | El Pacto · Campanadas · Medianoche · Hora Detenida | **LAS DOCE CAMPANADAS**: 12 marcas en círculo que caen una por hora (escalonadas); a **medianoche el Mandinga cae** (reloj detenido, núcleo expuesto) | órganos del Reloj · niebla ámbar |
| m6 Osario sin Techo | **El Basilisco del Osario** (Argos) | Hueso y Ceniza · Procesión · La Grieta Mira · Todos los Muertos | **LA PROCESIÓN**: una fila de marcas avanza hacia vos y luego otra cruzada | órganos del Osario · niebla negra |

Los tres cuerpos conservan su mecánica de siempre (Mandinga: resonadores + rayo reflejable; Madre: válvulas + huevos; Basilisco: ojos orbitando + mirada
avisada 2,5 s). Lo nuevo se **suma**.

### Repertorio (jefe-mec.js; datos y pesos en `REPERTORIO`)
| Ataque | Fase mín. | Qué hace / telegrafía | Contrajuego |
|---|---|---|---|
| **Onda circular** (`nova`) | 1 | círculo alrededor del jefe (1,2–1,5 s); daño y empuje | salir del círculo |
| **Zonas de peligro** (`zonas`) | 1 | N círculos sobre vos y tu equipo (≈1,7 s) que explotan; contra el esquivador quedan 6 s quemando | moverse |
| **Aspas giratorias** (`barrido`) | 2 | 2–3 haces rotando 5 s tras 1,6 s de aviso; los muros los frenan | saltar, cubrirse, correr en el sentido contrario |
| **Picada** (`carga`) | 2 | línea roja de 1,2–1,5 s; baja y embiste a 40 u/s; después queda **cansado** 4 s (daño ×1,3) | salirse de la línea; aprovechar el cansancio |
| **Muro de reflejos** (`reflejo`) | 1 | aro azul 1,3 s; 3,2 s de escudo frontal: disparos ×0,45 y te los devuelve | flanquear, melé o habilidades |
| **Coraza de espinas** (`espinas`) | 1 | aro naranja 1,3 s; 5 s: melé ×0,78, devuelve 9 al que golpea y aura cercana | pelear de lejos o esperar |
| **Silencio** (`silencio`) | 1 | aro violeta de r 30 y 2 s de aviso; sin habilidades 2,8 s y recargas +2,5 s | quedar fuera del aro |
| **Muralla de huesos** (`muralla`) | 2 | tres círculos de 1,5 s y luego **3 pilares destruibles** (260 de vida) entre el jefe y el tirador más lejano: frenan tus disparos 14 s o hasta que los rompés | romperlos, rodearlos o cambiar de estilo |
| **Vuelo de almas** (`voladores`) | 2 | 2–5 Luces Malas con señal de 1,2 s | matarlas / cubrirse |
| **Juntos** (`reparto`, **mecánica de equipo**) | 3 | círculo amarillo 3 s: el golpe grande se **reparte entre los que están dentro** (19 × jugadores ÷ los de adentro); afuera = 62 completo | todo el equipo adentro |
| **El campo responde** (`arena`) | 2 | ordena atacar ya a los órganos del organismo vivo de su mapa (cada uno con su propia telegrafía) y suelta una niebla temporal con aviso de 2,4 s; contra el tirador la niebla va **alrededor del jefe y lo oculta** (disparos de más de 26 m ×0,7, 14 s) | las nieblas y órganos de siempre |
| **Trampas** (`trampas`) | 2 | hasta 3 marcas que se activan a los 1,3 s y duran 14 s; explotan al pisarlas | no pisarlas / romperlas moviéndose |
| **Caída** (`descenso`) | 1 | marca grande 2 s; se alza y cae; ver «Ventanas de vulnerabilidad» | saltar la onda; pegarle después |

### Ventanas de vulnerabilidad y por qué existe la caída
Los jefes flotan entre 24 y 34 m sobre el piso: **el melé no los alcanzaba nunca** (alcance 4 + radio 7 u). La **caída** les da una **ventana** (7 → 5,5 s según
la fase) en la que quedan a ras del suelo con **daño ×1,35**, el **escudo fuera** (Mandinga: «núcleo expuesto»; Basilisco: «párpados cerrados») o la Madre
**abierta**, y **pausan sus ataques viejos** (no te disparan mientras le pegás). Cada ~18–28 s, más seguido en la Madre porque está en el centro de la esfera:
ahí «se asoma» hacia el casco a 17 u/s (6,5 s de viaje con sus orbes en pausa).

## La IA adaptativa (jefe-ia.js)

### 1) Mide (cada 0,25 s)
Por cada jugador, en una **ventana deslizante de 20 s** (20 cubetas de 1 s) y en una **memoria larga** con decaimiento exponencial (τ = 60 s) que **no se borra al
cambiar de fase**:
- daño **melé / disparo / habilidad** (la fuente es `g.dmgSrc` o `p.inMelee`, la misma que ya usan los estilos), al jefe y a los adds (**foco**);
- **distancia media** al jefe, **movilidad** (velocidad), **esquivas** (dash/salto), **uso de cobertura** (un rayo cada 0,5 s hacia el jefe), **curación** (saltos de vida/escudo);
- **intención**: cuadros con A1/A2 (Combo) o melé rápido, con disparo, y «lanzó una habilidad hace < 6 s»; **precisión** (aciertos de disparo / cuadros disparando).

### 2) Clasifica (una vez por segundo), por jugador y para el equipo
`share = w·(daño del tipo / daño total) + (1−w)·(intención del tipo / intención total)`, con `w = clamp(daño / 140)` (sin daño todavía manda la intención).
- **melé** = share_melé · (0,55 + 0,45·cercanía) · **tirador** = share_disparo · (0,55 + 0,45·lejanía) · **habilidades** = share_habilidad
- **esquivador** = (1 − daño/70) · (1 − 0,8·actividad) · (0,5 + 0,3·movilidad + 0,2·cobertura) · (0,25 + 0,75·lejanía), recién a partir de los 8–16 s
- `cercanía = clamp(1 − (distancia media − 5)/22)`. Se mezcla ventana y memoria (70/30). Gana el mayor si su puntaje ≥ 0,4 y supera al segundo por ≥ 0,12; si no, **mixto**.
- El estilo del equipo suma a todos ponderando por daño (quien más pega, más pesa). Si no hay pruebas nuevas (está esperando la próxima ventana), **conserva** el estilo.

### 3) Histéresis (no cambia de golpe)
El estilo del equipo sólo cambia si el rival supera al actual por **0,15 durante 4 s seguidos**; volver a «mixto» exige 12 s. Tras cambiar de postura no cambia otra
vez antes de **11 s** (ventana de gracia; en un cambio de fase, 5,5 s). La postura llega a su fuerza plena en **5 s** (rampa). La primera adaptación no ocurre antes de los **7 s**.

### 4) Elige la postura y las contramedidas
| Estilo detectado | Postura (icono · texto en la barra) | Resistencia | Ataques que pesan más | Otros efectos |
|---|---|---|---|---|
| **Melé cercano** | ✶ Coraza de espinas | melé hasta +25 % | ondas ×2,4, espinas ×5, aspas ×1,3 | espinas pasivas (devuelve ≤ 5 por golpe), **se afirma un 30 % más** en el suelo |
| **Tirador a distancia** | ⛨ Muro de reflejos | disparo hasta +25 % | reflejo ×5, **picadas ×3,5** (cierra la distancia; elige al más lejano), vuelos ×4, muralla ×6 | niebla que lo oculta |
| **Habilidades** | ⌁ Silencio y absorción | habilidad hasta +25 % | silencio ×6, «el campo responde» ×1,4 | **absorbe** el 5 % del daño de habilidad como vida |
| **Esquivador** | ☗ Asedio de zonas | — | zonas ×3 (más, más rápidas, **quedan en el suelo**), trampas ×9, aspas ×2,2, campo ×2 | |
| **Mixto** | ◇ Midiendo tu estilo | — | repertorio base | |
Los multiplicadores de peso se escalan con la fuerza de la postura (0 → 1).

### 5) Topes (nunca injusto)
- **Resistencia por adaptación ≤ +25 %** (el daño se divide por 1,25 como mucho), y sólo una fracción por fase: **40 / 60 / 80 / 100 %** del tope en las fases 1–4.
- **Piso del daño total 0,2** (jamás inmunidad): sumando ventanas, escudos temporales y resistencia, el jefe siempre recibe ≥ 20 %.
- Los escudos temporales (reflejo, espinas) duran 3–5 s con 1,3 s de aviso y se eligen con peso, no a la fuerza.

### 6) Señales al jugador
- **Banner**: «¡El Mandinga aprende de ti! Se endurece contra tu puño» (y las otras tres), con sonido de dos notas.
- **Barra del jefe**: nombre, `FASE n/4 · nombre`, muescas de fase (75/50/25 %), **chip de postura** (icono + texto + fuerza) que pulsa al cambiar, y «Te lee: ✊ Melé cercano».
- **Ventana**: «NÚCLEO EXPUESTO 6 s», «EXPUESTO 5 s · ¡daño ×1,35!», «REFLEJA TUS DISPAROS», «COSTRA DE ESPINAS», «¡ENFURECIDO!».
- **Panel de mecánica** (debajo): el ataque que se prepara con su tiempo y el consejo («ZONAS en 0,5 s · Salí de las marcas del suelo»).

### 7) Contra-adaptación premiada
Si **cambiás de MODO** (Disparo ↔ Melé, botón MODO/Tab), el jefe se **desconcierta**: durante **10 s** no puede cambiar de postura, su postura vieja se desvanece
(la resistencia baja de a poco) y mientras tanto recibe un **10 % más** de daño. Banner: «¡Lo desconcertaste! El Mandinga tarda en readaptarse». Cuando se recompone,
si seguís con el estilo nuevo, adopta la postura que corresponde (≈ 15–20 s en total).

### 8) Cada fase y entre intentos
- En cada **cambio de fase** la IA vuelve a evaluar con ventana + memoria (puede adaptar antes de que termine la gracia).
- **Entre intentos, suave:** `jefeMemoria(boss)` devuelve `{ s: estilo, c, n }`; el cliente la guarda en `localStorage` (`arcanum.jefeMem.<mapa>`) al terminar y se la pasa a
  `new Game({ jefeMem })`. El jefe arranca con la postura de ese estilo pero **a ≤ 40 % de fuerza** hasta que mide la primera adaptación propia, y dice
  «El Mandinga recuerda cómo peleaste la vez anterior».

### 9) Enfurecimiento por tiempo
A los **600 s** de combate (+90 s por jugador extra) empieza a ramparse durante 60 s: **+40 % de daño** y **−35 % de intervalo** entre ataques, con el aviso
«¡EL MANDINGA ENFURECIDO!». Los bots de prueba ganan mucho antes (40–600 s según el estilo).

## Cooperativo (hasta 4)
- La vida del jefe ya escalaba (+70 % por jugador extra); ahora además los ataques escalan en cantidad (zonas, vuelos, huevos, ojos) y el límite de enfurecimiento sube.
- **Juntos** (`reparto`) es la mecánica de equipo: reparte un golpe entre quienes estén en el refugio. Con un solo jugador es un golpe chico si te metés y grande si no.
- El perfil se mide **por jugador** (`ia.pl[id].estilo`) y para el equipo: las víctimas de los contraataques se eligen por estilo (la picada va por el tirador más lejano; el
  silencio y la niebla, por el esquivador/tirador).

## Parámetros (`IA` en jefe-data.js)
`muestra` 0,25 · `ventana` 20 · `memoria` 60 · `mezclaMemoria` 0,3 · `primera` 7 · `confMin` 0,4 · `histeresis` 0,15 · `persiste` 4 · `gracia` 11 · `rampa` 5 ·
`rezago` 10 · `descon` 1,1 · `topeRes` 0,25 · `resFase` [0,4 0,6 0,8 1] · `pisoMul` 0,2 · `actividadMin` 70 · `enrageT` 600 · `enrageCoop` 90 · `enrageRampa` 60 ·
`enrageDanio` 0,4 · `enrageRitmo` 0,35.

## Snapshot compacto (`snapshot().boss`)
Además de `hp, max, name, shield, stagger, pressure, ray, eyes, gaze` (como siempre): `f` (fase 1–4), `ia = { st postura, lv fuerza 0..1, es estilo del equipo, cf confianza,
sh [%melé, %disparo, %habilidad], lg retraso, ds desconcierto, en enfurecimiento 0..1, n cambios }` y `mc = { f, tg marcas, bj ventana, nu núcleo, rf reflejo, sp espinas, vl multiplicador,
dk oscuridad, pr protegida, ac ataque en curso, br ojos brotados, cr huevos, mj mapa }`. Cada marca: `[tipo c|l|b|h|o, x, y, z, r, restante, total, color, extra]`. El perfil crudo **no** viaja.
El resumen pesa < 1,2 KB aun con 16 marcas (prueba). Eventos nuevos: `phase {n, nm}`, `jia {k: adapt|desc|enr|unico|recuerda|silencio}`, `jatk {k: tel|nova|zona|impacto|…}`.

## Pruebas
| Suite | Qué prueba |
|---|---|
| `tests/jefes.test.js` | datos de los 6 jefes · telegrafía ≥ 1 s de cada ataque · nova, zonas, caída/núcleo, picada, reflejo, espinas, silencio, reparto, parto, floración, campanadas, procesión, mirada total · reacción de la IA (< 15 s: melé→antimele, tirador→antidist, habilidades→antihab, esquivador→antipasivo, mixto sin zigzag) · readaptación con retraso al cambiar de modo · topes · determinismo y JSON · snapshot compacto · enfurecimiento · memoria entre intentos |
| `tests/jefes-bots.test.js` | los 6 jefes caen ante bots tirador, melé y de habilidades pasando por las 4 fases, sin teletransportes |
| `tests/jefes-balance.test.js` | coste de la adaptación (IA encendida vs apagada) entre −25 % y +45 % por estilo (varias semillas) |
| `tests/jefes-render.test.js` | presupuesto de render en Chromium (≤ 16 llamadas, ≤ 6 000 triángulos) y barra con fases/postura |

Herramientas: `node tools/shot-jefes.mjs m5 campanadas,nova,descenso` (capturas de telegrafías), `tools/jefe-bots.js` (`pelea({ mapId, estilos, ia })`).
`mecForzar(g, boss, 'zonas')` arranca un ataque a pedido (pruebas y modo desarrollo); los interruptores `CTL` de jefe-ia.js (`apagada`, `sinResist`, `sinEfectos`, `sinPesos`) permiten medir cada parte.

### Equilibrio entre estilos: lo que se midió (y lo que no)
Con bots, el tirador y el melé tardan parecido (40–120 s contra la mayoría de los jefes) y el bot de **habilidades** (Singular) es 2–5 veces más lento contra los escudos de los
jefes (150–570 s): su daño sólo cuenta bien en las ventanas. Es una diferencia del jugador de prueba y de los escudos de siempre, **no** de la adaptación (el coste de ésta está acotado
arriba). No se ajustaron los escudos 0,05 de Mandinga/Basilisco para no tocar el diseño de siempre; si la sensación humana lo pide, el lugar es `BOSS_MECH.shield`.
Quedan sin probar con personas: la sensación de las telegrafías, el cine, el iPhone, el cooperativo real por red y el equilibrio fino con mejoras de partida completa.

## Cómo agregar un jefe o un ataque
1. Datos: `JEFES[mapa]` (nombre, cuerpo, fases, único, arena) y, si es un ataque nuevo, su entrada en `REPERTORIO` (fase, peso, pesos por postura).
2. Lógica: un objeto en `ATQ` de jefe-mec.js con `ini(g, m)` (crea la marca con `marca(...)` y devuelve el estado) y `paso(g, m, a, dt)` (devuelve `true` al terminar).
   Siempre con `T ≥ 1 s`, usando `D(g, m, daño)` para el daño y `rnd(m)` (nunca `g.rng`).
3. Cliente: si usa un tipo de marca nuevo, agregalo en `JefesFx.update` y un consejo en `CONSEJO`; sonido en `Sound.jefe`.
4. Prueba: sumalo a la lista de `tests/jefes.test.js` (telegrafía ≥ 1 s y su resolución).
