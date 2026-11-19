import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE = 'smart-parking-sesion';

export async function leerSesion() {
  try {
    return JSON.parse(await AsyncStorage.getItem(CLAVE)) || null;
  } catch {
    return null;
  }
}

export async function guardarSesion(datos) {
  try {
    await AsyncStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {}
}

// CU-1.3 flujo alterno 2: sin red igual se borran las credenciales locales
export async function borrarSesion() {
  try {
    await AsyncStorage.removeItem(CLAVE);
  } catch {}
}
