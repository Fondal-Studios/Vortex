// PRÓLOGO «LA ESTACIÓN» — CINEMÁTICA 3D realista (no se camina, no se dispara, no hay objetivos).
// El «director» maneja la cámara (planos, travelling, órbita, rack focus, cortes). La ÚNICA libertad del jugador: mirar alrededor
// (ratón / arrastre táctil) desde que el tren entra en la estación y el protagonista está en la vía, hasta el impacto.
// Después del impacto: blanco → negro breve → onDone() y el juego sigue con el despertar psicodélico en el Vórtice (WAKE).
//
//   const P = startPrologue({ THREE, renderer, host, touch, onDone, onSkip, sound, manual });
//   await P.ready;          // personas con rig cargadas
//   P.tick(dt)  // avanza el tiempo del director y dibuja     P.step(dt)  // sólo lógica     P.seek(t)  // salta (determinista)
//   P.stop()    // limpia todo
//
// Dibuja con el WebGLRenderer del juego (renderer.gl) pero con su propia escena/cámara. Calidad Media/Alta: bloom + grading (+ foco selectivo y sombras en Alta).
import { Subtitles, PROLOGO as TXT } from './story.js';
import { buildStation, ST } from './env/estacion.js';
import { loadHumanKit, createHuman, disposeHumanKit } from './humans.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** Hitos de la cinemática (segundos). */
export const BEATS = { FREE0: 28.3, IMPACT: 35.0, WHITE_END: 36.3, BLACK_END: 38.4 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const L3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const PI = Math.PI;

const CSS = `
#pg-ui{position:fixed;inset:0;z-index:7;pointer-events:none;color:#fff;font-family:inherit}
#pg-skip{pointer-events:auto;position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px;background:rgba(0,0,0,.35);color:#cfd6da;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer;opacity:.7}
#pg-skip:hover{opacity:1;background:rgba(30,40,46,.8)}
#pg-fade{position:absolute;inset:0;background:#000;opacity:1}
#pg-vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.55) 100%)}
#pg-look{position:absolute;left:50%;top:calc(14px + env(safe-area-inset-top));transform:translateX(-50%);font-size:13px;letter-spacing:.12em;color:#e6ecef;text-shadow:0 0 6px #000;opacity:0;transition:opacity .6s}
#pg-look.on{opacity:.8}
#pg-bars{position:absolute;inset:0;border-top:5.2vh solid #000;border-bottom:5.2vh solid #000;box-sizing:border-box}
body.prologo-on #sub{background:rgba(0,0,0,.45);padding:.3em .8em;border-radius:10px;width:fit-content;max-width:84%;margin:0 auto;bottom:calc(9% + env(safe-area-inset-bottom))}
`;

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmt: { value: 1 }, uShake: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAmt, uShake; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d); vec2 ca = d * (0.0016 + uShake * 0.01) * (0.4 + r2 * 3.0);
      vec3 c = vec3(texture2D(tDiffuse, vUv + ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ca).b);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 0.92);                                     // algo menos saturado: se siente fotografía
      c = mix(c * vec3(0.96, 1.0, 1.03), c * vec3(1.05, 1.0, 0.94), smoothstep(0.2, 0.9, l)); // sombras frías, luces cálidas
      c = (c - 0.5) * 1.06 + 0.5;
      c *= 1.0 - smoothstep(0.18, 0.62, r2) * 0.5 * uAmt;           // viñeta
      c += (h(vUv * 1.7 + uTime) - 0.5) * 0.035 * uAmt;             // grano
      gl_FragColor = vec4(max(c, 0.0), 1.0); }`,
};

export function startPrologue({ THREE: T, renderer, host = 'axioma', touch = false, onDone = () => {}, onSkip = () => {}, sound = null, manual = false, nolock = false, quality = null } = {}) {
  const gl = renderer.gl || renderer, canvas = gl.domElement, level = quality || renderer.level || 'low', hi = level === 'high', post = level !== 'low';
  let finished = false, stopped = false, raf = 0, lastNow = performance.now(), T_ = 0, readyOk = false, quiet = false;
  const saved = { exposure: gl.toneMappingExposure, tone: gl.toneMapping, shadow: gl.shadowMap.enabled, shadowType: gl.shadowMap.type, autoClear: gl.autoClear };

  /* ───────── escena, entorno, cámara ───────── */
  const scene = new T.Scene(); scene.background = new T.Color(0x07090a); scene.fog = new T.FogExp2(0x0d1113, 0.012);
  const camera = new T.PerspectiveCamera(42, 1, 0.05, 260); scene.add(camera);
  gl.toneMapping = T.ACESFilmicToneMapping; gl.toneMappingExposure = 0.95;
  { const pm = new T.PMREMGenerator(gl), env = pm.fromScene(new RoomEnvironment(), 0.04); scene.environment = env.texture; scene.environmentIntensity = 0.42; pm.dispose(); scene.userData.env = env; }
  const st = buildStation(T, { level }); scene.add(st.group);
  // luz de ayuda pegada a la cámara (da volumen a las caras en los primeros planos); su intensidad la fija el director
  const key = new T.SpotLight(0xfff0e0, 0, 14, 0.7, 0.8, 1.6); key.position.set(0.5, 0.6, 0.2); key.target.position.set(0, 0, -4); camera.add(key, key.target);
  if (hi) { // sombra real de las personas y columnas (sólo Alta)
    gl.shadowMap.enabled = true; gl.shadowMap.type = T.PCFSoftShadowMap;
    const sun = new T.SpotLight(0xf4fff0, 90, 26, 0.9, 0.7, 1.2); sun.position.set(3, 5.0, 2.8); sun.target.position.set(3, 0, 1.6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03; sun.shadow.camera.near = 1; sun.shadow.camera.far = 14;
    scene.add(sun, sun.target); st.floorMesh && (st.floorMesh.receiveShadow = true);
  }
  // sombras «de contacto» baratas bajo cada persona (en Baja y Media)
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  const blobMat = new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const blobGeo = new T.PlaneGeometry(1, 1); blobGeo.rotateX(-PI / 2);

  /* ───────── composición (post) ───────── */
  let composer = null, bloom = null, bokeh = null, grade = null;
  if (post) {
    composer = new EffectComposer(gl); composer.addPass(new RenderPass(scene, camera));
    if (hi) { bokeh = new BokehPass(scene, camera, { focus: 4, aperture: 0.00018, maxblur: 0.012 }); composer.addPass(bokeh); }
    bloom = new UnrealBloomPass(new T.Vector2(256, 256), 0.32, 0.7, 0.82); composer.addPass(bloom);
    composer.addPass(new OutputPass()); grade = new ShaderPass(GRADE); composer.addPass(grade);
  }

  /* ───────── interfaz: sólo «Saltar», pista mínima de mirar, viñeta (Baja), bandas y fundidos ───────── */
  const styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl);
  const ui = document.createElement('div'); ui.id = 'pg-ui';
  ui.innerHTML = `${post ? '' : '<div id="pg-vig"></div>'}<div id="pg-bars"></div><div id="pg-look">${touch ? 'ARRASTRÁ PARA MIRAR' : 'MIRÁ ALREDEDOR'}</div><button id="pg-skip" type="button">Saltar ⏭</button><div id="pg-fade"></div>`;
  document.body.appendChild(ui); document.body.classList.add('prologo-on');
  const elFade = ui.querySelector('#pg-fade'), elLook = ui.querySelector('#pg-look'), elSkip = ui.querySelector('#pg-skip');
  const subsEl = document.getElementById('sub') || (() => { const d = document.createElement('div'); d.id = 'sub'; document.body.appendChild(d); return d; })();
  const subs = new Subtitles(subsEl, sound);

  /* ───────── personas con rig (reutiliza la fábrica de ARCANUM: src/client/humans.js) ───────── */
  let kit = null; const H = {}; // P protagonista · V la que cae · B1 apurado · B2/B3 público
  const SPECS = {
    P: { preset: 'pasajero', name: 'Pasajero', color: 0x35435c, weapon: null, coat: 0x6f7f9a },
    V: { seed: 'mujer-abrigo-rojo', name: 'Mujer', color: 0xb02a36, weapon: null, coat: 0xc23a48 },
    B1: { seed: 'ejecutivo-apurado', name: 'Ejecutivo', color: 0x39414c, weapon: null, coat: 0x55606e },
    B2: { seed: 'senora-gris', name: 'Senora', color: 0x6a6f78, weapon: null, coat: 0x9a8f80 },
    B3: { seed: 'chico-gorra', name: 'Chico', color: 0x4a6a58, weapon: null, coat: 0x6a8a74 },
  };
  /** Gente común: sin cristales de acento (la fábrica los trae para el juego) y con ropa de color creíble. */
  function realistic(h) {
    h.object.traverse((n) => {
      if (!(n.isMesh || n.isSkinnedMesh)) return;
      if (/cristal$/.test(n.name)) { n.visible = false; return; }
      if (h.coat != null && /^npc-/.test(n.name) && !/body|Eyes|eyebrow|shoes|short|long|bob|ponytail/i.test(n.name) && n.material && n.material.color) { n.material = n.material.clone(); n.material.color.setHex(h.coat); }
    });
  }
  const readyP = (async () => {
    kit = await loadHumanKit({ quality: level === 'low' ? 'low' : level, movil: level === 'low' });
    for (const k of Object.keys(SPECS)) { const h = createHuman(kit, SPECS[k]); h.cur = ''; h.coat = SPECS[k].coat; scene.add(h.object); if (hi) h.object.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      if (!hi) { const b = new T.Mesh(blobGeo, blobMat); b.scale.set(0.9, 1, 0.9); b.position.y = 0.012; h.object.add(b); h.blob = b; } H[k] = h; }
    await Promise.all(Object.values(H).map((h) => h.ready));
    for (const h of Object.values(H)) realistic(h);
    for (const h of Object.values(H)) { h.play('idle'); h.update(0.01, { camera }); }
    readyOk = true;
  })();

  /* ───────── audio sintético (WebAudio) ───────── */
  const amb = (() => {
    if (!sound || !sound.ctx) return null;
    const c = sound.ctx, out = c.createGain(); out.gain.value = 0; out.connect(sound.sfxBus || c.destination); out.gain.setTargetAtTime(1, c.currentTime, 0.6);
    const lp = (f) => { const b = c.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; return b; };
    const hum = c.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 100; const humF = lp(380), humG = c.createGain(); humG.gain.value = 0.035; hum.connect(humF); humF.connect(humG); humG.connect(out); hum.start();
    const room = c.createBufferSource(); room.buffer = sound.noiseBuf; room.loop = true; const roomF = lp(500), roomG = c.createGain(); roomG.gain.value = 0.05; room.connect(roomF); roomF.connect(roomG); roomG.connect(out); room.start();
    const nz = c.createBufferSource(); nz.buffer = sound.noiseBuf; nz.loop = true; const nzF = lp(90), nzG = c.createGain(); nzG.gain.value = 0; nz.connect(nzF); nzF.connect(nzG); nzG.connect(out); nz.start();
    return {
      set(prox, mute) { const t = c.currentTime; nzG.gain.setTargetAtTime(prox * 1.1 * (1 - mute), t, 0.12); nzF.frequency.setTargetAtTime(90 + prox * 1300, t, 0.15); humG.gain.setTargetAtTime(0.035 * (1 - mute), t, 0.1); roomG.gain.setTargetAtTime(0.05 * (1 - mute), t, 0.1); },
      stop() { try { out.gain.setTargetAtTime(0, c.currentTime, 0.1); setTimeout(() => { for (const n of [hum, room, nz]) { try { n.stop(); } catch { /* ya parado */ } } try { out.disconnect(); } catch { /* ok */ } }, 500); } catch { /* ok */ } },
    };
  })();
  const sfx = (fn) => { if (quiet || !sound) return; try { fn(sound); } catch { /* sin audio */ } };
  const EVENTS = [
    [13.3, (s) => { s.tone({ f: 659, type: 'sine', dur: 0.7, vol: 0.3, att: 0.01 }); s.tone({ f: 523, type: 'sine', dur: 1.0, vol: 0.3, att: 0.01, delay: 0.45 }); s.noise({ dur: 1.6, vol: 0.05, freq: 3000, type: 'bandpass', delay: 1.1 }); }], // anuncio por altavoz
    [22.25, (s) => { s.thump(110, 50, 0.2, 0.5); }],                                                                                // golpe/empujón
    [23.9, (s) => { s.tone({ f: 900, f2: 500, type: 'sawtooth', dur: 0.9, vol: 0.16, att: 0.02 }); s.noise({ dur: 0.5, vol: 0.12, freq: 2200, type: 'bandpass' }); }],  // grito
    [24.6, (s) => { s.thump(90, 38, 0.3, 0.7); s.noise({ dur: 0.25, vol: 0.25, freq: 900 }); }],                                      // cae sobre la vía
    [28.4, (s) => { s.tone({ f: 311, type: 'sawtooth', dur: 1.6, vol: 0.22, att: 0.03 }); s.tone({ f: 392, type: 'sawtooth', dur: 1.6, vol: 0.22, att: 0.03 }); }], // bocina
    [31.6, (s) => { s.tone({ f: 311, type: 'sawtooth', dur: 2.2, vol: 0.3, att: 0.03 }); s.tone({ f: 392, type: 'sawtooth', dur: 2.2, vol: 0.3, att: 0.03 }); s.noise({ dur: 3, vol: 0.18, freq: 1800, type: 'bandpass' }); }],
    [BEATS.IMPACT, (s) => { s.thump(60, 22, 1.2, 1.0); s.noise({ dur: 1.0, vol: 0.7, freq: 4000, freq2: 100 }); }],
    [36.9, (s) => { s.heartbeat(); }],
  ];
  const fired = new Set();
  const CUES = [[1.0, TXT.cine.titulo], [7.0, TXT.cine.auriculares], [13.2, TXT.cine.anuncio], [17.6, TXT.cine.pies], [23.1, TXT.cine.grito], [25.3, TXT.cine.nopense], [29.2, TXT.cine.ella], [32.5, TXT.cine.frenaba]];
  let cueI = 0;

  /* ───────── mundo: todo es función del tiempo T (determinista) ───────── */
  const place = (h, p, ry) => { h.object.position.set(p[0], p[1], p[2]); h.object.rotation.y = ry; };
  const setClip = (h, name, opt) => { if (h.cur !== name) { h.cur = name; h.play(name, opt); } };
  const trainX = (t) => (t < BEATS.FREE0 ? -62 - 14 * (BEATS.FREE0 - t) : -62 + 6 * (t - BEATS.FREE0) + 0.47 * (t - BEATS.FREE0) ** 2); // llega a x≈-0,7 justo en el impacto
  const X_P0 = [6.0, 0, 1.8], X_EDGE = [1.9, 0, 0.9], X_LAND = [1.5, -1.25, -1.5], X_V = [1.0, 0, 0.9];
  const poseP = (t) => { // protagonista
    if (t < 25.6) return { p: X_P0, ry: PI, clip: 'idle', speed: 0 };
    if (t < 26.9) { const u = (t - 25.6) / 1.3, p = L3(X_P0, X_EDGE, sm(u * 0.9 + 0.1 * u)); return { p, ry: Math.atan2(X_EDGE[0] - X_P0[0], X_EDGE[2] - X_P0[2]), clip: 'jog', speed: 3.4 }; }
    const u = clamp((t - 26.9) / 1.4, 0, 1), p = L3(X_EDGE, X_LAND, u); p[1] = lerp(0, X_LAND[1], u * u) + 0.55 * Math.sin(PI * clamp(u * 1.3, 0, 1));
    return { p, ry: PI, clip: t < 28.3 ? 'jump' : 'interact', speed: 0 };
  };
  const poseV = (t) => { // la que cae (la empuja el apuro de otro pasajero)
    if (t < 22.2) return { p: X_V, ry: PI, clip: 'idle' };
    if (t < 23.3) { const u = sm((t - 22.2) / 1.1); return { p: [1.0, 0, lerp(0.9, 0.42, u)], ry: PI + 0.2 * u, clip: 'hit' }; }
    if (t < 24.7) { const u = (t - 23.3) / 1.4, ez = u < 0.35 ? 0.42 - 0.2 * (u / 0.35) : 0.22 - 2.2 * ((u - 0.35) / 0.65); return { p: [1.0 - 0.1 * u, u < 0.4 ? 0 : -1.15 * sm((u - 0.4) / 0.6), ez], ry: PI + 0.3, clip: 'fall', tilt: sm(u) * 1.5 }; }
    return { p: [0.9, -1.1, -2.3], ry: PI + 0.3, clip: 'death', tilt: 1.5 };
  };
  const poseB1 = (t) => (t < 18.2 ? { p: [15.5, 0, 3.4], ry: -PI / 2, clip: 'idle', speed: 0 } : { p: [15.5 - 3.5 * (t - 18.2), 0, 3.4 - 1.9 * sm((t - 18.2) / 3.9)], ry: -PI / 2, clip: 'walk', speed: 3.5 });
  const poseB2 = () => ({ p: [-5, 0, 1.3], ry: PI, clip: 'idle', speed: 0 });
  const poseB3 = () => ({ p: [10.4, 0, 3.6], ry: PI * 0.8, clip: 'idle', speed: 0 });

  /* ───────── dirección de cámara: planos de la cinemática ───────── */
  const free = { yaw: 0, pitch: 0, in: { x: 0, y: 0 } }; let focusD = 6, keyI = 0, shake = 0;
  function shot(t) {
    let p, tg, fov = 40, f = null, k = 0, id = 0;
    const Pp = poseP(t).p, Vp = poseV(t).p;
    if (t < 6.5) { const u = sm(t / 6.5); id = 1; p = L3([17.5, 1.55, 2.6], [11.8, 1.5, 3.0], u); tg = L3([3, 1.45, 1.6], [2.2, 1.5, 1.3], u); fov = 42; }                        // 1 · plano general, travelling lento
    else if (t < 12.5) { const u = (t - 6.5) / 6, a = lerp(0.45, 2.55, sm(u)), r = lerp(2.9, 2.1, u); id = 2; p = [X_P0[0] + Math.sin(a) * r, lerp(1.45, 1.7, u), X_P0[2] + Math.cos(a) * r]; tg = [X_P0[0], 1.55, X_P0[2]]; fov = 32; f = tg; k = 9; } // 2 · órbita al protagonista (rack focus)
    else if (t < 17) { const u = sm((t - 12.5) / 4.5); id = 3; p = L3([1.8, 2.5, 3.0], [0.9, 2.55, 4.4], u); tg = [0, 2.6, 6.9]; fov = 36; }                                               // 3 · la pantalla de horarios
    else if (t < 21.5) { const u = (t - 17) / 4.5; id = 4; p = L3([11.5, 1.1, -0.5], [10.5, 1.25, -0.6], u); tg = [-24, 1.3 + 0.25 * u, -2.6]; fov = 24; }                                          // 4 · el túnel (teleobjetivo)
    else if (t < 25.2) { const u = sm((t - 21.5) / 3.7); id = 5; p = L3([5.2, 1.45, -1.0], [3.9, 1.4, -0.7], u); tg = [lerp(2.6, Vp[0], 0.7), Math.max(Vp[1] + 1.0, 0.3), lerp(1.2, Vp[2], 0.7)]; fov = 38; f = tg; k = 5; }                        // 5 · ella, y el empujón
    else if (t < 26.0) { id = 6; p = [6.5, 1.66, 0.4]; tg = [Pp[0], 1.62, Pp[2]]; fov = 28; f = tg; k = 14; }                                                                                // 6 · reacción del protagonista
    else if (t < BEATS.FREE0) { id = 7; p = [Pp[0] + 2.3, Pp[1] + 0.5, Pp[2] + 2.0]; tg = [Pp[0], Pp[1] + 1.1, Pp[2]]; fov = 44; }                                                         // 7 · corre y salta (seguimiento)
    else { // 8 · primera persona en la vía: LA ÚNICA ventana de cámara libre
      id = 8; const u = clamp((t - BEATS.FREE0) / (BEATS.IMPACT - BEATS.FREE0), 0, 1);
      p = [X_LAND[0], X_LAND[1] + 1.55 + 0.05 * Math.sin(t * 1.3) - 0.12 * u, X_LAND[2]]; tg = [-30, 0.6 + 0.25 * u, -2.7]; fov = lerp(64, 52, u * u); k = 0; shake = 0.012 * sm((u - 0.5) * 2) + 0.003; f = [X_V[0] - 0.1, -1.0, -2.3]; }
    return { p, tg, fov, f, k, id };
  }

  /* ───────── actualización por paso ───────── */
  const tmp = new T.Vector3(), q0 = new T.Quaternion(), look = new T.Matrix4();
  function worldAt(t, dt) {
    const defs = { P: poseP(t), V: poseV(t), B1: poseB1(t), B2: poseB2(t), B3: poseB3(t) };
    for (const kk of Object.keys(H)) {
      const h = H[kk], d = defs[kk]; place(h, d.p, d.ry); setClip(h, d.clip, d.clip === 'fall' || d.clip === 'death' || d.clip === 'hit' || d.clip === 'jump' ? { restart: true } : undefined);
      h.update(dt, { speed: d.speed || 0, camera }); h.object.rotation.x = d.tilt ? -d.tilt : 0; if (h.blob) h.blob.visible = d.p[1] > -0.3;
    }
    H.P.object.visible = t < BEATS.FREE0 + 0.01;
    // tren y entorno
    const tx = trainX(t), tr = st.train; tr.group.position.x = tx; tr.group.visible = t >= 25.5 && t < BEATS.IMPACT + 0.2;
    const near = clamp(1 - Math.abs(tx - X_LAND[0]) / 60, 0, 1);
    for (const g of tr.glare) g.scale.setScalar(lerp(1.6, 7, near)); tr.beamMat.opacity = 0.04 + 0.05 * near; tr.spot.intensity = 500 + 600 * near;
    const glow = sm((t - 17.5) / 4) * (t < 25.5 ? 1 : 0.0);
    st.update({ t, flick: t > 15 ? 0.7 : 0.18, trainX: t > 17 ? Math.max(tx, -60 + (t - 17) * 4) : -999, tunnelGlow: glow, dark: sm((t - 35) * 8) });
    st.setScreen(t >= 13.2 ? 'alerta' : 'normal', t);
    // fundidos: negro inicial → (todo claro) → blanco del impacto → blanco que se apaga a negro
    const IM = BEATS.IMPACT; let fa = 0, fc = '#000';
    if (t < 1.4) fa = 1 - sm(t / 1.4);
    else if (t >= IM - 0.12 && t < BEATS.WHITE_END) { fc = '#fff'; fa = clamp((t - (IM - 0.12)) / 0.12, 0, 1); }
    else if (t >= BEATS.WHITE_END) { const u = sm((t - BEATS.WHITE_END) / 1.0), g = Math.round(255 * (1 - u)); fc = `rgb(${g},${g},${g})`; fa = 1; }
    elFade.style.background = fc; elFade.style.opacity = String(fa);
    elLook.classList.toggle('on', t >= BEATS.FREE0 + 0.8 && t < BEATS.FREE0 + 5);
  }

  function step(dt, inp) {
    if (finished || stopped || !readyOk) return;
    T_ += dt; const t = T_;
    // eventos y subtítulos por tiempo
    for (const [te, fn] of EVENTS) if (t >= te && !fired.has(te)) { fired.add(te); sfx(fn); }
    while (cueI < CUES.length && t >= CUES[cueI][0]) { subs.play(CUES[cueI][1].map((l) => l.slice())); cueI++; }
    subs.update(dt);
    // cámara libre: SÓLO entre la entrada del tren (primera persona en la vía) y el impacto
    const win = t >= BEATS.FREE0 && t < BEATS.IMPACT;
    if (win && inp) { free.yaw = clamp(free.yaw - inp.dyaw, -2.4, 2.4); free.pitch = clamp(free.pitch + inp.dpitch, -1.1, 1.1); }
    if (t >= BEATS.IMPACT - 0.6) { free.yaw *= Math.max(0, 1 - dt * 3); free.pitch *= Math.max(0, 1 - dt * 3); } // el golpe te gira de frente al tren
    worldAt(t, dt);
    const s = shot(t); keyI = lerp(keyI, s.k, Math.min(1, dt * 6)); key.intensity = keyI; camera.fov = s.fov; focusD = s.f ? Math.hypot(s.f[0] - s.p[0], s.f[1] - s.p[1], s.f[2] - s.p[2]) : 30;
    const hh = shake + (s.id === 1 ? 0.002 : 0.0035), n1 = Math.sin(t * 7.3) + Math.sin(t * 13.1 + 1), n2 = Math.sin(t * 6.1 + 2) + Math.sin(t * 11.7);
    camera.position.set(s.p[0] + n1 * hh * 0.4, s.p[1] + n2 * hh * 0.4, s.p[2]); camera.lookAt(s.tg[0], s.tg[1], s.tg[2]);
    if (win || t >= BEATS.IMPACT - 0.6) { camera.rotateY(free.yaw); camera.rotateX(free.pitch); }
    camera.rotateZ(Math.sin(t * 0.9) * 0.002 + (t > BEATS.IMPACT - 1.2 ? Math.sin(t * 55) * 0.01 * sm((t - (BEATS.IMPACT - 1.2)) / 1.2) : 0));
    if (amb) amb.set(sm((t - 17) / 12) * (t < BEATS.IMPACT ? 1 : 0), t >= BEATS.IMPACT ? 1 : 0);
    if (t >= BEATS.BLACK_END) done();
  }

  /* ───────── entrada del jugador (sólo cuenta en la ventana de cámara libre) ───────── */
  const acc = { dyaw: 0, dpitch: 0 }; let drag = null;
  const onMove = (e) => { if (document.pointerLockElement || nolock) { acc.dyaw += (e.movementX || 0) * 0.0022; acc.dpitch += -(e.movementY || 0) * 0.0022; } };
  const onPDown = (e) => { if (e.target.closest && e.target.closest('#pg-skip')) return; drag = { x: e.clientX, y: e.clientY }; };
  const onPMove = (e) => { if (drag && !document.pointerLockElement && e.pointerType !== 'mouse') { acc.dyaw += (e.clientX - drag.x) * 0.006; acc.dpitch += -(e.clientY - drag.y) * 0.006; drag = { x: e.clientX, y: e.clientY }; } else if (drag && e.buttons && e.pointerType === 'mouse' && !document.pointerLockElement) { acc.dyaw += (e.clientX - drag.x) * 0.004; acc.dpitch += -(e.clientY - drag.y) * 0.004; drag = { x: e.clientX, y: e.clientY }; } };
  const onPUp = () => { drag = null; };
  const onKey = (e) => { if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) skip(); };
  addEventListener('mousemove', onMove); addEventListener('pointerdown', onPDown); addEventListener('pointermove', onPMove); addEventListener('pointerup', onPUp); addEventListener('keydown', onKey);
  elSkip.addEventListener('click', (e) => { e.stopPropagation(); skip(); }); elSkip.addEventListener('pointerdown', (e) => e.stopPropagation());
  const over = { dyaw: 0, dpitch: 0 };
  const takeInput = () => { const i = { dyaw: acc.dyaw + over.dyaw, dpitch: acc.dpitch + over.dpitch }; acc.dyaw = acc.dpitch = 0; over.dyaw = over.dpitch = 0; return i; };

  /* ───────── dibujo ───────── */
  let lastInfo = { calls: 0, triangles: 0 }, sizeKey = '';
  function render() {
    if (stopped || !readyOk) return;
    const w = canvas.width || 1, h = canvas.height || 1; camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { const k = `${w}x${h}`; if (k !== sizeKey) { sizeKey = k; composer.setPixelRatio(1); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); } grade.uniforms.uTime.value = (T_ * 7) % 100; grade.uniforms.uShake.value = shake * 3;
      bloom.strength = 0.3 + 0.9 * sm((T_ - (BEATS.IMPACT - 0.4)) * 2) * (T_ < BEATS.WHITE_END ? 1 : 0); if (bokeh) { bokeh.uniforms.focus.value = focusD; bokeh.uniforms.aspect.value = camera.aspect; bokeh.uniforms.aperture.value = (shotId() === 2 || shotId() === 6 || shotId() === 5) ? 0.00026 : 0.00004; } }
    gl.info.reset(); camera.updateMatrixWorld(true);
    if (composer) composer.render(); else gl.render(scene, camera);
    lastInfo = { calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures };
  }
  const shotId = () => shot(T_).id;
  function tick(dt) {
    if (finished || stopped) return;
    const inp = takeInput(); let r = dt; while (r > 1e-6 && !finished && readyOk) { const s = Math.min(r, 1 / 30); r -= s; step(s, inp); inp.dyaw = inp.dpitch = 0; }
    if (!stopped) render();
  }
  function loop(now) { if (stopped) return; raf = requestAnimationFrame(loop); const dt = clamp((now - lastNow) / 1000, 0, 0.1); lastNow = now; tick(dt); }

  /* ───────── cierre ───────── */
  function done() { if (finished) return; finished = true; stop(); onDone(); }
  function skip() { if (finished) return; finished = true; stop(); onSkip(); }
  function stop() {
    if (stopped) return; stopped = true; cancelAnimationFrame(raf);
    removeEventListener('mousemove', onMove); removeEventListener('pointerdown', onPDown); removeEventListener('pointermove', onPMove); removeEventListener('pointerup', onPUp); removeEventListener('keydown', onKey);
    if (amb) amb.stop(); subs.queue = []; subs.cur = null; subs.cb = null; subsEl.classList.remove('on'); ui.remove(); styleEl.remove(); document.body.classList.remove('prologo-on');
    gl.toneMappingExposure = saved.exposure; gl.toneMapping = saved.tone; gl.shadowMap.enabled = saved.shadow; gl.shadowMap.type = saved.shadowType;
    try { for (const h of Object.values(H)) h.dispose && h.dispose(); if (kit) disposeHumanKit(kit); st.dispose(); blobTex.dispose(); blobMat.dispose(); blobGeo.dispose(); if (scene.userData.env) scene.userData.env.dispose(); if (composer) composer.dispose(); } catch { /* limpieza best-effort */ }
    scene.clear(); if (window.__prologo === api) window.__prologo = null;
  }

  if (!manual) raf = requestAnimationFrame(loop);
  const api = {
    ready: readyP, tick, step: (dt) => { const i = takeInput(); step(dt, i); }, stop, skip, scene, camera,
    /** Salta a un instante T de forma determinista (avanza la lógica en pasos de 1/30 s sin dibujar). */
    seek(t) { quiet = true; while (T_ < t - 1e-6 && !finished) step(Math.min(1 / 30, t - T_), null); quiet = false; },
    setInput(o) { Object.assign(over, o); },
    get finished() { return finished; }, get stopped() { return stopped; },
    state() { const t = T_, win = t >= BEATS.FREE0 && t < BEATS.IMPACT; return { T: t, shot: shot(t).id, freeLook: win, look: { yaw: free.yaw, pitch: free.pitch }, trainX: trainX(t), trainOn: st.train.group.visible, vFell: t >= 24.7, pClip: H.P && H.P.cur, vClip: H.V && H.V.cur, sub: subsEl.textContent, finished, fade: elFade.style.opacity, skipBtn: !!ui.parentNode, humans: Object.keys(H).length, ready: readyOk, cam: camera.position.toArray(), post: !!composer }; },
    info() { return { ...lastInfo }; },
    parts: { st, H, scene, composer },
  };
  window.__prologo = api;
  return api;
}
