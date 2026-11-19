// Mismas reglas que valida el backend (backend/validaciones.js).

// Quita mientras se escribe todo lo que no sea letra (números, símbolos) y deja solo espacios simples.
export function soloLetras(texto) {
  return String(texto || '').replace(/[^\p{L} ]/gu, '').replace(/ {2,}/g, ' ');
}

// Solo letras (con acentos y ñ) y espacios entre palabras: sin números ni símbolos.
export function validarNombre(nombre) {
  const limpio = String(nombre || '').trim().replace(/\s+/g, ' ');
  return limpio.length >= 2 && limpio.length <= 100 && /^\p{L}+(?: \p{L}+)*$/u.test(limpio);
}

export function validarCorreo(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo || '').trim());
}

export function validarContrasena(contrasena) {
  return typeof contrasena === 'string' && contrasena.length >= 8 && contrasena.length <= 72;
}

export const soloDigitos = (texto, max) => String(texto || '').replace(/\D/g, '').slice(0, max);
