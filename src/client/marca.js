// MARCA del juego: el nombre y el subtítulo viven SOLO acá. Si algún día cambia el título, se cambia en este archivo
// (y en public/manifest.webmanifest, que el navegador lee aparte; tests/marca.test.js avisa si dejan de coincidir).
export const MARCA = {
  nombre: 'VORTEX',
  /** Dos líneas del logo grande (título y menú): la primera en fino, la segunda en grande. */
  logo: ['', 'VORTEX'],
  corto: 'Vortex',
  subtitulo: 'Recuperá tu identidad. Escapá de la red.',
  legal: 'Acción psicodélica en 3D · PC · iPhone · 1–4 jugadores',
  /** Nombre del mundo: el limbo donde pasa todo. */
  mundo: 'el Vórtice',
  descripcion: 'Tu conciencia está atrapada en una red digital. Enlazá un Huésped de genoma humano e IA, recuperá tu identidad y abrí la salida.',
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
