# Tienda — El Cambista de Almas

Pantalla **Huéspedes › Tienda** (también con **un toque en tus núcleos**, arriba a la derecha, desde cualquier pantalla del menú; mapa del menú en [`docs/MENU.md`](MENU.md)). Es el mismo mercader que aparece dentro de las partidas (`src/sim/npcs.js`, «El Cambista de Almas»): acá vende de verdad, a cambio de **núcleos** (`perfil.cores`). Las esencias (`perfil.ess`) sólo se cambian.

## Archivos
| Archivo | Qué hace |
|---|---|
| `src/sim/tienda.js` | Lógica **pura** (sin navegador): catálogo, precios fijos, requisitos, migración, stock rotativo determinista, frases del Cambista |
| `src/client/tienda.js` | Compras y ventas sobre el perfil guardado. Valida todo antes de tocar nada y devuelve `{ ok, motivo, frase }` |
| `src/client/tienda-ui.js` + `public/tienda.css` | La pantalla: pestañas, saldo, confirmación, «Comprado» |
| `tests/tienda.test.js` | 13 pruebas (precios, rotación, compras, migración, nunca negativos, botiquín en la simulación) |

## Qué se vende
1. **Huéspedes** — los que tienen `starter:false` + `unlock:{ precio, req? }` en `CHARACTERS`. Vista 3D (`public/huesped-arte.html`), rol, habilidad principal (la de Combo), requisito y precio. Precios hoy: Umbra 500 · Seraf 500 · Danzante 600 · Colmena 600 (req: rango 3 de maestría con otro Huésped) · Singular 750 (mismo req).
2. **Planos y materiales** — 4 paquetes de materiales y 2 planos por tanda, con descuento (0–20 %) y **una oferta del día** (≥ 25 %). Los planos son de rareza Rara/Épica/Legendaria; las armas firma NO se venden (sólo las suelta el jefe de su mapa). También se **venden** materiales sobrantes al 35 % del precio.
3. **Objetos** — 3 piezas Comunes/Raras por tanda (con su calidad `q` ya tirada) y **desguace rápido** de sobrantes (no toca lo bloqueado, favorito ni puesto).
4. **Servicios** — *Botiquín inicial* (35 ◆, máx. 5, 1 por partida en solitario: te levanta una vez con la mitad de la vida) · *Reinicio de nodos* (80 ◆: devuelve **todos** los puntos del árbol Shooter/Combo de un Huésped, sin el 25 % de pérdida del reinicio normal) · *Retirada de la tirada* (25 + 35 × rareza ◆: vuelve a tirar la calidad de una pieza; puede empeorar) · *Cambio de esencias* (14 ◆ compra 1, vende 1 por 4 ◆).

## Cuáles Huéspedes son tuyos (ajustado y documentado)
- **Iniciales** (siempre tuyos): **Axioma, Vesper y Micelio**. Umbra y Seraf pasaron a la tienda (`starter:false`, 500 ◆). Los Veteranos (no Huéspedes) no se compran.
- El perfil guarda `huespedes: [ids comprados]`. `poseeHuesped(perfil, id)` decide.
- **Migración**: al abrir un perfil sin lista `huespedes`, quien ya tenía rastro de uso de un Huésped (maestría con XP/partidas, evolución, camino, puntos del árbol) o lo tenía elegido en el navegador **lo conserva**. Nadie pierde acceso.
- Dónde se hace cumplir: el selector de Huésped muestra 🔒 y el botón pasa a «Comprar en la Tienda»; `asegurarHuesped()` (en `equipo.js`, y al empezar partida solo o coop) vuelve a Axioma si el elegido no es tuyo; Combo/Shooter y la evolución trabajan con el Huésped elegido, así que siguen la misma regla. **Límite honesto**: es una regla del cliente. El servidor del cooperativo NO conoce tu perfil (se guarda en tu navegador) y no valida la economía: alguien que edite su navegador puede elegir cualquier Huésped. Es un juego personal; no hay ranking que proteger.

## Stock rotativo
`oferta(dia, rot)` es una función pura: mismos números → misma oferta. `dia` = día UTC; `rot` = partidas terminadas (`perfil.tienda.rot`, sube en `cerrarPartida`). Cambia a medianoche UTC **y** después de cada partida. `perfil.tienda = { clave, comp: [renglones comprados], rot }`; al cambiar la clave se vacían las compras. Cada renglón se compra una vez por tanda.

## Anti-trampas simples
Los precios salen de `src/sim/tienda.js` (nunca de la pantalla); `tienda.js` del cliente comprueba saldo, requisito, cupo (depósito de 99, inventario de 60), que el renglón exista en la oferta vigente y que no se haya comprado. Vender paga siempre menos que comprar (35 %). Los núcleos nunca quedan negativos (probado). Recargar la página no cambia la oferta ni las tiradas (`perfil.nf` es un contador persistente).

## Pantalla
Pestañas **Huéspedes · Planos y materiales · Objetos · Servicios**; saldo arriba a la derecha; cada compra abre un cartel «¿Comprar X por N ◆? Sí / No»; después aparece «Comprado: X» y el Cambista dice una frase. Un botón que no se puede usar dice por qué («No alcanzan núcleos», «Falta requisito», «Inventario lleno»). Teclado/mando: flechas = vecino más cercano, Enter = botón, Esc = cierra el cartel o vuelve.

## No probado
Compra con un iPhone real; la Tienda dentro de una sala cooperativa (el botiquín sólo se gasta en solitario); el peso del retrato 3D en teléfonos lentos (carga un `<iframe>` por Huésped elegido, con retardo de 350 ms).
