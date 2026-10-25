# Medición de capítulos de la campaña (sin navegador)

Rama `claude/vortex-fase0-sprint1` sobre `62244b6`. Solo medición: no se tocó código del juego. Se agregaron `tools/audit/medicion-capitulos.mjs` y `tools/audit/guardado-test.mjs`.

**Leyenda:** **[M]** medido con el sim en este SHA · **[I]** inferido (lectura de código o extrapolación) · **[NV]** no verificado.

## 0. Cómo se midió

- **Qué se juega:** `new Game({ mapId, campaign: true, seed, magazines: true, calm: 4, skillLevel })`, o sea la operación real de la campaña (no el modo libre). El capítulo 1 usa `skillLevel 0` (perfil nuevo); los demás usan `2`. 60 Hz. El tope es 1500 s de reloj de sim (25 min); pasado eso la partida cuenta como «no concluye».
- **Bots:** hay uno por estilo, 3 semillas por capítulo y estilo, o sea 54 partidas.
  - `shooter`: `botEstilo` de `tools/jefe-bots.js`, con axioma y estilo `disparo`.
  - `melee`: axioma en modo combo. Con jefe usa la lógica oficial de `jefe-bots.js`; sin jefe, un bot de acercarse y golpear escrito en el script de medición.
  - `skills`: singular. Con jefe usa la lógica oficial; sin jefe, el bot base más habilidades al estar listas.
- **Recompensas:** al terminar cada partida se llama al `perfil.js:cerrarPartida` real (localStorage simulado en memoria), y `completarCapitulo` solo si ganó (igual que `main.js:endGame`).
- **Limitación de bots [M]:** `tools/jefe-bots.js` solo diferencia estilos cuando hay un jefe vivo; antes cae al bot base. Por eso el script de medición agrega comportamiento propio para melé y habilidades fuera del jefe. Los bots no son humanos: no hay playtest.
- **Un descarte de la medición [M]:** en la primera pasada, el estilo `skills` dejó 5 de 18 partidas «sin terminar» (m1 y m2 en el jefe). La causa era del bot: con `skillLevel` activo, `gateSkills` (`src/shared/skill-path.js`) exige el flag `support` en la entrada. El cliente real lo manda; los bots de `tools/` no. Con ese flag agregado, todo concluye. El script lo añade (`sup()`).

Comandos exactos:

```
node tools/audit/medicion-capitulos.mjs all all 1,2,3 salida.jsonl   # 54 partidas, ~90 s de CPU
node tools/audit/medicion-capitulos.mjs all idle 1,2,3 idle.jsonl    # jugador AFK, 18 partidas
node tools/audit/guardado-test.mjs                                    # V01/V03/V08
node --test tests/campaign-route.test.js tests/operations.test.js tests/prologo.test.js   # 4+5+2 OK
```

## 1. Resumen ejecutivo

| Pregunta | Resultado |
|---|---|
| ¿Terminan siempre? | **[M]** Sí en las 54 partidas con bot (0 timeouts a 25 min). **[M]** No en el caso AFK: 2 de 3 semillas de m2 con jugador inactivo quedaron congeladas 25 min en «elegir mejora» (ver P2). |
| ¿Duración 8–12 min (AC-10)? | **[M]** No. Las medianas de victoria van de 0,70 a 2,44 min por capítulo con bots competentes. Solo el estilo habilidades contra los jefes de m1 y m2 pasa de 8 min. |
| ¿Ya existe la cinemática de transferencia de 20–30 s? | **[M/I]** No. El prólogo del tren fue retirado y quedó un texto de subtítulos de ~18,5 s sin reemplazo cinematográfico (ver §6). |
| ¿Tutorial de ~3 min jugable? | **[I]** No existe. Hay una tarjeta modal de controles más avisos de habilidades desbloqueadas (§6). |
| Recompensa parcial al perder | **[M]** Sí: XP parcial y todos los núcleos. No se otorga progreso de campaña ni territorio. |
| `cerrarPartida` idempotente | **[M]** No (V03 sigue vigente). V01 sigue vigente. V08 está corregido. |

## 2. (a) Etapas y terminación

Etapas por misión (`g.waveTotal`, **[M]**): m1=4, m3=3, m4=3, m5=3, m6=3, m2=4, o sea 20 en total. Las etapas 1–3 son los pasos de `OPERATIONS[id].steps`. m1 y m2 agregan una 4.ª etapa que es el jefe (`CAMPAIGN_BOSSES`: Coloso Prismático y Madre Geoda). Los demás capítulos terminan al cumplir el tercer objetivo, sin jefe.

Los planes de `WAVE_PLANS` tienen 6 entradas, pero la campaña usa solo 3–4. En modo libre (no campaña) `waveTotal` = 7. **[I]**

| Cap. | Orden | Arena | Etapas | Objetivos medidos | Jefe | Partidas que terminan |
|---|---|---|---|---|---|---|
| 1 | m1 | Islas | 4 | Reconexión, Ancla, Núcleo | Coloso | 9/9 |
| 2 | m3 | Laberinto | 3 | Reconexión, Caza, Ancla | no | 9/9 |
| 3 | m4 | Jardín | 3 | Cultivo, Ancla, Núcleo | no | 9/9 |
| 4 | m5 | Plaza | 3 | Reconexión, Núcleo, Ancla | no | 9/9 |
| 5 | m6 | Osario | 3 | Reconexión, Caza, Núcleo | no | 9/9 |
| 6 | m2 | Cámara Fractal | 4 | Caza, Reconexión, Núcleo | Madre Geoda | 9/9 |

Mecanismos que acotan la partida:

- Cada objetivo tiene límite de tiempo (`OBJECTIVE_INFO.limit`: Reconexión 150 s, Caza 110 s, Ancla 110 s, Núcleo 150 s, Cultivo 260 s). Si se agota, en operación = derrota (`objectives.js:finish`). **[I]**
- No hay camino a oleadas infinitas **[I]**: `startWave` avanza `wave+1` y cierra en `wave >= waveTotal` con `state='won'`. `surge()` solo se llama fuera de operaciones.
- Esperas sin límite, en `updateWaves` y `startWave` **[M]**:
  1. **Etapa de jefe:** no tiene objetivo ni límite de tiempo.
  2. **Intermedio en solitario:** espera la elección de mejora (ver P2).
- Estancamiento máximo medido sin progreso visible (`maxStall`):

| Cap. | m1 | m3 | m4 | m5 | m6 | m2 |
|---|---|---|---|---|---|---|
| maxStall (s) | 143 | 8 | 218 | 4 | 4 | 61 |

  m1 y m2 son el estilo habilidades contra el jefe adaptativo. m4 es la espera en Cultivo o Ancla perdida.

## 3. (b) Duración en minutos de reloj de sim (objetivo GDD: 8–12)

Todas las partidas (n=9 por capítulo):

| Cap. | Mediana | Mín | Máx | Mediana solo victorias |
|---|---|---|---|---|
| m1 Islas | 2,39 | 1,94 | 15,17 | 2,39 (9/9) |
| m3 Laberinto | 1,82 | 1,63 | 2,99 | 1,82 |
| m4 Jardín | 3,28 | 2,39 | 4,40 | 2,44 (5/9) |
| m5 Plaza | 1,41 | 1,24 | 1,67 | 1,41 |
| m6 Osario | 0,70 | 0,59 | 0,76 | 0,70 |
| m2 Fractal | 2,35 | 1,21 | 14,12 | 6,73 (6/9) |

**[M]** Con bots competentes (disparo y melé) todos los capítulos duran 0,6–3,3 min, entre 3 y 15 veces menos que el objetivo. Fuera de rango alto: habilidades contra Coloso (8,3–15,2 min en total, jefe 413–812 s) y contra Madre Geoda (10,9–14,1 min). Eso se debe a que el jefe adaptativo («antihab») resiste el spam de habilidades.

**[I]** Un humano será más lento que el bot (puntería, lectura, 12 s de intermedio, elección de mejora, 18,5 s de prólogo en m1 y 11 s de briefing en los otros). Estimo ×2 a ×3 como cota, lo que sigue dejando m1–m6 en ~1,5–8 min. **[NV]** No hay datos humanos.

Desglose por etapa (segundos de sim, mediana de victorias; «desc» = descanso entre etapas; el descanso es 4 s cuando ya se eligió mejora, 12 s si no):

| Cap. | Inicio→1.ª etapa | Etapa 1 | Etapa 2 | Etapa 3 | Etapa 4 (jefe) |
|---|---|---|---|---|---|
| m1 | 4 | 13 (+4) | 46 (+4) | 7,7 (+4) | 59 |
| m3 | 4 | 43,9 (+4) | 8,0 (+4) | 44,2 | — |
| m4 | 4 | 60 (+4) | 47,5 (+4) | 27,1 | — |
| m5 | 4 | 22,1 (+4) | 11,8 (+4) | 37,9 | — |
| m6 | 4 | 15,9 (+4) | 4,6 (+4) | 8,9 | — |
| m2 | 4 | 3,9 (+4) | 24,7 (+4) | 29,5 (+4) | 331 |

(En m1 y m2 la mediana de la etapa 4 mezcla estilos; por estilo, el jefe de m1 tarda ~44–59 s con disparo, ~51–88 s con melé y 413–812 s con habilidades.) La mayoría de las etapas duran menos de un minuto: m6 etapas 2 y 3 son de 4,6 y 8,9 s.

## 4. (c) Tasa de victoria por estilo (3 semillas)

| Estilo | m1 | m3 | m4 | m5 | m6 | m2 | Total |
|---|---|---|---|---|---|---|---|
| Disparo | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 18/18 |
| Melé | 3/3 | 3/3 | **0/3** | 3/3 | 3/3 | **0/3** | 12/18 |
| Habilidades | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | 17/18 |

- **m4 melé 0/3 [M], causa [NV]:** perdió en la etapa 1 por «se agotó el tiempo del objetivo» (Cultivo, 260 s). El bot melé quedó a 1–4 m de los capullos pero la nutrición nunca subió.
  - En el código el golpe cuerpo a cuerpo sí llama a `damageObject → feedCapullo` (`huespedes.js:162`), con cuota de 1/900 por punto de daño y tope 50. Falta un test específico para saber si es un límite del bot (cono, altura) o si en melé el capullo es inalcanzable.
  - Si fuera del juego, un jugador melé quedaría bloqueado en el capítulo 3 sin cambiar a disparo. **[NV]**
- **m4 habilidades 2/3 [M]:** perdió por tiempo del Ancla (110 s) en la semilla 3.
- **m2 melé 0/3 [M]:** derrota contra Madre Geoda (2 en el jefe, 1 en la etapa 3). Con la lógica oficial de melé de `jefe-bots.js`. Causa [NV].
- Por esto el equilibrio entre estilos de **campaña** no está demostrado: el mismo `tests/estilos.test.js` mide solo una oleada suelta.

## 5. (d) Recompensas y XP al terminar

Con el flujo real (**[M]**, `perfil.js` + lectura de `main.js:endGame`):

| Qué | Victoria | Derrota |
|---|---|---|
| XP de maestría (`xpPartida` = 15 + 1,5·bajas + 8·etapa + 60 si gana) | sí, incluye +60 | sí, parcial (sin los +60) |
| Núcleos (`jugador.co`) | todos | todos los obtenidos |
| Botín de la bolsa (`cerrarBotin`) | sí | sí (no mira `won`) |
| Puntos de árbol y evolución | sí | sí |
| `completarCapitulo` (siguiente capítulo) | sí | no |
| Territorio liberado | sí (solo `session.mode==='solo'`) | no |

Valores medidos:

| Cap. | Victoria: XP / núcleos | Derrota: XP / núcleos |
|---|---|---|
| m1 | 137–237 / 251–381 | — |
| m3 | 127–151 / 177–270 | — |
| m4 | 126–157 / 192–251 | 36–56 / 25–84 |
| m5 | 120–154 / 165–245 | — |
| m6 | 103–114 / 112–183 | — |
| m2 | 161–219 / 400–558 | 46–68 / 106–165 |

- **Parcial al perder [M]:** una derrota en m4 da 36–56 XP y 25–84 núcleos; en m2, 46–68 XP y 106–165 núcleos. Cumple el GDD sec. 4 en lo básico («parte de XP/biomasa»). **[I]** No existen «recursos por hitos» explícitos: los núcleos de objetivo (+30 por objetivo, `objectives.js`) y de etapa (`CORES.wave`) se pagan a medida que ocurren, y se conservan al perder.
- **[I]** El botín y los objetos tampoco distinguen principal contra parcial. El GDD pide que las «recompensas principales y desbloqueos» requieran victoria; hoy solo lo cumplen el avance de campaña y el territorio. XP +60 es la única diferencia dentro de `cerrarPartida`.
- **[M]** El perfil de cada partida de la medición era nuevo, así que `completarCapitulo` solo registró m1; el resto se rechaza por orden (lo valida `tests/campaign-route.test.js`).
- Pantalla final: texto del estilo «Etapa X/Y, Tiempo, bajas, Maestría +XP, Botín». El detalle expandible y los botones Reintentar/Menú del GDD no se evaluaron. **[NV]**

## 6. (e) Guardado al terminar

`node tools/audit/guardado-test.mjs` **[M]**:

| Prueba | Resultado en este SHA | Veredicto |
|---|---|---|
| V03: cerrar 3 veces la misma partida (300 núcleos, 40 bajas, ola 3, ganada) | 1 llamada = 300 núcleos / 159 XP / 1 partida; 3 llamadas = **900 / 477 / 3**, y lo persistido quedó en 900 | **Vigente.** No es idempotente: no hay `matchId` ni recibo. |
| V01: `localStorage.setItem` lanza `QuotaExceededError` | no lanza ni devuelve nada que avise (`guardar()` devuelve `undefined`); en memoria 300, en disco «nada guardado» | **Vigente.** Falla en silencio. |
| V08: cores guardado como `"100"` + premio 5 | 105 | **Corregido.** |

- **[I]** La protección actual es `session.banked`, solo en memoria (`main.js:810`). Evita el doble cobro dentro de una sesión (Salir tras Fin de partida). No cubre coop con reconexión (V02/V03), ni el cierre y reapertura.
- `completarCapitulo` va después de `bankProfile`; es idempotente por construcción (`completeChapter` solo agrega el siguiente). **[M]** (`campaign-route.test.js`).

## 7. Tutorial y primeros minutos del capítulo 1

Todo **[I]** (lectura de código), salvo que se indique.

- **Arranque:** `startSolo('m1', {campaign:'m1'})` → `beginIntro('full')` → `startWake(Story.WAKE)`.
  - El sim no avanza durante la intro (`main.js:475`).
  - 4 líneas de Heraldo con 4, 4, 4 y 4,5 s más 0,5 s de margen cada una: **~18,5 s** (16,5 s de duración nominal). El visual es solo un giro/fundido de cámara de 4 s (`renderer.startWake(4)`) y el latido.
  - Se puede saltar con Enter, Esc o toque.
  - En los capítulos 2–6 la intro es corta: `wakeForMap` = contexto + tarea, 5+5 s más margen = **~11 s**.
  - `WAKE_SHORT` está exportado pero no se usa en ningún flujo (solo `tests/prologo.test.js`). **[M]** `grep`.
- **Cinemática de transferencia 20–30 s del GDD: no existe.**
  - `src/client/prologo.js` es un stub de 7 líneas («Prólogo retirado») que invoca `onDone` de inmediato.
  - El commit `22483b5` (23-oct) quitó el prólogo del tren y sus ~300 líneas, y `tests/prologo.test.js` ahora prohíbe `startPrologue`, `Story.INTRO_TRAIN` y `Story.trainCine` en `main.js`.
  - Se eliminó el tren, pero la cinemática de transferencia que lo reemplazaría no se hizo: queda solo texto sobre pantalla (~18,5 s), sin escena. Eso es un hueco respecto del GDD sec. 2.1.
  - Los recursos (estación, modelos humanos) quedan «como archivo».
- **Qué enseña el tutorial hoy:**
  1. Tarjeta modal `showTutorial` al terminar la intro (en campaña siempre, `force=true`).
     - Muestra el briefing del capítulo, una tabla corta de controles (WASD/ratón, Tab, F/Q/T, pausa; versión táctil aparte) y la lista de habilidades con «se desbloquea tras la oleada 1/3».
     - Pausa el juego en solitario hasta tocar «Entendido». **[NV]** duración, depende del jugador.
  2. Banner de la misión durante 6 s.
  3. Avisos modales de «APOYO / ULTI DESBLOQUEADA» (`explainSkill`) tras la oleada 1 y la 3.
  4. El resto del aprendizaje es el propio primer capítulo: Reconexión → Ancla → Núcleo → Coloso. Con bot son ~2 min.
- **No hay tutorial jugable de ~3 min** con pasos guiados: no hay etapas de enseñanza ni objetivos de aprendizaje aislados. La docs `VORTEX_MISSION_CONTROLS.md` y `VORTEX_GAMEPLAY_SIMPLIFICATION.md` dicen que los controles cambiaron a cuatro botones por modo y piden «en el primer minuto dispara, cambia a melé y completa una acción sin explicación externa» como criterio **futuro**; no está implementado ni verificado (documentado «Propuestas… NO están implementadas»). El gate de navegador/iPhone sigue pendiente.
- **Medido [M] del primer minuto con bot:** la primera oleada empieza a los 4 s, la Reconexión (etapa 1 de m1) termina a los ~17 s, y el primer descanso es de 4 s. Humanos: **[NV]**.

## 8. Hallazgos

### P1
- **P1-1. AC-10 no se cumple: capítulos de ~1–3 min, no de 8–12.** **[M]** Las medianas de victoria con bots competentes son 0,70 / 1,41 / 1,82 / 2,39 / 2,44 / 6,73 min. m6 se resuelve en ~40 s: etapas de 4,6 y 8,9 s. Aun con ×3 para humanos (**[I]**) se queda corto. Requiere rediseño de pacing o contar oleadas/objetivos (el GDD dice que los números son configurables y se validan empíricamente). Hay que repetir la medición con humanos. **[NV]**
- **P1-2. Falta la cinemática de transferencia (GDD 2.1).** **[M]** El tren se retiró sin reemplazo: la intro son subtítulos de ~18,5 s sobre un fundido de 4 s. Tampoco hay tutorial jugable de ~3 min **[I]**.
- **P1-3. Cierre de partida no idempotente (V03 vigente).** **[M]** La misma partida acreditada 3 veces triplica núcleos, XP y partidas (300→900). La protección es solo `session.banked` en memoria.
- **P1-4. Guardado falla sin avisar (V01 vigente).** **[M]** Con almacenamiento que lanza error, `cerrarPartida`/`guardar` no informan y el resumen de fin de partida seguiría mostrando premios que no se guardaron. En tal caso `completarCapitulo` tampoco persiste.

### P2
- **P2-1. Estilo melé: 0/3 en m4 (Cultivo) y 0/3 en m2 (Madre Geoda).** **[M]** Causa **[NV]**: puede ser el bot o el diseño. Hace falta un test concreto del golpe cuerpo a cuerpo sobre capullos, y confirmar que se pueden ganar los jefes en melé. Un bloqueo real afectaría AC-03 (flujo completo) para quien juegue melé.
- **P2-2. Etapa de jefe sin límite de tiempo ni enrage.** **[M]** El jefe adaptativo hace que el estilo habilidades tarde 7–13,5 min solo en el jefe (413–812 s en m1), con picos de 143 s sin progreso. **[I]** Un jugador pasivo o a distancia puede alargarla sin perder: no hay objetivo, y la vida no baja. No es una «oleada infinita», pero no hay tope. Conviene un límite de etapa con reintento o un enrage.
- **P2-3. Jugador AFK o indeciso en solitario: la partida no concluye.** **[M]** En el intermedio, si hay mejoras para elegir y la partida es de 1 jugador, el reloj del intermedio queda congelado a 3,5 s hasta que se elija (`game.js:195`). Con un jugador AFK en m2 (semillas 2 y 3) la partida quedó 1480 s en la etapa 1. No hay timeout ni auto-elección en solitario. Es intencional («la partida espera tu elección») pero rompe AC-02 en su lectura literal; en coop no ocurre (`players.length>1`).
- **P2-4. Recompensas «principales solo por victoria» (GDD sec. 4) se cumplen a medias.** **[I]** El botín, los núcleos y los puntos de árbol se pagan íntegros al perder. Solo el avance de campaña, el territorio y los +60 XP dependen de ganar. Falta decidir qué es «principal» y qué es «parcial».

### P3
- **P3-1. `WAKE_SHORT` es código muerto** y los capítulos 2–6 usan `wakeForMap` (11 s). **[M]**
- **P3-2. El plan de oleadas queda sin usar:** `WAVE_PLANS` tiene 6 entradas y la campaña llega a 3–4. **[I]**
- **P3-3. Los bots de `tools/` no mandan `support`** y quedan silenciados por `gateSkills` cuando `skillLevel` está activo; además `hab` siempre se descarta con `skillLevel`. Para pruebas de campaña conviene arreglarlo en `tools/jefe-bots.js` (no se tocó). **[M]**
- **P3-4. `tests/bots.test.js` solo cubre m1–m3 con el modo libre** (`playMatch`, sin `campaign:true`). La campaña real no tenía una prueba de partida completa. **[I]**
- **P3-5. En el caza, un jugador AFK la completa solo** (m2, semillas 2–3: «caza done» a los 19 y 32 s con 5–7 bajas) — **[M]**; posible por espinas del axioma. Conviene confirmar que no sea un blanco que se muere por sí solo. **[NV]**

## 9. Qué falta medir

- Duración con jugadores humanos (el dato que el GDD pide como «duración medida en pruebas»).
- Un test de melé sobre capullos y de melé contra jefes.
- Flujo menú → siguiente capítulo con el cliente real (navegador/WebGL no disponible aquí). Esto cubre AC-03 de forma parcial, solo la parte del sim.
- Coop (1–4 jugadores) en campaña: no se midió.
