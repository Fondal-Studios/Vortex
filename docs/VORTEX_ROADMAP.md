# VORTEX — Roadmap por bloques

No sumar héroes/arenas/sistemas hasta cerrar el núcleo. Estimaciones orientativas para una persona con revisión; pueden cambiar tras reproducir cada defecto.

| Bloque | Estado inicial y tareas | Entrega / aceptación | Estimación |
|---|---|---|---|
|0 Auditoría|Base 9b7d54a, seis arenas y tests; evidencia histórica mezclada. Inventariar, probar, priorizar y fijar baseline.|Seis documentos, evidencias, dos fixes pequeños con regresión; PR de revisión, no certificación comercial.|Este ciclo|
|1 Estabilidad/control|Guardado frágil, arranque WebGL sin aviso, editor táctil sin límites.|V01/V03/V04/V07/V15, CI navegador obligatorio; prueba real PC/iPhone; ningún P0 reproducible abierto.|3–5 d|
|2 Combate|Munición mal premiada y test balance rojo, tacto sin verificar.|V09 corregido; V10 investigado; disparo, recarga, melé, impacto, cámara y enemigo básico legibles; medir primer combate.|2–4 d|
|3 Primera misión|86,2 s de secuencia, tutorial no pausa, misión melé en shooter.|Cine opcional; enseñar mover/apuntar/atacar; objetivo, destino y recompensa visibles; 4/5 novatos explican objetivo sin ayuda.|2–4 d|
|4 Escenarios|Seis arenas, dos en campaña normal; ruta directa insuficiente.|Una ruta de 10–15 min con landmarks, estación/portales coherentes, exploración recompensada; luego extender.|3–5 d|
|5 Progresión|Muchas capas; persistencia local; decisiones costosas.|Primera mejora inequívoca; exportación/importación; desbloqueo gradual; prueba de tres builds sin castigo inicial.|2–4 d|
|6 Cooperativo|Servidor vivo y transporte; fin no recuperable, perfil no autoritativo.|V02/V03/A24/A25: dos clientes, desconexión en final, premio una vez, cola acotada; prueba externa con dos participantes.|3–5 d|
|7 QA comercial|Sin evidencia hardware real ni gate artístico completo.|5/15/30 min PC/Safari/iPhone, memoria, FPS, audio, accesibilidad, arte/licencias; publicar sólo con gates aprobados.|3–5 d|

V02/V03 y protección de progreso se pueden adelantar al bloque 1: el orden de bloques no justifica dejar pérdidas abiertas. No se promete completar este calendario sin nuevas evidencias.

## Ciclo de entrega
Leer PROGRESS/DECISIONS y estado remoto; crear rama propia desde base identificada; reproducir bug; test rojo; fix mínimo; test verde; build; revisar diff; registrar límites; PR. Merge sólo con autorización y gates aprobados. No desplegar automáticamente por considerar que un test unitario demuestra experiencia completa.

## Suite de aceptación humana propuesta
Al menos un novato PC, un jugador shooter y un usuario iPhone 13 Pro/Safari. Registrar tiempo a primer movimiento, ataque, objetivo y mejora; errores de control, ayudas solicitadas, caídas, cierres, temperatura percibida y deseo de repetir. No presentar 4/5 como dato obtenido: es un criterio futuro.

## Ajuste de producción — 22/10/2026
Por instrucción del usuario, se implementó una entrega transversal de Bloques 1 y 3:
controles esenciales, cámara por modo, HUD centrado en objetivo y nueva narrativa.
Antes de la próxima entrega: ejecutar `node tools/check-essential-ui.js`, verificar
primera partida y tutorial en PC y Safari/iPhone; revisar diferencias de poder entre
esencial/completo. Después: recuperación de enemigos rezagados y una misión distintiva
por arena. La implementación actual no declara terminados Bloques 1, 2 ni 3.

### Ciclo 2 implementado en rama
Reconexión, Caza y primer desafío libre de arma. Controles esenciales recuperan
secundario, movilidad y definitiva; selección de poder por huésped/modo.
Siguiente gate: recorridos humanos por arena y huésped, especialmente plazos,
lectura del blanco, carga de Seraf y ventana de Danzante. Comparar esencial/completo
por supervivencia y uso accidental, no sólo por equivalencia de acciones.


## 2026-10-22 — Alfa 3 sobre PR #5 integrado

Ver `VORTEX_ALPHA_3.md`. Conserva apoyo/ulti progresivos; corrige límite de tres tarjetas, ramas completas, mejoras tempranas gratuitas, precio de órganos y elección fallida/automática. Recupera continuidad sin sobrescribir controles del PR #5. 20 sondas antes +20 después: 18 activas/2 derrotas en ambas variantes, 4→6 llegan a oleada 7. Son bots, no usuarios ni retención. Puntuaciones hipotéticas separadas. Rama `codex/vortex-alpha3-balance`, base main09dfac8. Pendientes melee exclusivo, campaña completa, Safari físico y alfa humana.
