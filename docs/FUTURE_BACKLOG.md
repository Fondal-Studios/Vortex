# VORTEX — FUTURE_BACKLOG (sistemas diferidos de la Fase II)

> **Estado del documento**
> - Versión: 0.1 · Fecha: 2026-10-24 · Responsable: Claude (estudio)
> - SHA base: `62244b61eaecff34ba539fc4018456172579bf03` (rama canónica `claude/larga-con-eso-s43nfe`) · Rama de trabajo `claude/vortex-fase0-sprint1` @ `d009eec` · Archivo **sin commitear**
> - **Nivel de TODO lo que sigue: Diseñado (GDD §2.2, §8, §9 y §11 «Backlog Fase II»).** Nada de esto está Implementado, Probado, Mergeado ni Desplegado. La columna «Base en el repo hoy» solo dice qué código reutilizable existe; **no** significa que el sistema exista.
> - Regla (GDD §1 y §16): la demo no depende de ninguno de estos sistemas. No se marcan como hechos. Se preservan aquí para no perderlos.
> - Fuentes: [GDD.md](GDD.md) · [audit/MATRIZ_GAPS.md](audit/MATRIZ_GAPS.md) (filas GDD-2.2-01…09, GDD-8-01, GDD-9-01…04, GDD-10-05) · [COSMETIC_COMMERCE.md](COSMETIC_COMMERCE.md) · [TACTICAL_ACCOUNTS.md](TACTICAL_ACCOUNTS.md)
> - Hermanos: [ROADMAP.md](ROADMAP.md) · [AUDIT.md](AUDIT.md) · [QA_MATRIX.md](QA_MATRIX.md)

## Cómo leer cada épica

- **Esfuerzo / riesgo:** esfuerzo relativo (S, M, L, XL, XXL; XXL = varios meses de equipo, estimación gruesa sin compromiso) y riesgo (Bajo / Medio / Alto) con su motivo.
- **Interfaces previstas:** contratos o entidades conceptuales del GDD §10 (`HostDefinition`, `OwnedHost`, `GeneticLibrary`, etc.) que habría que crear. «Crear solo lo requerido por fase, con migraciones y versionado previstos» (GDD §10).
- **Criterios futuros de aceptación (CFA):** condiciones verificables para declarar la épica lista. Son propuestas; se afinarán al abrir cada épica.
- **Prerrequisitos transversales** (valen para casi todas): autoridad de servidor para recompensas e inventario (E5-01 de [ROADMAP.md](ROADMAP.md)), cuentas autenticadas con base persistente (E5-04), `RewardsLedger` idempotente, telemetría con consentimiento (E5-08) y una demo aprobada que no se rompa por añadir sistemas.

## Resumen

| Épica | Nombre | Esfuerzo | Riesgo | Depende de |
|---|---|---|---|---|
| F1 | Editor anatómico 3D tipo Spore | XXL | Alto | Anclajes y rigging (GDD §10), F2 parcial |
| F2 | Genética: biblioteca, herencia, investigación, hibridación, estabilidad y capacidad | XL | Alto | E5-01, F3 |
| F3 | Huésped oficial vs creación libre | L | Medio | F1 |
| F4 | Ramas, maestría, prestigio y legado | L | Medio | E5-06 |
| F5 | Glándulas personalizadas y skins por piezas | XL | Medio | F1, Monetización ética |
| F6 | Simbiontes: afinidad, memoria y muerte | XL | Alto | F2 |
| F7 | Armas orgánicas permanentes y desplegables | L | Medio | F6 parcial |
| F8 | Facciones, reputación, PvE/PvP, territorios, puntuación normalizada | XXL | Alto | E5-01, F9 |
| F9 | Temporadas mensuales, rankings, pases permanentes, contratos y logros | XL | Alto | Cuentas, ledger |
| F10 | Tienda cosmética ética y economía de biomasa y créditos | L | Alto | Cuentas, ledger, servidor |
| F11 | Comercio y subastas (no disponibles en demo) | XXL | Muy alto | F10, antifraude |
| F12 | Chat de voz y texto, matchmaking y salas públicas | XL | Alto | Moderación, privacidad |
| F13 | Definitivas combinadas y modo infinito separado | M a L | Medio | Coop estable (Sprint 4) |

---

## F1 — Editor anatómico 3D tipo Spore

**Descripción (GDD §2.2).** Edición progresiva de esqueleto, articulaciones, proporciones, postura, locomoción, extremidades y órganos; modos básico y avanzado; asistencia de IA opcional; previsualización de estadísticas; zona de pruebas.

| Subárea | Contenido previsto |
|---|---|
| Esqueleto | Plantillas de esqueleto compatibles, articulaciones editables con límites de rigging |
| Locomoción | Tipos de marcha asociados al esqueleto; validación de que cada uno tenga clips o retarget |
| Órganos | Ranuras de órgano (`OrganSlot`) colocables y escalables; solo los funcionales consumen presupuesto |
| IA de asistencia | Sugerencias opcionales para completar o validar un diseño; nunca obligatoria |
| Límites | Presupuesto de triángulos y llamadas de dibujo (hoy el tope es 20 000 triángulos y 45 llamadas en Low, con Seraf al 98 %), límites de rigging, validación de mutaciones y de cosméticos modulares |

- **Base en el repo hoy:** `src/arcanum/{rig,schema,parts,retarget}.js` (rig y piezas fijas) y `src/client/huesped-piezas.js`. Es base técnica reutilizable; **no existe editor**. Todos los Huéspedes comparten un esqueleto y clips de Arcanum (CC0).
- **Dependencias:** contratos de puntos de anclaje, esqueletos compatibles, límites de rigging (GDD §10); presupuesto gráfico ampliado y medido en dispositivos.
- **Interfaces previstas:** `HostDefinition` (identidad, silueta, esqueleto), `OrganSlot`, `HostLoadout`, validador de diseño (devuelve errores y estadísticas previstas).
- **Esfuerzo / riesgo:** XXL / Alto. Riesgo de rendimiento (cada pieza nueva rompe el presupuesto), de animación (compatibilidad cosmética y de animaciones es requisito técnico, no promesa automática) y de alcance.
- **CFA:** un diseño válido se guarda, carga y juega sin romper el presupuesto en dispositivo objetivo; el validador rechaza diseños fuera de límites con un mensaje claro; los Huéspedes oficiales conservan su estructura y habilidades distintivas; la zona de pruebas muestra estadísticas previstas igual que las reales; ningún cambio solo estético otorga ventaja encubierta.

## F2 — Genética avanzada

**Descripción (GDD §2.2).** Biblioteca compartida, absorción de muestras, investigación, hibridación, combinaciones conocidas y experimentales, registro permanente, límites de capacidad genética, estabilidad y compatibilidad. Las piezas funcionales afectan el rendimiento; **solo los cambios funcionales consumen presupuesto**. Evitar fallos aleatorios destructivos.

| Subárea | Contenido previsto |
|---|---|
| Biblioteca genética | `GeneticLibrary` permanente, compartida entre Huéspedes de una cuenta |
| Herencia | Qué rasgos pasan a una hibridación; reglas explícitas y visibles |
| Investigación | Muestras absorbidas que se convierten en conocimiento; costo en recursos ganados jugando |
| Hibridación | Combinaciones conocidas (catálogo) y experimentales (con previsualización) |
| Estabilidad y capacidad | Capacidad genética limitada; estabilidad como riesgo comunicado, sin pérdidas aleatorias destructivas |

- **Base en el repo hoy:** órganos y mutaciones por oleada (`WEAPON_ORGANS`, `CHAMP_ORGANS`, `UPGRADE_KINDS`), esencias, materiales; códice de fauna con «híbridos» (`perfil.js:454`) que es registro, no hibridación.
- **Dependencias:** F1 (anatomía), `RewardsLedger`, definición de biomasa de misión frente a permanente.
- **Interfaces previstas:** `GeneticLibrary`, `Mutation`, `HostMastery`, `EvolutionLegacy` (relación con F4).
- **Esfuerzo / riesgo:** XL / Alto (reglas de balance y de fraude; riesgo de inflar el HUD).
- **CFA:** toda combinación es determinista y reproducible; no hay pérdida definitiva aleatoria; el registro es permanente; la capacidad se muestra antes de confirmar; una prueba de idempotencia evita duplicar muestras por reintentos de red.

## F3 — Huésped oficial vs creación libre

**Descripción (GDD §1 y §2.2).** Los 8 Huéspedes oficiales (y los que lleguen) conservan identidad, silueta, historia, estilo marcial, habilidades y progresión propios. La creación de Huéspedes originales por hibridación y anatomía libre es **posterior** y **no sustituye** el coleccionismo.

- **Reglas previstas:** el Huésped oficial no es editable en su estructura característica (solo cosméticos y mutaciones permitidas); el creado por el jugador vive en un espacio aparte, con etiqueta; las recompensas y desbloqueos oficiales no se obtienen con creaciones libres.
- **Base en el repo hoy:** 8 Huéspedes con datos y arte propios; 5 clases heredadas (`legacy`) que habría que decidir si se retiran (E3-05).
- **Dependencias:** F1; decisión D-C3 (Huésped inicial).
- **Interfaces previstas:** `HostDefinition.kind = official | custom`; `OwnedHost` con origen.
- **Esfuerzo / riesgo:** L / Medio (confusión entre oficial y creado; compatibilidad de animaciones).
- **CFA:** el selector de misión distingue ambos; ningún Huésped oficial puede perder lo que lo define; un Huésped creado pasa el mismo control de presupuesto que uno oficial.

## F4 — Ramas evolutivas, maestría, prestigio y legado

**Descripción (GDD §5).** Formas evolutivas por ramas distintas (velocidad, resistencia, potencia…); rama irreversible salvo reinicio a forma inicial. **Reinicio con legado:** guarda historial de linajes y reconocimientos cosméticos, conserva colección, compras, progreso de conciencia y biblioteca genética. **Antes de codificar, definir exactamente qué XP y maestría del Huésped se conserva para que nunca haya borrado accidental.** Prestigio opcional, principalmente cosmético, separado del reinicio. Maestría por experiencia, retos y evolución, no simplemente daño extra.

- **Base en el repo hoy:** `EVO_PATHS` (4 niveles × 2 caminos), Colmena con caminos propios, `reiniciarArbol` (costo 25 %), maestría de rangos 1–10 con multiplicadores pequeños de daño. **Ausente:** legado, prestigio, linajes de Huésped (existe `LINEAGE` para armas, otro concepto).
- **Dependencias:** E5-06 (documento de reglas de conservación aprobado antes de programar); F2 si el legado toca la biblioteca.
- **Interfaces previstas:** `EvolutionBranch`, `EvolutionLegacy`, `HostMastery`, `Achievement`.
- **Esfuerzo / riesgo:** L / Medio (riesgo de pérdida accidental de progreso; contradicción actual con «no simplemente daño extra», C11).
- **CFA:** una prueba de reinicio demuestra que no se pierde colección, compras ni biblioteca; la regla de qué se conserva está escrita y firmada; el prestigio no otorga poder; hay confirmación explícita y reversible durante un plazo antes de cualquier reinicio.

## F5 — Glándulas personalizadas y skins por piezas

**Descripción (GDD §2.2).** Órganos y glándulas visibles, colocables y escalables; **la posición y el tamaño cosméticos no deben otorgar ventajas encubiertas**. Cosméticos por Huésped y por pieza modular (glándulas, órganos, extremidades, simbiontes, armas), skins completas, evolutivas y variantes compatibles con la anatomía; diseños anatómicos guardados.

- **Base en el repo hoy:** 32 SKU de «acabados» de material (4 por Huésped), `cosmetic-material.js`, `organism-skin.js`. **No hay** skins por pieza, de diseño, poses ni marcos.
- **Dependencias:** F1 (piezas con anclajes), F10 (tienda ética), contrato de compatibilidad por anatomía.
- **Interfaces previstas:** `CosmeticOwnership` por SKU de pieza; mapa de compatibilidad pieza–anatomía; validador de «cosmético sin efecto».
- **Esfuerzo / riesgo:** XL / Medio (explosión de combinaciones; ocultar hitbox o señales de amenaza).
- **CFA:** un cosmético no cambia hitbox, daño ni visibilidad de señales de amenaza (prueba automática); toda combinación listada se renderiza sin romper el presupuesto; una pieza incompatible se rechaza antes de la compra.

## F6 — Simbiontes: afinidad, memoria y muerte

**Descripción (GDD §2.2).** Simbiontes pasivos, ofensivos e inteligentes; afinidad, personalidad, recuerdos, evolución conjunta; incapacidad, separación temporal o mutación en ciertas muertes, **sin pérdida definitiva aleatoria**. Mutaciones por decisiones y causas de muerte.

- **Base en el repo hoy:** `enjambre.js` y `colmena-data.js` (zánganos de Colmena), órganos de arma. No hay afinidad, memoria ni consecuencia de muerte.
- **Dependencias:** F2 (biblioteca), `HostMastery`, narrativa de recuerdos (E3-07).
- **Interfaces previstas:** `Symbiont` (tipo, afinidad, personalidad, memoria), eventos de muerte con efecto reversible.
- **Esfuerzo / riesgo:** XL / Alto (diseño de IA, sincronización en coop, duplicación de simbionte).
- **CFA:** la muerte nunca borra definitivamente un simbionte; el estado se sincroniza en coop sin duplicados; la afinidad no otorga poder oculto; todas las consecuencias se explican en la interfaz.

## F7 — Armas orgánicas permanentes y desplegables

**Descripción (GDD §2.2).** Armas orgánicas permanentes, desplegables y simbióticas; transformación animada; integración de armas tecnológicas; **tres ranuras simples: arma principal, modificación orgánica, accesorio pasivo.**

- **Base en el repo hoy:** `NATIVE_MELEE` (arma innata de los 8), `melee-models.js`, `hostfx-melee.js`, `SIGNATURES` de armas firma (solo 5), arsenal de armas tecnológicas en `items.js`.
- **Dependencias:** F6 (simbióticas), F5 (cosméticos), contrato de 3 ranuras.
- **Interfaces previstas:** `HostLoadout` con tres ranuras; animación de despliegue.
- **Esfuerzo / riesgo:** L / Medio (animación 1.ª persona; balance contra el arsenal actual).
- **CFA:** el cambio de arma en caliente no corta combos; las tres ranuras se persisten y validan en servidor; cada arma orgánica tiene hit confirmado con sonido correcto (AC-07 extendido).

## F8 — Facciones, reputación, PvE/PvP, territorios y puntuación normalizada

**Descripción (GDD §8).** Afiliación optativa y cambiable con reputación por facción y algunas consecuencias permanentes; conflictos narrativos; PvE de facción y **PvP opcional**; territorios disputados por contribución PvE y PvP con controles anti-facciones multitudinarias; puntuación **normalizada** y límites de contribución; eventos de recuperación; control mensual; bonos temporales moderados que terminan con la temporada; sin ventajas acumulativas imparables.

- **Base en el repo hoy:** `territorios-ui.js` y `perfil.js:137-160`: «territorio» hoy = arena liberada y bendición, sin facciones ni PvP.
- **Dependencias:** F9 (calendario mensual), `RewardsLedger`, anticheat, moderación, servidor autoritativo de contribución (`PlayerContribution`).
- **Interfaces previstas:** `FactionMembership`, `FactionReputation`, `TerritoryState`, `Season`.
- **Esfuerzo / riesgo:** XXL / Alto (PvP y equilibrio; fraude; fuga de poder entre temporadas).
- **CFA:** la puntuación se normaliza por participantes; ningún jugador o grupo domina por volumen; los bonos caducan con la temporada; el PvP es opcional y no bloquea progreso; reversión controlada de resultados fraudulentos.

## F9 — Temporadas mensuales, rankings, pases, contratos y logros

**Descripción (GDD §8).** Temporadas mensuales; rankings separados (supervivencia, desempeño individual, cooperativo, facciones); campaña y progreso permanente no se reinician; pases gratuitos y premium **permanentes y completables después de terminar la temporada**; misiones diarias y semanales; contratos acumulables; logros tradicionales, secretos y de especialización; **sin mecánicas coercitivas de conexión diaria**.

- **Base en el repo hoy:** trofeos (`trophy()`), sin sistema de logros persistente, sin temporadas ni rankings.
- **Dependencias:** cuentas, `RewardsLedger`, `Achievement`, F10 (pase premium), antifraude de rankings.
- **Interfaces previstas:** `Season`, `Achievement`, contratos como `MissionDefinition` de larga duración.
- **Esfuerzo / riesgo:** XL / Alto (calendario operativo; coerción; fraude de ranking).
- **CFA:** perder un día no pierde recompensas; el pase comprado sigue completable tras la temporada; rankings con anti-trampa documentado; los premios son idempotentes.

## F10 — Tienda cosmética ética y economía de biomasa y créditos

**Descripción (GDD §9).** Biomasa de misión (curación y transformación temporal) y biomasa de progresión (evolución permanente); materiales genéticos; créditos ganados jugando; moneda premium cosmética. Cosméticos premium pueden aparecer también como recompensa gratuita. Claridad de la interfaz.

- **Base en el repo hoy:** núcleos (`perfil.cores`) como moneda ganada, esencias de 4 tipos, materiales. **No hay** biomasa dual ni moneda premium (correcto para la demo).
- **Dependencias:** véase la sección «Monetización ética» más abajo; D-C1 (qué hace hoy la tienda de núcleos).
- **Interfaces previstas:** `CosmeticOwnership`, catálogo de ofertas en servidor, `RewardsLedger`.
- **Esfuerzo / riesgo:** L / Alto (pagos reales; cumplimiento).
- **CFA:** los de «Monetización ética» y la lista de pruebas bloqueantes de [COSMETIC_COMMERCE.md](COSMETIC_COMMERCE.md).

## F11 — Comercio y subastas (NO disponibles en la demo)

**Descripción (GDD §2.2 y §9).** Solo después de la demo. Primero cosméticos intercambiables, luego ciertos materiales; por último mercado y casa de subastas sujetos a antifraude, controles económicos y antip2w. La economía interpersonal exigirá prevención de duplicados, lavado de moneda, fraude, límites por cuenta, auditoría y reversión controlada.

- **Estado hoy:** no existe ningún comercio entre jugadores (verificado por grep en la auditoría); la Tienda del Cambista es un NPC, no P2P. **No se debe anunciar.**
- **Dependencias:** F10, ledger de servidor con auditoría, antifraude, cuentas verificadas.
- **Interfaces previstas:** orden de intercambio con ID e idempotencia, estado de custodia, registro inmutable.
- **Esfuerzo / riesgo:** XXL / Muy alto (economía abierta, fraude, normativa).
- **CFA:** ningún duplicado posible bajo carga y reintentos; límites por cuenta; reversión controlada con rastro; prueba de lavado de moneda; no se comercian ventajas funcionales (AC-11).

## F12 — Chat de voz y texto, matchmaking y salas públicas

**Descripción (GDD §2.2 y §7).** Emparejamiento automático, navegador de salas, salas públicas, chat de texto y de voz **opcionales**, con **bloqueo, silencio y denuncia**. Primera entrega ya en demo: ping y mensajes rápidos (hoy solo ping).

- **Base en el repo hoy:** salas privadas con código (`server.js`), ping. Sin chat ni emparejamiento.
- **Dependencias:** moderación, política de privacidad y de menores, reportes, cuentas.
- **Interfaces previstas:** servicio de emparejamiento, canal de chat con filtros, cola de denuncias.
- **Esfuerzo / riesgo:** XL / Alto (moderación, privacidad, costo de voz).
- **CFA:** bloquear y silenciar funcionan y persisten; denuncias llegan a una cola con registro; el chat es opcional y apagable; sin recoger datos personales innecesarios.

## F13 — Definitivas combinadas y modo infinito separado

**Descripción (GDD §2.2 y §7).** Sinergias de coop avanzadas y **combinaciones de definitivas** (individuales desde la demo; combos posteriores; ninguna combinación obligatoria). **Modo supervivencia infinita separado** de campaña y supervivencia estándar, con rankings y récords propios; **nunca** cambiar a oleadas infinitas una misión finita.

- **Base en el repo hoy:** ultis por Huésped; el Campo de pruebas y `?horde=1` son rutas sin fin pero no son misiones. Un modo infinito hoy reusaría `Game` sin separación.
- **Dependencias:** coop estable (Sprint 4), F9 (rankings propios).
- **Interfaces previstas:** `MissionDefinition.mode = endless` con contador y récord; sinergias declaradas en datos.
- **Esfuerzo / riesgo:** M a L / Medio (balance; mantener la finitud de las misiones estándar).
- **CFA:** el modo infinito no es alcanzable desde una misión finita (prueba automática); el ranking infinito es separado; las combinaciones de definitivas son opcionales y probadas en coop.

---

## Monetización ética

Documento contractual existente: [COSMETIC_COMMERCE.md](COSMETIC_COMMERCE.md). Estado real hoy: **no hay cobros ni compras con dinero**; los 32 SKU cosméticos son acabados ganados o comprados con núcleos (que no se compran con dinero real). Lo que sigue define reglas para cuando se decida cobrar. Todo es **Diseñado**.

### Qué se puede vender (cuando exista infraestructura)

| Producto | Regla |
|---|---|
| Cosméticos por pieza (glándulas, órganos, extremidades, simbiontes, armas) | Solo estética; no cambian hitbox, daño, visibilidad de señales de amenaza ni stats |
| Skins completas, evolutivas y variantes por anatomía | Compatibles con animaciones; se anuncian solo tras pasar el control de compatibilidad |
| Bundle cosmético (paquete temático de identidad) | Precio final visible; contenido listado; sin elementos aleatorios; sin caducidad artificial |
| Pase de temporada | Gratuito y premium; **sin ventaja de poder**; el comprado sigue completable después de terminar la temporada (GDD §8) |
| Retratos, marcos de perfil, poses de menú | Categorías «próximas» en COSMETIC_COMMERCE, aún inexistentes |

### Qué no se vende (nunca)

Huéspedes con estadísticas, armas, daño, curación, revivir, experiencia, multiplicadores de drop, núcleos, ranuras de equipamiento, órganos o habilidades funcionales (GDD §13 AC-11: «nada de habilidades u órganos funcionales disponibles exclusivamente por dinero»). El mercado premium se mantiene **separado** de la tienda de progresión, y el saldo premium **no se convierte** en recursos de juego.

### Sin pay-to-win

Los desbloqueos jugables se consiguen jugando. Los núcleos y créditos se ganan jugando. Cosméticos premium pueden aparecer también como recompensa gratuita específica. Rareza refleja obtención o diseño, no superioridad numérica.

### Reglas anticoerción

- Sin misiones ni recompensas que castiguen no conectarse un día; las diarias y semanales no pierden valor si se saltan (GDD §8).
- Sin cajas aleatorias pagadas, sin cuentas regresivas artificiales de compra, sin escasez fabricada, sin precios ocultos ni conversión opaca entre monedas.
- Precio final visible antes de confirmar; confirmación explícita; política de devolución; soporte.
- Sin presión social dirigida a menores; sin recopilación innecesaria de datos.
- Un cosmético no puede reducir la visibilidad del jugador ni tapar señales de amenaza.

### Qué requiere ledger, servidor y cuentas **antes** de cobrar

Se toma del contrato de [COSMETIC_COMMERCE.md](COSMETIC_COMMERCE.md) («Bloque necesario para cobrar») y de [TACTICAL_ACCOUNTS.md](TACTICAL_ACCOUNTS.md):

| Requisito | Estado hoy |
|---|---|
| Identidad de cuenta autenticada, recuperación e inventario remoto durable | Cuentas con usuario/contraseña existen, pero el respaldo es manual y el perfil es progreso declarado por el cliente; sin `DATABASE_URL` (base contratada) las cuentas responden 503 |
| Catálogo de ofertas en servidor; el cliente envía solo SKU, nunca importe ni saldo | **Ausente** |
| Orden pendiente con ID e idempotencia por cuenta; checkout alojado en un proveedor (no capturar tarjetas en el juego) | **Ausente** |
| Webhook firmado verificado en servidor; conceder una sola vez en transacción | **Ausente** |
| Ledger de órdenes y derechos; reintentos, duplicados y mensajes fuera de orden seguros; devoluciones que revocan solo el cosmético | **Ausente** (hoy no hay `RewardsLedger`; el cierre de partida tampoco es idempotente, P0) |
| Réplica solo de IDs cuyo derecho confirme el servidor; restauración de compras entre dispositivos | **Ausente** |
| Política de devolución, términos, privacidad, soporte y revisión de reglas de plataforma | **Ausente** |
| Pruebas bloqueantes (pago duplicado, webhook falso, SKU ajeno, importe distinto, retorno de navegador, compra cancelada, devolución, caída y reintento, compras simultáneas, saldo de progresión no comprable) | **Ausentes**; deben pasar antes de activar |

**Conclusión:** no se puede cobrar hoy. El primer paso de ingeniería es el ledger idempotente (E1-06 y E5-01 de [ROADMAP.md](ROADMAP.md)), que además corrige un P0 del juego actual.

## Qué no entra en el backlog como «hecho»

Nada. Este archivo no contiene ítems implementados. Si una épica avanza, debe moverse a [ROADMAP.md](ROADMAP.md) con su sprint, issues y pruebas, y registrarse en [AUDIT.md](AUDIT.md) con evidencia.
