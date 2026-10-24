# MATRIZ DE BRECHAS — GDD «VORTEX · Documento maestro» (v1.0, 24/10/2026) vs. repositorio real

- Repositorio: `/home/user/vortex` (Fondal-Studios/Vortex). Rama de trabajo `claude/vortex-fase0-sprint1`, base canónica `claude/larga-con-eso-s43nfe` @ `62244b6` (Merge PR #14 «last-human-consciousness»).
- Alcance: secciones 1–11, 13 y 15 del GDD. Auditoría de **solo lectura**: no se tocó código del juego; el único archivo escrito es este.
- Método: lectura del GDD completo, `ls`/`grep` con número de línea sobre `src/`, `server/`, `docs/`, `.github/`, `render.yaml`, y **una única medición corta** (`tools/audit/medicion-capitulos.mjs`, solo simulación, 37 s de CPU). **No se ejecutó la suite** (`npm test`) ni pruebas de navegador. Todo estado «Implementado» significa «el código existe y lo leí», **no** «probado ni jugado» (el GDD §15 pide distinguir diseñado/implementado/probado/mergeado/desplegado; aquí «probado» = no verificado salvo donde se indica).
- Escala de estado: **Implementado** (existe y cumple lo leído) · **Parcial** · **Ausente** (no existe en código; una mención en docs no cuenta) · **Roto** (existe pero contradice el requisito o falla) · **No verificable** (requiere juego humano, hardware o prueba pesada).
- Riesgo: P0 = bloquea demo/integridad de datos · P1 = incumple un criterio AC o una promesa central · P2 = degrada calidad · P3 = menor/documental.
- Sprint sugerido según §11 del GDD (1 vertical slice · 2 combate/audio/UX · 3 campaña/arenas · 4 coop · 5 progresión · 6 QA/hardening) o Backlog.

---

## 0. Resumen ejecutivo (15 hallazgos principales)

| # | Hallazgo | Evidencia | Riesgo |
|---|---|---|---|
| 1 | **No existe el capítulo «Islas — Despertar» ni su cinemática de transferencia (20–30 s).** El prólogo del tren fue retirado (stub vacío); el reemplazo es una cadena de 4 subtítulos de ~16,5 s sobre un parpadeo de 4 s, sin escena de transferencia. README y `CAMPAIGN_AUDIT.md` aún hablan del tren. | `src/client/prologo.js:1-7`, `src/client/story.js` (`WAKE`), `src/client/main.js:300-312` | P1 |
| 2 | **No hay tutorial jugable de ~3 min**: solo una tarjeta modal de texto (`showTutorial`) + desbloqueo de poderes por oleada. | `src/client/main.js:324-339`, `main.js:316-323` | P1 |
| 3 | **Los capítulos duran ~1–3 min, no 8–12.** Medición con bots (sim 60 Hz, 1 semilla): m1 1,9–2,4 min, m3 1,6–3,2, m4 2,4, m5 1,4–1,8, m6 0,7–1,6, m2 2,4. Cada misión = 3 «etapas» (4 con jefe). | `tools/audit/medicion-capitulos.mjs` (salida abajo), `src/sim/operations.js`, `src/sim/game.js:68` | P1 |
| 4 | **Toda misión/campaña es finita y termina en `won`/`lost`** (`waveTotal` fijo, `state='won'` al cumplir). Las únicas rutas infinitas son el Campo de pruebas (`practice`) y `?horde=1` (banco de rendimiento), ambos fuera de misión. Ver §3. | `src/sim/game.js:68,178,213`, `src/client/main.js:368` | P3 (OK) |
| 5 | **Hay contenido inalcanzable en campaña/misiones**: `WAVE_PLANS` tiene 6 listas por mapa pero una operación solo recorre 3–4 etapas, así que las listas 4–6 (geoda, ariete, cuarzo, obelisco, graviton, aurora, espiral) casi nunca se usan en misiones; solo m1 y m2 tienen jefe de campaña (m3–m6 terminan sin encuentro final). | `src/sim/data.js:447-501`, `src/sim/game.js:68,235`, `src/sim/campaign.js:4` | P2 |
| 6 | **Un bot de «habilidades» se queda en etapa 4/4 de m1 durante 25 min de juego simulado sin ganar ni perder** (posible estancamiento de la pelea de jefe: sin tope de tiempo). Un caso, una semilla: reproducir antes de concluir. | `tools/audit/medicion-capitulos.mjs` (m1 skills s1 → `playing 25min`) | P2 |
| 7 | **Selección de huésped inicial: hoy hay 3 iniciales** (axioma, vesper, micelio) y **5 se compran con núcleos** (umbra 500, seraf 500, danzante 600, singular 750 con rango 3, colmena 600). No hay desbloqueo por campaña/desafío/exploración. | `src/sim/tienda.js:38-60`, `src/sim/data.js:353,364,375,387` | P1 |
| 8 | **Contradicción tienda/«desbloqueos jugables jugando, sin pagar»**: no hay dinero real ni moneda premium (bien), pero la tienda de núcleos vende huéspedes, planos, botiquín, reinicios y esencias (progresión jugable, no cosmética). Núcleos se ganan jugando, así que no es p2w, pero choca con «desbloqueo por campaña/desafíos» y con «no exigir tienda». | `src/sim/tienda.js`, `docs/COSMETIC_COMMERCE.md:4,11`, `src/shared/cosmetics.js:3-24` | P1 (decisión de propietario) |
| 9 | **Cooperativo sin bots**: `makeBot` solo se usa en QA/headless; el servidor no sustituye desconectados (queda el cuerpo parado 45 s y luego se lo quita); no hay espectador; el retorno es automático entre oleadas (sin límites). | `src/sim/bot.js`, `src/client/main.js:271`, `server/server.js:196-206,315` | P1 |
| 10 | **Premios sin ledger ni idempotencia server-side**: el perfil vive en `localStorage` y el cliente se «paga» solo (`cerrarPartida`); el respaldo de cuenta guarda un JSON declarado por el cliente. Existe un repro documentado que **falla**: el resultado (`fin`) no se reenvía al reanudar. | `src/client/perfil.js:92-104`, `src/client/main.js:810`, `server/accounts.js:45`, `tools/audit/coop-resume-result.repro.js:1-3`, `server/server.js:229-240,300-306` | P0/P1 |
| 11 | **AC-07 en riesgo**: el sonido de impacto del modo Combo se dispara también con ataques a distancia sin impacto confirmado (`near = hit \|\| C.ranged`). El resto de la cadena (`sound.hit`) sí nace de un evento `hit` emitido solo con daño. No hay test automático de «no suena al aire». | `src/client/combo-fx.js:134,170`, `src/sim/game.js:622`, `src/client/main.js:592` | P1 |
| 12 | **Cámara**: hay botón y tecla, pero la 3.ª persona solo es la inicial en modo Melé; el modo por defecto (Disparo) arranca en 1.ª persona y cambiar de modo (Tab) **fuerza** la cámara. La conmutación es instantánea (sin interpolación). | `src/client/essential-controls.js:9`, `src/client/main.js:127,293,924`, `src/client/render.js:217` | P2 |
| 13 | **Telemetría: ausente.** Accesibilidad: solo `prefers-reduced-motion`, subtítulos del Heraldo y símbolos no-color en el minimapa; sin daltonismo, escala de texto ni remapeo. | `grep` sin resultados (ver §Comandos); `docs/TACTICAL_ACCOUNTS.md` (formas del minimapa) | P2 |
| 14 | **CI/despliegue sin compuertas**: `ci.yml` corre solo `npm test` (los tests de navegador se omiten solos sin `/opt/pw-browsers`); `pages.yml` publica en Pages en cada push a la rama canónica **sin depender de CI**; Render con `autoDeploy: true` y nombre de servicio distinto al documentado (`arcanum-coop` vs `shower-psico-coop`). | `.github/workflows/ci.yml`, `.github/workflows/pages.yml`, `render.yaml:6,11`, `tools/browser.js:4`, `docs/TACTICAL_ACCOUNTS.md` | P1 |
| 15 | **Narrativa y estado documentados desalineados**: nombres heredados (Shower Psycho, Duelo Arcano, «Shower-psico» en README), docs que afirman el tren, test heredado rojo (`arsenal.test.js` espera 10 personajes, hay 13), 2 fallos conocidos (rezagado, balance Vesper). Los 20 perfiles «simulados» existen y están etiquetados como hipótesis, pero sobre una versión anterior (`18b1e1e`). | `README.md`, `docs/TACTICAL_ACCOUNTS.md`, `docs/VORTEX_QA_REPORT.md:126`, `docs/VORTEX_ALPHA_SIMULATED.md:3` | P2 |

### Salida de la medición de capítulos (bots, seed 1, sim pura)
```
m1 shooter  won 1.94 min  etapa 4/4      m4 shooter  won 2.43 min  etapa 3/3
m1 melee    won 2.43 min  etapa 4/4      m4 melee    lost 4.4 min  etapa 1/3 «Se agotó el tiempo del objetivo»
m1 skills   playing 25 min etapa 4/4 (!) m4 skills   lost 4.4 min  etapa 1/3 «Se agotó el tiempo del objetivo»
m3 shooter  won 1.68 min  etapa 3/3      m5 shooter  won 1.41 · melee 1.68 · skills 1.82 min (3/3)
m3 melee    won 1.62 min  etapa 3/3      m6 shooter  won 0.66 · melee 0.72 · skills 1.64 min (3/3)
m3 skills   won 3.21 min  etapa 3/3      m2 shooter  won 2.42 min · melee lost 2.16 min (4/4) · skills lost 0.2 min («Se perdió el objetivo»)
```
Los bots **no son jugadores humanos**: solo indican el orden de magnitud y que m4/m2 tienen estilos de bot que no pasan (objetivo «cultivo» y «caza») — a revisar. Un humano tarda más, pero un salto de ×4–×10 hasta 8–12 min no se cierra con ruido de medición.

---

## 1. Matriz de requisitos

Columnas: **ID** · requisito · **Estado** · evidencia (ruta:línea / doc / test) · **Riesgo** · **Sprint** · notas. «grep» = búsqueda realizada sin resultado.

### GDD §1 — Visión y principios

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-1-01 | Sobrevivir tiene final: campaña y misiones estándar con nº finito de oleadas/objetivos; victoria al cumplir | Implementado (lectura) | `src/sim/game.js:68` (`waveTotal` = pasos de la operación [+1 jefe]), `:213` (`state='won'`), `src/sim/operations.js` | P3 | 1 | Verificar con `tests/waves.test.js`, `tests/operations.test.js` (no ejecutados). Ver §3. |
| GDD-1-02 | Modo de oleadas infinitas independiente, opcional y posterior | Ausente (correcto para demo) | grep `endless\|infinit\|sin fin` en `src/`/`server/`: solo coincidencias de CSS `animation: infinite` y el arma «Ráfaga infinita» | P3 | Backlog | Las únicas rutas sin fin: Campo de pruebas (`game.js:178`) y `?horde=1` (`main.js:368`), no son misiones. |
| GDD-1-03 | «Demo primero»: no exponer sistemas ambiciosos que no pasen QA | Parcial | `docs/VORTEX_DECISIONS.md` (Ciclo 0: «reducir exposición de forja, flora/fauna, árboles, elecciones irreversibles»); menú aún expone Forja, Flora, Fauna, Territorios, Tienda, Base | P2 | 1 | Decidir qué se oculta en la demo. |
| GDD-1-04 | No pay-to-win: cosméticos sin poder; desbloqueos jugables jugando | Parcial | `docs/COSMETIC_COMMERCE.md:4,11`; `src/shared/cosmetics.js:3-24` (cosméticos con `channel:'earned'`, `price` en núcleos, `aurico` `channel:'planned'`); `src/sim/tienda.js` (huéspedes/planos/botiquín por núcleos) | P1 | 5 | No hay dinero real ni moneda premium: no es p2w. Pero hay progresión jugable **comprable** (con moneda ganada). Ver §Contradicciones C1. |
| GDD-1-05 | Cada huésped importa: identidad, silueta, historia, estilo marcial/armamento, habilidades y progresión propios | Parcial | `src/sim/data.js` (`HOSTS` 8; `CHARACTER_IDS` 13 = 8 huéspedes + 5 clases heredadas egida/lumen/forja/vigia/nova), `src/sim/huespedes.js`, `docs/HUESPEDES.md`, `docs/HUESPEDES_ARTE.md` | P2 | 3 | Dos catálogos paralelos (huéspedes vs. roles heredados) = deuda de identidad. |
| GDD-1-06 | Accesibilidad y claridad: HUD limpio, controles sencillos, objetivos visibles, tutorial integrado, móvil/escritorio | Parcial | `docs/VORTEX_CLEAN_HUD.md`, `docs/VORTEX_FOUR_ACTION_HUD.md`, `src/client/touch.js`; sin tutorial jugable (ver 2.1-06) | P2 | 2 | Detalle en §Accesibilidad. |
| GDD-1-07 | «No inventar estado»: verificar archivos/ramas/tests/despliegues antes de reportar | Parcial | `docs/VORTEX_DECISIONS.md` (ciclo 0: no llamar «iPhone probado» a emulación), `docs/VORTEX_QA_REPORT.md` | P3 | 1 | Cultura presente en docs; faltan `AUDIT.md`/`QA_MATRIX.md` formales (GDD §14). |

### GDD §2.1 — Demo pública

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-2.1-01 | Auditar e integrar todos los huéspedes con calidad suficiente, sin tope arbitrario de 4; inventariar huecos | Parcial | 8 huéspedes jugables (`data.js` `HOST_IDS`), `docs/HUESPEDES.md`, `docs/INVENTARIO.md`; ningún inventario de huecos con evidencia | P2 | 1 | Falta tabla huésped × (modelo, ataques, habilidades, animaciones, VO) → AC-04. |
| GDD-2.1-02 | Campaña de 6 capítulos / 6 arenas | Parcial | `src/sim/campaign.js:2` (`CAMPAIGN_ORDER` m1,m3,m4,m5,m6,m2), `src/sim/maps.js` (6 mapas) | P2 | 3 | Los 6 existen y están encadenados; contenido muy corto (2.1-03). |
| GDD-2.1-03 | 8–12 min por capítulo | Parcial (muy por debajo) | Medición bots: 0,7–3,2 min por capítulo (tabla del resumen); `tools/audit/medicion-capitulos.mjs` | P1 | 3 | Sin medición con humanos. Sprint 3 pide «duración medida 8–12 min». |
| GDD-2.1-04 | Capítulo 1 se llama «Islas — Despertar» | Ausente | `src/sim/operations.js` (m1 = «Refugio de la conciencia», arena «Vacío de Islas»); `src/client/story.js` `CHAPTERS` títulos `1/6 · REFUGIO DE LA CONCIENCIA`; grep «Islas — Despertar» sin resultados | P2 | 1 | Renombrar es trivial; el contenido (2.1-05..08) es el trabajo. |
| GDD-2.1-05 | Cinemática de transferencia 20–30 s (reemplaza la intro del tren) | Ausente | `src/client/prologo.js:1-7` (stub: «Prólogo retirado»); `story.js` `WAKE` = 4 líneas (4+4+4+4,5 = 16,5 s); `main.js:300-312` `beginIntro/startWake` + `renderer.startWake(4)` | P1 | 1 | Hoy: subtítulos del Heraldo sobre un «despertar» de 4 s; no hay escena de transferencia ni plano de cámara dedicado. Assets del tren/estación siguen (`src/client/env/estacion.js`, `humans.js`). README.md y `docs/CAMPAIGN_AUDIT.md` aún afirman el tren. |
| GDD-2.1-06 | Tutorial jugable integrado de ~3 min | Ausente | `src/client/main.js:324-339` `showTutorial` (tarjeta modal de texto, `localStorage cristal.tut.v2`); `main.js:316-323` `explainSkill`; `src/client/base-hud.js:139-147` (tutorial de la Base, texto) | P1 | 1 | `docs/VORTEX_ROADMAP.md` bloque 3 lo reconoce pendiente («tutorial no pausa…»). |
| GDD-2.1-07 | Oleadas finitas y conclusión narrativa del capítulo 1 | Parcial | `operations.js` m1 (3 pasos) + `campaign.js:4` jefe Coloso (4 etapas), `CAMPAIGN_LINKS.m1.after`, `story.js` `INTERLUDES` | P2 | 1 | Finito y con cierre textual (interludio de subtítulos). Sin cinemática de cierre. |
| GDD-2.1-08 | Nº de oleadas configurable y validado empíricamente | Parcial | Config en datos: `data.js:447` `WAVE_PLANS`, `:516` `OBJECTIVE_PLAN`, `operations.js` `steps`; validación: `tools/audit/medicion-capitulos.mjs` (bots) | P2 | 3 | Hay dos fuentes de verdad que no se alinean: `waveTotal` sale de `steps.length` (+1 jefe), no de `WAVE_PLANS`. No hay un `MissionDefinition/WaveDefinition` explícito (§10). |
| GDD-2.1-09 | Combate fluido melee/shooter, especialización por huésped | Parcial | `src/sim/modos.js` (Disparo↔Melé), `src/sim/combos.js`, `data.js` `COMBO_SETS`/`HABILIDADES`, `tests/combos.test.js`, `tests/estilos.test.js` | P2 | 2 | «Sensación» sin medir: `docs/VORTEX_SCORECARD.md` (combate 65, «tacto sin verificar»). |
| GDD-2.1-10 | Un ataque básico, dos habilidades y una definitiva; desbloqueo gradual | Parcial | HUD de 4 acciones: ataque + movilidad/defensa + apoyo + ulti (`docs/VORTEX_FOUR_ACTION_HUD.md`); `src/sim/modos.js` define **3** slots HAB.1-3 (+ulti) y Melé tiene **2** botones de ataque (`data.js` `GAME_MODES.combo`); desbloqueo: apoyo tras oleada 1, ulti tras 3 (`shared/skill-path.js`, `game.js:22,213,216`) | P2 | 2 | En conteo de botones coincide (1+2+1) pero el diseño interno sigue en 3 slots + «Completo» en pausa. Decidir cuál es el contrato. Ver §Contradicciones C5. |
| GDD-2.1-11 | Cámaras 1.ª/3.ª con botón, 3.ª inicial | Parcial | Botón `#camquick` (`public/index.html:200`), `#camtoggle` (`:211`), tecla P (`main.js:127`), `setCam` (`:891-900`); inicial: `main.js:293` `thirdForMode(gameMode())` y `essential-controls.js:9` (`mode==='combo'`) | P2 | 2 | Modo por defecto `shooter` (`settings.js:19`) → 1.ª persona inicial. `setGameMode` (`main.js:924`) cambia la cámara sin pedirlo. |
| GDD-2.1-12 | Transiciones de cámara sin cortar combos/disparos/habilidades | No verificable | `src/client/render.js:217` (`setThird` conmuta al instante), apuntado en sim (`game.js` `aimDir/camPos`) independiente del render | P2 | 2 | Por diseño la sim no depende de la cámara; falta prueba que dispare en mitad de un combo y conmute. `tests/camara.test.js` cubre solo `up` del snapshot. |
| GDD-2.1-13 | Mejorar manos, armas y golpes melee en 1.ª persona | Parcial | `src/client/weapons/hand-rig.js`, `src/client/hostfx-melee.js`, `docs/gate/manos.md`, `docs/gate/armeria-0-14.md` | P2 | 2 | Calidad visual subjetiva; sin evidencia de aceptación. |
| GDD-2.1-14 | HUD tipo Wild Rift: retrato/vida/escudo inferior | Implementado (lectura) | `docs/VORTEX_CLEAN_HUD.md`, `src/client/hud-huesped.js`, `tests/hud.test.js`, `tests/four-action-hud.test.js` | P2 | 2 | Validado en 3 tamaños de Chromium, no en dispositivo (`docs/VORTEX_QA_REPORT.md:126`). |
| GDD-2.1-15 | Tiempo pequeño en el HUD | Ausente | `public/index.html` no tiene reloj de partida (ids `hud`,`wave`,`camquick`…); el tiempo solo sale en la pantalla final (`main.js:820`) | P3 | 2 | El objetivo sí tiene límite visible en `#objbox` (no verificado). |
| GDD-2.1-16 | Minimapa | Implementado (lectura) | `src/client/tactical-hud.js`, `src/client/radar.js`, `src/shared/tactical.js:12-20` (`mapMarkers`), `docs/TACTICAL_ACCOUNTS.md`, `tests/tactical.test.js` | P2 | 2 | Formas distintas por tipo (no solo color). |
| GDD-2.1-17 | Objetivo y progreso de misión visibles | Implementado (lectura) | `main.js:705` (`#objbox`), `src/sim/metas.js:75-85` `puntoObjetivo`, `src/sim/objectives.js`, `tests/metas.test.js` | P3 | 2 | |
| GDD-2.1-18 | Contador «Oleada X/Y» | Parcial | `main.js:669`: en operaciones muestra `ETAPA x / y`; «OLEADA» solo fuera de operación (`?horde`/legado); en respiro muestra «RESPIRO» | P2 | 2 | Terminología distinta al GDD; Y = nº de etapas (3–4), no de oleadas de enemigos. |
| GDD-2.1-19 | Botones de habilidades con enfriamiento | Implementado (lectura) | `src/client/hud-huesped.js:25,43`, `game.js:865` (`mv`,`es`,`ab` autoritativos) | P3 | 2 | La ulti usa «carga %» además de cooldown (`VORTEX_FOUR_ACTION_HUD.md`): contradice «cooldowns visibles» solo en parte. |
| GDD-2.1-20 | Cambio de cámara en el HUD | Implementado | `#camquick` (`main.js:448,900`) | P3 | 2 | |
| GDD-2.1-21 | Alertas contextuales | Parcial | `main.js` `banner()` y eventos (`:592-640`), `caida.js`, `eventos.js`; caídos en minimapa | P3 | 2 | Sin cola/prioridad unificada. |
| GDD-2.1-22 | HUD responsive | No verificable | `tools/check-clean-hud.mjs`, `tests/hud-safe-point.test.js`; sin iPhone físico (`docs/VORTEX_QA_REPORT.md:50-59`) | P1 | 6 | Ver AC-06. |
| GDD-2.1-23 | Enemigos comunes comprensibles; élites/jefes diferenciados | Parcial | `data.js:427` `MONSTERS` (15), `:260` `AFFIXES` (6), 3 jefes (`coloso`,`argos`,`madre`), `docs/BESTIARIO.md`, `docs/JEFES.md` | P2 | 3 | Comprensibilidad no medida. Jefe solo en m1/m2 de campaña. |
| GDD-2.1-24 | Colisiones reales; daño e impacto sincronizados | Parcial | `src/sim/colision.js`, `src/sim/physics.js`, `tests/colision-criaturas.test.js`, `tests/physics.test.js`; daño solo en sim (`game.js:622`) | P2 | 2 | Autoritativo por diseño. Sincronía visual/sonora: ver AC-07. |
| GDD-2.1-25 | No sonar impacto si el ataque falla | Parcial / en riesgo | `combo-fx.js:134,170`; ver AC-07 | P1 | 2 | |
| GDD-2.1-26 | Animaciones y efectos contundentes sin saturar | No verificable | `src/client/combatfx.js`, `docs/COMBAT_POLISH.md`, `tests/combat-polish.test.js`; `reduced()` en `caida.js:133` | P2 | 2 | Opción de movimiento reducido presente. |
| GDD-2.1-27 | Misiones independientes con objetivos claros, oleadas finitas y recompensas | Implementado (lectura) | `operations.js` (6 operaciones × 3 pasos), `objectives.js` (ancla, secuencia, caza, núcleo, cultivo, sintonía), `tests/mission-variety.test.js`, `tests/operations.test.js` | P2 | 3 | Cada misión usa pasos de una lista de 4 plantillas (`link/defend/rescue/hunt`). |
| GDD-2.1-28 | Coop hasta 4, salas privadas con códigos | Implementado (lectura) | `server/server.js:88-150,200-260` (códigos `ALFABETO_SALA`, `MAX_JUGADORES=4` en `red.js:8`), `src/client/coop-ui.js`, `tests/coop4.test.js` | P2 | 4 | `?sala=K7MQ` para invitar (README). |
| GDD-2.1-29 | Bots opcionales simples y fiables (seguir, atacar, reanimar, priorizar objetivo) | Ausente (como función de producto) | `src/sim/bot.js` existe pero solo se instancia en QA/headless (`main.js:271` `opts.bot`, `tools/*`); sin referencia en `server/server.js` ni `coop-ui.js`; `bot.js` no usa `interact`/revivir (grep) | P1 | 4 | Hoy **no** se completa una sala de 2–4 con bots ni se reemplaza un humano faltante. |
| GDD-2.1-30 | Reconexión coop con bot sustituto, recuperar control, sesión e inventario consistentes; abandono y caída simultánea | Parcial | Gracia 45 s (`server.js:80,196-206`), token de reanudación (`:229-240`), `p.aw` (`:203`) solo evita ser objetivo de revivir (`shared/tactical.js:5,8`); no hay bot sustituto | P1 | 4 | El cuerpo queda **inmóvil** (input a cero) y vulnerable; si no vuelve en 45 s se lo quita (`:315`). Resultado final no se reenvía al reanudar (repro que falla). |
| GDD-2.1-31 | Elegir un huésped inicial al comenzar; resto por campaña/desafíos/exploración/eventos | Parcial / Roto frente al GDD | `src/sim/tienda.js:38-43` (`HUESPEDES_INICIALES` = axioma, vesper, micelio), `:60-65`; compra por núcleos `data.js:353,364,375,387`; `huespedes-ui.js:214,249` | P1 | 5 | Sin ruta «campaña desbloquea huésped X». Ver C1, C3. |
| GDD-2.1-32 | Elegir huésped de la colección antes de cada misión, sin cambio libre durante la partida | Parcial | Elección por `Equipo.char` en menú; **excepción**: en solitario/coop se puede cambiar `loadout` entre oleadas (`server.js:272-279` `loadout` si `g.phase==='intermission'`; `game.js` `setLoadout`) | P2 | 5 | Choca con «sin cambio libre durante la partida». |
| GDD-2.1-33 | Progresión permanente básica de conciencia y huésped; cuenta verificable; maestría y recompensas | Parcial | Perfil `src/client/perfil.js` (maestría `mae`, árbol `arb`, evolución `evo`); `src/sim/maestria.js` (rangos 1–10); `src/sim/progresion.js`; cuentas `server/accounts.js` | P1 | 5 | «Progresión de conciencia» (árbol compartido) no existe como entidad separada: todo es por huésped. Cuenta = respaldo manual declarado por el cliente. |
| GDD-2.1-34 | Códice mínimo: colección, fichas/modelos, habilidades, historia, modo de obtención; logros iniciales | Parcial | Códices de Fauna/Flora (`src/client/fauna-ui.js`, `flora-ui.js`), «Arenas» (`menu-nav.js:51`), `src/client/heroes-ui.js`/`huespedes-ui.js`; trofeos `trophy()` (7 usos en `main.js`) | P2 | 5 | No hay Códice unificado «Criaturas/Genética/Evolución» ni sistema de logros persistente (los trofeos son avisos). |
| GDD-2.1-35 | Menú central ágil sin base 3D obligatoria; accesos a campaña, misiones, coop, colección, evolución, ajustes, resultados | Parcial | `menu-nav.js:28-51`, `menu-hubs.js`; **El Santuario** existe como mapa-hub (`src/sim/base.js:26`, `docs/BASE.md:3-8`), no obligatorio, pero el ajuste por defecto tras una partida es «Entrar a la Base» (`BASE.md:7`, `main.js:838`) | P2 | 1 | Ver C2. |
| GDD-2.1-36 | Sin comercio entre jugadores; no exigir tienda/pagos para cerrar la demo | Implementado | grep comercio/subasta/trade: ninguno; `docs/COSMETIC_COMMERCE.md:6` («No hay cobros»); `src/sim/tienda.js` (NPC Cambista, no P2P) | P3 | — | La Tienda del Cambista sí está activa con núcleos (ver C1). |
| GDD-2.1-37 | Preservar arquitectura segura de cosméticos | Parcial | `src/shared/cosmetics.js:15-24` (sanea canal/posesión), `docs/COSMETIC_COMMERCE.md` (contrato) | P3 | Backlog | Sin servidor de derechos; propiedad editable en navegador (`COSMETIC_COMMERCE.md:6`). |

### GDD §2.2 — Expansiones posteriores (solo inventario de existencia; todo es Backlog Fase II)

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-2.2-01 | Editor anatómico 3D tipo Spore | Ausente | grep `editor`/`anat` en `src/`: solo `src/arcanum/*` (rig/parts, motor de huésped) y `huesped-piezas.js` (piezas fijas) | P3 | Backlog | `src/arcanum/` es base técnica reutilizable (rig, retarget), no un editor. |
| GDD-2.2-02 | Genética avanzada (biblioteca, hibridación, muestras) | Ausente | `src/client/fauna-ui.js` registra fauna/«híbridos» (`perfil.js:454`) como códice, no hibridación de huéspedes | P3 | Backlog | |
| GDD-2.2-03 | Mutaciones por decisiones/muerte; biomasa de misión vs permanente | Parcial | Órganos/mutaciones por oleada (`data.js:286-308 WEAPON_ORGANS/CHAMP_ORGANS`, `UPGRADE_KINDS`), esencias (`ESSENCES`); sin biomasa dual ni mutación por causa de muerte | P3 | Backlog | |
| GDD-2.2-04 | Simbiontes / armas orgánicas permanentes | Parcial | `src/sim/enjambre.js`, `colmena-data.js` (Colmena: zánganos), órganos de arma | P3 | Backlog | |
| GDD-2.2-05 | Cosméticos por pieza; tienda puramente estética | Parcial | `src/shared/cosmetics.js` (acabados por huésped) | P3 | Backlog | Ver GDD-9. |
| GDD-2.2-06 | Facciones, territorios, guerras | Parcial (distinto) | `src/client/territorios-ui.js`, `perfil.js:137-160` (territorios = arenas liberadas + bendiciones) | P3 | Backlog | «Territorio» hoy = arena liberada, sin facciones ni PvP. |
| GDD-2.2-07 | Temporadas, pases, misiones diarias | Ausente | grep `temporada\|season\|pase` en `src/`: ninguno | P3 | Backlog | |
| GDD-2.2-08 | Comercio / matchmaking / chat | Ausente | Solo ping de marcador (`game.js:98 input.ping`); sin chat | P3 | Backlog | |
| GDD-2.2-09 | Supervivencia infinita separada | Ausente | Ver GDD-1-02 | P3 | Backlog | Mantener separada de misiones finitas. |

### GDD §3 — Campaña, historia y contenido

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-3-01 | 6 capítulos/6 arenas; identidad y orden de arenas 2–6 «del repositorio» | Implementado | `campaign.js:2`: Islas (m1) → Laberinto Celestial (m3) → Jardín de Carne (m4) → Plaza de los Ecos (m5) → Osario sin Techo (m6) → Cámara Fractal (m2); `operations.js` | P3 | 3 | Orden y nombres tomados de código, no inventados. |
| GDD-3-02 | Intro breve y cinematográfica; misterios (IA, genoma, vórtice) revelados gradualmente | Parcial | `story.js` (`WAKE`, `FRAGMENTS` en `data.js:533`, `INTERLUDES`); `docs/VORTEX_STORY.md`; sin cinemática (ver 2.1-05) | P2 | 1 | Narración en subtítulos de voz sintética. |
| GDD-3-03 | Historia lineal con 2–3 decisiones morales y finales alternativos | Ausente | grep `decisi[oó]n moral\|final alternativo` en `src/`+`docs/VORTEX_STORY.md`: ninguno; un único `ENDING` (`story.js`) | P2 | 3 | |
| GDD-3-04 | Criaturas = restos de almas; élites/jefes con conciencias recuperables | Parcial | `docs/VORTEX_STORY.md`, `docs/BESTIARIO_LIMBO.md` (folclore de Ánimas); mecánica de «recuperar conciencia» no existe | P3 | 3 | |
| GDD-3-05 | Cada capítulo: inicio, objetivos, contador finito, cambios ambientales, encuentro final, victoria/derrota inequívoca, cinemática de cierre y desbloqueo del siguiente | Parcial | Inicio/objetivos/cierre: `story.js` `CHAPTERS`, `INTERLUDES`; desbloqueo consecutivo `campaign.js:21-23` + `perfil.js:461`; **encuentro final solo m1 (Coloso) y m2 (Madre Geoda)**; cambios ambientales: `arenas-vivas.js`, `eventos.js`, `nieblas.js` | P1 | 3 | m3–m6 acaban en un objetivo, sin jefe (`campaign.js:4`). |
| GDD-3-06 | Rejugar capítulos con otros huéspedes/dificultades, anomalías, secundarios, secretos | Parcial | Misiones individuales siempre disponibles (`CAMPAIGN_AUDIT.md`); dificultad `Game({difficulty})` (`game.js:239`); `eventos.js` | P3 | 3 | Sin selector de dificultad evidente en UI (grep `difficulty` en `settings.js`: ninguno). |
| GDD-3-07 | Misiones secundarias no obligatorias (combate, muestras, rescate, recuerdos, desafíos, secretos) | Parcial | `src/sim/metas.js` (5 mini-misiones: asalto, melé, intacto, élite, alimentación; 1 por oleada) | P3 | 3 | Faltan muestras, rescate de conciencias, recuerdos, secretos. |
| GDD-3-08 | Misiones independientes y coop de 5–15 min, tipos: supervivencia, defensa, rescate, destrucción, expedición, muestras, jefes | Parcial | 3 pasos (defensa, secuencia, caza, núcleo/rescate, cultivo); duración medida 0,7–3,2 min con bots | P1 | 3 | Sin «destrucción», «expedición», «muestras», ni jefe en misión independiente (solo `campaign=true` activa el jefe: `game.js:235`). |
| GDD-3-09 | Entornos dinámicos: variación de anomalías, clima, visibilidad, rutas, zonas seguras | Implementado (lectura) | `src/sim/arenas-vivas.js`, `eventos.js` (`EVENTOS_MAPA`), `nieblas.js`, `luz-arenas.js`, `tests/arenas-vivas.test.js`, `tests/eventos.test.js` | P2 | 3 | |
| GDD-3-10 | Eventos aleatorios anunciados y limitados | Implementado (lectura) | `data.js:549 EVENTO` (`aviso:4`, `minOleada:3`), `src/sim/eventos.js` | P3 | 3 | |

### GDD §4 — Oleadas, derrota y resultados

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-4-01 | Oleadas finitas por misión, variadas (combate, defensa, mecanismos, cronometrada, narrativa); jefes finales | Parcial | Objetivos por etapa (`objectives.js`); límites de tiempo por objetivo (`data.js:524 OBJECTIVE_INFO.limit` 110–260 s); jefe solo en m1/m2 | P2 | 3 | Sin etapa «narrativa» ni «defensa de mecanismo» más allá de ancla. |
| GDD-4-02 | Descansos 10–20 s, recuperación limitada, 3 mejoras a elegir; coop sincronizado | Parcial | `game.js:215` descanso 12 s solo / **22 s coop** (fuera del rango); en solitario la partida **espera** tu elección (`game.js:194-197`); `makeCards` (3 tarjetas, `VORTEX_ALPHA_3.md`); recuperación `+40 hp` | P3 | 2 | Contador coop: `phaseT` único en la sim → sincronizado por construcción. |
| GDD-4-03 | Mejoras temporales (daño, velocidad, cadencia, escudo, regeneración, glándulas, mutaciones) que desaparecen al terminar | Parcial | `game.js` `p.upg`/`cards` (viven en la instancia de `Game`); **órganos/esencias persisten** (`perfil.js:99-101`) | P3 | 5 | La persistencia de órganos puede contradecir «desaparecen al terminar» según definición de cada mejora. |
| GDD-4-04 | Derrota: reinicio completo por defecto; checkpoints narrativos excepcionales; resurrección limitada; equipo caído = derrota | Parcial | Reinicio: botón `#again` (`public/index.html:224`), servidor `restart` (`server.js:280-284`); equipo caído → `state='lost'` (`game.js:172`-zona step); resurrección: Botiquín inicial (`tienda.js` `SERVICIOS.botiquin`, máx 5) | P2 | 3 | Checkpoints: Ausentes («No hay guardado a mitad de una misión», `CAMPAIGN_AUDIT.md`). |
| GDD-4-05 | Reanimación con tiempo limitado, recursos biológicos, habilidades opcionales, restricción de usos; caído definitivo observa y vuelve entre oleadas/objetivos con límites | Parcial | Mantener E 3 s (1,5 s Soporte) a ≤3,5 u (`game.js:344-347`, `shared/tactical.js:3-9`), sangrado 25 s (`PLAYER.bleed`) → `lost`; **vuelve automático al empezar la siguiente oleada** (`game.js:232` `if (p.dead) this.revive(p)`) | P1 | 4 | Sin recursos biológicos, sin límite de usos, **sin modo espectador** (grep `espectador`: solo comentarios en `combo-fx.js`). |
| GDD-4-06 | Recompensas tras fracaso (parte de XP/biomasa); principales y desbloqueos requieren completar | Parcial | `perfil.js:92-104 cerrarPartida` acredita siempre núcleos/XP/botín; desbloqueo de campaña y territorio solo con `won` (`main.js:817,822`) | P2 | 5 | No hay diferenciación explícita «parcial»; ganar y perder pagan igual el botín base. Sin servidor autoritativo (ver AC-09). |
| GDD-4-07 | Resultados: V/D, oleadas X/Y, tiempo, objetivos, estadísticas, apoyo, XP, biomasa, botín, maestría, desbloqueos; resumen + detalle; reintentar y menú | Parcial | `main.js:815-838` `endGame/showEnd` (etapa, tiempo, bajas/puntos, maestría XP, botín) y botones `Jugar de nuevo`/`Menú` (`index.html:224`) | P2 | 5 | Sin aportes de apoyo/revivir/objetivos ni detalle expandible; texto plano (`<pre>`). |

### GDD §5 — Progresión, huéspedes y colección

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-5-01 | Conciencia con árbol y progresión permanentes compartidos; herencia de habilidades; no inflar HUD | Ausente (como entidad) | Árboles por huésped (`src/sim/progresion.js`, `perfil.js:176-215`); `skillLevel` global del perfil (`perfil.js:87`) | P2 | 5 | Único progreso compartido: nivel de poderes (0–2). |
| GDD-5-02 | Huésped: nivel, XP, maestría, mutaciones, historia, recuerdos, estilo, evolución; asistencia a huéspedes nuevos | Parcial | Maestría `maestria.js`, evolución `EVO_TIERS` (5 niveles), mutaciones; sin «nivel» de huésped ni recuerdos; sin asistencia | P2 | 5 | |
| GDD-5-03 | Huéspedes por historia, jefes/absorción, desafíos, expedición, descubrimientos | Ausente | Solo compra con núcleos (`tienda.js`); grep `unlock` en `data.js`: precio + req de maestría | P1 | 5 | Ver C1. |
| GDD-5-04 | Rareza refleja obtención, no superioridad numérica | Parcial | Rareza solo en objetos (`items.js` `RARITIES`); huéspedes no tienen rareza | P3 | 5 | |
| GDD-5-05 | Ramas evolutivas distintas, irreversibles salvo reinicio | Parcial | `data.js:99 EVO_PATHS`, `EVO_TIERS`, `perfil.js:106 evolucionar`, `reiniciarArbol` (`perfil.js:206`, costo 25 %) | P2 | 5 | Existe; el «reinicio a forma inicial con legado» no. |
| GDD-5-06 | Reinicio con legado (qué XP/maestría se conserva, sin borrado accidental) | Ausente | grep `legado\|lineage`: `data.js:270 LINEAGE` (linajes cosméticos de arma), sin reinicio con legado | P3 | Backlog | Definir antes de codificar (GDD). |
| GDD-5-07 | Maestría por experiencia/retos/evolución, no simplemente daño extra | Parcial | `maestria.js:3-4`: «multiplicadores PEQUEÑOS» de daño + cosméticos por rango | P3 | 5 | Choca parcialmente con «no simplemente daño extra». |
| GDD-5-08 | Códice (Criaturas, Genética, Evolución) con galería 3D, historia, progreso | Parcial | Ver 2.1-34; galerías 3D `public/hero-view.html`, `viewer*.html`, `humans.html` | P2 | 5 | |
| GDD-5-09 | Recuerdos por huésped | Ausente | grep `recuerdos` ligado a huésped: ninguno (solo `FRAGMENTS` globales) | P3 | Backlog | |

### GDD §6 — Combate, enemigos, audio y UX

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-6-01 | Especialidad melee/shooter inicial; combos únicos por huésped | Implementado (lectura) | `data.js:164-250 HABILIDADES/COMBO_SETS`, `src/client/combo-anim.js`, `tests/combos.test.js` | P2 | 2 | |
| GDD-6-02 | 1 básico + 2 habilidades + 1 definitiva; controles y cooldowns visibles | Parcial | Ver 2.1-10 | P2 | 2 | |
| GDD-6-03 | Audio adaptativo electrónico/oscuro, voces fragmentadas, firma sonora por huésped | Parcial | `src/client/audio.js` (síntesis, `melee(host,…)` por huésped `:309`), VO desactivado/diferido; `docs/ARTE_AUDIO.md`; sin música adaptativa verificada | P2 | 2 | |
| GDD-6-04 | Aire ≠ impacto confirmado; evitar mareo sonoro/visual | Parcial | Ver AC-07; `reduced()` | P1 | 2 | |
| GDD-6-05 | Enemigos previsibles/variados; élites coordinados, cobertura/emboscada; jefes con fases | Parcial | `src/sim/ai.js`, `director.js`, `jefe-ia.js`, `jefe-mec.js`, `bossmech.js`; élites vía `AFFIXES`; coordinación/cobertura: grep `cobertura\|emboscada` sin resultados | P2 | 3 | |
| GDD-6-06 | Jefes coop escalan 1–4 integrantes; todos vencibles solo o coop | Parcial | `bossmech.js:9,91-94`, `jefe-ia.js:154` (enrage por jugadores), `tests/jefes-coop.test.js`, `tests/jefes-bots.test.js` | P2 | 4 | Un bot de habilidades queda sin ganar m1 en 25 min (resumen #6). |
| GDD-6-07 | Movimiento base: caminar, correr, saltar, esquivar; movilidad avanzada por huésped; colisiones confiables | Parcial | Salto/correr (`main.js:196`), movilidad por huésped (`characters.js` `useMove0`), esquiva = movilidad/habilidad (no universal); `PLAYER.dash` | P2 | 2 | |
| GDD-6-08 | HUD: objetivo principal, progreso, minimapa, marcadores, asistencia opcional; HUD coop con retratos, vida/escudo, alertas de caídos | Parcial | Minimapa con aliados/caídos (`shared/tactical.js`); retrato propio en `main.js:677` (`#hudportrait`); retratos de compañeros no hallados | P2 | 4 | |

### GDD §7 — Cooperativo y redes

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-7-01 | Hasta 4 humanos; salas privadas con códigos; después públicas | Implementado (lectura) | `server.js:121-130,229`, `red.js:8` | P2 | 4 | `maxSalas` 10 (`render.yaml`); plan Free duerme a los 15 min. |
| GDD-7-02 | Bots opcionales a partir de huéspedes desbloqueados | Ausente | Ver 2.1-29 | P1 | 4 | |
| GDD-7-03 | Bot: seguir, melee, revivir si seguro, atender objetivos; sustituir desconectados y recuperar sesión/huésped | Ausente | `src/sim/bot.js` (IA de pruebas, no usada por servidor) | P1 | 4 | |
| GDD-7-04 | Dificultad por tamaño/nivel del equipo; normalización moderada | Parcial | Presupuesto de oleada `×(1+0,6·(n−1))` (`game.js:239`); no hay normalización por nivel | P2 | 4 | |
| GDD-7-05 | Botín personal no disputado; base para todos los participantes legítimos; bono por contribución; anti-AFK | Parcial | Botín por jugador (`server.js:293 botinDe`, `drops.js` `flushLoot`), `bn`/`cores` por jugador; sin bono por contribución ni anti-AFK (grep `afk`: ninguno) | P2 | 4 | |
| GDD-7-06 | Reanimación, espectador temporal y regreso limitado en frontera de oleada u objetivo | Parcial | Ver 4-05 | P1 | 4 | |
| GDD-7-07 | Ping/marcadores y mensajes rápidos | Parcial | Ping (`input.ping`, `g.pings`, botón central/`G`, README); sin mensajes rápidos | P3 | 4 | |
| GDD-7-08 | Soporte/sinergias opcionales; ulti individuales | Implementado (lectura) | Roles con habilidad de apoyo (`data.js:507 ROLES`), ultis por huésped | P3 | 4 | |
| GDD-7-09 | Host desconectado, reconexión, duplicación bot/huésped, idempotencia de premios, sincronía de temporizadores, latencia y pérdida de paquetes | Parcial | Servidor autoritativo (no hay «host cliente»; la 1.ª miembro solo manda mapa/inicio: `server.js:257-271`); si el anfitrión sale, `numerar` reasigna (`:176`); latencia probada con bots (`tests/coop.test.js` 200 ms, `docs/TACTICAL_ACCOUNTS.md`); idempotencia: **no** (repro rojo) | P1 | 4 | Pérdida de paquetes: WebSocket/TCP, sin pruebas de pérdida; si el servidor cae se pierde toda la sala (`cerrarSala` en `server.js:325`). |

### GDD §8 — Facciones, temporadas (solo existencia)

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-8-01 | Facciones, reputación, territorios mensuales, pases, rankings, misiones diarias, logros | Ausente (facciones/temporadas/rankings/diarias); Parcial (logros: trofeos) | Ver 2.2-06/07; `trophy()` en `ui.js` | P3 | Backlog | Sin mecánicas coercitivas de conexión diaria (cumple por ausencia). |

### GDD §9 — Economía y comercio

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-9-01 | Biomasa de misión/progresión, materiales genéticos, créditos ganados, **moneda premium cosmética** | Parcial | Núcleos (`perfil.cores`), esencias (4 tipos), materiales (`items.js MATERIALS`); **moneda premium: Ausente** (grep `premium\|gems\|stripe\|paypal\|checkout` en `src/`+`server/`: solo comentarios en `docs/`) | P3 | Backlog | Correcto para demo. |
| GDD-9-02 | Piezas jugables/capacidades/huéspedes se obtienen jugando; skins y acabados son cosméticos | Parcial | Huéspedes por núcleos (jugando, pero comprables); cosméticos: 8 gratis + 16 por núcleos (`COSMETIC_COMMERCE.md:4`) | P1 | 5 | Ver C1. |
| GDD-9-03 | ¿Algo funcional solo por dinero real? | Implementado (no existe) | No hay cobro ni moneda premium; `server/accounts.js:45` («NOT an entitlement or payment ledger»); `aurico` marcado `planned` sin precio (`cosmetics.js:6`) | P3 | — | Nada es exclusivo por dinero. |
| GDD-9-04 | Prevención de fraude para economía futura (duplicados, auditoría, reversión) | Ausente | `COSMETIC_COMMERCE.md:11-23` lista requisitos, ninguno implementado | P3 | Backlog | |

### GDD §10 — Arquitectura y persistencia

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-10-01 | Stack real determinado tras auditoría; no reescribir sin necesidad | Implementado | JS nativo (ES modules) + three 0.186.1 + `ws` + `pg` (`package.json`); sim pura `src/sim` compartida cliente/servidor; sin paso de build salvo `tools/build-static.js` | P3 | 1 | Buena separación sim/red/render (`docs/VORTEX_SCORECARD.md`: «buena separación sim/red»). |
| GDD-10-02 | Separación de datos: huésped, identidad genética, apariencia, config de partida, sesión coop, progreso, cuenta, misiones, eventos, economía, telemetría | Parcial | Huésped `data.js`/`huespedes.js`, identidad `src/shared/identity.js`, cosméticos `shared/cosmetics.js`, red `sim/red.js`, perfil `client/perfil.js` (un solo blob JSON), cuenta `server/accounts.js` | P2 | 5 | Perfil monolítico en `localStorage` (clave en `perfil.js`), sin versionado/migraciones formales más allá de `migrarHuespedes`. |
| GDD-10-03 | Entidades (Account, OwnedHost, HostMastery, MissionRun, CoopSession, PlayerContribution, RewardsLedger, CodexEntry, Achievement, …) con migraciones y versionado | Parcial / Ausente | Existen `Account` (`vortex_accounts`), `HostMastery` (`perfil.mae`), `OwnedHost` (`perfil.huespedes`), `CoopSession` (rooms en memoria). **Ausentes**: `RewardsLedger`, `MissionRun`, `PlayerContribution`, `Achievement`, `CodexEntry` | P1 | 5 | Tablas: solo `vortex_accounts` y `vortex_sessions` (`accounts.js:19-22`). |
| GDD-10-04 | Autoridad de servidor para recompensas, inventario y progreso; no confiar en clientes | Roto / Ausente | `docs/TACTICAL_ACCOUNTS.md`: «progreso declarado por el cliente… no verifica propiedad de equipamiento en WebSocket»; `server.js:35-49 cargaDe` solo **acota** valores del cliente (maestría 0–10, evo 0–4, equipo limpio) sin verificar propiedad; botín/núcleos se acreditan en el navegador (`main.js:810`) | P0/P1 | 5 | La sim del servidor sí calcula daño/botín de la partida; el cliente decide qué guardar. |
| GDD-10-05 | Compatibilidad futura del editor genético (anclas, esqueletos) | Parcial | `src/arcanum/{rig,schema,parts,retarget}.js` (base de rig/piezas) | P3 | Backlog | Sin contratos formales de anclaje. |

### GDD §11 — Sprints y dependencias (estado de lo que cada sprint exige)

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-11-01 | Sprint 0: auditoría, rama canónica, build, tests, Render, assets, línea base de rendimiento y seguridad | Parcial | `docs/VORTEX_AUDIT.md` (192 l.), `VORTEX_QA_REPORT.md`, `VORTEX_DECISIONS.md` (rama canónica `claude/larga-con-eso-s43nfe`, Render autodeploy); este documento; **línea base de rendimiento/seguridad no medida** (`tools/perf-browser.js` existe, no se ejecutó) | P2 | 1 | Faltan `AUDIT.md`/`ROADMAP.md`/`QA_MATRIX.md`/`20_PERSONAS_SIMULADAS.md` con los nombres del GDD §14 (equivalentes parciales: `VORTEX_AUDIT.md`, `VORTEX_ROADMAP.md`, `VORTEX_QA_REPORT.md`, `VORTEX_ALPHA_SIMULATED.md`). |
| GDD-11-02 | Sprint 1: flujo menú → huésped → tutorial Islas → oleadas finitas → boss/desafío final → resultado y persistencia | Parcial | Menú→huésped→misión→resultado→guardado local: sí (`main.js:260-290,815-838`); **sin tutorial de Islas** ni cinemática; jefe sí (Coloso) | P1 | 1 | |
| GDD-11-03 | Sprints 2–6 | Pendiente | Ver matrices por área | — | 2–6 | |

### GDD §13 / §14 / §15 — Criterios, entregables, Git/seguridad/publicación

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint | Notas |
|---|---|---|---|---|---|---|
| GDD-14-01 | Entregables: AUDIT.md, GDD.md, ROADMAP.md, QA_MATRIX.md, 20_PERSONAS_SIMULADAS.md, DEMO_RELEASE_CHECKLIST.md, RELEASE_NOTES.md, FUTURE_BACKLOG.md | Parcial | Equivalentes en `docs/VORTEX_*.md` (ver 11-01); `ls docs/` no contiene `GDD.md`, `QA_MATRIX.md`, `DEMO_RELEASE_CHECKLIST.md`, `RELEASE_NOTES.md`, `FUTURE_BACKLOG.md` | P3 | 1 | |
| GDD-15-01 | Ramas feature/sprint; pruebas antes de PR; sin merge automático a principal | Parcial | Historial de PRs #1–#14 (`git log`), `docs/VORTEX_DECISIONS.md` (sin merge automático); **Pages y Render despliegan sin esperar a CI** | P1 | 1 | Ver GDD-15-04. |
| GDD-15-02 | No modificar secretos/credenciales en código | Implementado (lectura) | grep de patrones `api_key/secret/password = '…'` en `src server tools public`: sin coincidencias; `.gitignore` excluye `.env`, `registros/`, `jugadores/`, `escritorio/bin/`; `DATABASE_URL` por entorno (`accounts.js:17`) | P3 | 6 | Sin escaneo de secretos en historial (no ejecutado). |
| GDD-15-03 | Revisar dependencias y configuración de Render | Parcial | `package.json`: `pg ^8.16.3`, `three 0.186.1`, `ws ^8.18.0`; `render.yaml` revisado (ver 15-04); `npm audit` **no ejecutado** (sin red) | P2 | 6 | `render.yaml` ⇒ servicio `arcanum-coop`; docs ⇒ `shower-psico-coop` (`TACTICAL_ACCOUNTS.md`); rama de Render «no está siguiendo main». |
| GDD-15-04 | CI/despliegue con compuertas | Parcial | `ci.yml` (Node 22, `npm ci`, `npm test`; sin matriz, sin lint, sin job de navegador: `tools/browser.js:4` busca `/opt/pw-browsers` y los tests se omiten solos); `pages.yml` (push a `main`/`claude/larga-con-eso-s43nfe` ⇒ build estático y deploy, **sin `needs` de CI**); `render.yaml:6,11` `autoDeploy: true`; Dockerfile con HEALTHCHECK | P1 | 6 | `docs/VORTEX_ROADMAP.md` bloque 1 pide «CI navegador obligatorio» (pendiente). Pages no aloja cuentas ni coop. |
| GDD-15-05 | No eliminar assets/proyectos heredados sin inventario | Implementado (política) | `docs/VORTEX_DECISIONS.md` (ciclo 0: no borrar mapas/sistemas por lectura estática); `docs/INVENTARIO.md`, `docs/ASSETS.md`, `docs/LICENCIAS.md` | P3 | 1 | Residuos: nombre «Shower-psico» en README, `config.json` (`arcanum-coop.onrender.com`). |
| GDD-15-06 | Distinguir diseñado/implementado/probado/mergeado/desplegado | Parcial | Docs `VORTEX_*` lo hacen en prosa; sin tabla de estado por feature | P3 | 1 | Esta matriz propone esa distinción (ver nota de método). |
| GDD-15-07 | Seguridad de red y servidor | Parcial | Positivo: `maxPayload 8192`, tope de mensajes/s (`server.js:190`), límite por IP (`MAX_POR_IP`) y de salas, saneo de nombres y carga (`nombreLimpio`, `cargaDe`), `resolveFile` anti-traversal, cuentas con scrypt N=32768, cookie HttpOnly/SameSite=Strict, CSRF por cabecera, límite 96 KiB, 15 mutaciones/min. Negativo: `ALLOWED_ORIGINS` vacío = cualquier origen (`server.js:87`, `render.yaml` `sync:false`); sin CSP/HSTS/X-Frame; perfil respaldado es JSON libre (`accounts.js:45` valida solo «objeto»); cliente autoritativo en progreso (10-04) | P1 | 6 | |


## 2. Auditoría de «misiones/modos que puedan quedar infinitos» (AC-02)

Revisados: `src/sim/game.js` (`waveTotal`, `updateWaves`, `startWave`, `updatePractice`), `data.js` (`WAVE_PLANS`, `OBJECTIVE_PLAN`, `OBJECTIVE_INFO`), `director.js`, `modos.js`, `operations.js`, `campaign.js`, `metas.js`, `objectives.js`, `src/client/main.js` (`startSolo`, `hordeTopUp`), `server/server.js` (`empezar`).

| Modo / ruta | ¿Puede ser infinito? | Evidencia | Veredicto |
|---|---|---|---|
| Campaña (`campaign:true`) | No. `waveTotal = steps.length + (jefe? 1:0)`; gana al vaciar la última etapa | `game.js:68,213` | Finito. Cap. 1 y 6: 4 etapas (con jefe); 2–5: 3 etapas sin jefe. |
| Misión individual (Arenas, `operation:true`, `campaign:false`) | No. `waveTotal = steps.length` = 3 | `game.js:68`, `main.js:267` | Finito (3 etapas, sin jefe). |
| Coop (servidor `empezar`) | No. Misma lógica que misión individual (`operation:true`, sin `campaign`) | `server/server.js:150` | Finito (3 etapas, **sin jefe**). El GDD pide «jefes vencibles solo o coop». |
| Fallo de objetivo | Termina en derrota, no en bucle. Con `operation`, `finish(ok=false)` ⇒ `state='lost'` | `objectives.js` `finish` | OK. Fuera de operación (legado), un objetivo fallido solo hace `surge(0.3)` y la oleada continúa. |
| Oleada «sin enemigos» | Puede esperar al último enemigo; hay `tickRezagados` que los acosa hacia el jugador | `game.js:211`, `src/sim/rezagados.js` | OK; test rojo conocido de «enemigo rezagado» (`VORTEX_QA_REPORT.md:126`). |
| Descanso | En solitario espera la elección de tarjeta (sin límite) | `game.js:194-197` | No es infinito: depende del jugador. |
| Jefe sin tiempo límite | Posible estancamiento si el equipo no puede dañar al jefe (ver bot `skills` en m1: 25 min «playing») | Medición | Sin cronómetro de misión ni «enrage» que cierre la partida. P2. |
| Campo de pruebas (`practice`) | **Sí, por diseño**: sin oleadas, vida y munición ilimitadas, blancos que reaparecen | `game.js:178-190`, `main.js:388,859` | Modo de entrenamiento, no misión. Mantener separado. |
| `?horde=1` | **Sí** (vida enemiga 1e9, `phaseT=1e9`) | `main.js:368-372,472` | Banco de rendimiento solo por URL. Excluir del build de demo. |
| `?wave=N` / `god=1` | Atajos de depuración | `main.js:269,968` | Excluir/ocultar en build de demo. |
| El Santuario (`map.base`) | Sin oleadas ni fin (es hub) | `game.js:190` `stepBase`, `docs/BASE.md` | No es misión. |
| Mini-misiones (`metas.js`) | Una por oleada; cierran con la oleada (`misionFin`) | `metas.js:66` (`misionFin`) | Finito. |
| Objetivos con tiempo | Todos con `limit` (110–260 s) | `data.js:524-531` | Finito. |

Conclusión: **no se encontró ninguna misión o campaña que pueda quedar en oleadas infinitas**. Riesgos reales: (a) estancamiento de jefe sin tope (P2), (b) atajos de depuración y banco de rendimiento accesibles por URL en producción (P3), (c) contenido «muerto»: `WAVE_PLANS` 4–6 no se usa en misiones/campaña (P2), (d) si se añade un modo infinito, hoy reusaría `Game` sin separación (Backlog).

## 3. Accesibilidad, telemetría y sonido (detalle pedido)

| ID | Requisito | Estado | Evidencia | Riesgo | Sprint |
|---|---|---|---|---|---|
| ACC-01 | Movimiento reducido | Implementado | `prefers-reduced-motion` en `public/*.css`; `reduced()` en `caida.js:133,151`, `hostfx-melee.js` (`D.reduced()`) | P3 | 2 |
| ACC-02 | Subtítulos del Heraldo / VO | Parcial | `story.js` clase `Subtitles`; VO desactivado/diferido | P3 | 2 |
| ACC-03 | No depender solo del color (minimapa) | Implementado | `docs/TACTICAL_ACCOUNTS.md` (triángulo/círculo/cruz/aspa/rombo/estrella) | P3 | 2 |
| ACC-04 | Modo daltónico, escala de texto, remapeo, contraste alto | Ausente | grep en `settings.js`/`graficos-ui.js`: sin opciones | P2 | 2 |
| ACC-05 | Controles simples; asistencia de puntería | Implementado | `assistAim`/`simpleAssist` (`main.js:489`), HUD de 4 acciones | P3 | 2 |
| ACC-06 | Telemetría de producto/QA (sesiones, tiempos, abandono, errores) | Ausente | grep `telemetr\|analytics\|beacon\|gtag` en `src server public tools`: sin resultados (solo `window.__evlog` local de depuración en `story.js`); el servidor no registra IPs/nombres a propósito (`server.js:83`) | P2 | 5 |
| AUD-01 | Sonido de impacto = `hit` del servidor | Implementado (lectura) | `game.js:622` emite `hit` solo en `damageMonster`; `main.js:592` → `sound.hit` | P3 | 2 |
| AUD-02 | Swing al aire distinto de impacto | Implementado (lectura) | `audio.js:291` `melee(kind, hit=0)`: «hit: nº de impactos (0 = al aire)»; `hostfx-melee.js:263` `impact()` retorna si `!hit` | P3 | 2 |
| AUD-03 | Impacto Combo con ataque a distancia sin confirmar | **Roto (potencial)** | `combo-fx.js:134` `near = hit \|\| C.ranged`, `:170` `snd.comboHit(...)` si `near` | P1 | 2 |
| AUD-04 | Test automático «atacar al aire no suena hit» | Ausente | `tests/` sin pruebas de sonido; `tools/audio-combatfx-test.js` solo mide que cada síntesis no sea muda | P1 | 2 |

