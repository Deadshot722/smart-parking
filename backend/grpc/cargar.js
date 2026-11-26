// Carga el contrato .proto una sola vez (lo usan el servidor y los clientes).
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const RUTA_PROTO = path.join(__dirname, 'smartparking.proto');

const definicion = protoLoader.loadSync(RUTA_PROTO, {
    keepCase: true, // conserva nombres como id_estacionamiento (igual que la API REST)
    longs: Number,
    enums: String,
    defaults: true, // los campos en 0 / "" también llegan
    oneofs: true,
});

const { smartparking } = grpc.loadPackageDefinition(definicion);

const PUERTO = Number(process.env.GRPC_PUERTO) || 50051;
// Por defecto el servidor solo escucha dentro del mismo equipo/contenedor (no queda expuesto en internet).
const HOST = process.env.GRPC_HOST || '127.0.0.1';
// A dónde se conectan los clientes. Puede ser otra computadora: GRPC_DESTINO=192.168.1.20:50051
const DESTINO = process.env.GRPC_DESTINO || `127.0.0.1:${PUERTO}`;

module.exports = { grpc, smartparking, PUERTO, HOST, DESTINO, RUTA_PROTO };
