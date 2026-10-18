// MARCA del juego: el nombre y el subtítulo viven SOLO acá. Si algún día cambia el título, se cambia en este archivo
// (y en public/manifest.webmanifest, que el navegador lee aparte; tests/marca.test.js avisa si dejan de coincidir).
export const MARCA = {
  nombre: 'PACTO PSICO',
  /** Dos líneas del logo grande (título y menú): la primera en fino, la segunda en grande. */
  logo: ['PACTO', 'PSICO'],
  corto: 'Pacto Psico',
  subtitulo: 'Sobrevivir al Vórtice, donde la gravedad es solo una opinión',
  legal: 'Acción psicodélica en 3D · PC · iPhone · 1–4 jugadores',
  /** Nombre del mundo: el limbo donde pasa todo. */
  mundo: 'el Vórtice',
  descripcion: 'Acción psicodélica en 3D en el limbo: pactá con un Huésped, evolucioná y sobreviví al Vórtice, solo o hasta 4 en cooperativo.',
};
/** Escribe la marca en el documento (título de la pestaña, logo, pantalla de carga). Se llama una vez al arrancar el menú. */
export function aplicarMarca(doc = document) {
  doc.title = MARCA.nombre;
  const set = (sel, fn) => doc.querySelectorAll(sel).forEach(fn);
  set('[data-marca="nombre"]', (e) => { e.textContent = MARCA.nombre; });
  set('[data-marca="logo1"]', (e) => { e.textContent = MARCA.logo[0]; });
  set('[data-marca="logo2"]', (e) => { e.textContent = MARCA.logo[1]; });
  set('[data-marca="subtitulo"]', (e) => { e.textContent = MARCA.subtitulo; });
  set('[data-marca="legal"]', (e) => { e.textContent = MARCA.legal; });
  set('meta[name="apple-mobile-web-app-title"]', (e) => e.setAttribute('content', MARCA.corto));
}
