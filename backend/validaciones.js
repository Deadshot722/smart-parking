// Funciones de validación (se usan en los controladores). Mismas reglas que en web y móvil.

// El nombre solo puede tener letras (con acentos y ñ) y espacios entre palabras. Sin números ni símbolos.
function validarNombre(nombre) {
    if (typeof nombre !== 'string') return false;
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    return limpio.length >= 2 && limpio.length <= 100 && /^\p{L}+(?: \p{L}+)*$/u.test(limpio);
}

function validarCorreo(correo) {
    if (typeof correo !== 'string' || correo.length > 100) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
}

function validarContrasena(contrasena) {
    return typeof contrasena === 'string' && contrasena.length >= 8 && contrasena.length <= 72;
}

// RNF-8: la tarjeta debe tener 16 dígitos, vencimiento MM/AA vigente y CVV de 3 dígitos.
function validarTarjeta(numero) {
    return typeof numero === 'string' && /^\d{16}$/.test(numero.replace(/\s/g, ''));
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

function validarCVV(cvv) {
    return typeof cvv === 'string' && /^\d{3}$/.test(cvv);
}

function validarFolio(folio) {
    return typeof folio === 'string' && /^[A-Za-z0-9-]{1,20}$/.test(folio.trim());
}

function validarEnteroPositivo(valor) {
    const n = Number(valor);
    return Number.isInteger(n) && n > 0;
}

module.exports = {
    validarNombre,
    validarCorreo,
    validarContrasena,
    validarTarjeta,
    validarVencimiento,
    validarCVV,
    validarFolio,
    validarEnteroPositivo,
};
