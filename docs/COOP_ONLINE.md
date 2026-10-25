# Cooperativo online (hasta 4 jugadores) — guía para el dueño

> Escrita el **2026-10-21**. Los datos de los servicios gratuitos se verificaron ese día con búsquedas en internet; **cambian seguido**,
> así que si algo no coincide con lo que ves en pantalla, mandá una captura y lo ajustamos.
> Lo que NO pude probar desde acá: el despliegue real en Render, internet real entre personas y un iPhone real
> (detalle al final, en «Qué se probó y qué no»).

## 1. Cómo funciona (en 30 segundos)

```
 Amigo 1 (navegador) ─┐
 Amigo 2 (navegador) ─┼──►  SERVIDOR (Node, un programa que corre las 24 h en la nube)  ◄── manda "Sala ABCD, 4 jugadores"
 Amigo 3 (navegador) ─┤        · corre el juego de verdad (monstruos, daño, botín)
 Amigo 4 (navegador) ─┘        · cada navegador sólo manda "me muevo / disparo" y recibe "qué pasa"
```

* El juego que ves en **GitHub Pages** (la web) es sólo la «pantalla». Para jugar juntos hace falta **un servidor** aparte.
* El **modo solo** no necesita servidor y sigue funcionando igual.
* Una sala = 4 letras/números (ejemplo `K7MQ`). El anfitrión toca **Invitar amigos**, se copia un enlace
  (`https://drmarianojimenez94-sudo.github.io/Shower-psico/?sala=K7MQ`) y quien lo abre entra solo a la sala.

## 2. Qué opciones gratuitas hay hoy (verificado 2026-10-21)

| Opción | ¿Gratis de verdad? | Límites importantes | ¿Sirve para este juego? |
|---|---|---|---|
| **Render – Web Service Free** | Sí. La documentación no pide tarjeta para crear un servicio Free (en la práctica, al registrarte puede pedírtela: ver abajo) | Se **duerme tras 15 min sin tráfico** y tarda **~1 min** en despertar. 750 horas/mes. **100 GB/mes** de salida de datos (si se pasa y no hay tarjeta, suspende los servicios gratuitos hasta el mes siguiente). Acepta WebSocket. 512 MB RAM, CPU compartida chica | **SÍ → recomendada para probar ya** |
| **PC del dueño + túnel `cloudflared`** | Sí, 100 % (usa tu propia PC). No necesita cuenta ni tarjeta (modo «quick tunnel») | La PC tiene que estar prendida y con el servidor corriendo. La dirección `https://algo.trycloudflare.com` **cambia cada vez**. Cloudflare no lo garantiza para producción, pero para probar entre amigos funciona | **SÍ → respaldo** (y la mejor para probar con 4 sin depender de nadie) |
| Koyeb – instancia gratis | Una por cuenta, 512 MB, 0,1 CPU, sólo Frankfurt o Washington. **Pide tarjeta** (cobra y devuelve 1 US$ de verificación; algunas fuentes dicen 29 US$) y se duerme tras 1 h sin tráfico | La tarjeta | No: el dueño no tiene tarjeta |
| Fly.io | **Ya no tiene plan gratis para cuentas nuevas** (solo una prueba corta: ~2 h o 7 días, y después pide tarjeta) | — | No |
| Cloudflare Workers + Durable Objects | Existe plan gratis con tope diario (~100 000 pedidos por día, y cada mensaje WebSocket entrante cuenta) | Habría que **reescribir el servidor** para ese sistema (no es el Node que usamos) y 4 jugadores mandando 30 mensajes por segundo gastan el tope en pocos minutos | No (por ahora) |
| Glitch | **Cerró** el alojamiento de apps el 8-jul-2025 | — | No |
| Replit | El plan gratis **no mantiene apps encendidas** ni sirve para un servidor de juego 24 h | — | No |

Fuentes consultadas: documentación de Render (render.com/docs/free y «Outbound Bandwidth»), páginas de precios de Fly.io y Koyeb,
documentación de Cloudflare (Durable Objects pricing/limits y Quick Tunnels) y las noticias del cierre de Glitch.

**Recomendación:** empezá con **Render Free** (se arma con clics y se actualiza solo). Si Render te pide tarjeta o falla, usá la **PC con cloudflared** (sección 8).

### ¿Cuánto internet gasta una partida?
Medido con 4 bots en el servidor real (ver sección 11): cada jugador recibe **≈ 16 KB por segundo** (comprimido; 37 KB/s sin comprimir; con hasta 27 criaturas a la vez, antes de optimizar eran ~115–190 KB/s).
Con 4 jugadores el servidor «sube» ≈ 65 KB/s ≈ **0,25 GB por hora de partida**. Con 100 GB al mes de Render alcanza para **unas 400 horas de partida**. Dormido no gasta nada.

## 3. Preparar todo (una sola vez)

Necesitás: una cuenta de **GitHub** (ya la tenés: ahí está el juego) y entrar a Render **con el botón «Sign in with GitHub»** (así no hace falta crear otra contraseña).

El repositorio ya trae listos estos archivos (no tenés que escribirlos):

| Archivo | Para qué sirve |
|---|---|
| `render.yaml` | Le dice a Render cómo armar el servidor (plan gratis, comando de arranque, chequeo de salud). |
| `Dockerfile` y `.dockerignore` | Alternativa para otros servicios (Koyeb, Fly, Railway…). No los necesitás en Render. |
| `Procfile` | Alternativa para servicios tipo Heroku. |
| `public/config.json` | **Acá se escribe la dirección del servidor** (sin tocar código). |
| `package.json` → `npm run servidor` | Arranca el servidor en tu PC. |

## 4. Paso a paso con Render (el servidor gratis)

> No tengo capturas de pantalla reales de Render (no puedo entrar a tu cuenta desde acá). Te dejo los **nombres exactos de los botones**
> como figuran hoy; si Render cambió algún texto, buscá el parecido.

1. Abrí **https://render.com** y tocá **Get Started** (arriba a la derecha).
2. Elegí **GitHub** (botón con el gato negro). Autorizá a Render. Si te pide tarjeta, **volvé a leer la nota de abajo**.
3. Ya adentro (se llama *Dashboard*), tocá el botón **+ New** (arriba a la derecha) → **Blueprint**.
4. Te lista tus repositorios. Si no ves `Shower-psico`, tocá **Configure account** y dale permiso a ese repositorio. Elegí `Shower-psico` → **Connect**.
5. **Rama (Branch):** elegí la rama donde está el juego (hoy `claude/larga-con-eso-s43nfe`; cuando se una a `main`, usá `main`).
6. Render lee `render.yaml` y te muestra el servicio **shower-psico-coop** (plan *Free*). Te pide completar una variable:
   * **ALLOWED_ORIGINS** → escribí `https://drmarianojimenez94-sudo.github.io` (sin barra al final, sin `/Shower-psico`).
     Es la «lista de invitados»: sólo esa página puede conectarse. (Si querés probar desde otras páginas, agregalas separadas por coma.)
7. Tocá **Apply** / **Deploy Blueprint**. Esperá 3–6 minutos: verás los registros (*Logs*) y al final **Your service is live**.
8. Arriba a la izquierda del servicio aparece su dirección, parecida a `https://shower-psico-coop.onrender.com`. **Copiala.**
9. Probá que vive: abrí en el navegador `https://shower-psico-coop.onrender.com/health`. Tiene que mostrar algo así:
   `{"ok":true,"proto":2,"salas":0,"jugadores":0,...}`.
   (Si tarda un minuto en mostrar algo, estaba dormido: es normal.)

> **Nota sobre la tarjeta:** la documentación de Render no exige tarjeta para el plan Free, pero no pude confirmar que el registro no la pida.
> Si te la exige, **no la pongas**: pasá directo a la sección 8 (PC con cloudflared), que es gratis de verdad.

### Decirle al juego dónde está el servidor
Hay tres formas; la primera es la que conviene:

1. **Para todos los que juegan desde GitHub Pages:** editá el archivo `public/config.json` y poné tu dirección:
   ```json
   { "servidor": "https://shower-psico-coop.onrender.com" }
   ```
   (En GitHub: abrí el archivo → ícono del lápiz → cambiá → **Commit changes**.) En 1–2 minutos Pages se actualiza solo.
2. **Cada jugador por su cuenta:** menú → **Opciones › Cooperativo › Servidor**, pegar la dirección y tocar **Probar conexión**.
3. **Dentro de un enlace:** agregando `?server=https://shower-psico-coop.onrender.com` a la dirección del juego.

El mensaje de la pantalla Cooperativo te dice en qué estado está:
* **Servidor encendido** (verde): listo.
* **Servidor dormido (puede tardar 30 a 60 segundos en despertar)** (amarillo): el juego lo «toca» solo para despertarlo; esperá a que cambie a verde.
* **Sin conexión con el servidor** (rojo): la dirección está mal escrita, el servidor está apagado o no hay internet.

## 5. Cómo probarlo

### Con 1 persona (dos pestañas)
1. Abrí el juego en una pestaña → **Cooperativo** → **Crear sala**. Aparece el código (ejemplo `K7MQ`) y la lista de jugadores.
2. Tocá **Invitar amigos (copiar enlace)**.
3. Abrí **otra pestaña** (mejor una ventana privada, para que no comparta datos) y pegá el enlace: entra sola a la sala.
4. En la pestaña 2 tocá **Estoy listo**; en la pestaña 1 tocá **Empezar la partida**. Cuenta regresiva de 3 s y entran los dos a la vez.
5. Mirá arriba a la derecha: dice `Sala K7MQ · 45 ms` y los dos jugadores con su vida.

### Con 2 personas
Igual, pero el enlace se lo mandás por WhatsApp. La segunda persona sólo abre el enlace, elige su Huésped y modo, y toca **Estoy listo**.

### Con 4 personas
Igual: hasta 4 en la lista (la quinta persona recibe «La sala está llena»). Cada uno elige su **Huésped** (sólo aparecen los que ya compró) y su **modo**
(*Shooter* o *Melé*). El anfitrión empieza cuando todos estén listos. Se puede entrar con la partida ya empezada (si hay lugar).

### Para simular internet lento (sin salir de casa)
Agregá `&lag=200` al enlace: el juego se comporta como con 200 ms de ida y vuelta.

## 6. Cómo saber si el servidor está dormido
* En la pantalla **Cooperativo** el cartel de arriba lo dice con colores (verde / amarillo / rojo).
* O abrí `https://TU-SERVIDOR/health`: si tarda ~1 minuto y luego muestra `{"ok":true...}`, estaba dormido.
* En el panel de Render, el servicio dice **Spun down** (dormido) o **Live** (despierto).
* Para que **no** se duerma justo antes de jugar: abrí `/health` cinco minutos antes. Mientras haya gente jugando no se duerme.

## 7. Ver los registros (logs) y apagarlo
* **Logs:** en Render → tu servicio → pestaña **Logs**. Vas a ver líneas como `sala K7MQ creada`, `sala K7MQ: empezó con 4 jugador(es)`,
  `un jugador perdió la conexión`. **No se guardan nombres, ni direcciones IP, ni mensajes**: sólo códigos de sala y contadores.
* **Apagarlo temporalmente:** Render → tu servicio → **Settings** → **Suspend Service** (se vuelve a prender con **Resume**).
* **Borrarlo del todo:** Settings → bajá hasta el final → **Delete Service**.
* **PC casera:** en la ventana donde corre, apretá `Ctrl + C`: avisa a los jugadores y se cierra con cuidado.

## 8. Plan B: tu propia PC + túnel de Cloudflare (gratis, sin tarjeta, sin cuenta)

Sirve para probar con amigos **hoy mismo**. Tu PC hace de servidor y `cloudflared` le da una dirección pública temporal.

1. Instalá Node.js 20 o más nuevo (https://nodejs.org) y bajá el proyecto (`git clone` o «Download ZIP»). En la carpeta: `npm ci`.
2. Abrí una terminal en la carpeta y escribí: `npm run servidor`. Debe decir «Servidor cooperativo listo en el puerto 8080».
3. Instalá **cloudflared** (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ — en Windows `winget install Cloudflare.cloudflared`).
4. En **otra** terminal: `cloudflared tunnel --url http://localhost:8080`
5. Después de unos segundos imprime una dirección `https://palabras-raras.trycloudflare.com`. **Esa es tu dirección del servidor.**
6. Abrí esa misma dirección en tu navegador: **es el juego completo** (el servidor también sirve el juego), no hace falta GitHub Pages.
   Los amigos abren el enlace de invitación que te da la pantalla de sala (ya incluye esa dirección).
7. Para apagarlo: `Ctrl + C` en las dos terminales. La próxima vez la dirección será otra.

Si querés que los amigos usen la web de GitHub Pages con tu PC: en Opciones › Cooperativo pegá la dirección `trycloudflare`, o usá
`https://drmarianojimenez94-sudo.github.io/Shower-psico/?server=https://palabras-raras.trycloudflare.com`
(y arrancá el servidor con `ALLOWED_ORIGINS=https://drmarianojimenez94-sudo.github.io npm run servidor` — en Windows PowerShell: `$env:ALLOWED_ORIGINS="https://drmarianojimenez94-sudo.github.io"; npm run servidor`).

## 9. Seguridad y límites (qué protege al servidor)
* **Lista de invitados** (`ALLOWED_ORIGINS`): sólo las páginas permitidas pueden conectarse por navegador.
* **Tope de salas** (`MAX_SALAS`, 20 por defecto; en `render.yaml` 10) y de **conexiones por red** (`MAX_POR_IP`, 8).
* **Velocidad de mensajes** limitada por conexión; mensajes de **máximo 8 KB**; todo lo que manda un jugador se **limpia** (nombre, equipo, árboles, mapa…); no hay `eval`.
* El servidor **no expone archivos fuera de `public/`, `src/` y `assets/`** (se prueba contra `../`). Con `SERVIR_JUEGO=0` ni siquiera sirve el juego.
* `registros/`, `jugadores/` y `escritorio/bin/` están en `.gitignore` y `.dockerignore`: no se suben.
* **Límite honesto:** el servidor decide TODO lo que pasa en la partida (daño, botín, muertes). Pero **no puede saber qué compró cada jugador**:
  si alguien edita su navegador y dice que tiene un equipo de nivel máximo, el servidor sólo comprueba que ese equipo *exista* y lo acota (reglas de `items.js`, `progresion.js`).
  Para jugar entre amigos es suficiente; para un juego público haría falta cuentas.
* Cierre limpio: al recibir la orden de apagado, el servidor avisa a los jugadores y cierra. Si una sala falla, se cierra sola sin tirar el servidor.

### Variables (todas opcionales)
| Variable | Qué hace | Por defecto |
|---|---|---|
| `PORT` | Puerto (Render lo pone solo) | 8080 |
| `HOST` | Dirección de escucha | 0.0.0.0 |
| `ALLOWED_ORIGINS` | Páginas permitidas, separadas por coma | cualquiera |
| `MAX_SALAS` / `MAX_POR_IP` | Topes | 20 / 8 |
| `RECONEXION_MS` | Cuánto se le guarda el lugar a quien se corta | 45000 |
| `SERVIR_JUEGO=0` | No servir los archivos del juego | sirve |
| `TRUST_PROXY=1` | Detrás de Render/cloudflared (usa la IP real para los topes) | apagado |

## 10. Qué hace el servidor con 4 jugadores
* **Sala de espera (lobby):** cada uno ve a los demás con su nombre, **Huésped** (sólo los que ya compró), **modo** (Shooter/Melé) y si está **listo**. Sólo el anfitrión elige mapa y empieza; cambiar de mapa saca los «listo». Cuenta regresiva de 3 s: todos arrancan a la vez.
* **Se corta la conexión (Wi-Fi, túnel):** el juego muestra «reconectando…», el servidor le **guarda el lugar 45 s** y al volver recupera el mismo jugador. También sirve si se **recarga la página** (la dirección ya trae `?sala=…`).
* **Alguien se va a propósito:** su personaje desaparece y la partida sigue con los demás.
* **Si todos caen** hay derrota; un compañero cerca te reanima en 3 s (el Soporte, el doble de rápido). Al empezar cada oleada, los caídos reviven.
* **Balance:** a más jugadores, más criaturas (+60 % de presupuesto por jugador extra, tope de 74 a la vez) y jefes con +70 % de vida por jugador extra.
* **Todo corre en el servidor:** eventos de oleada, arenas vivas, nieblas, flora, fauna, bendiciones, maestría, equipo, árbol de progresión y modo Combo/Melé.
* **Botín y progreso:** al terminar la partida el servidor le manda a **cada jugador su propia mochila** (lo que recogió él) y cada navegador la guarda **en su propio perfil local** junto con núcleos, esencias y maestría. Si alguien se va antes, conserva lo que ya había visto caer en su pantalla.
* **Red:** 60 pasos de simulación por segundo, 20 snapshots por segundo, **sólo se manda lo que cambió** (≈ 75 % menos) y se comprime. El jugador local se dibuja casi sin retraso (predicción simple) y los demás se interpolan 110 ms atrás.

## 11. Qué se probó y qué no
Automático (`npm run coop:test`, `npm run coop:navegador`):
* **4 clientes bot por WebSocket** reales contra el servidor real, **dos de ellos con 200 ms de latencia simulada**, jugando hasta la **oleada 4** (≈ 10 min de juego, hasta 27 criaturas a la vez):
  sin errores, sin desincronización (los snapshots de los clientes son idénticos en el mismo tick), con un **corte brusco** de uno (volvió a su mismo jugador) y la **salida** de otro (la partida siguió con 3).
* Delta de snapshots: reconstruye **exactamente** el snapshot completo en 1 333 snapshots.
* Lobby (crear, unirse con minúsculas, elegir Huésped/modo, listo, sólo el anfitrión empieza, cuenta regresiva), errores (versión distinta, sala inexistente, sala llena, mensajes basura), fin de partida con botín por jugador y «otra vez» → lobby.
* **Navegadores reales (Chromium por software):** 2 clientes, uno entra por el **enlace de invitación** con `lag=200`, otro prueba una sala inexistente, **recarga en plena partida** y vuelve al mismo jugador, y un servidor inválido muestra «Sin conexión».

**NO pude probar:** el despliegue real en Render (necesita tu cuenta), internet real (todo fue en la misma máquina, con latencia simulada, no con pérdida de paquetes ni cortes de operadora),
el túnel `cloudflared` real, un iPhone o Android real (sí los navegadores emulados), ni más de 2 navegadores reales a la vez (la máquina es lenta; los 4 jugadores se probaron con bots).
La comprensión del texto de los pasos de Render no se pudo verificar con capturas.

## 12. Problemas comunes
| Veo… | Qué hacer |
|---|---|
| «Servidor dormido» que no cambia | Esperá hasta 90 s; si sigue, abrí `https://TU-SERVIDOR/health` y mirá el panel de Render (Logs). |
| «Sin conexión con el servidor» | ¿La dirección empieza con `https://`? ¿`ALLOWED_ORIGINS` tiene tu página exacta (sin `/Shower-psico` ni barra final)? |
| «Tu juego y el servidor son de versiones distintas» | Recargá con Ctrl+F5 (o borrá la caché del navegador). Pasa cuando se actualiza el juego o el servidor. |
| «Esa sala no existe» | Revisá el código (sin 0/O/1/I) o creá otra: las salas vacías se borran. |
| «La sala está llena» | Ya hay 4 jugadores. |
| Va con tirones | Mirá el ping arriba a la derecha. Más de 250 ms: usar un servidor más cercano (Render deja elegir región al crear a mano: *Frankfurt*, *Ohio*, *Oregon*, *Singapore*…). |
| Se acabaron las horas del mes | Render suspende los servicios Free hasta el mes siguiente; usá el plan B (sección 8). |
