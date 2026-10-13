# Evolución orgánica y arsenal (contrato)

**Catálogo**: 25 armas a distancia (`WEAPONS`), 15 armas cuerpo a cuerpo + 5 innatas (`MELEE_WEAPONS`, `NATIVE_MELEE`).
**Tres capas de evolución** (todo en `src/sim`, probado en `tests/huespedes.test.js`):
1. **Núcleos** (matar, oleadas, objetivos, jefes) → nivel del campeón 0–4 (`EVO_COST`, `EVO_TIERS`) y fusión del arma melee.
2. **Tarjetas por oleada** (`loadout.js`) → mejoras de arma y mutaciones de 2 niveles con ramas excluyentes (`WEAPON_MODS`, `WEAPON_MUTS`).
3. **Esencias → órganos** (`organos.js`, datos en `data.js`): cada criatura da una esencia (`ESSENCE_OF`: carne, cristal, ojo, vacío; elites ×3, jefes ×12). Con ellas crecen **órganos**: `WEAPON_ORGANS` (3 por arma, un órgano por grupo → hay que elegir) y `CHAMP_ORGANS` (lugares = 1 + nivel de evolución).

## Entradas y snapshot
- Input `organ: { t: 'w'|'c', w: <id de arma>, id: '<órgano>' }` (se mantiene hasta soltar; la sim cobra una sola vez). Se puede comprar en cualquier momento (menú de pausa / respiro entre oleadas).
- Snapshot por jugador: `ess:[carne,cristal,ojo,vacio]`, `wg:[[órganos del arma en cada ranura]]` (alineado con `sl`), `cg:[órganos del campeón]`, `cs`: lugares del campeón, `ug`: mejoras por tarjetas (OJO: `up` es el vector arriba), `co`/`evo`/`evn`/`mw` (núcleos, nivel, costo siguiente, arma melee).
- Evento `{t:'organ', pid, target, w, id}` al crecer un órgano; `{t:'evolve', ...}` al subir de nivel.
- Perfil persistente (`src/client/perfil.js`): `paraPartida(char)` → `{melee, evo, worg, corg, ess}` que se pasa a `addPlayer(..., opts)`; `cerrarPartida(char, jugadorDelSnapshot)` devuelve esencias sobrantes y deja crecidos los órganos.

## Lo visual (`vis` de cada órgano)
Cada órgano trae una etiqueta `vis` (hueso, corazon, ojo, cristal, nervio, vacio, acido, espora, vital, musculo / placas, adrenal, medula, tentaculo, espiraculo): el arma y el cuerpo del campeón deben **mostrarlo creciendo** (viewmodel, cuerpo en 3ª persona, pantalla de selección).
