const bcrypt = require('bcryptjs');
const usuarios = require('../modelo/usuarios');
const sesiones = require('../modelo/sesiones');
const { manejar } = require('../util/http');
const intentos = require('../util/intentos');
const { errorNombre, errorCorreo, errorLogin, validarContrasena, validarRol, SIMBOLOS_CONTRASENA } = require('../validaciones');

// CU-1.1 Registrar cuenta: al registrarse se elige el rol (Conductor u Operador)
const registro = manejar(async (req, res) => {
    const { nombre, correo, contrasena, rol } = req.body || {};
    if (!nombre || !correo || !contrasena || !rol) {
        return res.status(400).json({ error: 'Completa todos los campos (nombre, correo, contraseña y tipo de cuenta)' });
    }
    if (!validarRol(rol)) return res.status(400).json({ error: 'El tipo de cuenta debe ser Conductor u Operador' });
    const problemaNombre = errorNombre(nombre);
    if (problemaNombre) return res.status(400).json({ error: problemaNombre });
    const problemaCorreo = errorCorreo(correo);
    if (problemaCorreo) return res.status(400).json({ error: problemaCorreo });
    if (!validarContrasena(contrasena)) {
        return res.status(400).json({
            error: `La contraseña debe tener de 8 a 72 caracteres, al menos una letra y un número, y solo puede usar letras, números y ${SIMBOLOS_CONTRASENA}`,
        });
    }

    try {
        const contrasenaHash = await bcrypt.hash(contrasena, 10); // RNF-5
        const nuevo = await usuarios.crear({
            nombre: nombre.trim().replace(/\s+/g, ' '),
            correo: correo.trim().toLowerCase(),
            contrasenaHash,
            rol,
        });
        res.status(201).json({ mensaje: 'Cuenta registrada correctamente', usuario: nuevo });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Ese correo ya está registrado' });
        throw error;
    }
});

// CU-1.2 Iniciar sesión
// Validación del inicio de sesión:
//   1) formato: correo con forma de correo y contraseña de 8 a 72 caracteres (si no, ni se consulta la base)
//   2) mensaje genérico: no se dice si lo que falló fue el correo o la contraseña
//   3) límite de intentos: 5 fallos seguidos bloquean ese correo 15 minutos (util/intentos.js)
//   4) la sesión vence sola después de SESION_DIAS días (modelo/sesiones.js)
const login = manejar(async (req, res) => {
    const { correo, contrasena } = req.body || {};
    const problema = errorLogin(correo, contrasena);
    if (problema) return res.status(400).json({ error: problema });

    const clave = String(correo).trim().toLowerCase();
    const espera = intentos.minutosBloqueado(clave);
    if (espera > 0) {
        return res.status(429).json({ error: `Demasiados intentos fallidos. Espera ${espera} minuto${espera === 1 ? '' : 's'} e inténtalo de nuevo` });
    }

    const usuario = await usuarios.buscarPorCorreoConHash(clave);
    const correcta = usuario && (await bcrypt.compare(String(contrasena), usuario.contrasena));
    if (!correcta) {
        const quedan = intentos.registrarFallo(clave);
        if (quedan === 0) return res.status(429).json({ error: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo' });
        return res.status(401).json({
            error: `Correo o contraseña incorrectos${quedan <= 2 ? `. Te queda${quedan === 1 ? '' : 'n'} ${quedan} intento${quedan === 1 ? '' : 's'}` : ''}`,
        });
    }
    intentos.limpiar(clave);

    const token = await sesiones.crear(usuario.id_usuario);
    res.json({
        token,
        usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
    });
});

// CU-1.3 Cerrar sesión
const logout = manejar(async (req, res) => {
    await sesiones.cerrar(req.token);
    res.status(204).send();
});

const yo = manejar(async (req, res) => {
    res.json(req.usuario);
});

module.exports = { registro, login, logout, yo };
