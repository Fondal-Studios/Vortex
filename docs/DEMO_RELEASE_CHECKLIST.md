# VORTEX — DEMO_RELEASE_CHECKLIST (lista de salida de la demo pública)

> **Estado del documento**
> - Versión: 0.1 · Fecha: 2026-10-24 · Responsable: Claude (estudio)
> - SHA base: `62244b61eaecff34ba539fc4018456172579bf03` (rama canónica `claude/larga-con-eso-s43nfe`) · Rama de trabajo `claude/vortex-fase0-sprint1` @ `d009eec` · Archivo **sin commitear**
> - **Veredicto actual: NO-GO provisional** (puntaje 45,6/100 frente a 80 exigido; ver [QA_MATRIX.md](QA_MATRIX.md) §3). Es un juicio de auditoría, no un playtest.
> - Regla de marcado: una casilla solo se marca `[x]` si hay evidencia citada en la misma fila. Todo lo demás queda `[ ]`. **Marcar una casilla no equivale a «Desplegado» ni a «Aprobado por el propietario».**
> - Niveles: Diseñado · Implementado · Probado · Mergeado · Desplegado (véase [AUDIT.md](AUDIT.md)).
> - Hermanos: [GDD.md](GDD.md) §13 y §16 · [ROADMAP.md](ROADMAP.md) · [20_PERSONAS_SIMULADAS.md](20_PERSONAS_SIMULADAS.md) · [RELEASE_NOTES.md](RELEASE_NOTES.md)

## 1. Puertas críticas (todas obligatorias, sin excepciones)

Si una sola está sin marcar, la respuesta es NO-GO. Origen: GDD §12, §13 (AC-12) y §16.

- [ ] **P-1. Cero P0 y cero P1 abiertos.** Hoy hay P0 (premios y progreso sin ledger; guardado silencioso) y varios P1 ([AUDIT.md](AUDIT.md) §8).
- [ ] **P-2. Puntaje ponderado >= 80/100 sustentado con evidencia.** Hoy 45,6 provisional ([QA_MATRIX.md](QA_MATRIX.md) §3).
- [ ] **P-3. AC-01 a AC-12 cumplidos con evidencia.** Hoy ninguno está en «Cumple» ([QA_MATRIX.md](QA_MATRIX.md) §2).
- [ ] **P-4. Simulación de 20 perfiles etiquetada sobre la versión candidata.** Existe una matriz sobre el SHA base ([20_PERSONAS_SIMULADAS.md](20_PERSONAS_SIMULADAS.md)); falta repetirla sobre la candidata.
- [ ] **P-5. Testers humanos reales.** Hoy: **cero sesiones**. Meta del GDD: 20. Prohibido afirmar playtesting humano no realizado.
- [ ] **P-6. Pruebas en dispositivos objetivo** (iPhone/Safari, Android, escritorio; FPS, memoria, sesiones de 5/15/30 min). Hoy: ninguna en dispositivo físico.
- [ ] **P-7. Seguridad revisada** (origen permitido, CSP/HSTS, perfil respaldado, `npm audit`, escaneo de secretos en historial, atajos de depuración retirados). Hoy: brechas P1 abiertas.
- [ ] **P-8. Despliegue público autorizado expresamente por el propietario** y criterios cumplidos (GDD §11 Sprint 6 y §15). Hoy Pages y Render publican sin compuerta.

## 2. Verificado hoy (única sección con casillas marcadas)

- [x] Repositorio oficial y rama canónica identificados con SHA: `claude/larga-con-eso-s43nfe` @ `62244b61eaecff34ba539fc4018456172579bf03` (`git rev-parse 62244b6`; remoto `origin` = `Fondal-Studios/vortex`).
- [x] Los 14 PR previos (#1–#14) están fusionados y ninguno está abierto (consulta a GitHub de la sesión de auditoría, 2026-10-24).
- [x] Hay exactamente 8 Huéspedes reales y se inventariaron (`HOST_IDS`; [audit/INVENTARIO_HUESPEDES.md](audit/INVENTARIO_HUESPEDES.md)).
- [x] Presupuesto gráfico Low de los 8 Huéspedes dentro del límite: `node --test tests/huesped-cuerpo.test.js`, 2 pass, 0 fail, 409,7 s.
- [x] Seis arenas y orden de campaña identificados desde el código (`CAMPAIGN_ORDER` = m1, m3, m4, m5, m6, m2; [AUDIT.md](AUDIT.md) §5.1).
- [x] No se halló misión ni campaña con oleadas infinitas (lectura y 54 partidas con bots terminaron; [audit/MATRIZ_GAPS.md](audit/MATRIZ_GAPS.md) §2).
- [x] No existen comercio entre jugadores, cobros ni moneda premium (grep de la auditoría; [COSMETIC_COMMERCE.md](COSMETIC_COMMERCE.md)). Cumple lo literal de AC-11; la tienda de núcleos sigue pendiente de decisión.
- [x] `node --check src/sim/game.js` y `node --check server/server.js` sin errores (2026-10-24).
- [x] GitHub Pages publica en cada push a la rama canónica y la última publicación fue exitosa (consulta de la sesión). **Esto describe el estado actual del despliegue; no autoriza ni aprueba ninguna demo.**
- [x] Los 8 documentos operativos de la Fase 0 existen en `docs/` (sin commitear al escribir esta lista).

## 3. Producto y contenido (GDD §2.1, §3, §4)

- [ ] Capítulo 1 llamado «Islas — Despertar». Hoy: «Refugio de la conciencia».
- [ ] Cinemática de transferencia de 20–30 s (reemplaza el tren). Hoy: ausente; stub en `prologo.js`.
- [ ] Tutorial jugable de ~3 min integrado. Hoy: tarjeta modal de texto.
- [ ] Un Huésped inicial único y el resto desbloqueable por campaña, desafíos, exploración o eventos. Hoy: 3 iniciales y 5 de tienda por núcleos.
- [ ] Capítulos publicados con 8–12 min medidos. Hoy: 0,70–2,44 min de mediana con bots; sin datos humanos.
- [ ] Solo se publican capítulos terminados y aprobados (el plan completo sigue siendo seis).
- [ ] Encuentro final por capítulo publicado. Hoy: solo capítulos 1 y 6.
- [ ] Cada capítulo con inicio, objetivos, final inequívoco y desbloqueo del siguiente probado sin inyección (AC-03, AC-10).
- [ ] Contador «Oleada X/Y» y reloj pequeño en el HUD. Hoy: «ETAPA x / y», sin reloj.
- [ ] Pantalla de resultados con victoria/derrota, X/Y, tiempos, objetivos, estadísticas, XP, botín y desbloqueos; botones Reintentar y Menú. Hoy: texto plano.
- [ ] Derrota con reinicio por defecto y recompensas parciales claras; recompensas principales solo por victoria. Hoy: núcleos y botín se pagan al perder.
- [ ] Todos los Huéspedes incluidos con carga, ataques, habilidad y animaciones mínimas (AC-04): decidir si Danzante, Singular y Colmena entran o se completan.
- [ ] Menú sin base 3D obligatoria; Santuario opcional u oculto (decisión C2).

## 4. Combate, cámara, HUD y audio (AC-05, AC-06, AC-07)

- [ ] Sonido de impacto solo con colisión confirmada, con prueba automática (AC-07).
- [ ] Cambio 1.ª/3.ª persona sin cortar combos, disparos ni habilidades; 3.ª inicial (AC-05).
- [ ] HUD móvil y escritorio sin solapamientos en una matriz de viewports (AC-06) y en dispositivo.
- [ ] Contrato de combate fijado: 1 básico + 2 habilidades + 1 definitiva (decisión C5).
- [ ] Audio y animación propios o decisión documentada para Danzante, Singular y Colmena.
- [ ] Opciones de accesibilidad mínimas (daltonismo, escala de texto, contraste, remapeo) o excepción justificada.

## 5. Cooperativo y red (AC-08)

- [ ] Salas con código, entrada, salida, caída, reanimación y resultados ensayados con clientes reales (AC-08).
- [ ] Bots opcionales de producto (seguir, atacar, reanimar). Hoy: ausentes.
- [ ] Bot sustituto del desconectado y recuperación de sesión y Huésped. Hoy: cuerpo inmóvil 45 s.
- [ ] Resultado final reenviado al reanudar (repro `tools/audit/coop-resume-result.repro.js` pasa). Hoy: falla.
- [ ] Espectador temporal y retorno limitado.
- [ ] `tests/coop4.test.js` en verde. Hoy: fallo conocido.
- [ ] Jefes escalados para 1–4 jugadores y vencibles solo o en coop.

## 6. Progreso, persistencia y economía (AC-09, AC-11)

- [ ] Ledger idempotente: tres cierres de la misma partida acreditan una vez. Hoy: 900 núcleos en vez de 300 (`tools/audit/guardado-test.mjs`).
- [ ] Aviso al usuario si el guardado falla (V01). Hoy: falla en silencio.
- [ ] Progreso y recompensas sobreviven cierre y reapertura (AC-09).
- [ ] Cuenta y persistencia verificables en servidor (base contratada, migraciones).
- [ ] Códice mínimo y logros iniciales.
- [ ] Tienda: decisión sobre Huéspedes y ventajas por núcleos; nada funcional exclusivo por dinero (AC-11).
- [ ] Sin comercio ni subastas en la demo (ya cumple lo literal, ver §2).

## 7. Calidad, rendimiento y seguridad

- [ ] `npm test` en verde en CI. Hoy: run `40056119035` con 809 tests, 734 pass, 9 fail, 66 skipped; local: `arsenal` falla; la corrida completa quedó invalidada por ediciones ajenas en el árbol y debe repetirse sobre un árbol limpio.
- [ ] Tests de navegador obligatorios en CI (sin omisión silenciosa).
- [ ] Línea base de rendimiento con `npm run bench` y umbrales fijados tras perfilar (no inventados).
- [ ] Memoria y temperatura en sesiones de 5/15/30 min en dispositivo.
- [ ] Sin WebGL: aviso útil en lugar de título inerte (V04).
- [ ] `ALLOWED_ORIGINS` explícito en Render; CSP/HSTS; perfil respaldado validado.
- [ ] `npm audit` y escaneo de secretos del historial ejecutados.
- [ ] Atajos `?horde`, `?wave`, `?god`, `?auto`, `?bot` fuera del build de demo.
- [ ] Telemetría mínima con consentimiento (o decisión de no tenerla).

## 8. Despliegue y publicación

- [ ] Compuerta de CI antes de Pages (`needs`) y despliegue manual en Render (decisión C15).
- [ ] Rama de publicación única y documentada (`main` está atrasada en `94280a5`).
- [ ] Nombre de servicio de Render conciliado (`arcanum-coop` en `render.yaml` frente a `shower-psico-coop` en docs).
- [ ] Base PostgreSQL de cuentas aprobada y configurada (`DATABASE_URL`), o cuentas desactivadas en la demo y comunicado.
- [ ] Enlace verificable a la versión desplegada anotado en [RELEASE_NOTES.md](RELEASE_NOTES.md). Hoy: no hay etiquetas ni releases en el repo local (`git tag` vacío) y no se verificó una URL pública.
- [ ] Autorización expresa del propietario para activar el despliegue público (puerta P-8).

## 9. Decisiones del propietario pendientes que bloquean la salida

C1 tienda con núcleos · C2 Santuario · C3 Huésped inicial · C5 esquema de combate · C7 canon biológico o sintético · C15 política de despliegue. Detalle en [GDD.md](GDD.md), Parte C.

## 10. Firma de salida (se llena solo al cumplir las puertas)

| Campo | Valor |
|---|---|
| Versión candidata | (sin definir) |
| SHA | (sin definir) |
| Puntaje final y fecha | (pendiente) |
| Evidencias enlazadas | (pendiente) |
| Decisión GO / NO-GO | **NO-GO provisional** (2026-10-24) |
| Autorizado por el propietario | (pendiente) |
