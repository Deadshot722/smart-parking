import { API_URL } from '../config';

let token = '';
let alExpirar = null;

export const ponerToken = (t) => { token = t || ''; };
export const alSesionExpirada = (fn) => { alExpirar = fn; };

const SIN_RED = 'No hay conexión con el servidor. Revisa tu red y vuelve a intentar.';

// Una sola función para hablar con el backend: manda el token, revisa res.ok y lanza el error que mande el backend.
export async function pedirJSON(ruta, opciones = {}) {
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 10000);
  let res;
  try {
    res = await fetch(`${API_URL}/api${ruta}`, {
      ...opciones,
      signal: control.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opciones.headers,
      },
    });
  } catch {
    throw new Error(SIN_RED);
  } finally {
    clearTimeout(limite);
  }

  let datos = null;
  try {
    datos = await res.json();
  } catch {
    datos = null;
  }
  if (!res.ok) {
    if (res.status === 401 && token && alExpirar) alExpirar();
    throw new Error((datos && datos.error) || (res.status >= 500 ? SIN_RED : `El servidor respondió ${res.status}`));
  }
  return datos;
}

export const enviar = (ruta, metodo, cuerpo) =>
  pedirJSON(ruta, { method: metodo, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
