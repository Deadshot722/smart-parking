// Dirección del backend. Se define en el archivo mobile/.env (ver .env.example):
//   EXPO_PUBLIC_API_URL=https://smart-parking-api.onrender.com        (backend publicado en Render)
//   EXPO_PUBLIC_API_URL=http://10.0.2.2:3001                          (backend en tu PC + emulador de Android Studio)
//   EXPO_PUBLIC_API_URL=http://192.168.1.50:3001                      (backend en tu PC + celular real, misma red Wi-Fi)
// Después de cambiar el .env, reinicia con:  npx expo start -c
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://TU-BACKEND.onrender.com').replace(/\/+$/, '');

// RNF-1: el aforo se consulta cada 2 segundos
export const INTERVALO_MS = 2000;
