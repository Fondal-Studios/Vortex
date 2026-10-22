# Revisión independiente — poderes progresivos

Fecha: 2026-10-22. Crítico: agente `visual_review`. No modifiqué implementación.

**PASA el gate incremental de presentación y flujo de habilidades observado. Nota mínima aplicable: 7.** No constituye aprobación del HUD completo, del juego ni de sus modelos/efectos.

## Alcance y evidencia

Inspección de código en `skill-path.js`, `hud-huesped.js`, `touch.js`, `main.js` y `focused-hud.css`; capturas reales de Axioma en PC 1280×800 y táctil 844×390, calidad Baja/Alta, estados bloqueado, desbloqueo de apoyo, desbloqueo de ulti y controles disponibles. Las capturas finales `touch-low-unlock3.jpg` y `touch-high-unlock3.jpg` ya muestran la explicación sin badges ni avisos sobre su texto.

Ejecuté `node --test tests/skill-path.test.js`: **18/18 pasan**. Cubren ocho huéspedes en ambos modos, restricciones de entrada, progreso por oleadas completadas y persistencia. El reporte de navegador cubre las cuatro combinaciones PC/táctil × Baja/Alta y declara `errors: []`. Sus oleadas se completan mediante fixture; no representa una campaña recorrida íntegramente.

| Criterio aplicable ARTGATE | Nota | Motivo |
| --- | ---: | --- |
| Silueta y legibilidad | 7 | Dos poderes reconocibles: apoyo con estrella y ulti con rombo. Hitos de bloqueo visibles en PC; botones táctiles aparecen progresivamente y no se pisan entre sí ni con el radar en el viewport observado. |
| Materiales y luz, aplicado a contraste UI | 8 | Fondo casi opaco y oscurecimiento exterior mantienen texto claro incluso con efectos brillantes detrás. Badge y avisos ya no interrumpen la lectura del modal. |
| Coherencia | 8 | Tipografía, bordes y colores pertenecen al mismo sistema de interfaz. Se explica nombre, función, recuperación/carga y control con terminología consistente. |
| Animación y feedback de interacción | 7 | Explicación separada tras cada hito, pausa durante lectura y confirmación explícita. Se distingue enfriamiento del apoyo y carga de ulti. No se califican aquí las animaciones de ataque. |
| Costo incremental | 8 | Reutiliza HUD y un panel DOM; no añade modelos, luces ni draw calls WebGL. El sombreado y el DOM tienen costo de composición, sin medición de teléfono físico. |
| Modelado y detalle | N/A | No incorpora geometría 3D. |

## Defectos encontrados y correcciones verificadas

- Tarjetas de mejora y badge «Resistente» tapaban explicación. Las reglas de visibilidad y la prioridad del modal lo corrigen en las capturas finales.
- Enter/Espacio/Escape apuntaban sólo a `tutok`, inexistente en el desbloqueo. El código ahora resuelve `skillok || tutok`, ignora repetición y bloquea otras acciones durante lectura.
- El mando no tenía confirmación del desbloqueo pausado. Ahora `pad.menuEvents` dirige aceptar/volver al botón del tutorial. Verificado por lectura de código; no probado con mando físico.
- La explicación limpia teclas y disparos retenidos al abrir. El panel admite scroll vertical y botón de al menos 44 px.

## Límites y observaciones restantes

Las capturas visuales corresponden a Axioma; los otros siete huéspedes tienen cobertura de lógica y descripciones disponibles, no una inspección visual de cada explicación. No se certifican todas las longitudes de texto, orientaciones de pantalla, lectores de pantalla ni controles físicos. El radar conserva sus limitaciones anteriores de tamaño/densidad.

Fuera del modal persisten avisos heredados grandes: el aviso de flora del estado táctil bloqueado ocupa mucho del centro. No tapa los controles nuevos, pero impide considerar aprobado el HUD global. Algunas vistas PC de la fixture apuntan al suelo; no se usan como evidencia de calidad artística de la arena o del arma.

El alcance aprobado es la presentación incremental de dos poderes y su aprendizaje, no balance completo, efectos de los ocho huéspedes, seguridad de persistencia o campaña completa.
