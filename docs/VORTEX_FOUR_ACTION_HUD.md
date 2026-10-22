# HUD de cuatro acciones — 2026-10-22

Pedido: reemplazar símbolos genéricos por imágenes de las habilidades, mostrar cooldown al usarlas y limitar el combate a ataque + tres poderes.

## Implementado

- Cuatro posiciones estables: ataque básico, movilidad/defensa, apoyo, definitiva. Ataque cambia de imagen y función con Disparo/Melé; los poderes físicos se conservan entre modos.
- 26 pictogramas SVG propios, sin dependencias externas: dos ataques y 24 poderes de los ocho huéspedes actuales. Nombre real accesible y explicación al tocar; PC muestra nombre y tecla.
- Defensa disponible desde el inicio; apoyo tras completar oleada 1, definitiva tras completar oleada 3. Botones bloqueados siguen en su posición, indican la oleada y rechazan pulsaciones. Conserva perfiles y desbloqueos existentes.
- Cooldown numérico real y anillo para defensa/apoyo; recuperación del ataque básico procede del snapshot `ac`. La definitiva muestra carga porcentual, LISTA y duración activa, porque se recarga combatiendo y no por un temporizador ficticio.
- Se retiran del grupo táctil salto, ataque secundario, recarga, equipo, evolución, apuntado y habilidades duplicadas. Recarga automática ya existente; mantener melee conserva ataque secundario. Salto: doble toque en zona izquierda, documentado en ayuda; teclado conserva Espacio.
- Modo y pausa son utilidades separadas arriba. USAR aparece sólo cuando corresponde; revivir conserva su control contextual. No se eliminan estas acciones necesarias para navegación/coop.
- Oculta paneles de poderes duplicados, rango de estilo, contadores de evolución durante combate y avisos extensos de descubrimiento. Evolución sigue accesible desde pausa y entre oleadas. Vida, objetivo, munición y minimapa permanecen.
- Barra de armas acotada para evitar invadir los cuatro botones en pantallas pequeñas.

## Balance y compatibilidad

Se preservan daños, costes, cooldowns, carga y sinergias existentes. La nueva disponibilidad de defensa al inicio es un aumento de herramientas para el principiante, no una afirmación de dificultad equivalente. Pruebas de pulsaciones repetidas comprueban que no se evita el cooldown. No se agregan poderes automáticos ni habilidades pagas.

El adaptador `compact` también enruta el apoyo físico en cooperativo; no confunde los slots de melee con la habilidad mostrada. Campaña sigue aplicando sus restricciones de desbloqueo en la simulación. Protocolo 4: publicar cliente y servidor juntos para rechazar combinaciones antiguas incompatibles. Caché del service worker renovada.

## Verificación

- 77 pruebas seleccionadas: controles, habilidades, imágenes, recompensas, continuidad, modos y misiones en red.
- 1 prueba adicional con dos clientes WebSocket: defensa, apoyo y ulti reales; snapshots y recuperación de ataque coinciden.
- 59 pruebas de núcleo: total 137 seleccionadas, sin fallos. No es toda la suite.
- Compilación estática: 48,4 MB.
- Chromium/WebGL: PC 1280×800, móvil 844×390 y 667×375. Cuatro acciones con imágenes y sin solapamiento entre ellas; activación de apoyo/defensa con cooldown, cambio de modo, bloqueo por progreso, conservación de imágenes tras cambios contextuales. Doble toque para salto comprobado como entrada. Cero errores de página.
- `tools/check-four-action-hud.mjs` reproduce la prueba visual, con fixtures explícitos para desbloqueos/enemigos. `CHROMIUM` permite proporcionar el ejecutable. Capturas y reporte en `docs/vortex-evidence/four-action-hud/`.

Pendiente: Safari/iPhone físico, comprensión humana del doble toque y balance de victorias por huésped en campañas completas. El juego conserva su aviso de rotar en vertical; no se afirma compatibilidad jugable vertical. No se asignan nuevas puntuaciones de alfa ni retención humana.
