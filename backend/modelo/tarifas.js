const db = require('../db');

// La columna "horario" de la tabla tarifa se usa como NOMBRE de la tarifa (ej. "Tarifa general", "Nocturna").
// La regla de cobro es siempre la misma: costo por hora o fracción, mínimo 1 hora (util/cobro.js).
// "vigente" = es la tarifa más reciente del estacionamiento: la que usan los boletos nuevos (modelo/boletos.js).
const VIGENTE = `t.id_tarifa = (SELECT MAX(t2.id_tarifa) FROM tarifa t2 WHERE t2.id_estacionamiento = t.id_estacionamiento) AS vigente`;

// Con idOperador: solo las tarifas de los estacionamientos de ese operador
async function listar(idEstacionamiento, idOperador) {
    if (idOperador) {
        const { rows } = await db.query(
            `SELECT t.*, e.nombre AS estacionamiento, ${VIGENTE} FROM tarifa t
               JOIN estacionamiento e ON e.id_estacionamiento = t.id_estacionamiento
               JOIN operador_estacionamiento oe ON oe.id_estacionamiento = t.id_estacionamiento AND oe.id_usuario = ?
              ORDER BY t.id_tarifa`,
            [idOperador]
        );
        return rows;
    }
    if (idEstacionamiento) {
        const { rows } = await db.query(`SELECT t.*, ${VIGENTE} FROM tarifa t WHERE t.id_estacionamiento = ? ORDER BY t.id_tarifa`, [
            Number(idEstacionamiento) || 0,
        ]);
        return rows;
    }
    const { rows } = await db.query(
        `SELECT t.*, e.nombre AS estacionamiento, ${VIGENTE} FROM tarifa t
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
