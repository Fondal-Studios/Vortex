# VORTEX — Auditoría jugable y simplificación

21/10/2026. Complemento de Bloque 0, a pedido de Nano. Foco: entender, combatir, distinguir huéspedes/arenas y terminar oleadas sin buscar enemigos perdidos. Las propuestas de esta página NO están implementadas. No cambia el juego publicado.

## Hallazgos verificados ahora
- Colisiones: 10/10 tests existentes pasan en seis arenas. 1.131 lanzamientos de criaturas a 60 m/s no cruzaron los sólidos ensayados. Esto no demuestra que toda geometría visual sea sólida, ni cubre todos los jefes: tests omiten bosses y resolverTodas excluye Madre. Los órganos de arenas vivas son explícitamente no sólidos (arenas-vivas.js). No se reprodujo todavía el cruce de un muro concreto observado por el usuario.
- Últimos enemigos: test colision-criaturas permite hasta 80 s para acercarse. En Laberinto llegaron a menos de 26 m en 1,38,42,47 s. Es tiempo simulado, con fixture de jugador quieto, no tiempo de playtest humano. Aceptable para el test no equivale a aceptable para el ritmo del juego.
- Otra suite, huéspedes + Danzante + Singular + Colmena + metas, da 74/75. Falla precisamente «las últimas criaturas vienen a buscarte»: Geoda queda a77 m tras9 s. Fixture fuerza velocidad base cero: evidencia del caso de recuperación, no de que toda Geoda normal se comporte así.
- Acoso: tickRezagados sólo activa acercamiento a >28m del primer jugador. Enemigo cercano tras pared no entra por esa condición al mecanismo de recuperación. Reproducción aislada de60 s sin ejecutar AI/física confirma falta de activación; no demuestra por sí sola una partida bloqueada.
- Radar: reproducido llamando al componente con DOM simulado. Dos enemigos reales + dos ecos falsos generan CUATRO marcadores con clase de «últimos». No hay distinción funcional en la etiqueta. nieblas-fx.js genera esos ecos en niebla magenta, también al cierre de oleada. Esto contradice el objetivo de encontrar con claridad los últimos bichos.
- Objetivos principales: 24 entradas programadas entre seis mapas, de las que23 usan Ancla/Sintonía/Núcleo. Una entrada base de Cultivo en Jardín (puede reemplazar otra si puente pendiente). Ancla aparece dos veces en m1,m3,m4,m5,m6. No hay selección aleatoria por partida del tipo programado. Las misiones secundarias repiten ciclo melee/intacto/elite con sustitución de alimento en oleada4.
- Controles: modo Disparo básico muestra9 botones contando pausa; Melé8, más contextuales. Cámara y modo son independientes: cambiarModo no asegura primera/tercera persona. Ya existe la base de ambos modos; falta unificarlos como una decisión clara.
- Colores: cian significa curación en niebla y zona peligrosa de rayos en evento Tormenta; magenta participa en huésped Vesper, decoración, niebla falsa y proyectiles enemigos. Los colores no tienen un significado único. Ciclo eclipse aumenta saturación y contraluz al avanzar. Es hecho de configuración; falta medir efecto visual en dispositivo real.

Evidencia nueva: docs/vortex-evidence/gameplay-*.txt. Repro radar: node tools/audit/gameplay-radar.repro.mjs. Sin nueva sesión visual/WebGL ni iPhone físico; no presentarlo como juego probado manualmente.

## Dirección aceptada para el diseño
El jugador elige Disparo o Melé, juega de inmediato y puede alternar. Disparo abre primera persona; Melé abre tercera persona con cámara de seguimiento. Un solo control de modo cambia cámara, ataque y HUD conjuntamente. No exigir cambiar dos ajustes.

### Cuatro botones de combate
| Posición estable | Disparo / primera persona | Melé / tercera persona |
|---|---|---|
|1 Ataque grande|Mantener dispara; arrastrar apunta|Toques encadenan golpes; mantener carga golpe fuerte|
|2 Evadir|Esquiva breve direccional|Esquiva; Danzante puede convertirla en contraataque|
|3 Poder del huésped|Una habilidad distintiva equipada|La misma identidad, adaptada a la distancia de combate|
|4 Cambiar modo|Pasar a Melé y tercera persona|Pasar a Disparo y primera persona|

Joystick izquierdo y arrastre derecho son superficies de movimiento/cámara, no botones añadidos. Pausa separada en una esquina. Esta propuesta elimina botones permanentes de salto, agacharse, apuntado separado, golpe rápido en shooter, tres habilidades, recarga y ulti independiente. Correr al fondo del joystick ya existe. Recarga automática, recogida automática de recursos y superar escalones automáticamente. USAR reemplaza temporalmente Poder al acercarse a interacción segura, sin desplegar quinto botón ni hacerlo durante una pelea. En desafíos de salto diseñados expresamente, Evadir puede convertirse en Salto con rótulo visible; no cambiar significados de forma sorpresiva durante combate.

No activar disparo automático por defecto: mantener decisión de atacar. Opcional de accesibilidad separado. Antes de quitar acciones, adaptar niveles que actualmente exigen salto/portales: ocultar un botón sin revisar recorrido puede bloquear el mapa.

Una habilidad activa realmente característica por huésped; las otras se transforman en pasivas o variantes elegibles fuera de combate. La carga potencia el mismo Poder, con indicador claro, en lugar de agregar una quinta acción. Esto requiere rebalanceo; no es sólo esconder botones.

## HUD que se lee de un vistazo
- Arriba centro: UNA orden con verbo, progreso y destino: «Defendé el ancla · 70%», «Eliminá los últimos2».
- Arriba izquierda: vida y escudo juntos. Eliminar duplicados de barras/números.
- Centro: mira sólo en Disparo, objetivo de golpe suave en Melé; daño/confirmación breves.
- Abajo derecha: cuatro botones fijos. Munición compacta junto a Ataque sólo en Disparo.
- Misiones opcionales, materiales, esencias, órganos, inventario, forja y explicaciones largas: pausa o pantalla entre rondas. Mostrar una elección de mejora al terminar, no varios sistemas simultáneos.
- Enemigos: barra al apuntar o dañarlos. Élites: barra más gruesa, símbolo y nombre corto cuando visibles; jefe: barra superior propia sustituyendo contador ordinario. No llenar pantalla con30 barras permanentes.
- Últimos3: contador inequívoco y marcador REAL con distancia/dirección/altura; quitar ecos falsos de la asistencia de búsqueda. Usar ruta hasta puerta/portal si el enemigo está tras muro.

## Identidad de huéspedes: una promesa y una decisión
| Huésped | Identidad respaldada por kit actual | En qué centrar el kit simple |
|---|---|---|
|Axioma|Asalto versátil, espinas y caparazón|Avanzar disparando y sobrevivir con defensa temporal|
|Vesper|Fragilidad, camuflaje y daño al desprevenido|Flanquear y ejecutar un blanco prioritario|
|Micelio|Mucha vida, barrera y esporas|Controlar un paso y sostener terreno|
|Umbra|Fase, agrupamiento y distorsión temporal|Interrumpir/ralentizar una amenaza; separar de Singular|
|Seraf|Planeo, pulso vital y simbiosis|Dañar para recuperar/apoyar; beneficio claro también en solo|
|Danzante|Parada/esquiva perfecta y réplica|Leer ataque, esquivar a tiempo y contraatacar|
|Singular|Pozos, satélites y reflujo|Agrupar enemigos y decidir dónde detonar/controlar|
|Colmena|Zánganos, nidos e invocación|Colocar enjambre y ordenar blanco prioritario|

Estos kits existen en datos/lógica; las filas derechas son propuesta de reducción. Umbra/Singular se solapan en control gravitatorio y necesitan diferenciación. Vesper/Danzante comparten movilidad, pero sus decisiones pueden ser distintas: posición frente a timing. Una silueta, un sonido y una acción distintivos deben comunicar el huésped sin leer lore.

## Identidad de arenas: cambiar lo que hacés
| Arena | Diferencia espacial existente | Objetivo protagonista propuesto |
|---|---|---|
|Vacío de Islas|Islas y portales|Avanzar por una ruta corta de portales y tomar un ancla final|
|Cámara Fractal|Esfera hueca y gravedad|Usar una ventana de gravedad para exponer y atacar un punto débil|
|Laberinto Celestial|Muros y rutas|Cazar un élite señalado que abre el siguiente sector; evitar limpiar rincones|
|Jardín de Carne|Puente que crece|Cultivar el camino disparando capullos mientras se defiende; conservar esta distinción|
|Plaza de los Ecos|Plaza, soportales y reloj|Secuencia corta ligada al reloj, alternando desplazamiento y defensa|
|Osario sin Techo|Nave y brazos de iglesia|Abrir sellos mediante golpes/combate cercano y cerrar con jefe|

Las columnas de propuesta no describen funciones ya terminadas. Reutilizar sistemas existentes con variantes de ritmo: combate corto → objetivo espacial → élite → recompensa. Momentos que favorezcan disparo contra punto elevado y melé contra blanco vulnerable cercano; comunicarlo con forma/animación y permitir alternativa razonable, sin inmunidades arbitrarias por arma.

## Psicodelia legible, enemigos y cámara lenta
Reservar intensidad máxima para amenazas, impactos y poderes. Reducir primero partículas decorativas, halo ambiental y niebla durante combate; conservar arquitectura extraña y paleta de cada mundo. Prioridad visual: peligro inmediato > enemigo/élite > objetivo > decoración. Amenaza lleva forma y aviso temporal además del color.

Probar crecimiento selectivo de criaturas pequeñas (~15–25%, hipótesis inicial) y silueta más fuerte de élites. Ajustar hitbox, rutas, cámara y radio de colisión junto al modelo; agrandar todos indiscriminadamente puede atascar puertas y tapar enemigos.

Cámara lenta propuesta: 0,15–0,25 s en remate de élite/tiro especialmente significativo, con enfriamiento y opción de apagar. No en cada bala, no giros forzados ni pérdida de control. En solo puede ralentizar simulación; en coop mantener reloj compartido y usar feedback cosmético local salvo mecánica sincronizada explícita.

## Orden de implementación y aceptación
1. Unificar modo+cámara y cuatro acciones; HUD con una misión. Validar que todo recorrido inicial sea realizable.
2. Cierre de oleadas: marcadores verdaderos, búsqueda por ruta y recuperación de atasco. Meta de prueba: últimos3 identificables en2 s y encuentro accesible en10–15 s en escenarios controlados, no80 s. No prometer cumplimiento todavía.
3. Separar amenaza/decoración; barras de enemigos/élites y prueba A/B visual real.
4. Una identidad jugable por huésped; primera demo Axioma/Vesper/Micelio, otros conservados hasta adaptar sus kits.
5. Una misión protagonista por arena y variación de ritmo; cámara lenta después de lectura y controles.

No se declara mayor diversión sin playtest. Con novato: en10 s puede decir dónde ir, qué atacar y cuál es su poder; en primer minuto dispara, cambia a melé y completa una acción sin explicación externa. Propuesta de criterio futuro.
