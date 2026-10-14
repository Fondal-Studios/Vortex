# Recursos externos (texturas y cielos)

> Nota (agente de mapas del limbo, 2026-10-14): este archivo se reescribió por error encima de una versión recién creada por otro
> agente; se reconstruyó con la lista real de `public/assets/ph/manifest.json`. Si faltan datos de esa versión (p. ej. el presupuesto
> medido de host-human.js), hay que volver a agregarlos.

Presupuesto total del juego: ≤ 40 MB.

## Poly Haven (CC0) — `public/assets/ph/` (descarga: `node tools/polyhaven-fetch.mjs`; lista y URLs en `public/assets/ph/manifest.json`, cargador `src/client/ph.js`)
Texturas 1K: `marble_01`, `marble_tiles`, `white_sandstone_bricks`, `medieval_wall_01`, `metal_plate`, `rough_linen`.
Cielos HDRI 1K: `small_cathedral_02` (m2, m4, m6, menú), `moonless_golf` (m3, m5), `qwantani_dusk_2_puresky` (m1).

## ARCANUM (texturas horneadas, CC0) — `public/assets/arcanum/` (≈ 1,1 MB)
Copiadas de `/duelo-arcano/assets/world/` (reducidas a 1024/512 px) para los mapas del limbo (5 y 6). Según `/duelo-arcano/assets/CREDITS.md`
son texturas horneadas proceduralmente por ARCANUM con detalle de «Rock020» de **ambientCG (CC0)**:
| archivo | origen en ARCANUM | uso |
|---|---|---|
| `cobble_*` | `praga_cobble_*` | empedrado de la Plaza de los Ecos |
| `stucco_*` | `praga_stucco_*` | estuco de las fachadas |
| `ashlar_*` | `praga_ashlar1k_*` | sillar: zócalos, cornisas, torre, tejas oscuras |
| `flag_*` | `flag_*` | losas del Osario sin Techo |
| `vault_*` | `vault_*` | muros de bóveda del osario |
Canales: `_col` color (sRGB), `_nrm` normal, `_arm` = oclusión (R) · rugosidad (G) · metal (B). Cargador: `arcTextures()` en `src/client/env/limbo-kit.js`.

## Poly Haven en detalle (agente de render/Huéspedes)
Licencia **CC0 1.0** (uso libre, también comercial, sin atribución obligatoria). Script reproducible: `node tools/polyhaven-fetch.mjs`
(usa `curl`, reintenta 4 veces, no vuelve a bajar lo que ya está; `--forzar` baja todo). Peso actual: **15,1 MB** (presupuesto propio ≤ 25 MB).

| id | tipo | uso | página |
|---|---|---|---|
| `marble_01` | textura 1K | mármol veteado: pisos, columnas, **porcelana** de máscaras y placas de los Huéspedes | https://polyhaven.com/a/marble_01 |
| `marble_tiles` | textura 1K | baldosas de mármol | https://polyhaven.com/a/marble_tiles |
| `white_sandstone_bricks` | textura 1K | sillares claros | https://polyhaven.com/a/white_sandstone_bricks |
| `medieval_wall_01` | textura 1K | piedra gastada | https://polyhaven.com/a/medieval_wall_01 |
| `metal_plate` | textura 1K | base del **oro** envejecido (filigrana, gorguera, aureola, corona) | https://polyhaven.com/a/metal_plate |
| `rough_linen` | textura 1K | lino: túnicas, velos | https://polyhaven.com/a/rough_linen |
| `small_cathedral_02` | HDRI 1K | luz/reflejos de templo (m2, m4, m6, selección de Huésped) | https://polyhaven.com/a/small_cathedral_02 |
| `moonless_golf` | HDRI 1K | noche fría (m3, m5) | https://polyhaven.com/a/moonless_golf |
| `qwantani_dusk_2_puresky` | HDRI 1K | atardecer (m1) | https://polyhaven.com/a/qwantani_dusk_2_puresky |

Texturas: `public/assets/ph/<id>/<id>_{diff,nor_gl,rough}_1k.jpg` (origen `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/<id>/…`).
HDRI: `public/assets/ph/<id>/<id>_1k.hdr` (origen `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/<id>_1k.hdr`).

Uso desde el código (`src/client/ph.js`): `phTextures(id, {repeat})`, `phMaterial(id, {...})`, `goldMaterial()`, `porcelainMaterial()`,
`loadEnvHDRI(renderer, id)` (PMREM para `scene.environment`); `MAP_HDRI` elige el cielo de cada mapa y `Renderer.useHDRI(mapId)` lo aplica
(Baja, Media y Alta). Si falta un archivo, el material queda con su color y el entorno vuelve a `RoomEnvironment`.

Huéspedes con cuerpo humano (`src/client/host-human.js`): usan `goldMaterial`/`porcelainMaterial` + las personas de `assets/arcanum/`
(MakeHuman CC0 + clips Quaternius CC0, ver `assets/arcanum/CREDITS.md`). Costo medido de la escena con el Huésped humano: Baja 65–101
llamadas / 40–46 k triángulos; Alta 109–194 llamadas (ver informe del agente).
