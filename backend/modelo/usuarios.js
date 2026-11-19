const db = require('../db');

// NUNCA se devuelve la contraseña.
const COLUMNAS_PUBLICAS = 'id_usuario, nombre, correo, rol';

async function obtenerPorId(id) {
    const { rows } = await db.query(`SELECT ${COLUMNAS_PUBLICAS} FROM usuario WHERE id_usuario = ?`, [id]);
    return rows[0];
}

async function crear({ nombre, correo, contrasenaHash, rol }) {
    const { rows } = await db.query(
        `INSERT INTO usuario (nombre, correo, contrasena, rol) VALUES (?, ?, ?, ?) RETURNING ${COLUMNAS_PUBLICAS}`,
        [nombre, correo, contrasenaHash, rol || 'Conductor']
    );
    return rows[0];
}

// Para el login: aquí sí se necesita el hash.
async function buscarPorCorreoConHash(correo) {
    const { rows } = await db.query('SELECT * FROM usuario WHERE correo = ?', [correo]);
    return rows[0];
}

module.exports = { obtenerPorId, crear, buscarPorCorreoConHash };
