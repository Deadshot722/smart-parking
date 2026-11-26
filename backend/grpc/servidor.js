// Servidor gRPC de Smart-Parking: expone procedimientos remotos que usan el mismo modelo y la misma base de datos
// que la API REST. Se puede ejecutar solo (npm run rpc:servidor) o junto con Express (npm start).
require('dotenv').config();
const { grpc, smartparking, PUERTO, HOST } = require('./cargar');
const estacionamientos = require('../modelo/estacionamientos');
const boletos = require('../modelo/boletos');
const { calcularMonto } = require('../util/cobro');
const { ErrorNegocio } = require('../util/errores');
const { NO_ES_TUYO } = require('../util/propiedad');

const num = (v) => Number(v) || 0;
const fecha = (v) => (v ? new Date(v).toISOString() : '');

// ---------- Conversión de los datos del modelo a los mensajes del .proto ----------
function aMensajeAforo(a) {
    return {
        libres: num(a.libres),
        ocupados: num(a.ocupados),
        total: num(a.total),
        actualizado: a.actualizado,
        estacionamientos: a.estacionamientos.map((e) => ({
            id_estacionamiento: e.id_estacionamiento,
            nombre: e.nombre,
            direccion: e.direccion || '',
            horario: e.horario || '',
            libres: num(e.libres),
            ocupados: num(e.ocupados),
            total: num(e.total),
        })),
    };
}

function aMensajeDisponibilidad(e) {
    return {
        id_estacionamiento: e.id_estacionamiento,
        nombre: e.nombre,
        actualizado: new Date().toISOString(),
        niveles: e.niveles.map((n) => ({
            id_nivel: n.id_nivel,
            nombre: n.nombre,
            libres: num(n.libres),
            ocupados: num(n.ocupados),
            total: num(n.total),
            sin_disponibilidad: Boolean(n.sin_disponibilidad),
            sectores: n.sectores.map((s) => ({ sector: s.sector, libres: num(s.libres), ocupados: num(s.ocupados) })),
        })),
    };
}

function aMensajeBoleto(b) {
    return {
        folio: b.folio,
        estado: b.estado,
        estacionamiento: b.estacionamiento,
        entrada: fecha(b.entrada),
        nivel: b.nivel || '',
        cajon: b.cajon || '',
        minutos: num(b.minutos),
        costo_hora: num(b.costo_hora),
        monto_total: num(b.monto_total),
        pagado: Boolean(b.pagado),
        monto_pagado: num(b.monto_pagado),
        tolerancia_restante: num(b.tolerancia_restante),
        monto_extra: num(b.monto_extra),
        monto_a_cobrar: num(b.monto_a_cobrar),
    };
}

// Errores de negocio -> códigos de estado de gRPC
function aErrorGrpc(error) {
    if (error && error.code !== undefined && error.details !== undefined) return error; // ya es de gRPC
    if (error instanceof ErrorNegocio) {
        const codigo = {
            400: grpc.status.INVALID_ARGUMENT,
            403: grpc.status.PERMISSION_DENIED,
            404: grpc.status.NOT_FOUND,
            409: grpc.status.FAILED_PRECONDITION,
        }[error.status];
        return { code: codigo ?? grpc.status.UNKNOWN, details: error.message };
    }
    console.error('[gRPC]', error);
    return { code: grpc.status.INTERNAL, details: 'Error interno del servidor' };
}

// Envuelve un procedimiento unario async: (solicitud) => respuesta
const unario = (nombre, fn) => async (call, callback) => {
    const inicio = Date.now();
    try {
        const respuesta = await fn(call.request);
        console.log(`[gRPC] ${nombre} ok (${Date.now() - inicio} ms)`);
        callback(null, respuesta);
    } catch (error) {
        const e = aErrorGrpc(error);
        console.log(`[gRPC] ${nombre} error ${e.code}: ${e.details}`);
        callback(e);
    }
};

// Si la solicitud trae id_operador, el estacionamiento debe ser de ese operador
async function revisarOperador(idOperador, idEstacionamiento, mensaje = NO_ES_TUYO) {
    if (idOperador > 0 && !(await estacionamientos.esDelOperador(idOperador, idEstacionamiento))) {
        throw new ErrorNegocio(403, mensaje);
    }
}

async function disponibilidad(id, idOperador) {
    if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio(400, 'id_estacionamiento debe ser un entero positivo');
    const e = await estacionamientos.obtener(id);
    if (!e) throw new ErrorNegocio(404, 'Estacionamiento no encontrado');
    await revisarOperador(idOperador, id);
    return aMensajeDisponibilidad(e);
}

// ---------- Implementación de cada procedimiento remoto ----------
const implementacion = {
    ConsultarAforo: unario('ConsultarAforo', async ({ id_operador }) =>
        aMensajeAforo(await estacionamientos.aforo(id_operador > 0 ? id_operador : undefined))
    ),

    ConsultarDisponibilidad: unario('ConsultarDisponibilidad', async (s) => disponibilidad(s.id_estacionamiento, s.id_operador)),

    ConsultarBoleto: unario('ConsultarBoleto', async ({ folio, id_operador }) => {
        if (!/^[A-Za-z0-9-]{1,20}$/.test(String(folio || '').trim())) throw new ErrorNegocio(400, 'Folio inválido');
        const b = await boletos.porFolio(folio.trim());
        if (!b) throw new ErrorNegocio(404, 'No existe un boleto con ese folio');
        await revisarOperador(id_operador, b.id_estacionamiento, boletos.NO_ES_TUYO);
        return aMensajeBoleto(b);
    }),

    CalcularCobro: unario('CalcularCobro', async ({ minutos, costo_hora }) => {
        if (!Number.isInteger(minutos) || minutos < 0) throw new ErrorNegocio(400, 'minutos debe ser un entero mayor o igual a 0');
        if (!(costo_hora > 0)) throw new ErrorNegocio(400, 'costo_hora debe ser mayor a 0');
        return {
            horas_cobradas: Math.max(1, Math.ceil(minutos / 60)),
            monto: calcularMonto(minutos, costo_hora),
            regla: 'Por hora o fracción, mínimo 1 hora',
        };
    }),

    // Streaming: manda la disponibilidad cada intervalo hasta completar las repeticiones o hasta que el cliente cancele
    VigilarDisponibilidad: (call) => {
        const { id_estacionamiento: id, id_operador: idOperador } = call.request;
        const intervalo = Math.max(1000, call.request.intervalo_ms || 2000);
        const repeticiones = Math.min(300, call.request.repeticiones || 300);
        let enviados = 0;
        let terminado = false;
        console.log(`[gRPC] VigilarDisponibilidad inicia (estacionamiento ${id}, cada ${intervalo} ms)`);

        const terminar = (error) => {
            if (terminado) return;
            terminado = true;
            clearInterval(reloj);
            if (error) call.emit('error', aErrorGrpc(error));
            else call.end();
        };
        const enviar = async () => {
            try {
                const datos = await disponibilidad(id, idOperador);
                if (terminado) return;
                call.write(datos);
                enviados += 1;
                if (enviados >= repeticiones) terminar();
            } catch (error) {
                terminar(error);
            }
        };
        const reloj = setInterval(enviar, intervalo);
        call.on('cancelled', () => {
            console.log('[gRPC] VigilarDisponibilidad cancelado por el cliente');
            terminado = true;
            clearInterval(reloj);
        });
        enviar();
    },
};

// Arranca el servidor. Devuelve una promesa con el servidor ya escuchando.
function iniciarServidorGrpc({ host = HOST, puerto = PUERTO } = {}) {
    const servidor = new grpc.Server();
    servidor.addService(smartparking.SmartParking.service, implementacion);
    return new Promise((resolve, reject) => {
        servidor.bindAsync(`${host}:${puerto}`, grpc.ServerCredentials.createInsecure(), (error, puertoAsignado) => {
            if (error) return reject(error);
            console.log(`Servidor gRPC escuchando en ${host}:${puertoAsignado}`);
            resolve(servidor);
        });
    });
}

if (require.main === module) {
    iniciarServidorGrpc().catch((error) => {
        console.error('No se pudo iniciar el servidor gRPC:', error.message);
        process.exit(1);
    });
}

module.exports = { iniciarServidorGrpc, implementacion, aMensajeAforo, aMensajeDisponibilidad, aMensajeBoleto };
