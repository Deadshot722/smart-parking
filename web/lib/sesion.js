// La sesión se guarda en localStorage (token + datos del usuario). Todo va en try/catch por si el navegador lo bloquea.
const CLAVE = 'smart-parking-sesion';

export function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || null;
  } catch {
    return null;
  }
}

export const leerToken = () => (leerSesion() || {}).token || '';

export function guardarSesion(datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {}
}

export function cerrarLocal() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {}
}
