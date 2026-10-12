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
