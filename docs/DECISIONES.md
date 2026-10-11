# Decisiones técnicas y creativas

Formato: **ID · decisión · por qué · alternativa descartada.**

**D-01 · Motor: Three.js (WebGL2) con módulos ES, sin paso de build.** Corre y se prueba en el contenedor en la nube (Chromium + Playwright preinstalados), se juega con un link, y los shaders psicodélicos se escriben en GLSL a mano. *Descartados:* Unity/Unreal (no compilan ni se prueban acá), Godot headless (sin forma de capturar pantallas fiables y con red más pesada de montar).

**D-02 · La simulación es un módulo puro (`src/sim`) separado del render.** Sin DOM, sin three. El navegador la corre en solitario; el servidor la corre en cooperativo; los tests la corren en Node. Es **determinista** (RNG con semilla, paso fijo) y por eso testeable con bots. *Costo:* hay que mantener un contrato de `snapshot()`.

**D-03 · Red: servidor autoritativo, 60 Hz de simulación, snapshots a 20 Hz, interpolación a 110 ms, predicción local sólo de la mirada.** Los clientes mandan *entradas* (no estado). Nada de lógica atada a un cliente. Lo que falta está en `INFORME_CALIDAD.md › Limitaciones`.

**D-04 · Cero assets externos.** Geometría procedural, shaders propios y audio sintetizado en WebAudio. No hay licencias que documentar más allá de las dependencias (`LICENCIAS.md`) y el repo queda liviano.

**D-05 · Mapa 2 = «Cámara Fractal» (esfera hueca con gravedad radial y marea cero-G).** Es lo contrario del Mapa 1 en lo que importa: allá la geometría está fragmentada y las reglas son locales; acá la geometría es continua y la regla es global y temporal. Cambia el movimiento, la lectura del espacio y cómo llega la horda. Es además el caso más exigente para el modelo de gravedad por entidad, que así queda probado.

**D-06 · «Seven Cup» no es un juego que pueda identificar con certeza.** Se tomaron como referencia de jugabilidad *Serious Sam* (hordas masivas, arenas abiertas, armas muy distintas, siempre moverse) y *Halo* (movimiento ágil, escudo que se recarga + vida que no). Reversible: sólo afecta números de `src/sim/data.js`.

**D-07 · «Monstruos los cristianos» → criaturas de cristal.** Lectura más coherente con el estilo visual pedido (prismas, vidrio, luz refractada). Sin símbolos religiosos. Si la intención era otra, el bestiario se reemplaza sin tocar la simulación (cambia `models.js` y los nombres).

**D-08 · Repositorio.** El prompt pedía crear un repo nuevo; esta sesión sólo tiene acceso a `Shower-psico` (vacío), así que se desarrolló acá, en la rama `claude/larga-con-eso-s43nfe`. Crear un repositorio público es una acción externa e irreversible y se deja a decisión del usuario; el código no depende del nombre. No se abrió PR.

**D-09 · Gravedad como vector por entidad, no como constante.** Cada jugador/criatura/pickup tiene un `up` derivado de `gravityAt(pos, t)` del mapa. El movimiento se hace en el plano tangente a `up`, la mirada se re-proyecta cada paso y la cámara interpola la rotación (sin gimbal). Una sola implementación sirve para «caer hacia arriba», planetoides, esfera hueca y cero-G.

**D-10 · Balance calibrado con bots, no con humanos.** Hay un bot con límites humanos (giro acotado, puntería con ruido, esquiva proyectiles, no ve a través de la geometría). Los números de victoria de `INFORME_CALIDAD.md` son del bot; **no hay evidencia de balance con personas reales**.

**D-11 · Armas hitscan para precisión y rendimiento; sólo la Nova es proyectil.** Un tiro hitscan es una consulta por rayo (barata y determinista); la línea de tiro contra la geometría se hace por *ray-marching* de 1,5 u.

**D-12 · Dificultad por presupuesto.** Cada oleada gasta un presupuesto de «costo» entre las criaturas habilitadas; sube cuadráticamente con el número de oleada y linealmente (+60 %) por jugador extra. La oleada dura ~40 s sin importar su tamaño (el goteo de spawns se adapta).

**D-13 · Muerte del jefe = todo se hace añicos.** Si no, los refuerzos invocados impedían ganar (lo detectó la prueba de jefes).
