# VORTEX — ROADMAP (épicas, sprints 1–6 e issues sugeridos)

> **Estado del documento**
> - Versión: 0.1 (propuesta, pendiente de aprobación del propietario) · Fecha: 2026-10-24
> - SHA base: `62244b61eaecff34ba539fc4018456172579bf03` (rama canónica `claude/larga-con-eso-s43nfe`) · Rama de trabajo `claude/vortex-fase0-sprint1` @ `d009eec` · Archivo **sin commitear**
> - Responsable: Claude (estudio)
> - Nivel de todo lo que sigue: **Diseñado** (plan). Nada de esto está Implementado, Probado, Mergeado ni Desplegado, salvo donde la columna «Hoy» lo diga con evidencia en [AUDIT.md](AUDIT.md).
> - Fuentes: [GDD.md](GDD.md) §11 y §13 · [audit/MATRIZ_GAPS.md](audit/MATRIZ_GAPS.md) · [audit/MEDICION_CAPITULOS.md](audit/MEDICION_CAPITULOS.md) · [audit/INVENTARIO_HUESPEDES.md](audit/INVENTARIO_HUESPEDES.md) · [VORTEX_ROADMAP.md](VORTEX_ROADMAP.md) (plan previo por bloques, que este documento sustituye como fuente viva)
> - Hermanos: [QA_MATRIX.md](QA_MATRIX.md) · [FUTURE_BACKLOG.md](FUTURE_BACKLOG.md) · [DEMO_RELEASE_CHECKLIST.md](DEMO_RELEASE_CHECKLIST.md)

## Cómo leer este plan

- **Prioridad:** P0 = integridad de datos o bloquea la demo; P1 = incumple un criterio AC o una promesa central; P2 = degrada calidad; P3 = menor.
- **Esfuerzo relativo** (no son fechas ni horas; una persona con revisión): **S** pocas horas a 1 día · **M** 2–4 días · **L** 1–2 semanas · **XL** más de 2 semanas o con incertidumbre alta. Son estimaciones de ingeniería sin calendario comprometido.
- **Dependencias:** otro issue (`E1-03`) o una decisión del propietario (`D-C1`, ver «Decisiones» abajo).
- **Regla de cada sprint** (GDD §11): alcance, archivos tocados, checklist, prueba automática o manual, evidencia, riesgos, regresión, **PR independiente** y decisión de merge. Sin merge a la rama canónica sin autorización expresa (GDD §15). No se promete trabajo asíncrono que no esté automatizado.
- **Pruebas nuevas:** las marcadas «(nuevo)» no existen hoy; las demás son archivos reales de `tests/` o `tools/`.

## Decisiones del propietario que condicionan el plan

| Id | Decisión | Bloquea |
|---|---|---|
| D-C1 | Qué hacer con la tienda de núcleos que vende Huéspedes (mover a campaña/desafíos o mantener) | E5-02, E5-03 |
| D-C2 | Santuario: opcional u oculto en la demo | E1-07 |
| D-C3 | Cuál es el Huésped inicial único y qué desbloquea a los demás | E1-04, E5-02 |
| D-C5 | Contrato de combate: 1 básico + 2 habilidades + ulti (qué pasa con la 3.ª habilidad) | E2-05 |
| D-C7 | Canon: huéspedes biológicos o de genoma sintético | E1-01 (guion de la cinemática) |
| D-C13 | Si el progreso de conciencia compartido entra en la demo o se reformula | E5-05 |
| D-C15 | Política de despliegue: compuertas de CI, Render manual | E0-02 |

Detalle de cada una en [GDD.md](GDD.md), Parte C.

## Épicas

| Épica | Nombre | Sprint | Objetivo medible |
|---|---|---|---|
| E0 | Higiene del repositorio y de la CI | Previa a Sprint 1 y 6 | CI verde y despliegue con compuerta |
| E1 | Corte vertical «Islas — Despertar» | 1 | AC-02, AC-03 con flujo completo |
| E2 | Combate, audio, cámara y HUD | 2 | AC-05, AC-06, AC-07 |
| E3 | Campaña y arenas | 3 | AC-10: 6 capítulos de 8–12 min medidos |
| E4 | Cooperativo y resiliencia | 4 | AC-08 |
| E5 | Progresión, colección y servidor de premios | 5 | AC-09, AC-11, AC-04 |
| E6 | QA, endurecimiento y decisión de salida | 6 | AC-12 |

---

## E0 — Higiene de repositorio y CI (previa; recomendada antes del Sprint 1)

| Issue | Título sugerido | Prio | Depende de | Esf. | Pruebas / criterio de cierre |
|---|---|---|---|---|---|
| E0-01 | Dejar `npm test` en verde en CI: corregir `tests/arsenal.test.js` («personajes: 10…» espera 10, hay 13) y los otros fallos del run `40056119035` (9 en total; nombres exactos por obtener del log, ver [AUDIT.md](AUDIT.md) §6.2) | P1 | Log de CI completo | M | CI sin fallos; los omitidos (66) quedan explicados |
| E0-02 | Compuerta entre CI y despliegue: `needs` de CI en `pages.yml`; Render con despliegue manual; proteger la rama canónica | P1 | D-C15 | S | Un push con CI roja no publica |
| E0-03 | Job de navegador obligatorio (Chromium instalado en CI, sin omisión silenciosa) | P1 | E0-01 | M | `tests/e2e.test.js` y `tests/coop-browser.test.js` se ejecutan en CI |
| E0-04 | Reconciliar nombres: `README.md` («Shower-psico»), `render.yaml` (`arcanum-coop`) frente a `shower-psico-coop`, `public/config.json`; archivar docs desactualizadas (tren) | P3 | — | S | Un solo nombre en README, render y docs |
| E0-05 | Decidir cuál es la rama principal (`main` está atrasada en `94280a5`) y cerrar la confusión | P2 | D-C15 | S | Una rama predeterminada documentada |

---

## Sprint 1 — Corte vertical «Islas — Despertar» (épica E1)

**Alcance (GDD §11):** menú → escoger Huésped → tutorial de Islas → oleadas finitas → jefe o desafío final → resultado y persistencia. Arreglar controles, colisiones, habilidades y HUD solo en lo que bloquee ese flujo.

| Issue | Título sugerido | Prio | Depende de | Esf. | Hoy | Pruebas |
|---|---|---|---|---|---|---|
| E1-01 | **Cinemática de transferencia de 20–30 s** que reemplaza la intro del tren: la conciencia aparece en el Huésped inicial; guion según el canon elegido | P1 | D-C7 | L | Ausente: `prologo.js` es un stub; la intro son ~18,5 s de subtítulos | Duración medida entre 20 y 30 s; se puede saltar; `tests/prologo.test.js` actualizado (hoy prohíbe `startPrologue`) |
| E1-02 | **Tutorial jugable de ~3 min** integrado en el capítulo 1: mover, apuntar, atacar, cambiar de modo, usar una habilidad desbloqueada, completar una acción de objetivo | P1 | E1-01 (orden) | L | Ausente: tarjeta modal `showTutorial` | Prueba de flujo (nuevo) que recorre los pasos con entrada simulada; duración con bot dentro de rango; criterio humano pendiente |
| E1-03 | Renombrar el capítulo 1 a «Islas — Despertar» (título, briefing, relato) y alinear docs | P2 | — | S | «Refugio de la conciencia» | `tests/campaign-clarity.test.js` y `check-story-canon.mjs` actualizados |
| E1-04 | **Selección de Huésped inicial único** al comenzar; el resto bloqueado hasta su evento de desbloqueo | P1 | D-C3 | M | 3 iniciales (axioma, vesper, micelio) | Perfil nuevo muestra un solo Huésped disponible; `tests/tienda.test.js` actualizado |
| E1-05 | **Capítulo de 8–12 min con jefe final**: más etapas u oleadas configurables, números en datos (`MissionDefinition`) y validados con bots | P1 | E1-02 | L | Mediana 2,39 min con jefe Coloso Prismático | `tools/audit/medicion-capitulos.mjs` sobre m1; meta: mediana con bots dentro o cerca de 8–12 min tras aplicar un factor humano prudente (a validar con humanos) |
| E1-06 | **Ledger idempotente de recompensas** (mitigación mínima): `matchId` por partida, recibo persistente, cierre transaccional; `cerrarPartida` no suma dos veces; fallo de almacenamiento avisa | P0 | — | M | V03 y V01 vigentes (3 cierres = 900 núcleos en vez de 300) | `tools/audit/guardado-test.mjs` pasa a test en `tests/` (nuevo): 3 cierres = 1 acreditación; `QuotaExceededError` produce aviso |
| E1-07 | **Pantalla de resultados** mínima del GDD §4: victoria/derrota, Etapa o Oleada X/Y, tiempo, objetivos, estadísticas, XP, botín, desbloqueos; botones Reintentar y Menú | P1 | E1-06 | M | Texto plano en `<pre>` | Test de contenido (nuevo); comprobación en navegador |
| E1-08 | Contador **«Oleada X/Y»** y reloj de partida pequeño en el HUD | P2 | — | S | «ETAPA x / y», sin reloj | `tests/hud.test.js` ampliado |
| E1-09 | Tope de tiempo o enrage en la etapa de jefe y auto-elección de mejora en solitario tras un límite | P2 | — | S | Jefe sin tope; AFK en m2 congela 1480 s | Medición `idle` (`medicion-capitulos.mjs all idle`) termina en todas las semillas |
| E1-10 | Test de partida completa de campaña real (`campaign:true`), no solo modo libre | P2 | — | M | `tests/bots.test.js` cubre m1–m3 en modo libre | Prueba nueva basada en `medicion-capitulos.mjs` con asertos de victoria y duración |

**Evidencia exigida del sprint:** capturas del flujo en PC y móvil (emulación; no es dispositivo), salida de las pruebas, medición de duración, checklist de regresión (campaña, coop, cuentas). **PR:** uno por issue o grupo pequeño; no mezclar E1-06 con contenido.
**Riesgos:** el guion de E1-01 depende de una decisión de canon (D-C7); E1-05 puede chocar con el límite de triángulos si se agregan criaturas nuevas.

---

## Sprint 2 — Combate, audio, cámara y HUD (épica E2)

| Issue | Título sugerido | Prio | Depende de | Esf. | Hoy | Pruebas |
|---|---|---|---|---|---|---|
| E2-01 | **AC-07: sonido de impacto solo con colisión confirmada.** Corregir `combo-fx.js:134,170` (`near = hit \|\| C.ranged`) y agregar prueba de «atacar al aire no suena hit» (sim más `Sound` simulado) en 1.ª y 3.ª persona y coop | P1 | — | M | Riesgo sin prueba | Test (nuevo): 0 llamadas a `hit/comboHit/hitmark` en un ataque sin impacto |
| E2-02 | **Cámara 3.ª persona inicial** independiente del modo; Tab no fuerza la cámara | P2 | — | S | 1.ª en modo Disparo | `tests/camara.test.js` ampliado |
| E2-03 | **AC-05: conmutar 1.ª/3.ª en pleno combo, disparo o habilidad** sin cortarlos ni romper colisiones; transición suave | P2 | E2-02 | M | Conmutación instantánea; sin prueba | Test (nuevo) que conmuta durante un combo |
| E2-04 | **AC-06: prueba automática de solapamientos del HUD** en una matriz de viewports (móvil/escritorio) | P1 | E1-08 | M | `tools/check-clean-hud.mjs` y `check-four-action-hud.mjs` (3 tamaños) | Matriz de viewports sin solapamientos; dispositivo físico queda para Sprint 6 |
| E2-05 | Fijar el contrato **1 básico + 2 habilidades + ulti** y desbloqueo gradual | P2 | D-C5 | M | 4 acciones en HUD; 3 ranuras en datos | `tests/four-action-hud.test.js`, `tests/combos.test.js` |
| E2-06 | Animaciones propias de **Danzante** (8 golpes y habilidad) y ampliar `tests/combo-anim.test.js` a los 8 Huéspedes | P2 | — | M | `ANIM_GOLPE.danzante` ausente | El test exige 8 de 8 en los 8 Huéspedes |
| E2-07 | Audio propio de **Singular** (4 habilidades y golpe) y de **Colmena** (golpe, picaduras, Reina); sumar Singular a `hostfx.test.js` | P2 | — | M | Sonido por defecto | `tests/hostfx.test.js`; escucha humana pendiente |
| E2-08 | Minimapa y alertas contextuales: cola con prioridad; confirmar lectura en móvil | P3 | — | S | Minimapa implementado | `tests/tactical.test.js` |
| E2-09 | Accesibilidad básica: escala de texto, modo daltónico, contraste alto, remapeo | P2 | — | M | Solo `prefers-reduced-motion` y formas en minimapa | Opciones persistentes; prueba en navegador |
| E2-10 | Mejorar manos, armas y golpes melee en 1.ª persona | P2 | — | L | Calidad subjetiva sin aceptación | Capturas antes/después; criterio humano pendiente |

**Evidencia:** pruebas automáticas nuevas, capturas, lista de regresión de combate. **Riesgo:** la sensación de combate solo la valida un humano; no se declara «mejorada» con tests.

---

## Sprint 3 — Campaña y arenas (épica E3)

| Issue | Título sugerido | Prio | Depende de | Esf. | Hoy | Pruebas |
|---|---|---|---|---|---|---|
| E3-01 | Capítulos 2–6 a **8–12 min** (etapas, objetivos y números configurables en datos) | P1 | E1-05 | XL | Medianas con bots 0,70–2,44 min | `medicion-capitulos.mjs` por capítulo; humanos pendientes |
| E3-02 | **Jefe o desafío final en cada capítulo** (usar `argos`, `coloso`, `madre`; mecánicas ya existentes) | P1 | E3-01 | L | Solo capítulos 1 y 6 | Cada capítulo termina con un encuentro final; victoria y derrota inequívocas |
| E3-03 | Investigar y resolver **melé 0/3 en m4 (Cultivo) y m2 (Madre Geoda)**: test específico del golpe sobre capullos y de melé contra jefes | P2 | — | M | Causa no determinada (bot o diseño) | Test (nuevo) que prueba `damageObject → feedCapullo` con melé |
| E3-04 | Variaciones ambientales jugables por arena (anomalías, clima, visibilidad, rutas, zonas seguras) en las 6 arenas | P2 | — | L | `arenas-vivas.js`, `eventos.js`, `nieblas.js` ya existen | `tests/arenas-vivas.test.js`, `tests/eventos.test.js` |
| E3-05 | Aprovechar o recortar contenido muerto (`WAVE_PLANS` 4–6) y decidir el destino de las 5 clases heredadas | P2 | D-C3 | M | Inalcanzable en misiones | Inventario antes de borrar (GDD §15: no eliminar sin respaldo) |
| E3-06 | **Checkpoints narrativos** excepcionales y guardado entre etapas donde corresponda | P2 | E1-06 | M | Ausentes; guarda solo al completar capítulo | Prueba de salir y volver |
| E3-07 | Narrativa: 2–3 decisiones morales y finales alternativos (primera pasada controlada) | P2 | D-C7 | L | Un solo final | Prueba de ramificación de relato |
| E3-08 | Misiones secundarias no obligatorias (muestras, rescate de conciencias, recuerdos, secretos) | P3 | E3-01 | L | 5 mini-misiones de combate | `tests/metas.test.js` |
| E3-09 | Misiones independientes de 5–15 min con jefe y tipos nuevos (destrucción, expedición) | P2 | E3-02 | L | Solo 3 etapas sin jefe | `tests/mission-variety.test.js` |
| E3-10 | Cinemática o transición de cierre por capítulo y desbloqueo lineal verificado | P2 | E1-01 | M | Interludios de subtítulos | `tests/campaign-route.test.js`; recorrido sin inyección |

**Evidencia:** duración medida por capítulo (bots hoy; humanos en Sprint 6). **Regla GDD:** solo publicar capítulos terminados y aprobados.

---

## Sprint 4 — Cooperativo y resiliencia (épica E4)

| Issue | Título sugerido | Prio | Depende de | Esf. | Hoy | Pruebas |
|---|---|---|---|---|---|---|
| E4-01 | **Bots de producto** en el servidor: seguir, atacar cercano, revivir si es seguro, priorizar objetivo y evitar atascos | P1 | — | XL | `src/sim/bot.js` solo en pruebas | Sala de 2–4 completada con bots (nuevo); sin atascos |
| E4-02 | **Bot sustituto** del desconectado y recuperación de sesión y Huésped al volver, sin duplicados | P1 | E4-01 | L | Cuerpo inmóvil 45 s, luego se retira | Test de integración con reconexión (nuevo) |
| E4-03 | **Reenviar el resultado final** al reanudar y acreditar una sola vez | P0 | E1-06 | M | Repro que falla: `tools/audit/coop-resume-result.repro.js` | El repro pasa; se promueve a `tests/` |
| E4-04 | **Espectador** temporal y regreso limitado en frontera de oleada u objetivo | P1 | — | L | Revive ilimitado y automático | Prueba de límites de revivir |
| E4-05 | Reanimación con recursos y límite de usos | P2 | E4-04 | M | Solo tiempo de interacción | `tests/coop.test.js` ampliado (revivir) |
| E4-06 | **Jefes en coop** y misiones sueltas; escalado por 1–4 integrantes | P1 | E3-02 | L | Coop sin jefe | `tests/jefes-coop.test.js` |
| E4-07 | Botín personal con bono moderado por contribución y reglas anti-AFK | P2 | — | M | Botín por jugador, sin anti-AFK | Prueba de contribución (nuevo) |
| E4-08 | Caída simultánea, host desconectado y pérdida de paquetes: simulaciones de red | P1 | E4-02 | L | Latencia 200 ms probada con bots; sin pérdida | Simulador de red (nuevo) |
| E4-09 | Mensajes rápidos además del ping; HUD coop con retratos y alertas de caídos | P3 | — | M | Ping sí | `tests/coop.test.js` |
| E4-10 | Resolver `coop4` sin snapshots comunes (fallo conocido) | P1 | — | M | Fallo documentado en el informe de Bloque 0 | `tests/coop4.test.js` verde |

**Evidencia:** ensayo con clientes reales (al menos dos dispositivos en red externa) además de pruebas de integración. Render Free duerme a los 15 min: fijar el plan antes del ensayo.

---

## Sprint 5 — Progresión, colección y servidor de premios (épica E5)

| Issue | Título sugerido | Prio | Depende de | Esf. | Hoy | Pruebas |
|---|---|---|---|---|---|---|
| E5-01 | **`RewardsLedger` en servidor** con idempotencia por partida y jugador; el cliente deja de ser autoridad de premios | P0 | E1-06, cuentas | XL | Premios en el cliente | Tests de reintento y de cierre a mitad de `fin` |
| E5-02 | **Desbloqueo de Huéspedes** por campaña, desafíos, exploración y eventos (según D-C1, D-C3) | P1 | D-C1, D-C3, E3 | L | Solo compra con núcleos | Cada Huésped tiene una ruta de desbloqueo |
| E5-03 | Reordenar la tienda de núcleos (consumibles y cosméticos); quitar ventajas funcionales exclusivas | P1 | D-C1 | M | Vende Huéspedes, planos, botiquín | `tests/tienda.test.js`; AC-11 |
| E5-04 | **Cuenta y persistencia verificable**: base PostgreSQL contratada, migraciones y versionado del perfil | P1 | Aprobación de costo | L | Cuentas opcionales; `accounts.enabled=false` sin `DATABASE_URL` | Pruebas de migración (nuevo) |
| E5-05 | Progreso de **conciencia** compartido (mínimo) separado del progreso por Huésped | P2 | D-C13 | L | Solo `skillLevel` global | `tests/maestria.test.js`, `tests/progresion.test.js` |
| E5-06 | Rama evolutiva irreversible y definición exacta del **legado** antes de codificar | P3 | — | M | Evolución existe; legado ausente | Documento de reglas aprobado |
| E5-07 | **Códice mínimo** unificado (Huéspedes, habilidades, historia, modo de obtención) y logros iniciales persistentes | P2 | — | L | Códices parciales y trofeos | Pruebas de persistencia (nuevo) |
| E5-08 | **Telemetría** mínima con consentimiento: sesiones, tiempos, abandono, errores | P2 | Política de privacidad | M | Ausente | Eventos verificables en prueba |
| E5-09 | Recompensas parciales vs principales tras fracaso (definir qué es «principal») | P2 | E1-06 | S | Núcleos y botín se pagan al perder | `tools/audit/medicion-capitulos.mjs` |
| E5-10 | Bloquear el cambio de Huésped tras empezar la misión (C10) | P2 | — | S | Cambio entre oleadas | Prueba en `setLoadout` |

---

## Sprint 6 — QA, endurecimiento y salida (épica E6)

| Issue | Título sugerido | Prio | Depende de | Esf. | Pruebas / criterio de cierre |
|---|---|---|---|---|---|
| E6-01 | Pruebas E2E completas (sin inyección) del recorrido tutorial → capítulo → resultado → siguiente | P1 | Sprints 1–3 | L | Navegador real en CI |
| E6-02 | **Dispositivos reales**: iPhone/Safari y Android; FPS, memoria y temperatura en sesiones de 5/15/30 min | P1 | — | L | Informe con modelos y números medidos |
| E6-03 | **Rendimiento**: línea base con `tools/perf-browser.js`; fijar umbrales de FPS tras perfilar (el GDD prohíbe inventarlos) | P1 | E6-02 | M | Umbrales documentados con medición |
| E6-04 | **Seguridad**: `ALLOWED_ORIGINS` explícito, CSP/HSTS, validación del perfil respaldado, `npm audit`, escaneo de secretos en historial, quitar atajos `?horde`, `?wave`, `?god` del build de demo | P1 | — | M | Informe de seguridad |
| E6-05 | **Accesibilidad** verificada con personas y herramientas | P2 | E2-09 | M | Lista de comprobación firmada |
| E6-06 | **Simulación de 20 perfiles** sobre la versión candidata, claramente etiquetada ([20_PERSONAS_SIMULADAS.md](20_PERSONAS_SIMULADAS.md)) | P1 | Candidata | M | Matriz actualizada |
| E6-07 | **Testers humanos reales** (meta: 20 sesiones) con protocolo y consentimiento | P1 | Candidata | XL | Datos reales; hoy hay **cero** |
| E6-08 | Puntuación ponderada GDD §12 sustentada y recomendación go/no-go | P1 | E6-01…07 | M | [QA_MATRIX.md](QA_MATRIX.md) actualizada |
| E6-09 | Despliegue público **solo con autorización** del propietario y checklist cumplida | P1 | E6-08 | S | [DEMO_RELEASE_CHECKLIST.md](DEMO_RELEASE_CHECKLIST.md) completa |
| E6-10 | Notas de versión con vínculo verificable al despliegue | P2 | E6-09 | S | [RELEASE_NOTES.md](RELEASE_NOTES.md) |

---

## Dependencias críticas (resumen)

1. E0-01 y E0-02 antes de abrir PR grandes: sin CI verde no hay línea de regresión confiable.
2. E1-06 (ledger mínimo) antes de E4-03 y E5-01.
3. D-C7 (canon) antes del guion de E1-01 y de E3-07.
4. E1-05 y E3-01 antes de cualquier medición humana con sentido.
5. E4-01 antes de E4-02; E3-02 antes de E4-06.
6. Aprobación de costo de la base PostgreSQL antes de E5-04 y E5-01 completo.
7. Nada del Backlog Fase II ([FUTURE_BACKLOG.md](FUTURE_BACKLOG.md)) entra al Sprint 1–6 salvo decisión expresa.

## Pruebas por sprint (comandos reales de hoy)

| Sprint | Comandos existentes | Pruebas por crear |
|---|---|---|
| 1 | `node --test tests/campaign-route.test.js tests/operations.test.js tests/prologo.test.js tests/waves.test.js`; `node tools/audit/medicion-capitulos.mjs all all 1,2,3 salida.jsonl`; `node tools/audit/guardado-test.mjs` | Ledger idempotente, flujo del tutorial, resultados, partida de campaña real |
| 2 | `node tools/check-clean-hud.mjs`; `node tools/check-four-action-hud.mjs`; `node --test tests/camara.test.js tests/combo-anim.test.js tests/hostfx.test.js` | Hit al aire, conmutación de cámara en combo, solapamientos por viewport |
| 3 | `node tools/audit/medicion-capitulos.mjs …`; `node tools/check-campaign.mjs` (necesita Chromium) | Melé sobre capullos y jefes, duración por capítulo |
| 4 | `npm run coop:test`; `npm run coop:navegador`; `node --test tools/audit/coop-resume-result.repro.js` | Bots de producto, bot sustituto, espectador, pérdida de paquetes |
| 5 | `node --test tests/tienda.test.js tests/maestria.test.js` | Ledger de servidor, migraciones, códice, telemetría |
| 6 | `npm test` completo en CI; `npm run bench` | E2E, dispositivos, seguridad, 20 perfiles, humanos |

## Qué NO está en este plan

Los sistemas de la Fase II (editor anatómico, genética, simbiontes, facciones, temporadas, tienda cosmética con cobro, comercio, matchmaking, chat, modo infinito) están en [FUTURE_BACKLOG.md](FUTURE_BACKLOG.md). No bloquean la demo (GDD §16).
