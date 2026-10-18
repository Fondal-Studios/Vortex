# Evolución orgánica y arsenal (contrato)

**Catálogo**: 25 armas a distancia (`WEAPONS`), 15 armas cuerpo a cuerpo + 5 innatas (`MELEE_WEAPONS`, `NATIVE_MELEE`).
**Tres capas de evolución** (todo en `src/sim`, probado en `tests/huespedes.test.js`):
1. **Núcleos** (matar, oleadas, objetivos, jefes) → nivel del campeón 0–4 (`EVO_COST`, `EVO_TIERS`). **Cada nivel es una bifurcación EXCLUYENTE** (`EVO_PATHS`: Depredador/Coraza, Velocidad/Resonancia, Simbiosis/Artillería, Apoteosis/Anomalía): elegir uno cierra el otro para siempre en ese Huésped. Input `evo: 1|2` (camino 1 o 2). Snapshot `pth` = caminos elegidos. Nivel 1 también fusiona el arma melee.
2. **Tarjetas por oleada** (`loadout.js`) → mejoras de arma y mutaciones de 2 niveles con ramas excluyentes (`WEAPON_MODS`, `WEAPON_MUTS`).
3. **Esencias → órganos** — también aparecen como **tarjeta** entre las 3 del respiro (elegirla hace crecer el órgano y descarta las otras dos: selección excluyente; `k:'organ'`, `t:'w'|'c'`) (`organos.js`, datos en `data.js`): cada criatura da una esencia (`ESSENCE_OF`: carne, cristal, ojo, vacío; elites ×3, jefes ×12). Con ellas crecen **órganos**: `WEAPON_ORGANS` (3 por arma, un órgano por grupo → hay que elegir) y `CHAMP_ORGANS` (lugares = 1 + nivel de evolución).

## Entradas y snapshot
- Input `organ: { t: 'w'|'c', w: <id de arma>, id: '<órgano>' }` (se mantiene hasta soltar; la sim cobra una sola vez). Se puede comprar en cualquier momento (menú de pausa / respiro entre oleadas).
- Snapshot por jugador: `ess:[carne,cristal,ojo,vacio]`, `wg:[[órganos del arma en cada ranura]]` (alineado con `sl`), `cg:[órganos del campeón]`, `cs`: lugares del campeón, `ug`: mejoras por tarjetas (OJO: `up` es el vector arriba), `co`/`evo`/`evn`/`mw` (núcleos, nivel, costo siguiente, arma melee).
- Evento `{t:'organ', pid, target, w, id}` al crecer un órgano; `{t:'evolve', ...}` al subir de nivel.
- Perfil persistente (`src/client/perfil.js`): `paraPartida(char)` → `{melee, evo, worg, corg, ess}` que se pasa a `addPlayer(..., opts)`; `cerrarPartida(char, jugadorDelSnapshot)` devuelve esencias sobrantes y deja crecidos los órganos.

## Lo visual (`vis` de cada órgano)
Cada órgano trae una etiqueta `vis` (hueso, corazon, ojo, cristal, nervio, vacio, acido, espora, vital, musculo / placas, adrenal, medula, tentaculo, espiraculo): el arma y el cuerpo del campeón deben **mostrarlo creciendo** (viewmodel, cuerpo en 3ª persona, pantalla de selección).

## Modo simple (jugabilidad para quien nunca jugó un shooter)
`settings.simple` (por defecto activado; botón en Pausa «Modo simple (dispara solo)»): ayuda de puntería al máximo, **dispara solo** cuando hay un enemigo bajo la mira y **golpea solo** (melee ligero) cuando lo tenés encima; la recarga ya es automática. El jugador sólo mueve y mira; progresa igual (núcleos, esencias, tarjetas) y toma las decisiones de evolución. Prueba: `tests/simple.test.js`.

## Progresión permanente de los dos tipos de jugador (árbol de combos y árbol de disparo)
Código: `src/sim/progresion.js` (datos y reglas puras, sin azar ni DOM) · efectos de Combo en `src/sim/combos.js` · efectos de Shooter en `game.js → firePlayer` (`shapeArbolGun`) y `loadout.js` (`clipOf`/`reloadTime`) · puntos y nodos guardados en `src/client/perfil.js` (`arb`) · pantalla en Huésped › **Progresión** (`huespedes-ui.js`). Pruebas: `node --test tests/progresion.test.js`.

**Dos tipos de jugador, dos progresiones que no se mezclan.** Quien prefiere el Shooter gana puntos de **disparo** y gasta en el árbol de disparo; quien prefiere el Combo gana puntos de **combo** y gasta en el árbol de combos. Cada Huésped tiene su propio avance en cada árbol. Los nodos de Combo no cambian nada en Shooter y los de disparo no cambian nada en Combo (`p.ac` sólo lo lee `combos.js`; `p.as` sólo lo leen el disparo y el cargador).

**Puntos.** Combo: 1 por cada 15 golpes que dieron + 1 por cada 2 remates + 1 por multi-kill + 1 por cada 4 bajas del mejor multi-kill + 1 por oleada (tope 250 por partida). Disparo: 1 por cada 5 bajas + 1 por multi-kill + 1 por cada 4 bajas del mejor multi-kill + 1 por oleada. Si en una partida se jugaron los dos modos, la oleada cuenta una sola vez (para el más jugado). Los puntos se suman al cerrar la partida (`cerrarPartida`) y el final de partida los muestra.

**Árbol: 3 ramas EXCLUYENTES de 3 nodos** (costo 25 / 60 / 110 puntos por nodo; una rama completa = 195). Se compran en orden 1→2→3 y la primera rama que se toca cierra las otras dos en ese árbol y Huésped. **Reiniciar** el árbol es opcional: devuelve todo lo gastado menos el 25 % (`RESET_COSTO`).

| Rama de Combo | Nodo 1 | Nodo 2 | Nodo 3 |
|---|---|---|---|
| **Dominio de Cadena** | ventana de encadenado ×1,6, buffer ×1,5 y cancelación al 60 % (antes 70 %) | **golpe nuevo** en la cadena (uno propio de cada Huésped) | cadena +1, **cancelación total** (cualquier ataque cancela al 70 % aunque no continúe un combo) y un **golpe final** propio |
| **Aniquilación en Área** | **golpes que atraviesan**: alcance +15 %, ángulo +25 %, hasta 14 enemigos por golpe (antes 4/8), ignoran la guardia del ariete; las flechas de Seraf atraviesan | **remate de área** propio (ver abajo) en el remate de toda cadena de 2+ golpes | **resonancia**: cada baja empuja a los vecinos y propaga 40 % del daño, en cadena (2 saltos, 14 golpes) |
| **Ejecución** | **marca de sentencia** (+15 % de daño recibido, 4 s) y ejecución con +5 % de vida | **remate cobrador**: +35 % de daño en el remate, cura 4 y acelera 1,2 s la habilidad por baja (máx. 5) | ejecución con +7 % más de vida y cada ejecución **cancela la recuperación** |

Remates de área por Huésped: Axioma **cono** (empuja fuerte) · Vesper **torbellino** · Micelio **sismo** (daña, ralentiza y suelta raíces) · Umbra **vacío** (arrastra a todos hacia un punto y los golpea) · Seraf **cadena de rayos** (salta entre 7) · Danzante **abanico** (arco ancho y suave) · Singular **vacío** · Colmena **torbellino**. Golpes nuevos (nodos de cadena) por Huésped: `EXTRA_C2` (`['a2','a1']`, Umbra/Danzante `['a2','a2']`) y `CAPITULO` (`['a2','a1','a2']`, Umbra/Danzante `['a2','a2','a1']`); reutilizan las mecánicas de los 8 golpes de `combos.js` y NO pisan ninguna secuencia del set base. Un Huésped nuevo que todavía no tenga tablas usa un respaldo (`extraDe`/`capituloDe`/`finDe`) y no se rompe.

| Rama de Disparo | Nodo 1 | Nodo 2 | Nodo 3 |
|---|---|---|---|
| **Precisión** | dispersión −35 %, daño +4 % | dispersión −50 %, daño +10 % (totales) | dispersión −75 %, daño +16 % (totales) |
| **Perforación y Rebote** | las balas atraviesan | el daño **rebota** a 2 enemigos cercanos (70 %) | rebota a 4 y +6 % de daño |
| **Cargadores** | cargador +25 % | cargador +45 % y recarga −20 % | cargador +75 % y recarga −35 % |

**Arrasar sin romper el balance.** Todo el daño extra de «arrasar» (enemigos de más por golpe, remate de área, resonancia) sale de un **presupuesto por golpe** (`ARRASE_PRESUPUESTO` = 6 veces el daño del golpe; `extra()` en `combos.js`), así que un golpe nunca reparte más que eso aparte de lo que ya daba el set. Contra un solo blanco ninguna rama pasa de ×1,5 del daño sostenido (media ≤ ×1,3, medido en `tests/progresion.test.js`).

**Multi-kill, rango de estilo y HUD.** `progStep` (llamado desde `updateHost`) cuenta las bajas en una ventana de 0,9 s: al cerrarse con 2+ emite `{t:'multi', pid, n}`. En Combo suma **puntos de estilo** (golpe +1, baja +3, remate +4, multi-kill) que caen si dejás de atacar; el **rango D → S** (umbrales 0/10/30/60/100) emite `{t:'rango', pid, r, i}` al subir. Hay además `{t:'arrasar', pid, k, n}` (remate de área o resonancia). Snapshot por jugador: `rk` (0..4), `rp` (0..1 hacia el siguiente rango), `mk` (bajas del multi-kill en curso) y `pk` (8 contadores para el perfil: golpes, remates, multis, bajas, multis shooter, bajas shooter, mejor multi combo, mejor multi shooter). HUD mínimo `#estilohud` (letra del rango con barra y «N BAJAS») junto al contador `#combohud`; aviso y sonido ligeros en `main.js` (`multi`, `rango`, `arrasar`).

**Cómo viaja y qué valida el servidor.** `opts.arbol = { combo: [ids], disparo: [ids] }` en `addPlayer` y `prof.arbol` en `setLoadout` (igual que `bend`/`maestria`/`equip`); el cliente lo manda en `create`/`join`/`loadout`. El servidor y la simulación pasan todo por `cleanArbol`: sólo ids reales de ESE Huésped, UNA rama por árbol (la del primer nodo válido), en orden y ≤ 3 por árbol, lista recortada a 6 entradas. El servidor **no sabe cuántos puntos ganó** el jugador (igual que con el equipo): acota, no verifica. Cambiar de Huésped sin mandar árbol deja los nodos del anterior fuera.

**No probado**: sensación de juego (los números salen de bots), pantalla táctil real, coop real con árbol, el aspecto visual de los remates (sólo se reusan `boom`/`arc`/`beam`) y el sonido.
