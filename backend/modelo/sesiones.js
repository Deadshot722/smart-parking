const crypto = require('crypto');
const db = require('../db');

async function crear(idUsuario) {
    const token = crypto.randomBytes(32).toString('hex'); // 64 caracteres
    await db.query('INSERT INTO sesion (id_usuario, token) VALUES (?, ?)', [idUsuario, token]);
    return token;
}

async function usuarioPorToken(token) {
    const { rows } = await db.query(
        `SELECT u.id_usuario, u.nombre, u.correo, u.rol
           FROM sesion s JOIN usuario u ON u.id_usuario = s.id_usuario
          WHERE s.token = ? AND s.estado = 'Activa'`,
        [token]
    );
    return rows[0];
}

async function cerrar(token) {
    await db.query("UPDATE sesion SET estado = 'Cerrada', fecha_fin = NOW() WHERE token = ?", [token]);
}

module.exports = { crear, usuarioPorToken, cerrar };
