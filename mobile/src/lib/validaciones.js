// Mismas reglas que valida el backend.
export const soloLetras = (t) => String(t || '').replace(/[^\p{L} ]/gu, '').replace(/ {2,}/g, ' ');

export function validarNombre(nombre) {
  const limpio = String(nombre || '').trim().replace(/\s+/g, ' ');
  return limpio.length >= 2 && limpio.length <= 100 && /^\p{L}+(?: \p{L}+)*$/u.test(limpio);
}
export const validarCorreo = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c || '').trim());
export const validarContrasena = (c) => typeof c === 'string' && c.length >= 8 && c.length <= 72;
export const soloDigitos = (t, max) => String(t || '').replace(/\D/g, '').slice(0, max);
