# Personajes, armas, mejoras y el Laberinto Celestial

Todo lo de esta página está en el juego y probado con tests de simulación (`tests/arsenal.test.js`, `tests/director.test.js`) y capturas.

## 6 personajes (menú **Equipo**)
Cada uno tiene **2 habilidades propias** (un desplazamiento y un disparo especial) y conserva la **habilidad de equipo** de su rol (tecla Q).

| Personaje | Rol | Desplazamiento (F) | Disparo especial (clic der.) |
|---|---|---|---|
| Égida | Vanguardia | Embestida (arrolla) | Onda de choque (cono + empuje) |
| Lumen | Soporte | Paso de luz (teletransporte corto) | Rayo sanador (daña y cura aliados) |
| Forja | Ingeniero | Propulsor (impulso arriba/adelante) | Cohete de racimo |
| Vigía | Explorador | Deslizamiento (carrera) | Tiro marcador (perfora y marca +30 %) |
| Nova | Explorador | Salto cuántico | Ráfaga total (14 disparos) |
| Umbra | Soporte | Fase (salto atrás + 1 s invulnerable) | Singularidad (agujero que arrastra y estalla) |

Controles: PC `F` y clic derecho · mando L1/○ y R1 · táctil botones DESPLAZ. y ESPECIAL.

## 15 armas y 5 ranuras
El **Haz** va siempre en la ranura 1; elegís las otras 4 entre 14 en el menú **Equipo**. Nuevas: Pulso, Gemelas, Solar (lanzallamas de luz), Fractal (arco que salta), Enjambre (5 micro-misiles), Cometa (teledirigido), Vórtice (pozo de gravedad), Lanza (perfora), Cetro Vital (te cura), Eclipse (escopeta pesada).

## Mejoras de armas por oleada
Al limpiar cada oleada aparecen **3 tarjetas** (teclas 1-3, tocar en el celular, o mando): **más daño** (+22 %/nivel, máx. 5), **más cadencia** (+14 %/nivel, máx. 5), **más munición** (+30 %/nivel, máx. 4) o una **mejora especial** única por arma (Perforante, Explosiva, Cadena, Vampírica). Si no elegís, se aplica la primera. Cada nivel **se ve en el arma** (aletas, anillos, celdas, emblema).

## Dificultad creciente
Vida +8 % por oleada, velocidad +1,6 %, y desde la oleada 3 aparecen **élites** (más grandes, ×2,2 de vida, aura roja). El Director de ritmo sigue regulando la presión.

## Mapa 3: Laberinto Celestial
Laberinto 9×9 de muros de cristal flotando en el cielo. **Los muros frenan a jugadores, balas y rayos; las criaturas (cósmicas) los atraviesan**, así que sirven de refugio. Puzzles: el **Núcleo** hay que llevarlo a través del laberinto (hay 2 pares de portales). Jefe: **Argos, el Ojo Primordial**: escudado mientras queden sus **ojos orbitales** (puntos débiles); al romperlos todos queda aturdido ×2,5; su **Mirada** avisa 2,5 s y los muros la bloquean. **Ojos cósmicos** decoran el cielo de los tres mapas.

## Límites honestos
Los bots (únicas pruebas de balance) ganan 6/8 en el Mapa 1, 3/8 en el 2 y 2/8 en el 3: no hay datos de jugadores reales. Las armas originales en primera persona siguen viéndose "de juguete" y el avatar es una mejora moderada. Nada medido en un iPhone real. El entorno de los mapas 1 y 2 y varias criaturas quedaron con una mejora parcial: un agente se cortó por límite de uso.
