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
