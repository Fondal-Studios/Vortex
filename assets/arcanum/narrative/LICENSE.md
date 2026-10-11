# MakeHuman core assets — CC0

The binary meshes and textures in this directory are derived from **MakeHuman core/system assets**. Current upstream asset licence: Creative Commons CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/ . No MakeHuman or MPFB application code is included.

Verified 2026-10-03 against the upstream sources:

- https://static.makehumancommunity.org/about/license.html — core assets are CC0; application code has a separate licence.
- https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html — explicitly lists bob02, short01, high-poly eyes, male_casualsuit01, female_elegantsuit01, male_worksuit01, shoes02, old_caucasian_male and young_caucasian_female as CC0.
- https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj — current core base. All 19,158 source vertex positions match the archived JSON base exactly (maximum absolute error 0).

Source geometry was obtained from the archived JSON exports at https://github.com/makehuman-js/makehuman-data/tree/master/public/data . Original per-file author and historical licence metadata, plus SHA-256 fingerprints, are retained in `provenance.json`. Some old exported metadata says AGPL; the current upstream core asset licence above governs these core resources. This conclusion is specific to the listed core resources and does not extend to third-party MakeHuman downloads.

Conversion: `tools/characters-build-npcs.py` fits the original proxy resources to the base via barycentric coordinates, rebuilds anatomical bone anchors, normalizes skin weights, and packs GPU attribute arrays. The runtime adapts body proportions and costumes for six authored identities. Existing Quaternius CC0 animations use the game's shared retargeter.

Authors are credited voluntarily in provenance; no paid assets, accounts or external AI service are required by the runtime. The existing Ready Player Me avatar remains separate and retains its previously documented licence review status.

Las máscaras de ocultación de piel proceden de delete_verts de los MHCLO oficiales del paquete makehuman_system_assets_cc0.zip. Sus cabeceras conceden CC0; clothing-masks.json registra entradas y SHA-256. body-masks.bin se deriva de ellas.

## Ampliación NPC Factory (3 de octubre de 2026)

Agregados con el mismo pipeline (URL fijada en la revisión `e5d1a42…` de makehuman-js/makehuman-data y SHA-256 en `sources.json`):
cabellos `long01`, `ponytail01`, `short02`, `short04`; cejas `eyebrow001`, `eyebrow010`; pieles `young_caucasian_male`,
`middleage_caucasian_male`, `middleage_caucasian_female`, `old_caucasian_female`, `young_african_male`.
Son recursos del paquete de sistema de MakeHuman 1.1 (core/system assets), publicado bajo CC0 según la licencia vigente citada arriba.
La página de listado `static.makehumancommunity.org` no fue accesible desde el entorno de esta ampliación, por lo que la
verificación pieza por pieza contra ese listado queda **pendiente de revisión humana** antes de una distribución comercial.
Modificaciones: conversión a binarios GPU, reajuste a la malla base y recoloreado en runtime; las imágenes no se alteran.
