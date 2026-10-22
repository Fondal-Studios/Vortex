# VORTEX — identidad y producción

## Promesa
**Tu conciencia. Otro cuerpo. Una salida.** Una conciencia humana ocupa genomas vivos en una realidad digital fracturada. Tecnología, carne y memoria se leen juntas. La rareza atrae; la acción se entiende. El espectáculo enmarca la acción: nunca tapa blancos, límites ni peligro.

Bucle: elegir huésped → leer la regla de la arena → superar oleadas y objetivos → derrotar al guardián → personalizar. La narrativa definitiva se coordina con la PR de controles/historia; este bloque no reemplaza su trabajo.

## Bloques recuperables
1. **Identidad implementada**: fuente única `src/shared/identity.js`, seis arenas y ocho huéspedes; selección de arena dice regla, acción y meta; huésped presenta verbo, rol y consejo antes del detalle.
2. **Render implementado**: color de borde propio del huésped dominante frente a región/evolución; metales base con matiz propio; modelo de selección estable, sin cambio de región automático. Menos saturación ambiental y halos sobre órganos; marcas de ayuda con segmentación/ritmo propio de cada arena. Las zonas dañinas conservan su señal de peligro.
3. **Colección implementada**: 24 acabados disponibles (8 originales gratuitos +16 desbloqueables jugando), 8 acabados áuricos en vista previa. Comparador de original, giro manual, confirmación de adquisición, equipar y persistencia. Se muestra el mismo cuerpo que en partida. No son 32 modelos nuevos: son 4 acabados materiales por huésped.
4. **Monetización bloqueada para lanzamiento**: no hay cuentas verificadas, ledger duradero ni pasarela. Las ediciones futuras NO se compran. Ver `COSMETIC_COMMERCE.md`. Los cosméticos equipados son locales; su replicación coop debe salir junto con titularidad verificable.
5. **Game Gate global pendiente**: requiere integrar y probar controles/HUD/historia de PR1, primera partida con jugadores nuevos y dispositivo móvil físico. No confundir el gate de esta capa con aprobación comercial del juego.

## Contratos de contenido
Los datos de identidad no modifican la simulación. Un huésped conserva silueta, color de habilidad, hitbox y telegráficos con cualquier acabado. Los acabados alteran metal, hueso, oro, mármol, espejo, corteza y piedra; nunca emisión, opacidad, tamaño o animación. La anatomía, las armas y mutaciones siguen visibles.

Cada arena mantiene una firma: órbitas/islas; espejo/esfera; vigilancia/pasillos; genoma/puentes; memoria/fuente invertida; catedral/altar. El color se acompaña de forma y lenguaje: no es la única señal. Un aviso de daño tiene prioridad sobre decoración.

## Gates antes de añadir contenido
- **Huésped Gate**: silueta distinguible, rol explicable en una frase, materiales coherentes, feedback de habilidades, costo en Baja, cosméticos sin ventaja. Capturas frente/espalda, quieto/acción, Baja/Alta, con tres acabados y en arena; pruebas de estadísticas idénticas.
- **Arena Gate**: punto de referencia, regla propia entendible, objetivo encontrable, contraste ayuda/peligro/escenario, presupuesto de dibujo. Recorrido de entrada a guardián y prueba de los límites; no basta una captura bonita.
- **Game Gate**: primera partida, navegación, accesibilidad, economía sin pago por poder, regresión. Un jugador nuevo debe poder decir quién es, qué hacer y cómo progresar sin explicación del autor. Prueba táctil en iPhone físico y coop antes de lanzamiento.

Todos los criterios ≥7/10 **con evidencia**, crítico distinto del autor; no se promedian defectos. `evaluateGate` y `tools/content-gate.mjs` rechazan evidencia ausente y notas <7. El registro distingue evidencia técnica, revisión visual y observaciones pendientes. La aprobación de una pieza no aprueba todo el juego.

## Reanudar
Leer este archivo y `identity-gates.json`; ejecutar pruebas, revisar evidencias. Siguiente bloque: integrar PR1 y recorrer seis arenas con controles esenciales; después autenticación/ledger/checkout. No habilitar pagos cambiando un booleano del cliente.

## Validación de esta entrega
- 49/49 pruebas en identity-market, combat-polish, luz-arenas, arenas-vivas y menu-nav; sin omitidas. Incluye compras duplicadas, datos inválidos, migración, equipo por huésped y materiales de los ocho.
- Navegador real Chromium 153/SwiftShader: compra→equipar→recargar conserva saldo y acabado; ediciones futuras deshabilitadas; catálogo móvil sin overflow horizontal. Flechas/mando siguen foco y scroll de arena. No equivale a prueba de iPhone físico.
- [Reporte visor](identity/report.json), [seis arenas Baja/Alta](identity/arenas-report.json), [closeups de órganos](identity/organs-report.json). Cero errores de consola. Los closeups fuerzan parámetros visuales de zona activa y reubican cámara; no prueban activación mediante gameplay.
- Build estático 48,4 MB. Sin cambios en estadísticas de simulación; acabados aplicados exclusivamente en render local. No nuevo arte externo.
- [Acabados1](identity/acabados-1.jpg) · [Acabados2](identity/acabados-2.jpg) · [Arenas Baja](identity/arenas-low.jpg) · [Arenas Alta](identity/arenas-high.jpg) · [Órganos](identity/organos.jpg).
- `node tools/content-gate.mjs docs/identity-gates.json` devuelve 1 intencionalmente: ningún gate completo se presenta como aprobado. Sólo el delta descrito en ARTGATE_REGISTRY tiene aprobación incremental.
