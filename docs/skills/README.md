# Dos poderes, aprendidos jugando

La campaña individual comienza con ataques básicos. Superar la primera oleada desbloquea el apoyo; superar la tercera desbloquea la definitiva. Empezar una oleada no concede poderes. La simulación aplica el bloqueo incluso si llegan entradas de controles completos. Cada desbloqueo pausa el juego entre oleadas y explica el poder; teclado Enter/Espacio/Escape, mando confirmar/volver o botón táctil continúan. Las tarjetas de mejoras esperan detrás de esa explicación.

El progreso se guarda inmediatamente en el perfil y se conserva al cambiar de arena, huésped, morir o reiniciar. También viaja en la copia de perfil de Cuenta. No hay compras ni modificadores de precio. Pausa → Ver controles permite volver a consultar nombres y descripciones.

| Huésped | Apoyo (Q/G, RB o APOYO) | Ulti (T, cruceta abajo o ULTI) |
|---|---|---|
| Axioma | Descarga de espinas | Sobrecarga Evolutiva |
| Vesper | Marca biológica | Frenesí Depredador |
| Micelio | Nube de esporas | Floración Total |
| Umbra | Campo gravitatorio | Colapso del Umbral |
| Seraf | Pulso vital | Metamorfosis |
| Colmena | Criar enjambre | Marabunta |
| Danzante | Lazo de cintas | Danza Macabra |
| Singular | Pozo gravitatorio | Supernova |

El apoyo es el mismo poder físico en Disparo y Melé, aunque los antiguos slots de esos modos difieran. Vesper y Danzante necesitan enemigos como blancos y no consumen su apoyo al lanzarlo al vacío. Los botones de apoyo y ulti están separados; sostener apoyo no dispara una ulti. El cambio no altera el arsenal completo del campo de pruebas ni las reglas cooperativas existentes: esta progresión pertenece al aprendizaje de la campaña individual.

Se integra la rama de simplificación `codex/vortex-block0-audit` conservando las incorporaciones de main (identidad, cosméticos, minimapa, revivir y cuentas). Las cuatro colisiones de integración conservaron ambos conjuntos de campos/estilos. Las evidencias antiguas `docs/vortex-evidence` pertenecen a aquella rama; los resultados actuales de esta entrega son los de este directorio y las pruebas listadas abajo.

## Verificación

- `node --test tests/skill-path.test.js`: 34 pruebas; bloqueo, ocho huéspedes por dos modos, uso real con enemigos, ulti, hitos y persistencia.
- Controles esenciales, misiones, objetivos/munición, minimapa, perfiles, cuentas y balance esencial: pasan las pruebas dirigidas.
- Cooperativo con cuatro bots, latencia y reconexión: tres o más oleadas sin desincronización; se preserva el minimapa/revivir.
- `node tools/check-skill-path.mjs`: Chromium/WebGL, PC 1280×800 y móvil horizontal 844×390, Baja/Alta, desbloqueos y confirmación táctil/teclado/mando simulado. Capturas y `report.json` al lado. Sin certificar dispositivo iOS físico.
- La capa añade DOM/CSS y metadatos; no añade geometría, draw calls 3D ni luces.
- `node tools/build-static.js`: compilación estática disponible (48,4 MB).

La evaluación visual independiente incremental está en `review.md`. No equivale a una certificación del juego completo ni a una nueva evaluación de las animaciones de todos los huéspedes.
