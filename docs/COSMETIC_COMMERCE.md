# Mercado cosmético — contrato comercial y estado real

## Disponible en este bloque
Colección dentro del juego, 32 fichas con SKU estable: 24 acabados adquiribles/equipables (8 gratis,16 por núcleos ganados) y 8 vistas previas de edición futura. Precio mostrado antes de confirmar, sin azar ni duplicados. Los núcleos actuales siguen siendo moneda de progresión ganada jugando; NO pueden comprarse con dinero. La colección se guarda localmente y el acabado sólo se muestra al dueño en partida.

No hay cobros ni compras con dinero en esta entrega. Un guardado editable del navegador no demuestra propiedad. El saneamiento descarta ediciones futuras incluso si alguien las agrega manualmente al perfil.

## Oferta monetizable propuesta
Venta directa de acabados premium y paquetes temáticos de identidad con precio final visible, sin cajas aleatorias, caducidad artificial ni compra de poder. Próximas categorías: retratos, marcos de perfil y poses de menú; cada categoría necesita implementación y gate antes de anunciarse como disponible. Evitar skins que reduzcan visibilidad del jugador o tapen señales de amenaza.

No vender: huéspedes con estadísticas, armas, daño, curación, revivir, experiencia, multiplicadores de drop, núcleos ni espacios de equipamiento. Mantener el mercado premium separado de la tienda de progresión. No convertir saldo premium en recursos de juego.

## Bloque necesario para cobrar
1. Identidad de cuenta autenticada y recuperación de cuenta; inventario remoto durable.
2. Catálogo de ofertas en servidor, precios/currency por región y SKU permitidos. El cliente envía sólo SKU, nunca importe ni saldo.
3. Orden pendiente con ID e idempotencia por cuenta. Checkout alojado en proveedor; no capturar datos de tarjeta en el juego.
4. Webhook firmado verificado en servidor. Confirmar estado con proveedor, importe, moneda y SKU; conceder una sola vez en transacción. Una URL de retorno o una captura de pago no otorgan productos.
5. Ledger de órdenes y derechos. Reintentos, duplicados y mensajes fuera de orden seguros; devoluciones/revocaciones actualizan propiedad sin tocar progreso ganado. Conciliación y alertas antes de habilitar.
6. Replicar sólo IDs de cosméticos cuyo derecho confirme el servidor; caída de servicio conserva el original y no bloquea jugar. Restauración de compras entre dispositivos.
7. Política de devolución, términos, privacidad, soporte y revisión de reglas de distribución según plataforma antes de publicar cobros.

## Pruebas que bloquean activación
Pago duplicado no duplica producto/cargo; webhook falso no concede; SKU ajeno o importe distinto rechaza; retorno de navegador no concede; compra cancelada no descuenta; devolución revoca sólo cosmético; caída/reintento recupera orden; dos compras simultáneas no duplican; saldo de progresión no puede comprarse. Precio definitivo y proveedor quedan por definir con la cuenta comercial del estudio.
