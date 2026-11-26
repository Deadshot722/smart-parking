// Permisos del operador: solo puede administrar los estacionamientos que él creó (tabla operador_estacionamiento).
const estacionamientos = require('../modelo/estacionamientos');
const { ErrorNegocio } = require('./errores');

const NO_ES_TUYO = 'Este estacionamiento no te pertenece: solo puedes administrar los estacionamientos que tú creaste';

const esOperador = (req) => Boolean(req.usuario && req.usuario.rol === 'Operador');

// Lanza 404 si el estacionamiento no existe y 403 si es de otro operador.
async function exigirPropio(req, idEstacionamiento, noExiste = 'Estacionamiento no encontrado') {
    if (!idEstacionamiento || !(await estacionamientos.obtenerSimple(idEstacionamiento))) throw new ErrorNegocio(404, noExiste);
    if (!(await estacionamientos.esDelOperador(req.usuario.id_usuario, idEstacionamiento))) throw new ErrorNegocio(403, NO_ES_TUYO);
}

// Igual que exigirPropio, pero solo aplica si quien consulta es operador (los conductores ven todos)
async function exigirPropioSiEsOperador(req, idEstacionamiento, noExiste) {
    if (esOperador(req)) await exigirPropio(req, idEstacionamiento, noExiste);
}

module.exports = { exigirPropio, exigirPropioSiEsOperador, esOperador, NO_ES_TUYO };
