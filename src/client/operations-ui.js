import { CAMPAIGN_ORDER, CAMPAIGN_NAME, CAMPAIGN_BOSSES, cleanCampaign, campaignNext, campaignMemories } from '../sim/campaign.js';
import * as Perfil from './perfil.js';
import { OPERATIONS } from '../sim/operations.js';
export function buildOperations(menu) {
 const modes = document.createElement('section'); modes.id = 'modes'; modes.className = 'screen'; modes.dataset.screen = 'modes';
 modes.innerHTML = `<h3 class="stitle">Modos de juego</h3><p class="operation-lead">Elegí cómo entrar a VORTEX</p><div class="cards">
 <button type="button" class="card operation-card" data-go="story"><img src="/public/art/arena-m1.jpg" alt=""><div><small>HISTORIA · SOLITARIO</small><b>Campaña</b><small>${CAMPAIGN_NAME}. Seis capítulos conectados, encuentros finales y avance guardado entre capítulos.</small><small data-campaign-summary></small><p>Ver campaña →</p></div></button>
 <button type="button" class="card operation-card" data-go="arenas"><img src="/public/art/arena-m5.jpg" alt=""><div><small>PARTIDA INDEPENDIENTE</small><b>Misiones individuales</b><small>Elegí cualquiera de las seis misiones. Oleadas finitas, objetivos y un encuentro final. Ganá experiencia y botín sin modificar la campaña.</small><p>Elegir misión →</p></div></button>
 <button type="button" class="card operation-card" data-go="coop"><img src="/public/art/arena-m3.jpg" alt=""><div><small>DE 2 A 4 JUGADORES</small><b>Cooperativo</b><small>Completá misiones independientes con amigos. El anfitrión elige la misión. Progresá tu Huésped y conseguí botín; el cooperativo no avanza la campaña.</small><p>Abrir sala →</p></div></button>
 <button type="button" class="card operation-card" data-start="practica"><img src="/public/art/arena-m1.jpg" alt=""><div><small>ENTRENAMIENTO</small><b>Campo de pruebas</b><small>Probá tus huéspedes y armas sin riesgo.</small><p>Practicar →</p></div></button></div>`;
 menu.root.append(modes);
 const story = menu.root.querySelector('#story');
 story.innerHTML = `<h3 class="stitle">Campaña</h3><p class="operation-lead">${CAMPAIGN_NAME}</p><p class="hint">Despertás sin recuerdos. Querés escapar y recuperar un cuerpo. HERALDO te guía, pero ambos deberán descubrir qué ocurrió en VORTEX. Cada capítulo prepara el siguiente. Se guarda al completar capítulos; salir durante uno lo reinicia.</p><p data-campaign-summary></p><div class="campaign-actions"><button id="campaign" type="button" class="btn" data-campaign="continue">Comenzar campaña</button><button type="button" class="btn" data-campaign="new">Reiniciar campaña desde el capítulo 1</button></div><p class="hint">Reiniciar solo borra el avance de capítulos. Conservás tu equipo y tus recompensas.</p><ol class="campaign-route">${CAMPAIGN_ORDER.map(id => { const o=OPERATIONS[id];return `<li data-chapter="${id}"><img src="/public/art/arena-${id}.jpg" alt=""><div><small>CAPÍTULO ${o.chapter} · <span data-status></span></small><h4>${o.title}</h4><p data-chapter-context></p><p class="chapter-goal">${o.steps.map(s=>s.title).join(' → ')}${CAMPAIGN_BOSSES[id] ? ` → ${CAMPAIGN_BOSSES[id]}` : ''}</p><small data-chapter-reward></small></div></li>`; }).join('')}</ol>`;
 const root = menu.root.querySelector('#arenas');
 root.innerHTML = `<h3 class="stitle">Misiones individuales</h3><p class="operation-lead">Incursiones en los archivos de la campaña</p><p class="hint">Ordenadas según la historia; todas están disponibles. Jugarlas no avanza la campaña. Completá sus ocho oleadas y vencé al jefe final: eliminar enemigos por sí solo no alcanza. Si perdés el objetivo o se agota su tiempo, la misión fracasa.</p><div class="cards">${CAMPAIGN_ORDER.map((id, i) => { const o = OPERATIONS[id]; return `<button type="button" class="card operation-card" data-start="${id}"><img src="/public/art/arena-${id}.jpg" alt=""><div><small>CAPÍTULO ${o.chapter} · MISIÓN INDIVIDUAL · ${o.type}</small><b>${o.title}</b><small>${o.arena}<br>${o.type}</small><ol>${o.steps.map(s => `<li>${s.title}</li>`).join('')}</ol><small>Recompensas de Huésped · sin avance narrativo</small><small>Iniciar misión →</small></div></button>`; }).join('')}</div>`;
 const codex = document.createElement('section'); codex.id = 'arena-codex'; codex.className = 'screen'; codex.dataset.screen = 'arena-codex';
 codex.innerHTML = `<h3 class="stitle">Atlas de arenas</h3><p class="operation-lead">Los archivos de VORTEX</p><p class="hint">VORTEX reconstruye lugares y mitos humanos. Su origen se descubre en la campaña. Estos escenarios alojan las misiones. Consultá sus particularidades y elegí una operación desde Misiones.</p><div class="cards">${Object.entries(OPERATIONS).map(([id, o]) => `<article class="card operation-card" tabindex="0"><img src="/public/art/arena-${id}.jpg" alt=""><div><b>${o.arena}</b><small>${ARENAS[id]}</small><p>Misión: ${o.title}</p></div></article>`).join('')}</div>`;
 const memories = document.createElement('div'); memories.dataset.campaignMemories = '';
 memories.setAttribute('aria-label', 'Recuerdos recuperados'); codex.append(memories);
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

export function refreshCampaignMenu(menu) {
 const p = cleanCampaign(Perfil.perfil().campaign), next = campaignNext(p);
 const summary = next ? `${p.completed.length}/6 capítulos completados · Próximo: ${OPERATIONS[next].title}` : '6/6 capítulos completados · Canal de salida abierto';
 menu.root.querySelectorAll('[data-campaign-summary]').forEach(el => el.textContent = summary);
 const button = menu.root.querySelector('[data-campaign="continue"]');
 if(button) { button.disabled = !next; button.textContent = !next ? 'Campaña completada' : p.completed.length ? `Continuar · capítulo ${OPERATIONS[next].chapter}` : 'Comenzar campaña'; }
 const restart = menu.root.querySelector('[data-campaign="new"]'); if(restart) restart.hidden = !p.completed.length;
 menu.root.querySelectorAll('[data-chapter]').forEach(el => { const id = el.dataset.chapter; el.dataset.state = p.completed.includes(id) ? 'done' : id === next ? 'next' : 'locked'; el.querySelector('[data-status]').textContent = { done:'Completado', next:'Próximo capítulo', locked:'Pendiente — completá el anterior' }[el.dataset.state]; const o = OPERATIONS[id]; el.querySelector('[data-chapter-context]').textContent = el.dataset.state === 'locked' ? 'Descubrí este capítulo al avanzar en la historia.' : o.before; el.querySelector('[data-chapter-reward]').textContent = el.dataset.state === 'done' ? `Resultado: ${o.reward}` : 'Recuerdo por descubrir'; });
 const memories = menu.root.querySelector('[data-campaign-memories]');
 if (memories) {
   memories.replaceChildren(); const heading = document.createElement('h3'); heading.textContent = 'Recuerdos recuperados'; memories.append(heading);
   const unlocked = campaignMemories(p);
   if (!unlocked.length) { const note = document.createElement('p'); note.textContent = 'Completá capítulos de campaña para recuperar recuerdos. Las misiones independientes no revelan la historia.'; memories.append(note); }
   for (const memory of unlocked) {
     const entry = document.createElement('details'), title = document.createElement('summary'); title.textContent = memory.title; entry.append(title);
     for (const [who, line] of memory.lines) { const text = document.createElement('p'); text.textContent = `${who === 'H' ? 'HERALDO' : 'Vos'}: ${line}`; entry.append(text); }
     memories.append(entry);
   }
 }

}
