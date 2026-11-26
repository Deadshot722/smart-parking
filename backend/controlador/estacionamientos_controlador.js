const modelo = require('../modelo/estacionamientos');
const { manejar } = require('../util/http');
const { validarEnteroPositivo, validarDireccion, validarHorario } = require('../validaciones');
const { verificarDireccion } = require('../util/geocodificar');
const { llamar, servicioCaido } = require('../grpc/cliente');
const { exigirPropio, exigirPropioSiEsOperador } = require('../util/propiedad');

const listar = manejar(async (req, res) => res.json(await modelo.listar()));

// Solo los estacionamientos que creó el operador con sesión (para sus pantallas de administración)
const listarPropios = manejar(async (req, res) => res.json(await modelo.listar(req.usuario.id_usuario)));
const aforoPropio = manejar(async (req, res) => res.json(await modelo.aforo(req.usuario.id_usuario)));

// GET /api/aforo: se obtiene con una llamada a procedimiento remoto (gRPC ConsultarAforo).
// Si el servicio gRPC no responde, se consulta directo al modelo para que la web no se caiga.
const aforo = manejar(async (req, res) => {
    try {
        res.json({ ...(await llamar('ConsultarAforo', {}, { limiteMs: 3000 })), via: 'gRPC' });
    } catch (error) {
        if (!servicioCaido(error)) throw error;
        console.warn('gRPC no disponible, aforo consultado directo:', error.details || error.message);
        res.json({ ...(await modelo.aforo()), via: 'directo' });
    }
});

const obtener = manejar(async (req, res) => {
    await exigirPropioSiEsOperador(req, req.params.id); // el conductor ve todos; el operador solo los suyos
    const e = await modelo.obtener(req.params.id);
    if (!e) return res.status(404).json({ error: 'Estacionamiento no encontrado' });
    res.json(e);
});

// CU-5.2: nombre, dirección (con formato de dirección) y horario válido
function datosValidos({ nombre, direccion, horario }, parcial = false) {
    if (!parcial && (!nombre || !direccion || !horario)) return 'Nombre, dirección y horario son obligatorios';
    if (nombre !== undefined && (typeof nombre !== 'string' || nombre.trim().length < 3 || nombre.length > 100)) {
        return 'El nombre debe tener entre 3 y 100 caracteres';
    }
    if (direccion !== undefined) {
        const error = validarDireccion(direccion);
        if (error) return error;
    }
    if (horario !== undefined) {
        const error = validarHorario(horario);
        if (error) return error;
    }
    return null;
}

const limpiar = (t) => (typeof t === 'string' ? t.trim().replace(/\s+/g, ' ') : t);

// Solo si VALIDAR_DIRECCION=true: si la dirección no está en el mapa se rechaza; si el servicio no responde, se acepta.
async function revisarDireccionReal(direccion, res) {
    const r = await verificarDireccion(direccion);
    if (r.encontrada === false) {
        res.status(400).json({
            error: 'No encontramos esa dirección en el mapa: ni la calle ni la colonia o municipio. Revisa que estén bien escritos y separados por comas (calle y número, colonia, municipio, estado).',
        });
        return false;
    }
    return r;
}

// Si solo se encontró la colonia o el municipio, se avisa (la calle no está en el mapa, pero la zona sí es real)
const mensajeGuardado = (r) =>
    r.nivel === 'zona'
        ? 'Estructura guardada correctamente (la calle no aparece en el mapa, pero sí la colonia o municipio)'
        : 'Estructura guardada correctamente';

const crear = manejar(async (req, res) => {
    const error = datosValidos(req.body || {});
    if (error) return res.status(400).json({ error });
    const nombre = limpiar(req.body.nombre);
    const direccion = limpiar(req.body.direccion);
    const horario = limpiar(req.body.horario);
    const r = await revisarDireccionReal(direccion, res);
    if (!r) return;
    const e = await modelo.crear({ nombre, direccion, horario, idOperador: req.usuario.id_usuario });
    res.status(201).json({ ...e, mensaje: mensajeGuardado(r), ubicacion_encontrada: r.lugar || null });
});

const actualizar = manejar(async (req, res) => {
    const error = datosValidos(req.body || {}, true);
    if (error) return res.status(400).json({ error });
    await exigirPropio(req, req.params.id);
    const nombre = limpiar(req.body.nombre);
    const direccion = limpiar(req.body.direccion);
    const horario = limpiar(req.body.horario);
    const actual = await modelo.obtenerSimple(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Estacionamiento no encontrado' });
    let r = { lugar: null };
    if (direccion !== undefined && direccion !== actual.direccion) {
        r = await revisarDireccionReal(direccion, res);
        if (!r) return;
    }
    const e = await modelo.actualizar(req.params.id, { nombre, direccion, horario });
    res.json({ ...e, mensaje: mensajeGuardado(r), ubicacion_encontrada: r.lugar || null });
});

const eliminar = manejar(async (req, res) => {
    await exigirPropio(req, req.params.id);
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
    await exigirPropio(req, req.params.id);
    res.status(201).json(
        await modelo.crearNivel(req.params.id, { nombre: nombre.trim(), sectores: Number(sectores), cajonesPorSector: Number(cajones_por_sector) })
    );
});

const actualizarNivel = manejar(async (req, res) => {
    const { nombre } = req.body || {};
    if (!nombre || typeof nombre !== 'string' || nombre.length > 50) return res.status(400).json({ error: 'Nombre de nivel inválido' });
    await exigirPropio(req, await modelo.estacionamientoDeNivel(req.params.id), 'Nivel no encontrado');
    if (!(await modelo.actualizarNivel(req.params.id, { nombre: nombre.trim() }))) return res.status(404).json({ error: 'Nivel no encontrado' });
    res.json({ mensaje: 'Nivel actualizado' });
});

const eliminarNivel = manejar(async (req, res) => {
    await exigirPropio(req, await modelo.estacionamientoDeNivel(req.params.id), 'Nivel no encontrado');
    if (!(await modelo.eliminarNivel(req.params.id))) return res.status(404).json({ error: 'Nivel no encontrado' });
    res.status(204).send();
});

const cajones = manejar(async (req, res) => {
    await exigirPropioSiEsOperador(req, await modelo.estacionamientoDeNivel(req.params.id), 'Nivel no encontrado');
    res.json(await modelo.cajonesDeNivel(req.params.id));
});

const estadoCajon = manejar(async (req, res) => {
    const { estado } = req.body || {};
    if (!['Disponible', 'Ocupado'].includes(estado)) return res.status(400).json({ error: 'El estado debe ser Disponible u Ocupado' });
    await exigirPropio(req, await modelo.estacionamientoDeCajon(req.params.id), 'Cajón no encontrado');
    if (!(await modelo.cambiarEstadoCajon(req.params.id, estado))) return res.status(404).json({ error: 'Cajón no encontrado' });
    res.json({ mensaje: 'Cajón actualizado', estado });
});

module.exports = { listar, listarPropios, aforo, aforoPropio, obtener, crear, actualizar, eliminar, crearNivel, actualizarNivel, eliminarNivel, cajones, estadoCajon };
