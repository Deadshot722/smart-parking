// Cliente gRPC que usa la API REST (Express) para llamar a los procedimientos remotos.
const { grpc, smartparking, DESTINO } = require('./cargar');

let cliente = null;
function obtenerCliente() {
    if (!cliente) cliente = new smartparking.SmartParking(DESTINO, grpc.credentials.createInsecure());
    return cliente;
}

// Llamada unaria con tiempo límite. Ej: await llamar('CalcularCobro', { minutos: 95, costo_hora: 20 })
function llamar(metodo, solicitud = {}, { limiteMs = 5000 } = {}) {
    return new Promise((resolve, reject) => {
        obtenerCliente()[metodo](solicitud, { deadline: Date.now() + limiteMs }, (error, respuesta) => {
            if (error) reject(error);
            else resolve(respuesta);
        });
    });
}

// Llamada con medición del tiempo de respuesta (para la página del operador)
async function llamarMedido(metodo, solicitud) {
    const inicio = process.hrtime.bigint();
    const respuesta = await llamar(metodo, solicitud);
    const latencia_ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    return { metodo, destino: DESTINO, latencia_ms: Math.round(latencia_ms * 10) / 10, respuesta };
}

// Códigos de gRPC -> códigos HTTP de la API REST
function httpDesdeGrpc(error) {
    const s = grpc.status;
    const tabla = {
        [s.INVALID_ARGUMENT]: 400,
        [s.PERMISSION_DENIED]: 403,
        [s.NOT_FOUND]: 404,
        [s.FAILED_PRECONDITION]: 409,
        [s.UNAVAILABLE]: 503,
        [s.DEADLINE_EXCEEDED]: 504,
    };
    return tabla[error && error.code] || 500;
}

const servicioCaido = (error) => error && (error.code === grpc.status.UNAVAILABLE || error.code === grpc.status.DEADLINE_EXCEEDED);

module.exports = { llamar, llamarMedido, httpDesdeGrpc, servicioCaido, DESTINO };
