# HUD limpio y habilidades sin recurso — 2026-10-22

Base: main a263f82 (PR #7). Rama: codex/vortex-clean-hud-cooldowns.

## Cambio visible
Vida abajo a la izquierda junto al retrato del huésped y su nombre. Escudo se muestra como protección numérica, no como una barra azul semejante a maná. Retratos prerenderizados desde los ocho modelos del juego; no representan cosméticos dinámicos.
Ataque básico grande y tres botones adyacentes: defensa, apoyo y definitiva. Cada acción conserva su ilustración y muestra los segundos de recuperación. En melee el mismo botón principal ataca cuerpo a cuerpo.
Arma seleccionada compacta, munición junto al ataque y objetivo arriba. Selección de arma táctil por toque cíclico. Se mantienen pausa, modo, minimapa e interacción contextual por su función necesaria. Los marcadores fuera de pantalla evitan vida y habilidades; las descripciones táctiles respetan el ancho de pantalla.

## Cooldowns y balance
Se elimina la carga de definitiva por daño/bajas: ninguna habilidad necesita maná ni llenar energía. Defensa desde el inicio, apoyo después de oleada 1 y definitiva después de oleada 3, conservando progresión aprobada.
Esperas base tras terminar el efecto: Axioma/Vesper 45 s; Umbra/Seraf/Danzante 55 s; Micelio/Colmena/Singular 60 s.
El contador inicia con duración activa + espera. Mejoras de velocidad de recuperación limitadas a 25%; plantas y pasivas reembolsan como máximo 20% de la espera por lanzamiento. Los efectos antes asociados a carga se convierten en segundos o recuperación con ese límite.
Snapshot ud/ux para cooldown actual/máximo; uc sigue reservado para capacidad del enjambre. Protocolo 5: publicar cliente y servidor juntos. Cache v7-cooldowns.

## Evidencia y límites
- 147/147 pruebas seleccionadas: cooldowns de los ocho huéspedes en shooter/combo, progresión bloqueada, red, flora, nieblas, Singular, Danzante, recompensas y controles; 59/59 pruebas rápidas del núcleo en ejecución separada.
- Navegador Chromium headless con WebGL software: 1280×800, 844×390 y 667×375; cuatro acciones sin solapamientos, retrato cargado, vida abajo, entrada táctil real, cooldowns y cambio de modo. Ver report.json y capturas en vortex-evidence/clean-hud.
- Compilación estática: 48.7 MB.
- 16 sondas deterministas de 300 segundos, ocho huéspedes × dos modos, semilla 2718. Sin timers inválidos. Shooter: oleadas 5–7 y 3–4 definitivas. Combo: oleadas 2–6 y 0–3 definitivas. Los bots no representan jugadores, retención ni validación final del balance.
- Dos pruebas fallan también en la base exacta a263f82: último enemigo rezagado (geoda a 77 m) y equipo legendario de Vesper melee (7.5→16.5, fuera del margen ±30%). No se alteraron sus umbrales ni se presentan como resueltas.
- Pendientes: Safari/iPhone físico, alfa humana, balance longitudinal melee y despliegue público.

## Reproducción
node --test tests/hud-safe-point.test.js tests/ultimate-cooldown.test.js tests/flora.test.js tests/nieblas.test.js tests/danzante.test.js tests/four-action-hud.test.js tests/skill-path.test.js tests/four-action-network.test.js tests/alpha3-rewards.test.js tests/campaign-clarity.test.js tests/essential-controls.test.js tests/singular.test.js
npm run test:fast
node tools/probe-cooldown-balance.mjs
CHROMIUM=/ruta/chromium node tools/check-clean-hud.mjs
node tools/build-static.js
