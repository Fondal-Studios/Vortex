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
