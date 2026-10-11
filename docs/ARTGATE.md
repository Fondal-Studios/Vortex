# ART GATE — puerta de calidad de arte (Cristal Vórtice)

Idea tomada de **La Horda** (`LA_HORDA_ARTGATE_AUDIT.md`): **nada de arte entra al juego sin pasar la puerta.** Cada pieza (arma, mano, héroe, criatura, mapa, efecto) tiene una ficha en `docs/ARTGATE_REGISTRY.md` con su estado y nota. Si no pasa, se rehace; si es incoherente con el resto, se rechaza.

## Biblia de arte (resumen: lo que TODO debe respetar)
1. **Lenguaje:** cristal facetado + biología (carne húmeda, venas, ojos). Psicodélico pero **legible**: la silueta se entiende a 2 segundos y a 20 m.
2. **Paleta:** cada pieza = 1 color dominante + 1 acento + 1 neutro oscuro. Los colores de arma (`WEAPON_COLORS` en `src/client/shotfx.js`) y de héroe (`CHARACTERS[*].color` en `src/sim/data.js`) son canon: no se cambian.
3. **Luz y materiales:** metal anodizado/iridiscente, cristal con aristas luminosas, piel/guante mate. Emisivo sólo donde la pieza *hace algo* (cañón, runas, núcleo). Nada plano ni de un solo tono.
4. **Densidad de detalle:** misma regla para todo lo que está en pantalla a la vez (arma, manos, criaturas, mapa): detalle fino sólo donde la cámara lo ve (cañón, mira, nudillos); lo lejano se simplifica pero **mantiene la silueta**.
5. **Feedback:** todo disparo se *ve* y se *siente* (fogonazo, traza, impacto, daño, muerte) y es **distinto por arma**.
6. **Presupuesto (calidad Baja = iPhone):** arma+manos en 1ª persona ≤ 16 draw calls y ≤ 8k triángulos; criatura ≤ 40 draw calls (≤ 15k tris); mapa ≤ 300 draw calls; sin PointLights extra por pieza. Alta puede sumar detalle.
7. **Honestidad:** nada se declara "nivel Halo/comercial". Se puntúa con la vara de los shooters que salen hoy.

## La puerta (5 pasos)
1. **Ficha**: el autor escribe en el registro qué pieza es, su rol de juego y su silueta objetivo.
2. **Hoja de contacto**: capturas reales (Chromium/WebGL) en Baja y Alta, en el contexto del juego (1ª persona / en escena), no sólo en un visor.
3. **Medición**: draw calls y triángulos (`gl.info`) dentro del presupuesto en Baja.
4. **Crítico independiente**: otro agente que **no construyó** la pieza la puntúa 1-10 con la rúbrica de abajo, mirando las capturas, y lista defectos concretos.
5. **Veredicto**: ≥ 7 en todos los criterios = **PASA**. < 7 = **REHACER** con la lista de defectos. Incoherente con la biblia = **RECHAZADA**.

## Rúbrica (cada criterio 1-10; el crítico escribe la nota y una frase de por qué)
| Criterio | Qué mira |
|---|---|
| Silueta y legibilidad | ¿Se reconoce qué es y para qué sirve sin leer el nombre? ¿Se distingue de las demás? |
| Modelado y detalle | Formas, biseles, proporciones, piezas funcionales, ausencia de "cajas y cilindros" |
| Materiales y luz | Metal/cristal/piel creíbles, emisivos con intención, contraste, no lavado ni oscuro |
| Coherencia | ¿Parece del mismo juego que lo demás? ¿Respeta paleta y biblia? |
| Animación y feedback | Retroceso, fogonazo, trazas, impacto, respuesta al daño, mejora visible |
| Costo | Dentro de presupuesto en Baja; sin parpadeos ni errores de consola |

Puntaje de pieza = **mínimo** de los criterios (no el promedio). Puntaje del juego = mediana de los críticos de shooter sobre el juego completo (ver `docs/ARTGATE_REGISTRY.md`, sección Veredicto global).

## Fuentes permitidas
Se pueden reutilizar recursos de los otros repositorios del equipo (p. ej. `Fondal-Studios/Duelo-Arcano`: `assets/characters/fp_arm.json`+`fp_skin.jpg` —CC0 derivado de MakeHuman—, `src/vfx`, `src/spells`; `La-Horda`: biblia y VFX). Reglas: sólo material propio o CC0 con licencia verificable, **nunca Ready Player Me**, y cada reutilización se anota en `docs/ARTGATE_REGISTRY.md` (origen + licencia).
