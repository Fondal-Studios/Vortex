// Una sola cronología para campaña, briefings y selección de misiones.
export const CAMPAIGN_ORDER = Object.freeze(['m1', 'm3', 'm4', 'm5', 'm6', 'm2']);
export const CAMPAIGN_NAME = 'La salida de VORTEX';
export const CAMPAIGN_BOSSES = Object.freeze({ m1: 'Coloso Prismático', m2: 'Madre Geoda' });
export const CAMPAIGN_LINKS = {
 m1: { before: 'Tras el accidente, tu identidad se fragmentó. HERALDO necesita un refugio estable para reconstruirla.', after: 'La clave recuperada abre el Laberinto, pero sus ojos siguen vigilando la ruta.', reward: 'Recuperás tu clave de identidad y el acceso al Laberinto.' },
 m3: { before: 'Con tu clave recuperada, entrás al Laberinto para apagar la vigilancia que bloquea a los demás cautivos.', after: 'La vigilancia cayó. El acceso al Jardín está libre, pero el puente de evacuación todavía no existe.', reward: 'Desactivás la vigilancia y abrís el acceso al Jardín.' },
 m4: { before: 'Sin vigilancia, podés reconstruir el puente vivo que conecta los archivos aislados con la Plaza.', after: 'El puente está abierto. Las memorias evacuadas señalan una voz atrapada en el bucle de Praga.', reward: 'Creás una ruta segura hacia la Plaza de los Ecos.' },
 m5: { before: 'La ruta viva llega a una ciudad que repite sus recuerdos. La voz cautiva contiene el destino de la transferencia.', after: 'El bucle se rompió. La memoria recuperada identifica un cuerpo compatible archivado en el Osario.', reward: 'Recuperás la ubicación del archivo genómico del Osario.' },
 m6: { before: 'Ya sabés quién sos y adónde transferirte. Falta recuperar del Osario el vínculo con tu futuro cuerpo.', after: 'El vínculo está a salvo. Todos los archivos apuntan al canal de salida de la Cámara Fractal.', reward: 'Recuperás el vínculo genómico que permite salir de VORTEX.' },
 m2: { before: 'Identidad, ruta y cuerpo están preparados. La Madre Geoda mantiene cerrado el último canal de salida.', after: 'La Madre Geoda cayó. El canal está abierto y la transferencia puede completarse.', reward: 'Liberás tu conciencia y completás la transferencia fuera de la red.' },
};
export function cleanCampaign(value) {
 const raw = Array.isArray(value?.completed) ? value.completed : [], completed = [];
 for (const id of CAMPAIGN_ORDER) { if (!raw.includes(id)) break; completed.push(id); }
 return { completed };
}
export function campaignNext(value) { return CAMPAIGN_ORDER[cleanCampaign(value).completed.length] || null; }
export function completeChapter(value, id) {
 const progress = cleanCampaign(value);
 if (id === campaignNext(progress)) progress.completed.push(id);
 return progress;
}
