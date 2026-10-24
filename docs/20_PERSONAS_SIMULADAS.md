# VORTEX — 20 PERSONAS SIMULADAS (simulación heurística etiquetada)

> **Estado del documento**
> - Versión: 0.1 · Fecha: 2026-10-24 · Responsable: Claude (estudio)
> - SHA base: `62244b61eaecff34ba539fc4018456172579bf03` (rama canónica `claude/larga-con-eso-s43nfe`) · Rama de trabajo `claude/vortex-fase0-sprint1` @ `d009eec` · Archivo **sin commitear**
> - Naturaleza: **SIMULACIÓN HEURÍSTICA.** Es un ejercicio de diseño y auditoría. **No es un playtest, no hay personas reales y no demuestra jugabilidad real.** (GDD §12: «La simulación no demuestra jugabilidad real»; «Prohibido afirmar playtesting humano no realizado».)
> - Niveles: lo que aquí se afirma de personas es solo **Diseñado** (hipótesis). Lo que se afirma del juego remite a [AUDIT.md](AUDIT.md) (Implementado / Probado).
> - Hermanos: [QA_MATRIX.md](QA_MATRIX.md) · [ROADMAP.md](ROADMAP.md) (Sprint 6) · [DEMO_RELEASE_CHECKLIST.md](DEMO_RELEASE_CHECKLIST.md)
> - Aviso de nombre: `docs/PERSONAS.md` NO trata de esto; describe los modelos de personas 3D del juego. La alfa simulada anterior es [VORTEX_ALPHA_SIMULATED.md](VORTEX_ALPHA_SIMULATED.md) (20 perfiles sobre otra versión, `18b1e1e`); aquí se rehace sobre el SHA actual y no se reutilizan sus notas.

## 0. Tres categorías que nunca se mezclan

| Categoría | Qué es | Qué hay hoy |
|---|---|---|
| **A. Tests ejecutados** (lo único medido) | Comandos que se corrieron y cuyo resultado está citado | Mediciones con bots en [audit/MEDICION_CAPITULOS.md](audit/MEDICION_CAPITULOS.md) y el test de presupuesto de Huéspedes (§1) |
| **B. Simulación heurística** (este documento) | 20 perfiles ficticios; se razona qué fricción tendría cada uno ante el juego tal como está construido | La matriz de la §3, con puntuaciones **hipotéticas** |
| **C. Testers humanos reales** | Personas que jugaron y fueron observadas | **Ninguno hasta ahora.** Cero sesiones, cero encuestas, cero datos |

Cualquier cifra de la categoría B es una opinión de diseño razonada, no una medida. Un promedio de la categoría B no sustituye la puntuación ponderada de [QA_MATRIX.md](QA_MATRIX.md) y no es una predicción de retención.

## 1. Lo único medido (categoría A)

Medición con **bots** (no humanos): `tools/audit/medicion-capitulos.mjs`, 54 partidas (6 capítulos × 3 estilos de bot × 3 semillas) más 18 con jugador inactivo. Fuente: [audit/MEDICION_CAPITULOS.md](audit/MEDICION_CAPITULOS.md).

| Dato medido | Valor |
|---|---|
| Partidas con bot que terminan | 54 de 54 (0 timeouts a 25 min) |
| Mediana de victoria por capítulo (min) | m1 2,39 · m3 1,82 · m4 2,44 (5 de 9 victorias) · m5 1,41 · m6 0,70 · m2 6,73 (6 de 9 victorias) |
| Victorias por estilo de bot | Disparo 18/18 · Melé 12/18 (0/3 en m4 y m2) · Habilidades 17/18 |
| Bot de habilidades contra jefes de m1/m2 | 8,3–15,2 min; jefe 413–812 s |
| Jugador AFK en m2 | 2 de 3 semillas quedan congeladas en «elegir mejora» |
| Recompensa al perder | XP parcial y todos los núcleos; sin avance de campaña |
| Cerrar la misma partida 3 veces | 900 núcleos en vez de 300 (no idempotente) |
| Presupuesto gráfico Low por Huésped | 2/2 tests OK; peor caso 35 llamadas y 19 556 triángulos |

Limitación: los bots no son humanos. `jefe-bots.js` solo diferencia estilos con un jefe vivo; los bots de `tools/` no mandan el flag `support`. Un bot con parámetro de habilidad bajo no es un principiante. **Duración humana: No verificado.**

## 2. Método de la simulación (categoría B)

1. **Construcción de perfiles.** Se definieron 20 perfiles que cubren los ejes del GDD §12: nivel (principiante, medio, experto), plataforma (móvil, escritorio, tableta), cámara (1.ª y 3.ª persona), modo (solo y coop), estilo (melé y shooter) y accesibilidad. Los perfiles son ficticios y no representan a nadie real.
2. **Recorrido heurístico.** Para cada perfil se recorrió, sobre el código y las mediciones, la secuencia: abrir → elegir Huésped → primer capítulo → controles → objetivo → combate → pausa/derrota → resultado → volver. En cada paso se buscó fricción con las propiedades **verificadas** del juego (ver «Hechos del juego» abajo).
3. **Hipótesis de fricción.** Una por perfil, redactada como «es probable que…», con el hecho que la motiva.
4. **Puntuación hipotética de experiencia (0–100).** 50 = fricción importante; 70 = utilizable con carencias; 90 = clara y pulida. Es un juicio de diseño, no una medición.
5. **Qué la desmentiría.** Cada hipótesis se acompaña de la observación humana que la confirmaría o refutaría (para el Sprint 6).

Hechos del juego usados (todos de [audit/MATRIZ_GAPS.md](audit/MATRIZ_GAPS.md) o [audit/MEDICION_CAPITULOS.md](audit/MEDICION_CAPITULOS.md)): sin tutorial jugable ni cinemática de transferencia; intro de ~18,5 s en subtítulos de tiempo fijo; 4 botones de acción con habilidades que se desbloquean tras las oleadas 1 y 3; cámara inicial 1.ª en Disparo y 3.ª en Melé; HUD con «ETAPA x / y» y sin reloj; sin opciones de daltonismo, escala de texto ni remapeo; `prefers-reduced-motion` presente; minimapa con formas; coop sin bots ni espectador, desconectado inmóvil 45 s; capítulos de 1–3 min con bots; riesgo de falso sonido de impacto en Combo a distancia; premios sin ledger.

## 3. Matriz de los 20 perfiles (todas las notas son hipotéticas)

Abreviaturas: Móv = móvil táctil · Esc = escritorio (teclado y ratón) · 1P / 3P = cámara · Solo / Coop.

| ID | Perfil | Nivel | Plataforma | Cám. | Modo | Estilo | Hipótesis de fricción principal | Nota hip. |
|---|---|---|---|---|---|---|---|---:|
| P01 | Principiante absoluto, nunca jugó un shooter | Principiante | Móv | 3P | Solo | Melé | Es probable que no entienda qué hacer tras 18,5 s de subtítulos sin escena y una tarjeta de controles; la palanca táctil y 4 botones con significado cambiante lo saturan | 42 |
| P02 | Principiante con teclado y ratón | Principiante | Esc | 1P | Solo | Shooter | Arranca en 1.ª persona (modo Disparo) y la puntería con ratón puede ser la primera barrera; «ETAPA 1/4» no le dice cuánto falta | 48 |
| P03 | Principiante invitado por un amigo experto | Principiante | Móv | 3P | Coop | Melé | El amigo lo ayuda de viva voz, lo que oculta el vacío de tutorial; si el amigo cae, no hay espectador útil ni bot | 58 |
| P04 | Casual de sesiones de 5 minutos | Principiante | Móv | 3P | Solo | Melé | Un capítulo de 1–3 min cabe en su sesión (a favor); sin guardado a mitad de misión, abandonar pierde el capítulo; el resultado en texto plano no le da cierre | 46 |
| P05 | Jugador medio de acción en 3.ª persona | Medio | Esc | 3P | Solo | Melé | Disfruta los combos por Huésped, pero Melé tiene 0 victorias de bot en m4 y m2; puede topar con un bloqueo real en el capítulo 3 (causa sin determinar) | 62 |
| P06 | Jugador medio de shooters | Medio | Esc | 1P | Solo | Shooter | El Disparo funciona de punta a punta con bots (18/18); critica capítulos de 2 min y la falta de reloj; riesgo de oír impactos al disparar al aire | 60 |
| P07 | Jugador medio móvil con un amigo | Medio | Móv | 1P | Coop (2) | Shooter | Salas con código simples (a favor); si uno se desconecta, el compañero queda inmóvil 45 s; botones táctiles pequeños con 1.ª persona | 55 |
| P08 | Anfitrión de sala con tres amigos | Medio | Móv (tableta) | 3P | Coop (4) | Mixto | Hasta 4 en sala privada; el fallo conocido de `coop4` y la ausencia de bots y de resultado al reanudar pueden arruinar una noche | 50 |
| P09 | Experto en shooters rápidos | Experto | Esc | 1P | Solo | Shooter | Termina en menos de 3 min con facilidad; pide dificultad y jefes; el jefe de m1 cae en ~44–59 s con bots | 64 |
| P10 | Experto en combos de melé | Experto | Esc | 3P | Solo | Melé | Valora 8 golpes por Huésped; Danzante sin animaciones propias y Singular/Colmena con sonido de golpe genérico rompen la identidad | 63 |
| P11 | Experto móvil, pantalla pequeña | Experto | Móv | 1P | Solo | Shooter | HUD de cuatro acciones y minimapa pueden competir por espacio en una pantalla pequeña; sin dispositivo no se sabe | 52 |
| P12 | Líder de coop que exige fiabilidad | Experto | Esc | 3P | Coop (4) | Mixto | Repite partidas y repara en el cierre duplicado de premios y en que el resultado no se reenvía; desconfía del progreso | 57 |
| P13 | Jugador con mando | Medio | Esc | 3P | Solo | Melé | No se verificó soporte de mando; el botón USAR de reanimar se menciona para mando, pero no hay prueba | 58 |
| P14 | Daltonismo rojo-verde | Medio | Esc | 1P | Solo | Shooter | Minimapa con formas (a favor); el resto del HUD y las alertas pueden depender del color; no hay modo daltónico | 51 |
| P15 | Baja visión, necesita texto grande | Medio | Móv | 3P | Solo | Melé | No hay escala de texto; briefings y tarjetas largas; contraste alto ausente | 40 |
| P16 | Lector lento o con dislexia | Principiante | Esc | 3P | Solo | Melé | Los subtítulos avanzan por tiempo fijo y la intro dura ~18,5 s: se pierde el relato; no hay avance manual ni resumen | 44 |
| P17 | Movilidad reducida, juega con una mano | Medio | Móv | 3P | Solo | Melé | La palanca más 4 botones exigen dos manos; sin remapeo ni gestos alternativos | 41 |
| P18 | Sensible al movimiento (mareo) | Medio | Esc | 1P | Solo | Shooter | Cambio de cámara instantáneo y giro brusco; hay reducción de movimiento, pero la 1.ª persona es la cámara inicial en Disparo | 47 |
| P19 | Sordo o con audición reducida | Medio | Esc | 3P | Solo | Melé | Subtítulos del Heraldo (a favor); la lectura de impactos depende del sonido; el falso hit de Combo a distancia confunde si es la única señal | 53 |
| P20 | Veterano que vuelve tras una pausa y explora | Experto | Esc | 3P | Solo | Mixto | Explora sin seguir la misión; el Santuario como destino por defecto lo lleva a un hub y no a una partida; puede dejar la elección de mejora sin contestar y congelar la partida | 59 |

**Media de las 20 notas hipotéticas: 52,5.** Es la media aritmética de las 20 notas de arriba, que son hipótesis; no es una métrica de calidad ni de retención, y no sustituye a [QA_MATRIX.md](QA_MATRIX.md). Rango: 40 a 64. Las notas más bajas (40–48) corresponden a principiantes en solitario y a perfiles de accesibilidad (P01, P02, P04, P15, P16, P17, P18); las más altas (60–64) a jugadores medios y expertos de escritorio (P05, P06, P09, P10).

## 4. Fricciones recurrentes (lo que más pesa en la simulación)

1. **Primer minuto sin enseñanza activa** (P01, P02, P04, P16): no hay cinemática ni tutorial jugable; [ROADMAP.md](ROADMAP.md) E1-01 y E1-02.
2. **Accesibilidad ausente** (P14, P15, P17, P18): sin daltonismo, escala de texto, remapeo ni contraste alto; E2-09.
3. **Cooperativo frágil** (P03, P07, P08, P12): sin bots, sin espectador, resultado no reenviado, `coop4` con fallo; E4-01…E4-04.
4. **Melé sin garantía de victoria en m4 y m2** (P05, P10): hallazgo medido con bots, causa no determinada; E3-03.
5. **Capítulos cortos y sin tope de jefe** (P06, P09): medidos con bots; E1-05, E3-01, E1-09.
6. **Premios y progreso** (P04, P12): cierre duplicado medido; E1-06.
7. **Señal sonora de impacto** (P06, P19): riesgo leído en el código, sin prueba; E2-01.
8. **Identidad de Huésped incompleta** (P10): Danzante, Singular, Colmena; E2-06, E2-07.

## 5. Limitaciones

- Los 20 perfiles son un recurso de razonamiento; no se les «hizo jugar». Su estimación depende de hechos leídos del código y de mediciones con bots, ambos pueden estar desfasados.
- Las notas reflejan opinión de diseño del auditor y no se calibraron con ningún dato humano.
- Sin dispositivo físico, sin audio escuchado y sin observación de comprensión, las notas de HUD, manejo y diversión son de confianza baja.
- No se estima retención D1 ni D7: eso exige observar regresos efectivos con denominador de jugadores iniciales.
- Los perfiles se redactaron conociendo el juego; un jugador real no lo conoce.

## 6. Qué debe hacerse para reemplazar esta simulación por datos (Sprint 6, E6-06 y E6-07)

- Repetir esta matriz sobre la **versión candidata**, no sobre este SHA.
- Reclutar testers humanos reales (meta del GDD: 20 sesiones), con consentimiento, registrando: tiempo al primer movimiento, primer ataque, primer objetivo, primera muerte, ayudas pedidas, abandonos, errores de control y salida. Al minuto 5, preguntar de forma abierta qué es lo que están haciendo y adónde van, antes de mostrar opciones.
- Probar PC y iPhone físico; con y sin cinemática; en solitario y en coop.
- Registrar los resultados en una tabla aparte titulada «Testers humanos reales» con fecha, dispositivo y duración. **Hasta que esa tabla exista, este proyecto no puede afirmar que fue probado con personas.**

### Registro de testers humanos reales

| ID | Fecha | Dispositivo | Duración | Observaciones |
|---|---|---|---|---|
| (sin sesiones) | | | | Ninguna realizada al 2026-10-24 |
