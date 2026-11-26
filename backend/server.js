require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// CORS abierto: permite probar la API desde Postman u otro origen.
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).send();
    next();
});

// Prueba de vida
app.get('/', (req, res) => {
    res.json({ mensaje: 'API de Smart-Parking funcionando correctamente' });
});

// Revisa también la base de datos y el servicio gRPC (útil para depurar en Render)
app.get('/salud', async (req, res) => {
    const estado = { api: 'ok', base_de_datos: 'ok', grpc: 'ok' };
    try {
        await require('./db').query('SELECT 1');
    } catch (error) {
        estado.base_de_datos = 'sin conexión';
        console.error('[salud] Base de datos:', error.message); // el detalle solo va al log, no a la respuesta pública
    }
    try {
        await require('./grpc/cliente').llamar('CalcularCobro', { minutos: 1, costo_hora: 1 }, { limiteMs: 2000 });
    } catch (error) {
        estado.grpc = 'sin conexión';
    }
    res.status(estado.base_de_datos === 'ok' ? 200 : 503).json(estado);
});

app.use('/api', require('./rutas/rutas'));

// Ruta que no existe
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// JSON mal escrito en el body
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
        return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Arranque: primero el servidor gRPC (procedimientos remotos) y después la API REST que lo llama.
// Si gRPC no logra iniciar, la API arranca igual y /api/aforo consulta directo a la base de datos.
if (require.main === module) {
    const { iniciarServidorGrpc } = require('./grpc/servidor');
    const iniciarGrpc = process.env.GRPC_INICIAR === 'false' ? Promise.resolve() : iniciarServidorGrpc();
    iniciarGrpc
        .catch((error) => console.error('No se pudo iniciar el servidor gRPC:', error.message))
        .finally(() => app.listen(PORT, () => console.log(`Smart-Parking API escuchando en el puerto ${PORT}`)));
}

module.exports = app;
