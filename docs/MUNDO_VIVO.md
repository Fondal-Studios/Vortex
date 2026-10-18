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
| **Marea de Gravedad** (10 s) | Única ocasión en que la gravedad se invierte: cuenta atrás de 3 s y luego inversión de máx. 3,5 s. Los Familiares y jefes sólo pueden invertir durante ella. En m2 es la **ingravidez** de siempre (6 s). | Tinte violeta, cuenta atrás grande en la barra, giro de cámara de 0,8 s con viñeta | Podés moverte y disparar; aterrizaje blando; núcleos + botiquín |
| **Niebla de Almas** (20 s) | Visibilidad corta | Pantalla lechosa; las criaturas brillan (halos que se ven a través de la niebla) | +50 % núcleos por baja |
| **Lluvia de Astillas** (16 s) | Esquirlas caen cerca de vos | Círculo naranja que se llena 1,5 s antes del impacto | También hieren a las criaturas; núcleos |
| **Tormenta de Ecos** (18 s) | Rayos caen donde estabas | Círculo celeste y columna de luz 2 s antes | El rayo destroza criaturas: llevalas al círculo; núcleos |
| **Eclipse** (24 s) | Más élites con afijo (+45 % de probabilidad) | Tinte oscuro rojizo | Núcleos ×1,8 por baja + bono final |
| **Marea de Sangre** (14 s) | Horda de 12 a 30 Ánimas/Fuegos Fatuos ×1,25 de velocidad, en tandas rápidas | Pulso rojo en los bordes | Frágiles; al sobrevivir: vida completa y núcleos |
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
