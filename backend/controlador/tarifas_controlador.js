const modelo = require('../modelo/tarifas');
const estacionamientos = require('../modelo/estacionamientos');
const { manejar } = require('../util/http');
const { validarEnteroPositivo } = require('../validaciones');

const listar = manejar(async (req, res) => res.json(await modelo.listar(req.query.estacionamiento)));

function error(datos, parcial) {
    const { costo, minutos_tolerancia, horario } = datos;
    if (!parcial && costo === undefined) return 'El costo es obligatorio';
    if (costo !== undefined && !(Number.isFinite(Number(costo)) && Number(costo) >= 0 && Number(costo) <= 99999)) return 'El costo debe ser un número mayor o igual a 0';
    if (minutos_tolerancia !== undefined && !(Number.isInteger(Number(minutos_tolerancia)) && Number(minutos_tolerancia) >= 0 && Number(minutos_tolerancia) <= 240)) {
        return 'La tolerancia debe ser un número entero de minutos (0 a 240)';
    }
    if (horario !== undefined && horario !== null && String(horario).length > 50) return 'El horario admite máximo 50 caracteres';
    return null;
}

const crear = manejar(async (req, res) => {
    const datos = req.body || {};
    if (!validarEnteroPositivo(datos.id_estacionamiento)) return res.status(400).json({ error: 'id_estacionamiento es obligatorio' });
    const mensaje = error(datos, false);
    if (mensaje) return res.status(400).json({ error: mensaje });
    if (!(await estacionamientos.obtenerSimple(datos.id_estacionamiento))) return res.status(404).json({ error: 'Estacionamiento no encontrado' });
    res.status(201).json(await modelo.crear({ ...datos, costo: Number(datos.costo) }));
});

const actualizar = manejar(async (req, res) => {
    const mensaje = error(req.body || {}, true);
    if (mensaje) return res.status(400).json({ error: mensaje });
    const t = await modelo.actualizar(req.params.id, req.body);
    if (!t) return res.status(404).json({ error: 'Tarifa no encontrada' });
    res.json(t);
});

const eliminar = manejar(async (req, res) => {
    if (!(await modelo.eliminar(req.params.id))) return res.status(404).json({ error: 'Tarifa no encontrada' });
    res.status(204).send();
});

module.exports = { listar, crear, actualizar, eliminar };
