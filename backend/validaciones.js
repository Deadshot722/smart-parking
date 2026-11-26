// Funciones de validación (se usan en los controladores). Mismas reglas que en web/lib/validaciones.js.
// Nota: la base de datos ya está protegida contra inyección SQL porque todas las consultas usan
// parámetros (?, $1...). Estas reglas además limitan qué caracteres se aceptan en cada campo.

// ---------- Nombre ----------
// Solo letras (con acentos y ñ) y espacios; máximo 8 palabras; sin repetir una palabra de 4 letras o más
// ("Pancracio pancracio" no) y sin la misma letra 3 veces seguidas ("Pancraaacio" no).
// Las palabras cortas sí se pueden repetir: "María de la Luz de la Cruz".
const quitarAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function errorNombre(nombre) {
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
const DOMINIOS_PERMITIDOS = [
    'gmail.com', 'googlemail.com',
    'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com', 'live.com.mx', 'msn.com',
    'yahoo.com', 'yahoo.com.mx', 'yahoo.es',
    'icloud.com', 'me.com', 'mac.com',
    'aol.com', 'protonmail.com', 'proton.me', 'prodigy.net.mx',
    'ipn.mx', 'alumno.ipn.mx',
];
const REGEX_CORREO = /^[A-Za-z0-9_+-]+(?:\.[A-Za-z0-9_+-]+)*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

function errorCorreo(correo) {
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

const validarNombre = (nombre) => errorNombre(nombre) === null;
const validarCorreo = (correo) => errorCorreo(correo) === null;

// ---------- Inicio de sesión ----------
// Aquí NO se exige la lista de proveedores: solo que tenga forma de correo (las cuentas de prueba
// @smartparking.mx y las de GitHub deben poder entrar). La contraseña debe cumplir el formato del registro.
function errorLogin(correo, contrasena) {
    const c = String(correo || '').trim();
    if (!c || !contrasena) return 'Ingresa tu correo y contraseña';
    if ((c.match(/@/g) || []).length !== 1 || c.length > 100 || !REGEX_CORREO.test(c)) {
        return 'Escribe un correo válido (ej. nombre@gmail.com)';
    }
    if (typeof contrasena !== 'string' || contrasena.length < 8 || contrasena.length > 72) {
        return 'La contraseña tiene de 8 a 72 caracteres';
    }
    return null;
}

// Contraseña: 8 a 72 caracteres; solo letras sin acento, números y los símbolos . _ - ! ? # *
// Debe tener al menos una letra y un número. No se permiten $ % & ' " ; < > espacios, etc.
const SIMBOLOS_CONTRASENA = '._-!?#*';
const REGEX_CONTRASENA = /^[A-Za-z0-9._\-!?#*]{8,72}$/;
function validarContrasena(contrasena) {
    return (
        typeof contrasena === 'string' &&
        REGEX_CONTRASENA.test(contrasena) &&
        /[A-Za-z]/.test(contrasena) &&
        /\d/.test(contrasena)
    );
}

const ROLES = ['Conductor', 'Operador'];
const validarRol = (rol) => ROLES.includes(rol);

// Hora en formato 24 h "HH:MM" (00:00 a 23:59). Devuelve los minutos desde medianoche o null.
function minutosDeHora(texto) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(texto || '').trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Horario del estacionamiento: "24 horas" o "HH:MM - HH:MM" con apertura antes del cierre
// y al menos 1 hora abierto (así no se puede guardar "00:00 - 00:00").
function validarHorario(horario) {
    if (typeof horario !== 'string' || !horario.trim()) return 'El horario es obligatorio';
    if (horario.trim() === '24 horas') return null;
    const m = /^(\d{2}:\d{2}) - (\d{2}:\d{2})$/.exec(horario.trim());
    if (!m) return 'El horario debe tener el formato HH:MM - HH:MM';
    const abre = minutosDeHora(m[1]);
    const cierra = minutosDeHora(m[2]);
    if (abre === null || cierra === null) return 'Las horas deben estar entre 00:00 y 23:59';
    if (cierra <= abre) return 'La hora de cierre debe ser posterior a la de apertura (si abre todo el día marca "24 horas")';
    if (cierra - abre < 60) return 'El estacionamiento debe abrir al menos 1 hora';
    return null;
}

// Dirección: solo revisión de formato (no hay forma automática de saber si existe; ver util/geocodificar.js).
// - 10 a 200 caracteres; solo letras, números, espacios y . , # - / °
// - al menos 2 palabras de 3+ letras (calle y colonia/ciudad), más letras que números
// - sin el mismo carácter repetido 4 veces seguidas (ej. "aaaa", "1111", "....")
function validarDireccion(direccion) {
    if (typeof direccion !== 'string') return 'La dirección es obligatoria';
    const d = direccion.trim().replace(/\s+/g, ' ');
    if (d.length < 10) return 'La dirección debe tener al menos 10 caracteres';
    if (d.length > 200) return 'La dirección admite máximo 200 caracteres';
    if (!/^[\p{L}0-9 .,#\-/°]+$/u.test(d)) return 'La dirección solo puede tener letras, números, espacios y . , # - /';
    if (/(.)\1{3,}/u.test(d)) return 'La dirección no puede tener el mismo carácter repetido tantas veces';
    const palabras = d.match(/\p{L}{3,}/gu) || [];
    if (palabras.length < 2) return 'Escribe una dirección completa (calle, número, colonia y ciudad)';
    const letras = (d.match(/\p{L}/gu) || []).length;
    const digitos = (d.match(/\d/g) || []).length;
    if (letras <= digitos) return 'La dirección debe tener más letras que números';
    return null;
}

// ---------- Tarjeta (RNF-8) ----------
// American Express (empieza con 34 o 37): 15 dígitos y CVV de 4. Visa, Mastercard y las demás: 16 dígitos y CVV de 3.
// El número además debe pasar el algoritmo de Luhn (el dígito verificador que traen todas las tarjetas reales).
const soloDigitosTarjeta = (numero) => String(numero || '').replace(/[\s-]/g, '');

function marcaTarjeta(numero) {
    const n = soloDigitosTarjeta(numero);
    if (/^3[47]/.test(n)) return 'American Express';
    if (/^4/.test(n)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
    return 'Tarjeta';
}

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

function errorTarjeta(numero) {
    const n = soloDigitosTarjeta(numero);
    if (!n) return 'Escribe el número de tarjeta';
    if (!/^\d+$/.test(n)) return 'El número de tarjeta solo puede tener dígitos';
    const esAmex = marcaTarjeta(n) === 'American Express';
    if (esAmex && n.length !== 15) return 'Una tarjeta American Express tiene 15 dígitos';
    if (!esAmex && n.length !== 16) return 'El número de tarjeta debe tener 16 dígitos';
    if (!pasaLuhn(n)) return 'El número de tarjeta no es válido, revisa que esté bien escrito';
    return null;
}

function errorCVV(cvv, numero) {
    const largo = marcaTarjeta(numero) === 'American Express' ? 4 : 3;
    if (typeof cvv !== 'string' || !new RegExp(`^\\d{${largo}}$`).test(cvv)) {
        return largo === 4 ? 'En American Express el CVV tiene 4 dígitos (está al frente de la tarjeta)' : 'El CVV debe tener 3 dígitos';
    }
    return null;
}

// Titular: como aparece en la tarjeta. Mismas reglas que el nombre, con nombre y apellido, máximo 40 letras.
function errorTitular(titular) {
    const limpio = String(titular || '').trim().replace(/\s+/g, ' ');
    if (!limpio) return 'Escribe el nombre del titular de la tarjeta';
    if (limpio.length > 40) return 'El nombre del titular admite máximo 40 caracteres';
    const problema = errorNombre(limpio);
    if (problema) return problema.replace('El nombre', 'El nombre del titular');
    if (limpio.split(' ').length < 2) return 'Escribe el nombre y apellido del titular, como aparece en la tarjeta';
    return null;
}

function validarVencimiento(texto) {
    if (typeof texto !== 'string') return false;
    const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(texto.trim());
    if (!m) return false;
    const ahora = new Date();
    const anio = 2000 + Number(m[2]);
    const mes = Number(m[1]);
    return anio > ahora.getFullYear() || (anio === ahora.getFullYear() && mes >= ahora.getMonth() + 1);
}

function validarFolio(folio) {
    return typeof folio === 'string' && /^[A-Za-z0-9-]{1,20}$/.test(folio.trim());
}

function validarEnteroPositivo(valor) {
    const n = Number(valor);
    return Number.isInteger(n) && n > 0;
}

module.exports = {
    errorNombre,
    errorCorreo,
    DOMINIOS_PERMITIDOS,
    validarNombre,
    validarCorreo,
    errorLogin,
    validarContrasena,
    SIMBOLOS_CONTRASENA,
    validarRol,
    minutosDeHora,
    validarHorario,
    validarDireccion,
    marcaTarjeta,
    errorTarjeta,
    errorCVV,
    errorTitular,
    validarVencimiento,
    validarFolio,
    validarEnteroPositivo,
};
