// PRÓLOGO «LA ESTACIÓN» — escena 3D jugable (reemplaza al cine 2D `trainCine` salvo con ?classic_intro=1).
//
//   const P = startPrologue({ THREE, renderer, host: 'axioma', touch: false, onDone, onSkip, sound, touchCtl });
//   P.tick(dt)  // avanza lógica + dibuja (modo manual/captura: lo llama quien manda el reloj)
//   P.step(dt)  // sólo lógica, sin dibujar (tests rápidos)
//   P.stop()    // limpia todo (listeners, DOM, geometrías) y devuelve el renderer tal como estaba
//
// Cinco escenas, cada una con objetivo visible: 1 LA ESPERA → 2 EL TREN → 3 LA RUPTURA → 4 PRIMER CONTACTO → 5 LA PRIMERA DECISIÓN.
// Dibuja con el WebGLRenderer del Renderer del juego (renderer.gl), pero con su propia escena y cámara.
import { Subtitles, PROLOGO as TXT, PROLOGO_OBJ as OBJ } from './story.js';
import { buildStation, buildBio, buildPerson, ST } from './env/estacion.js';
import { NOISE } from './env/glsl.js';
import { rng } from './env/noise.js';
import { CHARACTERS } from '../sim/data.js';

export const SCENE_NAMES = ['LA ESPERA', 'EL TREN', 'LA RUPTURA', 'PRIMER CONTACTO', 'LA PRIMERA DECISIÓN'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

const CSS = `
#pg-ui{position:fixed;inset:0;z-index:7;pointer-events:none;color:#fff;font-family:inherit}
#pg-obj{position:absolute;top:calc(14px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:max-content;max-width:min(600px,86vw);text-align:center;background:rgba(5,10,14,.7);border:1px solid rgba(110,255,232,.5);border-radius:12px;padding:9px 18px;box-shadow:0 0 18px rgba(60,255,220,.15)}
#pg-obj b{display:block;font-size:clamp(17px,2.6vw,25px);color:#b6fff4;letter-spacing:.02em;line-height:1.2}
#pg-obj span{display:block;font-size:clamp(12px,1.7vw,16px);color:#d6dee4;margin-top:3px}
#pg-sc{position:absolute;top:calc(14px + env(safe-area-inset-top));left:14px;font-size:12px;letter-spacing:.14em;color:#9fb6bd;text-shadow:0 0 4px #000}
#pg-sc i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:#34464c} #pg-sc i.on{background:#6effe8;box-shadow:0 0 6px #6effe8} #pg-sc i.ok{background:#3aa48f}
#pg-skip{pointer-events:auto;position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px;background:rgba(5,10,14,.7);color:#e8f0f4;border:1px solid rgba(255,255,255,.35);border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;cursor:pointer}
#pg-skip:hover{background:rgba(40,60,70,.85)}
#pg-cross{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;border:1.5px solid rgba(255,255,255,.75);opacity:.0;transition:opacity .4s} #pg-cross.on{opacity:.9}
#pg-cmp{position:absolute;left:50%;bottom:calc(30% + env(safe-area-inset-bottom));transform:translateX(-50%);text-align:center;font-size:13px;color:#b6fff4;text-shadow:0 0 4px #000;opacity:0;transition:opacity .3s} #pg-cmp.on{opacity:1}
#pg-cmp svg{display:block;margin:0 auto 2px;width:30px;height:30px;filter:drop-shadow(0 0 4px #000)}
#pg-fade{position:absolute;inset:0;background:#000;opacity:1;transition:none}
#pg-hit{position:absolute;left:50%;top:38%;transform:translateX(-50%);font-size:clamp(16px,2.4vw,24px);color:#ff9ae8;text-shadow:0 0 8px #000;opacity:0;transition:opacity .25s} #pg-hit.on{opacity:1}
body.prologo-on #sub{background:rgba(0,0,0,.6);padding:.35em .8em;border-radius:10px;width:fit-content;max-width:84%;margin:0 auto;bottom:calc(19% + env(safe-area-inset-bottom))}
body.prologo-on .tc-ads,body.prologo-on .tc-jump,body.prologo-on .tc-crouch,body.prologo-on .tc-dash,body.prologo-on .tc-mov,body.prologo-on .tc-esp,body.prologo-on .tc-ability,body.prologo-on .tc-ping,body.prologo-on .tc-prev,body.prologo-on .tc-next,body.prologo-on .tc-fireL{display:none!important}
`;

/** Sistema de partículas de una sola malla (chispas, estelas del disparo, restos de la ruptura). */
function makeParticles(T, n = 360) {
  const g = new T.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aCol', new T.BufferAttribute(col, 4)); g.setAttribute('aSize', new T.BufferAttribute(size, 1));
  const px = { value: 1 };
  const mat = new T.ShaderMaterial({
    uniforms: { uPx: px }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: 'attribute float aSize; attribute vec4 aCol; uniform float uPx; varying vec4 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aSize * 260.0 * uPx / max(0.2, -mv.z), 0.0, 220.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC.rgb * a * vC.a, a * vC.a); }',
  });
  const pts = new T.Points(g, mat); pts.frustumCulled = false;
  const P = Array.from({ length: n }, () => ({ life: 0, max: 1, v: [0, 0, 0], s: 0, c: [1, 1, 1], g: 0 })); let head = 0;
  return {
    pts, mat, px,
    spawn(p, v, life, s, c, grav = 0) { const i = head; head = (head + 1) % n; const q = P[i]; q.life = q.max = life; q.s = s; q.c = c; q.g = grav; q.v = v; pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; },
    update(dt) {
      for (let i = 0; i < n; i++) {
        const q = P[i]; if (q.life <= 0) { col[i * 4 + 3] = 0; size[i] = 0; continue; }
        q.life -= dt; q.v[1] -= q.g * dt; pos[i * 3] += q.v[0] * dt; pos[i * 3 + 1] += q.v[1] * dt; pos[i * 3 + 2] += q.v[2] * dt;
        const k = clamp(q.life / q.max, 0, 1); col[i * 4] = q.c[0]; col[i * 4 + 1] = q.c[1]; col[i * 4 + 2] = q.c[2]; col[i * 4 + 3] = k; size[i] = q.s * (0.4 + 0.6 * k);
      }
      g.attributes.position.needsUpdate = g.attributes.aCol.needsUpdate = g.attributes.aSize.needsUpdate = true;
    },
    dispose() { g.dispose(); mat.dispose(); },
  };
}

export function startPrologue({ THREE: T, renderer, host = 'axioma', touch = false, onDone = () => {}, onSkip = () => {}, sound = null, touchCtl = null, manual = false, nolock = false, quality = null } = {}) {
  const gl = renderer.gl || renderer, canvas = gl.domElement;
  const level = quality || renderer.level || 'low';
  const R = rng(2024), accent = (CHARACTERS[host] && CHARACTERS[host].color) || 0x2fe6d2;
  let finished = false, stopped = false, raf = 0, lastNow = performance.now();

  /* ───────── escena, cámara, mundo ───────── */
  const scene = new T.Scene(); scene.background = new T.Color(0x05080a); scene.fog = new T.Fog(0x070b0e, 26, 95);
  const camera = new T.PerspectiveCamera(78, 1, 0.05, 220); camera.rotation.order = 'YXZ'; scene.add(camera);
  const st = buildStation(T, { level }), bio = buildBio(T, st.U, st.halo);
  scene.add(st.group);
  const fx = makeParticles(T); scene.add(fx.pts);
  // el organismo se tiñe con el color del Huésped elegido
  bio.handBarrel.material.color.setHex(accent); bio.handBarrel.material.emissive.setHex(accent);
  bio.entity.position.set(-2, 0, ST.TRACK_Z); bio.entity.visible = false; scene.add(bio.entity);
  bio.target.position.set(6, 1.1, -9.2); bio.target.visible = false; scene.add(bio.target);
  bio.umbral.position.set(-22.9, 2.1, 3.0); bio.umbral.rotation.y = Math.PI / 2; bio.umbral.visible = false; scene.add(bio.umbral);
  bio.pedestal.position.set(-15.5, 0, 2.0); bio.pedestal.visible = false; scene.add(bio.pedestal);
  bio.hand.visible = false; camera.add(bio.hand);
  // la que cae: abrigo rojo (se distingue de la multitud)
  const faller = buildPerson(T, { shirt: 0xd8203a, pants: 0x1c1c28, skin: 0xd8a487, hair: 0x3a2418, bag: 0xe0b020 });
  faller.group.rotation.y = Math.PI; faller.group.position.set(-2, 0, 0.9); scene.add(faller.group);
  const fallerRing = new T.Sprite(new T.SpriteMaterial({ map: st.halo, color: 0xff5060, blending: T.AdditiveBlending, depthWrite: false, transparent: true, depthTest: false })); fallerRing.scale.setScalar(3.0); fallerRing.visible = false; scene.add(fallerRing);
  // membrana de la ruptura (un velo iridiscente que cruza toda la estación)
  const memU = { uT: st.U.uT, uAmp: { value: 0 }, uNear: { value: 0 } };
  const membrane = new T.Mesh(new T.PlaneGeometry(20, 7.4, 1, 1), new T.ShaderMaterial({
    uniforms: memU, transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uAmp, uNear; varying vec2 vP; ${NOISE}
      vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
      void main(){ vec3 q = vec3(vP * 0.35, uT * 0.35); float n = fbm(q * 2.0 + vec3(0.0, 0.0, fbm(q * 3.0))); float ring = abs(length(vP - vec2(-2.6, 0.0)) - (uNear * 9.0 + 1.0));
        float edge = 1.0 - smoothstep(0.0, 1.0, abs(vP.x) / 10.0); float a = uAmp * (0.10 + 0.55 * smoothstep(0.35, 0.75, n)) * (0.6 + 0.8 * exp(-ring * 1.6)) * (0.4 + 0.6 * edge);
        gl_FragColor = vec4(pal(n * 1.3 + uT * 0.08 + vP.y * 0.05) * a * 1.6, a); }`,
  }));
  membrane.rotation.y = Math.PI / 2; membrane.position.set(-8, 1.7, -2.7); membrane.visible = false; scene.add(membrane);
  // baliza del objetivo (columna de luz) + destello de la mano
  const beamMat = new T.MeshBasicMaterial({ color: 0x6effe8, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false });
  const beam = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 7, 12, 1, true), beamMat); beam.visible = false; scene.add(beam);
  const spore = new T.Sprite(new T.SpriteMaterial({ map: st.halo, color: accent, blending: T.AdditiveBlending, depthWrite: false, transparent: true })); spore.scale.setScalar(0.7); spore.visible = false; scene.add(spore);

  /* ───────── interfaz (objetivo, escena, saltar, brújula, mira) ───────── */
  const styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl);
  const ui = document.createElement('div'); ui.id = 'pg-ui';
  ui.innerHTML = '<div id="pg-sc"></div><div id="pg-obj"><b></b><span></span></div><button id="pg-skip" type="button">Saltar prólogo ⏭ (Enter)</button><div id="pg-cross"></div><div id="pg-hit"></div><div id="pg-cmp"><svg viewBox="0 0 24 24"><path d="M12 2 L21 20 L12 15 L3 20 Z" fill="#6effe8" stroke="#003a34" stroke-width="1.5"/></svg><em></em></div><div id="pg-fade"></div>';
  document.body.appendChild(ui); document.body.classList.add('prologo-on');
  const $ = (s) => ui.querySelector(s), elObj = $('#pg-obj'), elObjT = elObj.querySelector('b'), elObjH = elObj.querySelector('span'), elSc = $('#pg-sc'), elCmp = $('#pg-cmp'), elCmpT = elCmp.querySelector('em'), elCross = $('#pg-cross'), elFade = $('#pg-fade'), elHit = $('#pg-hit');
  const subsEl = document.getElementById('sub') || (() => { const d = document.createElement('div'); d.id = 'sub'; document.body.appendChild(d); return d; })();
  const subs = new Subtitles(subsEl, sound);
  const say = (lines, replace = false) => { if (replace || !subs.cur) subs.play(lines.map((l) => l.slice())); else subs.queue.push(...lines.map((l) => l.slice())); };
  const T_ = touch ? 2 : 1;
  const objective = (key, extra = '') => { const o = OBJ[key]; cur.objKey = key; elObjT.textContent = o[0] + extra; elObjH.textContent = o[T_]; elObj.style.display = ''; };
  const sceneDots = () => { elSc.innerHTML = SCENE_NAMES.map((n, i) => `<i class="${i < sc ? 'ok' : i === sc ? 'on' : ''}"></i>`).join('') + `${sc + 1}/5 · ${SCENE_NAMES[sc]}`; };
  let fadeV = 1, fadeTo = 0, fadeSpd = 1;
  const fade = (to, secs) => { fadeTo = to; fadeSpd = Math.abs(to - fadeV) / Math.max(0.05, secs); };

  /* ───────── audio sintético (WebAudio; sin archivos) ───────── */
  const amb = (() => {
    if (!sound || !sound.ctx) return null;
    const c = sound.ctx, out = c.createGain(); out.gain.value = 0.0; out.connect(sound.sfxBus || c.destination); out.gain.setTargetAtTime(1, c.currentTime, 0.8);
    const lp = (f) => { const b = c.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; return b; };
    const hum = c.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 100; const humF = lp(420), humG = c.createGain(); humG.gain.value = 0.05; hum.connect(humF); humF.connect(humG); humG.connect(out); hum.start();
    const nz = c.createBufferSource(); nz.buffer = sound.noiseBuf; nz.loop = true; const nzF = lp(120), nzG = c.createGain(); nzG.gain.value = 0; nz.connect(nzF); nzF.connect(nzG); nzG.connect(out); nz.start();
    const d1 = c.createOscillator(), d2 = c.createOscillator(); d1.type = d2.type = 'sawtooth'; d1.frequency.value = 55; d2.frequency.value = 58.3; const dF = lp(260), dG = c.createGain(); dG.gain.value = 0; d1.connect(dF); d2.connect(dF); dF.connect(dG); dG.connect(out); d1.start(); d2.start();
    return {
      set(prox, deform, slow, tissue) { const t = c.currentTime; nzG.gain.setTargetAtTime(0.08 + prox * 0.9, t, 0.15); nzF.frequency.setTargetAtTime(90 + prox * 1100 * slow, t, 0.2); nz.playbackRate.setTargetAtTime(Math.max(0.25, slow), t, 0.1);
        dG.gain.setTargetAtTime(deform * 0.28 + tissue * 0.08, t, 0.3); d1.frequency.setTargetAtTime(55 * (0.55 + 0.45 * slow), t, 0.2); d2.frequency.setTargetAtTime(58.3 * (0.5 + 0.5 * slow) + deform * 9, t, 0.2); hum.frequency.setTargetAtTime(100 * (0.7 + 0.3 * slow), t, 0.1); humG.gain.setTargetAtTime(0.05 * (1 - deform * 0.7), t, 0.2); },
      stop() { try { const t = c.currentTime; out.gain.setTargetAtTime(0, t, 0.15); setTimeout(() => { for (const n of [hum, nz, d1, d2]) { try { n.stop(); } catch { /* ya parado */ } } try { out.disconnect(); } catch { /* ok */ } }, 700); } catch { /* ok */ } },
    };
  })();
  const sfx = (fn) => { try { if (sound && sound.ctx) fn(sound); else if (sound) fn(sound); } catch { /* sin audio */ } };
  const chime = () => sfx((s) => { s.tone({ f: 659, type: 'sine', dur: 0.7, vol: 0.3, att: 0.01 }); s.tone({ f: 523, type: 'sine', dur: 1.0, vol: 0.3, att: 0.01, delay: 0.45 }); s.noise({ dur: 1.4, vol: 0.05, freq: 3000, type: 'bandpass', delay: 1.1 }); });

  /* ───────── estado del jugador y de la entrada ───────── */
  const pl = { x: 13.8, z: 2.4, yaw: Math.PI / 2, pitch: 0, bob: 0, moving: 0 };
  let bounds = { x0: 1, x1: 15, z0: 0.9, z1: 6.0 };
  const keys = new Set(); const over = { mx: 0, mz: 0, dyaw: 0, dpitch: 0, fire: false, use: false }; let mdx = 0, mdy = 0, fireDown = false, useEdge = false, fireEdge = false;
  const onKey = (e) => {
    if (e.type === 'keydown') {
      keys.add(e.code); if (e.code === 'KeyE' && !e.repeat) useEdge = true; if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) skip();
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    } else keys.delete(e.code);
  };
  const onMove = (e) => { if (document.pointerLockElement || nolock) { mdx += e.movementX || 0; mdy += e.movementY || 0; } };
  const onDown = (e) => { if (e.button === 0 && !e.target.closest('#pg-skip')) { fireDown = true; fireEdge = true; } };
  const onUp = (e) => { if (e.button === 0) fireDown = false; };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey); addEventListener('mousemove', onMove); addEventListener('mousedown', onDown); addEventListener('mouseup', onUp);
  $('#pg-skip').addEventListener('click', (e) => { e.stopPropagation(); skip(); });
  $('#pg-skip').addEventListener('pointerdown', (e) => e.stopPropagation());
  let tIn = { mx: 0, mz: 0, dyaw: 0, dpitch: 0, fire: false, use: false, run: false };
  /** Lee teclado / ratón / táctil UNA vez por tick (el giro del ratón se consume acá). */
  function readInput() {
    const k = (c) => (keys.has(c) ? 1 : 0);
    // dyaw > 0 = girar a la derecha (igual que el simulador); dpitch > 0 = mirar arriba
    const i = { mx: k('KeyD') - k('KeyA'), mz: k('KeyW') - k('KeyS'), dyaw: mdx * 0.0022 + (k('ArrowRight') - k('ArrowLeft')) * 1.9 * tickDt, dpitch: -mdy * 0.0022 + (k('ArrowUp') - k('ArrowDown')) * 1.3 * tickDt, fire: fireDown || keys.has('KeyF'), use: useEdge, run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    mdx = mdy = 0;
    if (touchCtl && touchCtl.read) { const r = touchCtl.read(); i.mx += r.mx || 0; i.mz += r.mz || 0; i.dyaw += r.dyaw || 0; i.dpitch += r.dpitch || 0; i.fire = i.fire || !!r.fire; i.use = i.use || !!r.interact; i.run = i.run || !!r.dash; }
    i.mx += over.mx; i.mz += over.mz; i.dyaw += over.dyaw; i.dpitch += over.dpitch; i.fire = i.fire || over.fire; i.use = i.use || over.use; over.dyaw = over.dpitch = 0; over.use = false;
    i.mx = clamp(i.mx, -1, 1); i.mz = clamp(i.mz, -1, 1);
    useEdge = false; return i;
  }

  /* ───────── mundo ───────── */
  const W = { t: 0, ts: 1, trainX: -90, trainV: 0, flick: 0.35, stretch: 0, hue: 0, dark: 0, warp: 0, grow: 0, screen: 'normal', trainOn: false, memX: -8 };
  const F = { phase: 'stand', t: 0 }; // la que cae
  let sc = 0, st0 = 0, assist = null, assistW = 0, weaponReady = false, hits = 0, fireCd = 0, kick = 0, shotsFired = 0, lastShotHit = false;
  const cur = { objKey: '', wp: null, done: false };
  const bolts = []; let targetPulse = 0, flash = 0;
  const camPos = new T.Vector3(), tmpV = new T.Vector3(), fwd = new T.Vector3();
  const goal = { yaw: 0, pitch: 0 };

  function lookAt(x, y, z) { tmpV.set(x, y, z).sub(camPos); goal.yaw = Math.atan2(-tmpV.x, -tmpV.z); goal.pitch = Math.atan2(tmpV.y, Math.hypot(tmpV.x, tmpV.z)); }
  const setAssist = (p, w = 1) => { assist = p; assistW = w; };

  /* — escenas — */
  const baseline = (i) => { // estado del mundo coherente aunque se salte de escena (tests / capturas)
    W.ts = 1; W.flick = 0.35; W.stretch = 0; W.hue = 0; W.dark = 0; W.warp = 0; W.grow = 0; W.screen = 'normal'; memU.uAmp.value = 0; membrane.visible = false;
    faller.group.visible = i < 3; F.landed = false; F.t = 0; F.phase = 'stand'; fallerRing.visible = false; weaponReady = false; bio.hand.visible = false; bio.entity.visible = false; bio.target.visible = false; bio.umbral.visible = false; bio.pedestal.visible = false; hits = 0;
    if (i >= 1) { W.trainOn = true; W.trainX = -60; } else { W.trainOn = false; }
    if (i >= 2) { W.trainX = -22; F.phase = 'lie'; F.t = 9; F.landed = true; W.screen = 'alerta'; }
    if (i >= 3) { W.trainOn = false; faller.group.visible = false; fallerRing.visible = false; W.warp = 0.7; W.grow = 0.9; W.hue = 0.7; W.flick = 0.8; W.screen = 'carne'; membrane.visible = false; bio.entity.visible = true; bio.grows.entity.value = i === 3 ? 0 : 1; }
    if (i >= 4) { weaponReady = true; bio.hand.visible = true; bio.hand.scale.setScalar(0.72); bio.grows.hand.value = 1; bio.target.visible = false; hits = 3; bio.umbral.visible = true; bio.pedestal.visible = true; }
  };
  const SC = [
    { // 1 LA ESPERA
      begin() { bounds = { x0: 1, x1: 15, z0: 0.9, z1: 6.0 }; cur.step = 0; cur.yawAcc = 0; cur.hold = 0; objective('mirar'); say(TXT.espera, true); },
      update(dt, inp) {
        cur.yawAcc += Math.abs(inp.dyaw);
        const d = Math.hypot(pl.x - 0.3, pl.z - 5.3);
        if (cur.step === 0 && (cur.yawAcc > 0.9 || st0 > 20)) { cur.step = 1; objective('caminar'); cur.wp = [0.3, 5.3]; }
        else if (cur.step === 1 && d < 2.6) { cur.step = 2; objective('leer'); cur.wp = null; say(TXT.cartel); }
        else if (cur.step === 2) { cur.hold += dt; if (cur.hold > 3.6) next(); }
        if (st0 > 75 && cur.step < 2) next();
        W.flick = 0.35;
      },
    },
    { // 2 EL TREN
      begin() { bounds = { x0: -6, x1: 15, z0: 0.9, z1: 6.0 }; W.trainOn = true; W.trainX = -62; W.screen = 'alerta'; cur.phase = 0; cur.wp = null; objective('tren'); say(TXT.tren, true); chime(); fallerRing.visible = false; },
      update(dt) {
        const t = st0;
        if (cur.phase === 0) { W.trainX = Math.min(-14, -62 + 7.5 * t); W.flick = 0.6 + t * 0.05; if (t > 5.2) { setAssist([-2, 1.2, 0.9], 0.9); } if (t > 5.0) { F.phase = 'sway'; fallerRing.visible = true; fallerRing.position.set(-2, 2.1, 0.9); } if (t > 7.0) { F.phase = 'fall'; F.t = 0; cur.phase = 1; say(TXT.borde); } }
        else if (cur.phase === 1) { W.trainX += 0.5 * dt; setAssist([-2, 0.6, -0.8], 0.9); if (F.t > 1.3 && !cur.said) { cur.said = true; say(TXT.caida); sfx((s) => { s.thump(90, 40, 0.3, 0.5); }); } if (F.t > 2.7) { cur.phase = 2; cur.t2 = 0; objective('ayudar'); cur.wp = [-2, 0.95]; setAssist(null, 0); fallerRing.visible = true; } }
        else { cur.t2 += dt; W.trainX += 0.7 * dt; const d = Math.hypot(pl.x + 2, pl.z - 0.95); if (d < 2.4 || cur.t2 > 14) next(); }
        W.flick = Math.max(W.flick, 0.7);
      },
    },
    { // 3 LA RUPTURA
      begin() { bounds = { x0: -6, x1: 15, z0: 0.9, z1: 6.0 }; cur.wp = null; fallerRing.visible = false; objective('ruptura'); say(TXT.ruptura, true); membrane.visible = true; cur.eaten = false; cur.boom = false; W.screen = 'glitch'; sfx((s) => { s.thump(60, 30, 1.2, 0.6); s.heartbeat(); }); },
      update(dt) {
        const t = st0, slow = t < 1.4 ? lerp(1, 0.15, smooth(t / 1.4)) : t < 9.2 ? 0.15 : lerp(0.15, 1, smooth((t - 9.2) / 1.6));
        W.ts = slow; W.hue = smooth(t / 5); W.stretch = Math.min(1, smooth(t / 3)) * (t < 9 ? 1 : 1 - smooth((t - 9) / 2) * 0.6); W.dark = 0.3 * smooth((t - 4) / 5);
        W.warp = smooth((t - 0.6) / 7.5) * 0.9; W.grow = smooth((t - 0.4) / 9.5) * 0.95; W.flick = 1; W.screen = t > 5 ? 'carne' : 'alerta';
        memU.uAmp.value = smooth(t / 1.5) * (1 - 0.5 * smooth((t - 8.5) / 2.5)); memU.uNear.value = clamp((W.trainX + 22) / 30, 0, 1);
        W.trainV = lerp(8, 34, smooth(t / 4.5)); // m/s del mundo (la cámara lenta lo reparte en más tiempo real)
        if (!cur.eaten && W.trainX >= -2.6) { cur.eaten = true; F.phase = 'gone'; flash = 1; burst([-2, -0.8, -2.6], 70, [1, 0.3, 0.7]); faller.group.visible = false; sfx((s) => { s.thump(70, 24, 0.9, 0.9); s.noise({ dur: 0.9, vol: 0.5, freq: 3000, freq2: 120 }); }); }
        if (t > 10.4 && st0 > 0) { W.trainOn = false; }
        if (t > 11.4) next();
      },
    },
    { // 4 PRIMER CONTACTO
      begin() {
        bounds = { x0: -6, x1: 15, z0: 0.9, z1: 6.0 }; W.ts = 1; W.trainOn = false; membrane.visible = false; objective('contacto'); say(TXT.contacto, true); cur.sporeT = -1; cur.targetT = -1; cur.hitWait = -1; cur.wp = null; hits = 0; weaponReady = false;
        bio.entity.visible = true; bio.grows.entity.value = 0; faller.group.visible = false; setAssist([-2, 2.4, -2.6], 0.6); sfx((s) => { s.thump(50, 28, 1.5, 0.5); });
      },
      update(dt) {
        const t = st0; W.warp = lerp(0.7, 0.45, smooth(t / 12)); W.hue = lerp(0.7, 0.55, smooth(t / 12)); W.dark = 0.25; W.flick = 0.8; W.grow = 0.95; W.screen = 'carne';
        bio.grows.entity.value = smooth(t / 4.2);
        bio.entEye.lookAt(camPos); bio.entEye.scale.setScalar(Math.max(0.001, smooth((bio.grows.entity.value - 0.25) / 0.6)));
        if (t > 4.6 && cur.sporeT < 0) { cur.sporeT = 0; spore.visible = true; sfx((s) => { s.tone({ f: 300, f2: 900, type: 'sine', dur: 1.1, vol: 0.25 }); }); }
        if (cur.sporeT >= 0 && cur.sporeT < 1.4) { // la espora vuela del ojo a la mano
          cur.sporeT += dt; poseCamera(); const k = smooth(cur.sporeT / 1.4), a = new T.Vector3(-2, 3.5, ST.TRACK_Z), b = new T.Vector3(0.3, -0.27, -0.42).applyMatrix4(camera.matrixWorld);
          spore.position.lerpVectors(a, b, k); spore.position.y += Math.sin(k * Math.PI) * 1.2; spore.scale.setScalar(0.5 + 0.3 * Math.sin(st0 * 30));
          if (cur.sporeT >= 1.4) { spore.visible = false; bio.hand.visible = true; bio.grows.hand.value = 0; cur.manT = 0; flash = 0.8; say(TXT.disparo); sfx((s) => { s.heartbeat(); s.tone({ f: 120, f2: 600, type: 'sawtooth', dur: 0.5, vol: 0.2 }); }); setAssist(null, 0); }
        }
        if (cur.manT !== undefined) {
          cur.manT += dt; const k = clamp(cur.manT / 2.8, 0, 1); bio.grows.hand.value = smooth(k); bio.hand.scale.setScalar(0.72 * (0.85 + 0.15 * smooth(k) + 0.06 * Math.sin(cur.manT * 12) * (1 - k)));
          if (k >= 1 && !weaponReady) { weaponReady = true; cur.targetT = 0; bio.target.visible = true; bio.grows.target.value = 0; elCross.classList.add('on'); objective('disparar', ' (0/3)'); cur.wp = [6, -9.2]; sfx((s) => { s.tone({ f: 880, type: 'sine', dur: 0.4, vol: 0.25 }); s.tone({ f: 1320, type: 'sine', dur: 0.5, vol: 0.2, delay: 0.12 }); }); setAssist([6, 1.4, -9.2], 0.8); }
        }
        if (cur.targetT >= 0) { cur.targetT += dt; bio.grows.target.value = smooth(cur.targetT / 1.4); if (cur.targetT > 1.6 && assist) setAssist(null, 0); }
        if (cur.hitWait >= 0) { cur.hitWait += dt; if (cur.hitWait > 1.8) next(); }
        else if (cur.targetT > 90) next();
      },
    },
    { // 5 LA PRIMERA DECISIÓN
      begin() {
        bounds = { x0: -21.4, x1: 15, z0: 0.9, z1: 6.0 }; bio.umbral.visible = true; bio.pedestal.visible = true; bio.grows.umbral.value = 0; bio.grows.pedestal.value = 0; bio.umbralMem.uOpen.value = 0; cur.open = false; cur.cross = -1; cur.wp = [-15.5, 2.0];
        elCross.classList.remove('on'); objective('activar'); say(TXT.decision, true); W.warp = 0.35; W.screen = 'carne'; W.hue = 0.5; W.dark = 0.2; sfx((s) => { s.thump(55, 30, 1.2, 0.5); });
      },
      update(dt) {
        const t = st0; bio.grows.umbral.value = smooth(t / 2.5); bio.grows.pedestal.value = smooth((t - 0.4) / 2.0);
        bio.orb.rotation.y += dt * 1.5; bio.orb.position.y = 1.55 + Math.sin(st0 * 2) * 0.05; bio.pedestal.userData.pulse = 0.5 + 0.5 * Math.sin(st0 * 4);
        W.warp = lerp(W.warp, cur.open ? 0.12 : 0.35, 0.5 * dt); W.grow = 0.95;
        if (!cur.open) {
          const d = Math.hypot(pl.x + 15.5, pl.z - 2.0);
          if (d < 2.6 && inpUse) { cur.open = true; cur.t = 0; bio.orbMat.emissive.setHex(0x20ffd0); bio.pHalo.material.color.setHex(0x30ffd8); objective('cruzar'); cur.wp = [-22.5, 3.0]; say(TXT.abierto); sfx((s) => { s.tone({ f: 220, f2: 880, type: 'sawtooth', dur: 0.9, vol: 0.3 }); s.tone({ f: 660, f2: 1760, type: 'sine', dur: 1.2, vol: 0.25, delay: 0.1 }); }); flash = 0.6; }
          else if (d < 2.6) elObjH.textContent = OBJ.activar[T_];
        } else {
          cur.t += dt; bio.umbralMem.uOpen.value = smooth(cur.t / 1.5); bio.orbMat.emissiveIntensity = 1.6;
          const d = Math.hypot(pl.x + 22.5, pl.z - 3.0);
          if (cur.cross < 0 && d < 1.7 && cur.t > 1.0) { cur.cross = 0; fade(1, 1.1); elFade.style.background = '#fff'; sfx((s) => { s.tone({ f: 311, type: 'sawtooth', dur: 1.4, vol: 0.28, att: 0.05 }); s.tone({ f: 392, type: 'sawtooth', dur: 1.4, vol: 0.28, att: 0.05 }); s.noise({ dur: 1.6, vol: 0.4, freq: 300, freq2: 3500 }); }); }
          if (cur.cross >= 0) { cur.cross += dt; if (cur.cross > 1.5) done(); }
        }
      },
    },
  ];
  let inpUse = false;

  function burst(p, n, c) { for (let i = 0; i < n; i++) { const a = R() * 6.283, b = R() * 3.14, sp = 1.5 + R() * 5; fx.spawn(p, [Math.cos(a) * Math.sin(b) * sp, Math.cos(b) * sp, Math.sin(a) * Math.sin(b) * sp], 0.8 + R() * 0.9, 0.12 + R() * 0.18, c, 3); } }
  function beginScene(i) {
    sc = i; st0 = 0; cur.said = false; cur.t = 0; cur.wp = null; cur.manT = undefined; cur.phase = 0; assist = null; assistW = 0;
    baseline(i); SC[i].begin(); sceneDots();
  }
  function next() { if (sc < SC.length - 1) beginScene(sc + 1); else done(); }
  function done() { if (finished) return; finished = true; stop(); onDone(); }
  function skip() { if (finished) return; finished = true; stop(); onSkip(); }

  /* ───────── actualización por paso ───────── */
  const eyeV = new T.Vector3();
  let tickDt = 1 / 60;
  function movePlayer(inp, dt) {
    const sp = (inp.run ? 4.6 : 3.0) * dt; let mx = inp.mx, mz = inp.mz; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    const s = Math.sin(pl.yaw), c = Math.cos(pl.yaw); // adelante = (-sin, -cos), derecha = (cos, -sin)
    let nx = pl.x + (-s * mz + c * mx) * sp, nz = pl.z + (-c * mz - s * mx) * sp;
    nx = clamp(nx, bounds.x0, bounds.x1); nz = clamp(nz, bounds.z0, bounds.z1);
    for (const q of st.colliders) { const dx = nx - q.x, dz = nz - q.z, d = Math.hypot(dx, dz), r = q.r + 0.28; if (d < r && d > 1e-4) { nx = q.x + (dx / d) * r; nz = q.z + (dz / d) * r; } }
    if (sc >= 4) { const dx = nx + 15.5, dz = nz - 2.0, d = Math.hypot(dx, dz); if (d < 0.9) { nx = -15.5 + (dx / d) * 0.9; nz = 2.0 + (dz / d) * 0.9; } }
    const moved = Math.hypot(nx - pl.x, nz - pl.z); pl.x = nx; pl.z = nz; pl.moving = lerp(pl.moving, moved > 1e-5 ? 1 : 0, Math.min(1, dt * 8)); pl.bob += moved * 2.6;
  }
  function faceTo(inp, dt) {
    pl.yaw -= inp.dyaw; pl.pitch = clamp(pl.pitch + inp.dpitch, -1.2, 1.2);
    if (assist && assistW > 0) {
      camPos.set(pl.x, ST.EYE, pl.z); lookAt(assist[0], assist[1], assist[2]); const k = 1 - Math.exp(-2.6 * dt) * 1; const w = assistW;
      pl.yaw += wrapPi(goal.yaw - pl.yaw) * k * w; pl.pitch += (goal.pitch - pl.pitch) * k * w;
    }
  }
  function updateFaller(wdt) {
    const g = faller.group, P = faller.parts; F.t += wdt;
    if (F.phase === 'stand') { g.position.set(-2, 0, 0.9); g.rotation.set(0, Math.PI, 0); P.armL.rotation.x = P.armR.rotation.x = 0; }
    else if (F.phase === 'sway') { g.rotation.z = 0.07 * Math.sin(W.t * 3.1); g.rotation.x = -0.06 + 0.04 * Math.sin(W.t * 2.3); P.armL.rotation.x = 0.4 * Math.sin(W.t * 3); P.armR.rotation.x = -0.4 * Math.sin(W.t * 3); }
    else if (F.phase === 'fall') {
      const t = F.t; // 0–0.95 se inclina sobre el borde · 0.95–2.0 cae a la vía
      if (t < 1.3) { const a = smooth(t / 1.3) * 1.15; g.rotation.set(-a, Math.PI, 0.05 * Math.sin(t * 9)); g.position.set(-2, 0, 0.9 - 0.45 * smooth(t / 1.3)); fallerRing.position.set(-2, 2.1, 0.7); }
      else { const u = t - 1.3, a = lerp(1.15, 1.5707, smooth(u / 0.7)); g.rotation.set(-a, Math.PI, 0); const y = Math.max(-0.85, -0.5 * 6 * u * u); g.position.set(-2, y, lerp(0.45, -1.8, smooth(u / 0.9))); fallerRing.position.set(-2, y + 1.6, g.position.z); if (y <= -0.85 && !F.landed) { F.landed = true; burst([-2, -0.9, -1.8], 12, [0.8, 0.8, 0.9]); sfx((s) => { s.thump(120, 50, 0.25, 0.7); s.noise({ dur: 0.2, vol: 0.3, freq: 800 }); }); } if (u >= 1.1) { F.phase = 'lie'; } }
      const fl = t < 2.1 ? 1 : 0.2; P.armL.rotation.x = Math.sin(t * 15) * 1.7 * fl; P.armR.rotation.x = -Math.sin(t * 15 + 1) * 1.7 * fl; P.legL.rotation.x = Math.sin(t * 11) * 0.5; P.legR.rotation.x = -Math.sin(t * 11) * 0.5;
    } else if (F.phase === 'lie') {
      g.position.set(-2, -0.85, -1.8); g.rotation.set(-1.5707, Math.PI, 0); P.armR.rotation.x = -2.6 + 0.5 * Math.sin(W.t * 2.4); P.armL.rotation.x = 0.4 + 0.2 * Math.sin(W.t * 1.7); P.legL.rotation.x = P.legR.rotation.x = 0;
      fallerRing.position.set(-2, 0.6, -2.6); fallerRing.scale.setScalar(2.4 + 0.5 * Math.sin(W.t * 6));
    }
  }
  function poseCamera() {
    const bob = Math.sin(pl.bob * 1.9) * 0.035 * pl.moving; camera.position.set(pl.x, ST.EYE + bob, pl.z); camera.rotation.set(pl.pitch, pl.yaw, Math.sin(pl.bob * 0.95) * 0.004 * pl.moving);
    camPos.copy(camera.position); camera.updateMatrixWorld(true);
  }
  function fire() {
    if (!weaponReady || fireCd > 0) return; fireCd = 0.4; shotsFired++; kick = 1; poseCamera();
    bio.muzzle.getWorldPosition(tmpV); const from = tmpV.clone(); camera.getWorldDirection(fwd);
    const o = camPos.clone(), tc = bio.target.position.clone(); let to = o.clone().addScaledVector(fwd, 40), hit = false;
    if (bio.target.visible && bio.grows.target.value > 0.9) { const v = tc.clone().sub(o), tt = v.dot(fwd); if (tt > 0) { const perp = v.clone().addScaledVector(fwd, -tt).length(); if (perp < 0.62 + (touch ? 0.6 : 0.4)) { hit = true; to = tc.clone(); } } }
    lastShotHit = hit; const d = to.clone().sub(from), len = d.length(); bolts.push({ start: from, d: d.normalize(), len, t: 0, hit });
    sfx((s) => { s.shot(0); });
  }
  const boltCol = [(accent >> 16 & 255) / 255 * 1.4, (accent >> 8 & 255) / 255 * 1.4, (accent & 255) / 255 * 1.4];
  function updateFx(dt) {
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; b.t += dt; const dist = Math.min(b.len, b.t * 55), pos = b.start.clone().addScaledVector(b.d, dist);
      for (let k = 0; k < 3; k++) fx.spawn([pos.x - b.d.x * k * 0.25, pos.y - b.d.y * k * 0.25, pos.z - b.d.z * k * 0.25], [0, 0, 0], 0.22, 0.34 - k * 0.07, boltCol);
      if (dist >= b.len) { bolts.splice(i, 1); if (b.hit) onHit(pos); else burst([pos.x, pos.y, pos.z], 6, [0.4, 1, 0.9]); }
    }
    kick = Math.max(0, kick - dt * 6); fireCd = Math.max(0, fireCd - dt); targetPulse = Math.max(0, targetPulse - dt * 3); flash = Math.max(0, flash - dt * 2.2);
    fx.update(dt);
  }
  function onHit(pos) {
    if (hits >= 3) return; hits++; targetPulse = 1; burst([pos.x, pos.y, pos.z], 26, [1, 0.35, 0.85]); sfx((s) => { s.hit(0); s.thump(160, 60, 0.18, 0.4); });
    elHit.textContent = hits < 3 ? `¡Impacto! ${hits}/3` : '¡Capullo destruido!'; elHit.classList.add('on'); setTimeout(() => elHit.classList.remove('on'), 900);
    if (hits === 1) say(TXT.impacto);
    if (hits >= 3) { bio.target.visible = false; burst([pos.x, pos.y, pos.z], 90, [1, 0.5, 1]); sfx((s) => { s.boom && s.boom(null); s.thump(80, 30, 0.7, 0.8); }); cur.hitWait = 0; cur.wp = null; setAssist(null, 0); objective('disparar', ' ✓'); }
    else objective('disparar', ` (${hits}/3)`);
  }

  function step(dt, inp = null) {
    if (finished || stopped) return;
    tickDt = dt; inp = inp || { mx: 0, mz: 0, dyaw: 0, dpitch: 0, fire: false, use: false };
    st0 += dt; const wdt = dt * W.ts; W.t += wdt; inpUse = !!inp.use;
    faceTo(inp, dt); movePlayer(inp, dt);
    fov += ((sc === 1 && (F.phase === 'sway' || F.phase === 'fall') ? 50 : 78) - fov) * Math.min(1, dt * 2.5); // zoom de cine mientras ella cae
    SC[sc].update(dt, inp);
    if (weaponReady && inp.fire && sc >= 3) fire();
    // tren
    const tr = st.train; tr.group.visible = W.trainOn;
    if (W.trainOn) {
      if (sc === 2) W.trainX += W.trainV * wdt; tr.group.position.x = W.trainX;
      const near = clamp(1 - Math.abs(W.trainX - pl.x) / 55, 0, 1);
      for (const g of tr.glare) g.scale.setScalar(lerp(2.2, 7, near) * (1 + 0.1 * Math.sin(W.t * 40)));
      tr.beamMat.opacity = 0.05 + 0.05 * near; tr.group.scale.x = 1 + W.stretch * 1.4;
      const k = sc === 2 ? clamp((W.trainX + 10) / 10, 0, 1) : 0; tr.paint.emissive.setRGB(0.6 * k, 0.03 * k, 0.3 * k); tr.paint.color.setHex(k > 0.5 ? 0xc89ad0 : 0xaab4c4);
      tr.spot.intensity = 700 + 400 * near; tr.group.position.y = 0;
    }
    // tejido / cielo
    st.U.uWarp.value = W.warp; st.U.uGrow.value = W.grow; st.U.uPulse.value = W.hue;
    st.setScreen(W.screen, W.t);
    st.update({ t: W.t, flick: W.flick, stretch: W.stretch, hue: W.hue, dark: W.dark, trainX: W.trainOn ? W.trainX - 3 : -999 });
    scene.background.setRGB(0.02 + 0.12 * W.hue, 0.03, 0.04 + 0.12 * W.hue); scene.fog.color.copy(scene.background);
    faller.group.visible = faller.group.visible && F.phase !== 'gone';
    updateFaller(wdt);
    if (bio.entity.visible) bio.entity.rotation.y = Math.sin(W.t * 0.5) * 0.15;
    if (bio.target.visible) { bio.target.rotation.y += dt * 0.6; const s = 1 + 0.22 * targetPulse + 0.04 * Math.sin(W.t * 6); bio.target.children[0].scale.setScalar(s); bio.targetCore.scale.setScalar(1 + 0.3 * Math.sin(W.t * 7) + targetPulse * 0.8); bio.targetHalo.scale.setScalar(2.6 + targetPulse * 2); }
    if (bio.pedestal.visible) bio.pHalo.scale.setScalar(1.8 + 0.4 * Math.sin(W.t * 5));
    updateFx(dt);
    // mano: balanceo al caminar + retroceso del disparo
    if (bio.hand.visible) { const b = Math.sin(pl.bob * 1.9) * 0.012 * pl.moving; bio.hand.position.set(0.3 + b, -0.27 + Math.abs(b) * 0.8 + Math.sin(W.t * 1.4) * 0.004, -0.42 + kick * 0.07); bio.hand.rotation.x = 0.03 + kick * 0.1; bio.handFlash.scale.setScalar(kick * 0.55); bio.handBarrel.material.emissiveIntensity = 1 + kick * 1.5; }
    // baliza + brújula
    if (cur.wp) { beam.visible = true; beam.position.set(cur.wp[0], 3.0, cur.wp[1]); beamMat.opacity = 0.28 + 0.12 * Math.sin(W.t * 5); const dx = cur.wp[0] - pl.x, dz = cur.wp[1] - pl.z, dist = Math.hypot(dx, dz), sn = Math.sin(pl.yaw), cs = Math.cos(pl.yaw);
      const ang = Math.atan2(dx * cs - dz * sn, dx * -sn + dz * -cs); elCmp.classList.add('on'); elCmp.querySelector('svg').style.transform = `rotate(${ang}rad)`; elCmpT.textContent = `${dist.toFixed(0)} m`; if (sc === 3) { beam.position.y = 1.1; } }
    else { beam.visible = false; elCmp.classList.remove('on'); }
    // audio ambiente
    if (amb) { const prox = W.trainOn ? clamp(1 - Math.abs(W.trainX - pl.x) / 70, 0, 1) : 0; amb.set(prox * (sc === 1 ? 0.8 : 1), sc === 2 ? smooth(st0 / 3) : sc >= 3 ? 0.35 : 0, W.ts, W.grow); }
    // interfaz
    if (fadeV !== fadeTo) { fadeV += Math.sign(fadeTo - fadeV) * fadeSpd * dt; if (Math.abs(fadeV - fadeTo) < fadeSpd * dt) fadeV = fadeTo; elFade.style.opacity = String(fadeV); }
    subs.update(dt);
  }

  /* ───────── dibujo ───────── */
  const prev = { exposure: gl.toneMappingExposure };
  gl.toneMappingExposure = 1.25;
  function render() {
    if (stopped) return;
    const w = canvas.width || 1, h = canvas.height || 1; camera.aspect = w / h; camera.fov = fov; camera.updateProjectionMatrix(); fx.px.value = h / 720;
    poseCamera();
    // el destello blanco de la ruptura / disparo
    if (flash > 0) scene.background.addScalar(0.4 * flash);
    gl.info.reset(); gl.render(scene, camera); lastInfo = { calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures };
  }
  let lastInfo = { calls: 0, triangles: 0 }, fov = 78;
  /** Avanza `dt` segundos (en pasos ≤ 1/30 s) y dibuja un cuadro. */
  function tick(dt) {
    if (finished || stopped) return;
    const inp = readInputSafe(dt); let r = dt, first = true; if (dt <= 0) { render(); return; }
    while (r > 1e-6 && !finished) { const s = Math.min(r, 1 / 30); r -= s; step(s, first ? inp : { ...inp, dyaw: 0, dpitch: 0, use: false }); first = false; }
    if (!stopped) render();
  }
  function readInputSafe(dt) { tickDt = dt; return readInput(); }
  function loop(now) { if (stopped) return; raf = requestAnimationFrame(loop); const dt = clamp((now - lastNow) / 1000, 0, 0.1); lastNow = now; tick(dt); }

  /* ───────── cierre ───────── */
  function stop() {
    if (stopped) return; stopped = true; cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); removeEventListener('mousemove', onMove); removeEventListener('mousedown', onDown); removeEventListener('mouseup', onUp);
    if (amb) amb.stop(); subs.skip && subsClear(); ui.remove(); styleEl.remove(); document.body.classList.remove('prologo-on');
    gl.toneMappingExposure = prev.exposure;
    try { st.dispose(); bio.dispose(); fx.dispose(); faller.mats.forEach((m) => m.dispose()); faller.group.traverse((o) => o.geometry && o.geometry.dispose()); membrane.geometry.dispose(); membrane.material.dispose(); beam.geometry.dispose(); beamMat.dispose(); } catch { /* limpieza best-effort */ }
    scene.clear();
  }
  function subsClear() { subs.queue = []; subs.cur = null; subs.cb = null; subsEl.classList.remove('on'); }

  /* ───────── API pública ───────── */
  beginScene(0); fade(0, 1.4);
  if (!manual) raf = requestAnimationFrame(loop);
  const api = {
    tick, step: (dt) => { const inp = readInputSafe(dt); step(dt, inp); }, stop, skip, scene, camera,
    setInput(o) { Object.assign(over, o); }, fire() { over.fire = true; }, releaseFire() { over.fire = false; }, use() { over.use = true; },
    skipTo(i) { beginScene(clamp(i, 0, 4)); }, setPlayer(x, z, yaw, pitch) { pl.x = x; pl.z = z; if (yaw != null) pl.yaw = yaw; if (pitch != null) pl.pitch = pitch; },
    get finished() { return finished; }, get stopped() { return stopped; },
    state() { return { scene: sc, sceneName: SCENE_NAMES[sc], t: st0, worldT: W.t, pos: [pl.x, pl.z], yaw: pl.yaw, pitch: pl.pitch, wp: cur.wp, objective: elObjT.textContent, hint: elObjH.textContent, hits, weaponReady, trainX: W.trainX, trainOn: W.trainOn, fall: F.phase, fallT: F.t, ts: W.ts, warp: W.warp, grow: W.grow, sub: subsEl.textContent, finished, fade: fadeV, shots: shotsFired }; },
    info() { return { ...lastInfo }; },
    parts: { st, bio, faller, membrane, fx },
  };
  window.__prologo = api;
  return api;
}
