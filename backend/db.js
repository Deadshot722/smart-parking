// Conexión a PostgreSQL (Supabase en producción, Postgres local en desarrollo).
// Los datos vienen del archivo .env / variables de entorno (nunca escribas la contraseña aquí).
require('dotenv').config();
const { Pool, types } = require('pg');

// Por defecto pg devuelve COUNT/SUM (bigint) y NUMERIC (dinero) como texto. Aquí los volvemos números.
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));

const url = process.env.DATABASE_URL;
if (!url) {
    console.error('Falta DATABASE_URL. Copia .env.example como .env y llénalo (o defínela en Render).');
}

// Supabase exige SSL; en tu PC (localhost) no se usa.
const esLocal = !url || /@(localhost|127\.0\.0\.1)/.test(url);
const usarSsl = process.env.DB_SSL ? process.env.DB_SSL !== 'false' : !esLocal;

const pool = new Pool({
    connectionString: url,
    ssl: usarSsl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Si Supabase cierra una conexión inactiva, no debe tumbar el servidor.
pool.on('error', (err) => console.error('Conexión inactiva con error:', err.message));

// En el código escribimos los parámetros como "?" y aquí se convierten al formato de Postgres ($1, $2, ...).
function paraPg(sql) {
    let n = 0;
    return sql.replace(/\?/g, () => `$${++n}`);
}

const query = (sql, params = []) => pool.query(paraPg(sql), params);

// Ejecuta `trabajo(cx)` dentro de una transacción ACID (RNF-3). Si algo falla, hace ROLLBACK.
async function transaccion(trabajo) {
    const cliente = await pool.connect();
    const cx = { query: (sql, params = []) => cliente.query(paraPg(sql), params) };
    try {
        await cliente.query('BEGIN');
        const resultado = await trabajo(cx);
        await cliente.query('COMMIT');
        return resultado;
    } catch (error) {
        try {
            await cliente.query('ROLLBACK');
        } catch {}
        throw error;
    } finally {
        cliente.release();
    }
}

module.exports = { query, transaccion, pool };
