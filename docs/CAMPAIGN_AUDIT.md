# Auditoría y mejora: campaña, misiones y modos de juego

## Problemas comprobados y correcciones

| Antes | Ahora |
|---|---|
| Seis operaciones enumeradas por identificador de mapa; la salida aparecía segunda. | Una cronología común: Islas → Laberinto → Jardín → Plaza → Osario → Cámara Fractal. |
| La campaña seguía usando las oleadas antiguas y solo dos capítulos por defecto. | La campaña juega las tres etapas de cada misión. El Coloso cierra el capítulo 1 y la Madre Geoda el 6. |
| «Continuar» arrancaba siempre m1. No había avance de capítulos persistente. | El perfil guarda capítulos consecutivos ganados. Continuar inicia el siguiente pendiente; derrota y salida no lo avanzan. |
| Las misiones parecían alternativas sueltas sin causa ni consecuencia narrativa. | Cada misión tiene situación previa, objetivo, resultado y transición al siguiente archivo; los briefings comparten los mismos datos. |
| Elegir partida abría directamente Misiones. | Modos de juego ofrece Campaña, Misiones individuales, Cooperativo y Campo de pruebas. |
| Había descripciones de marca distintas entre manifest y constante de interfaz. | La descripción de conciencia, Huésped e IA coincide. |

## Recorrido

1. **Refugio de identidades — Islas:** reconectar, defender y recuperar identidad; derrotar al Coloso para obtener la clave.
2. **Apagar los ojos — Laberinto:** usar la clave para desactivar vigilancia y abrir el acceso al Jardín.
3. **El camino que respira — Jardín:** hacer crecer el puente y evacuar memoria hacia la Plaza.
4. **Voces de la plaza — Plaza:** romper el bucle de recuerdos y localizar un cuerpo compatible en el Osario.
5. **El vínculo del Osario — Osario:** recuperar el vínculo genómico necesario para transferirse.
6. **La última transferencia — Cámara Fractal:** preparar la extracción y derrotar a la Madre Geoda para abrir la salida.

Se reutilizan los seis mapas, sus imágenes, HERALDO, el prólogo del tren, subtítulos, objetivos existentes, dos guardianes, perfiles y recompensas. No se producen assets nuevos ni otro sistema de inventario. Arenas permanece en Códice.

## Guardado y modos

- La campaña es solitaria y guarda al completar cada capítulo. No hay guardado a mitad de una misión: salir reinicia ese capítulo.
- El guardado se integra en el perfil existente. Perfiles anteriores empiezan la campaña sin perder equipo, monedas o habilidades. No se infiere una campaña completada a partir de territorios ganados antes.
- Una derrota conserva el último capítulo completado. Reiniciar campaña borra únicamente el avance de capítulos.
- Las misiones individuales están todas disponibles, ordenadas y contextualizadas según la campaña; completarlas no adelanta la historia.
- Cooperativo conserva incursiones independientes; su selección sigue la misma cronología. No se anuncia una campaña cooperativa que el servidor no ofrece.
- El avance local viaja dentro del perfil cuando el jugador utiliza el guardado en servidor ya existente; no se agrega sincronización automática.

## Validación

- **43 pruebas aprobadas, 0 fallidas, 5 omitidas** por la condición original de disponibilidad de Chromium de la suite de recorridos. Ver `campaign-evidence/tests.txt`.
- Pruebas específicas de orden, progreso consecutivo, duplicados, datos inválidos, perfiles anteriores, recarga, reinicio y guardianes obligatorios. Las pruebas anteriores de misiones verifican las seis operaciones en solitario y con cuatro jugadores; la prueba WebSocket verifica snapshots comunes.
- **Chromium real:** menú, orden, inicio desde botones, continuar tras recargar, derrota, misión independiente sin avance, transiciones de los seis capítulos y final. PC 1280×800 y móvil 390×844, juego móvil en horizontal. Sin errores JavaScript y sin desborde horizontal. Ver `campaign-evidence/browser.json` y capturas.
- El navegador inyecta victorias/derrotas exclusivamente para verificar transiciones y guardado; no representa seis partidas ganadas por un humano. Las condiciones de juego se prueban aparte en simulación.
- Build estático correcto: `node tools/build-static.js`.
- No se afirma que toda la suite histórica pase: una ejecución amplia anterior detectó una aserción antigua de cantidad de personajes, ajena a estas misiones. Falta balance humano e iPhone físico.

Reproducción: `node --test --test-force-exit --test-concurrency=1 tests/campaign-route.test.js tests/campaign-clarity.test.js tests/operations.test.js tests/mission-network.test.js tests/mission-variety.test.js tests/marca.test.js tests/recorrido-menu.test.js tests/waves.test.js` y `BROWSER_EXECUTABLE=/ruta/chromium node tools/check-campaign.mjs`.
