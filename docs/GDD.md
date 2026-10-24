# VORTEX — GDD (documento maestro de diseño, producción y QA)

> **Estado del documento**
> - Versión del GDD: **1.0** (24 de octubre de 2026, del propietario). Versión de este archivo: 1.0-repo.1 · Fecha: 2026-10-24
> - SHA base: `62244b61eaecff34ba539fc4018456172579bf03` (rama canónica `claude/larga-con-eso-s43nfe`); rama de trabajo `claude/vortex-fase0-sprint1` @ `d009eec`; este archivo aún **sin commitear**
> - Responsable: Claude (estudio) · Autoridad del contenido de las secciones 1–16: el propietario (Fondal Studios)
> - Qué es: el GDD **versionado en el repositorio**. Las secciones 1–16 reproducen el documento normativo («VORTEX — Documento maestro») reformateado en Markdown, sin recortes ni reinterpretaciones. Al final se añaden dos secciones de estudio: «Diferencias diseño vs código» y «Decisiones del propietario y contradicciones».
> - Distinción de niveles: todo lo que dice el GDD es **Diseñado**. Nada de lo que dice implica que esté Implementado, Probado, Mergeado o Desplegado; para eso véanse [AUDIT.md](AUDIT.md) y [QA_MATRIX.md](QA_MATRIX.md).
> - Documentos hermanos: [AUDIT.md](AUDIT.md) · [ROADMAP.md](ROADMAP.md) · [QA_MATRIX.md](QA_MATRIX.md) · [20_PERSONAS_SIMULADAS.md](20_PERSONAS_SIMULADAS.md) · [FUTURE_BACKLOG.md](FUTURE_BACKLOG.md) · [DEMO_RELEASE_CHECKLIST.md](DEMO_RELEASE_CHECKLIST.md) · [RELEASE_NOTES.md](RELEASE_NOTES.md)

**Fondal Studios | Versión de diseño 1.0 | 24 de octubre de 2026**

- Repositorio oficial confirmado por el propietario: https://github.com/Fondal-Studios/Vortex
- Nombre anterior del proyecto: Shower Psycho.
- Destino operativo: Claude, con acceso autorizado al repositorio.
- Estado (según el propio documento): especificación de producto acordada; **no equivale a funcionalidad implementada ni verificada**.

---

# Parte A — Documento maestro (v1.0, texto del propietario)

## 1. Visión y principios no negociables
- VORTEX es un videojuego de supervivencia, acción y ciencia ficción psicodélica, centrado en una conciencia digitalizada que ocupa huéspedes biológicos. Su identidad combina combate melee y shooter, transformación orgánica, supervivencia por misiones con final, decisiones narrativas, coleccionismo de huéspedes y cooperativo accesible. El jugador debe entender rápidamente qué hacer, por qué hacerlo y cuándo ha vencido.
- Sobrevivir tiene un final. En campaña y misiones independientes estándar se supera un número finito de oleadas y/o objetivos. La victoria ocurre al cumplir el objetivo y finalizar la misión. Un modo de oleadas infinitas será independiente, opcional y posterior si no está listo.
- Demo primero. Liberar solamente funciones que superen controles de calidad; sistemas ambiciosos no deben bloquear el lanzamiento.
- No pay-to-win. Compras estéticas sin poder adicional; desbloqueos jugables conseguidos jugando.
- Cada huésped importa. Identidad, silueta base, historia, estilo marcial/armamento, habilidades y progresión propios. No sustituir el coleccionismo por un creador libre.
- Accesibilidad y claridad. HUD limpio, controles sencillos, objetivos visibles, tutorial integrado, compatibilidad móvil/escritorio.
- No inventar estado. Claude debe verificar archivos, ramas, assets, tests, despliegues y juego real antes de reportar avances.

## 2. Alcance por etapas

### 2.1 Demo pública — objetivo de producto
- Auditar e integrar lo ya existente: todos los huéspedes disponibles que puedan alcanzar calidad suficiente, sin límite arbitrario de cuatro; inventariar huecos.
- Campaña propuesta de seis capítulos y seis arenas, objetivo de 8–12 minutos por capítulo. Solo publicar capítulos terminados y aprobados; el plan completo sigue siendo seis.
- Primer capítulo Islas — Despertar: conciencia aparece en huésped tras cinemática de transferencia de 20–30 segundos (reemplaza la introducción del tren), tutorial jugable integrado de aproximadamente tres minutos, supervivencia de oleadas finitas y conclusión narrativa. Los números de oleadas son configurables y se validan empíricamente.
- Combate fluido melee/shooter, especialización propia de cada huésped, un ataque básico, dos habilidades y una definitiva en diseño objetivo; desbloqueo gradual de habilidades durante la introducción. Si el código existente difiere, documentar migración y priorizar experiencia coherente.
- Cámaras primera y tercera persona mediante botón, tercera como inicial; transiciones sin cortar combos, disparos ni habilidades. Mejorar especialmente manos, armas y golpes melee en primera persona.
- HUD compacto estilo Wild Rift: retrato/vida/escudo inferior, colores distinguibles, tiempo pequeño, minimapa, objetivo/progreso de misión, contador «Oleada X/Y», botones de habilidades con enfriamiento, cambio de cámara y alertas contextuales. Diseño responsive.
- Enemigos comunes comprensibles y élites/jefes diferenciados. Colisiones reales, daño e impacto sincronizados; no reproducir sonido de impacto cuando el ataque falla. Animaciones y efectos contundentes sin saturar.
- Misiones independientes con objetivos claros, oleadas finitas y recompensas; cooperativo de hasta cuatro jugadores con salas privadas y códigos; bots opcionales simples y fiables.
- Bots: seguir, atacar enemigos próximos y reanimar cuando sea posible; sin gestión táctica compleja para la demo. Priorizar objetivos de misión y evitar atascos.
- Reconexión cooperativa: bot sustituto temporal, recuperación del control al volver, sesión e inventario consistentes; manejo de abandono, caída simultánea y resultados.
- Selección de un huésped inicial al comienzo; el resto desbloqueable mediante campaña, desafíos, exploración y eventos según cada huésped. Seleccionar un huésped de la colección antes de cada misión, sin cambio libre durante la partida; transferencia excepcional narrativa por muerte no es un selector de combate.
- Progresión permanente básica de conciencia y huésped; cuenta/persistencia verificable, maestría y recompensas. Módulos avanzados solo si ya están implementados y pasan QA.
- Códice mínimo: colección de huéspedes, fichas/modelos, habilidades, historia y modo de obtención; logros iniciales de campaña/supervivencia.
- Menú central futurista ágil, sin base 3D explorable obligatoria. Acceso a campaña, misiones, cooperativo, colección, evolución, ajustes, resultados.
- Para demo: sin comercio entre jugadores; no exigir tienda o pagos activos para dar por terminada una demo. Preservar arquitectura segura de cosméticos.

### 2.2 Expansiones posteriores priorizadas
- Editor anatómico 3D inspirado en Spore: edición progresiva de esqueleto, articulaciones, proporciones, postura, locomoción, extremidades y órganos; modos básico/avanzado, asistencia de IA opcional, previsualización de estadísticas y zona de pruebas. Los huéspedes oficiales preservan estructuras características y habilidades distintivas.
- Genética avanzada: biblioteca compartida, absorción de muestras, investigación, hibridación, combinaciones conocidas y experimentales, registro permanente, límites de capacidad genética, estabilidad y compatibilidad. Las piezas funcionales afectan el rendimiento; solo los cambios funcionales consumen presupuesto. Evitar fallos aleatorios destructivos.
- Mutaciones por decisiones y causas de muerte; biomasa de misión versus biomasa permanente; órganos y glándulas visibles, colocables y escalables. La posición/tamaño cosméticos no deben otorgar ventajas encubiertas.
- Simbiontes pasivos, ofensivos e inteligentes; afinidad, personalidad, recuerdos, evolución conjunta; incapacidad, separación temporal o mutación en ciertas muertes, sin pérdida definitiva aleatoria.
- Armas orgánicas permanentes, desplegables y simbióticas; transformación animada, integración de armas tecnológicas, tres ranuras simples: arma principal, modificación orgánica, accesorio pasivo.
- Cosméticos por huésped y por pieza modular (glándulas, órganos, extremidades, simbiontes, armas), skins completas, evolutivas y variantes compatibles con anatomía; diseños anatómicos guardados; tienda puramente estética.
- Creación de huéspedes originales por hibridación y anatomía libre en etapa posterior; no sustituye la colección de huéspedes oficiales. Compatibilidad cosmética y animaciones es requisito técnico, no promesa automática.
- Facciones jugables, afiliación flexible con reputación por facción y algunas consecuencias permanentes; misiones narrativas y PvE, guerras territoriales PvE + PvP opcional, puntuación normalizada, límites de contribución, eventos de recuperación, control mensual, bonos temporales moderados.
- Temporadas mensuales, rankings separados, pases gratuitos/premium permanentes adquiridos, cosméticos, eventos, misiones diarias/semanales y contratos acumulables.
- Comercio solo después de demo: inicialmente cosméticos intercambiables, luego ciertos materiales, mercado/casa de subastas sujeto a antifraude, controles económicos y antip2w.
- Emparejamiento automático, navegador de salas, chat de texto/voz opcional con bloqueo, silencio y denuncia, combinaciones de definitivas y sinergias de coop avanzadas.
- Modo supervivencia infinita separado de campaña y supervivencia estándar: rankings y récords propios, no cambiar nunca a oleadas infinitas una misión finita.

## 3. Campaña, historia y contenido
- Seis capítulos / seis arenas; la identidad y orden exactos de las arenas 2–6 se obtendrán del repositorio, no se inventarán. El capítulo 1 se llama Islas — Despertar.
- Primera experiencia breve y cinematográfica: conciencia digitalizada aparece en un huésped; misterios sobre IA, genoma humano, digitalización, vórtice, sociedades y mortalidad se revelan gradualmente.
- Historia principal clara y lineal en progresión, con dos o tres decisiones morales decisivas, recuerdos y posibles finales alternativos. No bloquear capítulos por farmeo obligatorio.
- Algunas criaturas comunes son restos de almas humanas (daño colateral); algunos élites/jefes contienen conciencias recuperables. Conservar distinción entre enemigos, huéspedes, especies, facciones y conciencias.
- Cada capítulo define inicio, objetivos, contador finito (cuando haya oleadas), cambios ambientales relevantes, encuentro final y condición inequívoca de victoria/derrota; cerrar con cinemática/transición y desbloquear siguiente.
- Pueden repetirse capítulos con distintos huéspedes/dificultades, anomalías, objetivos secundarios, secretos y decisiones. Primera pasada mantiene dirección narrativa controlada.
- Misiones secundarias no obligatorias: combate, muestras, rescate de conciencias, recuerdos, desafíos de huésped y secretos. Las misiones largas son operaciones separadas.
- Misiones independientes y coop de 5–15 minutos: supervivencia finita, defensa, rescate, destrucción, expedición, recuperación de muestras y jefes. Objetivos claros y completables.
- Entornos dinámicos: seis arenas con variaciones de anomalías, clima, visibilidad, rutas, zonas seguras, enemigos y objetivos; cambios jugables, no solo decorativos.
- Eventos aleatorios ambientales, de combate y narrativos, incluyendo raros descubrimientos; anunciar eventos claramente, con límites para no interrumpir el objetivo.

## 4. Oleadas, derrota y resultados
- Oleadas finitas por misión, variando entre combate, defensa, mecanismos, supervivencia cronometrada y eventos narrativos. Jefes/desafíos finales donde corresponda.
- Descansos configurables orientativos de 10–20 segundos; recuperación limitada, preparación breve, tres mejoras temporales a elegir; en coop contador sincronizado.
- Mejoras temporales de daño, velocidad, cadencia, escudo, regeneración, glándulas y mutaciones combinables. Desaparecen al terminar la misión, sin borrar botín ni XP permanentes.
- Derrota: reinicio completo por defecto en misiones independientes; checkpoints narrativos excepcionales en campaña, oportunidades limitadas de resurrección. Equipo totalmente caído = derrota.
- Reanimación: acercamiento/interacción con tiempo limitado, recursos biológicos y habilidades opcionales, restricción de usos; jugador definitivamente caído observa y puede volver entre oleadas o mediante objetivos especiales con límites.
- Recompensas tras fracaso: parte de XP/biomasa, recursos por hitos; recompensas principales y desbloqueos de victoria requieren completar la misión.
- Resultados: victoria/derrota, oleadas X/Y, tiempos, objetivos, estadísticas y aportes de apoyo, XP, biomasa, botín, maestría y desbloqueos; resumen principal y detalles expandibles. Botones reintentar y menú.

## 5. Progresión, huéspedes y colección
- La conciencia posee árbol y progresión permanentes compartidos, recuerdos y herencia limitada de habilidades; no inflar botones del HUD.
- Cada huésped tiene nivel, experiencia, maestría, mutaciones, historia, recuerdos, estilo de combate y evolución individual. Progresión asistida moderada para nuevos huéspedes si la conciencia ya es avanzada.
- Huéspedes obtenidos por historia, jefes/absorción específica, desafíos, expedición y descubrimientos. Rareza refleja obtención/diseño, no superioridad numérica.
- Formas evolutivas por ramas distintas (velocidad, resistencia, potencia, etc.), no evolución lineal forzosa. Rama elegida irreversible salvo reinicio a forma inicial.
- Reinicio con legado: guarda historial de linajes experimentados y reconocimientos cosméticos; conservar colección, compras, progreso de conciencia y biblioteca genética. Antes de codificar, definir exactamente qué XP/maestría del huésped se conserva para que nunca haya borrado accidental.
- Prestigio opcional por evolución, linajes y desafíos, principalmente cosmético, separado del reinicio. Maestría por experiencia, retos y evolución, no simplemente daño extra.
- Códice en Criaturas, Genética y Evolución, con galería 3D, historia, registros y progreso. Colecciones por cantidad, temas/facciones y dominio, con recompensas permanentes y cosméticas.
- Recuerdos por huésped: registros, escenas, decisiones y misiones opcionales. Más contenido narrativo en expansiones.

## 6. Combate, enemigos, audio y UX
- Huéspedes con especialidad melee/shooter inicial; estilos alternativos por equipamiento/evolución. Combos y animaciones de artes marciales únicos; golpes fluidos, impacto visual real y señales auditivas correctas.
- Un ataque básico, dos habilidades y una definitiva como esquema objetivo de controles; poderes se desbloquean gradualmente durante la enseñanza; controles y cooldowns visibles.
- Audio: música cinematográfica electrónica/oscura adaptativa, psicología de conciencia, voces fragmentadas, sonidos de anomalía y firma sonora por huésped. Movimiento al aire suena distinto al impacto confirmado; evitar mareo sonoro/visual.
- Enemigos comunes previsibles/variados; élites coordinados, cobertura/emboscada; jefes con fases, evolución y conciencia narrativa. No sustituir inteligencia con vida excesiva.
- Jefes coop escalan comportamiento, patrones y resistencia según 1–4 integrantes; todos vencibles en solo o coop.
- Movimiento simple de base — caminar, correr, saltar y esquivar — con movilidad avanzada dependiente del huésped/mutaciones y un sistema de colisiones confiable.
- Visualizar objetivo principal, progreso, minimapa, marcadores discretos y asistencia contextual opcional. Hud cooperativo: retratos, vida/escudo, minimapa, alertas caídos, detalles bajo demanda.

## 7. Cooperativo y redes
- Hasta cuatro humanos. Salas privadas con códigos en demo; después emparejamiento y salas públicas. Bots opcionales, seleccionados de huéspedes desbloqueados cuando técnicamente viable.
- Bot sencillo: seguir, ataque cercano, revivir si seguro, atención a objetivos, sin comandos tácticos; sustituir desconectados por bots, recuperar sesión y huésped al volver.
- Dificultad por tamaño/nivel del equipo, normalización temporal moderada para novatos; progresión permanente intacta.
- Botín personal y no disputado, recompensa base por misión para todos los participantes legítimos, bonos moderados por contribución (daño, objetivos, apoyo, revivir) sin sesgo contra apoyo; reglas anti-AFK.
- Reanimación, espectador temporal y regreso limitado en frontera de oleada o por objetivo; no bloquear a alguien varios minutos sin necesidad.
- Ping/marcadores y mensajes rápidos como primera entrega; voz y texto futuros con privacidad, bloqueo y denuncia.
- Habilidades de apoyo y sinergias opcionales, definitivas individuales desde demo, combos entre definitivas posteriores; ninguna combinación obligatoria.
- Manejar host desconectado, reconexión, duplicación de bot/huésped, idempotencia en premios, sincronización de temporizadores, latencia y pérdida de paquetes.

## 8. Facciones, temporadas, progresión social
- Facciones jugables: afiliación optativa y cambio permitido con reputación por facción y consecuencias narrativas; conservar desbloqueos adquiridos.
- Conflictos narrativos, PvE de facción y PvP opcional en expansiones. Territorios disputados mediante contribución PvE y PvP, controles anti-facciones multitudinarias y resultados mensuales.
- Beneficios territoriales: cosméticos, eventos, misiones y bonificaciones moderadas temporales que terminan con temporada. No crear ventajas acumulativas imparables.
- Ranking mensual separado de supervivencia, desempeño individual, cooperativo y facciones. La campaña y el progreso permanente no se reinician.
- Pase de temporada gratuito/premium; pases comprados completables después de que termine la temporada; nada p2w.
- Misiones diarias, semanales, contratos acumulables, logros tradicionales/secretos/de especialización. No diseñar mecánicas coercitivas de conexión diaria.

## 9. Economía y comercio
- Biomasa de misión para curación/transformación temporal y biomasa de progresión para evolución permanente; materiales genéticos, créditos ganados jugando y moneda premium cosmética. Mantener claridad de la interfaz.
- Piezas jugables, capacidades y huéspedes se obtienen jugando; skins y acabados de órganos/glándulas, armas y simbiontes son cosméticos. Cosméticos premium también pueden aparecer en recompensas gratuitas específicas.
- No comercio ni subastas en demo. La futura economía interpersonal exigirá prevención de duplicados, lavado de moneda, fraude, límites por cuenta, auditoría y reversión controlada.

## 10. Arquitectura orientativa y persistencia
- Claude determinará el stack real después de la auditoría. No reescribir sin necesidad. Proponer separación entre datos del huésped, identidad genética, apariencia modular, configuración de partida, sesión cooperativa, progreso de conciencia, cuenta/persistencia, misiones, eventos, economía y telemetría.
- Entidades conceptuales: Account, ConsciousnessProgress, HostDefinition, OwnedHost, HostMastery, EvolutionBranch, EvolutionLegacy, GeneticLibrary, Mutation, OrganSlot, CosmeticOwnership, HostLoadout, MissionDefinition, WaveDefinition, MissionRun, CoopSession, PlayerContribution, RewardsLedger, CodexEntry, Achievement, FactionMembership, FactionReputation, Season, TerritoryState. Crear solo lo requerido por fase, con migraciones y versionado previstos. Autoridad de servidor para recompensas, inventario y progreso; no confiar en clientes.
- Compatibilidad futura del editor genético: contratos de puntos de anclaje, esqueletos compatibles, límites de rigging, validación de mutaciones y cosméticos modulares. El editor funcional no es exigencia de demo.

## 11. Sprints y dependencias
- Sprint 0 — Descubrimiento / auditoría. Verificar rama canónica, historial, README, build, dependencias, despliegues Render, hosts, arenas, modos, assets, tests, errores, nivel de acceso. Inventario con evidencia y tabla existe/parcial/ausente. No asumir que el nombre antiguo Shower Psycho sigue siendo el repo. Línea de base de rendimiento y seguridad.
- Sprint 1 — Vertical slice. Un flujo completo desde menú → escoger huésped → tutorial de Islas → oleadas finitas → boss/desafío final → resultado y persistencia. Arreglar controles, colisiones, habilidades y HUD.
- Sprint 2 — Combate/audio/UX. Animaciones 1ª/3ª persona, combos por huésped, shooter/melee, feedback real de impactos, audio sin falsos impactos, minimapa, HUD responsive, objetivos y accesibilidad.
- Sprint 3 — Campaña y arenas. Implementar/validar capítulos existentes hacia objetivo de seis; duración medida 8–12 min, narrativa, checkpoints, variaciones, enemigos, jefes, escenas y desbloqueo lineal; integrar solo contenido aprobado.
- Sprint 4 — Coop y resiliencia. Salas y códigos, 1–4 jugadores, bots, revivir, espectador, retorno, reconexión, host-failure, escalado, botín personal, sincronización; simulaciones de red y sesiones reales.
- Sprint 5 — Progresión/colección. Cuenta y persistencia, un huésped inicial, desbloqueos, conciencia/huésped, rama evolutiva y legado si viable, códice mínimo, logros, resultados, telemetría.
- Sprint 6 — QA, hardening y demo. Pruebas E2E, dispositivos, carga, accesibilidad, seguridad, 20 perfiles simulados claramente etiquetados y testers humanos, métricas de experiencia y go/no-go. Activar despliegue público solo con autorización y criterios cumplidos.
- Backlog Fase II. Genética/Spore, simbiontes, arsenal orgánico, facciones y territorios, temporadas/pases, tienda, mercado, PVP, salas públicas, chat voz, modo infinito y expansión narrativa; desglosar epics/issue y dependencias.
- Cada sprint: alcance, archivos tocados, checklist, test automatizado/manual, evidencia, riesgos, regresión, PR independiente y decisión de merge. No prometer trabajo asíncrono que no esté automatizado realmente.

## 12. Auditoría multidisciplinaria y puntuación
- Roles: dirección de juego, diseño de sistemas, ingeniería frontend/backend/netcode, arte/animación, audio, narrativa, UX/UI, accesibilidad, seguridad, DevOps, monetización ética y QA. Evaluar 0–10 y ponderar para 100: jugabilidad 20; claridad/onboarding 12; estabilidad/errores 15; cooperativo/redes 12; combate/balance 12; rendimiento/dispositivos 10; UX/UI 8; narrativa 5; arte/audio 4; retención ética 2. Mínimo global 80/100, además de puertas críticas sin excepciones.
- Simular 20 perfiles declarados (principiantes, medios, expertos, solo/coop, móvil/escritorio, estilos melee/shooter, accesibilidad). La simulación no demuestra jugabilidad real; se complementa con ejecución de juego, capturas, logs, batería de dispositivos y, si están disponibles, 20 sesiones con humanos. Prohibido afirmar playtesting humano no realizado.
- Métricas de aceptación sugeridas a validar contra stack/objetivo: cero P0/P1, flujo completo sin bloqueo, condiciones de victoria reproducibles, recompensas idempotentes, reconexión sin duplicaciones, objetivos claros, progresión no perdida, uso de memoria/CPU adecuado en dispositivos objetivo. Objetivos de FPS/latencia/crashes se fijan tras perfilar hardware y red de la demo, no inventar umbrales.

## 13. Criterios de aceptación trazables

| ID | Criterio y evidencia obligatoria |
|---|---|
| AC-01 | Repositorio, rama y estado reales inventariados con referencias a archivos/commits; no confusión con repo antiguo. |
| AC-02 | Una misión finita termina inequívocamente tras cumplir X/Y oleadas y objetivo final; no bucles infinitos no solicitados. |
| AC-03 | Flujo tutorial → combate → victoria/derrota → recompensas → siguiente capítulo probado. |
| AC-04 | Huéspedes disponibles inventariados; todo huésped incluido tiene carga, ataques, habilidad y animaciones mínimamente válidos. |
| AC-05 | Cambio manual entre 1ª/3ª persona sin bloquear control ni romper colisiones. |
| AC-06 | HUD móvil/escritorio sin solapamientos; objetivo, progreso, barras, botones y minimapa legibles. |
| AC-07 | Sonido de impacto solo si hay colisión confirmada; atacar al aire no reproduce hit. |
| AC-08 | Coop 1–4: sala/código, entrada, salida, caída, bot, reconexión y resultados ensayados con clientes reales o test de integración. |
| AC-09 | Progreso y recompensas sobreviven cierre/reapertura; ledger evita duplicación por reintentos de red. |
| AC-10 | Todos los capítulos publicados tienen inicio, objetivos, final, y duración medida en pruebas; sin bloquear progreso principal por secundarios. |
| AC-11 | No comercio en demo; nada de habilidades u órganos funcionales disponibles exclusivamente por dinero. |
| AC-12 | No P0/P1, puntuación >=80/100 sustentada, matriz de 20 perfiles simulados etiquetada; recomendación go/no-go con evidencias. |

## 14. Entregables operativos de Claude
- AUDIT.md con repositorio/branch/SHA/estado, inventario de archivos, tecnologías, riesgos, assets, hosts y modos.
- GDD.md versionado contra este documento, con diferencias explícitas entre diseño y código.
- ROADMAP.md: epic/sprint/issues, prioridad, dependencias, esfuerzo relativo y pruebas.
- QA_MATRIX.md y 20_PERSONAS_SIMULADAS.md, incluyendo método, resultados, evidencia y limitaciones.
- PRs por sprint con cambios pequeños, tests, screenshots/capturas y checklist de regresión.
- DEMO_RELEASE_CHECKLIST.md y RELEASE_NOTES.md con estado real y vínculo verificable al despliegue, si existe.
- FUTURE_BACKLOG.md para preservar todos los sistemas diferidos sin marcarlos falsamente como implementados.

## 15. Política de Git, seguridad y publicación
- Trabajar sobre ramas feature/sprint. Ejecutar pruebas antes de PR; no modificar secretos ni credenciales en código; revisar dependencias y configuraciones de Render. No hacer merge automático a la rama principal sin autorización expresa, salvo que el operador de Claude reciba una autorización separada y validaciones obligatorias estén configuradas. No eliminar assets o proyectos heredados sin inventario y respaldo. Distinguir claramente «diseñado», «implementado», «probado», «mergeado» y «desplegado». Ante bloqueo, registrar error exacto y siguiente acción, continuar lo seguro.

## 16. Definición de terminado
- Una demo está lista cuando se puede abrir desde dispositivos objetivo, iniciar una partida, comprender el tutorial, escoger/progresar huéspedes, luchar con mecánicas confiables, completar misiones finitas, ver resultados, guardar progreso y jugar cooperativo según el alcance publicado; todo sin bloqueos, con QA >=80/100 y evidencias técnicas. El editor completo estilo Spore, comercio, guerra PvP y temporadas no forman parte obligatoria de ese criterio y se mantienen como roadmap trazable.
---

# Parte B — Diferencias diseño vs código

Resumen de [audit/MATRIZ_GAPS.md](audit/MATRIZ_GAPS.md) sobre el SHA base `62244b6`. Escala: **Implementado** (el código existe y se leyó) · **Parcial** · **Ausente** · **Roto** · **No verificable**. «Implementado» **no** significa probado ni jugado. Referencias de identificadores (por ejemplo GDD-2.1-05) apuntan a esa matriz, que tiene la evidencia con ruta y línea.

## B.1 Resumen por sección del GDD

| Sección | Requisito | Estado en el código | Referencia en MATRIZ_GAPS |
|---|---|---|---|
| 1 | Sobrevivir tiene final (oleadas finitas) | Implementado (leído); sin modo infinito en misiones | GDD-1-01, GDD-1-02, §2 |
| 1 | No pay-to-win | Parcial: no hay dinero real ni moneda premium, pero la tienda de núcleos vende Huéspedes y ventajas | GDD-1-04, C1 |
| 1 | Cada Huésped importa | Parcial: 8 Huéspedes con arte y datos propios, pero 3 sin animación/audio completos y 5 clases heredadas en paralelo | GDD-1-05, INVENTARIO_HUESPEDES |
| 2.1 | Seis capítulos y seis arenas | Parcial: existen y están encadenados, pero duran 0,7–3,3 min con bots | GDD-2.1-02, -03 |
| 2.1 | Capítulo «Islas — Despertar» | **Ausente** (el capítulo 1 es «Refugio de la conciencia») | GDD-2.1-04 |
| 2.1 | Cinemática de transferencia de 20–30 s | **Ausente** (prólogo del tren retirado; ~18,5 s de subtítulos) | GDD-2.1-05 |
| 2.1 | Tutorial jugable de ~3 min | **Ausente** (tarjeta modal de texto) | GDD-2.1-06 |
| 2.1 | Un básico + dos habilidades + una definitiva | Parcial: el HUD tiene 4 acciones, los datos tienen 3 ranuras de habilidad más ulti | GDD-2.1-10, C5 |
| 2.1 | Cámaras 1.ª/3.ª con botón, 3.ª inicial | Parcial: botón y tecla existen; la 3.ª es inicial solo en Melé | GDD-2.1-11, C4 |
| 2.1 | HUD (retrato, vida, minimapa, objetivo, cooldowns) | Implementado (leído) salvo reloj de partida (ausente) y «Oleada X/Y» (hoy «ETAPA x / y») | GDD-2.1-14…-22 |
| 2.1 | No sonar impacto si el ataque falla | Parcial / en riesgo: `combo-fx.js:134,170` | GDD-2.1-25, AUD-03 |
| 2.1 | Coop hasta 4 con salas y códigos | Implementado (leído); probado con bots WebSocket | GDD-2.1-28 |
| 2.1 | Bots opcionales (seguir, atacar, reanimar) | **Ausente** como función de producto (`bot.js` solo para pruebas) | GDD-2.1-29 |
| 2.1 | Reconexión con bot sustituto | Parcial: gracia de 45 s con cuerpo inmóvil; sin bot sustituto; el resultado no se reenvía al reanudar | GDD-2.1-30 |
| 2.1 | Un Huésped inicial; el resto por campaña, desafíos, exploración, eventos | Parcial / contradictorio: 3 iniciales y 5 por compra con núcleos | GDD-2.1-31, C1, C3 |
| 2.1 | Elegir antes de cada misión, sin cambio libre durante la partida | Parcial: se puede cambiar entre oleadas | GDD-2.1-32, C10 |
| 2.1 | Progresión permanente, cuenta verificable | Parcial: perfil en `localStorage` con respaldo manual | GDD-2.1-33 |
| 2.1 | Códice mínimo, logros | Parcial: códices de Fauna/Flora y trofeos; sin códice unificado | GDD-2.1-34 |
| 2.1 | Menú central sin base 3D obligatoria | Parcial: el Santuario es opcional pero es el destino por defecto tras cada partida | GDD-2.1-35, C2 |
| 2.1 | Sin comercio entre jugadores | Implementado (no existe) | GDD-2.1-36 |
| 2.2 | Editor Spore, genética, simbiontes, facciones, temporadas, comercio, chat, modo infinito | Ausentes o parciales como base técnica; todo Backlog | GDD-2.2-01…-09; [FUTURE_BACKLOG.md](FUTURE_BACKLOG.md) |
| 3 | Dos o tres decisiones morales y finales alternativos | **Ausente** (un único final) | GDD-3-03 |
| 3 | Encuentro final por capítulo | Parcial: solo capítulos 1 y 6 | GDD-3-05, C17 |
| 3 | Misiones secundarias de muestras, rescate, recuerdos, secretos | Parcial: 5 mini-misiones de combate | GDD-3-07 |
| 3 | Entornos dinámicos y eventos anunciados | Implementado (leído) | GDD-3-09, -10 |
| 4 | Descansos de 10–20 s | Parcial: 12 s en solitario (espera elección), 22 s en coop | GDD-4-02, C12 |
| 4 | Derrota con reinicio; checkpoints narrativos excepcionales | Parcial: sin guardado a mitad de misión | GDD-4-04 |
| 4 | Reanimación limitada y espectador | Parcial: revive automático por oleada, sin espectador | GDD-4-05, C14 |
| 4 | Recompensas parciales tras fracaso; principales solo por victoria | Parcial: núcleos, botín y XP se pagan al perder | GDD-4-06 |
| 4 | Resultados completos con detalle expandible | Parcial: texto plano; faltan apoyo, revivir y detalle | GDD-4-07 |
| 5 | Progreso de conciencia compartido | **Ausente** como entidad (todo es por Huésped) | GDD-5-01, C13 |
| 5 | Huéspedes por historia, jefes, desafíos, expedición | **Ausente** (solo compra) | GDD-5-03 |
| 5 | Reinicio con legado, recuerdos por Huésped | **Ausente** | GDD-5-06, -09 |
| 6 | Audio adaptativo, voces fragmentadas | Parcial: síntesis Web Audio; sin música adaptativa verificada | GDD-6-03 |
| 6 | Jefes que escalan con 1–4 integrantes | Parcial (hay enrage por jugadores); jefes solo en campaña, no en coop ni misiones sueltas | GDD-6-06, AC-08 |
| 7 | Botín personal, anti-AFK, contribución | Parcial: botín por jugador; sin anti-AFK ni bono por contribución | GDD-7-05 |
| 7 | Ping y mensajes rápidos | Parcial: ping sí, mensajes rápidos no | GDD-7-07 |
| 8, 9 | Facciones, temporadas, moneda premium, comercio | **Ausentes** (correcto para la demo) | GDD-8-01, GDD-9-01…-04 |
| 10 | Autoridad de servidor para recompensas, inventario y progreso | **Roto / Ausente**: el cliente decide qué guardar | GDD-10-04, C16 |
| 10 | `RewardsLedger`, `MissionRun`, `PlayerContribution`, `Achievement`, `CodexEntry` | **Ausentes** | GDD-10-03 |
| 11 | Sprint 0 (auditoría) | Parcial: cerrado por estos documentos; falta línea base de rendimiento y seguridad | GDD-11-01 |
| 14 | Los 8 entregables | Esta entrega crea los 8 archivos documentales de §14 (sin commitear); los PR por sprint aún no existen | GDD-14-01 |
| 15 | Despliegue con compuertas | Parcial: Pages y Render publican sin esperar a CI | GDD-15-04, C15 |

## B.2 Criterios de aceptación: estado de partida

Ningún AC se declara «Cumple». Estado: AC-01 Parcial · AC-02 Parcial · AC-03 Parcial · AC-04 Parcial · AC-05 Parcial · AC-06 No verificable · AC-07 Parcial (riesgo) · AC-08 Parcial · AC-09 No cumple · AC-10 Parcial · AC-11 Parcial (cumple lo literal) · AC-12 No cumple. Detalle y plan en [QA_MATRIX.md](QA_MATRIX.md).

---

# Parte C — Decisiones del propietario y contradicciones

Esta parte **no cambia el GDD**: lista dónde lo que el propietario decidió o dejó en el código choca con el texto de la Parte A. Cada punto tiene una propuesta a decidir por el propietario. Nada de lo propuesto está implementado.

| # | Tema | El GDD dice | Estado actual / decisión previa | Propuesta (a decidir) |
|---|---|---|---|---|
| C1 | **Tienda con núcleos** | Compras solo estéticas; desbloqueos jugables por campaña, desafíos, exploración o eventos; no exigir tienda para cerrar la demo (§1, §2.1, §9) | Existe la Tienda del Cambista con precios fijos en núcleos: Huéspedes (500/500/600/750/600), planos, objetos, botiquín, reinicio de árbol, cambio de esencias. Los núcleos se ganan jugando y no se compran con dinero real, así que no es pay-to-win, pero el acceso a Huéspedes depende de ahorrar y gastar | Mantener los núcleos como moneda ganada; mover el desbloqueo de Huéspedes a campaña y desafíos; dejar la tienda para consumibles y cosméticos; ocultarla en la demo si no se aprueba |
| C2 | **Santuario** | Menú central ágil, sin base 3D explorable obligatoria | El Santuario existe como hub caminable y es el destino por defecto tras cada partida (`baseAlTerminar: true`); el menú sigue completo, así que no es obligatorio | Dejarlo opcional, desactivar `baseAlTerminar` por defecto y ocultarlo de la demo hasta pasar QA |
| C3 | **Tres iniciales** | Elegir un Huésped inicial; el resto desbloqueable | Hay tres iniciales (axioma, vesper, micelio) y cinco comprables | El propietario define el Huésped inicial único (ligado a la narrativa del capítulo 1) y qué evento desbloquea cada otro |
| C4 | Cámara | Botón; tercera persona inicial | Botón sí; inicial según modo (Disparo = 1.ª, Melé = 3.ª); Tab cambia la cámara | Cámara independiente del modo; 3.ª por defecto |
| C5 | **HUD de 4 acciones** | Un ataque básico, dos habilidades y una definitiva | El HUD de 4 acciones (ataque, movilidad/defensa, apoyo, ulti) coincide en número, pero los datos tienen 3 ranuras de habilidad más ulti; el modo «Completo» las expone en pausa. Decisión previa en [VORTEX_DECISIONS.md](VORTEX_DECISIONS.md): «cuatro botones esenciales no equivalen aún a un rediseño balanceado» | Fijar el contrato: 1 básico + 2 habilidades + ulti; reubicar la tercera habilidad (`s3`) en evolución o maestría, o retirarla del HUD |
| C6 | Contador | «Oleada X/Y» | «ETAPA x / y» y «RESPIRO» | Unificar el vocabulario y distinguir etapa de oleada |
| C7 | Canon: cuerpo | Huéspedes biológicos | La narrativa vigente ([VORTEX_STORY.md](VORTEX_STORY.md)) habla de cuerpos de «genoma humano e IA» y de un «cuerpo sintético» | Alinear el canon (biológico o sintético) **antes** de escribir la cinemática de transferencia |
| C8 | Nombre del capítulo 1 | «Islas — Despertar» | «Refugio de la conciencia» sobre la arena «Vacío de Islas» | Renombrar título y briefing |
| C9 | Duración | 8–12 min por capítulo; misiones de 5–15 min | 0,7–3,3 min medidos con bots | Más etapas y oleadas, jefe o desafío por capítulo, subtramas; validar con humanos |
| C10 | Cambio de Huésped | Elegir antes de cada misión, sin cambio libre durante la partida | `loadout` permite cambiar entre oleadas | Bloquear tras iniciar; reservar la transferencia narrativa |
| C11 | Maestría | No «simplemente daño extra» | Pequeños multiplicadores de daño más cosméticos por rango | Cambiar a desbloqueos o capacidades, o documentar el bono mínimo |
| C12 | Descanso | 10–20 s | 12 s solo (espera elección) / 22 s coop | Ajustar a <= 20 s o hacerlo configurable |
| C13 | Progreso de conciencia | Árbol permanente compartido con herencia limitada | Todo por Huésped; solo `skillLevel` es global | Definir un árbol de conciencia mínimo o reformular |
| C14 | Retorno del caído | Limitado, en frontera de oleada u objetivo | Automático al empezar cada oleada, ilimitado | Límite de usos y modo espectador |
| C15 | **Despliegue** | Activar despliegue público solo con autorización y criterios cumplidos | Pages publica en cada push a la rama canónica; Render con `autoDeploy: true`; sin compuerta de CI | Proteger ramas; Pages con `needs` de CI; Render en despliegue manual |
| C16 | Autoridad de servidor | Servidor autoritativo para recompensas, inventario y progreso | Combate autoritativo; perfil y premios en el cliente | Ledger en servidor (Sprint 5, con mitigación antes) |
| C17 | Final por capítulo | Encuentro final en cada capítulo | Solo capítulos 1 y 6 | Un jefe o desafío por capítulo (existen `argos`, `coloso`, `madre`) |
| C18 | Bots | Opcionales en coop, sustitutos de desconectados | Solo para pruebas | Integrar `bot.js` al servidor con comportamientos mínimos |
| C19 | **Monetización ética** | Cosméticos sin poder; pases permanentes; sin coerción diaria; comercio solo después de la demo | No hay cobros ni moneda premium; contrato comercial en [COSMETIC_COMMERCE.md](COSMETIC_COMMERCE.md); las cuentas son un respaldo declarado por el cliente, no un registro de derechos | Mantener cobros apagados hasta tener cuentas autenticadas, ledger y webhooks (véase «Monetización ética» en [FUTURE_BACKLOG.md](FUTURE_BACKLOG.md)) |
| C20 | Estado documental | «No inventar estado» | Documentos históricos mezclan nombres (Shower Psycho, Duelo Arcano, VORTEX) y cifras antiguas | Estos 8 documentos son la fuente viva; archivar los `VORTEX_*.md` anteriores |

Decisiones que **solo el propietario puede tomar** y que bloquean trabajo: C1 (tienda), C2 (Santuario), C3 (Huésped inicial), C5 (esquema de combate), C7 (canon biológico o sintético), C15 (política de despliegue).

---

*Fin del GDD versionado. Los cambios de contenido de las Partes A–C se registran aquí con fecha y versión; hoy la única versión es la 1.0 del propietario.*
