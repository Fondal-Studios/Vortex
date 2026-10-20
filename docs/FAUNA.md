# Fauna consumible y Metamorfosis (pedido del dueño, 2026-10-20)

> **Idea del dueño:** «Agregar a los mapas SERES VIVOS psicodélicos que los Huéspedes puedan CONSUMIR para generar METAMORFOSIS según lo que comen. Por ejemplo, una LAGARTIJA DE HIELO que haga que el Huésped se haga de hielo.»
>
> **Lore (docs/HISTORIA.md):** en el limbo todo lo que ves quiere tu vida… menos esto. La fauna son los **únicos seres del Vórtice que nacen en vez de morir**: bichos chicos, psicodélicos y vivos de verdad. No te atacan (salvo tres, que muerden si los pisás). Comerlos es **pedir prestada una vida chica**: el Huésped (que ya vive en vos) la absorbe y se **transforma** un rato. Humor seco, ambiente primero.

## Cómo se juega (en 30 segundos)
1. **Mirá los puntitos de color** en el borde de la pantalla: son bichos cercanos. Aparecen sobre todo en el **respiro entre oleadas** (en combate casi no; en el jefe no hay).
2. **Acercate despacio** (agachado o caminando es mejor que corriendo: los dormidos se despiertan por el ruido). A menos de **2,7 m** aparece el cartel **«E · Comer: …»** (táctil: botón **USAR**).
3. **Apretá E / USAR** y el bicho vuela a tu boca. Ya tenés una **forma** (60–90 s) con su ícono y barra de tiempo arriba de tu vida (`#ffchip`).
4. **Comé otra especie**: si las formas son compatibles se **funden en un híbrido** (¡hay 12!); si no, la nueva reemplaza a la anterior y la vieja queda como **residuo menor** (40 % de sus números pasivos, ≤ 20 s).
5. **En Melé** el **remate** (golpe pesado o 3.er golpe del combo) **devora** al bicho que tengas delante («devorar») y además suelta el **golpe elemental** de tu forma (congela, quema, empuja…). **En Shooter** la forma cambia la munición: color elemental del rastro, balas que atraviesan, estados en cada impacto.
6. Todo lo que comas queda en el **Códice de Fauna** (menú › Mundo › **Bestiario › pestaña Fauna**, también con la tecla **F**): contador, hitos, ADN e híbridos descubiertos.

**Opcional:** comer solo al quedarte pegado a un bicho ~0,6 s: URL `?autofauna=1` o el ajuste `faunaAuto` (por defecto se come con USAR / E).

## Las 20 especies (3 por arena + 2 raras)
Cada arena tiene SU fauna, con el folclore del lugar (docs/MAPAS.md). Las **peligrosas** (3) no huyen: te miran, se te tiran si te acercás mucho y **muerden** (5 + 0,35 por oleada de daño, cada 2,5 s, y **nunca** te bajan de 15 de vida). Las **raras** pueden aparecer en cualquier arena, casi siempre en el respiro (x3 en el Eclipse).

| Especie | Arena | Forma que da | Dura | Comportamiento |
|---|---|---|---|---|
| **Lagartija de Hielo** | m1 | ❄ Piel de Hielo | 75 s | repta/camina, cerca del órgano «corazon» |
| **Polilla de Vacío** | m1 | 🌀 Fase del Vacío | 70 s | vuela, en grupo de 2–4, atraída por niebla negra |
| **Colibrí de Luz** | m1 | ✨ Piel de Luz | 70 s | vuela, en grupo de 1–2, atraída por niebla cian |
| **Escarabajo de Cristal** | m2 | 💎 Coraza de Cristal | 80 s | repta/camina, suele dormir, cerca del órgano «boca» |
| **Araña de Seda de Eco** | m2 | 🕸 Hilo de Eco | 75 s | corretea, ⚠ PELIGROSA |
| **Mariposa Eléctrica** | m2 | ⚡ Nervios Eléctricos | 65 s | vuela, en grupo de 2–4, atraída por niebla magenta |
| **Rana de Marea** | m3 | 🌊 Pulso de Marea | 80 s | salta, cerca del órgano «boca» |
| **Pez Lunar** | m3 | 🌙 Peso de Luna | 85 s | vuela, en grupo de 2–4, atraída por niebla blanca |
| **Grillo Silbador** | m3 | 🔊 Voz Sónica | 65 s | salta, cerca del órgano «corazon» |
| **Sapo Venenoso** | m4 | ☣ Sangre Venenosa | 80 s | salta, ⚠ PELIGROSA, atraída por niebla acida |
| **Sanguijuela de Rubí** | m4 | 🩸 Sed de Rubí | 70 s | repta/camina, suele dormir, cerca del órgano «corazon» |
| **Caracol de Raíz** | m4 | 🌱 Savia de Raíz | 85 s | repta/camina, suele dormir, cerca del órgano «pulmon» |
| **Cucaracha Relojera** | m5 | ⏳ Hora Torcida | 75 s | corretea, cerca del órgano «raiz» |
| **Paloma de Humo** | m5 | 🌫 Aliento de Humo | 70 s | vuela, en grupo de 2–3, atraída por niebla blanca |
| **Gorrión de Cobre** | m5 | 🔔 Conductor de Cobre | 65 s | vuela, atraída por niebla ambar |
| **Salamandra de Brasa** | m6 | 🔥 Cuerpo de Brasa | 75 s | repta/camina, suele dormir, atraída por niebla ambar, cerca del órgano «pulmon» |
| **Ciempiés de Hueso** | m6 | 🦴 Armadura de Huesos | 85 s | corretea, ⚠ PELIGROSA, cerca del órgano «corazon» |
| **Murciélago de Ceniza** | m6 | 🌑 Manto de Ceniza | 70 s | vuela, en grupo de 2–3, atraída por niebla negra |
| **Mariposa Prisma** | cualquiera | 🌈 Prisma Vivo | 90 s | vuela, RARA |
| **Axolotl de Aurora** | cualquiera | 🌅 Aliento de Aurora | 90 s | repta/camina, suele dormir, RARA |

### Dónde y cuándo aparecen (determinista: `g.faRng`, nunca `g.rng`)
- **Cuándo:** respiro entre oleadas (y campo de pruebas): hasta **8 bichos** (+2 por jugador extra), uno nuevo cada 1,6 s. En combate: hasta **3**, uno cada 11 s (−2 si la arena está furiosa). En el jefe: **0** (los que había se van corriendo). Tope absoluto **12** vivos (`FAUNA.max`). Se retiran a los 95–160 s o si quedan a más de 120 m.
- **Dónde:** cada especie nace en una de **su** arena (`fauna-data.js → mapa`). Si tiene gusto por algo, nace ahí: **cerca de un órgano** de la arena viva (la Lagartija junto al Corazón de Isla, la Salamandra junto al Respiradero…) o **dentro de una niebla** de su color (el Colibrí de Luz en la niebla cian, la Polilla de Vacío en la negra, el Sapo en la ácida…; pesan ×3 cuando esa niebla está activa).
- **Eventos:** la **Lluvia de Astillas** y la **Tormenta de Ecos** los **ahuyentan** (huyen y no nacen más hasta que termina); el **Eclipse** triplica la chance de una rara; la **Aurora Bendita** no los toca.
- **Estados:** `dormida` (se despierta por el ruido: de 1 m agachado a 4 m corriendo) → `alerta` (te mira ~0,5 s: tu ventana para comerla) → `huyendo` (zigzag, ~0,75–0,95 de tu velocidad; a los 5,5 s se **cansa**: 3,5 s a ×0,4 y la alcanzás) · `pastando` (camina por tramos) · `acechando` (peligrosas). Nadie camina hacia el vacío: al borde de una isla o foso se quedan **acorraladas** (y se dejan comer). Los voladores mantienen su altura sobre el piso; las ranas y grillos van a saltos.

## Las formas (20) y sus efectos de partida
Cada forma dura 60–90 s según la especie (**tope 150 s** aunque la refresques). Números pensados para no romper el equilibrio: **ninguna** pasa de −30 % de daño recibido, +15 % de daño hecho ni +30 % de velocidad; las pruebas lo vigilan (`tests/fauna.test.js → equilibrio`).

| Forma | Qué hace |
|---|---|
| ❄ **Piel de Hielo** | Recibís −20 % de daño. Tus golpes ralentizan y a veces CONGELAN; dejás escarcha resbaladiza (vos corrés más rápido encima, ellos se arrastran). Ojo: el fuego te hace +25 % de daño. |
| 🔥 **Cuerpo de Brasa** | Dejás una estela de fuego que quema a las criaturas y tus golpes prenden fuego (+8 % de daño). A cambio, sos un poco más frágil. |
| ⚡ **Nervios Eléctricos** | +18 % de velocidad y tus golpes saltan en cadena de bicho en bicho. En Shooter, las balas son rayos. |
| 🌊 **Pulso de Marea** | Te curás con el tiempo (+3,5 vida/s y escudo) y tus golpes EMPUJAN como una ola. El remate te cura. |
| 💎 **Coraza de Cristal** | Recibís −12 % de daño, empezás con +40 de escudo y devolvés el 35 % del daño que te hacen a los que te rodean. |
| 🌀 **Fase del Vacío** | Saltás 35 % más alto, tu primera herida cada 7 s te vuelve intocable 0,8 s (fase) y drenás un 5 % del daño que hacés. |
| ☣ **Sangre Venenosa** | Tus golpes envenenan y a veces sueltan una nube tóxica que ralentiza y daña. Recibís −5 % de daño. |
| ✨ **Piel de Luz** | +10 % de daño, +5 % de velocidad, tus disparos ATRAVIESAN y a veces deslumbran (ralentizan) a los vecinos de tu blanco. |
| 🦴 **Armadura de Huesos** | Recibís −28 % de daño y las criaturas pegadas a vos se clavan en tus espinas (devolvés el 60 %). Pesás: −5 % de velocidad. |
| 🕸 **Hilo de Eco** | Tus golpes se repiten como un eco (35 % de las veces, a la mitad de daño) y enredan en seda a las criaturas. Recibís −5 % de daño. |
| 🩸 **Sed de Rubí** | Robás vida: el 12 % de tu daño te cura y pegás +5 % más fuerte. Sos más frágil (+10 % de daño recibido). |
| 🌫 **Aliento de Humo** | +14 % de velocidad y las criaturas a más de 9 m te pierden de vista. Atacar rompe el humo un instante. |
| 🌙 **Peso de Luna** | Saltás 30 % más alto, tu escudo se rellena a toda prisa (+9/s) y recibís −5 % de daño. Flotás más. |
| 🔊 **Voz Sónica** | +8 % de velocidad; tus golpes empujan fuerte y a veces aturden con un chillido. |
| 🌱 **Savia de Raíz** | Te curás (+2,2 vida/s), recibís −10 % de daño y tus golpes ENRAÍZAN (a veces dejan clavadas a las criaturas). Dejás raíces que frenan. |
| ⏳ **Hora Torcida** | Las criaturas a menos de 7 m van a la mitad de ritmo y tus habilidades se recargan 25 % más rápido. Recibís −5 % de daño. |
| 🌑 **Manto de Ceniza** | Una nube de ceniza te sigue: las criaturas a menos de 6 m se ralentizan y se asfixian un poco. Recibís −10 % de daño. |
| 🔔 **Conductor de Cobre** | Recibís −15 % de daño, repartís un arco de chispas a 1 vecino y devolvés un 25 % del daño a los pegados a vos. Tu escudo vuelve más rápido. |
| 🌈 **Prisma Vivo** | Un poquito de todo: +12 % de daño, +10 % de velocidad, vida que vuelve, chispas, fuego suave y disparos que atraviesan. Rara y brillante. |
| 🌅 **Aliento de Aurora** | Curación fuerte (+6 vida/s y +14 escudo/s) y −10 % de daño recibido. Un descanso ambulante. |

*Detalles de balance:* los efectos «de lujo» (cadena, nube, eco, deslumbre) tienen una espera de 0,12 s entre sí (`FAUNA.procCd`) para que una ametralladora no los dispare en cada bala; los jefes **resisten el congelar** (sólo les afectan menos los demás estados); el remate elemental tiene 0,9 s de espera. Al **caer**, la metamorfosis se pierde.

## Híbridos (12)
Comé una especie de la forma A y, **mientras dure**, otra de la forma B (en cualquier orden): se funden en un híbrido que **mezcla** los efectos de las dos (`mezclar()`: multiplicativos se componen y se recortan, curaciones suman ×0,85, el remate toma el mayor) y suma un toque propio. Duran lo de la nueva + 10 s (tope 150). Un híbrido **no** se funde con una tercera: la sustituye (y queda como residuo).

| Híbrido | Se forma con | Qué hace |
|---|---|---|
| 🌨 **Ventisca Voltaica** | ❄ Piel de Hielo + ⚡ Nervios Eléctricos | Hielo + eléctrica: tus cadenas de rayo CONGELAN. |
| ♨ **Géiser de Vapor** | 🔥 Cuerpo de Brasa + 🌊 Pulso de Marea | Brasa + marea: curás y quemás a la vez; el remate suelta vapor. |
| ☁ **Niebla Tibia** | ❄ Piel de Hielo + 🔥 Cuerpo de Brasa | Hielo + brasa: un campo de vapor frena y quema a los cercanos. Sin la debilidad al fuego. |
| 🔆 **Prisma Cegador** | 💎 Coraza de Cristal + ✨ Piel de Luz | Cristal + luz: disparos que atraviesan y deslumbran, con coraza que refleja. |
| 🌩 **Relámpago Negro** | 🌀 Fase del Vacío + ⚡ Nervios Eléctricos | Vacío + eléctrica: rayos que drenan vida. |
| ☠ **Peste Ósea** | 🦴 Armadura de Huesos + ☣ Sangre Venenosa | Hueso + veneno: espinas envenenadas; lo que te toca se pudre. |
| 🧊 **Glaciar Espejo** | ❄ Piel de Hielo + 💎 Coraza de Cristal | Hielo + cristal: la coraza más dura (−30 %) que refleja y congela. |
| ☄ **Plasma** | 🔥 Cuerpo de Brasa + ⚡ Nervios Eléctricos | Brasa + eléctrica: cadenas de fuego rápidas. |
| 🌘 **Eclipse Carmesí** | 🩸 Sed de Rubí + 🌀 Fase del Vacío | Sangre + vacío: robás vida del doble y fasás al caer herido. |
| 🪞 **Espejismo** | 🌫 Aliento de Humo + ✨ Piel de Luz | Humo + luz: casi invisible, y cuando te ven los deslumbrás. |
| 🌿 **Selva Tóxica** | 🌱 Savia de Raíz + ☣ Sangre Venenosa | Flora + veneno: raíces que envenenan y una nube que te cura. |
| ⌛ **Eco del Tiempo** | ⏳ Hora Torcida + 🕸 Hilo de Eco | Tiempo + eco: tus golpes se repiten más y todo a tu alrededor va lento. |


## Códice de Fauna (metamorfosis permanente suave)
Vive en el **perfil** (`perfil.fauna = { c: comidas por especie, adn: ADN por forma, hib: híbridos descubiertos, tot }`, migración y saneo en `limpiarFauna`; los perfiles viejos se abren con el Códice vacío). Hitos **por especie**:

| Comidas | Premio |
|---|---|
| 1 | Descubierta: entra al Códice y da **1 ADN** de su forma |
| 5 | +5 s de duración de su forma |
| 10 | +20 % de duración de su forma |
| 25 | **Efecto extra** permanente en su forma (hielo: +10 % de congelar · brasa: +5 de quemadura · eléctrica: +1 rayo · vacío: fase cada 5 s…) |
| 50 | +10 s más y el residuo de esa forma dura el doble |

El contador viaja a la partida en `addPlayer(…, { fauna: { especie: n } })` (también en el cooperativo: `create/join` → `faunaDeRed`, que recorta a especies conocidas) y sólo afecta duración y efecto extra: **no cambia el vínculo palabra↔figura ni nada de ARCANUM**.

**ADN:** cada comida suma 1 ADN de su forma (se ve en el Códice). *Pendiente / honesto:* **todavía no se gasta** en la Forja (los 7 materiales orgánicos están cableados en recetas, botín y tienda; sumar un octavo no era «simple»). La idea para después: 5 ADN de una forma = «cápsula» que te da esa forma al empezar la partida.

**Misión opcional «Alimentación»** (`metas.js`): en las oleadas **4 y 7** (en lugar de «Golpe a golpe») hay que **comer una especie RARA**. La rara nace ya cerca de alguien y no se va hasta que termine la oleada (siempre se puede cumplir). Paga 16 + 4×oleada núcleos y 3 de carne. El resto del ciclo de misiones no cambia.

## Cómo se ve (arte)
- **Bichos** (`src/client/fauna-fx.js`): **una sola** geometría de ~121 triángulos (cuerpo, cabeza, 2 alas, 6 patas, cola, antenas) en **un InstancedMesh**; cada especie es otra mezcla de proporciones (`cuerpo: [alas, patas, cola, largo]`), 2 colores, y un ciclo de animación **en el shader** (aletea / repta / salta / nada / corretea; duerme respirando, se alerta con destello, huye más rápido). Autoiluminados con borde de luz y rayas flasheras. Halo aditivo por bicho (se lee de lejos). **LOD:** > 55 m sólo halo; > 95 m nada.
- **Rastros** (escarcha, fuego, nube tóxica, raíces): 1 InstancedMesh de discos con shader (estrella de hielo, chispeo, burbujas).
- **Chispas** al comer / rematar / fasear: 1 `Points` (120 partículas, anillo): los bichos vuelan a tu boca con el color de su especie y su forma.
- **Metamorfosis visual del Huésped** (sin geometría nueva): `huesped-armor.js` reemplaza **materiales** con 4 uniformes por cuerpo (`uFC` color · `uFK` intensidad · `uFV` estilo · `uFT` tiempo) sobre la piel y la armadura con textura: 0 **escarcha/cristal translúcido** con fresnel (hielo, luna) · 1 **grietas incandescentes** (brasa, tiempo, ceniza) · 2 **arcos** (eléctrica, cobre, sonido) · 3 **agua** (marea, aurora) · 4 **facetas** iridiscentes (cristal, prisma) · 5 **fantasmal** (vacío, humo) · 6 **burbujas** (veneno, savia, sangre) · 7 **resplandor** (luz) · 8 **placas de hueso** · 9 **telaraña** (eco). Además `huesped-presencia.js` tiñe el charco, el halo y suma motas del color de la forma, y al comer hay una **transformación de ≈ 0,8 s** (la de evolución, acelerada ×1,5). Entra y sale en 0,8 s. Con «Reducir efectos» (ajuste `reducirGravedad`) la intensidad baja al 70 % y los bichos no titilan tanto.
- **Suelo:** escarcha, fuego, nube y raíces quedan marcadas donde pasás.

## Para quien toque el código
| Pieza | Dónde |
|---|---|
| Datos (especies, formas, híbridos, hitos, saneo del Códice) | `src/sim/fauna-data.js` |
| Simulación (nacer, comportamiento, comer, formas, rastros, ganchos, snapshot) | `src/sim/fauna.js` |
| Ganchos (Edit puntual) | `game.js` (init, `tickFauna`, `shapeFauna` en `firePlayer`, `addPlayer` → `initFaunaPlayer`, `setInput` → `autoc`, snapshot `fa` y `mf/mt/md/mr` por jugador) · `huespedes.js` (`faunaSpd/Jump` en `updateHost`, `faunaOut` en `hostOut`, `faunaHit` en `hostHit`, `faunaDamageIn` en `hostDamageIn`, `faunaMelee` en `strike`) · `combos.js` (`faunaMelee` en `resolve`) · `metas.js` (misión Alimentación) |
| Dibujo y HUD | `src/client/fauna-fx.js` (render.js: `this.ffx`) · `huesped-armor.js` / `huesped-cuerpo.js` / `huesped-presencia.js` (forma del Huésped) · `audio.js` → `fauna()` |
| Códice (perfil y pantalla) | `perfil.js` (`fauna`, `registrarFauna`, `faunaDeLaSala`) · `fauna-ui.js` (pestaña del Bestiario) · `main.js` (`faunaEvento`: carteles, sonido y registro) |

**Snapshot:** `fa = { l: [[id, especie, x,y,z, ux,uy,uz, fx,fy,fz, estado]…], z: [[tipo, x,y,z, r, restante, ux,uy,uz]…] }` (o `null`), jugador `mf` (forma = índice+1 en `FORMA_IDS`) · `mt` s que quedan · `md` duración total · `mr` residuo. Eventos `{t:'fauna', ph}`: `come` (sp, f, h híbrido, rf refresco, n) · `hibrido` · `remate` (k, r) · `devora` · `fase` · `hiela` · `destello` · `muerde` · `rara` · `fin`. Una fila pesa ≈ 100 bytes (12 bichos < 1,5 KB, probado).

**HUD (aviso para el agente de HUD):** se agregan SÓLO tres elementos auto-creados por `fauna-fx.js`: `#ffchip` (chip de la forma activa con barra de tiempo, hijo de `#hud`; escritorio: `left 24px; bottom 112px`, justo sobre `#bars`; táctil: `body.touch-ui #ffchip` en `top 124px`), `#ffprompt` (cartel «E · Comer…», fijo, centro-abajo) y `#ffradar` (≤ 4 puntitos de color en el borde). El botón **USAR** táctil reutiliza el que ya existe (`touch.setContext({use})`, ahora también true si hay un bicho a menos de ~3 m: `session.faunaCerca` en `main.js`).

## Pruebas
```
node --test tests/fauna.test.js          # datos, determinismo, límites, spawn por arena, comportamiento, consumo, CADA forma, híbridos, residuo, Códice, misión, eventos/nieblas, Melé/Shooter, snapshot
node --test tests/fauna-perfil.test.js   # Códice en el perfil: migración, saneo, hitos, viaja a la simulación
node --test tests/fauna-bots.test.js     # los bots completan las 6 arenas con fauna (de a una: --test-name-pattern="m4")
node --test tests/fauna-render.test.js   # ≤ 12 llamadas y ≤ 3 000 triángulos de fauna en Baja (Chromium)
node --test --test-name-pattern="forma de fauna" tests/huesped-cuerpo.test.js   # el Huésped con forma sigue en ≤ 45 llamadas / ≤ 20 000 triángulos
```
Para verlo: `?auto=m1&bot=1&god=1&seed=3&q=low` y, en la consola del navegador, `const F = await import('/src/sim/fauna.js'); const g = __api.session.game; F.faunaSpawn(g, 'lagartija_hielo', null)` (la deja cerca de algún jugador), o `huesped-arte.html?char=axioma&evo=4&forma=hielo&q=low` para ver sólo la forma sobre el Huésped (también `brasa`, `electrica`, `ventisca`…).

## Lo NO probado (sinceridad)
iPhone real · cooperativo con 2+ jugadores reales (la sim lo soporta y el servidor sanea `fauna`, pero no se jugó) · GPU real (todo se midió con SwiftShader) · legibilidad automática (`tools/legibilidad.mjs`) con los bichos en pantalla · el balance «a mano» de cada forma en partidas largas (hay pruebas de números y de bots, no de sensación).
