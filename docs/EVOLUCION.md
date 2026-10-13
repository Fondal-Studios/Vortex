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
