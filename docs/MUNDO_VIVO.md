# El Limbo vivo: territorios, NPCs, enemigos y evolución (libertad creativa del dueño, 2026-10-18)

## Territorios (los mapas)
Cada mapa es un **territorio** del limbo con su folclore, su jefe y su bendición. Se **liberan** venciendo a su jefe.
| Territorio | Mapa | Folclore | Jefe |
|---|---|---|---|
| Vacío de Islas | m1 | ánimas y luces malas | El Mandinga |
| Cámara Fractal | m2 | espejos y ecos | La Madre de las Ánimas |
| Laberinto Celestial | m3 | cantos y silbidos | El Basilisco |
| Jardín de Carne | m4 | raíces y carne | (Argos reutilizado) |
| Plaza de los Ecos | m5 | ciudad muerta, el relojero | El Mandinga |
| Osario sin Techo | m6 | huesos que no descansan | El Basilisco |
**Bendición del territorio** (permanente, perfil): al liberarlo elegís UNA de dos (excluyentes), p. ej. «Hambre» (+25 % esencias) o «Eco» (+10 % de daño de habilidades).

### Sistema de territorios (implementado)
- **Datos:** `src/sim/bendiciones.js` (puro, sin azar): `TERRITORIOS` (nombre, folclore, jefe, `requiere`), `BENDICIONES` (12) y helpers `cleanBend`, `bendMods`, `applyBend`.
- **Cadena de desbloqueo:** m1 está disponible desde el inicio · m2 y m5 piden m1 · m3 pide m2 · m4 pide m3 · m6 pide m5. Estados: *bloqueado* → *disponible* → *liberado*.
- **Liberar:** ganar el mapa en partida solo (no práctica) llama a `Perfil.liberarTerritorio(mapId)` (`main.js` → `endGame`); sólo libera si estaba *disponible*. Después, en el menú **Territorios** (`src/client/territorios-ui.js`, `public/territorios.css`) se elige la bendición con `Perfil.elegirBendicion(terr, id)`. **Es permanente:** la hermana queda *cerrada*, no se puede cambiar ni reiniciar.
- **Perfil** (`cristal.perfil.v1`): `terr = { m1: { bend: null | 'id' } }` (la clave existe = liberado). Se sanea al cargar (ids falsos o de otro territorio se descartan). `paraPartida()` devuelve `bend: [ids]`.
- **Contrato con la simulación:** `game.addPlayer(nombre, rol, { …, bend: ['luz_mala', 'eco'] })` (también `setLoadout(..., { bend })` y el servidor, que recorta a 6). `cleanBend` deja sólo ids conocidos y **una por territorio**; el resultado es `p.bend` (ids) y `p.bn` (multiplicadores). Determinista: sólo multiplicadores fijos, sin `rng`. Sin `bend` todo queda neutro (`BN_NEUTRO`).
- **Dónde actúa cada efecto (`p.bn`):** `spd` (huespedes.js, velocidad) · `gun`/`melee`/`skill` (`hostOut`) · `dmgIn` (`hostDamageIn`) · `ult` (`hostHit`) · `shield` (game.js, recarga de escudo) · `ess` (organos.js `absorb`) · `cores` (`addCores`) · `cd` (`cdMul`) · `heal` (respiro entre oleadas) · `kheal` (`hostKill`).

| Territorio | Bendición A | Bendición B |
|---|---|---|
| Vacío de Islas (m1) | Pie de Isla: +4 % velocidad | Luz Mala: +5 % daño de disparo |
| Cámara Fractal (m2) | Eco: +10 % daño de habilidades | Espejo: −5 % daño recibido |
| Laberinto Celestial (m3) | Silbido: +10 % carga de definitiva | Canto: +20 % recarga de escudo |
| Jardín de Carne (m4) | Hambre: +25 % esencias | Raíz: +10 de vida en el respiro |
| Plaza de los Ecos (m5) | Hora Detenida: −6 % recargas | Farol: +10 % núcleos |
| Osario sin Techo (m6) | Hueso Firme: +8 % daño cuerpo a cuerpo | Descanso Ajeno: +1 de vida por baja |

Pruebas: `node --test tests/bendiciones.test.js`.

## NPCs (almas que ya no atacan)
Aparecen en el **respiro** entre oleadas, cerca de vos; se interactúa con E / botón USAR.
- **El Cambista de Almas:** cambia esencias entre tipos (3 → 1) o núcleos por esencias.
- **La Sanadora (Difunta buena):** cura y repone escudo a cambio de esencias de Carne.
- **El Herrero de Huesos:** vuelve a sortear las tarjetas de mejora (1 vez por respiro) o ofrece un órgano a precio rebajado.
- **El Relojero (m5) / El Sepulturero (m6):** dan un **encargo opcional** (matar X criaturas de un tipo, no recibir daño en una oleada) con recompensa de núcleos y lore.

## Enemigos: élites con afijos
Desde la oleada 3 las élites llevan un **afijo** visible (halo de color + nombre): **Blindado** (−40 % daño, placas), **Veloz** (×1,35, estela), **Vampírico** (cura al golpear), **Explosivo** (estalla al morir), **Espectral** (cada 4 s se vuelve intangible 1,2 s), **Llorón** (invoca ánimas al recibir daño). Dan más esencia y núcleos.

## Evolución del personaje (4 niveles excluyentes, núcleos) y de las armas
- **Personaje:** núcleos → nivel 1–4 con bifurcación (docs/EVOLUCION.md) + órganos del campeón (esencias).
- **Armas — Linajes:** un arma que llegó a nivel 3 de mejora, con mutación y un órgano, puede **ascender** a una de dos **formas finales excluyentes** («Del Alba» o «Del Ocaso»: dos mecánicas distintas según el tipo de arma) con nombre propio y aspecto cambiado.

## Metas claras: qué hay que hacer en cada momento
- **Línea de meta (HUD, arriba):** `#goal` dice siempre lo que toca: «Oleada 3/8 · Eliminá 12 criaturas», «… Cargá el Ancla (40 %)», «Elegí una mejora de arma», «Derrotá a <jefe>». Textos puros en `src/client/meta-texto.js` (`metaActual`); dibujo en `src/client/meta-ui.js`. No agrega botones; en táctil sólo muestra una línea.
- **Meta del mapa:** ganar el mapa libera el territorio y da una bendición permanente (src/sim/bendiciones.js). Se ve en las tarjetas de Arenas, en la línea «Ruta» de Historia/Arenas, y como segunda línea de la meta (antes de empezar y en el jefe).
- **Mini-misión opcional por oleada** (`src/sim/metas.js`, snapshot `mis`): ciclo fijo oleada 1 = «Golpe a golpe» (matar N con melé), 2 = «Intocable» (sin recibir daño), 3 = «Caza mayor» (eliminar al élite; el sim garantiza que haya uno), y así. Paga núcleos (y esencias) a quien esté vivo; sin misión en el jefe ni en el campo de pruebas. Evento `mision` (done/failed) para el aviso.
- **Flecha al objetivo:** `snapshot.obj.tg` = punto del objetivo activo (ancla, placa sin pisar, núcleo→altar, capullo); `meta-ui.js` dibuja una flecha dorada (al borde si está fuera de pantalla).
- **Guía de primera partida:** 4 pasos contextuales (meta, mejora, objetivos, jefe/territorio), uno a la vez, 10 s cada uno; se saltan con «Saltar guía» (táctil) o la tecla J, y se guardan en `perfil.guia` (`guiaPendiente/guiaVisto/guiaSaltar`). `?guia=0` la apaga. Pruebas: `node --test tests/metas.test.js`.

## Eventos de oleada (la gravedad deja de ser permanente)
**Problema:** en las últimas oleadas los Familiares y los jefes invertían la gravedad sin parar: flotabas, caías y la cámara se volvía loca.
**Solución de diseño:** la gravedad rota pasa a ser UNO de ocho **eventos de oleada**. Código: `src/sim/eventos.js` (determinista, sin DOM); datos (nombres, textos, duraciones, pesos por mapa): `src/sim/data.js` (`EVENTO`, `EVENTOS`, `EVENTOS_MAPA`); cliente: `src/client/eventos-fx.js`.

### Reglas
- **Como máximo UN evento activo**, y como máximo uno por oleada. Ninguno antes de la **oleada 3**; **nunca en dos oleadas seguidas** (entre medias, oleada normal). Probabilidad 70 % por oleada elegible (en la oleada del jefe sólo puede tocar la Marea de Gravedad, y sólo en los mapas que la tienen).
- **Aviso 4 s antes** (`¡Se acerca: Marea de Gravedad!`, barra con el tiempo y qué esperar). Empieza entre 6 y 13 s después de arrancar la oleada. Si la oleada se limpia antes, el evento termina (con premio si ya estaba activo).
- Cada evento tiene **nombre, descripción, telegrafía y contrapartida/premio**. Al terminar bien da núcleos (y a veces vida/escudo).
- **Azar determinista:** usa un generador propio derivado de la semilla (`g.evRng`), así no cambia las oleadas existentes. Misma semilla, mismos eventos.
- El mapa decide qué eventos pueden salir y con qué **peso** (`EVENTOS_MAPA`): m1 Vacío de Islas (Marea 4, Ecos 2, Eclipse 2, Aurora 2, Sangre 1) · m2 Cámara Fractal (Marea 4, Niebla 2, Silencio 2, Lluvia 1, Eclipse 1) · m3 Laberinto (Niebla 3, Silencio 2, Ecos 2, Sangre 2, Aurora 1) · m4 Jardín (Sangre 3, Aurora 3, Lluvia 2, Eclipse 1, Niebla 1) · m5 Plaza (Ecos 4, Silencio 2, Niebla 2, Eclipse 2, Marea 1) · m6 Osario (Niebla 3, Eclipse 3, Lluvia 3, Sangre 2, Marea 1).

### Los 8 eventos
| Evento | Qué pasa | Cómo se ve (telegrafía) | Contrapartida / premio |
|---|---|---|---|
| **Marea de Gravedad** (10 s) | Única ocasión en que la gravedad se invierte: cuenta atrás de 3 s y luego inversión de máx. 3,5 s. Los Familiares y jefes sólo pueden invertir durante ella. En m2 es la **ingravidez** de siempre (6 s). **Singular** (octavo Huésped) es inmune: su pasiva Horizonte absorbe la inversión (`singularInmune` en `volteaJugador`) y la Marea le da +35 % a pozos y satélites. | Tinte violeta, cuenta atrás grande en la barra, giro de cámara de 0,8 s con viñeta | Podés moverte y disparar; aterrizaje blando; núcleos + botiquín |
| **Niebla de Almas** (20 s) | Visibilidad corta **y 3 bancos de niebla blanca** (sistema de nieblas: quien se queda adentro no es visto por las criaturas a más de 9 m) | Pantalla lechosa; las criaturas brillan (halos que se ven a través de la niebla) | +50 % núcleos por baja |
| **Lluvia de Astillas** (16 s) | Esquirlas caen cerca de vos | Círculo naranja que se llena 1,5 s antes del impacto | También hieren a las criaturas; núcleos |
| **Tormenta de Ecos** (18 s) | Rayos caen donde estabas | Círculo celeste y columna de luz 2 s antes | El rayo destroza criaturas: llevalas al círculo; núcleos |
| **Eclipse** (24 s) | Más élites con afijo (+45 % de probabilidad) | Tinte oscuro rojizo | Núcleos ×1,8 por baja + bono final |
| **Marea de Sangre** (14 s) | Horda de 12 a 30 Ánimas/Fuegos Fatuos ×1,25 de velocidad, en tandas rápidas, **y un banco de niebla ámbar** (+30 % de daño hecho y recibido por quien esté adentro) | Pulso rojo en los bordes; el banco se ve desde el aviso | Frágiles; al sobrevivir: vida completa y núcleos |
| **Bendición de la Aurora** (22 s) | Zona dorada (radio 7,5): cura 6 vida/s, +10 escudo/s y +30 % de daño dentro. Las criaturas la «apagan» (pureza) | Pilar de luz dorada desde el aviso | Si la zona sobrevive: escudo completo y núcleos proporcionales a la pureza; si se apaga, sin premio |
| **Silencio** (12 s) | Nadie usa habilidades (rol, desplazamiento, especial, 3.ª, definitiva) | Pantalla en grises | Melé ×1,5 y +30 % núcleos por baja |

### Gravedad: cómo quedó
- **Sólo bajo la Marea.** `pulso()` (eventos.js) es la única vía; `pulseGravity` de `src/sim/ai.js` lo usa. Fuera de la Marea el **Familiar atrae y dispara** (3 esquirlas) y los **jefes empujan hacia afuera** (onda de choque): no invierten.
- **Acotada:** máx. 3,5 s (`EVENTO.flipMax`); **un jugador no se invierte dos veces en 20 s** (`flipBloqueo`, cuenta desde el inicio + duración).
- **Rampa suave:** la gravedad pasa de +1 a −1 en 0,6 s (`factorFlip`), no de golpe; velocidad máxima de «caída» 16 u/s durante la inversión.
- **Aterrizaje blando** (`ablandar`/`limitarCaida`): al terminar se corta la subida y la caída se limita a 10 u/s hasta tocar suelo (máx. 5 s). También al terminar la ingravidez de m2.
- **Cámara** (`src/client/render.js`, `updateCamera`): un salto grande del «arriba» (>63°) se resuelve en un giro de **0,8 s fijos** con arranque y frenado suaves, rodando alrededor de la mirada (no se dispara la vista), con viñeta `#comfort` y el aviso `#gravmsg`. Seguís mirando, moviéndote y disparando (la mira usa la gravedad real de la simulación).
- **Ajuste «Reducir efectos de gravedad»** (Ajustes → táctil/controles; `settings.js` `reducirGravedad`): el cliente manda `soft` en el input y la simulación convierte la inversión en un **empujón hacia arriba** (sin cambiar el «arriba», sin giro de cámara). Mismo bloqueo de 20 s.
- **m2:** el mapa de la partida es una *instancia* (`makeMap2(true)`) cuya marea (`tideWin`) sólo la abre el evento; el mapa estático (cliente/pruebas) conserva el reloj de 60 s. Las zonas fijas del m1 (ascensor invertido, esfera sin gravedad, pozo) siguen siendo parte del terreno.

### Snapshot y eventos del bus
- `snapshot.ev = null | { id, ph: 'aviso'|'activo', t (s restantes de la fase), d (duración de la fase), cd (cuenta atrás de la inversión), mk: [[x,y,z,t,r,tipo(0 astilla/1 rayo),ux,uy,uz]], z: 0 | [x,y,z,r,pureza,ux,uy,uz] }`.
- Eventos: `{t:'ev', id, ph:'aviso'|'activo'|'fin', ok?}`; `gravity` con `soft:true` si fue empujón; `pull` cuando el Familiar atrae o el jefe empuja.
- HUD: barra `#evbar` (se crea sola dentro de `#hud`) y banner; efectos en `eventos-fx.js` (tinte `#evfx`, halos, círculos, pilar). Enganchado con 2 líneas en `render.js` y un `case 'ev'` en `main.js`.

### Pruebas
`node --test tests/eventos.test.js` (≈50 s: determinismo, máx. 1 evento, ≥ oleada 3, sin oleadas seguidas, aviso de 4 s, gravedad sólo bajo Marea, 20 s de bloqueo, <3 cambios/min en partidas de 12 oleadas con bot, cada evento, snapshot). Relacionadas: `ai`, `huespedes`, `waves`, `mundo`, `estilos`, `physics`, `camara` (navegador).
**Sin probar en navegador real:** la sensación del giro de 0,8 s con un dedo/mouse en un celular, el aspecto de la niebla con todas las calidades gráficas y el brillo de los halos con el post-proceso (probado sólo con swiftshader a bajo FPS, sin errores de consola).

## Arenas vivas: cada mapa es un ORGANISMO (identidad de arena, dueño 2026-10-18)
**Idea:** el mapa deja de ser un decorado. Cada arena (m1…m6) es un **organismo vivo** con nombre, folclore y ciclo de vida. Tiene un **corazón** y dos estructuras más, y todas tienen **dos caras**: *ayuda* (curación, escudo, velocidad o daño extra que hay que **reclamar o defender**) y *amenaza* (ataques del suelo o de las estructuras con **aviso de ≥ 1,2 s** y contrajuego claro). Se distingue de las demás por su nombre, su silueta, su paleta y su mezcla de órganos.
**Código:** `src/sim/arenas-vivas.js` (simulación determinista, sin DOM) · datos en `src/sim/data.js` (`ARENA`, `ARENAS_VIVAS`) · cliente `src/client/arenas-vivas-fx.js` · enganches de pocas líneas en `game.js`, `huespedes.js` (melé), `render.js` y `main.js` (banner).

### Los seis organismos
| Arena | Organismo y folclore | Corazón | Estructuras (cara de ayuda / cara de amenaza) | Paleta (ayuda · amenaza) · silueta |
|---|---|---|---|---|
| **m1** Vacío de Islas | **El Corazón de Isla**: las islas son el cuerpo de una medusa-coral; las Luces Malas son sus larvas | *Corazón de Isla* (flota sobre la isla central) · ataque **pulso**: anillo de luz de 8 m (aviso 1,6 s) | **Linterna de Luz Mala** (boca): *escudo* · **Corriente de Luz** (vena): carril de *velocidad* hacia el portal del este | cian `#19f0ff` · magenta `#ff3df2` · **medusa** (campana, zarcillos, anillos) |
| **m2** Cámara Fractal | **El Espejo que Respira**: espejos y ecos; el cascarón inspira y exhala | *Núcleo de Eco*: sólo recibe todo el daño mientras el Fuelle **inspira** (si no, ×0,3) | **Iris de Espejo** (boca): *+25 % de daño* · **Fuelle de Espejo** (pulmón): bruma que **sana** en calma y **envenena** si está furioso | violeta `#9b5cff` · ámbar `#ffb52e` · **iris** (octaedros facetados con satélites) |
| **m3** Laberinto Celestial | **La Garganta del Laberinto**: cantos y silbidos del Silbón | *Siringe de Cristal* | **Coro de Cristal** (boca): *cura* · **Silbido de Cristal** (raíz): **barrido** de sonido en línea; los muros lo frenan | menta `#3dffb8` · blanco `#e8fbff` · **ondas** (garganta + anillos de sonido) |
| **m4** Jardín de Carne | **La Madre Raíz**: un cuerpo que come y se cura | *Corazón del Jardín* (regenera 5 %/s: hay que dañarlo seguido) | **Pulmón de Esporas**: sana en calma; furioso **frena y quema** · **Zarcillo Hambriento** (raíz): **golpe** donde estabas | verde ácido `#b6ff2a` · rojo carne `#ff2f5e` · **corazón anatómico** con vasos y raíces |
| **m5** Plaza de los Ecos | **El Reloj Hambriento**: el pacto del relojero | *Péndulo del Reloj* · ataque **pulso** (campanada de 8 m, aviso 1,8 s) | **Manecilla de la Fuente** (raíz): **giro** que barre como una manecilla (aviso 1,8 s) · **Adoquines de Luz** (vena): carril de *velocidad* de la Calle a la Plaza | oro `#ffcf4a` · azul `#5b8bff` · **reloj** (esfera, marcas, péndulo) |
| **m6** Osario sin Techo | **El Osario Insomne**: los huesos que no descansan | *Corazón Calcificado* (sobre el altar) · ataque **golpe** de manos de hueso · **vuelve solo a los 26 s** si lo rompés | **Respiradero de Brasas** (pulmón): ceniza que sana o quema · **Costillar** (vena): carril de *+25 % de daño* por la nave | marfil `#efe6c8` · brasa `#ff6a14` · **costillas** (jaula de costillas con corazón encendido) |
Cada arena combina órganos distintos (boca+vena, boca+pulmón, boca+raíz, pulmón+raíz, raíz+vena, pulmón+vena) y la prueba lo exige. Los textos de folclore completos y qué hace cada órgano están en `ARENAS_VIVAS` (campos `folclore` e `info`).

### Los órganos
- **Corazón** (se puede dañar con disparos de rayo, proyectiles, explosiones y golpes cuerpo a cuerpo). Tiene `hp × (0,85 + 0,15 × oleada)`. **Si lo rompés:** el organismo se **adormece el resto de la oleada** (sin amenazas), suelta un botiquín y da núcleos a todos; en la oleada siguiente vuelve con el 60 %. Reglas propias: m2 *vulnerable sólo al inspirar* · m4 *regenera rápido* · m6 *revive a los 26 s*.
- **Boca** (ayuda): se **alimenta** con las bajas que ocurren cerca (4 + oleada/2; las élites cuentan doble). Llena, abre su zona 14 s con su beneficio: `cura` (+6 vida/s y +10 escudo/s), `escudo` (+24 escudo/s), `danio` (+25 % de daño) o `veloz`. **Defenderla:** cada criatura dentro de la luz la apaga más rápido (+35 % por criatura, hasta 6). En el respiro (*ofrenda*) está siempre abierta.
- **Vena** (ayuda): carril de luz de 2,4 m de ancho: quien lo pisa recibe el beneficio (`veloz` ×1,3, `danio` +25 %). Es un atajo: no es sólido ni teletransporta.
- **Pulmón** (doble cara, se puede romper): ciclo de 14-16 s = **inspira** 5-6 s, **retiene** 2 s y **exhala** 8 s una nube. *Calmo* (dormido/despierto/ofrenda): la nube **sana**. *Furioso*: la nube **daña** (7 de daño/s en m2 y m6; en m4 3/s y además frena al 60 %) y las criaturas dentro también sufren. El aviso es el momento de **retener el aire** (el borde se llena de franjas de peligro) y la nube que cambia de color: así se «cambia la niebla».
- **Raíz** (amenaza, se puede romper): lanza un ataque con aviso y después enfría su ciclo. Tipos de ataque (comunes a cualquier órgano con `atk`): **golpe** (círculo donde estabas al empezar el aviso) · **pulso** (anillo alrededor del órgano) · **barrido** (línea larga; la cortan los muros y las coberturas) · **giro** (línea que gira como una manecilla durante 2 s). Todos hieren también a las criaturas (×3): llevarlas al círculo es contrajuego.

### El ciclo de vida (fases)
| Fase | Cuándo | Amenaza | Ayuda |
|---|---|---|---|
| **dormido** | calma inicial, los primeros 25 s de la oleada 1, y toda la oleada si rompiste el corazón | ninguna | ×0,4 (sólo si alimentaste una boca) |
| **despierto** | oleada en curso | a **media cadencia** (cadencia ÷ 0,55) | ×1 |
| **furioso** | oleada 2 desde los 50 s · oleadas 3-4 desde los 28 s · oleada 5+ desde los 14 s · jefe desde los 8 s (la oleada 1 nunca se enfurece) | **cadencia plena** y pulmón tóxico | ×0,75 |
| **ofrenda** | el respiro entre oleadas | ninguna | ×1,5, bocas abiertas y nubes sanadoras |
Los cambios de fase salen como evento `{t:'ar', m, ph}` y el cliente los muestra con el banner existente (p. ej. «El Corazón de Isla despierta», con un retraso de ~2,5 s para no pisar «OLEADA n»). También `roto` y `renace`.

### Reglas de justicia y de diseño
- **Aviso:** ningún ataque golpea antes de `ARENA.telMin` = 1,2 s; como mucho **3 avisos a la vez** en toda la arena y nunca dos del mismo órgano. El golpe cae **donde estabas al empezar el aviso** (moverse lo esquiva); las líneas apuntan a donde estabas y cualquier cobertura o muro las corta.
- **Daño moderado:** de 13 a 20 por golpe (+1,2 por oleada), cadencias de 5,5 a 12 s. Peor caso (quedarse quieto en el lugar más feo): ≈ 1,6 a 3,5 de daño por segundo por organismo. El escudo se recarga solo si dejás de recibir daño 3 s.
- **Nada bloquea:** los órganos **no son sólidos** (no se agregan sólidos al mapa); no están a menos de 12 m de las apariciones (6 m las venas) ni a menos de 5 m de un punto de objetivo.
- **Determinismo:** el azar sale de `g.arRng` (derivado de la semilla, como `g.evRng`); **nunca** se usa `g.rng`. (Una criatura que muere por un ataque de la arena sí tira sus botines con `g.rng`, igual que cualquier otra baja.)
- **Coordinación con los eventos de oleada:** no se duplica nada. Mientras corre *Lluvia de Astillas*, *Tormenta de Ecos* o *Marea de Sangre*, el organismo ataca a **media cadencia**. La *Aurora* (+30 % de daño) y las zonas de daño de la arena se **multiplican** (máx. ×1,6 si estás en las dos). Los botiquines salen del mismo sistema de pickups.
- **Bajas de la arena:** si un ataque o una nube mata a una criatura, la baja se le **acredita al jugador vivo más cercano** (núcleos, esencias, puntaje y carga de la definitiva), para que usar la arena a tu favor no te cueste progreso.
- **Los órganos no tapan:** el rayo y los proyectiles de los jugadores **dañan al órgano y siguen de largo** (no frenan el disparo que iba a una criatura que está detrás).
- **Interruptores para pruebas:** `import { CTL } from './src/sim/arenas-vivas.js'` → `CTL.off = true` apaga todo (partidas A/B) · `CTL.sinAtaques` / `CTL.sinBeneficios` apagan una sola cara.

### Contrato con el resto
- **Snapshot:** `ar = null | { ph, t, sed, o: [[hp%, roto, hambre%, zona (s; 99 = abierta), respiro 0-1, modo (0 inspira/1 retiene/2 exhala), golpe reciente]…], tl: [[órgano, tipo(0 golpe/1 pulso/2 barrido/3 giro), x,y,z, dx,dy,dz, largo o radio, ancho, segundos que faltan, total, barriendo]…] }`. Las posiciones de los órganos NO viajan: salen de `layoutArena(mapa)` (función pura que comparten sim, cliente y pruebas; en m2 elige el primer candidato libre de colinas y puntos de objetivo).
- **Eventos del bus:** `ar` (fase/roto/renace) · `arhit` (daño a un órgano) · `arofrenda` (una boca se llenó) · `arfire` (un ataque golpea). El cliente usa `sound.hit/pickup/boom` ya existentes.
- **Enganches en el sim:** `initArenas` (constructor) · `tickArenas` (cada paso, antes de mover a los jugadores) · `arVel` (velocidad) · `arDanio` (daño del jugador) · `arKill` (alimenta bocas) · `arTargets`/`danarOrgano` (rayo) · `arExplosion` (explosiones de jugadores) · `arMelee` (golpe cuerpo a cuerpo) · `arSnap`.

### Cliente (`arenas-vivas-fx.js`)
- Un **cuerpo** (malla fusionada con silueta propia de cada arena) + un **halo** + una **marca de suelo/nube** por órgano; **avisos** de ataque en un pozo de 3. Todo **autoiluminado** con piso de brillo (nunca queda una zona oscura que esconda al Huésped), mezcla de la paleta de la arena y borde Fresnel.
- **Lenguaje común de legibilidad:** *ayuda* = anillos suaves que suben y un faro de luz (se ve de lejos) · *amenaza* = **franjas de peligro** con borde blanco que se llena hasta el golpe (más rápido y más blanco cuanto más cerca) · el color cambia por arena, el lenguaje no.
- **Latido sincronizado con la fase:** dormido 0,5 Hz tenue · despierto 1 Hz · furioso 1,9 Hz brillante · ofrenda 0,75 Hz cálido. El corazón se contrae y se pone blanco mientras carga un ataque y destella al golpear; roto se ve gris y encogido.
- Sólo **lee** `state.ar`. No toca iluminación global, `quality.js` ni la niebla: otro equipo trabaja eso.

### Pruebas y medición
- `node --test tests/arenas-vivas.test.js` (≈ 30 s, 33 pruebas): datos y distinción entre arenas · fases · eventos y snapshot compacto · determinismo (misma semilla = mismo estado cada 0,5 s en 150 s con bot) · `g.rng` intacto · daño, rotura, regeneración y reaparición del corazón · alimentar y defender bocas · venas · avisos (≥ 1,2 s, se esquivan, hieren criaturas, la cobertura corta el haz) · pulmones · apaga/enciende por fase · ningún órgano bloquea apariciones/objetivos y se camina a todos los objetivos de m5/m6 con las arenas furiosas.
- `node --test --test-name-pattern="^m4:" tests/arenas-vivas-bots.test.js` (**una arena a la vez**, 1-4 min cada una): bots de prueba (4 semillas, habilidad 1,2) CON y SIN organismo.
- `node --test tests/arenas-vivas-render.test.js` (Chromium por software, ≈ 5 min): presupuesto en Baja con `renderer.info`. Capturas y medición por órgano: `node tools/shot-arenas.js todas shots/arenas low --fase=furioso,aviso`.
- **Medido (2026-10-18):** *bots* (8 semillas, habilidad 1,2; victorias CON organismo / SIN él): m1 8/8 · 7/8, m2 8/8 · 8/8, m3 7/8 · 5/8, m4 6/8 · 6/8, m5 7/8 · 7/8, m6 6/8 · 4/8. Los bots de prueba **no esquivan avisos ni buscan beneficios** (sólo se llevan algún golpe y aprovechan sin querer una vena o una boca): sirven para demostrar que el organismo no vuelve injugable la arena, no para afinar el equilibrio humano. *Render (Baja, `renderer.info`, peor cuadro con los 3 órganos a la vista):* m1 12 llamadas / 2 930 triángulos · m2 5 / 1 860 · m3 8 / 1 728 · m4 8 / 2 720 · m5 7 / 1 338 · m6 8 / 2 178 agregados a la escena (con un aviso de ataque suman ≤ 3 llamadas más).
- **Conocido y previo a este trabajo:** `tests/limbo-mapas.test.js` falla en «m6: el jefe es derrotable» (los bots de prueba ganan 1 de 4 en m6 incluso sin organismo; con el organismo ganan más) y `tests/map4.test.js` («llegan al jefe») y dos pruebas de `tests/e2e.test.js` (coop por tiempo agotado y «el modo básico esconde mov») fallan igual en el commit `aec4d29`, antes de las arenas vivas.

## Nieblas tóxicas de colores: zonas con función (dueño, 2026-10-18)
**Idea:** las nieblas dejan de ser un adorno. Hay **6 colores** y cada uno **hace algo** en el juego (ayuda, castiga o cambia cómo peleás). Todas se **ven venir** (círculo en el suelo que parpadea + cartel de aviso) antes de actuar, y todas **respiran**: aparecen, actúan un rato y se retiran. Cada arena tiene **2 nieblas temáticas**; además las sueltan los **pulmones** de las arenas vivas y los eventos **«Niebla de Almas»** y **«Marea de Sangre»** (que ahora usan este sistema, no uno aparte).
**Código:** `src/sim/nieblas.js` (determinista, sin DOM; rng propio `g.ngRng`, nunca `g.rng`) · cliente `src/client/nieblas-fx.js` · enganches de 1 línea en `game.js` y 2 en `eventos.js` (`nieblaEvento`).

### Los 6 colores
| Color | Nombre / función | Qué hace dentro | Contrajuego |
|---|---|---|---|
| **Verde ácido** | **Niebla ácida** · veneno | Quema ≈ 2,6 de vida/s (+0,08 por oleada; **nunca deja menos de 8**), te frena al 78 %. A las criaturas las frena y las quema 4,5/s (jefes no). | Salir del círculo; llevar criaturas adentro. |
| **Cian** | **Niebla restauradora** · cura | +4,5 de vida/s y +9 de escudo/s. **Atrae** a las criaturas hacia su centro (3,2 m/s, hasta 2,2 radios). | Es un descanso con precio: te vienen a buscar. |
| **Magenta** | **Niebla alucinógena** · ecos falsos | Siluetas brillantes que no existen (en pantalla y en el radar de bordes) y tu rumbo se tuerce un poco al caminar (±0,2 rad, lento; **se apaga con «Reducir efectos»**). A cambio, **+15 % de daño**. | Mirar la barra de vida de la criatura, no el eco. |
| **Ámbar** | **Niebla de frenesí** | **+30 % de daño hecho y recibido** por todo el que esté adentro: vos, las criaturas y otros jugadores. | Entrar a propósito para cerrar una pelea, o evitarla con poca vida. |
| **Blanco** | **Niebla de ocultamiento** | Las criaturas a más de 9 m **dejan de verte**. Los jefes no se engañan y quien recibe un disparo tuyo te ve 3 s. | No sirve para disparar «gratis» a jefes; sirve para respirar y reagruparse. |
| **Negro violeta** | **Niebla del vacío** · drena | Congela la recarga de TODAS tus habilidades (rol, desplazamiento, especial, 3.ª, combo) y apaga la carga de la definitiva (−8/s). | Cruzarla rápido; no empezar una pelea larga adentro. |

### Reglas de justicia y de diseño
- **Aviso:** toda niebla dañina muestra su círculo parpadeando y el cartel «¡Se acerca niebla X!» **≥ 2 s** (`NIEBLA.avisoMin`) antes de actuar (2,4 s las dañinas; 0,8-1,2 s las buenas).
- **Respiro:** entre oleadas y en el campo de pruebas, las dañinas **duermen**. Ninguna actúa en la oleada 1 (ácida, magenta y ámbar desde la 2; vacío desde la 3).
- **El veneno no mata** (deja ≥ 8 de vida) y el ámbar sólo multiplica lo que ya pasa: nunca una niebla te deja en el suelo sola.
- **Determinismo:** el azar (compás de cada ciclo ±8 %, dirección de las nubes de los pulmones, posición de los bancos de evento) sale de `g.ngRng` (derivado de la semilla). `tests/nieblas.test.js` cuenta las llamadas de azar: `tickNieblas` nunca consume `g.rng`, `g.evRng` ni `g.arRng`.
- **Máximo 9 zonas vivas** (`NIEBLA.maxZonas`); el cliente las dibuja todas con un solo `InstancedMesh`.
- **Bajas:** si el ácido mata a una criatura, la baja se acredita al jugador vivo más cercano (igual que las arenas vivas).

### Orígenes de niebla
- **Arena (2 por mapa, fijas, ciclo de 36-44 s con aviso → activa → dormida):** m1 Vacío de Islas **cian** «Bruma de Luz Mala» + **vacío** «Vacío de la Isla» · m2 Cámara Fractal **magenta** «Niebla de Espejos» + **ámbar** «Brasa del Espejo» · m3 Laberinto **blanca** «Silbido Blanco» + **cian** «Aliento del Coro» · m4 Jardín **ácida** «Esporas Agrias» + **magenta** «Esporas del Sueño» · m5 Plaza **ámbar** «Hora de Oro» + **blanca** «Bruma de la Plaza» · m6 Osario **vacío** «Ceniza del Osario» + **ácida** «Moho de Hueso». (Los 6 colores salen dos veces.) Anclas: puntos de objetivo del mapa (`spots`), nunca encima de la aparición de una niebla dañina.
- **Órgano:** el **Fuelle de Espejo (m2), el Pulmón de Esporas (m4) y el Respiradero de Brasas (m6)** sueltan una nube de 6 m de radio al empezar a **exhalar**, que se aleja 9 s. Calmo → **cian**; furioso → m2 **magenta**, m4 **ácida**, m6 **ámbar**. Se suma al efecto propio del pulmón (no lo reemplaza): por eso los números son moderados.
- **Evento:** **«Niebla de Almas»** → 3 bancos de niebla **blanca** (radio 10) en su aviso, activos mientras dura y se retiran al terminar (se conserva la pantalla lechosa y el +50 % de núcleos); **«Marea de Sangre»** → 1 banco **ámbar** (radio 10).

### Contrato con el resto
- **Snapshot** `ng = null | { z: [[id, tipo 0-5, x,y,z, radio, densidad 0-1, fase (0 dormida/1 aviso/2 activa), ux,uy,uz]…], d: [[jugador, tipo, zona, segundos adentro]…] }` (≈ 100 bytes por zona; `null` en el campo de pruebas). Tipos: 0 ácida · 1 cian · 2 magenta · 3 ámbar · 4 blanca · 5 vacío.
- **Eventos del bus:** `{t:'ng', ph:'aviso'|'activo'|'fin'|'entra'|'sale', k, z, p, pid?}`; el cliente muestra el cartel al entrar y un tic de aviso si es dañina y está cerca.
- **Enganches en el sim:** `initNieblas` · `tickNieblas` (después de `tickArenas`, antes de mover a los jugadores) · `ngVel` (velocidad) · `ngDeforma` (rumbo) · `ngRecibe` (daño recibido) · `ngDanio` y `ngMonstruoRecibe` (daño hecho / daño a la criatura de adentro) · `ngOculta` (objetivo de las criaturas) · `ngSnap`. Interruptores para pruebas: `CTL.off`, `CTL.sinOrganos`, `CTL.sinEventos`; `nieblaTemporal(g, tipo, pos, radio, vida)` crea una niebla a mano (modo desarrollo y pruebas).
- **HUD:** cartel `#ngchip` («Dentro de: Niebla ácida» + su función; si se acerca una dañina «¡Se acerca…!» con barra que se llena hasta que actúa), viñeta de color mientras estás adentro y banner al entrar.

### Cliente (`nieblas-fx.js`)
- **Nubes:** un solo `InstancedMesh` de cartulinas (billboards) con shader de ruido para **todas** las zonas: 9 nubes por zona en Baja, 18 en Media, 30 en Alta (ajuste «Nubes de las nieblas de colores» en el menú Gráficos: *Sólo aviso* las apaga). Se disuelven al acercarse a la cámara. Aro + disco en el suelo (2 llamadas) y ecos falsos magenta (1).
- Colores **flashero-psicodélicos** con borde claro y respiración de tono; la niebla blanca y la del vacío son opacas (tapan) y las demás son luz aditiva. La viñeta de pantalla nunca pasa de 0,5-0,6 de opacidad (se sigue viendo al Huésped).
- **«Reducir efectos»** apaga los ecos falsos y la ondulación de la viñeta.

### Pruebas
- `node --test tests/nieblas.test.js` (16 pruebas, ≈ 1 min): datos · cada arena · determinismo y conteo de azar · avisos ≥ 2 s · respiro · cada color · eventos · pulmones · snapshot.
- `node --test --test-name-pattern="^m4" tests/nieblas-bots.test.js` (**de a una arena**, ≈ 1-4 min cada una): bots CON y SIN nieblas, sin trabarse y sin NaN.
- `node --test tests/nieblas-render.test.js` (Chromium por software): presupuesto de render en Baja con las 9 zonas activas. Capturas: `node tools/shot-nieblas.mjs todas shots/nieblas low dia zona|dentro|luz`.


## Botín y Forja biológica (2026-10-18)
Las fuentes de este documento ahora también sueltan **botín** (`src/sim/drops.js`, rng propio `g.drRng`): élites con afijo, ofrendas de las arenas vivas, eventos de oleada superados, misiones cumplidas, capullos florecidos (cofres), el respiro entre oleadas y el jefe (que además suelta el plano raro de la firma del Huésped). El Herrero de Huesos suma la oferta 3 (forjar un objeto vivo al azar). Tablas, pity y contrato: **docs/INVENTARIO.md**.
