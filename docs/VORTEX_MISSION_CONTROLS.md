# Misiones y controles esenciales — entrega 22/10/2026

## Cambios jugables

**Reconexión:** dos o tres terminales existentes del mapa se recorren en orden.
Permanecer dos segundos activa uno; el progreso parcial se conserva al salir del
círculo. La flecha señala sólo el terminal actual. La semilla rota el punto inicial
sin consumir RNG de combate. Funciona con uno o varios jugadores, sin exigir
ocupación simultánea. Tiene un límite de 150 s y el fallo normal de objetivo.

**Caza del custodio:** el primer enemigo normal elegible de la oleada se convierte
en el blanco élite (blindado), dentro del presupuesto normal de apariciones.
Tiene el marcador del objetivo y su barra de élite. Al matarlo se cancelan los
refuerzos pendientes y las otras criaturas se desintegran sin recompensas de bajas.
Así esta misión termina al cumplir su objetivo, sin limpiar todos los rincones.
Si el blanco desaparece por estar fuera del mapa/atascado, la misión falla sin
premio y la oleada continúa normalmente; no se entrega una victoria ficticia.

| Arena | Objetivos por oleada |
|---|---|
| Islas | 2 Ancla, 4 Sintonía, 5 Núcleo, 6 Reconexión |
| Fractal | 2 Sintonía, 3 Caza, 4 Núcleo, 6 Reconexión |
| Laberinto | 2 Ancla, 3 Caza, 5 Núcleo, 6 Reconexión |
| Jardín | 2 Cultivo, 3 Ancla, 5 Núcleo/Cultivo según puente, 6 Ancla |
| Plaza | 2 Reconexión, 3 Ancla, 5 Núcleo, 6 Caza |
| Osario | 2 Ancla, 3 Núcleo, 5 Reconexión, 6 Caza |

El primer desafío opcional ahora es Primer contacto: tres bajas con el estilo
que elija el jugador. No obliga a usar melé al aprender a disparar. Los desafíos
posteriores de melé, élite, supervivencia y alimentación siguen existiendo.

## Controles: cuatro botones, acciones recuperadas

| Botón | Pulsación inmediata | Mantener 360 ms |
|---|---|---|
| Ataque Disparo | Disparar | Continuar disparando |
| Ataque Melé | A1, golpe ligero | A2, ataque secundario; Seraf carga y dispara al soltar |
| Salto | Saltar | Movilidad especial del huésped |
| Poder | Poder equipado | Solicitar definitiva (requiere carga, igual que completo) |
| Modo | Cambiar Disparo/Melé y cámara | No añade una acción |

Son cuatro botones por modo; pausa separada. La acción inicial NO se retrasa
para distinguir toque/mantener: mantener puede activar primero la acción normal
y luego la alternativa. Esto permite respuesta inmediata y usa los mismos
costes, condiciones y enfriamientos que pulsar esas acciones en completo.
No hay bonificaciones ocultas de daño, resistencia ni regeneración.

En pausa se elige entre habilidad 2, habilidad 3/principal de melé y poder de
equipo; selección por huésped y modo. La movilidad sigue accesible manteniendo
salto. El rótulo PODER · ULTI indica carga suficiente para la definitiva.
No sustituir poder por USAR por la mera existencia de una misión o una placa.
USAR aparece para interacciones reales próximas; no cambia la acción bajo un
dedo ya apoyado. Las actualizaciones de carga/evolución no cancelan el poder.

## Qué se verificó y qué no

- 63 pruebas de controles/misiones/director/modos aprobadas, sin omisiones.
- Dentro del grupo: simulación autoritativa de los ocho huéspedes en ambos modos.
  Misma secuencia explícita de acciones => mismos snapshots con esencial y completo;
  daño real contra un blanco, secundario y definitiva cargada ejecutados.
- Reconexión ensayada en las seis arenas, uno/dos participantes, por fixtures de
  posición. No se afirma que se recorrieron físicamente esos caminos con dedos.
- Caza: cierre real de oleada, marcador, ausencia de premio por acompañantes,
  fallo por desaparición, limpieza y ausencia de doble recompensa.
- Núcleo existente test:fast: 59/59.
- Red: 5/5, incluyendo dos clientes WebSocket reales con snapshots de ambas
  misiones iguales en el mismo tick. Se inyecta la oleada: no es partida humana.
- Build correcto. Protocolo subido a 3 para que clientes antiguos no entren a
  misiones cuyos campos y reglas no conocen. Publicar cliente/servidor juntos.

**Límites de balance:** equivalencia por acción no prueba idéntico win rate,
comodidad ni versatilidad. Completo permite acceder a varias habilidades sin
reequipar; esencial conserva una activa equipada más movilidad y definitiva.
Pendiente comparar sesiones humanas por huésped, medir uso accidental del hold,
DPS efectivo y supervivencia; no afirmar balance global cerrado. No se cambiaron
stats para compensar un problema de interfaz sin evidencia.

**Gate pendiente:** navegador/WebGL y iPhone físico. La descarga de Chromium
falló en la entrega previa; no hay capturas nuevas ni aprobación de ergonomía.
El próximo recorrido debe verificar saltos, carga de Seraf, reacción de Danzante,
plazos/rutas de Reconexión y lectura del blanco de Caza.
