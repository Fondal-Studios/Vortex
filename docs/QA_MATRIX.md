# VORTEX — QA_MATRIX (matriz de pruebas, criterios AC-01…AC-12 y puntaje provisional)

> **Estado del documento**
> - Versión: 0.1 (línea base de la Fase 0) · Fecha: 2026-10-24
> - SHA base: `62244b61eaecff34ba539fc4018456172579bf03` (rama canónica `claude/larga-con-eso-s43nfe`) · Rama de trabajo `claude/vortex-fase0-sprint1` @ `d009eec` · Archivo **sin commitear**
> - Responsable: Claude (estudio)
> - Niveles: **Diseñado** (el criterio está en el GDD §13) · **Implementado** (código leído) · **Probado** (hay una ejecución citada) · **Mergeado** · **Desplegado**. Esta matriz distingue además **Ejecutada** (se corrió en la Fase 0 y se cita el resultado) y **No ejecutada** (existe o falta, pero no se corrió para este documento).
> - Fuentes: [GDD.md](GDD.md) §12–13 · [audit/MATRIZ_GAPS.md](audit/MATRIZ_GAPS.md) §4 · [audit/MEDICION_CAPITULOS.md](audit/MEDICION_CAPITULOS.md) · [audit/INVENTARIO_HUESPEDES.md](audit/INVENTARIO_HUESPEDES.md) · [VORTEX_QA_REPORT.md](VORTEX_QA_REPORT.md) · [VORTEX_SCORECARD.md](VORTEX_SCORECARD.md)
> - Hermanos: [AUDIT.md](AUDIT.md) · [ROADMAP.md](ROADMAP.md) · [20_PERSONAS_SIMULADAS.md](20_PERSONAS_SIMULADAS.md) · [DEMO_RELEASE_CHECKLIST.md](DEMO_RELEASE_CHECKLIST.md)

## 0. Veredicto provisional

**NO-GO provisional.** Puntaje ponderado actual: **45,6 / 100** (mínimo exigido: 80). Hay riesgos P0 y P1 abiertos, la CI está en rojo y no existe ningún dato de personas reales. Este veredicto es un **juicio de auditoría con evidencia técnica**, no un playtest humano. Detalle en §3 y plan correctivo en §6.

## 1. Evidencia ejecutada en la Fase 0 (todo lo demás es «No ejecutada»)

| Ejecución | Resultado | Fuente |
|---|---|---|
| `timeout 600 node --test tests/huesped-cuerpo.test.js` | exit 0; 2 pass, 0 fail; 409,7 s | [audit/INVENTARIO_HUESPEDES.md](audit/INVENTARIO_HUESPEDES.md) §2.2 |
| `node tools/audit/medicion-capitulos.mjs all all 1,2,3 …` | 54 partidas con bots; 0 timeouts a 25 min; medianas de victoria 0,70–2,44 min; melé 0/3 en m4 y m2 | [audit/MEDICION_CAPITULOS.md](audit/MEDICION_CAPITULOS.md) |
| `node tools/audit/medicion-capitulos.mjs all idle 1,2,3 …` | 2 de 3 semillas de m2 con jugador AFK quedaron congeladas 25 min en «elegir mejora» | ídem §2, P2-3 |
| `node tools/audit/guardado-test.mjs` | V03 vigente (3 cierres = 900 núcleos), V01 vigente (falla sin avisar), V08 corregido | ídem §6 |
| `node --test tests/campaign-route.test.js tests/operations.test.js tests/prologo.test.js` | 4+5+2 OK | ídem §0 |
| `node --check src/sim/game.js`, `node --check server/server.js` | OK (2026-10-24) | este documento |
| `npm test` completo local | **Invalidado** por ediciones ajenas concurrentes en el árbol (suites que fallan al importar por un export faltante en `eventos.js`). Solo es citable el `not ok` visto antes: `tests/arsenal.test.js` «personajes: 10 (5 Huéspedes + 5 veteranos)…» (espera 10, hay 13). PENDIENTE: ver log; repetir sobre árbol limpio | `/tmp/claude-0/vortex-npmtest.log` |
| CI de GitHub, run `40056119035` | 809 tests, 734 pass, **9 fail**, 66 skipped | Consulta de la sesión de auditoría (no re-consultada por este agente) |
| Sprint 1-D (24-oct): arreglo de los 9 rojos del CI, CI en `unit`+`browser`, compuerta de Pages, AC-07 | Pruebas individuales verdes tras el arreglo: `arsenal`, `colmena`, `estilos`, `huespedes`, `inventario` (parte de equilibrio), `limbo-mapas`, `map4`, `mundo-cliente`, `impacto` (8 nuevas), `server-origenes` (2 nuevas). **`npm run test:ci` completo NO se corrió** y el CI real de GitHub **no se ha visto** (solo se ve tras un push). | docs/OPERATIONS.md (sección Sprint 1-D) |

## 2. Matriz de criterios de aceptación AC-01…AC-12

Estado: Cumple / Parcial / No cumple / No verificable. **Ningún AC está en «Cumple».** Columna «Ejec.»: Sí = hay una ejecución de Fase 0 relacionada (§1); No = ninguna.

| AC | Criterio (GDD §13) | Estado actual | Evidencia | Prueba automática existente | Prueba faltante | Ejec. |
|---|---|---|---|---|---|---|
| AC-01 | Repositorio, rama y estado reales inventariados | **Parcial** | [AUDIT.md](AUDIT.md) §1: repo, SHA, rama canónica, PR, CI y Pages con evidencia | n/a (documental) | Un `AUDIT.md` vivo y limpieza de nombres heredados (README, `render.yaml`) | Sí (git) |
| AC-02 | Misión finita termina tras X/Y oleadas y objetivo final | **Parcial** | 54/54 partidas con bots terminan; no hay misión infinita ([AUDIT.md](AUDIT.md) §5.3); AFK en m2 no concluye (P2-3); jefe sin tope | `tests/waves.test.js`, `tests/operations.test.js`, `tests/mission-network.test.js` | Contador «Oleada X/Y»; tope de jefe; prueba AFK; prueba por modo (solo/coop/campaña) | Sí (bots) |
| AC-03 | Tutorial → combate → victoria/derrota → recompensas → siguiente capítulo | **Parcial** | Combate → resultado → recompensa → siguiente: leído; el navegador **inyectó** victorias ([CAMPAIGN_AUDIT.md](CAMPAIGN_AUDIT.md)); tutorial jugable **ausente** | `tests/campaign-route.test.js` (4 OK), `tools/check-campaign.mjs` (necesita Chromium) | Tutorial; E2E sin inyección; cinemática | Sí (parcial, sim) |
| AC-04 | Huéspedes inventariados con carga, ataques, habilidad y animaciones mínimas | **Parcial** | 8 Huéspedes; 5 pasan, 3 con reservas (Danzante sin animación propia; Singular y Colmena sin audio propio) | `tests/huesped-cuerpo.test.js` (ejecutado, OK), `tests/huespedes.test.js`, `tests/combo-anim.test.js` (solo exige 5 de 8) | Ampliar `combo-anim.test.js` a los 8; `hostfx.test.js` con Singular; `arsenal.test.js` roto | Sí (presupuesto) |
| AC-05 | Cambio 1.ª/3.ª sin bloquear control ni romper colisiones | **Parcial** | Botón, tecla P y colisión de cámara en 3.ª; conmutación instantánea; la 3.ª es inicial solo en Melé | `tests/camara.test.js` (solo `up` del snapshot) | Conmutar en pleno combo, disparo y habilidad; 3.ª por defecto | No |
| AC-06 | HUD móvil/escritorio sin solapamientos | **No verificable** | Validado en 3 tamaños de Chromium (informes previos); sin dispositivo; sin reloj de partida | `tests/hud.test.js`, `tests/hud-safe-point.test.js`, `tests/four-action-hud.test.js`; `tools/check-clean-hud.mjs` | Matriz de viewports automática; iPhone/Android físicos | No |
| AC-07 | Sonido de impacto solo con colisión confirmada | **Parcial (riesgo)** | Cadena `hit` correcta; falla potencial en `combo-fx.js:134,170` (`near = hit \|\| C.ranged`) | Ninguna (`tools/audio-combatfx-test.js` solo mide que la síntesis no sea muda) | Test «atacar al aire no suena hit» en 1.ª, 3.ª y coop | No |
| AC-08 | Coop 1–4: sala/código, entrada, salida, caída, bot, reconexión, resultados | **Parcial** | Salas y códigos, 4 bots WebSocket a 200 ms; sin bots de producto; resultado no se reenvía al reanudar (repro que falla); sin espectador | `tests/coop.test.js`, `tests/coop4.test.js` (fallo conocido de snapshots), `tests/coop-browser.test.js` (se omite sin Chromium), `tools/audit/coop-resume-result.repro.js` (**falla**) | Bots, bot sustituto, espectador, caída simultánea, host caído, pérdida de paquetes, clientes reales | No |
| AC-09 | Progreso y recompensas sobreviven cierre/reapertura; ledger evita duplicación | **No cumple** | Persistencia local sí; ledger **ausente**; 3 cierres = 900 núcleos; guardado falla sin avisar | `tests/perfil-currency.test.js` (V08) | Ledger de servidor; test de idempotencia; test de almacenamiento lleno | Sí (`guardado-test.mjs`) |
| AC-10 | Capítulos con inicio, objetivos, final y duración medida; sin bloqueo por secundarios | **Parcial** | Duración medida **solo con bots**: 0,70–2,44 min (meta 8–12); capítulos 2–5 sin jefe | `tools/audit/medicion-capitulos.mjs` | Duración con humanos; capítulos de 8–12 min; final por capítulo | Sí (bots) |
| AC-11 | No comercio en demo; nada funcional exclusivo por dinero | **Parcial (cumple lo literal)** | Sin comercio, cobros ni moneda premium; pero la tienda de núcleos vende Huéspedes y ventajas | `tests/tienda.test.js` | Decisión D-C1; prueba de que lo funcional no se vende por dinero | No |
| AC-12 | Sin P0/P1; >= 80/100 sustentada; 20 perfiles simulados etiquetados; go/no-go | **No cumple** | Puntaje 45,6 (§3); P0/P1 abiertos ([AUDIT.md](AUDIT.md) §8); matriz de 20 perfiles etiquetada en [20_PERSONAS_SIMULADAS.md](20_PERSONAS_SIMULADAS.md) | n/a | Humanos reales, dispositivos, nueva matriz sobre la candidata | Sí (esta matriz) |

## 3. Puntaje ponderado ACTUAL (provisional) sobre 100

**Método.** Pesos del GDD §12. Cada área se califica de 0 a 10 y se multiplica por peso/10. **Todos los subpuntajes son un juicio de auditoría** que se apoya en la evidencia citada; **no hay playtest humano, no hay dispositivos reales y el audio no se escuchó.** Las calificaciones de áreas que dependen de percepción (jugabilidad, UX, arte/audio) son especialmente inciertas y tienen confianza baja. El puntaje de la scorecard previa ([VORTEX_SCORECARD.md](VORTEX_SCORECARD.md): 60,95) usa otros pesos y fue una nota editorial anterior a esta auditoría: **no es comparable** y no debe mezclarse con este.

| Área | Peso | Nota 0–10 | Aporte | Justificación (juicio de auditoría) | Confianza |
|---|---:|---:|---:|---|---|
| Jugabilidad | 20 | 5,0 | 10,0 | El bucle de campaña funciona de punta a punta en simulación (54/54 partidas con bots terminan), con 8 Huéspedes y dos estilos. Resta: capítulos de ~1–2 min frente a 8–12, melé sin victorias en m4 y m2, ningún dato de diversión humana | Baja |
| Claridad / onboarding | 12 | 3,0 | 3,6 | No hay cinemática de transferencia ni tutorial jugable; solo una tarjeta modal de controles y avisos de habilidad. El resto se aprende jugando el primer capítulo. Vocabulario y capas denunciadas por los informes previos | Media |
| Estabilidad / errores | 15 | 4,0 | 6,0 | La simulación no se cuelga con bots, pero: CI roja (9 fallos de 809), riesgo P0 de premios duplicados y guardado que falla sin avisar, WebGL fallido deja el título inerte (informe previo), AFK sin conclusión | Media |
| Cooperativo / redes | 12 | 4,5 | 5,4 | Salas privadas con código, hasta 4, servidor autoritativo, 4 bots WebSocket a 200 ms. Resta: sin bots de producto ni sustituto, sin espectador, resultado no reenviado al reanudar, `coop4` con fallo conocido, sin ensayo con clientes reales | Media |
| Combate / balance | 12 | 5,5 | 6,6 | Melé y Disparo con combos por Huésped y 8 Huéspedes con datos. Resta: riesgo de falso impacto sonoro (AC-07), melé 0/3 en m4 y m2, tacto no medido, `balance` de Vesper rojo según informes previos | Baja |
| Rendimiento / dispositivos | 10 | 4,0 | 4,0 | Presupuesto de dibujo Low medido para los 8 Huéspedes (peor caso 35 llamadas y 19 556 triángulos; Seraf al 98 % del tope). No hay FPS reales ni dispositivo alguno; la medición es de una escena con un solo Huésped | Media |
| UX / UI | 8 | 5,5 | 4,4 | HUD de cuatro acciones, minimapa con formas, retrato y vida abajo, controles táctiles. Resta: sin reloj, «ETAPA» en vez de «Oleada», resultados en texto plano, sin accesibilidad avanzada, sin validación en dispositivo | Baja |
| Narrativa | 5 | 5,0 | 2,5 | Canon de «La última conciencia humana», seis capítulos con contexto, tarea y cierre. Resta: sin cinemática, sin decisiones morales ni finales alternativos, canon biológico/sintético sin resolver | Media |
| Arte / audio | 4 | 5,0 | 2,0 | Arte propio para 8 Huéspedes con cuerpo unificado y presupuesto cumplido. Resta: audio sintetizado que nadie escuchó, 3 Huéspedes con reservas, sin música adaptativa verificada | Baja |
| Retención ética | 2 | 5,5 | 1,1 | Sin cobros, sin p2w, sin conexión diaria obligatoria. Resta: tienda con ventajas funcionales por núcleos, sin telemetría ética ni logros persistentes | Media |
| **Total** | **100** | | **45,6** | Suma: 10,0 + 3,6 + 6,0 + 5,4 + 6,6 + 4,0 + 4,4 + 2,5 + 2,0 + 1,1 | |

Intervalo de incertidumbre razonable: el puntaje podría moverse unos pocos puntos con una auditoría distinta, pero no cruzaría 80 sin trabajo de producto: sumar los 34,4 puntos faltantes exige, como mínimo, completar el onboarding, la estabilidad (CI y premios) y la cooperación con bots, y medir en dispositivos. Es una afirmación de orden de magnitud, no un cálculo.

## 4. Matrices por dimensión

### 4.1 Dispositivos objetivo

El GDD no enumera dispositivos. Se propone la siguiente lista, **a confirmar por el propietario**; hoy no hay prueba en ninguno.

| Dispositivo / navegador | Estado | Ejec. |
|---|---|---|
| Escritorio: Chrome o Edge reciente, 1280×800 | Pruebas de HUD en Chromium en tres tamaños (informes previos) | No (hoy) |
| Escritorio: Firefox / Safari | **No verificado** | No |
| iPhone con Safari (propuesto iPhone 13 Pro por [VORTEX_ROADMAP.md](VORTEX_ROADMAP.md)) | **No verificado**: emulación Chromium no equivale a iPhone | No |
| Android de gama media con Chrome | **No verificado** | No |
| Tableta | **No verificado** | No |
| Sin WebGL | El título queda inerte según el informe previo (V04); sin aviso | No |

### 4.2 Accesibilidad

| Comprobación | Estado | Ejec. |
|---|---|---|
| Movimiento reducido (`prefers-reduced-motion`, `reduced()`) | Implementado | No |
| Subtítulos del Heraldo | Implementado; avanzan por tiempo fijo, sin avance manual | No |
| No depender solo del color (minimapa con formas) | Implementado | No |
| Asistencia de puntería y controles simplificados | Implementado (`assistAim`/`simpleAssist`) | No |
| Modo daltónico, escala de texto, contraste alto, remapeo | **Ausente** | No |
| Lector de pantalla, navegación por teclado del menú | **No verificado** | No |

### 4.3 Rendimiento

| Comprobación | Estado | Ejec. |
|---|---|---|
| Presupuesto de dibujo Low por Huésped (<= 45 llamadas, <= 20 000 triángulos) | OK en los 8 | Sí |
| Escena con arena y criaturas, no solo un Huésped | **No verificado** | No |
| FPS y memoria en dispositivo; sesiones de 5/15/30 min | **No verificado** | No |
| Banco de rendimiento (`npm run bench`, `tools/perf-browser.js`) | Existe; **no se ejecutó** | No |
| Umbrales de FPS, latencia y fallos | No se fijan hasta perfilar hardware y red (GDD §12) | n/a |
| Tamaño del paquete estático | 48,4 MB informados en el Bloque 0 (no re-medido) | No |

### 4.4 Seguridad

| Comprobación | Estado | Ejec. |
|---|---|---|
| Límites de red: `maxPayload` 8192, tope de mensajes por segundo, límite por IP y de salas, saneo de nombres y carga | Implementado (leído) | No |
| Cuentas: scrypt, cookie HttpOnly/SameSite, CSRF por cabecera, límite 96 KiB | Implementado (leído) | No |
| `ALLOWED_ORIGINS` vacío = cualquier origen; sin CSP/HSTS/X-Frame | **Brecha** (P1) | No |
| Perfil respaldado como JSON libre; progreso decidido por el cliente | **Brecha** (P0/P1) | No |
| `npm audit`; escaneo de secretos en el historial | **No ejecutado** | No |
| Patrones de secretos en `src server tools public` | Sin coincidencias (grep de Fase 0, según MATRIZ_GAPS) | Sí (grep) |
| Atajos `?horde`, `?wave`, `?god`, `?auto`, `?bot` accesibles por URL | **Brecha** (P3) | No |

### 4.5 Cooperativo

| Comprobación | Estado | Ejec. |
|---|---|---|
| Crear sala con código y unirse | Implementado; pruebas con bots | No |
| Entrada y salida de jugadores | Implementado | No |
| Caída (derribo) y reanimación | Implementado; sin espectador | No |
| Bot sustituto | **Ausente** | No |
| Reconexión (gracia de 45 s, token) | Parcial; el cuerpo queda inmóvil | No |
| Resultado final al reanudar | **Falla** (repro) | No |
| 4 clientes a 200 ms | `coop4` con fallo conocido | No |
| Caída simultánea, host caído, pérdida de paquetes | **No verificado** | No |
| Sesión con clientes reales en red externa | **No verificado** | No |

### 4.6 Regresión

| Suite | Contenido | Ejec. |
|---|---|---|
| `npm test` (96 archivos en `tests/`) | Suite completa; la CI la corre en ~15 min | Local invalidada (PENDIENTE: ver log); CI: 9 fallos |
| `npm run test:fast` | Armas, física, IA, oleadas, límites | No |
| `npm run coop:test`, `npm run coop:navegador` | Coop | No |
| `tests/e2e.test.js`, `tests/coop-browser.test.js` | Navegador; se omiten solos sin `/opt/pw-browsers` (66 omitidos en CI) | No |
| `tools/check-*.mjs` | HUD, campaña, operaciones, canon de historia, identidad (necesitan Chromium) | No |

Checklist de regresión por PR (propuesta): `npm test` en verde; `node --check` de lo tocado; campaña (`tests/campaign-route.test.js`); coop (`npm run coop:test`); cuentas; `node tools/build-static.js` sin error; capturas del flujo cambiado.

## 5. Fallos conocidos de la suite

Ver [AUDIT.md](AUDIT.md) §6.2. Resumen: `tests/arsenal.test.js` (espera 10 personajes, hay 13) visto en la corrida local antes de que se contaminara; pendientes los otros 8 de la CI (nombres sin obtener); documentados en informes previos: enemigo rezagado, balance legendario Vesper melé y `coop4`. No se atribuye ninguno a un cambio de esta fase: no se tocó código del juego.

## 6. Plan correctivo hacia el GO

| Orden | Acción | Cierra | Referencia |
|---|---|---|---|
| 1 | CI en verde y compuerta de despliegue | Estabilidad; P1 de despliegue | E0-01, E0-02 |
| 2 | Ledger idempotente de premios y aviso de guardado fallido | AC-09; P0 | E1-06, E5-01 |
| 3 | Cinemática de transferencia, tutorial jugable, capítulo 1 «Islas — Despertar» de 8–12 min | AC-03, AC-10; onboarding | E1-01, E1-02, E1-05 |
| 4 | Sonido de impacto solo con colisión, con prueba | AC-07 | E2-01 |
| 5 | HUD sin solapamientos en matriz de viewports y cámara estable | AC-05, AC-06 | E2-03, E2-04 |
| 6 | Capítulos 2–6 a 8–12 min con encuentro final | AC-10 | E3-01, E3-02 |
| 7 | Coop con bots, sustituto, espectador y resultado al reanudar | AC-08 | E4-01…E4-04 |
| 8 | Desbloqueos de Huéspedes sin compra, decisión de tienda | AC-11 | E5-02, E5-03 |
| 9 | Dispositivos reales, seguridad, 20 perfiles y humanos | AC-12 | E6-02…E6-07 |
| 10 | Recalcular el puntaje con evidencia nueva y decidir | AC-12 | E6-08 |

Condición de salida (GDD §12 y §16): cero P0/P1, puntaje >= 80/100 sustentado con evidencia, AC-01…AC-12 cumplidos, simulación de 20 perfiles etiquetada, sesiones humanas reales y despliegue autorizado. Lista de control en [DEMO_RELEASE_CHECKLIST.md](DEMO_RELEASE_CHECKLIST.md).
