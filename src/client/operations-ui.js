import { OPERATIONS } from '../sim/operations.js';
export function buildOperations(menu) {
 const root = menu.root.querySelector('#arenas');
 root.innerHTML = `<h3 class="stitle">Misiones</h3><p class="operation-lead">Conciencias atrapadas. Una ruta de salida.</p><p class="hint">Elegí una operación. Completá sus tres etapas: eliminar enemigos por sí solo no alcanza. Si perdés el objetivo o se agota su tiempo, la misión fracasa.</p><div class="cards">${Object.entries(OPERATIONS).map(([id, o], i) => `<button type="button" class="card operation-card" data-start="${id}"><img src="/public/art/arena-${id}.jpg" alt=""><div><small>OPERACIÓN 0${i+1} · ${o.type}</small><b>${o.title}</b><small>${o.arena}<br>${o.story}</small><ol>${o.steps.map(s => `<li>${s.title}</li>`).join('')}</ol><small>Iniciar misión →</small></div></button>`).join('')}<button type="button" class="card" data-start="practica"><img src="/public/art/arena-m1.jpg" alt=""><div><b>Campo de pruebas</b><small>Practicá con huéspedes y armas sin riesgo.</small></div></button></div>`;
 const codex = document.createElement('section'); codex.id = 'arena-codex'; codex.className = 'screen'; codex.dataset.screen = 'arena-codex';
 codex.innerHTML = `<h3 class="stitle">Atlas de arenas</h3><p class="operation-lead">Los archivos de VORTEX</p><p class="hint">Estos escenarios alojan las misiones. Consultá sus particularidades y elegí una operación desde Misiones.</p><div class="cards">${Object.entries(OPERATIONS).map(([id, o]) => `<article class="card operation-card" tabindex="0"><img src="/public/art/arena-${id}.jpg" alt=""><div><b>${o.arena}</b><small>${ARENAS[id]}</small><p>Misión: ${o.title}</p></div></article>`).join('')}</div>`;
 menu.root.append(codex);
}
const ARENAS = {
 m1: 'Islas de gravedad rota conectadas por portales. Seguí las conexiones para alcanzar los terminales y el altar.',
 m2: 'Una esfera hueca con gravedad cambiante. La flecha del objetivo te orienta dentro de la cámara.',
 m3: 'Muros de cristal y ojos de vigilancia. Usá los pasillos para acercarte al custodio y cubrir la zona segura.',
 m4: 'Un planeta vivo. Alimentá los capullos para construir el puente antes de intentar la extracción.',
 m5: 'Un archivo de Praga. Los soportales guardan memoria y el reloj señala el canal de salida.',
 m6: 'Una iglesia de huesos en cruz. Seguí las losas claras hacia el altar de transferencia.',
};
