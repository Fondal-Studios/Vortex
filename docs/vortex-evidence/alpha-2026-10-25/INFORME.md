# VORTEX — auditoría actual y plan para llegar a 80/100

25 de octubre de 2026. Código evaluado y desplegado: `691961a528014681136546983740317d372099b5`. Evaluación de una alpha por áreas de producción; no es una encuesta ni una nota de jugadores humanos.

## Dictamen: 70/100 provisional

La base técnica, el editor y la identidad visual ya sostienen una demo. La campaña todavía necesita convertir su premisa en acciones: hoy hay recuerdos y diálogos, pero no rescates especiales de conciencias ni consecuencias jugables de ese dilema. Además, cumplir 8–12 minutos con un solo bot no cubre la variación entre huéspedes.

| Departamento | Peso | Actual | Objetivo | Evidencia y deuda |
|---|---:|---:|---:|---|
| Combate y equilibrio | 20% | 72 | 80 | Ocho huéspedes y estilos existentes; ajustar los encuentros largos y validar habilidades específicas. |
| Campaña y misiones | 20% | 58 | 78 | Seis capítulos ordenados y recuerdos progresivos; estructura repetida, Islas aún no cumple el enfoque de supervivencia, rescates especiales pendientes. |
| Editor y personalización | 15% | 84 | 86 | MVP integrado, recuperación de borrador, guardado con error/reintento, exportación, prueba y cooperativo; faltan validación humana y pulido de legibilidad. |
| Experiencia, HUD y aprendizaje | 15% | 68 | 80 | Tutorial y menús presentes; comprobar controles físicos y simplificar Misiones → Solo/Cooperativo. |
| Calidad técnica y red | 15% | 74 | 84 | Pruebas dirigidas y reconexión pasan; falta cierre global de CI y rendimiento medido en hardware real. |
| Progresión y continuidad | 10% | 58 | 70 | Ledger y progreso local; Render devuelve accounts=false y no está verificada una continuidad entre dispositivos. |
| Arte e identidad | 5% | 78 | 78 | Arenas, cuerpos y Heraldo reconocibles; mejorar lectura dentro del combate antes de producir más recursos. |

Promedio ponderado actual: **69,6 → 70**. La columna objetivo suma **80,0**. Es una rúbrica editorial propuesta: terminar tareas no concede puntos automáticamente; hay que repetir la evaluación y cumplir las pruebas de aceptación. No se calcula diversión a partir de victorias ni se inventa una diferencia contra una nota anterior no comparable.

## Render actualizado

- URL: https://shower-psico-coop.onrender.com
- Despliegue `dep-dbf6of67bikc73ccu5q0`, estado **live**, finalizado a las 20:54:18 UTC.
- `/health`: ok=true, proto=6, accounts=false.
- Se compararon byte por byte los archivos publicados de editor, perfil y Heraldo con el checkout auditado: coinciden.
- Chromium no pudo abrir el dominio remoto en dos intentos (`ERR_EMPTY_RESPONSE`). No se presenta como un E2E aprobado de producción. El mismo commit pasó el smoke local en Chromium/SwiftShader a 844×390: menú, editor 3D, cámara compacta y cero errores JavaScript. La publicación está acreditada por API y HTTP, no por ese navegador remoto.
- Esta entrega publica el código integrado existente; las nuevas herramientas e informes de auditoría no cambian las reglas del juego.

## Simulaciones ejecutadas

**612 partidas sintéticas**: 288 de comparación principal, 288 de estrés con retardo, 6 de control, 18 de diagnóstico y 12 de melé. Además, 8 pruebas cooperativas y 23 pruebas de campaña/recuerdos/configuración, todas aprobadas. Son ejecuciones locales del mismo motor y commit desplegados; no se sometió a Render a una prueba de carga.

Comparación principal: 8 huéspedes × 6 capítulos × 3 perfiles × 2 semillas. Personajes: Axioma, Vesper, Micelio, Umbra, Seraf, Danzante, Singular y Colmena. Cada misión empieza aislada, sin progreso acumulado de inventario; no representa una campaña completa conservando todas las mejoras anteriores. Se usa la política tiradora común, no una rotación óptima distinta por personaje. No hay invulnerabilidad ni mejoras gratuitas.

| Perfil sintético | Victorias | Mediana de victorias | Victorias dentro de 8–12 min |
|---|---:|---:|---:|
| Principiante | 85/96 (88.5%) | 11.2 min | 53/85 |
| Intermedio | 93/96 (96.9%) | 10.5 min | 72/93 |
| Experto | 92/96 (95.8%) | 10.1 min | 76/92 |

De las 270 victorias, **201** cumplen estrictamente 8–12 minutos. Rango de victorias: **7.7–16.0 min**. No hubo partidas que siguieran abiertas al horizonte de 25 minutos ni errores de valores no finitos. Los tiempos excluyen navegación de menús, lectura de recuerdos y cinemáticas.

| Capítulo | Principiante: victorias · media ganadas | Intermedio | Experto |
|---|---:|---:|---:|
| Islas | 16/16 · 9.8 min | 16/16 · 9.2 min | 16/16 · 8.8 min |
| Laberinto | 11/16 · 12.9 min | 16/16 · 12.0 min | 15/16 · 11.2 min |
| Jardín | 13/16 · 13.6 min | 13/16 · 12.4 min | 15/16 · 11.3 min |
| Plaza | 16/16 · 10.4 min | 16/16 · 10.2 min | 16/16 · 10.1 min |
| Osario | 13/16 · 12.0 min | 16/16 · 10.8 min | 14/16 · 10.4 min |
| Fractal | 16/16 · 11.6 min | 16/16 · 10.8 min | 16/16 · 10.7 min |

| Huésped | Principiante | Intermedio | Experto |
|---|---:|---:|---:|
| Axioma | 12/12 | 11/12 | 12/12 |
| Vesper | 11/12 | 11/12 | 12/12 |
| Micelio | 9/12 | 12/12 | 12/12 |
| Umbra | 10/12 | 12/12 | 12/12 |
| Seraf | 9/12 | 12/12 | 12/12 |
| Danzante | 12/12 | 12/12 | 12/12 |
| Singular | 12/12 | 12/12 | 12/12 |
| Colmena | 10/12 | 11/12 | 8/12 |

**Cómo leer los perfiles:** se varían precisión/velocidad de giro, frecuencia de disparo, uso de especial y evasión. Todos conocen objetivos, rutas y señales del motor, eligen la primera mejora y no optimizan todas las habilidades/ultimates. Por eso “principiante” significa menor ejecución mecánica, no desconocimiento humano del tutorial. Dos semillas por combinación permiten detectar casos, no estimar una tasa poblacional fiable. La pequeña inversión entre intermedio y experto (93 frente a 92 victorias) no demuestra una dificultad invertida: el control y las decisiones estocásticas también cambian las trayectorias.

La primera batería añadió retardo de comandos de 300/133/33 ms. Terminó con 45/288 victorias. El diagnóstico de Axioma sin ese retardo completó 18/18 capítulos. La sensibilidad al retardo del controlador impide interpretar esas derrotas como dificultad humana: se conserva la batería separada como estrés, sin usarla para penalizar el balance ni afirmar un fallo de latencia del producto.

Melé: **12/12 victorias**, Axioma, dos semillas por capítulo, a 60 Hz; rango 8.8–12.3 min. No cubre melé de los ocho huéspedes. Los campos `premio` de esa herramienta histórica no se emplearon: su adaptador de recompensas no representa el contrato actual. Tampoco se interpreta `automaticClears` como bajas del jugador: agrupa desintegraciones por distintas causas, incluidas limpieza y prevención de atascos.

## Casos para reproducir antes de tocar números globales

- principiante / vesper / Laberinto / semilla 2: 16.8 min, etapa 8, Tiempo agotado: el encuentro final duró más de 7.5 minutos y la salida se cerró..
- principiante / micelio / Laberinto / semilla 1: 17.3 min, etapa 8, Tiempo agotado: el encuentro final duró más de 7.5 minutos y la salida se cerró..
- principiante / micelio / Laberinto / semilla 2: 17.3 min, etapa 8, Tiempo agotado: el encuentro final duró más de 7.5 minutos y la salida se cerró..
- principiante / seraf / Laberinto / semilla 2: 17.3 min, etapa 8, Tiempo agotado: el encuentro final duró más de 7.5 minutos y la salida se cerró..
- principiante / colmena / Laberinto / semilla 1: 17.5 min, etapa 8, Tiempo agotado: el encuentro final duró más de 7.5 minutos y la salida se cerró..
- principiante / umbra / Jardín / semilla 1: 9.1 min, etapa 7, derrota sin motivo de operación (revisar combate/caída).
- principiante / umbra / Jardín / semilla 2: 3.8 min, etapa 3, derrota sin motivo de operación (revisar combate/caída).
- principiante / colmena / Jardín / semilla 1: 4.4 min, etapa 1, Se agotó el tiempo del objetivo..
- principiante / micelio / Osario / semilla 1: 16.7 min, etapa 8, Tiempo agotado: el encuentro final duró más de 7.5 minutos y la salida se cerró..
- principiante / seraf / Osario / semilla 1: 16.3 min, etapa 8, Tiempo agotado: el encuentro final duró más de 7.5 minutos y la salida se cerró..
- principiante / seraf / Osario / semilla 2: 15.9 min, etapa 8, Tiempo agotado: el encuentro final duró más de 7.5 minutos y la salida se cerró..
- intermedio / axioma / Jardín / semilla 2: 3.0 min, etapa 3, derrota sin motivo de operación (revisar combate/caída).
- intermedio / vesper / Jardín / semilla 2: 3.2 min, etapa 3, derrota sin motivo de operación (revisar combate/caída).
- intermedio / colmena / Jardín / semilla 2: 4.4 min, etapa 1, Se agotó el tiempo del objetivo..
- experto / colmena / Laberinto / semilla 1: 17.6 min, etapa 8, Tiempo agotado: el encuentro final duró más de 7.5 minutos y la salida se cerró..
- experto / colmena / Jardín / semilla 2: 4.4 min, etapa 1, Se agotó el tiempo del objetivo..
- experto / colmena / Osario / semilla 1: 16.0 min, etapa 8, Tiempo agotado: el encuentro final duró más de 7.5 minutos y la salida se cerró..
- experto / colmena / Osario / semilla 2: 16.1 min, etapa 8, Tiempo agotado: el encuentro final duró más de 7.5 minutos y la salida se cerró..

Revisar especialmente los emparejamientos largos en Laberinto/Jardín y el uso real de habilidades. Una derrota del agente no demuestra que el huésped esté roto: reproducir manualmente y comparar DPS, ventanas de vulnerabilidad, navegación, defensa y motivo de caída. No resolverlo alargando todos los temporizadores ni debilitando a todos los enemigos.

## Trabajo para llegar a 80

### Corrección inmediata — miniatura con canon cancelado

La captura revisada `local-modes.png` muestra en la tarjeta Campaña el subtítulo «Si te atropelló un tren…». La tarjeta carga `/public/art/historia.jpg` desde `src/client/operations-ui.js`. Es una contradicción visible con el canon vigente, aunque los textos de campaña ya estén corregidos. Reemplazar esa miniatura por una captura del despertar/Islas sin subtítulos antiguos, revisar otras reutilizaciones de la imagen y comprobar que el navegador actualiza la caché. No hace falta una nueva arena ni una cinemática nueva. **Hallazgo pendiente de corregir; no se afirma que el despliegue de esta auditoría lo haya eliminado.**


### Bloque 1 — Equilibrio y ritmo, con el contenido actual

Ajustar por encuentro y huésped; instrumentar daño por fuente, impactos, tiempo de vulnerabilidad del jefe y causas de derrota. Añadir agentes específicos de habilidades y melé. Reintento claro y rápido del encuentro final en campaña, conservando el ledger idempotente; definir expresamente qué recompensas conserva.

Aceptación: al menos 10 semillas por huésped/estilo; ≥90% de victorias de la batería competente dentro de 8–12 minutos, ninguna partida bloqueada y ninguna combinación sistemáticamente inviable. Mantener desafío en expertos; no rellenar duración con esperas. Validar luego con humanos.

### Bloque 2 — Dar identidad jugable a cada capítulo

Separar las configuraciones de campaña y contratos independientes antes de cambiar sus reglas. Reutilizar las seis arenas, los objetivos, cuerpos, jefes, piezas y diálogos existentes.

| Capítulo | Rework acotado | Recurso que ya existe |
|---|---|---|
| Islas — Despertar | Supervivencia por oleadas como eje; aprender movimiento y combate, una revelación corta. Retirar la mezcla temprana de terminales, defensa y transporte obligatorio. | Oleadas, resistir, tutorial y cinemática de transferencia. |
| Laberinto | Desactivar vigilancia y abrir el archivo; variar rutas y lectura del custodio. | Secuencia, caza, Argos y terminales. |
| Jardín | Abrir el puente, proteger una conciencia y extraerla; primer rescate especial jugable. | Cultivo, ancla, núcleo y cuerpo del encuentro existente. |
| Plaza | Reconstruir un recuerdo en el espacio, con un objetivo central que cambie lo que entendemos. | Plaza, secuencia y fragmentos narrativos. |
| Osario | Descubrir el voluntariado y el origen de Heraldo durante un encuentro recuperable. | Osario, núcleo, jefe y recuerdo del voluntario. |
| Fractal | Abrir la salida y resolver el acuerdo; reconocer qué se recuperó sin prometer una liberación total que no ocurrió. | Canal de salida, Madre Geoda y cierre existente. |

Dos rescates especiales bastan para este rework: debilitar la defensa digital → estabilizar una ventana de recuperación → proteger la extracción. Los enemigos comunes siguen siendo combate con daños colaterales; no convertir cada baja en un minijuego. Heraldo sigue siendo una entidad independiente con influencia de IA, sin reunificación obligatoria. “Último humano” sigue siendo su creencia incompleta.

Aceptación: un objetivo dominante distinto por capítulo, dos rescates con estados de éxito/fallo reales, recuerdos vinculados a hechos jugados y finales coherentes con esos estados. No sustituir objetivos por texto más largo.

### Bloque 3 — Menús y control físico

Campaña (solo) / Misiones independientes (Solo o Cooperativo) / Campo de pruebas. Mantener arenas en el códice. El menú actual ofrece cuatro accesos hermanos; falta terminar esa agrupación. Probar joystick/cambio de arma, pulgares, zonas táctiles y safe areas en teléfonos reales. El smoke a 844×390 no garantiza comodidad física.

Aceptación propuesta: 6 novatos y 6 jugadores experimentados; ≥80% de los novatos inicia y completa Islas sin explicación externa, sabe cuál es su objetivo y registra como máximo una activación equivocada de arma en cinco minutos. Botones de al menos 44 px, sin solapamiento con el área de movimiento. Es un protocolo pendiente, no un resultado logrado.

### Bloque 4 — Cerrar editor y continuidad

Conservar lo ya integrado: no rehacer el editor. Pulir presets, comparación de resultados y mensajes de pieza bloqueada; mostrar de forma inequívoca guardado local/exportación. Revisar con humanos el ciclo editar → probar → volver → equipar → cooperativo. Si se quiere continuidad entre dispositivos, conectar y verificar el backend de cuentas existente; hoy Render no lo tiene habilitado.

Aceptación: fallos de almacenamiento recuperables, exportar/importar sin pérdidas, diseño correcto tras recarga/reconexión y cero duplicación de recompensas. La economía autoritativa y una tienda de pago quedan fuera de este rework.

### Bloque 5 — Puerta de calidad

Cerrar las suites completas y comprobar Actions; el endpoint de estados consultado devolvió lista vacía, lo cual no acredita CI verde. Medir en un móvil representativo y escritorio real, además de WebGL por software. Objetivo propuesto: p95 del frame ≤33,3 ms en móvil y ≤16,7 ms en escritorio con calidad definida, sin cierres ni crecimiento sostenido de memoria en 30 minutos. No se midieron esos valores aquí.

La nota de 80 debe depender de estos resultados y del playtest humano, no de sumar funcionalidades. Primero ritmo y campaña; el editor ya tiene una base suficientemente sólida para trabajar sobre ella.

## Evidencia y reproducción

- `base-resumen.json`, `base-partidas.csv`, `base-*.jsonl`: comparación principal.
- `resumen.json`, `partidas.csv`, `principiante.jsonl`, `intermedio.jsonl`, `experto.jsonl`: estrés con retardo, separado.
- `control.jsonl`, `diagnostico-*.jsonl`, `melee.jsonl`: controles complementarios.
- `deployment.json`, `render-http.json`, `render-smoke.json`, `local-smoke.json`: publicación y límites de verificación.
- `coop-tests.txt`, `campaign-tests.txt`: pruebas frescas; el cierre anterior del editor está documentado en `docs/EDITOR_CIERRE_2026-10-25.md`, no se cuenta como una nueva corrida completa aquí.
- `local-editor.png`, `local-modes.png`: capturas locales revisadas.

Desde la raíz del repositorio, usar archivos de salida NUEVOS: la herramienta añade líneas y no borra las anteriores.

```sh
node tools/audit/alpha-perfiles.mjs principiante_sin_retardo /tmp/principiante-nuevo.jsonl all 1,2 all
node tools/audit/alpha-perfiles.mjs intermedio_sin_retardo /tmp/intermedio-nuevo.jsonl all 1,2 all
node tools/audit/alpha-perfiles.mjs experto_sin_retardo /tmp/experto-nuevo.jsonl all 1,2 all
node tools/audit/resumen-alpha.mjs docs/vortex-evidence/alpha-2026-10-25 base-
node --test tests/coop4.test.js tests/coop-resume.test.js
node --test tests/mision-config.test.js tests/campaign-route.test.js tests/campaign-memories.test.js
BROWSER_EXECUTABLE=/ruta/a/chromium REQUIRE_BROWSER=1 node tools/audit/render-smoke.mjs --local
```
