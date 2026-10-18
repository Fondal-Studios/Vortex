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
