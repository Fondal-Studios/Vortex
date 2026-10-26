# VORTEX — intro de carga y revisión de campaña

Fecha: 25/10/2026 (Argentina). Base: e9f06b0, con la intro de carga de esta entrega. Nota de diseño provisional: **74/100**, frente a 70/100 de la auditoría anterior. Es una evaluación editorial ponderada, no una encuesta de jugadores ni una métrica automática de diversión.

## Entrega

La aplicación arranca con cuatro viñetas de cinco segundos mientras se importa el motor. Presentan transferencia, fragmentación, huésped y Heraldo. No revelan el voluntariado ni el origen compartido de Heraldo. Se reutilizan los retratos y recursos existentes; no se generan ilustraciones ni vídeos.

- La intro dura 20 segundos visibles, se puede saltar y pausa su reloj si la pestaña queda oculta.
- Si el motor tarda más, la pantalla indica que sigue cargando; el progreso visual corresponde a la intro, no a un porcentaje ficticio de descarga.
- Saltar nunca abre un juego que todavía no terminó de inicializarse. Un fallo de importación ofrece reintentar.
- Se bloquea la interacción con el menú inferior y su render 3D durante la intro.
- Los enlaces directos de sala y herramientas de pruebas conservan el acceso directo. `?loadingintro=0` permite omitirla explícitamente.
- Las viñetas de campaña y la extensión de ritmo de la PR #17 se conservan.

`main` era ancestro de la rama publicada: la integración puede hacerse por avance rápido, conservando su historia y llevando todos los cambios acumulados. Render sigue configurado para `claude/larga-con-eso-s43nfe`; ambas ramas se sincronizan con el mismo contenido. No se cambian la base de datos ni los planes de alojamiento.

## Nota por departamento

| Área | Peso | Antes | Ahora | Motivo |
|---|---:|---:|---:|---|
| Combate y equilibrio | 20% | 72 | 72 | Se extiende el ritmo, pero persisten emparejamientos largos y derrotas específicas. No se premia simplemente durar más. |
| Campaña y misiones | 20% | 58 | 72 | Entrada comprensible, revelación gradual, cómics entre capítulos y cierre coherente. Falta traducir los rescates en mecánicas y diferenciar más los objetivos. |
| Editor | 15% | 84 | 84 | Se conserva la evaluación anterior; no se atribuye una nueva auditoría completa del editor a este bloque. |
| Interfaz y aprendizaje | 15% | 68 | 76 | Contexto durante la carga, lectura breve, salto y estados de error claros; falta validación con personas y móviles físicos. |
| Calidad técnica y red | 15% | 74 | 74 | Pruebas dirigidas aprobadas; no se repite toda la suite ni una prueba de carga de producción. |
| Progresión y continuidad | 10% | 58 | 58 | Persiste el límite de progreso local/cuentas no habilitadas en la última comprobación del servicio. |
| Arte e identidad | 5% | 78 | 78 | Composición de cómic con recursos existentes; no hay una nueva colección de ilustraciones originales. |

Promedio: **73,6 → 74**. El aumento se atribuye a narrativa y claridad, no a cambios inexistentes en balance, cuentas o rendimiento.

## Nueva batería de simulación

144 partidas: ocho huéspedes × seis capítulos × tres perfiles × una semilla por combinación. Se usa la política tiradora de la auditoría anterior, sin retraso artificial de comandos. Los agentes varían precisión, frecuencia de disparo, uso de especial y evasión. Conocen rutas y objetivos; no equivalen a personas principiantes. Cada capítulo empieza sin inventario acumulado ni rotación óptima por huésped.

| Perfil | Victorias | Mediana de victorias | Victorias de 8–12 min |
|---|---:|---:|---:|
| Principiante | 41/48 (85,4%) | 11,93 min | 21/41 |
| Intermedio | 46/48 (95,8%) | 11,52 min | 28/46 |
| Experto | 46/48 (95,8%) | 10,85 min | 33/46 |

Total: **133/144 victorias**. Ninguna ejecución queda abierta al límite de simulación. 82/133 victorias cumplen el antiguo objetivo de 8–12 minutos: el aumento de duración no acredita mejor ritmo. Las pantallas de carga, la lectura de viñetas y el tutorial no se incluyen en estos tiempos. La muestra tiene una semilla, frente a dos en la auditoría anterior: no se comparan porcentajes como si fueran un experimento humano controlado.

Casos prioritarios:

1. Colmena: tiempos agotados en Laberinto y Jardín con el perfil intermedio; también Laberinto con experto. Revisar navegación, daño y vulnerabilidad antes de bajar dificultad global.
2. Jardín: caídas/derrotas de Axioma y Vesper, además de objetivos o jefes agotados en algunos huéspedes.
3. Osario: tiempos agotados de Axioma y Seraf principiantes; derrota adicional de Colmena.

Datos completos: `docs/vortex-evidence/loading-intro/matrix-*.jsonl`, `summary.json` y `runs.csv`. El archivo `principiante.jsonl` contiene un control adicional de 12 partidas de Axioma/Colmena; no se suma a la tabla principal ni se trata como una muestra independiente nueva.

## Qué falta para 80

- Dar un objetivo dominante distinto a cada capítulo y orientar Islas a supervivencia, como se acordó.
- Implementar dos rescates especiales con éxito/fallo real; hoy la liberación sigue siendo principalmente narrativa.
- Ajustar los casos largos de Colmena y el Jardín sin aumentar globalmente vida ni rellenar tiempo con esperas.
- Probar comprensión del inicio y controles táctiles con personas, cerrar rendimiento en hardware real y continuidad del guardado.

La intro mejora la presentación; por sí sola no lleva el juego a 80. Tampoco garantiza que una persona que terminó en media hora ahora tarde una hora.

## Verificación reproducible

- 50 pruebas dirigidas de campaña, configuración, duración, canon, guardado y ledger: pasan.
- Contrato de cuatro viñetas/20 s: pasa.
- Navegador: arranque real con motor demorado, 20 s completos, salto durante carga, teclado aislado, fallo recuperable y tamaños 844×390, 390×844, 667×375 y 1280×720: pasan. Se repitió la comprobación de maquetación tras ajustar el formato vertical.
- Build estático: 49,3 MB.
- Las dos pruebas de navegador de cómic y flujo de campaña pasan; se registran aparte en `campaign-flow.txt`; el caso de flujo fuerza la victoria para probar navegación, no sustituye las partidas simuladas.
- La suite global, un playtest humano y FPS en teléfono físico no están acreditados por esta entrega.

Comandos: `node --test tests/loading-intro.test.js`; `BROWSER_EXECUTABLE=/ruta/chromium REQUIRE_BROWSER=1 node --test tests/loading-intro-browser.test.js tests/campaign-comic-browser.test.js`; `node tools/audit/alpha-perfiles.mjs experto_sin_retardo /tmp/experto-nuevo.jsonl all 1 all` (salidas nuevas: el script añade líneas).
