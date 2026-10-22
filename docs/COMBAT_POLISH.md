# Pulido visual de combate — 22 de octubre de 2026

## Alcance implementado
- Proyectiles: Nova con escape direccional; enjambre con alas dobles; cometa con aros de compresión; vacío con collares que se contraen; lanza con punta estrecha; mina con pulso horizontal. Se reutilizan pools, sin luces nuevas y con frecuencia de emisión acotada.
- El snapshot transmite arma y propietario del proyectil: dos jugadores disparando juntos ya no dependen de inferir el arma por proximidad.
- Críticos visuales sólo con confirmación `hit.cr`. El daño alto por sí solo no dibuja un crítico. Remates cuerpo a cuerpo pesados (`w: h`) de cadenas de al menos tres entradas ganan 20% de daño y crítico; no afecta ataques aislados, combos a distancia ni todos los golpes del modo shooter.
- Remate y ejecución ya no comparten bandera visual. Menos flash blanco, partículas y superposición; barridos de suelo orientados a la gravedad. Las ondas de huésped ya no heredan la bola de fuego ni el humo de las explosiones de proyectiles.
- Los combos de equipo consultan su catálogo para elegir pose: tijera gira y estocada doble embiste. Con Espadas Gemelas de Axioma, A1→A2 está disponible desde evolución 0; A1→A1→A2 desde evolución 1. Los controles y el HUD quedan fuera del cambio.
- El faro de rastreo se retira suavemente cerca de cámara: mantiene su ayuda a distancia sin tapar el objetivo en melee.
- Pulsos que recorren las grietas del material **activo** del huésped y los órganos de arena. Carga de órganos menos estroboscópica.

## Objetos
Los porcentajes base escalan con calidad/maduración y respetan los topes del inventario.

| Objeto | Cambio | Silueta |
|---|---|---|
| Tendones Relámpago | +8% velocidad de ataque; −3% daño melee/disparo | Fibras paralelas con venas luminosas |
| Puños Basálticos | +5% daño melee; −4% velocidad de ataque | Placas gruesas de quitina |
| Relicario Amortiguador | −5% daño recibido; −2% daño melee/disparo | Geoda con dos aros protectores |

La velocidad afecta disparo, melee de shooter y recuperación de combos. Al desequipar vuelve al valor neutral; tope acumulado 1,15. Son objetos del catálogo/drop pool, no regalos automáticos a todas las cuentas.

## Evidencia y límites
- 49/49 pruebas: combat-polish, weapons, combo-anim y combos. Incluyen crítico real y limpieza de bandera, cadencia reversible, atribución de proyectiles y poses de equipo.
- Inventario: 33/34; el fallo de balance de equipo legendario de Vesper también ocurre en el original `9b7d54a` (7,5→16,5 segundos). No se cambió ese balance ajeno a este bloque.
- Chromium 153 con WebGL por software, mapa m1, Axioma equipado, 960×540 para firmas, 640×360 para melee final, Baja/Alta. Capturas de familias aisladas y combo avanzando cada tick; no equivalen a FPS en iPhone físico.
- Baja: kit del huésped 13 llamadas / 14.578 triángulos. Escena 61 llamadas / 44.445 triángulos en toma de referencia. Alta: kit 13 / 56.692; escena 123 / 288.574. Sin PointLights agregadas.
- La suite hostfx del repositorio omite sus 10 casos al no encontrar su ruta fija de Chromium; se realizó la comprobación WebGL directa descrita arriba, no se cuentan esos casos como aprobados.
- No se certifican todos los huéspedes, todas las arenas, multijugador por internet ni rendimiento de móvil real.

## Capturas de revisión

- [Proyectiles Baja](combat-polish/proyectiles-low.jpg) · [Proyectiles Alta](combat-polish/proyectiles-high.jpg)
- [Melee Baja y Alta](combat-polish/melee.jpg)
