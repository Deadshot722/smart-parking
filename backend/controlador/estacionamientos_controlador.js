const modelo = require('../modelo/estacionamientos');
const { manejar } = require('../util/http');
const { validarEnteroPositivo } = require('../validaciones');

const listar = manejar(async (req, res) => res.json(await modelo.listar()));

const aforo = manejar(async (req, res) => res.json(await modelo.aforo()));

const obtener = manejar(async (req, res) => {
    const e = await modelo.obtener(req.params.id);
    if (!e) return res.status(404).json({ error: 'Estacionamiento no encontrado' });
    res.json(e);
});

function datosValidos({ nombre, direccion, horario }, parcial = false) {
    if (!parcial && (!nombre || !direccion)) return 'nombre y direccion son obligatorios';
    if (nombre !== undefined && (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 100)) return 'Nombre inválido (máx. 100 caracteres)';
    if (direccion !== undefined && (typeof direccion !== 'string' || !direccion.trim() || direccion.length > 200)) return 'Dirección inválida (máx. 200 caracteres)';
    if (horario !== undefined && horario !== null && String(horario).length > 50) return 'El horario admite máximo 50 caracteres';
    return null;
}

const crear = manejar(async (req, res) => {
    const error = datosValidos(req.body || {});
    if (error) return res.status(400).json({ error });
    const { nombre, direccion, horario } = req.body;
    res.status(201).json(await modelo.crear({ nombre: nombre.trim(), direccion: direccion.trim(), horario }));
});

const actualizar = manejar(async (req, res) => {
    const error = datosValidos(req.body || {}, true);
    if (error) return res.status(400).json({ error });
    const { nombre, direccion, horario } = req.body;
    const e = await modelo.actualizar(req.params.id, { nombre: nombre?.trim(), direccion: direccion?.trim(), horario });
    if (!e) return res.status(404).json({ error: 'Estacionamiento no encontrado' });
    res.json(e);
});

const eliminar = manejar(async (req, res) => {
    if (!(await modelo.eliminar(req.params.id))) return res.status(404).json({ error: 'Estacionamiento no encontrado' });
    res.status(204).send();
});

// ----- Niveles y cajones -----
const crearNivel = manejar(async (req, res) => {
    const { nombre, sectores = 1, cajones_por_sector = 10 } = req.body || {};
    if (!nombre || typeof nombre !== 'string' || nombre.length > 50) {
        return res.status(400).json({ error: 'El nombre del nivel es obligatorio (máx. 50 caracteres)' });
    }
    if (!validarEnteroPositivo(sectores) || sectores > 10) return res.status(400).json({ error: 'Los sectores deben ser de 1 a 10' });
    if (!validarEnteroPositivo(cajones_por_sector) || cajones_por_sector > 99) {
        return res.status(400).json({ error: 'Los cajones por sector deben ser de 1 a 99' });
    }
    if (!(await modelo.obtenerSimple(req.params.id))) return res.status(404).json({ error: 'Estacionamiento no encontrado' });
    res.status(201).json(
        await modelo.crearNivel(req.params.id, { nombre: nombre.trim(), sectores: Number(sectores), cajonesPorSector: Number(cajones_por_sector) })
    );
});

const actualizarNivel = manejar(async (req, res) => {
    const { nombre } = req.body || {};
    if (!nombre || typeof nombre !== 'string' || nombre.length > 50) return res.status(400).json({ error: 'Nombre de nivel inválido' });
    if (!(await modelo.actualizarNivel(req.params.id, { nombre: nombre.trim() }))) return res.status(404).json({ error: 'Nivel no encontrado' });
    res.json({ mensaje: 'Nivel actualizado' });
});

const eliminarNivel = manejar(async (req, res) => {
    if (!(await modelo.eliminarNivel(req.params.id))) return res.status(404).json({ error: 'Nivel no encontrado' });
    res.status(204).send();
});

const cajones = manejar(async (req, res) => res.json(await modelo.cajonesDeNivel(req.params.id)));

const estadoCajon = manejar(async (req, res) => {
    const { estado } = req.body || {};
    if (!['Disponible', 'Ocupado'].includes(estado)) return res.status(400).json({ error: 'El estado debe ser Disponible u Ocupado' });
    if (!(await modelo.cambiarEstadoCajon(req.params.id, estado))) return res.status(404).json({ error: 'Cajón no encontrado' });
    res.json({ mensaje: 'Cajón actualizado', estado });
});

module.exports = { listar, aforo, obtener, crear, actualizar, eliminar, crearNivel, actualizarNivel, eliminarNivel, cajones, estadoCajon };
