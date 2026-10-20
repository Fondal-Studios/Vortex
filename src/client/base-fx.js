// Animación de LA BASE (docs/BASE.md): lo que cambia en el Santuario según tu partida guardada.
//   · Forja: la cuba grande muestra la pieza que se está cultivando (nivel = progreso, brilla y pulsa al terminar); las 4 cubas chicas muestran el stock de un material.
//   · Mesa de Territorios: un pin por arena (dorado si ya la liberaste).
//   · Sala de los Capullos: un capullo colgante por Huésped (con su alma de color si lo poseés, apagado si no; el elegido late más fuerte).
//   · Jardín: cada maceta crece con el reloj y se rodea de un aro dorado cuando se puede cosechar.
//   · Vitrinas: tus objetos más fuertes como gemas del color de su rareza.
//   · Carteles: puntito de aviso sobre la estación que tiene algo para vos.
// `datos` lo arma src/client/base-hud.js (recolectar): { cultivo:{prog,listo,mat,item}, stock:{mat:n}, terr:{id:true}, owned:[host], sel, jardin:[{estado,prog,mat}], gems:[hex], avisos:{estacion:n}, cerca:{x,z,r}|null }.
import * as THREE from 'three';
import { CUBAS, CAPULLOS, MACETAS, ESTACIONES } from '../sim/base.js';
import { MATERIALS } from '../sim/items.js';
import { CHARACTERS } from '../sim/data.js';

const TERR_ORDEN = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
const C = new THREE.Color(), M4 = new THREE.Matrix4(), V3 = new THREE.Vector3(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3();

export function createBaseFx(r, parts, { low = false } = {}) {
  const fx = { datos: {}, t: 0, setDatos(d) { this.datos = d || {}; } };
  const { liq, item, holo, cap, plants, gems, labels } = parts;
  const colorMat = (m, k = 'glow') => (MATERIALS[m] ? MATERIALS[m][k] : 0xffffff);
  const hostCol = (id) => (CHARACTERS[id] ? CHARACTERS[id].color : 0xaaaaaa);
  const owned = (id) => (fx.datos.owned || []).includes(id);

  fx.update = function update(dt, state, me) {
    this.t += dt; const t = this.t, d = this.datos;
    /* ── Forja ── */
    const cu = d.cultivo, ready = !!(cu && cu.prog >= 1);
    CUBAS.forEach((c, i) => {
      let fill, col, glow = 0;
      if (c.mat) { const n = (d.stock && d.stock[c.mat]) || 0; fill = Math.min(1, 0.3 + n / 40 * 0.7); col = n ? colorMat(c.mat) : colorMat(c.mat, 'dark'); }
      else if (cu) { fill = ready ? 0.95 : 0.25 + 0.7 * cu.prog; col = colorMat(cu.mat); glow = ready ? 1 : 0.15; }
      else { fill = 0.38; col = 0xa88cff; }
      liq.aFill.setX(i, fill); C.setHex(col); liq.aCol.setXYZ(i, C.r, C.g, C.b); liq.aGlow.setX(i, glow);
    });
    liq.aFill.needsUpdate = liq.aCol.needsUpdate = liq.aGlow.needsUpdate = true;
    item.visible = !!cu; if (cu) { item.rotation.y = t * 1.2; item.rotation.x = Math.sin(t * 0.7) * 0.3; item.scale.setScalar((0.35 + 0.65 * Math.min(1, cu.prog)) * (ready ? 1.2 + 0.2 * Math.sin(t * 6) : 1)); item.position.y = 2.2 + 3 * (0.25 + 0.7 * Math.min(1, cu.prog)) * 0.7 + Math.sin(t * 1.4) * 0.15; item.material.color.setHex(colorMat(cu.mat)); }
    if (parts.luces) parts.luces[0].color.setHex(ready ? 0xfff0a0 : 0xff7ad9), parts.luces[0].intensity = ready ? 16 + 6 * Math.sin(t * 5) : 12;
    /* ── Mesa de Territorios ── */
    holo.core.rotation.y = t * 0.6; holo.core.rotation.x = t * 0.3;
    TERR_ORDEN.forEach((id, i) => { const lib = !!(d.terr && d.terr[id]); C.setHex(lib ? 0xffd45a : 0x7a6ca8); holo.pins.setColorAt(i, C); const a = i / 6 * Math.PI * 2 + 0.5 + t * 0.15, s = (lib ? 1.2 : 0.8) + 0.12 * Math.sin(t * 2 + i); M4.compose(V3.set(Math.cos(a) * 1.55, 1.25, Math.sin(a) * 1.55), Q.identity(), S3.set(s, s, s)); holo.pins.setMatrixAt(i, M4); });
    holo.pins.instanceMatrix.needsUpdate = true; if (holo.pins.instanceColor) holo.pins.instanceColor.needsUpdate = true;
    /* ── Capullos ── */
    CAPULLOS.forEach((c, i) => {
      const own = owned(c.id), sel = d.sel === c.id; C.setHex(hostCol(c.id));
      cap.attr.setXYZW(i, C.r, C.g, C.b, own ? 1 : 0);
      const s = own ? (sel ? 1.3 + 0.1 * Math.sin(t * 3) : 1) : 0, bob = Math.sin(t * 1.4 + i) * 0.12;
      M4.compose(V3.set(c.x, 5.3 + bob * 0.5, c.z), Q.identity(), S3.set(1.05, 1.05, 1.05)); cap.shell.setMatrixAt(i, M4);
      Q.setFromAxisAngle(V3.set(0, 1, 0), -Math.PI / 2 + Math.sin(t * 0.8 + i) * 0.4); M4.compose(V3.set(c.x, 4.1 + bob, c.z), Q, S3.set(s, s, s)); cap.soul.setMatrixAt(i, M4); cap.soul.setColorAt(i, C);
    });
    cap.attr.needsUpdate = true; cap.shell.instanceMatrix.needsUpdate = cap.soul.instanceMatrix.needsUpdate = true; if (cap.soul.instanceColor) cap.soul.instanceColor.needsUpdate = true;
    parts.espejoMat.uniforms.uC1.value.setHex(d.sel ? hostCol(d.sel) : 0x6fe9ff);
    /* ── Jardín ── */
    MACETAS.forEach((m, i) => {
      const j = (d.jardin && d.jardin[i]) || { estado: 'vacia', prog: 0 }, grow = j.estado === 'vacia' ? 0 : 0.25 + 0.75 * j.prog, s = grow * (j.estado === 'lista' ? 1 + 0.05 * Math.sin(t * 4 + i) : 1);
      Q.setFromAxisAngle(V3.set(0, 1, 0), i * 1.3 + Math.sin(t * 0.5 + i) * 0.08); M4.compose(V3.set(m.x, 0.95, m.z), Q, S3.set(s, s, s)); plants.plants.setMatrixAt(i, M4);
      C.setHex(j.mat ? colorMat(j.mat, 'color') : 0x88ff66); plants.plants.setColorAt(i, C);
      const h = j.estado === 'lista' ? 1 + 0.08 * Math.sin(t * 5 + i) : 0; M4.compose(V3.set(m.x, 0.15, m.z), Q.identity(), S3.set(h, h, h)); plants.halos.setMatrixAt(i, M4);
    });
    plants.plants.instanceMatrix.needsUpdate = plants.halos.instanceMatrix.needsUpdate = true; if (plants.plants.instanceColor) plants.plants.instanceColor.needsUpdate = true;
    /* ── Vitrinas ── */
    const G = d.gems || [];
    for (let i = 0; i < gems.count; i++) {
      const v = Math.floor(i / 4), k = i % 4, ok = i < G.length;
      if (ok) { C.setHex(G[i]); gems.setColorAt(i, C); Q.setFromAxisAngle(V3.set(0, 1, 0), t * 0.8 + i); M4.compose(V3.set(-34 + v * 6 + (k - 1.5) * 0.85, 1.55 + 0.1 * Math.sin(t * 2 + i), -41.5), Q, S3.set(1, 1.3, 1)); gems.setMatrixAt(i, M4); }
      else { M4.compose(V3.set(0, -50, 0), Q.identity(), S3.set(0, 0, 0)); gems.setMatrixAt(i, M4); }
    }
    gems.instanceMatrix.needsUpdate = true; if (gems.instanceColor) gems.instanceColor.needsUpdate = true;
    /* ── Carteles: puntitos de aviso ── */
    const on = labels.aOn;
    labels.ids.forEach((id, i) => { const v = (d.avisos && d.avisos[id]) ? 1 : 0; for (let c = 0; c < 4; c++) on.setX((i * 2 + 1) * 4 + c, v); });
    on.needsUpdate = true;
    /* ── Suelo: resalta la estación que tenés cerca ── */
    const u = parts.floorMat.uniforms.uNear.value;
    if (d.cerca) { u.x = d.cerca.x; u.y = d.cerca.z; u.z = d.cerca.r; u.w = Math.min(1, u.w + dt * 4); } else u.w = Math.max(0, u.w - dt * 4);
  };
  void low; void ESTACIONES;
  return fx;
}
