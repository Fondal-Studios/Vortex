# Manos de primera persona — origen y licencias

- `fp_arm_source.json`: copia sin cambios de `assets/characters/fp_arm.json` del repositorio hermano Duelo Arcano
  (Fondal Studios). Es un antebrazo y una mano derivados de la malla base de **MakeHuman** (licencia **CC0**; exportación de
  github.com/makehuman-js/makehuman-data), subdivididos y re-esqueletados con huesos de dedos por `tools/characters-build-arms.mjs`
  de ese repositorio. Se usa solo como fuente de la malla; no se usa su textura de piel (`fp_skin.jpg`): la piel y los guantes
  de este juego son shaders procedurales propios (`src/client/weapons/handmat.js`).
- `hand_lo.json`, `hand_hi.json` y `src/client/weapons/hand-data.js`: derivados propios de la malla anterior
  (recortada a la mano + 11 cm de antebrazo, pasada a un marco local de la mano y simplificada por colapso de aristas con
  `tools/hand-build.mjs`). Misma licencia (CC0).
- Nada de Ready Player Me.
