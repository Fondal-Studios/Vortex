// Prólogo retirado: la campaña comienza con el despertar dentro de VORTEX.
// La estación y los modelos humanos siguen disponibles como recursos de archivo.
export function startPrologue({ onDone = () => {} } = {}) {
  let stopped = false;
  const tick = () => { if (!stopped) { stopped = true; onDone(); } };
  return { ready: Promise.resolve(), tick, step: tick, seek: tick, stop() { stopped = true; } };
}
