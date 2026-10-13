# Biblia visual — CRISTAL VÓRTICE: un mundo ORGÁNICO en constante evolución

**Regla central (decisión del dueño, 2026-10-13):** el juego no es sólo psicodélico, es **orgánico y vivo**. Todo lo importante
respira, crece, late, muta o reacciona. Nada queda estático: el jugador debe sentir que el mundo, sus armas y su propio cuerpo
están **en constante cambio**, y eso tiene que **impactar visualmente**.

## Cuatro principios
1. **Todo late.** Superficies con pulso (venas, membranas, cristales que respiran), luces que laten con el ritmo del lugar.
   Sincronizá los pulsos con la música/combate (uniforme `uBeat`) para que el mundo responda a la acción.
2. **Todo crece.** Lo que gana el jugador se ve crecer: órganos en las armas (`vis` en `docs/EVOLUCION.md`), placas/alas/
   tentáculos en el campeón según nivel y órganos, puentes vivos (mapa 4), raíces que se extienden entre oleadas.
3. **Todo reacciona.** El entorno percibe al jugador: raíces que se retraen, ojos que lo siguen, tejido que se enciende a su paso,
   zonas que se infectan a medida que avanzan las oleadas (el mapa de la oleada 6 no se ve igual que el de la 1).
4. **Legibilidad primero.** La vida nunca tapa la información: enemigos, proyectiles, caminos y bordes siempre se distinguen
   (contraste de luminancia, siluetas, halos). Si algo orgánico compite con eso, se atenúa.

## Paleta por esencia (de `ESSENCES`)
Carne `#ff5a6e` · Cristal `#66f0ff` · Mirada `#ffd45a` · Vacío `#b07bff`. Las mutaciones y los órganos usan el color de su esencia
sobre la paleta base del Huésped: así se lee de un vistazo *qué* absorbió cada uno.

## Lenguaje de formas
Hueso + quitina + cristal vivo + membrana translúcida + ojo. Simetrías rotas (un lado más evolucionado que el otro), armaduras que
nacen del cuerpo, armas que son animales. Evitar: metal pulido genérico, cajas, texturas pixeladas.

## Evolución visible por oleada (meta)
Oleada 1: el mundo está «dormido». A cada oleada el tejido avanza (uniforme `uInfect` 0→1 por mapa), aparecen ojos, raíces y
esporas; tras el jefe, el mapa «florece» o «se pudre» según el resultado. El jugador debe notar el cambio sin que se lo digan.
