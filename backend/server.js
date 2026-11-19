require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// CORS abierto para desarrollo: la app móvil (Expo) y la web llaman desde otro origen.
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

// Revisa también la conexión con la base de datos (útil para depurar en Render)
app.get('/salud', async (req, res) => {
    try {
        await require('./db').query('SELECT 1');
        res.json({ api: 'ok', base_de_datos: 'ok' });
    } catch (error) {
        res.status(503).json({ api: 'ok', base_de_datos: 'sin conexión', detalle: error.message });
    }
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

if (require.main === module) {
    app.listen(PORT, () => console.log(`Smart-Parking API escuchando en el puerto ${PORT}`));
}

module.exports = app;
