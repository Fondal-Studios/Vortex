# VORTEX — Editor 3D de Huéspedes («Laboratorio»): diseño técnico verificado

> **Estado del documento**
> - Versión 0.1 · 2026-10-25 · Rama de trabajo `claude/vortex-editor-mvp` (creada desde `claude/vortex-fase0-sprint1`).
> - **Nivel: DISEÑADO + NÚCLEO DE DATOS, SIMULACIÓN Y RED IMPLEMENTADO Y PROBADO CON `node:test` (2026-10-25, sin mergear ni desplegar).** El resto (pantalla del editor, visor 3D, piezas gráficas, medidor de render, «Probar», deshacer/rehacer, accesibilidad) **sigue sin implementar**. Ver §9 «Estado de implementación del núcleo» al final: qué hay, qué se probó y qué NO se probó.
> - Prioridad declarada por el propietario: ALTA. Normativo: GDD §1, §2.2, §5, §9, §10 y [FUTURE_BACKLOG.md](FUTURE_BACKLOG.md) F1–F3 y «Monetización ética».
> - Convención: **[V]** = ruta o símbolo comprobado con `ls`/`grep`/lectura en esta rama. **[NV]** = No verificado (hipótesis, estimación o dato que no se pudo comprobar aquí). Las cifras de tiempo y de triángulos de piezas nuevas son **objetivos de diseño o estimaciones gruesas, no mediciones**.
> - Todo texto visible para el jugador va en español.

## 0. Resumen en una página

1. **El editor es factible hoy solo sobre el esqueleto humanoide único** (MakeHuman de 326 huesos con 21 clips CC0 retargeteados). Eso es la **etapa E1**. Cuadrúpedos, serpentinos o alados con locomoción propia **no** son factibles sin rigs y animaciones nuevas (**E3**).
2. **No se reemplaza la colección.** El editor tiene dos usos: (a) **VER** los 8 Huéspedes oficiales con sus anclas, y personalizarlos solo en lo cosmético que cada uno declare compatible; (b) **Laboratorio**, un modo aparte con un chasis propio («Híbrido de Laboratorio») donde el jugador crea un `CustomHostBuild`.
3. **Separación estricta cosmético/funcional.** Posición, rotación, escala y color de una pieza nunca entran en ninguna fórmula de combate. Las estadísticas se derivan **únicamente de la tabla de piezas funcionales** (en E1: los 8 órganos de campeón que la simulación ya implementa, `CHAMP_ORGANS`), con los topes que ya existen (`CAPS`). La hitbox es fija (`PLAYER.radius`), no depende del tamaño visual.
4. **El servidor es la autoridad.** Un módulo puro compartido (`src/shared/host-build.js`, a crear) valida y deriva; cliente y servidor lo importan, como ya hacen con `src/shared/cosmetics.js`. Una build inválida degrada al chasis por defecto, nunca expulsa.
5. **Presupuesto de render Low (≤ 45 llamadas / ≤ 20 000 triángulos) como regla de validez**, no como aviso: el editor reserva un tope propio más estricto para las piezas del jugador (propuesta: ≤ 11 000 triángulos y ≤ 14 llamadas añadidas) y mide en vivo con `ak.stats()`.
6. **MVP E1 en ≤ 2 sprints** solo si el spike técnico EH-00 (escala de huesos con clips e IK) sale bien; hay recorte de alcance previsto (§5).
7. **Sin dinero en E1.** Hoy no existen cobros ni ledger de órdenes (COSMETIC_COMMERCE). Las piezas se ganan jugando; lo monetizable en el futuro es solo estético y nunca funcional.

---

## 1. Qué es factible con el stack actual y qué no

### 1.1 Hechos técnicos verificados que condicionan el diseño

| # | Hecho | Evidencia |
|---|---|---|
| H1 | **Un solo esqueleto humano**: rig MakeHuman de 326 huesos, sin rotación en la pose de enlace (A-pose); el humano mide ≈ 1,7 u, `+Z` adelante, `y = 0` pies. | [V] `assets/arcanum/narrative/model.json` (326 huesos, contados con `node`); `docs/HUESPEDES_ARTE.md` «Cómo funciona» |
| H2 | **21 clips** retargeteados (Quaternius UAL, CC0): idle, walk, jog, sprint, crouch, crouchWalk, aimIdle, aim, shoot, reload, cast, spellIdle, punch, hit, jump, fall, land, death, talk, interact, dance. Solo hay pistas de **cuaternión** y de **posición de la cadera**; **no hay pistas de escala**. | [V] `assets/arcanum/clips.json`; `src/arcanum/rig.js` (`codificarClips`: solo `'q'` y `'p'`) |
| H3 | El retargeting depende de nombres canónicos humanoides (Hips→Spine→Spine1→Spine2→Neck→Head, hombros, brazos, piernas, dedos). Un rig distinto no reutiliza los clips. | [V] `src/arcanum/rig.js` (`ALIAS_MH`), `src/arcanum/retarget.js` (`CHILD`, `DEFAULT_MAP`) |
| H4 | El cuerpo del Huésped es **kit anclado a huesos**: `createHostBody` crea un humano (sin ropa ni pelo), `createArmorKit` recibe piezas como geometrías **en coordenadas del modelo en pose de enlace**, cada una unida **rígidamente a un hueso**, y las **funde por material** en pocas `SkinnedMesh` (≈ 1 llamada por material). | [V] `src/client/huesped-cuerpo.js`, `src/client/huesped-armor.js` (`add`, `finish`, `mount`, `both`, `onSeg`, `chain`, `cloth`, `stats`) |
| H5 | **Las piezas de los 8 oficiales son código imperativo**, no datos (`build(ak, ctx)` por Huésped). Para un editor hace falta un **catálogo paramétrico data-driven** que use las mismas herramientas (`tools(ak)`: `spikeAt`, `armorPlate`, `ringAt`, `limb`, `dome`, `cuff`, `bonelump`, `seam`…). | [V] `src/client/huesped/axioma.js` (`export function build(ak, ctx)`), `src/client/huesped-piezas.js` (`tools`) |
| H6 | El humano tiene **deformación de proporciones** (`height, width, shoulders, belly, head, jaw, nose`) pero los Huéspedes la anulan (`overrides: { body: NEUTRAL }`) porque el kit está modelado en la pose de enlace sin deformar. **No sirve** para el editor. | [V] `src/arcanum/deform.js` (`deformPoint`), `src/arcanum/schema.js` (`BODY_RANGES`), `src/client/huesped-cuerpo.js` (`NEUTRAL`, `createHuman(... overrides: { body: NEUTRAL })`) |
| H7 | Ya hay **proporciones globales no uniformes en el cuerpo**: el nivel evolutivo y el camino cambian `holder.scale` por ejes (`bodyScale`, `PATH_SHAPE`). Es el precedente para altura/ancho global. | [V] `src/client/huesped-cuerpo.js` (`PATH_SHAPE`, `bodyScale`, `holder.scale.set(...)`) |
| H8 | **No hay huesos de cola, alas, tentáculos ni cuernos** en el rig base. El kit los resuelve con **huesos extra** (`ak.bone`, `ak.chain` con muelles) y **mallas rígidas** pegadas a ellos (p. ej. Colmena: abdomen y antenas; Micelio: raíces). | [V] `src/client/huesped/colmena.js:60,123,169`, `micelio.js:171,209`, `danzante.js:58` |
| H9 | Ya existen **puntos de anclaje de facto** usados por el juego: espalda (`spine03`, arma cruzada), pecho (`spine01`, órganos), cabeza (`head`), manos (`wrist_R/L`, arma). Y un **sistema de zonas** (`head`, `torso`, `arms`, `legs`) por el que la armadura equipada **sustituye** la geometría base de la zona. | [V] `src/client/huesped-cuerpo.js:107-122`, `src/client/huesped-armor.js` (`slotOfBone`, `replaceSlots`, `keepAll`), `src/client/items-vis.js` (`armorSlots`, `addEquipmentArmor`) |
| H10 | **Presupuesto Low**: ≤ 45 llamadas y ≤ 20 000 triángulos por Huésped, medido con `renderer.info` en `tests/huesped-cuerpo.test.js`. El cuerpo espectral solo cuesta **3 668 triángulos y 1 llamada**. Peor caso medido: Axioma nivel 4 = 27 llamadas / 19 758 tris (98,8 % del tope); Seraf nivel 4 = 29 / 19 364 (96,8 %). *(FUTURE_BACKLOG dice «Seraf al 98 %»; HUESPEDES_ARTE.md da Axioma 98,8 % y Seraf 96,8 %: hay una discrepancia menor entre documentos.)* | [V] `tests/huesped-cuerpo.test.js`, `docs/HUESPEDES_ARTE.md` «Presupuesto medido» |
| H11 | La **simulación está indexada por id de Huésped** (`CHARACTERS[char]`, 16 comparaciones `p.char ===` en `huespedes.js`, `enjambre.js`, `singular.js`, `danzante.js`). La hitbox es única: `collide(..., PLAYER.radius, ...)` con `radius: 0.9`. Los multiplicadores de combate viven en `p.bn` y están acotados por `CAPS`. | [V] `src/sim/data.js:38,504`, `src/sim/huespedes.js:27`, `src/sim/game.js:452`, `src/sim/items.js:69` (`CAPS`, `capBn`) |
| H12 | **Los órganos del campeón ya son piezas funcionales con efecto numérico y ranuras por evolución** (`CHAMP_ORGANS`: placas, adrenal, ojo_extra, saco_g, medula, tentaculo, corazon_cristal, espiraculo; `champOrganSlots(evo) = 1 + evo`), con validación `organError` y visual `attachChampOrgans`. | [V] `src/sim/data.js:298-308`, `src/sim/organos.js:15,39,71`, `src/client/organs-vis.js` |
| H13 | **El servidor sanea lo que dice el cliente** con `cargaDe`, que hoy **no reenvía `corg`/`worg`/`ess`/`path`** (los órganos no viajan en coop). `ws` tiene `maxPayload: 8192` bytes. El perfil es «progreso declarado por el cliente»: el servidor **acota, no verifica** (`arbolDe`). | [V] `server/server.js:44-55,121` (sin coincidencias de `corg`/`worg` en `server/server.js` ni `src/sim/red.js`), `docs/FUTURE_BACKLOG.md` (cuentas) |
| H14 | **Persistencia**: perfil local `cristal.perfil.v1`, esquema versionado con pasos de migración (`ESQUEMA = 1`, `PASOS`), copia de seguridad con huella, **ledger idempotente** de recompensas (`huella`, `estable`, `limpiarLedger`). Cuentas del servidor guardan `profile JSONB` con `revision` optimista. | [V] `src/client/perfil.js:35`, `src/sim/perfil-esquema.js`, `src/sim/ledger.js`, `server/accounts.js:17,44-46` |
| H15 | **Cosméticos actuales**: 3 acabados por Huésped (+1 «planned» no a la venta) con SKU `vortex.skin.<host>_<acabado>.v1`; `applyCosmeticMaterials` solo toca color/rugosidad/metalicidad de materiales del kit, **no** silueta, emisión, animación ni colores de habilidades. Test existente: comprar no cambia vida/evolución. | [V] `src/shared/cosmetics.js`, `src/client/cosmetic-material.js`, `tests/identity-market.test.js` |
| H16 | **Campo de pruebas y maniquíes ya existen**: `startSolo('m1', { practice: true })` (sin oleadas, munición y vida ilimitadas, blancos pasivos) y el «Polígono de Práctica» de La Base con `MANIQUIES` y `DUMMY_HP = 400`. **No existe medidor de DPS** (sin coincidencias de `dps` salvo daño en el tiempo). `p.st.dmg` acumula el daño del jugador. | [V] `src/client/main.js:402`, `src/sim/game.js:187-197`, `src/sim/base.js:66,112`, `src/sim/tutorial.js:12` |
| H17 | **Visor 3D de Huéspedes reutilizable**: `public/huesped-arte.html` + `src/client/huesped-arte-demo.js` (cámaras `full/q34/close/head/torso/back/side/legs/hands`, luces, HDRI, `window.__advance/__render/__info`). | [V] `src/client/huesped-arte-demo.js` |
| H18 | **La Base tiene estaciones** y el «Armero» (`Los Capullos (Huéspedes)`) ya abre «Elegir Huésped / Evolución / Equipo». Es el punto natural de entrada al Laboratorio. | [V] `src/sim/base.js:102-106` (`ESTACIONES.armero.acciones`) |
| H19 | Existe `createPresence` (aura, charco de luz, marca) por Huésped, independiente del mesh del kit: sirve para que la silueta del jugador **siempre** sea legible aunque la pieza sea pequeña. | [V] `src/client/huesped-presencia.js:65` |

### 1.2 Qué SÍ y qué NO, por etapa

| Capacidad pedida (GDD §2.2) | E1 (humanoide) | E2 (partes/genética) | E3 (rigs alternativos) |
|---|---|---|---|
| Proporciones por hueso: altura, hombros, torso, brazos, piernas, cabeza, manos, pies | **Sí**, por escala de huesos con límites (§3.1). Requiere spike EH-00. | Sí | Por rig |
| Puntos de anclaje nombrados y piezas modulares (cuernos, alas, placas, tentáculos, glándulas, órganos visibles, cola) con escala/rotación/posición acotadas y simetría | **Sí** (catálogo paramétrico, §2.2) | Más piezas, sub-anclas, ranuras genéticas | Anclas por rig |
| Órganos y glándulas visibles, colocables y escalables | **Sí**: visual libre dentro de límites; el **efecto** sale de `CHAMP_ORGANS` (H12) | Glándulas/órganos nuevos con coste en capacidad | — |
| Postura y articulaciones | **Parcial**: postura de reposo mediante *offsets* de cuaternión sobre un conjunto reducido de huesos, **sin** alterar los clips (se suman). Marcado «avanzado». [NV: no probado con los clips] | Poses de pose de reposo guardadas | Por rig |
| Locomoción propia (cuadrúpedo, serpentino, aéreo) | **No**. Solo la locomoción humana (walk/jog/sprint) | **No** | **Sí**, con rigs y clips nuevos |
| Biblioteca genética, absorción, hibridación, estabilidad | No | **Sí** | — |
| Asistencia de IA opcional | **Sugeridor determinista** (§4.4) | Ídem + reglas de hibridación | — |
| Previsualización de estadísticas y zona de pruebas | **Sí** (§4.3) | Sí | Sí |

### 1.3 Por qué no se pueden hacer rigs libres en E1 (razones, no excusas)

1. **Animación**: los 21 clips se calcularon por retarget a la cadena humanoide canónica (H3). Un cuadrúpedo, un serpentino o un alado con alas articuladas necesita **su propio esqueleto y su propio juego mínimo de clips** (idle, walk, run/sprint, jump, fall, land, hit, death, attack ×2, cast). No se puede «estirar» el esqueleto humano a cuatro patas sin que los clips humanos se vean rotos.
2. **Locomoción y física**: `CLIP_SPEED` (`src/arcanum/locomotion.js`) ata velocidad de paso a clips humanos; la simulación usa una cápsula/esfera de radio fijo (H11). Un cuerpo largo (serpiente) no cabe en esa hitbox sin mentir visualmente.
3. **Primera persona y manos**: el modo shooter usa viewmodel de brazos/manos y puntería con IK de dos huesos (`twoBoneIK`, `src/arcanum/pose.js`) sobre brazos humanos.
4. **Presupuesto**: cada rig nuevo necesita su propio «cuerpo espectral» (la piel actual cuesta 3 668 tris) y su propia política de LOD.
5. **Estimación gruesa de E3 [NV]**: por familia de rig (cuadrúpedo, serpentino, aéreo): rig + skinning + ≥ 12 clips + retarget/validación + kit de anclas + pruebas ≈ **6–10 semanas-persona** de arte técnico y animación, más ≈ 2–3 semanas de ingeniería (`createHostBody` multi-rig, anclas por rig, IK alternativo). Depende de si existen clips CC0 cuadrúpedos aprovechables (**no verificado**; el repo solo tiene la biblioteca humana).

---

## 2. Modelo de datos

### 2.1 Dos entidades distintas (GDD §10: `HostDefinition`, `OwnedHost`, `HostLoadout`)

| | `HostDefinition` (oficial) | `CustomHostBuild` (creación del jugador) |
|---|---|---|
| Origen | Código del juego (`CHARACTERS`, `LOOK`, `DESIGN`, `HOST_IDENTITY`) | Perfil del jugador (`perfil.lab`) |
| Quién lo cambia | Solo el estudio, con PR | El jugador, con el editor |
| Autoría hoy | **Imperativa** (`build(ak, ctx)` por Huésped) [V] | **Declarativa** (JSON de este documento) |
| Estructura característica | **Bloqueada** (silueta base, piezas del diseño, habilidades) | Libre dentro de los límites del chasis |
| Personalización jugador | Solo cosmética en anclas que el propio oficial declare «compatibles» (E2) + acabados existentes (`cosmetics.js`) | Todo lo cosmético + piezas funcionales permitidas por capacidad |
| Habilidades | Las suyas (mov/esp/s3/ult/pasiva) | Las del chasis `laboratorio` (E1); variantes tuneadas en E2 |
| Recompensas oficiales (desafíos de Huésped, logros de colección) | Sí | **No** (F3 CFA, GDD §1) |

En E1 `HostDefinition` se materializa como **vista de solo lectura generada** (`describirOficial(id)`) a partir de los datos que ya existen, para que el editor pueda mostrarlos, **no** como formato de autoría:

```jsonc
// vista generada, solo lectura (NO se persiste)
{
  "schema": "vortex.hostdef", "v": 1,
  "kind": "official",
  "id": "axioma",
  "rig": "arcanum-mh326@1",
  "fuente": ["CHARACTERS.axioma", "huesped/axioma.js", "HOST_IDENTITY.axioma"],
  "locked": ["silueta", "diseno", "habilidades", "proporciones"],
  "personalizable": { "acabado": true, "paleta": false, "anclas": [] }, // E1: solo acabados existentes; E2: anclas declaradas
  "stats": { "dano": 5, "resistencia": 7, "movilidad": 5, "control": 4, "utilidad": 4, "dificultad": 4 } // descriptivas (data.js), no de combate
}
```

### 2.2 `CustomHostBuild` v1 — esquema

Formato canónico (JSON). Los nombres de campo van en español técnico, igual que el resto del código.

```jsonc
{
  "schema": "vortex.hostbuild",
  "v": 1,                                  // versión del esquema (migraciones, §2.5)
  "id": "lab-m3k9x2q7",                    // /^lab-[a-z0-9]{6,24}$/, único por cuenta
  "nombre": "Cazador de brasas",           // 1–24 caracteres, saneado como nombreLimpio()
  "rig": "arcanum-mh326@1",                // id de rig + versión del CONTRATO DE ANCLAS
  "chasis": "laboratorio",                 // E1: único valor permitido. E2+: otros chasis/rigs
  "base": { "preset": "jugador3", "piel": "#8a5a3c" },   // preset humano (humans.js) y tono; el rostro queda tras la máscara
  "prop": {                                // proporciones (ver 3.1 para rangos y unidades)
    "altura": 1.00, "ancho": 1.00, "hombros": 1.00, "torso": 1.00,
    "brazos": 1.00, "piernas": 1.00, "cabeza": 1.00, "manos": 1.00, "pies": 1.00
  },
  "pose": { "inclinacion": 0, "hombros": 0 },     // postura de reposo (avanzado), grados acotados
  "partes": [                              // lista ORDENADA; el orden no cambia el efecto
    { "p": "cuerno_curvo", "a": "cabeza", "sim": "espejo",
      "t": { "pos": [0.04, 0.10, 0.02], "rot": [0, 0, 12], "esc": 1.1 },
      "c": { "mat": "hueso", "tinte": "#e6d9bc" } },
    { "p": "adrenal", "a": "cintura", "sim": "ninguna",
      "t": { "pos": [0, 0, 0.05], "rot": [0, 0, 0], "esc": 1.0 },
      "c": { "mat": "carne", "tinte": null } }
  ],
  "pal": { "primario": "#7a3a1c", "secundario": "#2b2430", "emisivo": "#ff7a22", "acabado": "archivo" },
  "meta": { "creado": 1790000000000, "editor": "1.0.0" },
  "cap": { "usado": 2, "max": 3 },         // DERIVADO (el servidor lo recalcula, no se confía)
  "h": "00a1b2c3d4e5f6"                    // huella (14 hex) del contenido canónico SIN `h` ni `cap` ni `meta`
}
```

Reglas del formato:

- Los campos `cap`, `h` y cualquier estadística **son derivados**: el cliente puede escribirlos para comodidad, el servidor los **descarta y recalcula**.
- Cada instancia de pieza **solo referencia el catálogo** (`p`). Si una pieza es cosmética o funcional lo dice el catálogo (`PARTES[p].cat`), **nunca** el JSON. Un cliente hostil no puede declarar «cosmética» una pieza funcional.
- `t.pos/rot/esc` están en el **marco local del anclaje** (§2.3), no en coordenadas del mundo.
- `sim`: `"ninguna" | "espejo"`. «Espejo» genera la pareja izquierda/derecha; **cuenta como 2 instancias para el presupuesto de render** y como **1 para la capacidad funcional** (una pieza funcional espejada sigue siendo un solo efecto: ver V-14).

### 2.3 Contrato de anclas (`ANCLAS`, rig `arcanum-mh326@1`)

Es el contrato que pide el GDD §10 («puntos de anclaje, esqueletos compatibles, límites de rigging»). Cada ancla se nombra en español, apunta a un hueso real y define el **marco local** y los límites cosméticos.

| Ancla | Hueso(s) del rig [V: nombres en `model.json`] | Lados | Notas / evidencia de uso |
|---|---|---|---|
| `cabeza` | `head` | 1 | Cuernos, cresta, corona, ojos extra [V: casco/cuerno en `axioma.js`] |
| `cuello` | `neck01..03` | 1 | Gorguera, collares [V: `axioma.js`] |
| `hombros` | `upperarm01_L/R` (la hombrera cuelga del brazo superior, como el kit) | 2 | Hombreras, cañones, alas pequeñas [V: `huesped-evo-piezas.js`] |
| `pecho` | `spine01` | 1 | Núcleo, glándulas, placas; órganos del campeón ya cuelgan de aquí [V: `huesped-cuerpo.js:122`] |
| `espalda` | `spine03` (y `spine02` para la mitad alta) | 1 | Arma cruzada ya usa `spine03` [V: `huesped-cuerpo.js:117`]; alas y espinas dorsales |
| `cintura` | `spine04` (alternativa `spine05`, la cadera) | 1 | Faldones, glándulas ventrales. `spine05` es la raíz de cadera en `ALIAS_MH` [V] |
| `antebrazos` | `lowerarm01_L/R` | 2 | Cuchillas, placas [V] |
| `manos` | `wrist_L/R` | 2 | Garras, armas fusionadas; **la mano derecha ya está ocupada por el arma melee** (`huesped-cuerpo.js:111`) → conflicto V-12 |
| `muslos` | `upperleg01_L/R` | 2 | Rodilleras, placas [V] |
| `pies` | `foot_L/R` (+ `toe1-1`) | 2 | Pezuñas, espolones [V] |
| `cola` | **huesos extra** encadenados desde `spine05` con `ak.chain` | 1 | No existe hueso nativo; mismo patrón que `abd` de Colmena y `arrastre` de Micelio [V] |
| `tentaculos` | cadenas desde `espalda`, `hombros` o `pecho` (hasta N) | 1–2 | Cadenas con muelles; coste en llamadas (§3.4) |

Contrato de cada entrada de catálogo de piezas (`PARTES`, módulo a crear: `src/shared/host-build-catalogo.js`; la parte gráfica en `src/client/huesped/lab-piezas.js`):

```jsonc
"cuerno_curvo": {
  "cat": "cosmetica",                 // 'cosmetica' | 'funcional'
  "nombre": "Cuerno curvo", "desc": "…",
  "anclas": ["cabeza"],               // anclas permitidas
  "lados": "par|unico",
  "gen": "spikeAt",                   // generador paramétrico (en lab-piezas.js)
  "variantes": ["liso", "estriado", "roto"],
  "limites": { "pos": [[-0.12,0.12],[-0.05,0.18],[-0.10,0.10]],   // en el marco del ancla (m)
               "rot": [[-30,30],[-30,30],[-45,45]],                // grados
               "esc": [0.6, 1.6] },
  "tris":  { "low": 240, "medium": 420, "high": 800 },             // [NV] valores de diseño; se generan y fijan con tools/lab-costes.mjs
  "mats":  ["bone"],                  // materiales del kit que usa → llamadas
  "llamadas_extra": 0,                // halos/sprites/cadenas/telas que NO se funden
  "choca_con": ["casco_oficial"],     // incompatibilidades
  "ocupa": ["cabeza.corona"],         // sub-ranuras exclusivas
  "huella_visual": { "despeja_cara": true },   // regla anti-oclusión (§2.6)
  "obtencion": "inicial",             // 'inicial' | 'logro:<id>' | 'fauna:<especie>' | 'esencia:<recurso>' | …
  "organ": null                       // solo funcionales: id de CHAMP_ORGANS
}
```

Piezas funcionales E1 (ids = `CHAMP_ORGANS`, todas [V] en `src/sim/data.js:298-307`):

| Pieza funcional | Efecto (ya implementado en la sim) | Anclas sugeridas (solo visual) |
|---|---|---|
| `placas` | −12 % daño recibido | `pecho`, `espalda`, `hombros` |
| `adrenal` | +8 % velocidad, habilidades 8 % más rápidas | `cintura`, `espalda` |
| `ojo_extra` | +12 % daño a todo, revela camuflados | `cabeza`, `pecho` |
| `saco_g` | salto +25 %, definitiva −15 % de espera | `espalda`, `cintura` |
| `medula` | regeneración 1,5 /s tras 3 s sin daño | `espalda`, `pecho` |
| `tentaculo` | melee +20 % alcance, +10 % daño | `espalda`, `hombros`, `cintura` |
| `corazon_cristal` | escudo recarga 50 % más rápido | `pecho` |
| `espiraculo` | definitiva dura 20 % más | `cabeza`, `espalda` |

> El **ancla** de una pieza funcional es **solo estética**: cambiar `adrenal` de `cintura` a `espalda` no cambia ningún número. El efecto lo da la **presencia** de la pieza en `partes`, no su lugar ni su tamaño. Esto cumple GDD §2.2 («la posición/tamaño cosméticos no deben otorgar ventajas encubiertas»).

### 2.4 Presupuesto funcional («capacidad genética») y estadísticas derivadas

**E1 — capacidad = ranuras de órgano existentes.** `cap.max = champOrganSlots(evo) = 1 + evo` (1 a 5) [V: `src/sim/data.js:308`]. Cada pieza funcional cuesta 1. Ventajas: cero reglas de balance nuevas, cero código de simulación nuevo para los efectos, y ya está equilibrado con el resto del juego. El `evo` que cuenta es el del propio chasis `laboratorio` en el perfil (se progresa como cualquier Huésped).

**E2 — capacidad en puntos (CG).** Cada pieza funcional tiene `costeCG` (1–4) y una *estabilidad*; `cap.max` crece con maestría y evolución. El esquema ya reserva `cap: {usado, max}` para no migrar el formato. **Sin fallos aleatorios destructivos** (GDD §2.2): la inestabilidad es un número visible que limita combinaciones, nunca una tirada que destruya el diseño.

**Función única de derivación** `derivarStats(build, ctx) → { cap, efectos, bn, resumen }` (en `src/shared/host-build.js`). Entradas permitidas: **catálogo + ids de piezas funcionales distintas + `ctx.evo`**. Entradas **prohibidas**: `prop`, `t`, `esc`, `pos`, `rot`, `a`, `sim`, `pal`, `c`, `base`, `pose`, `nombre`, `meta`. Se verifica con un test de propiedad (§5, EH-01): para N builds aleatorias, cambiar cualquier campo prohibido no altera `derivarStats` (igualdad profunda).

Salidas:

- `bn`: multiplicadores reales que se aplicarían a `p.bn`, **pasados por `capBn`** (los topes `CAPS` ya vigentes: `spd [0.92,1.12]`, `dmgIn [0.78,1.10]`, `melee [0.8,1.1]`, etc.) [V: `src/sim/items.js:69,350`].
- `resumen`: los 6 ejes descriptivos de `HostDefinition.stats` (daño, resistencia, movilidad, control, utilidad, dificultad), **solo informativos** para la UI, calculados con una tabla `pieza → delta` más el chasis. No se usan en combate (hoy tampoco: `statsOf` en `huespedes-ui.js` solo los dibuja) [V].
- `hp`/`speed` base del chasis: fijos (`hp: 1`, `speed: 1`), **sin** modificarlos por proporciones.

**Invariante de paridad de poder (anti-trampa)**: ningún `CustomHostBuild` válido puede derivar un `bn` por encima de lo que ya permite un Huésped oficial con los mismos órganos y `CAPS`. Test: la `derivarStats` de la mejor build posible ≤ `capBn` y ≤ la suma de efectos de los 5 órganos mejores.

### 2.5 Versionado, migraciones y huella

- `schema` + `v` en cada build. Las migraciones siguen el patrón ya probado de `perfil-esquema.js`: lista `PASOS`, cada paso sube 1, nunca lanza, y si el contenido es de una versión **más nueva** se conserva tal cual y se marca `futuro: true` sin sobrescribir [V: `migrarEsquema` en `src/sim/perfil-esquema.js`].
- `rig: "arcanum-mh326@1"`: el `@N` es la versión del **contrato de anclas**. Si cambia un ancla (hueso, marco, límites), se sube N y hay un paso de migración que **reubica** las piezas (nunca las borra en silencio).
- Catálogo versionado: una pieza retirada se sustituye por un `fallback` declarado (`"reemplazo": "cuerno_basico"`); la build avisa en pantalla.
- **Huella**: `huella(estable(canonico))` con `estable` y `huella` de `src/sim/ledger.js` (cyrb53 de 53 bits) [V: exportadas]. Sirve para detectar corrupción, ediciones al importar y como clave de caché y de referencia en red. **No es criptografía**: la seguridad la da la **revalidación y el recálculo en el servidor**, nunca la huella.

### 2.6 Reglas de validación (cliente y servidor)

Un único módulo puro; el cliente muestra el mensaje en español, el servidor recorta. Códigos `HB-xx`:

| Código | Regla | Dónde | Sev. |
|---|---|---|---|
| HB-01 | `schema`/`v` conocidos; si `v` > actual → «build de una versión más nueva» | ambos | error |
| HB-02 | `id`, `nombre` saneados (longitud, sin control/`<>&"'`) | ambos | error |
| HB-03 | `rig` y `chasis` conocidos (E1: `arcanum-mh326@1` y `laboratorio`) | ambos | error |
| HB-04 | Cada `prop.*` numérico y dentro de rango (3.1); fuera de rango → se **recorta** y se avisa | ambos | aviso |
| HB-05 | Relaciones entre proporciones: `brazos` y `hombros` no más de ±0,15 de diferencia (con ±0,25 la regla no se podía incumplir nunca: los rangos de §3.1 solo dejan 0,23), `altura × piernas` ≤ 1,30 y `cabeza` ≤ 1,2 × `hombros` | ambos | error |
| HB-06 | Cada `p` existe en catálogo y el jugador **posee** la pieza (perfil) | ambos* | error |
| HB-07 | Cada `a` pertenece a `PARTES[p].anclas` | ambos | error |
| HB-08 | `t.pos/rot/esc` dentro de `limites` de la pieza y del ancla | ambos | recorte |
| HB-09 | No hay dos piezas en la misma sub-ranura (`ocupa`) ni en `choca_con` | ambos | error |
| HB-10 | Máx. instancias totales (propuesta: 24) y por ancla (propuesta: 6) | ambos | error |
| HB-11 | **Presupuesto de render Low**: suma de `tris.low` ≤ tope de piezas y llamadas ≤ tope (3.4) | ambos | error |
| HB-12 | Una mano con arma melee fusionada no admite pieza en `manos.derecha` | ambos | error |
| HB-13 | **Capacidad**: nº de piezas funcionales distintas ≤ `cap.max` | **servidor manda** | error |
| HB-14 | Una pieza funcional cuenta **una vez** aunque esté espejada o repetida; duplicados se eliminan | ambos | recorte |
| HB-15 | `pal.*` y `c.tinte` son `#rrggbb`; el emisivo no supera un brillo máximo (anti-deslumbramiento) | ambos | recorte |
| HB-16 | **Regla anti-oclusión** (§2.7) | ambos | error |
| HB-17 | Tamaño de la build serializada ≤ 2 KB en formato de red (cabe en `maxPayload` 8192) | servidor | error |
| HB-18 | La huella declarada coincide (solo aviso: el servidor siempre recalcula) | cliente | aviso |

\* HB-06 en el servidor solo puede comprobar lo que el servidor sabe. Hoy **no hay inventario autoritativo** (H13), así que la posesión se **acota** con el catálogo y las reglas, igual que `arbolDe`; pasa a verificarse de verdad cuando existan cuentas con perfil de servidor (ROADMAP E5-01). Esto es un límite honesto (§5.3).

### 2.7 Compatibilidad cosmética y de animaciones (requisito técnico, no promesa)

El GDD §2.2 lo dice sin rodeos: *«Compatibilidad cosmética y animaciones es requisito técnico, no promesa automática»*. Mecanismo propuesto:

1. **Declaración por pieza**: `choca_con`, `ocupa`, `limites` y la «envolvente» (radio de barrido) de cada pieza.
2. **Prueba de barrido de poses** (`tools/lab-compat.mjs`, nueva): para cada clip de los 21 y para cada pieza del catálogo en su ancla por defecto y en los extremos de `limites`, se muestrea la pose a 10 fps y se mide interpenetración pieza↔cuerpo/pieza↔pieza con cápsulas (el kit ya tiene `ak.collider` para tela). Umbral de aceptación: penetración ≤ 1,5 cm en ≥ 99 % de las muestras; las piezas que no lo cumplan reducen sus `limites` o se marcan `clips_incompatibles: [...]` (el editor lo avisa: «esta pieza atraviesa el brazo al apuntar»).
3. **Anti-oclusión de señales** (COSMETIC_COMMERCE: «un cosmético no puede reducir la visibilidad ni tapar señales de amenaza»): el *charco de luz*, el aura y las barras de nombre/estado los dibuja `createPresence` / HUD y no dependen del mesh [V: H19]; además HB-16 limita `esc` global del conjunto: **volumen del casco de piezas ≤ 1,35× el del cuerpo** y la cabeza no puede quedar cubierta (`despeja_cara`), para que ni la silueta ni los ojos desaparezcan.
4. **Tamaño visual ≠ tamaño de colisión**: la colisión usa `PLAYER.radius` (H11); un test de simulación (§5, EH-05) verifica que un diseño con `altura` mínima y otro con `altura` máxima colisionan **idéntico**.

---

## 3. Integración con el juego

### 3.1 Proporciones por hueso (E1)

**Enfoque**: escala **uniforme por segmento** aplicada a `bone.scale` en tiempo de ejecución. Motivos verificados:

- Los clips no tienen pistas de escala (H2): `AnimationMixer` no pisará `bone.scale`. [V por lectura de `codificarClips`; el comportamiento del mezclador con el kit **[NV]** hasta EH-00.]
- Las piezas del kit son mallas rígidas skineadas al hueso y los montajes (`ak.mount`) cuelgan del hueso (H4): **escalan con él** sin código extra.
- `twoBoneIK` trabaja con posiciones de mundo, no asume escala 1 (`src/arcanum/pose.js`) [V por lectura]. Con escala uniforme por segmento no hay cizalla.
- En A-pose los brazos están en diagonal: escalar solo el eje Y local del brazo **no** coincide con su eje. Por eso se usa escala **uniforme** y el largo se aproxima con escala uniforme del segmento (no se mueven huesos hijos: tendría el problema de que la malla entre articulaciones no se alarga).

Sliders (rango propuesto, a afinar en EH-00; todo [NV] hasta medir):

| Slider | Huesos afectados | Rango | Nota |
|---|---|---|---|
| `altura` | `holder.scale` (global, como `bodyScale`) | 0,90–1,15 | además cambia `FRAME` del visor |
| `ancho` | `holder.scale.x/z` | 0,90–1,15 | precedente `PATH_SHAPE` |
| `hombros` | `clavicle_*`, `upperarm01_*` (separación) | 0,92–1,12 | |
| `torso` | `spine01..04` (escala uniforme del tronco) | 0,92–1,10 | |
| `brazos` | `upperarm01`, `lowerarm01` | 0,90–1,15 | contraescala en `wrist_*` para no cambiar manos |
| `piernas` | `upperleg01`, `lowerleg01` | 0,90–1,15 | contraescala en `foot_*`; el hover/suelo se recalcula |
| `cabeza` | `head` | 0,90–1,20 | contraescala en hijos de cara no necesaria (el rostro queda tras la máscara) |
| `manos` | `wrist_*` y dedos | 0,85–1,30 | |
| `pies` | `foot_*`, `toe*` | 0,85–1,25 | |

Cálculo: se define la **escala efectiva deseada por segmento** y el compilador de proporciones deriva la escala **local** de cada hueso como `efectiva / efectiva(padre)`. Así el editor razona en «tamaño final» y no en productos de escalas.

Límites de rigging adicionales (GDD §10): `altura × piernas` ≤ 1,30 (para no desbordar el suelo/hover), `cabeza` ≤ 1,20 × `hombros`, y **ninguna** proporción puede mover el punto del suelo más de 2 cm. Cadenas (`ak.chain`) y tela (`ak.cloth`) calculan largos con la escala del *objeto* (`wscale`), no del hueso (H4): **no se admiten cadenas/tela sobre un segmento escalado fuera de ±10 %** hasta que EH-00 demuestre lo contrario [NV].

### 3.2 Cómo entra un `CustomHostBuild` a la simulación

Hoy: `Game.addPlayer(name, role, opts)` con `opts.char`, `evo`, `bend`, `maestria`, `equip`, `arbol`, `corg`… [V: `src/sim/game.js:92-114`]. El servidor ve solo lo que pasa por `cargaDe` [V: `server/server.js:44`].

Propuesta mínima (sin tocar los 8 oficiales):

1. **`CHARACTERS.laboratorio`** — entrada nueva en `src/sim/data.js` con `host: true`, `hp: 1`, `speed: 1`, `slots` neutros, habilidades **ya existentes** reutilizadas (E1: p. ej. `mov` y `esp` del conjunto más neutro; elección a validar con diseño, ver Q2) y `unlock` desde el Laboratorio. **[NV]** que `initHost`/`evolve`/`evoPathsFor` funcionen con un `char` nuevo sin tocar las 16 comparaciones por id: EH-05 empieza auditando cada `p.char ===` (por defecto caen en rama «sin efecto especial», que es lo deseado).
2. **`applyLab(p, lab, ctx)`** (en `src/sim/` nuevo `laboratorio.js`, al estilo de `applyBend`/`applyMaestria`): llama a la validación compartida, toma `corg` de las piezas funcionales y llama a `loadOrgans(p, { corg })` (que ya aplica `organError`) [V: `src/sim/organos.js:39`], recalcula `p.bn` con `capBn`, guarda `p.lb = <índice de build en la sala>`. **No** lee ningún campo cosmético.
3. **`cargaDe` ampliada** con `lab: labDe(m.lab)`; hoy no reenvía `corg` (H13), así que el Laboratorio exige además reenviar `corg` validado o derivarlo de `lab` en el servidor (recomendado: derivar de `lab`, así hay una sola fuente).
4. **Orden de aplicación** idéntico al de los oficiales (`addPlayer`: `initHost` → `loadOrgans` → `applyBend` → `applyHerb` → `applyMaestria` → `applyArbol` → `applyEquip`): la build solo aporta el paso de órganos y el aspecto; `bend`, `maestria` y `equipo` siguen entrando por el perfil, con los mismos topes de siempre (`TOPE_DANIO`, `CAPS`).

Relación con los 3 opciones que nombró el encargo:

| `opts` | Qué hace con un oficial | Qué hace con una build |
|---|---|---|
| `bend` (bendiciones de territorio) | multiplicadores pequeños | igual |
| `maestria` (rango 1–10) | multiplicadores pequeños + cosméticos de rango | rango **del chasis laboratorio**; mismos bonos genéricos |
| `equip` (objetos equipados) | armadura que **sustituye** geometría de zona (H9) | igual; las piezas de la build en zonas cubiertas por armadura **se ocultan y no cuentan** en el presupuesto (misma mecánica `replaceSlots`) |

### 3.3 Coop, balance y anti-trampas

- **Validación en servidor**: `labDe(m.lab)` recorta o rechaza (§2.6). Una build inválida **no expulsa**: el jugador entra con el aspecto y los efectos por defecto del chasis y recibe un aviso en español (nuevo código en `ERRORES` de `src/sim/red.js`).
- **Transporte**: el JSON completo no cabe cómodo en un mensaje (`maxPayload: 8192`, H13). Formato de red compacto `VB1:` = base64url de un binario/CSV de ≈ 12 bytes por pieza + 9 proporciones cuantizadas a 1 byte (precisión 0,005); objetivo ≤ 600 bytes para una build de 16 piezas, HB-17 ≤ 2 KB. Se envía **una vez** (al entrar a la sala y al cambiar el diseño en el lobby) dentro de `lobby`/`welcome`, junto con la huella; el **snapshot de simulación solo lleva `lb`** (índice corto), igual que `eq` lleva un texto breve [V: `src/sim/items-fx.js:176`]. Requiere subir `PROTOCOLO` (hoy 5 [V: `src/sim/red.js:6`]).
- **Sincronía de clientes**: cada cliente valida de nuevo y **compara la huella** con la del servidor; si no coincide o falta una pieza (clientes de versiones distintas), dibuja el aspecto por defecto del chasis y muestra «diseño no disponible en tu versión». Nunca se rompe el render.
- **Balance**: el poder funcional de una build ya está acotado por `champOrganSlots` y `CAPS` (H11, H12). El editor no introduce un eje de poder nuevo; el único cuidado extra es de **legibilidad** (§2.7).
- **Cosa que el servidor NO puede garantizar hoy** (honestidad): que el jugador *posea* las piezas o tenga el `evo` que dice; es el mismo límite que ya tienen `evo`, `equip` y `arbol` («acota, no verifica»). Un tramposo podría declarar `evo: 4` con un oficial **hoy mismo**; el Laboratorio no empeora ese techo porque su poder máximo es el de los mismos 5 órganos. Se cierra con el perfil autoritativo del servidor (ROADMAP E5-01), fuera del alcance de este documento.
- **Coop 4 jugadores**: presupuesto de escena = 4 × (cuerpo + piezas). Con el tope propuesto (≤ 14 668 tris y ≤ 15 llamadas por build, §3.4) quedan holgados los 45 de cada Huésped; el límite global de la escena lo manda el perfil de calidad.
- **Premios**: sin cambios. El cierre de partida sigue siendo idempotente por `matchId` en el ledger [V: `src/sim/ledger.js`]; una build no participa en el cálculo de recompensas (`reglaDe`, `ajustarCores`).

### 3.4 Animación y render con `createHostBody` (reutilizar el kit)

- Nuevo diseño `src/client/huesped/laboratorio.js` con la misma firma `export function build(ak, ctx)` que los 8 oficiales y registrado en `DESIGN` / `LOOK` / `FRAME` de `huesped-cuerpo.js` [V: líneas 34-52]. `ctx.lab` lleva la build canónica. Es la **única** tabla por Huésped que el cuerpo consulta, así que el resto (animación, presencia, fade, evolución) se reutiliza sin cambios.
- **Reconstrucción**: `assemble()` ya vuelve a armar todo cuando cambia `keyOf(...)` [V: líneas 74, 150]. Se añade `lab.h` (la huella) a la clave. En el editor cada cambio de pieza reconstruye (con *debounce* de 150 ms); los sliders de proporciones **no reconstruyen** (solo recalculan escalas de hueso) → respuesta inmediata. Coste de `assemble` en móvil Low: **[NV]**, se mide en EH-04 (criterio: ≤ 120 ms en un perfil de gama media simulado).
- **Animación**: los 21 clips se aplican igual (H2); las piezas siguen a sus huesos. Las colas/tentáculos/alas usan `ak.chain` y se mueven con muelles. Alas: plumas sueltas con huesos extra, como en `huesped-evo-piezas.js` («alas de luz de 14 plumas con aleteo») [V descrito en la cabecera del archivo].
- **Presupuesto de render Low (regla de validez, no solo aviso)**:
  - Techo del juego: 45 llamadas / 20 000 tris (H10). Cuerpo espectral: 1 llamada / 3 668 tris.
  - **Tope del editor (propuesta, a validar con medición en EH-04)**: piezas del jugador ≤ **11 000 tris** y ≤ **14 llamadas añadidas** (≤ 8 materiales distintos, ≤ 3 halos/sprites, ≤ 2 cadenas con huesos extra, ≤ 1 tela). Suma máxima del editor: 14 668 tris y ≈ 15 llamadas, **dejando ≈ 5 300 tris y ≈ 30 llamadas** para evolución, aspecto regional, arma melee fusionada, sello y órganos (que añaden hasta 6 llamadas) [V: `organs-vis.js` cabecera].
  - **Mismo tope en Media y Alta**: así una build válida en el móvil lo es en el escritorio (Media/Alta solo suben segmentos con `ak.s`, `Q` 1,0/1,25 [V: `HUESPEDES_ARTE.md`]).
  - **Cómo se enforza**: (1) cada pieza trae `tris.low` y `mats` en el catálogo, generados por `tools/lab-costes.mjs` (construye cada pieza en Low y mide la geometría resultante) y fijados en el repo; (2) el editor suma esa tabla **al instante** y la compara con el tope (medidor en vivo, §4.3); (3) tras cada reconstrucción mide también `ak.stats()` [V] y muestra «real» junto a «estimado»; (4) un test de navegador reconstruye el **peor caso permitido** y comprueba con `renderer.info` (como `tests/huesped-cuerpo.test.js`) que **no se supera** 45/20 000; (5) el servidor valida solo con la tabla (no renderiza). Criterio de coherencia: |estimado − real| ≤ 10 % en triángulos y **exacto** en llamadas.

### 3.5 Persistencia (perfil.js + ledger), exportar/importar, N diseños

- **Dónde**: `perfil.lab = { v: 1, activo: "lab-…" | null, slots: [CustomHostBuild × hasta 8], piezas: [ids poseídos] }`, saneado por una nueva `limpiarLab()` en el mismo estilo que `limpiarTerr/limpiarBase/limpiarInv` [V: `src/client/perfil.js:20-50`]. Se sube `ESQUEMA` de 1 a 2 con un nuevo paso en `PASOS` (`o.lab = limpiarLab(o.lab)`) [V: `src/sim/perfil-esquema.js`], para que perfiles viejos abran sin pérdida.
- **N diseños**: propuesta 8 (cada uno ≤ 2 KB → ≤ 16 KB; **[NV]** tope de tamaño del perfil de cuenta en el servidor: `server/accounts.js` guarda `JSONB` con `revision`, sin límite explícito encontrado en la lectura).
- **Ledger**: las builds **no** son recompensas y no pasan por el ledger. El ledger sí se usa para **otorgar piezas** (ids de pieza como recibos idempotentes, por ejemplo `pieza:<id>`), para que reintentos de red o recargas no dupliquen desbloqueos (AC-09) [V: `agregar/evaluar` en `ledger.js`].
- **Copia de seguridad**: la copia existente (`empaquetar`, prefijo `VORTEX-COPIA-1:`) ya incluye todo el perfil, por lo que incluye `lab` [V: `src/sim/perfil-esquema.js`].
- **Exportar/importar un diseño**: texto `VORTEX-HUESPED-1:` + base64 de `{ app, esq, at, h, build }` con la misma técnica de huella que la copia (`desempaquetar` rechaza cortes y ediciones) [V patrón]. **Al importar**: se migra, se valida, se **recalcula** `cap` y `h`, y las piezas no poseídas quedan marcadas «bloqueada» (se ven en el editor, **no** se pueden equipar; el diseño se puede guardar pero no jugar hasta tener las piezas). Importar **nunca** otorga piezas.
- **Borrador**: `localStorage` `vortex.lab.borrador.v1` solo para el borrador no guardado, envuelto en `try/catch` (la regla del repo: el almacenamiento puede fallar) y sin afectar al perfil.

### 3.6 Relación con los Huéspedes oficiales

- **VER**: el selector del editor lista los 8 oficiales (`HOST_IDS`) en modo solo lectura con el cuerpo real (`createHostBody`) y con las **anclas dibujadas encima** para entender dónde se acoplan las piezas. [V: `HOST_IDS` en `data.js:393`; los 8 Huéspedes en `huesped-cuerpo.js` (`DESIGN` + `colmena`)].
- **Personalizar un oficial (E1)**: solo lo que ya existe: acabados de `cosmetics.js` (`archivo`, `porcelana`, `obsidiana`) vía `applyCosmeticMaterials` [V]. Nada estructural, nada de proporciones, nada funcional.
- **Personalizar un oficial (E2)**: cada oficial declara en su `HostDefinition.personalizable.anclas` qué anclas aceptan accesorios *cosméticos* y cuáles están `locked` (p. ej. la cabeza de Axioma con su cuerno roto y la silueta de hombros no se tocan). La prueba de compatibilidad de §2.7 corre para cada par oficial×pieza antes de ofrecerla.
- **Laboratorio**: modo aparte, entrada propia (estación nueva en La Base o acción nueva del Armero [V: `ESTACIONES.armero.acciones`]), etiqueta visible «Creación del jugador» en toda pantalla donde aparezca (selector de misión incluido; F3 CFA: *«el selector de misión distingue ambos»*).
- **No sustituye la colección**: sin desafíos, logros de colección, entradas de códice ni desbloqueos oficiales para builds (§0.2, Q5). El Huésped inicial y la tienda siguen como están.

---

## 4. UX del editor

### 4.1 Pantallas y flujo

```
La Base · Armero ─┬─ Elegir Huésped (existente)
                  ├─ Evolución (existente)
                  ├─ Equipo y armas (existente)
                  └─ Laboratorio (NUEVO)
                       ├─ A. Mis diseños (8 tarjetas + «Nuevo» + «Importar»)
                       ├─ B. Editor
                       │    ├─ Visor 3D (centro)  ·  cámaras: frente, 3/4, perfil, espalda, cabeza, manos, pies
                       │    ├─ Pestaña CUERPO     (sliders de proporciones; Básico: 4, Avanzado: 9 + postura)
                       │    ├─ Pestaña PIEZAS     (anclas visibles como puntos; catálogo filtrado por ancla)
                       │    ├─ Pestaña ASPECTO    (paleta, acabado, materiales de pieza)
                       │    ├─ Pestaña ESTADÍSTICAS (capacidad, efectos reales, ejes descriptivos, medidor de render)
                       │    └─ Barra: Deshacer · Rehacer · Simetría · Snapshots · Sugerir · Probar · Guardar
                       └─ C. Probar  (Campo de pruebas con el diseño activo; vuelve al editor)
```

**Modo básico** (por defecto): 4 sliders (altura, ancho, piernas, cabeza), 3 plantillas de arquetipo (§4.4), catálogo reducido (solo piezas «seguras»), paleta de 6 combinaciones, simetría activada y no desactivable, medidor de render como una barra con tres colores + texto. **Modo avanzado**: los 9 sliders, postura, posición/rotación/escala por pieza con números, simetría conmutable, todas las piezas, máscara de anclas, vista numérica del presupuesto. Cambiar de modo no pierde nada. Recordado en `localStorage` como conveniencia (con `try/catch`).

### 4.2 Controles

| | PC | Táctil |
|---|---|---|
| Orbitar / zoom | Arrastrar con botón izquierdo / rueda | 1 dedo / 2 dedos (pellizco, pan) |
| Seleccionar ancla o pieza | Clic en el punto o la pieza | Toque (objetivo táctil ≥ 44 px) |
| Mover pieza dentro de límites | Arrastrar con el gizmo, o flechas ±0,005 m (±0,02 con Mayús) | Gizmo con asa grande, o botones «‹ ›» de paso fino |
| Rotar / escalar pieza | Gizmo, o campos numéricos (avanzado) | Sliders + botones de paso |
| Deshacer / rehacer | `Ctrl+Z` / `Ctrl+Y` (o `Ctrl+Mayús+Z`) | Botones en la barra |
| Simetría | `S` | Botón |
| Cámaras | Teclas `1–7` | Rueda de miniaturas |

Los gizmos **no pueden salirse de los límites**: el cursor se «pega» al borde y el medidor lo muestra («tope de posición»). Respeta las reglas del repo para el cursor capturado: el editor no captura el puntero.

### 4.3 Previsualización de estadísticas, medidor en vivo y zona de pruebas

- **Panel de estadísticas**: tres bloques. (1) *Capacidad*: «2 de 3 ranuras usadas». (2) *Efectos reales* (los números de `derivarStats` con el texto de `CHAMP_ORGANS[*].desc`). (3) *Ejes descriptivos* 0–10, con la etiqueta «solo orientativo». Sin dinero ni barras de «poder» agregadas.
- **Aviso explícito de separación**: bajo cada slider de tamaño/posición, texto fijo: «Esto es solo estética: no cambia tus estadísticas». Bajo cada pieza funcional: «Esta pieza sí cambia tus estadísticas (usa 1 ranura)».
- **Medidor de render**: dos barras (triángulos y llamadas) frente a los topes de §3.4, con valor estimado y valor real; color + icono + texto (no solo color). Al pasar el 90 % se avisa; al 100 % el editor **bloquea** añadir la pieza y explica cuánto sobra.
- **Zona de pruebas (reutiliza el Campo de pruebas, H16)**: botón «Probar» → `startSolo('m1', { practice: true })` con la build activa (mismo punto de enganche que `onPractica` en `main.js:402` [V]) y regreso al editor. Qué hay: blancos pasivos que reaparecen, munición y vida ilimitadas (ya existe). **Qué falta y habría que añadir**: (a) *maniquíes de referencia* con vida fija (`DUMMY_HP = 400` y `MANIQUIES` ya existen en La Base y el tutorial [V]); (b) *medidor de daño* en el HUD: DPS de ventana móvil de 5 s, pico y tiempo para matar un maniquí, calculados **solo en el cliente** a partir de `p.st.dmg` [V: campo `st.dmg` en `addPlayer`], sin tocar la simulación. Comparación con un oficial de referencia en la misma prueba (misma arma) para que el jugador vea que su build no supera el techo.
- **Pruebas de animación dentro del editor**: lista de clips (idle, walk, jog, sprint, jump, punch, cast, hit, death) que reproduce `human.play` [V: `humans.js`] para ver cómo se mueven las piezas, más el botón «Comprobar compatibilidad» que corre el barrido de §2.7 con las poses del diseño.

### 4.4 Asistencia opcional: sugeridor determinista (sin servicios externos)

No es IA generativa. Es un **motor de reglas y plantillas** con PRNG sembrado (el kit ya exporta `rng(seed)` [V: `huesped-armor.js`]), 100 % local y reproducible: misma semilla → mismo resultado, y se puede probar con `node:test`.

- **Plantillas de arquetipo** (JSON de builds base): *Brutal* (ancho, placas, cuernos), *Cazador* (esbelto, adrenal, cola), *Etéreo* (alto, ojo extra, aura), *Enjambre* (tentáculos, alas pequeñas), *Acorazado*. Cada una cumple todos los topes por construcción.
- **Acciones**: «Completar simetría», «Equilibrar silueta» (centro de masa visual), «Sugerir paleta» (armonías en HSL), «Reparar» (aplica el recorte de HB-04/08, elimina choques de HB-09 y, si excede, quita las piezas de menos valor hasta cumplir HB-11), «Explicar» (texto desde la tabla de efectos).
- **Siempre opcional y deshacible**: cada acción es un único comando de deshacer. Sin telemetría, sin envío de datos del diseño.
- **Fuera de alcance** (y explícitamente descartado): llamar a un LLM externo. Si algún día se quisiera, sería otra decisión con consentimiento y privacidad (GDD §7 habla de privacidad para chat; aplica el mismo criterio).

### 4.5 Deshacer/rehacer, simetría y snapshots

- **Historial por comandos** sobre el JSON de la build (cada comando guarda `antes`/`después` de una ruta); las ráfagas de un slider o un arrastre se **agrupan** en un solo paso al soltar. Profundidad 100. El historial no se persiste.
- **Simetría**: por pieza (`sim: "espejo"`); en modo básico siempre activa. Las piezas espejadas se mueven y escalan en pareja; al desactivarla se crean dos instancias independientes (el editor lo explica).
- **Snapshots**: hasta 5 por diseño, nombrados («antes de las alas»), almacenados dentro del propio diseño guardado (`snap: []`, cada uno una build completa sin `snap`); restaurar un snapshot es un comando deshacible.

### 4.6 Accesibilidad

- Todo operable con teclado: sliders con `input type="range"` nativo, orden de tabulación lógico, foco visible, atajos documentados dentro de la pantalla.
- Alternativa textual al visor: **lista de piezas** por ancla con botones «Quitar/Mover», para lectores de pantalla y para quien no pueda usar gizmos; el medidor es `aria-live="polite"`.
- No depender del color: iconos y texto en medidores y avisos; respeta la opción de claridad existente (`settings().claridad`, 'normal'|'alta') [V: `src/client/settings.js:24`] y la reducción de efectos (`reducirGravedad` ya existe; se añade «reducir movimiento» del visor: sin giro automático, sin brillo pulsante).
- Texto mínimo 16 px, objetivos táctiles ≥ 44 px, sin contenido que parpadee más de 3 veces por segundo.
- Todo el texto en español, sin jerga.

---

## 5. Escala de trabajo

Supuesto de cálculo [NV]: sprint de 2 semanas; 2 ingenieros del juego + 0,5 artista técnico. **«MVP E1 ≤ 2 sprints» es viable solo si se respeta el recorte de §5.4**; la cifra es una estimación gruesa, no un compromiso.

### 5.1 Hitos y criterios de aceptación (MVP E1)

**Sprint A — Modelo, render y simulación (sin UI final)**

| ID | Hito | Criterios de aceptación medibles | Pruebas |
|---|---|---|---|
| EH-00 | **Spike**: escala de huesos con clips e IK (2 días, bloqueante) | 21 clips × 10 combinaciones extremas de proporciones: 0 `NaN` en matrices, 0 cizalla visible en 4 cámaras, `twoBoneIK` estable; cadenas/tela con escala ±10 % documentadas; informe go/no-go | script `tools/lab-spike.mjs` + capturas |
| EH-01 | `src/shared/host-build.js`: esquema, `ANCLAS`, `normalizar`, `validar`, `derivarStats`, `huella`, `migrar` | ≥ 60 casos `node:test`; **fuzz de 5 000 builds aleatorias**: ninguna válida supera `CAPS`, la capacidad ni el tope de render; `normalizar(normalizar(x)) == normalizar(x)`; test de propiedad: cambiar `prop/t/esc/pos/rot/a/sim/pal/c` **no altera** `derivarStats`; sin DOM | `tests/host-build.test.js` |
| EH-02 | Catálogo v1: 12 piezas cosméticas + 8 funcionales (visual de los `CHAMP_ORGANS`) con generadores paramétricos | cada pieza × (Low/Media/Alta) × (ancla por defecto + extremos de `limites`) se reconstruye sin error ni advertencia; `tools/lab-costes.mjs` genera la tabla `tris/mats` y un test falla si el repositorio y la medición difieren | `tests/lab-piezas.test.js` (Chromium) |
| EH-03 | `createHostBody` con diseño `laboratorio` y proporciones | 3 builds de ejemplo (mín., medio, peor caso permitido): **≤ 45 llamadas y ≤ 20 000 tris en Low**, 0 errores de consola, capturas en 4 cámaras | ampliar `tests/huesped-cuerpo.test.js` o nuevo `tests/lab-cuerpo.test.js` |
| EH-04 | Medidor de presupuesto (estimado + real) y topes duros | \|estimado − real\| ≤ 10 % en tris y exacto en llamadas en las 3 builds de EH-03; `assemble` ≤ 120 ms en perfil móvil simulado [NV] | mismo test + `performance.now()` |
| EH-05 | Simulación: `CHARACTERS.laboratorio`, `applyLab`, `labDe` en `cargaDe`, `lb` en snapshot | (a) build ilegal → chasis por defecto y aviso; (b) `p.bn` ≤ `CAPS` siempre; (c) **vista previa == simulación** (misma `derivarStats` vs `p.bn` real); (d) dos alturas extremas ⇒ misma colisión; (e) payload de red ≤ 2 KB, mensaje total ≤ 8192; (f) 16 `p.char ===` auditadas, sin excepción para `laboratorio` | `tests/lab-sim.test.js` (+ patrón de `tests/coop.test.js`) |

**Sprint B — Editor, persistencia y coop**

| ID | Hito | Criterios de aceptación | Pruebas |
|---|---|---|---|
| EH-06 | Pantalla `laboratorio` y entrada desde el Armero; visor con cámaras de `huesped-arte-demo` | abre/cierra sin fugas (`dispose` de geometrías: `renderer.info.memory.geometries` vuelve al valor inicial ±0 tras 20 ciclos) | E2E Chromium |
| EH-07 | Pestaña CUERPO (básico/avanzado) | 9 sliders limitados a su rango; recalcula sin reconstruir; foto antes/después | E2E + capturas |
| EH-08 | Pestaña PIEZAS: anclas, catálogo, gizmo PC/táctil, simetría | Colocar/mover/borrar una pieza en ≤ 3 interacciones; imposible salir de `limites` (test con valores fuera de rango = recorte); simetría crea/mueve pareja | E2E + `tests/lab-ui.test.js` |
| EH-09 | Deshacer/rehacer, snapshots, borrador | 100 pasos de ida y vuelta devuelven la build idéntica (huella igual); ráfaga de slider = 1 paso; borrador recuperado tras recarga | `node:test` + E2E |
| EH-10 | Panel de estadísticas y mensajes de validación en español | todo error `HB-xx` muestra un texto accionable; los textos de separación cosmético/funcional presentes | E2E (texto) |
| EH-11 | Sugeridor determinista (5 plantillas + reparar) | misma semilla → misma build (huella); toda salida pasa `validar` sin errores; 0 peticiones de red | `node:test` |
| EH-12 | Persistencia: `perfil.lab`, `ESQUEMA` 2, exportar/importar, 8 diseños | perfil v1 abre sin pérdida (migración); importar texto alterado se rechaza; piezas no poseídas quedan bloqueadas; copia de seguridad restaura `lab` | `tests/lab-perfil.test.js` (patrón de `tests/ledger.test.js`) |
| EH-13 | «Probar»: Campo de pruebas con la build y medidor de daño (cliente) | el medidor coincide con `p.st.dmg` ±1 en 3 ráfagas; vuelve al editor conservando el estado | E2E |
| EH-14 | Coop: envío de builds por `lobby`/`welcome`, `PROTOCOLO` 6, fallback visual | 2 clientes ven la build del otro con la **misma huella**; build corrupta → aspecto por defecto sin excepción; cliente de versión vieja rechazado limpiamente | `tests/lab-coop.test.js` (patrón `coop4.test.js`) |
| EH-15 | Oficiales en el editor: **solo ver + acabados existentes** | los 8 se muestran con anclas superpuestas; ninguna acción del editor modifica un oficial (test: `JSON.stringify(CHARACTERS)` idéntico antes/después) | `node:test` + captura |
| EH-16 | QA final: accesibilidad, rendimiento móvil Low, capturas y documentación | recorrido completo solo con teclado; recorrido táctil sin zoom accidental; ≥ 30 fps medidos en el perfil móvil que use el repo [NV: umbral de FPS no definido por el GDD, «se fijan tras perfilar»]; `docs/EDITOR_HUESPEDES.md` pasa a «Implementado» solo con evidencia | E2E Chromium con capturas en `shots/` |

### 5.2 Pruebas (resumen)

- **`node:test` (rápidas, sin navegador)**: esquema, validación, derivación, migración, huella, sugeridor, perfil, protocolo (EH-01, 05, 09, 11, 12).
- **Chromium (Playwright, como `tests/huesped-cuerpo.test.js`)**: presupuesto de render del peor caso, reconstrucción de todas las piezas, E2E del editor con capturas y verificación de que no hay errores de consola (EH-02, 03, 06–10, 13, 16).
- **Coop**: dos clientes y servidor local (EH-14).
- **Regresión**: toda la suite actual debe seguir verde (`npm test`); en particular `tests/huesped-cuerpo.test.js` y `tests/identity-market.test.js`.

### 5.3 Riesgos y límites honestos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| R1. Escala de huesos rompe clips/IK/cadenas | Sin sliders por hueso | EH-00 primero; plan B: proporciones solo globales (`altura`, `ancho`) y variantes de **pieza** (no de hueso) |
| R2. Cada pieza nueva rompe el presupuesto (Axioma/Seraf ya al 97–99 %) | Builds inválidas o lentas en móvil | Tope propio más estricto (§3.4), tabla de costes en CI, bloqueo duro en el editor |
| R3. Compatibilidad con animaciones (atravesamientos) | Piezas que se hunden en el cuerpo al apuntar/lanzar | Barrido de poses (§2.7), `limites` por pieza, aviso al jugador; el catálogo crece solo con piezas que pasan |
| R4. El servidor no verifica la posesión de piezas ni el `evo` | Un tramposo declara más de lo que tiene | Es el límite actual de todo el perfil (H13); el poder máximo del Laboratorio no supera al de un oficial; se cierra con E5-01 |
| R5. `CHARACTERS.laboratorio` rompe ramas por id | Efectos extraños en habilidades | Auditar las 16 `p.char ===` en EH-05; habilidades reutilizadas ya probadas |
| R6. Confusión oficial vs. creado | Percepción de que se sustituye la colección | Etiqueta «Creación del jugador», sin recompensas oficiales, modo aparte (F3 CFA) |
| R7. Legibilidad en combate (piezas enormes, brillos) | Un jugador tapa señales o deslumbra | HB-15/16, presencia independiente (H19), `esc` global acotado |
| R8. Nombres libres de diseño visibles a otros | Contenido ofensivo | Saneo de caracteres como `nombreLimpio` [V: `server/server.js:42`]; en E1 solo se ve el nombre en la sala privada; moderación real queda para F12 |
| R9. Pérdida de diseños (limpieza del navegador) | Frustración | Exportar/importar, copia de seguridad ya existente, sincronización con cuenta cuando exista base contratada |
| R10. Alcance (el brief pide mucho) | Retraso | Recorte previsto (§5.4); E2/E3 fuera del MVP |

**Límites honestos de E1**: un solo cuerpo humanoide; sin locomoción distinta; piezas funcionales = los 8 órganos existentes (sin nuevas habilidades); oficiales no editables en estructura; sin galería pública ni mercado; sin cobros; estimaciones de tiempo y de triángulos de piezas **no medidas**.

### 5.4 Recorte previsto si el calendario se aprieta (en este orden)

1. Sugeridor (EH-11) pasa a un tercer sprint (queda «Reparar», que es solo validación).
2. Gizmo de arrastre → solo controles numéricos y botones de paso (más simple para táctil y accesibilidad).
3. Snapshots → solo deshacer/rehacer y borrador.
4. Coop (EH-14) → Laboratorio solo en Campo de pruebas y misión individual; coop en el sprint siguiente (sin esto, `cargaDe` y `PROTOCOLO` no cambian).
5. Postura (`pose`) fuera de E1.

**No se recorta**: EH-00, EH-01, EH-04, EH-05, EH-12, EH-15 (son la base de seguridad y de no-regresión).

### 5.5 Hoja de ruta E2/E3 (indicativa [NV])

- **E2 (≈ 3–4 sprints tras E1)**: biblioteca de partes/genética (F2), absorción de muestras, capacidad en puntos con estabilidad, hibridación determinista (combinaciones conocidas y experimentales), personalización cosmética por anclas de los oficiales, skins por pieza (F5) — requiere el ledger/servidor para cualquier cobro.
- **E3 (≈ 6–10 semanas-persona por familia de rig [NV])**: rigs cuadrúpedo/serpentino/aéreo con locomoción propia, clips nuevos, `createHostBody` multi-rig, anclas por rig y barrido de compatibilidad por rig. Condicionado a decisión de arte/animación y a disponer de clips con licencia compatible.

---

## 6. Monetización ética aplicada al editor

Marco: [COSMETIC_COMMERCE.md](COSMETIC_COMMERCE.md) y FUTURE_BACKLOG «Monetización ética». Estado real hoy [V]: **no hay cobros**; los núcleos se ganan jugando; el mercado premium debe quedar separado de la progresión.

| Elemento | ¿Monetizable en el futuro? | Regla |
|---|---|---|
| Acabados/paletas/materiales visuales de piezas (color, rugosidad, brillo moderado) | Sí | Solo `applyCosmeticMaterials`-style; sin cambiar silueta ni emisión de señales |
| Piezas **cosméticas** con arte especial | Sí | Mismas `limites` y mismo coste de render que una pieza base; no reducen visibilidad |
| Auras, marcos, retratos, poses de menú, skins completas compatibles con la anatomía | Sí | Pasan la prueba de compatibilidad antes de venderse |
| Piezas **funcionales**, ranuras, capacidad, `evo`, estadísticas, tamaño o proporciones con efecto | **Nunca** | GDD AC-11 y «Qué no se vende» |
| Más espacios de guardado de diseños | **Mejor no** (se tiende a coaccionar) | Si algún día: espacios cosméticos no funcionales y sin escasez fabricada |

Requisito previo a cualquier cobro: ledger de órdenes, catálogo en servidor y pruebas bloqueantes (COSMETIC_COMMERCE «Pruebas que bloquean activación»). **Hasta entonces todas las piezas del Laboratorio se consiguen jugando**.

---

## 7. Preguntas abiertas para el propietario (8) y recomendación por defecto

1. **¿El Laboratorio usa un único cuerpo humanoide en E1?**
   **Recomendación**: Sí. Es lo único soportado por rig y clips actuales (§1.3). Rigs alternativos solo en E3 y condicionados a presupuesto de arte/animación.

2. **¿Qué estadísticas se derivan en una build?**
   **Recomendación**: Solo las que ya existen en la simulación, vía los 8 órganos del campeón y los topes `CAPS` (§2.4). `hp` y `speed` base del chasis quedan fijos. Ni la altura, ni el ancho, ni el tamaño o la posición de una pieza afectan a nada. Los 6 ejes (daño, resistencia…) son decorativos.

3. **¿Se puede jugar coop con diseños propios?**
   **Recomendación**: Sí, en salas privadas con código (alcance de la demo), con validación en servidor y aspecto por defecto si algo falla (§3.3). Sin matchmaking público hasta F12 (moderación). Esto exige subir `PROTOCOLO`; si el calendario aprieta, Laboratorio solo en solo/Campo de pruebas en el primer corte.

4. **¿Qué cosméticos son monetizables?**
   **Recomendación**: Ninguno hasta que existan ledger de órdenes, catálogo en servidor y pruebas bloqueantes. Después: acabados, paletas, piezas cosméticas, auras, marcos y skins completas. **Nunca**: piezas funcionales, ranuras, capacidad, evolución o cualquier cosa que cambie la estadística (§6).

5. **¿Qué progreso y recompensas ganan las creaciones libres?**
   **Recomendación**: XP de conciencia, núcleos y botín normales; maestría propia del chasis Laboratorio; **sin** desafíos de Huésped, logros de colección ni desbloqueo de Huéspedes oficiales (GDD §1, F3 CFA). Así el Laboratorio no es un atajo para saltarse la colección.

6. **¿Cómo se desbloquean las piezas?**
   **Recomendación**: Ganándolas jugando. Las funcionales: los órganos que el juego ya da por esencias. Las cosméticas: logros, fauna del códice, misiones y eventos. Cada desbloqueo es un recibo idempotente en el ledger (`pieza:<id>`). Sin cajas aleatorias.

7. **¿Pueden editarse los Huéspedes oficiales?**
   **Recomendación**: En E1, solo verlos (con anclas) y usar los acabados que ya existen. En E2, accesorios cosméticos únicamente en anclas que cada oficial declare «compatibles»; estructura, silueta, proporciones y habilidades bloqueadas.

8. **¿Se pueden compartir diseños entre jugadores?**
   **Recomendación**: En E1 solo exportar/importar por texto con huella (privado y sin dar piezas que no se poseen). Sin galería pública ni búsqueda hasta tener moderación, denuncia y bloqueo (GDD §7, F12).

---

## 8. Apéndice: lista de cosas verificadas y NO verificadas

**Verificado en esta rama (lectura/`grep`/`ls`)**: GDD completo en `/tmp/claude-0/gdd1/out.txt` (secciones 1, 2.2, 5, 9, 10); `docs/FUTURE_BACKLOG.md` F1–F3 y monetización; `docs/COSMETIC_COMMERCE.md`; `docs/HUESPEDES_ARTE.md`; `src/arcanum/{rig,schema,retarget,deform,locomotion,pose,quality}.js`; `src/client/{huesped-cuerpo,huesped-piezas,huesped-armor,huesped-evo-piezas,humans,items-vis,cosmetic-material,organs-vis,huesped-arte-demo}.js`; `src/client/huesped/{axioma,colmena}.js` (cabeceras y usos de `chain`/`mount`); `src/shared/{cosmetics,identity}.js`; `src/sim/{data,items,organos,huespedes,ledger,perfil-esquema,base,tutorial,red}.js`, `src/sim/game.js` (`addPlayer`, `updatePractice`, colisión); `server/server.js` (`cargaDe`, `maxPayload`, `PROTOCOLO`), `server/accounts.js`; `tests/huesped-cuerpo.test.js`, `tests/identity-market.test.js`; `assets/arcanum/{clips.json,narrative/model.json}` (326 huesos, 21 clips).

**No verificado (marcado [NV] arriba)**:
- Que `bone.scale` por segmento conviva con el mezclador de animación, `twoBoneIK`, cadenas y tela (EH-00).
- Triángulos y llamadas de las piezas nuevas; el tope propuesto de 11 000 tris / 14 llamadas; tiempos de `assemble` en móvil.
- Que `initHost`, `evolve` y `evoPathsFor` funcionen con un `char` nuevo sin tocar las ramas por id (se audita en EH-05).
- Límite de tamaño del perfil en `server/accounts.js` y comportamiento de sincronización de cuenta con el campo nuevo.
- Estimaciones de esfuerzo (sprints, semanas-persona de E3) y disponibilidad de clips cuadrúpedos con licencia compatible.
- Umbral de FPS objetivo (el GDD §12 dice que se fija tras perfilar dispositivos).
- Postura de reposo (`pose`) sobre los clips existentes.
- Esta suite no se ejecutó (no se corrió ningún test; solo lectura de código y documentos).

---

## 9. Estado de implementación del núcleo (2026-10-25)

**Implementado y probado con `node:test` (sin navegador, sin red real salvo los tests de WebSocket locales):**

| Hito | Dónde | Pruebas |
|---|---|---|
| EH-01 núcleo compartido | `src/shared/host-build-catalogo.js` (datos: `ANCLAS`, `PARTES`/`CATALOGO`, rangos, topes, mensajes) y `src/shared/host-build.js` (`normalizar`, `validar`, `usable`, `derivarStats`, `huella`, `migrar`, `codificar`/`decodificar` VB1, `instancias`, `costeRender`, `conflictos`). La interfaz está documentada en la cabecera del archivo. | `tests/host-build.test.js` (74 casos + fuzz de 5 000 builds + 3 000 entradas basura) |
| EH-05 simulación | `CHARACTERS.laboratorio` (`src/sim/data.js`), `src/sim/laboratorio.js` (`labDe`, `applyLab`, `capLab`, `labsDeRed`), ganchos en `src/sim/game.js` (`addPlayer`, `setLoadout`, `snapshot` → `lb`, `Game.labs`) | `tests/lab-sim.test.js` |
| EH-11 sugeridor | `src/shared/host-build-sugeridor.js` (5 plantillas, `sugerir`, `reparar`, `sugerirPaleta`, `completarSimetria`, `explicar`) | `tests/lab-sugeridor.test.js` |
| EH-12 persistencia | `src/sim/laboratorio-perfil.js`, `ESQUEMA` 1→2 en `src/sim/perfil-esquema.js`, ganchos en `src/client/perfil.js` (`lab` en el perfil, desbloqueo por recibo en `acreditar`, `paraPartida`) | `tests/lab-perfil.test.js` |
| EH-14 coop | `server/server.js` (`cargaDe`, lobby/welcome/`labs`), `PROTOCOLO` 6 en `src/sim/red.js`, `src/client/net.js` (`labs`, `labAviso`) | `tests/laboratorio-coop.test.js` |
| EH-15 oficiales | `src/shared/host-build-oficiales.js` (`describirOficial`, solo lectura, congelado) | `tests/lab-sugeridor.test.js` |

**Decisiones de implementación que se apartan del texto de este documento (con motivo):**

1. **Cosmético/funcional**: las 20 piezas del catálogo v1 son 12 cosméticas y 8 funcionales (las 8 de `CHAMP_ORGANS`). `pies` y `tentaculos` existen como anclas del contrato pero el catálogo E1 no trae piezas para ellas.
2. **Lado de la pieza (`l`)**: en anclas de dos lados, una pieza sin espejo lleva `l: "izq" | "der"` (por defecto `der`); con `sim: "espejo"` no lleva `l`. En `t.pos`, +x es «hacia afuera» en cada lado. Campo añadido al esquema del §2.2.
3. **HB-05** usa ±0,15 (ver la tabla de §2.6): con ±0,25 la regla era imposible de incumplir.
4. **Ledger**: los recibos del ledger exigen ids `[A-Za-z0-9_-]{8,64}`, así que `pieza:<id>` no es válido. Los desbloqueos cuelgan del **recibo de la partida** (su `matchId`) y no de recibos propios por pieza; `perfil.lab.rec` recuerda los `matchId` ya contados (los 50 últimos), y la idempotencia viene del ledger **más** esa lista.
5. **`derivarStats().bn`** contiene solo los efectos expresables como multiplicadores de `p.bn` y pasados por `capBn`. Los efectos de los órganos de campeón **no** se aplican a `p.bn`: la simulación ya los aplica con `hasC(p, id)` (ver `src/sim/huespedes.js`). Poner también el multiplicador en `p.bn` los contaría dos veces. El resto (`danoSalida`, `salto`, `ultDur`, `meleeAlcance`, `regenPorSeg`) va en `derivarStats().mult` con cotas en `LIMITES_EFECTO`.
6. **`capLab(p)`**: el laboratorio recorta `p.bn` a `CAPS` al final de la cadena de bonos. Los oficiales **no** lo hacen (bendiciones + maestría pueden pasarse de `CAPS`: es su comportamiento de siempre y no se cambió), así que el laboratorio nunca los supera.
7. **Las 16 comparaciones `p.char ===`** del §5.1 son 15 ramas por Huésped (solo `colmena`, `singular` y `danzante`) más un `typeof e.char !== 'string'` de `ledger.js`. Ninguna menciona al laboratorio; cae en la rama «sin efecto especial». Hay un test que falla si aparece una rama nueva por id.
8. **`CHARACTERS.laboratorio`** se registra *después* de `CHARACTER_IDS` y `HOST_IDS` a propósito (no es uno de los 8 oficiales): usa las habilidades y tablas por Huésped de Axioma (`HABILIDADES`, `COMBO_SETS`, `COMBO_TUNE`, `NATIVE_MELEE`, `MELEE_AFFINITY`, `SUPPORT`, `BONOS`). No tiene árbol de talentos propio (`cleanArbol` devuelve vacío para un `char` desconocido).
9. **Catálogo inicial**: se tienen de entrada `cuerno_curvo`, `cresta_osea`, `gorguera`, `hombrera_espinas`, `placa_pectoral`, `espinas_dorsales`, `cuchilla_antebrazo` (7 cosméticas) y `placas`, `adrenal` (2 funcionales). Se ganan jugando: `corona_espinas` (1 victoria), `alas_membrana` (3 victorias), `rodillera_placa` (2 partidas), `cola_larga` (150 bajas), `garras_mano` (300 bajas) y los órganos `ojo_extra`, `saco_g`, `medula`, `tentaculo`, `corazon_cristal`, `espiraculo` (al haber hecho crecer ese órgano en una partida). Los umbrales son una propuesta de diseño, no están equilibrados con datos de juego reales.
10. **Cosméticos futuros sin cobro**: nada en E1 se vende. Lo monetizable en el futuro sigue siendo SOLO lo estético (§6): acabados/paletas, piezas cosméticas con arte especial, auras y marcos. Las piezas funcionales, las ranuras, `evo` y cualquier proporción con efecto **nunca**. Un test comprueba que ninguna `obtencion` del catálogo menciona dinero.

**NO probado / no implementado (honesto):** nada del cliente 3D (pantalla, visor, gizmos, medidor de render real, «Probar», historial, accesibilidad) ni EH-00/02/03/04/06–10/13/16; los costes `tris` de las piezas son **estimaciones de diseño [NV]**, no mediciones con `renderer.info`; no se probó con humanos, ni con red real (solo WebSocket local), ni coop con 4 jugadores reales (se probó el tamaño del lobby con 4 conexiones locales); el servidor **no verifica** que el jugador posea las piezas ni su `evo` (acota, no verifica: límite de §3.3); el perfil de cuenta del servidor no se tocó (`server/accounts.js`), así que `perfil.lab` solo se guarda en el navegador y en la copia de seguridad.
