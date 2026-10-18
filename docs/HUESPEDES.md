# Los cinco Huéspedes y el combate híbrido (contrato entre piezas)

Datos: `src/sim/data.js` → `CHARACTERS[id]` con `host:true` (axioma, vesper, micelio, umbra, seraf) y `HOST_IDS`. Los 5 héroes anteriores (egida, lumen, forja, vigia, nova) quedan como `legacy:true` («Veteranos»). Umbra extiende al héroe anterior del mismo nombre.

## Entradas nuevas (`game.setInput`)
`melee` (mantener = pesado, soltar rápido = ligero), `s3` (habilidad 3), `ult` (definitiva). Las existentes: `mov` = habilidad 1, `esp` = habilidad 2.
Teclado propuesto: F hab.1 · G hab.2 · Z hab.3 · R definitiva · V melee (la 3ª persona pasa a P).

## Snapshot por jugador (campos nuevos)
`mc`,`ec`,`s3c`: segundos restantes de enfriamiento de hab.1/2/3 · `ul`: carga de la definitiva 0..100 · `ua`: segundos que le quedan a la definitiva activa (0 = inactiva) · `cmb`: combo melee (0..3) · `bf`: máscara de estados propios (1 caparazón, 2 camuflaje, 4 sobrecarga, 8 frenesí, 16 floración, 32 metamorfosis, 64 desfase, 128 planeo, 256 barrera) · `sy`: simbionte aliado {x,y,z} o null.

## Eventos nuevos (`snapshot.events`)
`{t:'skill', pid, k:'mov'|'esp'|'s3'|'ult', id, p:[x,y,z]}` (id = el de data.js) · `{t:'melee', pid, kind:'light'|'heavy'|'air'|'exec', p, d:[x,y,z], hit:n}` · `{t:'ultend', pid, id}` · `{t:'fall', pid, v, p}` al aterrizar tras caída fuerte.

## Reglas de trabajo en equipo
Un solo árbol de trabajo compartido. Cada pieza tiene sus archivos; las ediciones a archivos compartidos (main.js, ui.js, index.html, style.css, render.js) deben ser PEQUEÑAS y localizadas: releé el archivo justo antes de editar. No hagas commit, no uses git stash/checkout/reset: el director integra.

## Evolución, núcleos y armas fusionadas (parte visual y de interfaz)
Simulación (ya hecha, `src/sim/huespedes.js`): núcleos → 4 niveles (`EVO_COST` = 40/90/160/280) → fusión con un arma del catálogo (`MELEE_WEAPONS`, 15 armas de 5 tipos + 5 innatas). Snapshot por jugador: `co` (núcleos de la partida), `evo` (0–4), `evn` (costo del siguiente), `mw` (arma equipada). Eventos: `{t:'evolve', pid, tier, p}` y `{t:'melee', …, mw, sp}`. Input: `evo`.
- **Perfil** (`src/client/perfil.js`, `localStorage cristal.perfil.v1`): `cores` (banco), `evo[huésped]`, `melee[huésped]`, `owned[]`. Al empezar una partida solitaria `main.js` pasa `Perfil.paraPartida(char)` a `addPlayer`; al terminar (`endGame`) o salir (`#quit`) llama `Perfil.cerrarPartida(char, jugador)` (suma los núcleos sobrantes y guarda el nivel alcanzado), una sola vez por partida.
- **Pantalla «Evolución»** (menú principal, junto a «Huésped»): `src/client/evolucion-ui.js` + `public/evolucion.css`. Un solo canvas WebGL dibuja dos recuadros (Huésped y arma). Ganchos: `ui.ev.select(huésped)`, `ui.ev.selectTab(tipo)`, `ui.ev.selectWeapon(id)`.
- **HUD en partida** (`src/client/hud-evolucion.js`): contador de núcleos, nivel y barra; con `co ≥ evn` aparece «¡Podés evolucionar!» (tecla **N** —B quedó para marcar y T para la definitiva— o botón táctil/clic: `evoHud.held()` se suma a `input.evo`). El evento `evolve` dispara `evoHud.celebrate(tier)` (destello, onda y «EVOLUCIÓN: <nombre>»).

### Melee: modelos
`src/client/melee-models.js` → `buildMelee(THREE, id, {tier, quality, color, aura}) → {group, update(dt,t), setTier(n), dispose(), info}` para los 20 ids (`MELEE_MODEL_IDS`). Marco local: empuñe en el origen, hoja hacia +Y, tejido de fusión hacia −Y. Niveles: 0 arma sola · 1 manga de tejido y venas · 2 venas por la hoja y cristales · 3 aura (jaula) y fragmentos orbitando · 4 más grande, halo y corona. Presupuesto medido en Baja: ≤ 9 llamadas y ≈ 3 000 triángulos por arma (límite 14 / 6 000).
- **Huésped evolucionado en 3D**: `src/client/huespedes-evo.js` → `buildHostEvo(THREE, id, {evo, melee, quality}) → {group, update, pose, setEvo(n), setMelee(id), dispose, info}` (envuelve `buildHost`, que ahora acepta `opts.native=false` para quitar el arma innata y expone `joints` y `mats`). Cada nivel agrega mutaciones propias de cada Huésped (`EVO_VISUAL` las describe en español).
- **Primera persona (viewmodel)**: `attachToViewmodel(THREE, anchor, id, {tier, quality, color, size, offset, frame:'vm'|'host'}) → {group, update(dt,t), setTier, setWeapon(id), dispose}` cuelga el modelo de cualquier `Object3D` (en `vm` la hoja apunta a −Z). **Ya está integrado** en `hostfx-melee.js` (función `syncWeapon`): usa `me.mw` y `me.evo` del snapshot, cuelga el arma de la mano derecha (`limbs.R.g`, offset z −0.4, escala 0.5), oculta el arma innata mientras haya arma del catálogo (`l.catalog`) y reconstruye sólo cuando cambia el arma o el nivel. Si el agente de hostfx cambia la estructura de `limbs`, basta mantener esas 5 líneas: crear con `attachToViewmodel` cuando cambie `mw|evo`, llamar `wm.update(dt, T)` cada cuadro y ocultar `wpn`/`glow` innatos.
- Pruebas: `node --test tests/melee-ui.test.js` · capturas: `node tools/shot-evolucion.js [carpeta] [armas|hosts|ui|todo]`.

## REWORK de los Huéspedes (2026-10-14): almas y bestias en pena del limbo
Los Huéspedes ya no son soldados de bloques: son **guardianes entre los muertos y los vivos** (ver `docs/CONCEPTO_ARTE.md`, sección «REWORK DE LOS HUÉSPEDES»).
- **Cuerpos** (`src/client/huespedes-limbo.js`): Axioma = Guerrero Caído (hueso, carbón y brasas, capa en jirones, fragmentos de espada que giran) ·
  Vesper = Bestia Cazadora (lupina/felina traslúcida, ojos fosforescentes, vela dorsal de nervios, crin de luz, colmillos flotantes) ·
  Micelio = Coloso Raíz (corteza, raíces, hongos de repisa, cavidad que late, cornamenta) · Umbra = el Errante (sudario de obsidiana, capucha sin rostro,
  fragmentos de espejo en órbita y un espejo mayor) · Seraf = Ángel Caído (túnica de luz con filigrana, aureola quebrada, ala entera y ala quemada).
  Se arman con las piezas de `makeBuilder` (`huespedes-view.js`; nuevas: `tube`, `sheet`, `lump`, `lathe`) y **se funden en 3 mallas con esqueleto** (cuerpo,
  brillo, membrana): un Huésped cuesta **3 llamadas de dibujo** sin importar cuántas piezas o mutaciones tenga.
- **Materiales y partículas** (`src/client/huesped-mat.js`): grano procedural, borde de luz (fresnel), venas que laten con `uBeat`, membrana translúcida con jirones que
  fluyen; partículas propias de cada uno (brasas, fósforo, esporas, destellos de espejo, polvo de luz). Reflejos del cielo HDRI (`ph.js`).
- **Evolución por camino** (`huespedes-mut.js`): cada nivel agrega una mutación física según el camino elegido en `pth` (EVO_PATHS): depredador (garras) | coraza (placas) ·
  velocidad (tendones y estelas) | resonancia (núcleo con anillos) · simbiosis (brazo fundido + simbionte) | artillería (cañones de cristal) · apoteosis (alas de luz) |
  anomalía (grietas de vacío). Los órganos `cg` cuelgan de pecho y cabeza (`organs-vis.js`).
- **Aspecto regional** (`REGIONS` en `huespedes-mut.js`): según el mapa actual cambia el color del borde de luz, las partículas y suma un ornamento del folclore
  (m1 astros · m2 geoda · m3 runas · m4 flores-ojo · m5/m6 velos). En la selección el aspecto rota solo cada ~5 s con una etiqueta.
- **Pruebas / capturas**: `node tools/shot-sheet.mjs salida.jpg "q=low&evo=4&pth=coraza,resonancia,simbiosis,apoteosis&map=m2"` (hoja de los 5 en `public/huesped-sheet.html`,
  `variants=` para ver un solo Huésped con varios caminos), `node tools/shot-huesped3p.mjs` (en partida, 3ª persona). El cuerpo humano de ARCANUM
  (`host-human.js`) queda como prueba opcional con `?cuerpo=humano`.

## Evoluciones notorias, transformación y maestría (desarrollo progresivo)
**Silueta (se lee a 5–10 m).** `huesped-cuerpo.js` hace crecer el cuerpo +4,5 % por nivel (hasta +18 %) y cambia las proporciones según el camino (`PATH_SHAPE`: Coraza ancha, Velocidad esbelta, Depredador alto…). Postura: la Velocidad se inclina al correr, el Depredador va encorvado, Apoteosis/Anomalía levitan, y el cuerpo «respira» más con cada nivel. La luz de borde toma el color del último camino. `huesped-evo-piezas.js` agranda las piezas existentes (garras, guadañas, anillos de Resonancia, cañones, alas, esquirlas) y `huesped-evo-grande.js` suma piezas grandes: cuernos (Depredador), hombreras enormes (Coraza), aletas y estelas que ondean (Velocidad), tentáculos de espalda (Simbiosis), anillo de grieta (Anomalía). En Baja se recortó detalle fino (tendones, remates de luz, un anillo de Resonancia, plumas) para pagar el tamaño.
**Presencia** (`src/client/huesped-presencia.js`, casi todo shader, ≈ +3–4 llamadas): aura de partículas propia de cada camino (brasas, chispas orbitando, rayas, runas, esporas, plumas, esquirlas), sello en el suelo con un anillo por nivel y pilar de luz en la forma final.
**Transformación (≈ 1,2 s)**: al subir `evo` el cuerpo lo detecta solo (no hace falta el evento) —también `b.event({t:'evolve', path})`—: 0,25 s de carga (el cuerpo se esconde en una esfera de energía con chispas que convergen), destello, 2 ondas de choque, columna de luz, chispas, rebote elástico del cuerpo y resplandor que se apaga. El sonido ya lo da `main.js` (`evolve` → `sound.objective`).
**Maestría** (`src/sim/maestria.js`, pura y determinista; XP en `perfil.js` → `mae[huésped] = {xp, partidas, kills, oleada}`): rangos 1–10 (XP acumulada 0/100/250/450/700/1000/1400/1900/2500/3200). XP por partida = 15 + 1,5 por baja + 8 por oleada + 60 si se gana; `cerrarPartida(char, jugador, {wave, won})` la suma y devuelve `{ganada, subio, rangoDespues}` (el fin de partida lo muestra). El rango entra a la simulación por `opts.maestria` de `addPlayer` (y `prof.maestria` de `setLoadout`) y se suma a `p.bn` (mismas claves que las bendiciones; `applyMaestria` es idempotente). Bonos chicos (≤ 12 % en total) en los rangos 2/4/6/8/10, distintos por Huésped (`BONOS`). Cosméticos: 2 marca (un rombo de luz sobre la cabeza por rango; bronce/plata/oro/prisma), 3 estela al correr, 5 aura, 7 sello de oro con muescas en el suelo, 9 pilar de leyenda, 10 marca prisma y título «Arcano». El snapshot trae `mr` (rango) para que todos vean la marca. La pantalla «Huésped» (`huespedes-ui.js`) tiene el panel «Maestría»: rango, título, barra de XP, próxima recompensa, bonos activos, lista completa y estadísticas. Prueba: `node --test tests/maestria.test.js`; capturas: `huesped-arte.html?char=axioma&evo=4&pth=…&mr=10&cam=lejos`.

## Modo Combo (2026-10-18): el cuerpo a cuerpo manda
**Dos modos de juego** (`settings.mode` = `'shooter'` | `'combo'`, también por enlace `?modo=combo|shooter`; datos en `data.js` → `GAME_MODES`). **Shooter** es el de siempre y sigue disponible para los 5 Huéspedes y los Veteranos. **Combo** sólo lo juegan los 5 Huéspedes (un Veterano con Combo elegido juega Shooter). Se cambia en el menú principal («Modo de juego»), en la pantalla Huésped (botón «Modo»), en Opciones y en la Pausa (también en plena partida).
**Qué cambia en Combo**: la simulación ignora `fire`, `melee`, `mov`, `esp`, `s3` y `reload`; el jugador usa **A1** (ataque 1), **A2** (ataque 2) y **hab** (habilidad principal), más salto, usar, evolucionar y la definitiva (`ult`). El estilo interno `STYLES.combo` (oculto: no sale en `STYLE_IDS`) da melé ×1,6, habilidad ×1,5, daño recibido ×0,85.

### Combos (`src/sim/combos.js`, datos `COMBO_SETS` en `data.js`; determinista y sin tocar `g.rng`)
- Cada pulsación suma una entrada a la **cadena** (`['a1','a1','a2']`). Sale el golpe **más largo** del set del Huésped que coincide con el final de la cadena y está **desbloqueado**. Mantener A1/A2 repite. La cadena termina sola cuando ya no hay un golpe más largo que la continúe (remate: evento con `fin:true`) o cuando pasa `COMBO_RULES.window` (0,75 s) tras la recuperación.
- **Cancelación**: si la pulsación siguiente continúa un combo válido se acepta al 70 % de la recuperación (más rápido); si no, hay que esperar la recuperación entera. Saltar o usar la habilidad cancelan la recuperación. Las pulsaciones se guardan 0,28 s (buffer).
- **Evolución**: cada golpe tiene `evo` (nivel mínimo): 4 golpes básicos (3 de cadena + A2) y 4 más que se desbloquean con los niveles 1, 2, 3 y 4. Los caminos de `EVO_PATHS` siguen dando sus bonos (Depredador cura, Velocidad acorta recuperaciones, Simbiosis potencia el arma fusionada…); `path` en un golpe permite exigir un camino concreto.
- **Sets**: Axioma (armadura; 3.er golpe lanza una ONDA que atraviesa; hombro, martillazo, tormenta de acero, ruptura) · Vesper (garras en ráfaga con dash, salto de caza, embestida que marca, ráfaga infinita, ejecución) · Micelio (puños de área, raíces que enraízan, aplastamiento sísmico, muro de raíces, terremoto, floración) · Umbra (cortes dimensionales con **teletransporte corto** y cortes en línea, desgarro que arrastra, eco hacia atrás con desfase) · Seraf (**melé-rango**: flecha de luz A1, salva de 3; A2 **se carga** manteniendo y sale al soltar; rematadora, sanadora, lluvia de luz).
- **Arma fusionada** (`COMBO_WEAPON`, por `MELEE_WEAPONS[…].type`): espada = cadena de 3-4 y el remate pega +12 % · hacha = 2 golpes lentos y el 3.º es un **giro** · martillo = cadena de 2, cada golpe aplasta y manda una onda · lanza = A1 estocada larga y A2 barrido amplio · daga = cadenas de hasta 6 golpes rápidos. Los efectos especiales de la fusión (quema, sangrado…) también se aplican.
- **Auto-golpe (Modo simple)**: en Combo, `src/client/combo-assist.js` mantiene A1 solo si hay un enemigo cerca y de frente (Seraf: uno bajo la mira). La habilidad y A2 los decide el jugador.

### Habilidad principal (`HABILIDADES` en `data.js`; `useHab`/`resolveHab` en `combos.js`)
Un toque; tiene **preparación** (`wind`, telegrafía: evento `{t:'hab',ph:'cast',r,dur}` y después `ph:'go'`) y enfriamiento (baja 5 % por nivel de evolución y respeta `cdMul`). Reusa los efectos visuales/sonoros de las habilidades existentes (`skill` caparazon/impulso/biomasa/tiempo/pulso) y la burbuja `chrono`.
| Huésped | Habilidad | Rol | Efecto |
|---|---|---|---|
| Axioma | **Baluarte** (14 s) | escudo | 4,5 s absorbiendo 70 % y **reflejando todo**; onda que empuja y suma escudo (Coraza: más largo y más escudo). |
| Vesper | **Frenesí de caza** (15 s) | daño en área | Embestida que daña y marca; 6 s con +30 % velocidad, +20 % daño y golpes 25 % más rápidos. |
| Micelio | **Estallido de esporas** (16 s) | curación + control | Tras 0,45 s: daña y **enraíza**; cura y da escudo al equipo cercano. |
| Umbra | **Eclipse** (18 s) | control de zona | 6 s de zona de sombra: criaturas al 25 % de velocidad y daño continuo. |
| Seraf | **Bendición** (22 s) | curación + escudo | Cura el 40 %+ de vida, escudo completo y −20 % de daño 6 s al equipo; **reanima** a un caído cercano. |
La definitiva (`ult`) sigue igual (contextual en táctil). Las habilidades 1-3 del modo Shooter no se usan en Combo; su identidad vive en los golpes (p. ej. el dash de Vesper, el teletransporte de Umbra).

### Snapshot y eventos nuevos
Por jugador: `md` (1 = Combo) · `cn` (golpes de la cadena) · `cw` (s que queda de la ventana) · `cnm` (nombre del último golpe) · `hc`/`hx` (enfriamiento y total de la habilidad) · `hw` (preparación en curso) · `cc` (carga 0..1 de la flecha). Eventos: `{t:'combo',pid,n,id,name,hit,fin,p}` por golpe, `{t:'hab',pid,id,ph:'cast'|'go',p,r,dur}`; además se emiten los de siempre (`melee`, `skill`, `boom`, `beam`, `blink`) para que el cuerpo y el viewmodel animen sin cambios. HUD: contador ×N con nombre del golpe y barra de ventana (`#combohud`), fila HABILIDAD con anillo.

### Pruebas y equilibrio
`node --test tests/combos.test.js` (cadenas, ventana, cancelación, desbloqueos por nivel, armas, habilidades, snapshot, determinismo, auto-golpe) y equilibrio contra el estilo Melé: daño sostenido contra un muñeco a ±30 % por Huésped y tiempo total de limpiar la oleada de `tests/estilos.test.js` a ±30 %. Ajuste fino por Huésped en `COMBO_TUNE` (data.js). **No probado**: la jugabilidad en navegador, en pantalla táctil real ni con mando; el efecto visual propio de la preparación de la habilidad (hoy se reusan los efectos existentes y un banner).
