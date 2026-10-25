# VORTEX — Auditoría de continuidad y bloques de trabajo

Fecha: 25/10/2026. Fuente: código y pruebas locales; documento maestro de diseño del 24/10 y decisiones explícitas de esta conversación. No es una evaluación con jugadores humanos.

## 1. Dónde está el trabajo

| Fuente | SHA auditado | Estado comprobado |
|---|---|---|
| Rama predeterminada `claude/larga-con-eso-s43nfe` | `62244b61eaecff34ba539fc4018456172579bf03` | Última integración anterior; seis misiones de tres objetivos, HUD separado, relato anterior. |
| Render `shower-psico-coop` | `62244b61eaecff34ba539fc4018456172579bf03` | API de Render: despliegue `dep-dbe1s67b9u1s73bt630g` live. No contiene los avances posteriores de Claude. |
| Claude `claude/vortex-fase0-sprint1` | `15d12e0` | 17 commits posteriores a la rama publicada: auditoría, ocho etapas finitas, tutorial, cinemática, desbloqueos, recibos, resultados y CI. |
| Claude `claude/vortex-editor-mvp` | `0b6bbcd` | Editor genómico y cliente 3D en desarrollo. Ancestro común con Sprint 1: `52ba6c0`; NO asumir que contiene los últimos cuatro cambios de CI del Sprint 1. |
| `main` | `94280a5` | Más antigua; no es la rama predeterminada ni la rama publicada. |

No se debe volver a implementar la cinemática, el tutorial, el ledger ni el editor sin revisar estas ramas. Las notas originales de auditoría de Claude describen su punto de partida: algunas tablas que dicen «ausente» quedaron desactualizadas después de sus propios commits.

## 2. Inventario y brechas

| Área | Existe en el trabajo de Claude | Qué falta / límite real |
|---|---|---|
| Huéspedes | Ocho oficiales: Axioma, Vesper, Micelio, Umbra, Seraf, Danzante, Singular, Colmena. `HOST_IDS`, `src/sim/data.js`. | Pulido por huésped y pruebas en teléfono físico. No confundir personajes veteranos de prueba ni laboratorio con los ocho oficiales. |
| Inicio | Selector de un inicial entre tres, migración de veteranos, cinemática de transferencia de 24 s, tutorial de nueve pasos. `primer-huesped.js`, `transferencia.js`, `tutorial.js`. | La cinemática usa vacío y cuerpo existentes; no es todavía un recorrido sobre una de las seis arenas. No recrearla desde cero. |
| Misiones | Seis arenas, ocho etapas declaradas por mapa, final, límites duros, contadores, reloj y seis encuentros finales. `mision-config.js`. | Islas aún mezcla terminales, defensa y transporte: no cumple la decisión de centrar el primer capítulo en sobrevivir oleadas. Todos los capítulos comparten demasiado patrón. |
| Duración | Prueba ejecutada: los seis capítulos terminan con un bot tirador semilla 1 dentro de 7,5–13 min de simulación. | No acredita 8–12 min con humanos ni con todos los huéspedes/estilos. Se requiere medición y ajuste, no solo una etiqueta `duracion`. |
| Relato | Secuencia de capítulos, subtítulos e interludios. | El relato previo negaba conciencias cautivas y trataba «último humano» como hecho. Corregido en bloque 1; rescates de jefes, decisiones y finales alternativos siguen pendientes. |
| Recuerdos | Bloque 1 añade seis registros ligados al avance, interludios y consulta en Atlas del códice. | Son diálogos/registros; no son escenas de recuerdos jugables ni un sistema de rescate de cualquier enemigo. |
| Modos | Campaña solo, misiones independientes, acceso cooperativo y práctica. | Unificar el flujo Misiones → Solo/Cooperativo; hoy siguen siendo accesos hermanos. No hay campaña cooperativa. |
| Premios y guardado | Ledger por matchId, guardado transaccional con aviso/reintento, recompensas parciales, resultados y reenvío de `fin` al reconectar. | El progreso sigue siendo local y las cuentas requieren PostgreSQL; no afirmar persistencia cloud ni economía autoritativa completa. |
| Cooperativo | Salas, código, cuatro clientes, reconexión al cuerpo y resultado personal. Integración WebSocket ejecutada. | Los bots usados en pruebas NO son bots de producto. Falta sustitución temporal del desconectado y regreso sin duplicación. |
| Editor | Esquema/validación, piezas, estadísticas, persistencia local, laboratorio, sugeridor, protocolo 6 y UI 3D en otra rama. | 161/162 pruebas dirigidas pasan; falla huella golden de diseños. Resolver versionado/migración antes de integrar. Cliente visual y propiedad autoritativa pendientes de revisión. |
| Publicación | Pages y Render existentes. Claude preparó CI con compuertas. | Integración de ramas pendiente. Render seguía en el commit anterior al trabajo de Claude; comprobar fuente/configuración antes de un despliegue. |

## 3. Bloques ejecutables

### B0 — Continuidad e integración (esta auditoría)
- Inventariar ramas, registrar evidencia y no pisar el editor.
- Base elegida para trabajar: Sprint 1 de Claude; conservar sus módulos existentes.
- Antes de producción: validar la integración completa contra rama publicada. La suite amplia de unit fue interrumpida por su coste; no se declara verde.

### B1 — Relato, recuerdos y claridad de menús (implementado en esta rama)
- «Último humano» es información incompleta de HERALDO, no verdad del narrador.
- Descubrimiento gradual de cautivos, acuerdo tras la guerra, voluntariado y origen común.
- HERALDO es un fragmento fusionado con IA, ahora independiente; ninguno conoce al inicio ese origen. No se exige reunificación.
- Seis recuerdos se desbloquean al ganar capítulos, reutilizan guardado existente, aparecen en interludios y se releen en códice.
- Capítulos pendientes y misiones independientes no muestran anticipadamente los textos de revelación.
- Se corrigen las promesas desactualizadas de «tres objetivos/dos guardianes».
- La salida no declara que todos los cautivos han sido liberados. Los rescates especiales todavía no están implementados.

### B2 — Identidad jugable de los seis capítulos (siguiente)
- Islas: supervivencia finita y aprendizaje gradual; mantener la cinemática/tutorial de Claude. Revisar si reutilizar el propio escenario para la toma final.
- Laberinto: vigilancia y acceso al archivo. Jardín: puente y protección. Plaza: reconstrucción de recuerdo. Osario: registro del voluntario. Fractal: canal de salida.
- Definir uno o dos encuentros especiales recuperables; evitar captura rutinaria de enemigos comunes.
- Separar configuración de campaña de contratos independientes antes de cambiar reglas. Medir shooter/melee y novatos sin imponer esperas artificiales ni farmeo.
- Aceptación: seis recorridos completos, victoria/derrota, objetivo legible, recuerdo correcto y tiempos medidos.

### B3 — Cooperativo y progresión fiable
- Misiones independientes → Solo/Cooperativo, bot temporal al desconectar y devolución de control idempotente.
- Validar caída simultánea, abandono del host y recibos después del final. Mantener botín individual y premios por apoyo.
- Definir persistencia de cuentas disponible; no añadir compras a una economía que depende del cliente.

### B4 — Editor genómico (rama separada)
- Reproducir y resolver el fallo de huella/versionado sin actualizar el golden para ocultarlo.
- Revisar UI/3D, presets, undo/redo, límites y transición laboratorio/partida/coop.
- Integrar después de reconciliar cambios de perfil, protocolo y main con Sprint 1. No es requisito para arreglar campaña.

### B5 — QA y publicación
- Regresión completa, CI real, prueba móvil física y medición humana. Validar rendimiento antes de poner nota global.
- Unificar reportes antiguos con estados actuales, integrar bloques aprobados y comprobar Render live y comportamiento real.
- No emitir 80/100 ni aprobar demo sin pruebas de las áreas que faltan.

## 4. Evidencia ejecutada en esta sesión

- `npm ci`: completado.
- `node tools/build-static.js`: correcto (48,8 MB).
- Campaña/recuerdos/prólogo/marca: 18 pruebas, 18 pasan.
- Ledger/guardado/resultados/coop-resume/coop4/mision-config/onboarding: 57 pruebas, 57 pasan. Incluye cuatro bots WebSocket y latencia simulada de 200 ms en dos clientes; NO son cuatro jugadores humanos.
- Duración: 6 pruebas, 6 pasan (bot tirador, semilla 1, margen 7,5–13 min).
- Editor aislado: host-build, lab-perfil, lab-sim, lab-sugeridor y laboratorio-coop: 162 pruebas, 161 pasan, 1 falla (`host-build.test.js`, huella golden; esperado `1a8a968cb1b80c`, obtenido `16f95819f49d11`). No se modificó esa rama.
- Suite global unit: interrumpida, sin resultado completo. No usar los resultados parciales como aprobación.
- Primer intento de navegador: inválido por falta de bibliotecas SwiftShader del ejecutable conservado en /tmp; WebGL=false. Se preparó un Chromium completo separado y se repite la prueba. Con el Chromium completo: la prueba del menú/códice en escritorio y móvil pasa. La cinemática se inspeccionó visualmente con cuerpo y subtítulos correctos. Resultados en navegador: 1/1 pasa (victoria/derrota, recarga, no duplicación y recuperación de guardado). Onboarding E2E: pasa el flujo menú → primer Huésped → cinemática → nueve pasos del tutorial → combate → recarga sin repetirlo y cambio de cámara. Duración de la prueba: 337 s en Chromium por software.

## 5. Fuera de esta entrega

No se afirma haber integrado la rama del editor, terminado todos los capítulos del rework, ensayado con humanos, desplegado en Render ni aprobado la demo. Las expansiones del documento maestro permanecen en `FUTURE_BACKLOG.md`.
