# Guía de arte y audio

## Arte
- **Todo procedural**: ni una textura, ni un modelo importado. El estilo sale de formas primitivas (octaedro, icosaedro, cono hexagonal, toro) como en OReilly, pero con color saturado y fractales.
- **Paleta**: se genera con la paleta coseno `0.5+0.5·cos(2π(t+[0,.33,.67]))`, así cualquier valor de `t` da un color armónico; cada mapa elige otro desplazamiento (`hue`).
- **Cielo** (`skyMaterial`): pliegues fractales tipo Kali + estrellas; **cascarón** del Mapa 2 (`shellMaterial`): ruido deformado, atenuado a propósito para que las criaturas destaquen (se corrigió tras la revisión visual: era ilegible).
- **Cristal** (`crystalMaterial`): normal por derivadas (facetado plano), iridiscencia por Fresnel, brillo (`uGlow`), destello de daño (`uHurt`), camuflaje (`uShim`) y tonemap suave para que el brillo no queme a blanco.
- **Legibilidad**: cada aviso de ataque cambia el brillo/forma de la criatura (ver `BESTIARIO.md`). Zonas de física = cáscaras translúcidas con bandas animadas (cian que sube = gravedad invertida; violeta = cero-G; ámbar = tiempo lento; azul = pozo).
- **Distorsión de la realidad**: durante una inversión de gravedad o la marea el lienzo gira de tono (filtro CSS `hue-rotate`) y hay destello al cambiar de fase de jefe.

## Audio
- **Todo sintetizado** con WebAudio (`src/client/audio.js`): no hay archivos ni licencias.
- Cada arma y cada criatura tiene timbre propio; posicionamiento por distancia y paneo estéreo.
- **Música generativa por mapa**: Mapa 1 escala lidia, pads + arpegios con eco; Mapa 2 frigia con bajo pulsante. La intensidad (densidad de notas, pulso) sube con la cantidad de criaturas vivas.
- Pendiente (honesto): mezcla no calibrada en altavoces reales; sólo se verificó que no lanza errores.
