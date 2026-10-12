# ART GATE — manos y brazos de 1ª persona

Capturas definitivas (`shots/gate/manos/`, se regeneran con `bash tools/manos-gate.sh`): `fp_<low|high>_<844|1280>.jpg` (10 armas, reposo), `fire_*` (disparando), `estilos_*` (4 tatuajes + 3 guantes), `presets_*` (6 personajes), `agarres_*` (mano derecha en 8 armas), `dedo_gatillo.jpg`. Costos: `costos.json` (`node tools/manos-cost.mjs`).

## Qué es
Malla orgánica MakeHuman CC0 (de Duelo Arcano, `assets/hands/CREDITS.md`) esqueletada, dedos que se cierran sobre la forma real de cada arma (hands.js/hand-rig.js), índice que se flexiona con el gatillo. Guante táctico/cristal/desnudo: placas de armadura, correas, costuras y tendones PINTADOS en el shader (handmat.js, sin geometría extra), gemas en nudillos y dorso, uñas, muñequera con pantalla HUD (ojo cósmico), brazalete y manga corta con venas de cristal. Tatuajes procedurales (runas, ojos, constelación, venas) que pulsan, fluyen hacia los dedos y suben con el disparo (`uFire`) y las mejoras (`uUpg`). Seis presets con el color canon de cada héroe.
Cambios de esta ronda: agarre de apoyo INFERIOR por defecto (`?over=1` = por encima, sólo prueba), antebrazo afinado (-32 %), manga que sale del cuadro y se deshace en polvo de cristal sin borde duro, disolución cercana a la cámara.

## Costos (gl.info, 25 armas, mano+brazos = con menos sin manos)
Baja: 2-3 draw calls, 1.4k-3.0k tris extra (límite 6 / 4k). Alta: 2-3 calls, 4.3k-7.9k tris. Sin PointLights, sin errores de consola.

## Notas (autoevaluación, NO de un crítico independiente)
| Criterio | Nota | Por qué |
|---|---|---|
| Silueta y legibilidad | 7 | mano derecha y dedos se leen en primer plano; en 1ª persona la mano de apoyo queda tapada en gran parte por el arma |
| Modelado y detalle | 7 | dedos reales con falanges, placas, nudillos; las gemas pueden verse como esquirlas |
| Materiales y luz | 7 | guante mate + cristal + emisivos con intención; piel desnuda algo cerosa |
| Coherencia | 7 | colores canon, mismo lenguaje cristal+biología |
| Animación y feedback | 6 | respiración/bob/retroceso vienen del arma; índice, venas, pantalla y tatuajes reaccionan al disparo, pero el dedo no se ve en 1ª persona |
| Costo | 9 | muy dentro del presupuesto |
Mínimo: 6. No llego a 8; no lo declaro.

## Defectos abiertos
- En 1ª persona los dedos de la mano de apoyo casi no se ven (agarre inferior, brazo sale por abajo); la derecha queda detrás de la empuñadura.
- Muñeca con codo marcado en algunas armas largas.
- Constelación sobre guante de cristal poco legible; reacción de los otros dedos al disparo no existe (sólo el índice).
- Verificado con la composición anterior de Armería en parte; las capturas finales usan la nueva.

## Cambios requeridos en archivos ajenos
- Pistolas/armas de una mano: subir `view.pos` en y ~+0.05 (y yaw ≤ 0.1) para que se vea la mano derecha y la muñequera.
