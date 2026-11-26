const sesiones = require('../modelo/sesiones');

// Lee "Authorization: Bearer <token>" y deja el usuario en req.usuario.
async function requerirSesion(req, res, next) {
    try {
        const cabecera = req.headers.authorization || '';
        const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';
        if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar' });

        const usuario = await sesiones.usuarioPorToken(token);
        if (!usuario) return res.status(401).json({ error: 'Tu sesión expiró. Inicia sesión de nuevo' });

        req.usuario = usuario;
        req.token = token;
        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Se usa después de requerirSesion: requerirRol('Operador')
function requerirRol(rol) {
    return (req, res, next) => {
        if (!req.usuario || req.usuario.rol !== rol) {
            return res.status(403).json({ error: `Solo disponible para el rol ${rol}` });
        }
        next();
    };
}

module.exports = { requerirSesion, requerirRol };
