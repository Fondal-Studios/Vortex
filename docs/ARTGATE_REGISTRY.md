# Registro del ART GATE

Estado: `PENDIENTE` · `EN OBRA` · `EN PUERTA` (esperando crítico) · `PASA` (todos los criterios ≥ 7) · `REHACER` · `RECHAZADA`.
Cada fila: pieza · dueño · estado · nota mínima · fecha · defectos abiertos.

## Armas en primera persona (25)
| id | arma | estado | nota | defectos abiertos |
|---|---|---|---|---|
| 0 | Haz | PENDIENTE | — | "de juguete" (reportado por el autor anterior) |
| 1 | Prisma | PENDIENTE | — | |
| 2 | Ráfaga | PENDIENTE | — | |
| 3 | Nova | PENDIENTE | — | |
| 4 | Aguja | PENDIENTE | — | |
| 5-14 | Pulso, Gemelas, Solar, Fractal, Enjambre, Cometa, Vórtice, Lanza, Cetro Vital, Eclipse | PENDIENTE | — | sólo vistos de cerca sin manos |
| 15-24 | Voltaico, Glaciar, Plaga, Brasa, Sembradora, Sierra, Pulsar, Dardos, Réquiem, Quimera | PENDIENTE | — | |

## Manos y brazos (1ª persona) — EN PUERTA (auto-nota mín. 6, ver docs/gate/manos.md; falta crítico independiente)
## Héroes (avatar + habilidades + efectos): Égida · Lumen · Forja · Vigía · Nova · Umbra — PENDIENTE
## Criaturas (15) — EN PUERTA: bestiario del limbo (almas y espíritus folclóricos) — falta crítico independiente
Modelos nuevos en `src/client/creatures/` (kit `alma-kit.js` + un archivo por alma: anima, almamula, luzmala, llorona, salamanquera, pombero,
fuegofatuo, familiar, viuda, difunta, lobizon, silbon, mandinga, madre-animas, basilisco; registro en `index.js`, ids internos sin cambios).
Hojas de contacto (cadena real del juego: escena HDR → bloom → GradePass): `shots/gate/almas/` (`almas_baja.jpg`, `almas_alta.jpg`,
`almas_siluetas.jpg`, `almas_fila.jpg`) con `node tools/almas-sheet.mjs <salida.jpg> [low|high] [estados|silueta|fila]`.
Medición real (gl.info, criatura sola) Baja: 8–15 draw calls y 2.0k–8.6k tris por criatura; jefes 15–17 dc y 4.0k–7.0k tris.
Alta: mismas llamadas, 3.5k–14.7k tris (jefes ≤ 20.2k). Textura CC0 reutilizada: Poly Haven `rough_linen` (velos y telas).
## Mapas (3) y ojos cósmicos — PENDIENTE
## Efectos de disparo y daño — PENDIENTE

## Reutilización de recursos externos (origen + licencia)
- Manos: `assets/hands/fp_arm_source.json` (Duelo Arcano `fp_arm.json`, derivado de MakeHuman, CC0). Ver `assets/hands/CREDITS.md`.

## Veredicto global (críticos de shooter independientes)
_(se completa al final: meta = mediana > 7)_

## Pulido incremental de combate — 2026-10-22 — PASA
Rol: diferenciar seis firmas de proyectil, contactos melee/remates, equipo y pulsos de huésped/arena. Silueta objetivo: trazas y geometrías propias; contacto localizado sin ocultar al objetivo. Implementación: Codex; crítico independiente: visual_review (no autor).

| Criterio | Nota | Evidencia |
|---|---:|---|
| Silueta y legibilidad | 7 | Proyectiles distinguibles; faro cercano ya no oculta el combate. |
| Modelado y detalle | 7 | Equipo con motivos propios y poses acordes al golpe. |
| Materiales y luz | 7 | Contactos contenidos; huésped conserva silueta y color. |
| Coherencia | 8 | Paletas canónicas y lenguaje orgánico/cristalino. |
| Animación y feedback | 7 | Remate distinto de ejecución; críticos y ondas identificables. |
| Costo | 8 | Huésped equipado Baja: 13 llamadas / 14.578 triángulos; consola sin errores. |

Mínimo: 7. [Capturas y validación](COMBAT_POLISH.md). Escena de referencia Baja: 61 llamadas; sin luces nuevas. No certifica todas las piezas, arenas, FPS en iPhone ni calidad global. Alta aún conserva bastante brillo ambiental; HUD congestionado fuera del alcance. No se agregaron recursos externos.
