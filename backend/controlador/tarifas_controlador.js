const modelo = require('../modelo/tarifas');
const { manejar } = require('../util/http');
const { validarEnteroPositivo } = require('../validaciones');
const { exigirPropio } = require('../util/propiedad');

const listar = manejar(async (req, res) => res.json(await modelo.listar(req.query.estacionamiento)));

// Solo las tarifas de los estacionamientos del operador con sesión
const listarPropias = manejar(async (req, res) => res.json(await modelo.listar(null, req.usuario.id_usuario)));

async function estacionamientoDeTarifa(id) {
    const t = await modelo.obtener(id);
    return t && t.id_estacionamiento;
}

const limpiarNombre = (t) => (t === undefined || t === null ? t : String(t).trim().replace(/\s+/g, ' ') || null);

function error(datos, parcial) {
    const { costo, minutos_tolerancia, horario } = datos;
    if (!parcial && costo === undefined) return 'El costo es obligatorio';
    if (costo !== undefined && !(Number.isFinite(Number(costo)) && Number(costo) >= 0 && Number(costo) <= 99999)) return 'El costo debe ser un número mayor o igual a 0';
    if (minutos_tolerancia !== undefined && !(Number.isInteger(Number(minutos_tolerancia)) && Number(minutos_tolerancia) >= 0 && Number(minutos_tolerancia) <= 240)) {
        return 'La tolerancia debe ser un número entero de minutos (0 a 240)';
    }
    // "horario" es el nombre de la tarifa (ej. "Tarifa general"); es opcional
    if (horario !== undefined && horario !== null && horario !== '') {
        const nombre = String(horario).trim();
        if (nombre.length > 50) return 'El nombre de la tarifa admite máximo 50 caracteres';
        if (!/^[\p{L}0-9 .,()\-/]+$/u.test(nombre)) return 'El nombre de la tarifa solo puede tener letras, números, espacios y . , ( ) - /';
    }
    return null;
}

const crear = manejar(async (req, res) => {
    const datos = req.body || {};
    if (!validarEnteroPositivo(datos.id_estacionamiento)) return res.status(400).json({ error: 'id_estacionamiento es obligatorio' });
    const mensaje = error(datos, false);
    if (mensaje) return res.status(400).json({ error: mensaje });
    await exigirPropio(req, datos.id_estacionamiento);
    res.status(201).json(await modelo.crear({ ...datos, costo: Number(datos.costo), horario: limpiarNombre(datos.horario) }));
});

const actualizar = manejar(async (req, res) => {
    const mensaje = error(req.body || {}, true);
    if (mensaje) return res.status(400).json({ error: mensaje });
    await exigirPropio(req, await estacionamientoDeTarifa(req.params.id), 'Tarifa no encontrada');
    const cambios = { ...req.body };
    if (cambios.horario !== undefined) cambios.horario = limpiarNombre(cambios.horario);
    const t = await modelo.actualizar(req.params.id, cambios);
    if (!t) return res.status(404).json({ error: 'Tarifa no encontrada' });
    res.json(t);
});

const eliminar = manejar(async (req, res) => {
    await exigirPropio(req, await estacionamientoDeTarifa(req.params.id), 'Tarifa no encontrada');
    if (!(await modelo.eliminar(req.params.id))) return res.status(404).json({ error: 'Tarifa no encontrada' });
    res.status(204).send();
});

module.exports = { listar, listarPropias, crear, actualizar, eliminar };
