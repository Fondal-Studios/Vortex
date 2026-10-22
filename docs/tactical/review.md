# Revisión independiente — capa táctica y Cuenta

Fecha: 2026-10-22. Crítico: agente `visual_review`, sin cambios en la implementación.

Alcance: `tactical-hud.js`, `account-menu.js`, estilos nuevos y capturas Chromium reales de esta carpeta. Es una revisión incremental; no certifica el ART GATE del juego completo.

## Estado de la revisión

**PASA la revisión incremental de la capa táctica y del panel Cuenta observado.** La captura final `coop-low-mobile.jpg` de 844×390 con controles táctiles resuelve los solapamientos: radar compacto por encima de MODO/HAB.3/RECARGA, y Revivir separado de munición/nombre de arma. La leyenda y la opacidad permanecen disponibles en Opciones; escritorio conserva el desplegable junto al radar. Nota mínima aplicable: **7**. Esto no aprueba el gate general del HUD ni del juego.

| Criterio aplicable | Nota | Evidencia y motivo |
| --- | ---: | --- |
| Silueta y legibilidad | 7 | Triángulo, cruz, rombo, estrella, cuadrado y bandera separan categorías sin depender sólo de color. Radar y Revivir ya no quedan tapados en la captura táctil final; símbolos pequeños pero distinguibles en la muestra. |
| Materiales/luz, interpretado como contraste UI | 7 | Paneles oscuros y texto claro mantienen contraste sobre escenarios brillantes en Baja/Alta. Opacidad configurable; valores mínimos degradan deliberadamente la visibilidad. |
| Coherencia | 8 | Paleta fría, bordes y tipografía compatibles con el menú y el HUD existentes. Cuenta diferencia restauración, guardado y código de recuperación. |
| Animación y feedback de interacción | 7 | Barra de progreso y acción contextual corresponden al estado autoritativo. `report.json` confirma mantener botón → reanimación real y ocultamiento fuera de alcance. |
| Costo incremental | 8 | Canvas 2D de 360×360 actualizado como máximo a 10 Hz y elementos DOM; no añade geometría, luces ni draw calls WebGL. No equivale a un perfil de CPU/GPU en teléfono real. |
| Modelado y detalle | N/A | No introduce modelos 3D. |

## Comprobaciones y correcciones observadas

- Ejecuté independientemente `node --test tests/tactical.test.js`: 4/4 pasan.
- Revisé `account-desktop.jpg`, `coop-low-desktop.jpg`, `coop-high-desktop.jpg` y `coop-low-mobile.jpg`.
- `report.json` informa registro/guardado/logout/login por UI, reanimación autoritativa, `touchRevive: true`, ocultamiento fuera de alcance y `errors: []`. El script verifica que el botón recibe el punto de interacción por encima de la superficie táctil.
- Corregido durante revisión: `mouseup` ya propaga al listener global, evitando disparo retenido al soltar sobre el HUD.
- Corregido durante revisión: leyenda desplegada lateralmente en escritorio, sin pisar la columna de habilidades.
- Capturas finales de escritorio ya cierran el tutorial antes de valorar el botón.
- Revivir fue reposicionado en baja altura; la última captura táctil confirma texto legible sin pisar munición.
- Radar táctil reducido a 90 px sin cabecera/desplegable: la última captura confirma separación de los botones de acción. La leyenda completa y el ajuste de opacidad están en `public/index.html`, dentro de Opciones.

## Límites

No se evaluó seguridad del backend de cuentas, recuperación completa mediante UI, navegación por lector de pantalla, panel Cuenta en móvil, todos los tamaños de teléfono, rendimiento físico de iPhone ni combate completo. La captura móvil acredita un viewport 844×390 con controles táctiles habilitados, no un dispositivo físico. Los marcadores cercanos pueden coincidir al centro del radar; no se certifica separación bajo máxima densidad de enemigos. A 90 px el radar sacrifica detalle, por lo que la nota de legibilidad es 7, no una certificación de accesibilidad universal. Persisten superposiciones entre avisos/HUD anteriores ajenos a esta capa; no se certifica la composición global. La afirmación de cero draw calls WebGL adicionales se basa en la implementación Canvas/DOM, no en un benchmark comparativo de rendimiento.
