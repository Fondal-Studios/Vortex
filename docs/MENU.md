# Menú de VORTEX — mapa, reglas y pruebas

Rediseño del 2026-10-21 («simple y bien organizado»). Reemplaza al menú en 4 puertas con hubs (JUGAR / MI HUÉSPED / MUNDO / AJUSTES).

## Reglas de diseño
1. **Una acción enorme** (Continuar / Jugar) y **como máximo 5 puertas** secundarias, cada una con ícono + palabra corta + UNA línea de ayuda.
2. **Sin pasillos**: cada puerta abre directo su primera pantalla. Lo secundario vive en **pestañas** de una sección, no en listas largas ni en pantallas-índice.
3. **Una sola barra superior** en todas las pantallas, con el mismo orden y el mismo estilo.
4. **Lo frecuente a ≤ 2 toques** desde el inicio (jugar, cambiar de Huésped, Tienda, Inventario/Forja). Lo prueba `tests/recorrido-menu.test.js`.
5. Botones y pestañas **≥ 44 px**, foco siempre visible, todo en español, estados vacíos con una frase que dice qué hacer.
6. **Puntitos** (avisos) sólo donde hay una acción útil.

## Mapa

```
TÍTULO ──(tocar)──▶ INICIO
                     │
   ┌─────────────────┴──────────────────────────────────────────────────────────┐
   │ [▶ CONTINUAR / JUGAR]  (1 toque: retoma la última partida)  [ELEGIR PARTIDA]│
   │            «Próximo paso: Evolucioná a tu Huésped ›»                        │
   │ [LA BASE] [HUÉSPEDES] [COLECCIÓN] [COOPERATIVO] [AJUSTES]                   │
   └─┬──────────┬───────────┬────────────┬────────────┬──────────────────────────┘
     │          │           │            │            │
     ▼          ▼           ▼            ▼            ▼
  mapa      HUÉSPEDES    COLECCIÓN    (sección     AJUSTES
  jugable   Huésped ·    Criaturas ·   PARTIDAS)   Controles y sonido ·
  (Base)    Evolución ·  Fauna ·       Historia ·  Gráficos
            Inventario · Herbario ·    Arenas ·
            Forja ·      Territorios   Cooperativo ◀── «Elegir partida» abre esta sección
            Tienda ·
            Equipo

BARRA SUPERIOR (todas las pantallas menos el título)
  [‹ Volver]  [pestaña][pestaña]…  ·········  [Shooter|Melé] [⚙ Gráficos] [◆ 640 → Tienda]
  (en teléfono vertical las pestañas bajan a una segunda fila; «Volver» queda sólo con ‹)

PAUSA EN PARTIDA
  Continuar · Modo de juego · Gráficos · Controles y cámara ▾ · Salir a la Base · Salir al menú
```

## Dónde está cada cosa (antes → ahora)
| Función | Antes | Ahora |
|---|---|---|
| Jugar | Inicio › Continuar | **Inicio › Continuar** (1) |
| Otra arena / Historia | Inicio › Jugar › Arenas › mapa (3) | **Elegir partida › mapa** (2) |
| La Base | Inicio › Jugar › La Base (2) | **La Base** (1) |
| Cambiar de Huésped | Mi Huésped › Huésped › Huésped › Elegir (4) | **Huéspedes › tocar el Huésped** (2; ya queda elegido) |
| Evolución | Mi Huésped › Evolución (2) | Huéspedes › Evolución (2) |
| Inventario | Mi Huésped › Inventario y Forja (2) | Huéspedes › Inventario (2) |
| Forja | Mi Huésped › Inventario y Forja › Forja (3) | **Huéspedes › Forja** (2) |
| Tienda | Mundo › Tienda (2) | **◆ núcleos de la barra** (1) o Huéspedes › Tienda (2) |
| Territorios | Mundo › Territorios (2) | Colección › Territorios (2) |
| Bestiario | Mundo › Bestiario (2) | **Colección** (1) |
| Fauna / Herbario | Mundo › Bestiario › pestaña (3) | Colección › pestaña (2) |
| Cooperativo | Jugar › Cooperativo (2) | **Cooperativo** (1) |
| Gráficos | Ajustes › Gráficos (2) | **⚙ de la barra** (1) |
| Controles y sonido | Ajustes › Controles (2) | **Ajustes** (1) |
| Modo Shooter/Melé | Jugar (barra) / Opciones / Huésped | **Barra superior** (1, en cualquier pantalla) |

## Lo que se fusionó o se quitó (sin perder funciones)
- Los **4 hubs** (`hub-jugar`, `hub-huesped`, `hub-mundo`, `hub-ajustes`) ya no existen: eran pantallas-índice. La «ruta de objetivos» pasó a una línea, **Próximo paso**, en el inicio.
- **Migas de pan** → pestañas de la sección (el camino es de un solo nivel).
- **Modo** estaba en 5 lugares (barra de Jugar, Opciones, botón del Huésped, Pausa, Combate): queda en la barra superior y en la Pausa. Se quitó de Opciones y de la pantalla Huésped.
- **Gráficos** estaba en Opciones (selector «rápido» + botón) y en Ajustes: queda la pestaña, el engranaje y la Pausa.
- **Inventario** del botón del Huésped → pestaña Inventario. **Elegir Huésped** en 2 pasos → un toque en tu Huésped lo elige.
- El Bestiario y el Equipo traían **sus propias pestañas y su propio «Volver»**: ahora los da la barra única.
- El texto «Ruta: Elegí Huésped → …» (repetido en Historia y Arenas) se quitó; lo cubren la bienvenida y «Próximo paso».
- Los ajustes táctiles largos van plegados en «Controles táctiles y cámara».

## Navegación
- **Volver**: botón, Esc/Retroceso, ○ del mando, o deslizar desde el borde izquierdo. Las pestañas **no apilan**: un solo Volver vuelve al inicio (o a la Base si el menú se abrió desde ella).
- **Pestañas**: tocar, Q / E (o RePág / AvPág), LB / RB del mando.
- **Inicio y Tienda**: flechas/WASD al vecino más cercano; Enter/Espacio/✕ abre.
- **Primera vez**: bienvenida de 3 pasos que se salta con «Saltar» o Esc y no vuelve (`vortex.bienvenida.v1`). En pruebas automáticas no sale, salvo `?bienvenida=1` (`?bienvenida=0` la apaga siempre).

## Archivos
| Archivo | Qué hace |
|---|---|
| `src/client/menu-nav.js` | **Datos puros**: `PUERTAS`, `SECCIONES` (pestañas), `PANTALLAS`, `tabActiva`, `continuarDe`, `avisos`, `avisosPuertas`, `rutaObjetivos`. Única fuente del mapa. |
| `src/client/menu-hubs.js` | Dibujo: inicio, barra superior (`dibujarBarra`), puntitos, `vecino` (navegación espacial). |
| `src/client/menu-bienvenida.js` | La bienvenida de la primera vez. |
| `src/client/ui.js` | `MenuUI`: `show`, `back`, `go`, `irTab`, `cambiarTab`, teclado/mando. |
| `public/menu.css` | Todo el estilo del menú (bloques numerados: inicio · barra · bienvenida · pausa · retoques · pantallas chicas). |
| `public/index.html` | `#main`, `#topbar`, la pausa (`#pause`) y las pantallas. |

## Cómo se prueba
- `node --test tests/marca.test.js` (mapa y avisos, sin navegador)
- `node --test tests/recorrido-menu.test.js` (toques desde el inicio hasta cada función en 3 tamaños, Q/E, bienvenida, pausa)
- `node --test tests/tienda-ui.test.js` · `graficos-ui.test.js` · `huespedes-ui.test.js` · `inventario-ui.test.js` · `hud.test.js` (menús vía `tools/shot-menus.js`)
- Capturas: `node tools/shot-menu5.js shots/menu5 [pantallas] [tamaños]` (4 tamaños, avisa de textos cortados, botones chicos y cosas fuera de pantalla) y `node tools/shot-pausa.js shots/menu5`.
- Capturas de la versión actual: `shots/menu5/` (4 tamaños × 13 pantallas + pausa).
- Resultado del 2026-10-21: marca 6/6 · recorrido-menu 6/6 · tienda-ui 7/7 · graficos-ui 3/3 · inventario-ui 3/3 · huespedes-ui 6/6 · hud «menús» 1/1.
- **No probado**: iPhone real (Safari), mando físico (LB/RB), lectores de pantalla, el menú con la Base en pantalla real de teléfono.
- **Pendiente conocido**: el Equipo (`#loadout`) repite parte de Huésped y Evolución (habilidades y ranuras de armas); se dejó como pestaña final hasta confirmar que se puede fusionar sin perder nada. La barra propia del HUD de la Base (Jugar · Menú · Salir) no se unificó con la barra del menú a propósito (es inmersiva).
