# Inventario de Huéspedes (Fase 0, punto 3)

Rama de trabajo `claude/vortex-fase0-sprint1` (base `62244b6`). Solo lectura y medición: no se tocó código del juego.
Escala: **Implementado / Parcial / Ausente / Roto / No verificable**. Donde no se pudo comprobar algo se escribe «No verificado» y el motivo.
Criterio AC-04 (QA mínima de la demo): carga, ataques, habilidad y animaciones válidos.

## 0. Cuántos Huéspedes hay (verificado)

`node` sobre `src/sim/data.js`: `HOST_IDS = axioma, vesper, micelio, umbra, seraf, danzante, singular, colmena` (8).
`CHARACTER_IDS` suma 13: los 8 anteriores + `egida, lumen, forja, vigia, nova`, que quedan con `legacy:true` y SIN `host:true`
(`src/sim/data.js`, línea «for (const k of Object.keys(CHARACTERS)) if (!CHARACTERS[k].host) CHARACTERS[k].legacy = true»).
Los 5 legados no tienen arte de Huésped, ni retrato en `public/portraits/`, ni se cuentan aquí. **No hay más Huéspedes reales que los 8.**
Colmena se registra aparte: `src/sim/colmena-data.js` → `HOSTS.colmena` (`src/sim/data.js` línea ~389).

## 1. Tabla resumen (Huésped × dimensión)

I = Implementado · P = Parcial · A = Ausente · R = Roto · NV = No verificable/No verificado.

| Dimensión | axioma | vesper | micelio | umbra | seraf | danzante | singular | colmena |
|---|---|---|---|---|---|---|---|---|
| Arte (`src/client/huesped/<id>.js`) | I (213 l.) | I (238) | I (221) | I (265) | I (312) | I (287) | I (193 + `singular-evo.js` 132) | I (266) |
| Cuerpo unificado (`huesped-cuerpo.js` DESIGN/LOOK/FRAME) | I | I | I | I | I | I | I | I |
| Presupuesto Low (medido) | I (32 ll. / 19 416 tri) | I (35 / 18 952) | I (33 / 19 294) | I (33 / 17 136) | I (34 / 19 556) | I (33 / 17 384) | I (21 / 15 766) | I (26 / 16 092) |
| Animación de golpes Combo (`ANIM_GOLPE`) | I 8/8 | I 8/8 | I 8/8 | I 8/8 | I 8/8 | **A 0/8** (cae al respaldo `deducir`) | I 8/8 | I 8/8 (+2 extra) |
| Animación habilidad Combo (`ANIM_HAB`) | I | I | I | I | I | **A** (usa la de axioma) | I | I |
| Animación melé Shooter (`ANIM_MELEE`) | I | I | I | I | I | P (`MELEE_BASE` genérico) | P (genérico) | P (genérico) |
| Habilidades Shooter (mov/esp/s3/ult + pasiva) | I | I | I | I | I | I | I | I |
| Habilidad Combo (`HABILIDADES`) + 8 golpes | I (baluarte) | I (caza) | I (estallido) | I (eclipse) | I (bendicion) | I (contrapaso) | I (gravedad) | I (llamado) |
| Arma melee propia (`NATIVE_MELEE`) | I cuchillas | I garras | I punos | I hoja_dim | I latigo | I listones | I orbita | I aguijon |
| Viewmodel 1.ª persona (`hostfx-melee.js` STYLE) | I | I | I | I | I | I | I | I |
| Efectos de habilidad (hostfx / singular-fx) | I | I | I | I | I | I | I (`singular-fx.js`) | I |
| Sonido de habilidad en `audio.js` | I (4 `case`) | I | I | I | I | I | **A** (4 ids caen en `default: ability`) | I (zumbido, cria, nido, marabunta) |
| Sonido de melé/golpe propio | P (es el `default`) | I | I | I | I | I | **A** (`default`) | **A** (`default`) |
| Cosmético de acabado (`src/shared/cosmetics.js`) | I (3 comprables + áurico planificado) | idem | idem | idem | idem | idem | idem | idem |
| Arma firma (`SIGNATURES` en `items.js`) | I gemelas_axioma | I colmillos_luna | I baculo_raiz | I guadana_umbra | I arco_aureola | A | A | A |
| Evoluciones (4 niveles × 2 caminos) | I (`EVO_PATHS` común) | I (común) | I (común) | I (común) | I (común) | I (común + `EVO_FLAVOR`) | I (común + `EVO_FLAVOR`) | I (caminos propios `evoPaths`) |
| Maestría (`BONOS`, rangos 1–10) | I | I | I | I | I | I | I | I |
| Desbloqueo | Inicial | Inicial | Inicial | Tienda 500 | Tienda 500 | Tienda 600 | Tienda 750 + rango 3 | Tienda 600 + rango 3 |
| Retrato `public/portraits/<id>.png` | I (192×192) | I | I | I | I | I | I | I |
| Tests propios de simulación | NV (sin test dedicado; cubierto por `huespedes.test.js`) | idem | idem | idem | idem | I `danzante.test.js` | I `singular.test.js` | I `colmena.test.js` |
| **¿Pasa QA mínima AC-04 para la demo?** | **Sí** | **Sí** | **Sí** | **Sí** | **Sí** | **Con reservas** | **Con reservas** | **Con reservas** |

Resumen de «pasa QA»: ver sección 3 (justificación por Huésped). Ninguno está certificado por una persona jugando (ver 4.1).

## 2. Evidencia por dimensión

### 2.1 Arte y cuerpo unificado
- Archivos de arte: `src/client/huesped/{axioma,vesper,micelio,umbra,seraf,danzante,singular,colmena}.js` + `src/client/huesped/singular-evo.js` (satélite de Singular).
- Satélites del cuerpo: `src/client/huesped-cuerpo.js` (182 l.; `DESIGN`, `LOOK`, `FRAME`; Colmena se añade con `DESIGN.colmena = COLMENA; FRAME.colmena = …; LOOK.colmena = …`), `huesped-armor.js`, `huesped-piezas.js`, `huesped-evo-piezas.js`, `huesped-evo-grande.js`, `huesped-presencia.js`, `huesped-mat.js`, `huesped-sheet.js`, `huesped-arte-demo.js`, `huespedes-ui.js` (FRAME/rol para selección: singular, colmena, danzante añadidos al final).
- Respaldos heredados (no son el cuerpo vigente): `huespedes-view.js`, `huespedes-evo.js`, `huespedes-limbo.js`, `huespedes-mut.js`, `host-human.js`, `host-body.js`.
- Visores de prueba: `public/huesped-arte.html`, `public/huesped-sheet.html`, `public/hostfx-demo.html`.
- Esqueleto y clips: `src/client/humans.js` (`ALIAS`/`CLIP_NAMES`: idle, walk, jog, sprint, crouch, crouchWalk, aim, aimIdle, shoot, reload, cast, spellIdle, punch, hit, jump, fall, land, death, talk, interact, dance, revive) horneados en `assets/arcanum/clips.bin` + `clips.json` (Quaternius CC0, créditos en `assets/arcanum/CREDITS.md`). Todos los Huéspedes comparten este esqueleto/clips; no hay clips por Huésped.
- Capturas de referencia: `shots/huespedes-unificado/` contiene capturas de axioma y micelio (y otros de los 5 originales) pero **ninguna de danzante, singular ni colmena** (`ls | grep -ci` = 0). No verificado visualmente por mí: la calidad del arte no se juzgó (no se abrieron imágenes ni se corrió un navegador salvo el test de presupuesto).

### 2.2 Presupuesto Low (medido)
Comando: `timeout 600 node --test tests/huesped-cuerpo.test.js` → **exit 0, 2 tests, pass 2, fail 0, duración 409,7 s**.
- Test 1 (todos los niveles/caminos, 8 Huéspedes, Low, límite ≤45 llamadas y ≤20 000 triángulos, sin errores de consola): OK. Peor caso medido por Huésped (llamadas / triángulos):

| Huésped | peor caso | % del límite de triángulos |
|---|---|---|
| axioma | 32 / 19 416 | 97 % |
| vesper | 35 / 18 952 | 95 % |
| micelio | 33 / 19 294 | 96 % |
| umbra | 33 / 17 136 | 86 % |
| seraf | 34 / 19 556 | **98 %** |
| danzante | 33 / 17 384 | 87 % |
| singular | 21 / 15 766 | 79 % |
| colmena | 26 / 16 092 | 80 % |

- Test 2 (11 formas de fauna activas, Low): OK, `bad:[]` en todas.
- Observación: axioma, micelio, seraf y vesper están a ≤5 % del tope de triángulos; cualquier pieza nueva los rompería. Mide una escena con un solo Huésped (`renderer.info`), no con arena + criaturas.
- Mide solo calidad Low en Chromium/software en esta máquina; no hay FPS reales ni medición en móvil (No verificado).

### 2.3 Animaciones (¿cubren todos los golpes?)
Comprobado importando `src/client/combo-anim.js` y `src/sim/data.js` en Node:
- `ANIM_GOLPE` tiene entradas para axioma, vesper, micelio, umbra, seraf, singular, colmena; los 8 golpes de cada `COMBO_SETS[id]` están cubiertos (`sinEntrada: -`). Colmena tiene 10 entradas (incluye `enjambre_cerrado`, `colmena_total`, de `progresion.js`).
- **Danzante: `ANIM_GOLPE.danzante` no existe** → `golpesSinAnim('danzante')` devuelve los 8 golpes (paso, giro, floreo, parada, quiebre, contracompas, vals_huesos, gran_final). `animDe()` los resuelve con `deducir()` (respaldo por tipo de golpe), así que **no se rompe**, pero no tiene pose propia (`propio:false`). `ANIM_HAB.danzante` tampoco existe: `animHab()` usa `ANIM_HAB.axioma` (cast «guardia», go «sello») para su habilidad Contrapaso.
- `tests/combo-anim.test.js:13` solo exige cobertura de los 5 Huéspedes originales («si falta uno, este test falla»); por eso Danzante pasa los tests sin animación propia. (Línea 87 del test recorre `danzante` y `colmena`, pero solo con el respaldo.)
- `ANIM_MELEE` (melé del modo Shooter: light/heavy/air/exec/lunge/spin) existe solo para axioma, vesper, micelio, umbra, seraf. Danzante, Singular y Colmena usan `MELEE_BASE` genérico (documentado en el propio archivo: «Huéspedes nuevos → MELEE_BASE»).
- Clips del esqueleto: no hay clip específico de ninguna habilidad; todo golpe/habilidad es pose procedural IK sobre los huesos (`StrikePose` en `combo-anim.js`). No hay clips de caminar/morir por Huésped (comparten los de Arcanum).
- No verificado: que las poses se vean bien en pantalla (no se ejecutó `tools/shot-*` ni ningún navegador de juego).

### 2.4 Habilidades (datos y lógica)
Todos con mov/esp/s3/ult + passive en `src/sim/data.js` (verificado por script):

| Huésped | mov | esp | s3 | ult | pasiva | hab. Combo | melé nativo |
|---|---|---|---|---|---|---|---|
| axioma | impulso | espinas | caparazon | sobrecarga | carnivoro | baluarte | cuchillas |
| vesper | paso | camuflaje | marca | frenesi | desprevenido | caza | garras |
| micelio | barrera | esporas | biomasa | floracion | callo | estallido | punos |
| umbra | fase | singularidad | tiempo | colapso | desfase | eclipse | hoja_dim |
| seraf | planeo | pulso | simbionte | metamorfosis | adaptacion | bendicion | latigo |
| danzante | pirueta | parada | cintas | danza | contratiempo | contrapaso | listones |
| singular | honda | pozo | reflujo | supernova | horizonte | gravedad | orbita |
| colmena | zumbido | cria | nido | marabunta | cria_viva | llamado | aguijon |

- Lógica de simulación: `src/sim/huespedes.js` (despacho común; todos los ids aparecen allí), `src/sim/combos.js` (HABILIDADES/COMBO), más módulos propios `src/sim/danzante.js`, `src/sim/singular.js`, `src/sim/enjambre.js`.
- Cada uno tiene 8 golpes en `COMBO_SETS` (`combo 8` en el script). Melé de Shooter: stats `melee.light/heavy` en `data.js` (Colmena en `colmena-data.js`).
- No verificado: que cada habilidad funcione end-to-end; **no ejecuté** `tests/huespedes.test.js`, `combos.test.js`, `danzante.test.js`, `singular.test.js`, `colmena.test.js` (instrucción: solo el test de presupuesto, máquina cargada). La evidencia de equilibrio citada abajo es de `docs/HUESPEDES.md` (medida por sus autores con bots).

### 2.5 Armas melee propias
`NATIVE_MELEE` (`src/sim/data.js:87`, Colmena en línea 254): los 8 tienen arma innata. Modelos 3D en `src/client/melee-models.js` (los 8 ids aparecen) y viewmodel de 1.ª persona en `src/client/hostfx-melee.js` (`STYLE` con las 8 claves; cuchillas/garras/listones/aguijón con referencias propias). Afinidades `MELEE_AFFINITY`. No hay arma «firma» (objeto de `items.js`) para danzante, singular ni colmena (`SIGNATURES` solo tiene 5: seraf→arco_aureola, axioma→gemelas_axioma, vesper→colmillos_luna, micelio→baculo_raiz, umbra→guadana_umbra); `docs/HUESPEDES.md` lo reconoce para Singular.

### 2.6 Sonidos y efectos
- Efectos de habilidad: `src/client/hostfx.js` define `SK.<id>` para 28 habilidades (7 Huéspedes × 4) (todas salvo las 4 de Singular); paletas `HOST_PAL` incluye singular, colmena, danzante (líneas 37-39). Las 4 de Singular (honda, pozo, reflujo, supernova) se dibujan en `src/client/singular-fx.js` (enganchado en `render.js:94,260,570`). Banco de pruebas `src/client/hostfx-demo.js` y `tests/hostfx.test.js` (SKILLS lista 7 Huéspedes; **Singular no está** en esa lista).
- `src/client/audio.js` (`_host`): hay `case` propio para 28 ids (axioma 4, vesper 4, micelio 4, umbra 4, seraf 4, danzante 4, colmena 4); **faltan honda, pozo, reflujo, supernova** → `default: this.ability(at)` (sonido genérico). `docs/HUESPEDES.md` dice que Singular «reusa `gravity` y `boom`»; en `audio.js` no hay entrada propia.
- Sonido de swing/golpe por Huésped (`audio.js` `_melee` líneas ~313-318 y golpe ~324-328): casos para vesper, micelio, umbra, seraf, danzante; axioma es el `default`; **singular y colmena también caen en el `default`** (suena como Axioma). `docs/HUESPEDES.md` admite para Colmena: «el sonido propio de las picaduras y de la Reina (se reusa el `tshot`)».
- Todo el audio es sintetizado (Web Audio); `docs/INFORME_CALIDAD.md` §7: «nadie lo escuchó; mezcla y volúmenes sin calibrar». No verificado en audio real.
- Voces de personajes de Huésped: Ausente (no se buscó VO en este repo; no hay referencias en `audio.js`).

### 2.7 Cosméticos e identidad
- `src/shared/cosmetics.js`: 4 acabados × 8 Huéspedes = **32 SKU** (`vortex.skin.<host>_<acabado>.v1`): `archivo` (0, gratis), `porcelana` (180 núcleos), `obsidiana` (240 núcleos), `aurico` (`price:null`, `channel:'planned'`, no adquirible). Los 8 Huéspedes están en `HOST_IDENTITY` (`src/shared/identity.js`): axioma, vesper, micelio, umbra, seraf, colmena, danzante, singular. Aplicación visual: `src/client/cosmetic-material.js`, `organism-skin.js`, `identity-menu.js`.
- `docs/COSMETIC_COMMERCE.md`: «No hay cobros ni compras con dinero en esta entrega»; no menciona Huéspedes por nombre; categorías retratos/marcos/poses = «próximas», no existen. **No hay skins distintas de «acabados de material»** (mismo cuerpo, distinto metal/hueso); no hay skins de diseño, ni poses, ni marcos.
- `src/sim/items.js`: objetos firma solo de 5 Huéspedes (ver 2.5). `src/sim/items-fx.js` solo menciona a umbra (1 vez).
- No verificado: que `aurico` se vea bien (planificado; no a la venta) ni que los acabados se vean en el cuerpo unificado de los 3 últimos Huéspedes.

### 2.8 Evoluciones
- `EVO_PATHS` (`src/sim/data.js:99`): 4 niveles × 2 caminos comunes, índices 0..4; `evoPathsFor(char)` (línea 257) devuelve `CHARACTERS[char].evoPaths` si existe, si no `EVO_PATHS` → 5 entradas en los 8 (verificado por script).
- Solo **Colmena** tiene caminos propios (`evoPaths: criador/aguijón → nidos/nube → cohabita/kamikaze → reina/plaga`, con sus piezas en `huesped/colmena.js`: larvas, nidos, nube, detonador, reina, plaga encontrados; `aguijones` y `simbionte` no aparecen como texto literal; No verificado si los dibuja con otro nombre).
- `EVO_FLAVOR` (lectura propia + extra) solo para **danzante y singular** (8 claves cada uno); axioma, vesper, micelio, umbra, seraf y colmena no lo tienen (usan el texto general).
- Coste `EVO_COST` 40/90/160/280. Visual por nivel/camino medido en el test de presupuesto (3 casos por Huésped; 5 para Colmena).
- Árbol de combos/progresión por Huésped: `src/sim/progresion.js` (líneas 34, 49-51, 74-76 incluyen danzante, singular, colmena).

### 2.9 Maestría y desbloqueo
- `src/sim/maestria.js`: `BONOS` tiene las 8 claves (axioma…colmena); rangos 1–10; XP 0/100/250/450/700/1000/1400/1900/2500/3200. `tests/maestria.test.js` existe (no ejecutado).
- Desbloqueo (`src/sim/tienda.js`: `esInicial`, `HUESPEDES_TIENDA`, `precioHuesped`): **iniciales** axioma, vesper, micelio (sin `starter:false`); umbra 500, seraf 500, danzante 600, singular 750 + maestría rango 3, colmena 600 + rango 3 (núcleos). Ya señalado en `docs/audit/MATRIZ_GAPS.md` fila 7: hay 3 iniciales y 5 comprables; no hay desbloqueo por campaña/desafío.

### 2.10 Retratos
`public/portraits/{axioma,vesper,micelio,umbra,seraf,danzante,singular,colmena}.png`, todos PNG 192×192 RGB (`file`), 20–43 KB. Se cargan en el HUD (`src/client/main.js:677`). No verificado: contenido/calidad visual (no abrí las imágenes), ni qué pasa con un Huésped sin retrato (los 8 existen).

## 3. ¿Pasa QA mínima (AC-04)? Justificación y qué falta

**Aviso general:** ningún Huésped tiene evidencia de una persona jugándolo (`docs/INFORME_CALIDAD.md` §7: «Ninguna persona jugó esto. El balance es de bot»; `docs/HUESPEDES.md` repite «No probado: la sensación de juego real» para Colmena y Singular). «Sí» significa: carga y cabe en presupuesto (medido hoy), ataques/habilidades/animaciones definidos y cubiertos por tests existentes (sin re-ejecutar hoy).

| Huésped | Veredicto | Justificación | Qué falta |
|---|---|---|---|
| Axioma | **Sí** | Carga (test OK), 8/8 golpes animados, 4 habilidades con FX y sonido, arma, retrato. Es el Huésped de referencia. | Sonido de melé propio (usa el `default`); margen de triángulos del 3 % en Low. |
| Vesper | **Sí** | Todo cubierto, sonidos propios. 35 llamadas en el peor caso (límite 45). | Una revisión visual; `HUESPEDES_ARTE.md:88` la llama «versión base» (aún sin el detalle de Axioma). |
| Micelio | **Sí** | Todo cubierto; sonidos propios. | Revisión visual («versión base» según `HUESPEDES_ARTE.md:88`). |
| Umbra | **Sí** | Todo cubierto; 86 % del presupuesto. Es de Tienda (500), no inicial. | Revisión visual («versión base»). |
| Seraf | **Sí** | Todo cubierto; el más complejo (312 l.) y el más cerca del tope (98 % de triángulos). | Margen de presupuesto; revisión visual («versión base»). |
| Danzante | **Con reservas** | Carga, ataques y habilidades existen y tienen test propio (`tests/danzante.test.js`, no ejecutado hoy). Pero **no tiene animaciones propias** de los 8 golpes ni de la habilidad (respaldo genérico / pose de Axioma); sin capturas en `shots/`. Animación «válida» pero no específica. | `ANIM_GOLPE.danzante` (8 poses) y `ANIM_HAB.danzante`; ampliar `tests/combo-anim.test.js` a los 8 Huéspedes; capturas; melé Shooter propio en `ANIM_MELEE`. |
| Singular | **Con reservas** | Carga holgada (79 %), 8/8 golpes animados, FX propios en `singular-fx.js`, test propio. Pero **sin sonido propio en sus 4 habilidades** (genérico) ni en su melé, sin arma firma, sin entrada en `SKILLS` de `hostfx.test.js`, sin capturas, melé Shooter genérico. Docs: «No probado» sobre mapas de gravedad radial (m2), coop con varios Singular. | Audio propio (honda/pozo/reflujo/supernova y golpe), cobertura de `hostfx.test.js`, prueba en m2, capturas. |
| Colmena | **Con reservas** | Carga y presupuesto OK (26 llamadas), 8/8 golpes animados, 4 sonidos de habilidad, `colmena.test.js`, caminos de evolución propios. Pero swing/golpe con el sonido `default`, picaduras y Reina con el `tshot` de torreta, sin arma firma, melé Shooter genérico; coop con varios invocadores y la tienda «no probados» según docs. | Audio de picaduras/Reina/melé, coop, capturas de `shots/` (no hay), prueba de tienda. |

## 4. Bugs y limitaciones conocidas

### 4.1 Documentación (con ruta y línea)
- `docs/HUESPEDES_ARTE.md:88`: «Vesper, Micelio, Umbra y Seraf son versiones base… falta el nivel de detalle de Axioma». `:89`: la revisión de un crítico independiente con imágenes quedó pendiente (`shots/huespedes-unificado/`).
- `docs/HUESPEDES.md` (Colmena, «No probado»): sensación real, coop con varios invocadores, sonido de picaduras/Reina, tienda. (Singular): sensación real, coop, sonido propio, tienda, pozos en m2, sin arma firma. (Danzante, sección «Pruebas»): ver archivo.
- `docs/INFORME_CALIDAD.md` §7 (líneas 79-88): sin jugadores humanos, sin GPU real, audio sin escuchar, modelos «low-poly y toscos». La frase «no hay animación esquelética» **está desactualizada**: hoy hay esqueleto Arcanum con clips (`assets/arcanum/clips.json`).
- `docs/audit/MATRIZ_GAPS.md` (ya existente, no modificado): fila 7 (3 iniciales/5 comprables) y filas GDD-1-05 y GDD-2.1-01 (Parcial).
- Desfase documental menor: encabezados de `src/client/hostfx-demo.js` y `src/client/huesped-arte-demo.js` listan solo 5 Huéspedes (`char=axioma|…|seraf`); el título del test de presupuesto dice «los cinco» pero mide los 8 (`tests/huesped-cuerpo.test.js`).

### 4.2 Código
- `grep -rn "TODO|FIXME|XXX|HACK"` sobre `src/client/huesped*`, `src/client/huesped/`, `src/client/hostfx*`, `src/client/combo-anim.js`, `src/client/singular-fx.js`, `src/sim/{singular,danzante,enjambre,colmena-data,huespedes,combos,maestria}.js`: **0 coincidencias reales** (la única salida fue una frase descriptiva de `colmena-data.js:47`, no un TODO). No se buscó en el resto de `src/`.
- Deuda detectada por contraste de datos (no por comentarios): Danzante sin `ANIM_GOLPE`/`ANIM_HAB`; Singular sin casos de audio; Singular/Colmena/Danzante sin `ANIM_MELEE`.

## 5. Archivos y rutas usados como evidencia (verificados con `ls`/`grep`/`node`)
- Datos: `src/sim/data.js`, `src/sim/colmena-data.js`, `src/sim/combos.js`, `src/sim/huespedes.js`, `src/sim/danzante.js`, `src/sim/singular.js`, `src/sim/enjambre.js`, `src/sim/maestria.js`, `src/sim/progresion.js`, `src/sim/tienda.js`, `src/sim/items.js`, `src/sim/items-fx.js`
- Arte: `src/client/huesped/*.js` (9 archivos), `src/client/huesped-cuerpo.js`, `huesped-armor.js`, `huesped-piezas.js`, `huesped-evo-piezas.js`, `huesped-evo-grande.js`, `huesped-presencia.js`, `huesped-mat.js`, `huesped-sheet.js`, `huesped-arte-demo.js`, `huespedes-ui.js`, `melee-models.js`, `humans.js`
- Animación/FX/audio: `src/client/combo-anim.js`, `combo-fx.js`, `hostfx.js`, `hostfx-melee.js`, `hostfx-demo.js`, `singular-fx.js`, `audio.js`, `hud-huesped.js`, `main.js` (retrato, línea 677), `render.js`
- Cosméticos: `src/shared/cosmetics.js`, `src/shared/identity.js`, `src/client/cosmetic-material.js`, `organism-skin.js`, `identity-menu.js`, `docs/COSMETIC_COMMERCE.md`, `docs/IDENTITY_PRODUCTION.md`
- Activos: `assets/arcanum/clips.bin`, `clips.json`, `CREDITS.md`; `public/portraits/*.png` (8); `public/huesped-arte.html`, `huesped-sheet.html`, `hostfx-demo.html`; `shots/huespedes-unificado/`
- Pruebas: `tests/huesped-cuerpo.test.js` (ejecutado), `tests/combo-anim.test.js`, `tests/hostfx.test.js`, `tests/danzante.test.js`, `tests/singular.test.js`, `tests/colmena.test.js`, `tests/huespedes.test.js`, `tests/maestria.test.js` (leídos, no ejecutados)
- Docs: `docs/HUESPEDES.md`, `docs/HUESPEDES_ARTE.md`, `docs/INFORME_CALIDAD.md`, `docs/VORTEX_AUDIT.md`, `docs/VORTEX_QA_REPORT.md`, `docs/audit/MATRIZ_GAPS.md`

## 6. Comandos ejecutados (todos de lectura salvo el test)
1. `node /tmp/…/inv.mjs` (importa `src/sim/data.js`) → `HOST_IDS axioma,vesper,micelio,umbra,seraf,danzante,singular,colmena`; `CHARACTER_IDS` 13; `legacy egida,lumen,forja,vigia,nova`.
2. `node /tmp/…/anim.mjs` (importa `combo-anim.js`) → ANIM_GOLPE 8/8 salvo danzante 0/8; `ANIM_HAB danzante = null`.
3. `node -e` sobre `evoPathsFor`/`EVO_FLAVOR` → 5 entradas en los 8; `EVO_FLAVOR` solo danzante y singular (8 claves).
4. `node -e` sobre `src/shared/cosmetics.js` y `identity.js` → 32 cosméticos, 4 por Huésped.
5. `node -e` sobre `src/sim/maestria.js` → `BONOS` con los 8.
6. `file public/portraits/*.png` → 8 PNG 192×192.
7. `timeout 600 node --test tests/huesped-cuerpo.test.js` → **exit 0; tests 2, pass 2, fail 0; 409 724 ms**. Cifras de la sección 2.2.
8. Varios `grep`/`ls`/`sed` de lectura. No se corrió ningún otro test ni navegador. No se editó código ni se hizo commit; único archivo escrito en el repo: este.

## 7. Resumen (10 líneas)
1. Hay exactamente 8 Huéspedes reales (`HOST_IDS`); egida/lumen/forja/vigia/nova son `legacy` y no cuentan.
2. Los 8 tienen arte propio, cuerpo unificado, retrato, 4 habilidades + pasiva, 8 golpes de Combo, arma innata, maestría y 32 SKU de acabados.
3. Presupuesto Low medido hoy: 2/2 tests OK; peor caso 35 llamadas (límite 45) y 19 556 triángulos (límite 20 000, Seraf al 98 %).
4. Brecha principal de animación: Danzante no tiene `ANIM_GOLPE` ni `ANIM_HAB` (usa respaldo genérico y la pose de Axioma); los tests solo exigen los 5 originales.
5. Melé de Shooter: solo los 5 originales tienen `ANIM_MELEE`; Danzante, Singular y Colmena usan el genérico.
6. Audio: Singular no tiene sonido propio en sus 4 habilidades; Singular y Colmena usan el sonido de melé por defecto (el de Axioma).
7. Evoluciones: caminos comunes para 7 y propios para Colmena; `EVO_FLAVOR` solo para Danzante y Singular.
8. Cosméticos son solo «acabados» de material (3 comprables + áurico planificado); sin skins de diseño, poses ni marcos; armas firma solo para 5.
9. Desbloqueo: 3 iniciales (axioma, vesper, micelio) y 5 de tienda (500–750 núcleos; Singular y Colmena además exigen rango 3).
10. QA mínima AC-04: Axioma, Vesper, Micelio, Umbra y Seraf pasan; Danzante, Singular y Colmena pasan con reservas; ninguno fue jugado por una persona, y no se juzgó la calidad visual ni de audio (No verificado).
