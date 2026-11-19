const db = require('../db');

async function listar(idEstacionamiento) {
    if (idEstacionamiento) {
        const { rows } = await db.query('SELECT * FROM tarifa WHERE id_estacionamiento = ? ORDER BY id_tarifa', [
            Number(idEstacionamiento) || 0,
        ]);
        return rows;
    }
    const { rows } = await db.query(
        `SELECT t.*, e.nombre AS estacionamiento FROM tarifa t
           JOIN estacionamiento e ON e.id_estacionamiento = t.id_estacionamiento ORDER BY t.id_tarifa`
    );
    return rows;
}

async function obtener(id) {
    const { rows } = await db.query('SELECT * FROM tarifa WHERE id_tarifa = ?', [id]);
    return rows[0];
}

async function crear({ id_estacionamiento, costo, horario, minutos_tolerancia }) {
    const { rows } = await db.query(
        `INSERT INTO tarifa (id_estacionamiento, costo, horario, minutos_tolerancia)
         VALUES (?, ?, ?, ?) RETURNING *`,
        [id_estacionamiento, costo, horario || null, minutos_tolerancia ?? 15]
    );
    return rows[0];
}

async function actualizar(id, { costo, horario, minutos_tolerancia }) {
    const actual = await obtener(id);
    if (!actual) return undefined;
    const { rows } = await db.query(
        'UPDATE tarifa SET costo = ?, horario = ?, minutos_tolerancia = ? WHERE id_tarifa = ? RETURNING *',
        [
            costo ?? actual.costo,
            horario === undefined ? actual.horario : horario,
            minutos_tolerancia ?? actual.minutos_tolerancia,
            id,
        ]
    );
    return rows[0];
}

async function eliminar(id) {
    const r = await db.query('DELETE FROM tarifa WHERE id_tarifa = ?', [id]);
    return r.rowCount > 0;
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
