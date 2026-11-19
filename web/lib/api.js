import { leerToken, cerrarLocal } from './sesion';

const BACKEND_CAIDO = 'El servidor no responde. Revisa que el backend esté encendido (npm start en la carpeta backend).';

// Una sola función para hablar con el backend: manda el token, revisa res.ok y lanza el error que mande el backend.
export async function pedirJSON(ruta, opciones = {}) {
  const token = leerToken();
  let res;
  try {
    res = await fetch(`/api${ruta}`, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opciones.headers,
      },
    });
  } catch {
    throw new Error(BACKEND_CAIDO);
  }

  let datos = null;
  try {
    datos = await res.json();
  } catch {
    datos = null; // 204 no trae cuerpo
  }

  if (!res.ok) {
    if (res.status === 401 && token) cerrarLocal(); // la sesión expiró
    if (datos && datos.error) throw new Error(datos.error);
    throw new Error(res.status >= 500 ? BACKEND_CAIDO : `El servidor respondió ${res.status}`);
  }
  return datos;
}

export const enviar = (ruta, metodo, cuerpo) =>
  pedirJSON(ruta, { method: metodo, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
