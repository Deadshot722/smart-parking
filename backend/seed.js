// Datos de ejemplo: 1 operador, 1 conductor, 1 estacionamiento con 3 niveles y una tarifa.
// Uso:  npm run seed   (después de ejecutar database/smart_parking_postgres.sql)
// Funciona igual contra Postgres local o contra Supabase (según tu DATABASE_URL).
// Contraseña de ambos usuarios: Segura2026
const bcrypt = require('bcryptjs');
const db = require('./db');
const estacionamientos = require('./modelo/estacionamientos');
const tarifas = require('./modelo/tarifas');

async function main() {
    const hash = await bcrypt.hash('Segura2026', 10);
    await db.query(
        `INSERT INTO usuario (nombre, correo, contrasena, rol) VALUES
           ('Operador Demo', 'operador@smartparking.mx', ?, 'Operador'),
           ('Conductor Demo', 'conductor@smartparking.mx', ?, 'Conductor')
         ON CONFLICT (correo) DO NOTHING`,
        [hash, hash]
    );

    const { rows } = await db.query('SELECT COUNT(*) AS n FROM estacionamiento');
    if (rows[0].n === 0) {
        const e = await estacionamientos.crear({ nombre: 'Plaza Central', direccion: 'Av. Insurgentes Sur 1234, CDMX', horario: '07:00 - 23:00' });
        await estacionamientos.crearNivel(e.id_estacionamiento, { nombre: 'Sótano 1', sectores: 2, cajonesPorSector: 10 });
        await estacionamientos.crearNivel(e.id_estacionamiento, { nombre: 'Planta Baja', sectores: 2, cajonesPorSector: 8 });
        await estacionamientos.crearNivel(e.id_estacionamiento, { nombre: 'Piso 1', sectores: 3, cajonesPorSector: 10 });
        await tarifas.crear({ id_estacionamiento: e.id_estacionamiento, costo: 20, horario: 'Por hora o fracción', minutos_tolerancia: 15 });
    }
    console.log('Listo. Operador: operador@smartparking.mx · Conductor: conductor@smartparking.mx · Contraseña: Segura2026');
    await db.pool.end();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
