# Los cinco Huéspedes y el combate híbrido (contrato entre piezas)

Datos: `src/sim/data.js` → `CHARACTERS[id]` con `host:true` (axioma, vesper, micelio, umbra, seraf) y `HOST_IDS`. Los 5 héroes anteriores (egida, lumen, forja, vigia, nova) quedan como `legacy:true` («Veteranos»). Umbra extiende al héroe anterior del mismo nombre.

## Entradas nuevas (`game.setInput`)
`melee` (mantener = pesado, soltar rápido = ligero), `s3` (habilidad 3), `ult` (definitiva). Las existentes: `mov` = habilidad 1, `esp` = habilidad 2.
Teclado propuesto: F hab.1 · G hab.2 · Z hab.3 · R definitiva · V melee (la 3ª persona pasa a P).

## Snapshot por jugador (campos nuevos)
`mc`,`ec`,`s3c`: segundos restantes de enfriamiento de hab.1/2/3 · `ul`: carga de la definitiva 0..100 · `ua`: segundos que le quedan a la definitiva activa (0 = inactiva) · `cmb`: combo melee (0..3) · `bf`: máscara de estados propios (1 caparazón, 2 camuflaje, 4 sobrecarga, 8 frenesí, 16 floración, 32 metamorfosis, 64 desfase, 128 planeo, 256 barrera) · `sy`: simbionte aliado {x,y,z} o null.

## Eventos nuevos (`snapshot.events`)
`{t:'skill', pid, k:'mov'|'esp'|'s3'|'ult', id, p:[x,y,z]}` (id = el de data.js) · `{t:'melee', pid, kind:'light'|'heavy'|'air'|'exec', p, d:[x,y,z], hit:n}` · `{t:'ultend', pid, id}` · `{t:'fall', pid, v, p}` al aterrizar tras caída fuerte.

## Reglas de trabajo en equipo
Un solo árbol de trabajo compartido. Cada pieza tiene sus archivos; las ediciones a archivos compartidos (main.js, ui.js, index.html, style.css, render.js) deben ser PEQUEÑAS y localizadas: releé el archivo justo antes de editar. No hagas commit, no uses git stash/checkout/reset: el director integra.
