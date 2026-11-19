const bcrypt = require('bcryptjs');
const usuarios = require('../modelo/usuarios');
const sesiones = require('../modelo/sesiones');
const { manejar } = require('../util/http');
const { validarNombre, validarCorreo, validarContrasena } = require('../validaciones');

// CU-1.1 Registrar cuenta (solo conductores; los operadores los da de alta el administrador / seed)
const registro = manejar(async (req, res) => {
    const { nombre, correo, contrasena } = req.body || {};
    if (!nombre || !correo || !contrasena) {
        return res.status(400).json({ error: 'nombre, correo y contrasena son obligatorios' });
    }
    if (!validarNombre(nombre)) return res.status(400).json({ error: 'El nombre solo puede contener letras y espacios' });
    if (!validarCorreo(correo)) return res.status(400).json({ error: 'El correo no tiene un formato válido' });
    if (!validarContrasena(contrasena)) {
        return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' });
    }

    try {
        const contrasenaHash = await bcrypt.hash(contrasena, 10); // RNF-5
        const nuevo = await usuarios.crear({
            nombre: nombre.trim().replace(/\s+/g, ' '),
            correo: correo.trim().toLowerCase(),
            contrasenaHash,
            rol: 'Conductor',
        });
        res.status(201).json({ mensaje: 'Cuenta registrada correctamente', usuario: nuevo });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Ese correo ya está registrado' });
        throw error;
    }
});

// CU-1.2 Iniciar sesión
const login = manejar(async (req, res) => {
    const { correo, contrasena } = req.body || {};
    if (!correo || !contrasena) return res.status(400).json({ error: 'Ingresa tu correo y contraseña' });

    const usuario = await usuarios.buscarPorCorreoConHash(String(correo).trim().toLowerCase());
    const correcta = usuario && (await bcrypt.compare(String(contrasena), usuario.contrasena));
    if (!correcta) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

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
