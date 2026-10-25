# Editor genómico — integración y cierre del MVP

Base: `claude/vortex-editor-mvp` (`0b6bbcd`) integrada con campaña Sprint 1 (`631b65d`). Se preservan los recuerdos y el ciclo de vida del visor al cambiar de pantalla.

## Flujo incluido

- Editor básico/avanzado sobre el cuerpo real: proporciones, anclas, piezas, simetría, materiales y colores.
- Deshacer/rehacer, cinco copias por diseño y recuperación del borrador.
- Ocho diseños locales, importación/exportación, selección de diseño y uso en partida.
- Campo de pruebas con medidor y regreso al editor.
- Piezas funcionales limitadas por evolución; importar no concede piezas bloqueadas.
- En cooperativo, los diseños viajan con el protocolo 6 y se restauran al reconectar.

## Correcciones de integración

El editor anunciaba éxito aunque `Perfil.guardar()` fallase. Ahora guardar, importar, borrar y seleccionar usan una transacción del perfil: si falla la persistencia, se restaura el estado anterior, se informa el error y se conserva el borrador. Reintentar no crea duplicados.

«Jugar con mi Híbrido» podía conservar otro diseño activo. Ahora valida y guarda el diseño que se está editando antes de equiparlo. «Usar» carga el diseño elegido para que la vista y la selección coincidan.

El golden de huella fallaba porque el nombre predeterminado cambió de «Híbrido de Laboratorio» a «Híbrido Genómico». El nombre forma parte de la huella. Se conserva el vector histórico con su nombre explícito y se añade el nuevo: no cambió la codificación, no hace falta migrar ni invalidar diseños v1 existentes.

## HERALDO

Se conserva el modelo orgánico y se trabaja su identidad con máscara abierta, halo fragmentado, núcleo colgante y partículas digitales instanciadas. El ojo queda visible fuera de la membrana. Movimiento lento y respuesta al diálogo sin destellos abruptos. No representa una reunificación obligatoria ni revela el origen común.

## Límites del alcance

Los diseños se guardan en este navegador y pueden exportarse. La copia de cuenta existente requiere un servidor con PostgreSQL; no equivale a una economía autoritativa ni acredita posesión de piezas frente a clientes modificados. No se incorporan compras ni mercado. Las pruebas automatizadas y WebGL por software no sustituyen pruebas en iPhone físico.

La publicación en Render se registra por separado: un merge a una rama de trabajo no es un despliegue.

## Evidencia

- 233 pruebas dirigidas: núcleo de diseños, compatibilidad, persistencia, estado, sugeridor, simulación, cooperativo del laboratorio, campaña, prólogo, marca, onboarding, ledger y resultados: pasan.
- 13 pruebas de render real en Chromium/SwiftShader: pasan. Incluyen 20 piezas × anclas × extremos en tres calidades, evolución, presupuestos y reconstrucción. Peor combinación medida en Baja: 27 llamadas y 16.186 triángulos (otra combinación: 16.636 triángulos).
- Guardado fallido → borrador intacto → reintento → diseño correcto equipado → recarga: pasa en navegador.
- HERALDO: captura revisada visualmente, 37 llamadas/12.710 triángulos en la escena aislada de previsualización.
- Build estático: 49,1 MB. La suite global de 90 archivos se interrumpió durante simulaciones largas; no se declara verde.
- Cooperativo general: 8 pruebas pasan, incluidas cuatro conexiones con latencia simulada, reconexión y recibos personales al terminar.
- Pulido móvil: acciones sin textos cortados, selección con objetivos de 44 px y selector de cámara compacto para dejar visible el cuerpo. Panel más opaco para leer sin interferencia del escenario.
