// RACIMO — explosivo. Un racimo de vejigas/huevos de membrana finísima con venas, un núcleo de gas que brilla por dentro,
// un ojo atento y patitas con IK que corre sin parar. Cuanto más cerca está el jugador (ctx.dist) más se hincha, tiembla,
// se enrojece y parpadea más rápido: "a punto de estallar". (st.s === 'fuse' fuerza la urgencia máxima, para pruebas.)
import { cfg } from '../quality.js';
import { slimLeg, fixEye, glowSprite, shieldAura, tickAura } from './geoda_util.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, eye, leg, Spring, TAU } = kit;
  const level = cfg().humans, low = level === 'low';
  const col = new THREE.Color(color), HOT = new THREE.Color(0xff3a22), WHITE = new THREE.Color(0xfff2d8);
  const MEM0 = col.clone().lerp(new THREE.Color(0xffe8f4), 0.55);
  const memM = fleshMaterial({ color: col.clone().lerp(new THREE.Color(0xffe8f4), 0.55).getHex(), vein: 0xa01848, spot: color, glow: 0.12, wobble: 0.03, breath: 0.05, spots: 0.0, veins: 1.0, rough: 0.1, alpha: 0.5, scale: 3.4 });
  const coreM = fleshMaterial({ color: 0xffd0a0, vein: 0xff5020, spot: color, glow: 1.2, wobble: 0.01, breath: 0.02, spots: 0.8, veins: 0.3, rough: 0.4, scale: 3 });
  const skin = fleshMaterial({ color: col.clone().lerp(new THREE.Color(0xc0507a), 0.6).getHex(), vein: 0x4a0a30, spot: color, glow: 0.1, wobble: 0.01, breath: 0.02, spots: 0.5, veins: 0.8, rough: 0.35, scale: 3 });
  const claw = boneMaterial(0xf0e4d0);
  const mats = [memM, coreM, skin, claw];

  const root = new THREE.Group(), body = new THREE.Group(); body.position.y = 0.58; root.add(body);
  const cl = new THREE.Group(); cl.position.y = 0.2; body.add(cl);
  const gGeo = new THREE.SphereGeometry(1, low ? 10 : 16, low ? 7 : 12);
  const mk = (mat, r, x, y, z, sy = 1) => { const m = new THREE.Mesh(gGeo, mat); m.scale.set(r, r * sy, r); m.position.set(x, y, z); return m; };
  // núcleo de gas (visible a través de las membranas) y vejigas
  const core = mk(coreM, 0.3, 0, 0, 0); cl.add(core);
  const bl = [mk(memM, 0.4, 0, 0.0, 0, 1.05)]; cl.add(bl[0]);
  const nB = low ? 5 : 8, ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < nB; i++) { const y = 0.75 - (i + 0.5) / nB * 1.5, rr = Math.sqrt(1 - y * y), th = i * ga + 0.6, r = 0.26 + (i % 3) * 0.05; let bz = Math.sin(th) * rr * 0.55; if (bz > 0.12) bz = 0.12 - (bz - 0.12) * 0.8; const b = mk(memM, r, Math.cos(th) * rr * 0.55, y * 0.45, bz, 1.05); b.userData = { ph: i * 1.9, r, p0: b.position.clone() }; cl.add(b); bl.push(b); }
  bl[0].userData = { ph: 0, r: 0.4, p0: bl[0].position.clone() };
  // ojo frontal sobre una vejiga carnosa + pelillos (cilios) que tantean
  const eb = mk(skin, 0.22, 0, 0.1, 0.4); cl.add(eb);
  const ey = fixEye(eye({ r: 0.2, iris: new THREE.Color(color).multiplyScalar(0.8).getHex(), glow: 0.7 })); ey.object.position.set(0, 0.12, 0.52); cl.add(ey.object);
  // patitas con IK (corre en trípode)
  const legs = [], nL = low ? 4 : 4;
  for (let i = 0; i < nL; i++) {
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2), z0 = (row - (nL / 2 - 1) / 2 * 1) * 0.3 - 0.0;
    const l = slimLeg(leg(skin, { upper: 0.32, lower: 0.42, r: 0.035, claw })); l.object.position.set(side * 0.25, 0, (row - (nL / 4)) * 0.28 + 0.1); l.setBend(new THREE.Vector3(side * 0.8, 1.2, 0)); body.add(l.object);
    legs.push({ l, side, row, base: new THREE.Vector3(side * 0.5, -0.5, (row - nL / 4) * 0.28 + 0.1) });
  }
  const glow = glowSprite(color, 2, 0); glow.position.y = 0.2; body.add(glow);
  const aura = shieldAura(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4), 1.3); aura.position.y = 0.3; body.add(aura);

  const spJit = new Spring(0, 200, 12); let phase = 0, fuse = 0, strobe = 0; const tmp = new THREE.Vector3(0, 0, 1), C = new THREE.Color();
  const u0 = memM.userData.u, c0 = coreM.userData.u, s0 = skin.userData.u;
  return { root, mats, tick(dt, st, t, ctx = {}) {
    const speed = Math.min(1.6, Math.max(0.35, ctx.speed || 0)), hurt = st.hp != null && st.hp < 0.35, stun = !!st.st;
    // urgencia: 0 lejos … 1 a punto de estallar (ctx.dist en unidades de mundo)
    const d = ctx.dist == null ? 40 : ctx.dist, target = st.s === 'fuse' ? 1 : THREE.MathUtils.clamp(1 - (d - 5) / 22, 0, 1);
    fuse += (target - fuse) * Math.min(1, 5 * dt); const u = fuse * fuse * (3 - 2 * fuse) * 0.4 + fuse * 0.6;
    const freq = 2.4 + 16 * u + (hurt ? 3 : 0); strobe += dt * freq * TAU; const beat = 0.5 + 0.5 * Math.sin(strobe), flash = u > 0.55 ? (Math.sin(strobe * 0.5) > 0 ? 1 : 0) * (u - 0.4) : 0;
    // vejigas: laten a su aire, se hinchan con la urgencia y se agitan
    const infl = 1 + 0.32 * u;
    bl.forEach((b, i) => { const ud = b.userData, p = Math.sin(strobe + ud.ph), k = ud.r * infl * (1 + (0.05 + 0.1 * u) * p); b.scale.set(k, k * 1.05 * (1 - 0.06 * p), k); b.position.set(ud.p0.x * infl + (u > 0.3 ? Math.sin(t * 40 + ud.ph) * 0.012 * u : 0), ud.p0.y * infl, ud.p0.z * infl); });
    core.scale.setScalar(0.3 * (1 + 0.5 * u + (0.15 + 0.25 * u) * beat)); eb.scale.set(0.22 * infl, 0.22 * infl, 0.22 * infl);
    // color del gas: del color propio al rojo caliente y a blanco en el flash
    C.copy(col).lerp(HOT, Math.min(1, u * 1.3)).lerp(WHITE, flash * 0.6); c0.uSpot.value.copy(C); coreM.color.copy(C).lerp(WHITE, 0.25 * flash);
    c0.uGlow.value = 0.6 + 1.0 * u + 1.0 * flash; u0.uGlow.value = 0.12 + 0.45 * u + 0.8 * flash; u0.uSpot.value.copy(C); s0.uGlow.value = 0.1 + 0.4 * u;
    u0.uWob.value = 0.03 + 0.07 * u; u0.uPulse.value = u > 0.35 ? u : 0; s0.uPulse.value = u > 0.5 ? u * 0.8 : 0; memM.opacity = 0.5 - 0.12 * u; memM.color.copy(MEM0).lerp(HOT, Math.min(1, u * 1.25)).lerp(WHITE, flash * 0.3);
    glow.material.opacity = (0.12 + 0.5 * u) * (0.4 + 0.6 * beat) + 0.35 * flash; glow.material.color.copy(C); glow.scale.setScalar(1.6 + 1.6 * u + 0.5 * beat * u);
    // temblor general (más fuerte con la urgencia) y bamboleo al correr
    const jit = spJit.step(dt, (Math.sin(t * 45) + Math.sin(t * 61)) * 0.012 * (u + (hurt ? 0.5 : 0) + (stun ? 0.4 : 0)));
    cl.position.x = jit; cl.position.y = 0.2 + Math.abs(Math.sin(phase * 0.5)) * 0.06 * speed; cl.rotation.z = Math.sin(phase * 0.5) * 0.08 * speed + jit * 2; cl.rotation.x = 0.1 * speed - 0.15 * u;
    // ojo: mira, se abre de par en par cuando se acerca
    ey.update(dt, ctx.look || tmp.set(0, 0, 1), { dilate: 0.3 * u, glowMul: 0.6 + 1.6 * u });
    ey.object.scale.setScalar(1 + 0.25 * u); ey.object.position.z = 0.52 + 0.25 * u; eb.position.z = 0.4 + 0.25 * u;
    // patitas: más rápidas con la urgencia
    phase += dt * (6 + speed * 12 + 8 * u);
    legs.forEach((L, i) => { const g = (L.row + (L.side > 0 ? 1 : 0)) % 2, ph = phase + g * Math.PI, stride = 0.26 * Math.min(1, 0.3 + speed), lift = Math.max(0, Math.sin(ph)) * 0.22 * Math.min(1, 0.4 + speed); tmp.set(L.base.x, L.base.y + lift - 0.02 * u, L.base.z + Math.cos(ph) * stride); L.l.setFoot(tmp); });
    tmp.set(0, 0, 1);
    root.rotation.z = stun ? Math.sin(t * 24) * 0.06 : 0; tickAura(aura, st, t);
  } };
}
