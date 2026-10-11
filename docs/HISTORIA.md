# Historia — «Cristal Vórtice»

**Tono:** humor seco con un fondo inquietante. Texto corto, mucho ambiente. La rareza visual (OReilly) cuenta lo que las palabras no dicen.

## Premisa (isekai)
Un **Pasajero** cualquiera —auriculares puestos, la cabeza en otra parte— espera en el andén 3 a las 18:42. El anuncio avisa que el tren no se detiene en esa estación. Alguien grita. Después, la luz: **lo atropella un tren**.

Despierta tirado en un lugar sin «abajo»: el **Vórtice**, lo que queda entre estar vivo y no estarlo. Tiene armas en las manos (el Vórtice es «un anfitrión previsor») y, flotando sobre su cara, un bicho extraño: **el Heraldo**, una medusa-feto con un ojo enorme que habla con chirridos. Le explica la única regla:

> *«Sobrevivís a TODO lo que venga y volvés al mundo de los vivos. Si no… te quedás. De adorno.»*

Hay dos **corazones** que sostienen el Vórtice. Hay que romperlos. Las criaturas del Vórtice no son máquinas ni formas: son **organismos** —mitad carne, mitad cristal— que se alimentan de reflejo y de miedo.

## Reparto
| | |
|---|---|
| **Protagonista** | **El Pasajero** (sin nombre ni voz; en coop «Pasajero 1–4»). Una persona común: campera, mochila, auriculares colgando. |
| **Guía** | **El Heraldo**: sarcástico, cansado de ver gente nueva, secretamente ansioso de que alguien lo logre. |
| **Corazón 1** | **El Coloso Prismático**: leviatán-ojo flotante sobre el vacío, 3 fases. |
| **Corazón 2** | **La Madre Geoda**: flor-útero que se cierra para disparar y se abre para parir. |
| **Las criaturas** | 12 organismos con rol propio (ver `BESTIARIO.md`). |

## Estructura (campaña «Historia»)
1. **Cine del tren** (≈11 s, saltable): rieles, un faro que crece, bocina, impacto, silencio y latido.
2. **El despertar**: la cámara se levanta del suelo; llega el Heraldo y explica las reglas (≈30 s, saltable con clic/toque/Enter).
3. **Acto 1 — Vacío de Islas**: 6 oleadas + el Coloso. La gravedad es una opinión.
4. **Interludio**: «Uno menos. El Vórtice tiembla… y se acuerda de vos.» El Heraldo avisa de la marea.
5. **Acto 2 — Cámara Fractal**: 6 oleadas + la Madre Geoda. El suelo está en todas partes; la marea apaga la gravedad.
6. **Final**: «Mirá arriba, Pasajero. Eso que suena es un tren. Esta vez, de largo.» *Andén 3. 18:42. Los auriculares puestos. Un abajo bajo los pies.* Pantalla: **VOLVISTE AL MUNDO DE LOS VIVOS**.
7. **Derrota**: *«El Vórtice te guarda un lugar. Siempre hay lugar. Probá de nuevo.»*

Las **arenas** (menú) saltan la historia y van directo a un mapa; el **cooperativo** (hasta 4 Pasajeros) usa una versión corta del despertar.

## Guion completo
Está en `src/client/story.js` (líneas `[quién, texto, segundos]`): `INTRO_TRAIN`, `WAKE`, `WAKE_SHORT`, `INTERLUDE`, `ENDING`, `DEFEAT`. El Heraldo habla con subtítulos y «chirridos» por letra (voz sintetizada, sin actores de voz).

## Nota
El protagonista es deliberadamente neutro (sin nombre ni género) para que cualquiera se ponga en ese andén.
