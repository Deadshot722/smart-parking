// Límite de intentos fallidos de inicio de sesión (evita que alguien pruebe contraseñas sin parar).
// Después de LOGIN_MAX_INTENTOS fallos seguidos con el mismo correo, ese correo queda bloqueado
// LOGIN_BLOQUEO_MIN minutos. Se guarda en memoria: si el servidor se reinicia, el contador vuelve a 0.
const MAX_INTENTOS = Number(process.env.LOGIN_MAX_INTENTOS) || 5;
const BLOQUEO_MS = (Number(process.env.LOGIN_BLOQUEO_MIN) || 15) * 60 * 1000;

const fallos = new Map(); // correo -> { intentos, hasta }

function limpiarViejos(ahora) {
    if (fallos.size < 5000) return;
    for (const [clave, f] of fallos) if (f.hasta < ahora && f.ultimo + BLOQUEO_MS < ahora) fallos.delete(clave);
}

// Minutos que faltan si el correo está bloqueado, o 0 si puede intentar.
function minutosBloqueado(correo) {
    const f = fallos.get(correo);
    if (!f || f.hasta <= Date.now()) return 0;
    return Math.ceil((f.hasta - Date.now()) / 60000);
}

// Registra un intento fallido. Devuelve cuántos intentos le quedan (0 = se acaba de bloquear).
function registrarFallo(correo) {
    const ahora = Date.now();
    limpiarViejos(ahora);
    let f = fallos.get(correo);
    // Los fallos viejos (de hace más que el tiempo de bloqueo) ya no cuentan
    if (!f || f.ultimo + BLOQUEO_MS < ahora || (f.hasta && f.hasta <= ahora)) f = { intentos: 0, hasta: 0, ultimo: ahora };
    f.intentos += 1;
    f.ultimo = ahora;
    if (f.intentos >= MAX_INTENTOS) {
        f.hasta = ahora + BLOQUEO_MS;
        f.intentos = 0;
    }
    fallos.set(correo, f);
    return f.hasta > ahora ? 0 : MAX_INTENTOS - f.intentos;
}

function limpiar(correo) {
    fallos.delete(correo);
}

module.exports = { minutosBloqueado, registrarFallo, limpiar, MAX_INTENTOS };
