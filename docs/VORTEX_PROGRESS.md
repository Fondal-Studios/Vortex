# VORTEX — Control de producción recuperable

## Estado al cerrar el Bloque 0
- Repositorio: drmarianojimenez94-sudo/Shower-psico.
- Base examinada: 9b7d54aee532e2a210ca0359ec79cf9a3ae45efa.
- Rama default/desplegada: claude/larga-con-eso-s43nfe. main apuntaba al mismo SHA al consultar.
- Rama de trabajo: codex/vortex-block0-audit.
- Auditoría inicial realizada con límites explícitos; validación jugable/hardware pendiente.
- Seis documentos de control creados. AUDIT contiene top 20 y diez mejoras; SCORECARD notas y críticos; ROADMAP bloques; QA pruebas; DECISIONS junta.

## Implementado en rama
1. Normalización de núcleos cargados: evita concatenación y saldos inválidos. src/client/perfil.js + tests/perfil-currency.test.js.
2. Recompensa de munición según slots equipados y ammoMax. src/sim/objectives.js + tests/objective-ammo.test.js.
3. Reproducción cooperativa final fuera de suite automática: tools/audit/coop-resume-result.repro.js. FALLA de manera esperada hasta arreglar protocolo/idempotencia.

## No integrado / no terminado
- No merge ni despliegue. Publicación comercial no aprobada.
- No corregidos: guardado silencioso, checkpoint, idempotencia y recuperación final cooperativa.
- Experimento reenvío fin fue rechazado/revertido: no hay cambios finales del servidor.
- Prueba de balance existente falla en baseline. Prueba cuatro bots falló tanto en selección como en original aislado (misma aserción); causa pendiente.
- Suite completa no terminó; se detuvo tras ~8 min y se ejecutaron grupos relevantes. No convertir ausencia de resumen en aprobación.
- WebGL remoto no disponible; Chromium local falló al descargar. Sin sesión humana ni hardware iPhone real.

## Cómo retomar
1. Leer estos seis documentos y git status; comprobar SHA remoto/base antes de cambiar nada.
2. Revisar PR de esta rama y sus checks, conservar fixes verificados.
3. Bloque 1: reproducir QuotaExceededError y recarga al final cooperativo; diseñar cierre de recompensas idempotente y recuperable. No reenviar fin de forma aislada.
4. Añadir error visible de WebGL y controles táctiles acotados; preparar gate navegador portable.
5. Ejecutar primera partida real PC/iPhone; luego reducir espera inicial y simplificar aprendizaje.

Notas: los logs en docs/vortex-evidence son pruebas locales sin datos personales. Los números de scorecard son juicios provisionales del commit base, no pruebas de satisfacción.

## Ciclo 1 — Simplificación autorizada, 22/10/2026
El usuario autorizó modificar el juego y la historia con libertad creativa.
Base recuperada de GitHub: 1e2dbf8 (PR #1, abierto y borrador).

Implementado:
- Historia de conciencia digitalizada, genoma humano e IA; dos guardianes y una salida.
  Guion recuperable: VORTEX_STORY.md. Biografías de los ocho huéspedes reescritas.
- Controles táctiles esenciales: atacar, salto, poder, modo; pausa separada.
  USAR reemplaza poder cerca de interacción. Preset completo recuperable en pausa.
  Melé esencial conserva ataque primario; ataque secundario y poderes adicionales siguen en completo.
- Disparo entra en primera persona; Melé en tercera. Cambiar modo cambia cámara.
  Base conserva tercera persona y la opción manual de cámara sigue disponible.
- Disparo automático desactivado por defecto en perfiles nuevos; preferencias guardadas se respetan.
- HUD esencial prioriza una misión, tiempo del objetivo y enemigos; oculta panel duplicado,
  puntuación, feed de bajas, salpicaduras y habilidades adicionales. Desafíos se muestran entre oleadas.
- Tutorial acortado a cuatro filas, confirmación explícita y pausa de simulación en solo.
- Radar sin ecos falsos en cierre de oleada; barras de élite más anchas y borde ámbar.
- Instrucción de placas distingue solo/coop, texto de núcleo sin exigir compañero ni tecla táctil.

No integrado: no merge ni despliegue. Falta prueba visual/hardware antes de aprobarlo.
No se corrigió en esta entrega navegación de rezagados, colisiones especiales,
variedad de objetivos, balance de modo esencial, crecimiento de enemigos ni cámara lenta.
La suite de HUD se actualizó al contrato nuevo (cuatro acciones); el antiguo
`tools/shot-hud.js` conserva expectativas históricas y no es el gate de esta versión.

## Ciclo 2 — Variedad de misiones y controles esenciales
Base remota verificada: 635748cc, PR #1 abierto/borrador; base aún 9b7d54a.
Cambios autorizados e implementados: Reconexión y Caza en planes por arena;
Primer contacto acepta cualquier estilo; mantener recupera A2/movilidad/definitiva;
poder equipable por huésped/modo. Corregido USAR ocultando poder durante objetivos
y actualización de contexto cancelando pulsaciones. Detalle en VORTEX_MISSION_CONTROLS.md.
Validación: 63/63 específicas, 59/59 núcleo, 5/5 red. Build correcto.
Protocolo 3: desplegar cliente y servidor de la misma versión.
No merge/despliegue, no playtest visual ni hardware. Balance por acción verificado;
versatilidad del kit y ergonomía pendientes de sesiones humanas.


## 2026-10-22 — Alfa simulada, 20 perfiles

Informe: `VORTEX_ALPHA_SIMULATED.md`. 20 valoraciones editoriales ficticias separadas de 20 sondas headless de m1 (hasta 300 s). 18 siguen en oleada 6; dos derrotas en oleada 5. No hubo humanos, campaña completa ni validación visual. Hallazgos nuevos: WAKE_SHORT contradictorio al llegar a m2, restos del final anterior y omisión de WAKE al saltar prólogo. Pendientes de corregir; sin cambios de gameplay en este ciclo. Datos y script guardados para reproducción.


## 2026-10-22 — Alfa 3 sobre PR #5 integrado

Ver `VORTEX_ALPHA_3.md`. Conserva apoyo/ulti progresivos; corrige límite de tres tarjetas, ramas completas, mejoras tempranas gratuitas, precio de órganos y elección fallida/automática. Recupera continuidad sin sobrescribir controles del PR #5. 20 sondas antes +20 después: 18 activas/2 derrotas en ambas variantes, 4→6 llegan a oleada 7. Son bots, no usuarios ni retención. Puntuaciones hipotéticas separadas. Rama `codex/vortex-alpha3-balance`, base main09dfac8. Pendientes melee exclusivo, campaña completa, Safari físico y alfa humana.


## Integración de PR #1 y #6 — 2026-10-22

Se integró el historial del alfa 2. Los controles que retiraban los poderes quedan superados por PR #5 y el balance del alfa 3: se preservan apoyo tras oleada 1 y definitiva tras oleada 3. Se conservan minimapa, cuentas, recompensas y narrativa actuales. Evidencia histórica: VORTEX_ALPHA_2.md; evaluación vigente: VORTEX_ALPHA_3.md.


## 2026-10-22 — Principiante y alfa 2

Ver `VORTEX_ALPHA_2.md`: continuidad por capítulo, resumen al saltar, cuatro acciones estables, poderes conservados en controles completos; segunda pasada corrige nombres de jefe, avisos y bloqueo táctil del resumen. 107 pruebas seleccionadas y verificaciones de navegador; 20 sondas con 16 supervivencias al corte y cuatro derrotas. Puntuaciones hipotéticas aún no cumplen todas >80. Pendiente balance sin poderes, compatibilidad de recompensas, orientación en combate, campaña completa y alfa humana/Safari físico. Sin merge ni despliegue.


## HUD de cuatro acciones — 2026-10-22

Implementación y validación en `VORTEX_FOUR_ACTION_HUD.md`: ataque + defensa/apoyo/ulti ilustrados, cooldown autoritativo, limpieza visual y protocolo 4. Conserva apoyo tras oleada 1 y ulti tras oleada 3; defensa desde el inicio. Pendiente Safari físico y balance humano longitudinal.

## 2026-10-22 — Vida inferior y cooldowns sin recurso

Ver VORTEX_CLEAN_HUD.md. Retrato/vida inferiores, ataque principal + tres habilidades ilustradas, cooldowns sin maná/carga y límites a sus mejoras. Protocolo 5 requiere cliente/servidor coordinados. 147 pruebas seleccionadas y 59 del núcleo; tres tamaños Chromium y 16 sondas de cinco minutos. Persisten dos fallos reproducibles también en main: enemigo rezagado y balance legendario Vesper melee. Próximo ciclo: resolver orientación final y balance melee con pruebas humanas; Safari físico pendiente.
