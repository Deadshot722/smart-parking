const db = require('../db');

// Conteo de cajones libres/ocupados (el aforo se calcula con los cajones; no hay sensores, ver documento de requerimientos).
const CONTEOS_NIVEL = `
  COUNT(*) FILTER (WHERE c.estado = 'Disponible') AS libres,
  COUNT(*) FILTER (WHERE c.estado = 'Ocupado')    AS ocupados,
  COUNT(c.id_cajon)                               AS total`;

async function listar() {
    const { rows } = await db.query(`
        SELECT e.id_estacionamiento, e.nombre, e.direccion, e.horario, ${CONTEOS_NIVEL}
          FROM estacionamiento e
          LEFT JOIN nivel n ON n.id_estacionamiento = e.id_estacionamiento
          LEFT JOIN cajon c ON c.id_nivel = n.id_nivel
         GROUP BY e.id_estacionamiento
         ORDER BY e.id_estacionamiento`);
    return rows;
}

async function obtenerSimple(id) {
    const { rows } = await db.query('SELECT * FROM estacionamiento WHERE id_estacionamiento = ?', [id]);
    return rows[0];
}

// Estacionamiento con sus niveles, sectores (letra inicial del número de cajón) y tarifas.
async function obtener(id) {
    const e = await obtenerSimple(id);
    if (!e) return undefined;

    const { rows: niveles } = await db.query(
        `SELECT n.id_nivel, n.nombre, ${CONTEOS_NIVEL}
           FROM nivel n LEFT JOIN cajon c ON c.id_nivel = n.id_nivel
          WHERE n.id_estacionamiento = ? GROUP BY n.id_nivel ORDER BY n.id_nivel`,
        [id]
    );
    const { rows: sectores } = await db.query(
        `SELECT c.id_nivel, LEFT(c.numero, 1) AS sector,
                COUNT(*) FILTER (WHERE c.estado = 'Disponible') AS libres,
                COUNT(*) FILTER (WHERE c.estado = 'Ocupado')    AS ocupados
           FROM cajon c JOIN nivel n ON n.id_nivel = c.id_nivel
          WHERE n.id_estacionamiento = ? GROUP BY c.id_nivel, LEFT(c.numero, 1) ORDER BY sector`,
        [id]
    );
    const { rows: tarifas } = await db.query('SELECT * FROM tarifa WHERE id_estacionamiento = ? ORDER BY id_tarifa', [id]);

    e.niveles = niveles.map((n) => ({
        ...n,
        sin_disponibilidad: n.total > 0 && n.libres === 0, // etiqueta "Nivel sin disponibilidad" (CU-2.1)
        sectores: sectores
            .filter((s) => s.id_nivel === n.id_nivel)
            .map((s) => ({ sector: s.sector, libres: s.libres, ocupados: s.ocupados })),
    }));
    e.tarifas = tarifas;
    return e;
}

async function crear({ nombre, direccion, horario }) {
    const { rows } = await db.query(
        'INSERT INTO estacionamiento (nombre, direccion, horario) VALUES (?, ?, ?) RETURNING *',
        [nombre, direccion, horario || null]
    );
    return rows[0];
}

async function actualizar(id, { nombre, direccion, horario }) {
    const actual = await obtenerSimple(id);
    if (!actual) return undefined;
    const { rows } = await db.query(
        'UPDATE estacionamiento SET nombre = ?, direccion = ?, horario = ? WHERE id_estacionamiento = ? RETURNING *',
        [nombre ?? actual.nombre, direccion ?? actual.direccion, horario === undefined ? actual.horario : horario, id]
    );
    return rows[0];
}

async function eliminar(id) {
    const r = await db.query('DELETE FROM estacionamiento WHERE id_estacionamiento = ?', [id]);
    return r.rowCount > 0;
}

// ---------- Niveles ----------
const LETRAS = 'ABCDEFGHIJ';

// Crea el nivel y sus cajones: sectores A, B, C... con `cajonesPorSector` cajones cada uno (A01, A02...).
async function crearNivel(idEstacionamiento, { nombre, sectores, cajonesPorSector }) {
    return db.transaccion(async (cx) => {
        const { rows } = await cx.query(
            'INSERT INTO nivel (id_estacionamiento, nombre, capacidad) VALUES (?, ?, 0) RETURNING id_nivel',
            [idEstacionamiento, nombre]
        );
        const idNivel = rows[0].id_nivel;
        const numeros = [];
        for (let s = 0; s < sectores; s++) {
            for (let i = 1; i <= cajonesPorSector; i++) numeros.push(`${LETRAS[s]}${String(i).padStart(2, '0')}`);
        }
        if (numeros.length > 0) {
            await cx.query('INSERT INTO cajon (id_nivel, numero) SELECT ?::int, unnest(?::text[])', [idNivel, numeros]);
        }
        await cx.query('UPDATE nivel SET capacidad = ? WHERE id_nivel = ?', [numeros.length, idNivel]);
        return { id_nivel: idNivel, nombre, capacidad: numeros.length };
    });
}

async function actualizarNivel(id, { nombre }) {
    const r = await db.query('UPDATE nivel SET nombre = ? WHERE id_nivel = ?', [nombre, id]);
    return r.rowCount > 0;
}

async function eliminarNivel(id) {
    const r = await db.query('DELETE FROM nivel WHERE id_nivel = ?', [id]);
    return r.rowCount > 0;
}

async function cajonesDeNivel(idNivel) {
    const { rows } = await db.query(
        `SELECT c.id_cajon, c.numero, LEFT(c.numero, 1) AS sector, c.estado
           FROM cajon c WHERE c.id_nivel = ? ORDER BY c.numero`,
        [idNivel]
    );
    return rows;
}

// Cambio manual del operador (CU-2.3). Si el cajón estaba ligado a una estancia, se desliga.
async function cambiarEstadoCajon(idCajon, estado) {
    return db.transaccion(async (cx) => {
        const { rows } = await cx.query('SELECT id_cajon FROM cajon WHERE id_cajon = ? FOR UPDATE', [idCajon]);
        if (rows.length === 0) return false;
        await cx.query('UPDATE cajon SET estado = ? WHERE id_cajon = ?', [estado, idCajon]);
        if (estado === 'Disponible') {
            await cx.query('UPDATE estancia SET id_cajon = NULL WHERE id_cajon = ? AND fecha_salida IS NULL', [idCajon]);
        }
        return true;
    });
}

// Aforo global y por estacionamiento (RF-3.1)
async function aforo() {
    const porEstacionamiento = await listar();
    const total = porEstacionamiento.reduce(
        (acc, e) => ({ libres: acc.libres + e.libres, ocupados: acc.ocupados + e.ocupados, total: acc.total + e.total }),
        { libres: 0, ocupados: 0, total: 0 }
    );
    return { ...total, estacionamientos: porEstacionamiento, actualizado: new Date().toISOString() };
}

module.exports = {
    listar,
    obtener,
    obtenerSimple,
    crear,
    actualizar,
    eliminar,
    crearNivel,
    actualizarNivel,
    eliminarNivel,
    cajonesDeNivel,
    cambiarEstadoCajon,
    aforo,
};
