// Registro e inicio de sesión con GitHub (OAuth 2.0).
// Flujo: la web o la app abren GET /api/auth/github -> GitHub pide permiso -> GitHub regresa a
// GET /api/auth/github/callback con un código -> se cambia por un token de GitHub -> se lee el correo
// verificado del usuario -> se crea (registro) o se busca (login) la cuenta -> se crea la sesión de Smart-Parking.
//
// Variables de entorno (Render):
//   GITHUB_CLIENT_ID       Client ID de la OAuth App de GitHub
//   GITHUB_CLIENT_SECRET   Client secret de la OAuth App
//   GITHUB_CALLBACK_URL    https://TU-WEB.vercel.app/api/auth/github/callback (igual que en GitHub)
//   WEB_URL                (opcional) https://TU-WEB.vercel.app  -> a dónde regresar en la web
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const usuarios = require('../modelo/usuarios');
const sesiones = require('../modelo/sesiones');
const { validarRol, errorNombre } = require('../validaciones');

const ESQUEMA_APP = 'smartparking://sesion'; // la app móvil Android recibe aquí el resultado
const VIGENCIA_STATE_MS = 10 * 60 * 1000;

const configurado = () => Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_CALLBACK_URL);

// ---------- "state" firmado: guarda modo/rol/origen y evita que alguien falsifique el regreso (CSRF) ----------
const firmar = (texto) => crypto.createHmac('sha256', process.env.GITHUB_CLIENT_SECRET).update(texto).digest('base64url');

function crearState(datos) {
    const cuerpo = Buffer.from(JSON.stringify({ ...datos, t: Date.now(), n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
    return `${cuerpo}.${firmar(cuerpo)}`;
}

function leerState(state) {
    const [cuerpo, firma] = String(state || '').split('.');
    if (!cuerpo || !firma) return null;
    const esperada = firmar(cuerpo);
    if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
    try {
        const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
        return Date.now() - datos.t <= VIGENCIA_STATE_MS ? datos : null;
    } catch {
        return null;
    }
}

// ---------- Regreso a la web o a la app (los datos van después de "#" para que no queden en registros del servidor) ----------
function regresar(res, origen, datos) {
    const fragmento = new URLSearchParams(datos).toString();
    if (origen === 'app') return res.redirect(`${ESQUEMA_APP}#${fragmento}`);
    return res.redirect(`${process.env.WEB_URL || ''}/github#${fragmento}`);
}

// GET /api/auth/github?modo=login|registro&rol=Conductor|Operador&origen=web|app
function inicio(req, res) {
    const origen = req.query.origen === 'app' ? 'app' : 'web';
    if (!configurado()) return regresar(res, origen, { error: 'El inicio de sesión con GitHub aún no está configurado en el servidor' });

    const modo = req.query.modo === 'registro' ? 'registro' : 'login';
    const rol = validarRol(req.query.rol) ? req.query.rol : 'Conductor';
    const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID,
        redirect_uri: process.env.GITHUB_CALLBACK_URL,
        scope: 'read:user user:email',
        state: crearState({ modo, rol, origen }),
        allow_signup: 'true',
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}

async function pedirGitHub(url, token) {
    const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Smart-Parking' },
        signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
    return r.json();
}

// El nombre en Smart-Parking solo admite letras y espacios
function nombreValido(perfil) {
    const limpio = String(perfil.name || perfil.login || '')
        .replace(/[^\p{L} ]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
    // Sin palabras repetidas y máximo 8 palabras (mismas reglas que el registro normal)
    const vistas = new Set();
    const palabras = limpio.split(' ').filter((p) => {
        const clave = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (clave.length >= 4 && vistas.has(clave)) return false;
        vistas.add(clave);
        return true;
    });
    const nombre = palabras.slice(0, 8).join(' ');
    return nombre.length >= 2 && errorNombre(nombre) === null ? nombre : 'Usuario GitHub';
}

// GET /api/auth/github/callback?code=...&state=...
async function callback(req, res) {
    const datos = configurado() ? leerState(req.query.state) : null;
    if (!datos) return regresar(res, 'web', { error: 'La solicitud de GitHub expiró o no es válida. Inténtalo de nuevo.' });
    if (req.query.error || !req.query.code) return regresar(res, datos.origen, { error: 'Cancelaste el acceso con GitHub.' });

    try {
        // 1) Código -> token de acceso de GitHub
        const r = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Smart-Parking' },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code: String(req.query.code),
                redirect_uri: process.env.GITHUB_CALLBACK_URL,
            }),
            signal: AbortSignal.timeout(10000),
        });
        const { access_token: tokenGitHub } = await r.json();
        if (!tokenGitHub) return regresar(res, datos.origen, { error: 'GitHub no autorizó el acceso. Inténtalo de nuevo.' });

        // 2) Perfil y correo principal verificado
        const perfil = await pedirGitHub('https://api.github.com/user', tokenGitHub);
        const correos = await pedirGitHub('https://api.github.com/user/emails', tokenGitHub);
        const principal = Array.isArray(correos) && (correos.find((c) => c.primary && c.verified) || correos.find((c) => c.verified));
        if (!principal) return regresar(res, datos.origen, { error: 'Tu cuenta de GitHub no tiene un correo verificado.' });
        const correo = String(principal.email).trim().toLowerCase();

        // 3) Buscar o crear la cuenta
        let usuario = await usuarios.buscarPorCorreoConHash(correo);
        if (!usuario) {
            if (datos.modo !== 'registro') {
                return regresar(res, datos.origen, {
                    error: `No existe una cuenta con ${correo}. Primero regístrate con GitHub.`,
                });
            }
            // La cuenta de GitHub no tiene contraseña de Smart-Parking: se guarda un hash aleatorio que nadie conoce
            const contrasenaHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
            usuario = await usuarios.crear({ nombre: nombreValido(perfil), correo, contrasenaHash, rol: datos.rol });
        }

        // 4) Sesión de Smart-Parking
        const token = await sesiones.crear(usuario.id_usuario);
        return regresar(res, datos.origen, { token });
    } catch (error) {
        console.error('Error con GitHub:', error.message);
        return regresar(res, datos.origen, { error: 'No se pudo conectar con GitHub. Inténtalo de nuevo.' });
    }
}

module.exports = { inicio, callback, crearState, leerState, nombreValido };
