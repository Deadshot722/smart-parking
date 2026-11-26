// Mismas reglas que valida el backend (backend/validaciones.js).

// Quita mientras se escribe todo lo que no sea letra (números, símbolos) y deja solo espacios simples.
export function soloLetras(texto) {
  return String(texto || '').replace(/[^\p{L} ]/gu, '').replace(/ {2,}/g, ' ');
}

// ---------- Nombre ----------
// Solo letras (con acentos y ñ) y espacios; máximo 8 palabras; sin repetir una palabra de 4 letras o más
// ("Pancracio pancracio" no) y sin la misma letra 3 veces seguidas ("Pancraaacio" no).
// Las palabras cortas sí se pueden repetir: "María de la Luz de la Cruz".
const quitarAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function errorNombre(nombre) {
  const limpio = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (limpio.length < 2 || limpio.length > 100) return 'El nombre debe tener entre 2 y 100 letras';
  if (!/^\p{L}+(?: \p{L}+)*$/u.test(limpio)) return 'El nombre solo puede contener letras y espacios';
  const palabras = limpio.split(' ');
  if (palabras.length > 8) return 'El nombre puede tener máximo 8 palabras';
  if (/(\p{L})\1\1/iu.test(quitarAcentos(limpio))) return 'El nombre no puede tener la misma letra 3 veces seguidas';
  const vistas = new Set();
  for (const p of palabras) {
    const clave = quitarAcentos(p);
    if (clave.length >= 4 && vistas.has(clave)) return 'El nombre no puede repetir la misma palabra';
    vistas.add(clave);
  }
  return null;
}

// ---------- Correo ----------
// Un solo @, y después del @ solo proveedores reales (no "@pepito").
// Antes del @: de 6 a 64 caracteres y con alguna letra (Gmail: de 6 a 30, solo letras, números y puntos).
export const DOMINIOS_PERMITIDOS = [
  'gmail.com', 'googlemail.com',
  'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com', 'live.com.mx', 'msn.com',
  'yahoo.com', 'yahoo.com.mx', 'yahoo.es',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'protonmail.com', 'proton.me', 'prodigy.net.mx',
  'ipn.mx', 'alumno.ipn.mx',
];
const REGEX_CORREO = /^[A-Za-z0-9_+-]+(?:\.[A-Za-z0-9_+-]+)*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function errorCorreo(correo) {
  const c = String(correo || '').trim().toLowerCase();
  if ((c.match(/@/g) || []).length !== 1) return 'El correo debe tener un solo @';
  if (c.length > 100 || !REGEX_CORREO.test(c)) return 'El correo no tiene un formato válido (ej. nombre@gmail.com)';
  const [usuario, dominio] = c.split('@');
  if (!DOMINIOS_PERMITIDOS.includes(dominio)) {
    return 'Usa un correo de un proveedor real: Gmail, Hotmail, Outlook, Live, Yahoo, iCloud o tu correo del IPN';
  }
  if (!/[a-z]/.test(usuario)) return 'La parte antes del @ debe tener al menos una letra';
  if (dominio === 'gmail.com' || dominio === 'googlemail.com') {
    const base = usuario.split('+')[0];
    if (base.replace(/\./g, '').length < 6 || base.length > 30 || !/^[a-z0-9.]+$/.test(base)) {
      return 'Un correo de Gmail tiene de 6 a 30 caracteres antes del @ (letras, números y puntos)';
    }
  } else if (usuario.length < 6 || usuario.length > 64) {
    return 'La parte antes del @ debe tener de 6 a 64 caracteres';
  }
  return null;
}

export const validarNombre = (nombre) => errorNombre(nombre) === null;
export const validarCorreo = (correo) => errorCorreo(correo) === null;

// ---------- Mientras se escribe el correo ----------
// Quita espacios y caracteres no válidos, y deja un solo @.
export function limpiarCorreo(texto) {
  const t = String(texto || '').replace(/[^A-Za-z0-9._+\-@]/g, '');
  const i = t.indexOf('@');
  return i === -1 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/@/g, '');
}

// ---------- Inicio de sesión ----------
// Solo forma de correo (sin lista de proveedores, para que entren las cuentas de prueba y las de GitHub)
// y contraseña de 8 a 72 caracteres. Mismas reglas que errorLogin del backend.
export function errorLogin(correo, contrasena) {
  const c = String(correo || '').trim();
  if (!c || !contrasena) return 'Ingresa tu correo y contraseña.';
  if ((c.match(/@/g) || []).length !== 1 || c.length > 100 || !REGEX_CORREO.test(c)) return 'Escribe un correo válido (ej. nombre@gmail.com).';
  if (contrasena.length < 8) return 'La contraseña tiene al menos 8 caracteres.';
  return null;
}

// ---------- Contraseña ----------
// Solo letras sin acento, números y estos símbolos. No se permiten $ % & ' " ; < > ni espacios.
export const SIMBOLOS_CONTRASENA = '._-!?#*';
export const limpiarContrasena = (texto) => String(texto || '').replace(/[^A-Za-z0-9._\-!?#*]/g, '').slice(0, 72);

export function validarContrasena(contrasena) {
  return (
    typeof contrasena === 'string' &&
    /^[A-Za-z0-9._\-!?#*]{8,72}$/.test(contrasena) &&
    /[A-Za-z]/.test(contrasena) &&
    /\d/.test(contrasena)
  );
}

// ---------- Horario del estacionamiento ----------
const minutosDeHora = (h) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(h || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Devuelve el texto de error o null. abre/cierra vienen de <input type="time"> ("HH:MM").
export function validarHoras(abre, cierra, todoElDia) {
  if (todoElDia) return null;
  if (!abre || !cierra) return 'Escribe la hora de apertura y la de cierre.';
  const a = minutosDeHora(abre);
  const c = minutosDeHora(cierra);
  if (a === null || c === null) return 'Las horas deben estar entre 00:00 y 23:59.';
  if (c <= a) return 'La hora de cierre debe ser posterior a la de apertura. Si abre todo el día marca "Abierto 24 horas".';
  if (c - a < 60) return 'El estacionamiento debe abrir al menos 1 hora.';
  return null;
}

export const armarHorario = (abre, cierra, todoElDia) => (todoElDia ? '24 horas' : `${abre} - ${cierra}`);

// "07:00 - 23:00" -> { abre: '07:00', cierra: '23:00', todoElDia: false }
export function separarHorario(horario) {
  if (horario === '24 horas') return { abre: '', cierra: '', todoElDia: true };
  const m = /^(\d{2}:\d{2}) - (\d{2}:\d{2})$/.exec(String(horario || ''));
  return m ? { abre: m[1], cierra: m[2], todoElDia: false } : { abre: '', cierra: '', todoElDia: false };
}

// ---------- Dirección (solo formato: no hay forma automática de saber si la dirección existe) ----------
export function validarDireccion(direccion) {
  const d = String(direccion || '').trim().replace(/\s+/g, ' ');
  if (d.length < 10) return 'La dirección debe tener al menos 10 caracteres.';
  if (d.length > 200) return 'La dirección admite máximo 200 caracteres.';
  if (!/^[\p{L}0-9 .,#\-/°]+$/u.test(d)) return 'La dirección solo puede tener letras, números, espacios y . , # - /';
  if (/(.)\1{3,}/u.test(d)) return 'La dirección no puede tener el mismo carácter repetido tantas veces.';
  if ((d.match(/\p{L}{3,}/gu) || []).length < 2) return 'Escribe una dirección completa (calle, número, colonia y ciudad).';
  if ((d.match(/\p{L}/gu) || []).length <= (d.match(/\d/g) || []).length) return 'La dirección debe tener más letras que números.';
  return null;
}

export const soloDigitos = (texto, max) => String(texto || '').replace(/\D/g, '').slice(0, max);

// ---------- Tarjeta (mismas reglas que backend/validaciones.js) ----------
// American Express (empieza con 34 o 37): 15 dígitos y CVV de 4. Visa, Mastercard y las demás: 16 dígitos y CVV de 3.
// El número además debe pasar el algoritmo de Luhn (el dígito verificador que traen todas las tarjetas reales).
export function marcaTarjeta(numero) {
  const n = soloDigitos(numero);
  if (/^3[47]/.test(n)) return 'American Express';
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  return 'Tarjeta';
}

export const esAmex = (numero) => marcaTarjeta(numero) === 'American Express';
export const largoTarjeta = (numero) => (esAmex(numero) ? 15 : 16);
export const largoCVV = (numero) => (esAmex(numero) ? 4 : 3);

function pasaLuhn(n) {
  let suma = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  return suma % 10 === 0;
}

// Mientras se escribe: Amex en grupos 4-6-5 ("3782 822463 10005"), las demás en grupos de 4.
export function formatearTarjeta(texto) {
  const n = soloDigitos(texto, 16);
  if (esAmex(n)) {
    const d = n.slice(0, 15);
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10)].filter(Boolean).join(' ');
  }
  return n.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function errorTarjeta(numero) {
  const n = soloDigitos(numero);
  if (!n) return 'Escribe el número de tarjeta.';
  if (esAmex(n) && n.length !== 15) return 'Una tarjeta American Express tiene 15 dígitos.';
  if (!esAmex(n) && n.length !== 16) return 'El número de tarjeta debe tener 16 dígitos.';
  if (!pasaLuhn(n)) return 'El número de tarjeta no es válido, revisa que esté bien escrito.';
  return null;
}

export function errorVencimiento(texto) {
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(String(texto || ''));
  if (!m) return 'El vencimiento debe tener el formato MM/AA.';
  const hoy = new Date();
  const anio = 2000 + Number(m[2]);
  if (anio < hoy.getFullYear() || (anio === hoy.getFullYear() && Number(m[1]) < hoy.getMonth() + 1)) return 'La tarjeta está vencida.';
  return null;
}

export function errorCVV(cvv, numero) {
  const largo = largoCVV(numero);
  if (!new RegExp(`^\\d{${largo}}$`).test(String(cvv || ''))) {
    return largo === 4 ? 'En American Express el CVV tiene 4 dígitos (está al frente de la tarjeta).' : 'El CVV debe tener 3 dígitos.';
  }
  return null;
}

// Titular: como aparece en la tarjeta, con nombre y apellido; mismas reglas que el nombre, máximo 40 letras.
export function errorTitular(titular) {
  const limpio = String(titular || '').trim().replace(/\s+/g, ' ');
  if (!limpio) return 'Escribe el nombre del titular de la tarjeta.';
  if (limpio.length > 40) return 'El nombre del titular admite máximo 40 caracteres.';
  const problema = errorNombre(limpio);
  if (problema) return `${problema.replace('El nombre', 'El nombre del titular')}.`;
  if (limpio.split(' ').length < 2) return 'Escribe el nombre y apellido del titular, como aparece en la tarjeta.';
  return null;
}
