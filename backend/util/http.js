const { ErrorNegocio } = require('./errores');

// Convierte cualquier error en una respuesta JSON con el código HTTP correcto.
// Códigos de PostgreSQL: 23505 = valor repetido (UNIQUE), 23503 = llave foránea.
function responderError(res, error) {
    if (error instanceof ErrorNegocio) return res.status(error.status).json({ error: error.message });
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
    if (error.code === '23503') {
        if (/update or delete on table/i.test(error.message)) {
            return res.status(409).json({ error: 'No se puede eliminar: hay información que depende de este registro' });
        }
        return res.status(400).json({ error: 'Referencia inválida (el registro relacionado no existe)' });
    }
    if (error.code === '22P02' || error.code === '22003') return res.status(400).json({ error: 'Dato con formato inválido' });
    console.error(error);
    return res.status(500).json({ error: 'Error interno del servidor' });
}

// Envuelve un controlador async para no repetir try/catch.
const manejar = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        responderError(res, error);
    }
};

module.exports = { manejar, responderError };
