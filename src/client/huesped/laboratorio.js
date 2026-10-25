// HÍBRIDO DE LABORATORIO — diseño del cuerpo del jugador (EH-03, docs/EDITOR_HUESPEDES.md §3.4). Misma firma que los 8 Huéspedes oficiales: `build(ak, ctx)`.
// `ctx.lab` = la CustomHostBuild (src/shared/host-build.js) ya validada. Se dibuja cada instancia de `instancias(lab)` (espejo = 2) con los generadores de lab-piezas.js,
// y encima la evolución del chasis (huesped-evo-piezas.js) igual que los oficiales. Las proporciones NO se dibujan acá: son escalas de hueso (lab-prop.js) y no reconstruyen.
// Devuelve { update, proxies, dispose }: `proxies` = una zona de selección por instancia (para tocar la pieza en el visor del editor).
import * as T from 'three';
import { instancias } from '../../shared/host-build.js';
import { tools } from '../huesped-piezas.js';
import { addEvolution } from '../huesped-evo-piezas.js';
import { construirInstancia } from './lab-piezas.js';

export const BELLY = 0;   // sin vientre de brasa propio: las piezas (adrenal, saco…) lo ponen si el jugador las elige

/** Materiales del kit sólo de ESTE cuerpo (cada cuerpo crea los suyos): el metal más mate para que no se vea negro contra el cielo oscuro del visor. */
export function postFinish(ak) {
  const m = ak.mats.metal; if (m) { m.metalness = 0.55; m.roughness = 0.5; m.envMapIntensity = 1.6; m.needsUpdate = true; }
}

export function build(ak, ctx) {
  const lab = ctx.lab, proxies = [], geos = [], mats = [];
  if (lab && Array.isArray(lab.partes)) {
    for (const x of instancias(lab)) {
      let o = null;
      try { o = construirInstancia(ak, x, { pal: lab.pal }); } catch (e) { console.warn('Laboratorio: pieza «' + x.p + '» no se pudo dibujar —', e.message); }
      if (!o || !o.group) continue;
      // zona de selección: esfera invisible (no se dibuja; el rayo del visor sí la toca)
      const geo = new T.SphereGeometry(1, 10, 8), mat = new T.MeshBasicMaterial({ visible: false }), mesh = new T.Mesh(geo, mat);
      mesh.scale.setScalar(o.radius); mesh.name = 'lab-zona'; mesh.userData.lab = { i: x.i, lado: x.lado, p: x.p, a: x.a }; o.group.add(mesh);
      geos.push(geo); mats.push(mat); proxies.push({ i: x.i, lado: x.lado, p: x.p, a: x.a, group: o.group, mesh, radius: o.radius });
    }
  }
  const evo = addEvolution(ak, ctx, { t: tools(ak), pal: { bone: 0xd8c8a4, boneL: 0xfff0d6 } });
  return {
    proxies,
    update: (dt, tt, c) => { evo.update(dt, tt, c); },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); proxies.length = 0; },
  };
}
