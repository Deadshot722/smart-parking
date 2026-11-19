// Boletos, estancias, pagos y comprobantes. Todo lo que cambia el aforo corre en transacciones ACID (RNF-3).
const db = require('../db');
const { ErrorNegocio } = require('../util/errores');
const { resumenCobro, calcularMonto, redondear } = require('../util/cobro');

// Los minutos se calculan en PostgreSQL (NOW()) para que no dependan de la zona horaria del servidor Node.
const SELECT_DETALLE = `
  SELECT b.id_boleto, b.folio, b.estado, b.id_usuario,
         e.id_estancia, e.id_cajon, e.fecha_entrada, e.fecha_salida, e.duracion, e.monto_total,
         t.costo, t.minutos_tolerancia, est.id_estacionamiento, est.nombre AS estacionamiento,
         c.numero AS cajon, LEFT(c.numero, 1) AS sector, n.id_nivel, n.nombre AS nivel,
         p.id_pago, p.monto AS pago_monto, p.fecha_pago, p.metodo_pago,
         FLOOR(EXTRACT(EPOCH FROM (COALESCE(e.fecha_salida, NOW()) - e.fecha_entrada)) / 60)::int AS minutos_estancia,
         FLOOR(EXTRACT(EPOCH FROM (NOW() - p.fecha_pago)) / 60)::int AS minutos_desde_pago
    FROM boleto b
    JOIN estancia e ON e.id_boleto = b.id_boleto
    JOIN tarifa t ON t.id_tarifa = e.id_tarifa
    JOIN estacionamiento est ON est.id_estacionamiento = t.id_estacionamiento
    LEFT JOIN cajon c ON c.id_cajon = e.id_cajon
    LEFT JOIN nivel n ON n.id_nivel = c.id_nivel
    LEFT JOIN pago p ON p.id_estancia = e.id_estancia`;

function formatear(fila) {
    const cobro = resumenCobro(fila);
    return {
        folio: fila.folio,
        estado: fila.estado,
        estacionamiento: fila.estacionamiento,
        id_estacionamiento: fila.id_estacionamiento,
        entrada: fila.fecha_entrada,
        salida: fila.fecha_salida,
        id_nivel: fila.id_nivel,
        nivel: fila.nivel,
        sector: fila.sector,
        id_cajon: fila.id_cajon,
        cajon: fila.cajon,
        costo_hora: Number(fila.costo),
        metodo_pago: fila.metodo_pago,
        ...cobro,
    };
}

async function consultar(cx, condicion, parametros, { bloquear = false, orden = '', limite = '' } = {}) {
    // FOR UPDATE OF b, e: se bloquean solo boleto y estancia (Postgres no deja bloquear el lado opcional de un LEFT JOIN).
    const { rows } = await cx.query(
        `${SELECT_DETALLE} WHERE ${condicion} ${orden} ${limite} ${bloquear ? 'FOR UPDATE OF b, e' : ''}`,
        parametros
    );
    return rows;
}

async function porFolio(folio) {
    const filas = await consultar(db, 'b.folio = ?', [folio]);
    return filas[0] ? formatear(filas[0]) : undefined;
}

async function actualDeUsuario(idUsuario) {
    const filas = await consultar(db, "b.id_usuario = ? AND b.estado IN ('Activo', 'Pagado')", [idUsuario], {
        orden: 'ORDER BY b.id_boleto DESC',
        limite: 'LIMIT 1',
    });
    return filas[0] ? formatear(filas[0]) : undefined;
}

async function historial(idUsuario) {
    const filas = await consultar(db, "b.id_usuario = ? AND b.estado = 'Finalizado'", [idUsuario], {
        orden: 'ORDER BY e.fecha_salida DESC',
    });
    return filas.map(formatear);
}

// ---------- Kiosco (RF-1.3, RF-1.4): "Obtener boleto" ----------
async function entrada(idEstacionamiento) {
    return db.transaccion(async (cx) => {
        const { rows: tarifas } = await cx.query(
            'SELECT id_tarifa FROM tarifa WHERE id_estacionamiento = ? ORDER BY id_tarifa DESC LIMIT 1',
            [idEstacionamiento]
        );
        if (tarifas.length === 0) throw new ErrorNegocio(409, 'El estacionamiento no tiene una tarifa registrada');

        // Se reserva el primer cajón libre: es lo que "resta un lugar" del aforo (SKIP LOCKED: dos kioscos no se pisan).
        const { rows: libres } = await cx.query(
            `SELECT c.id_cajon, c.numero, n.nombre AS nivel
               FROM cajon c JOIN nivel n ON n.id_nivel = c.id_nivel
              WHERE n.id_estacionamiento = ? AND c.estado = 'Disponible'
              ORDER BY n.id_nivel, c.id_cajon LIMIT 1 FOR UPDATE OF c SKIP LOCKED`,
            [idEstacionamiento]
        );
        if (libres.length === 0) throw new ErrorNegocio(409, 'El estacionamiento está lleno');
        const cajon = libres[0];
        await cx.query("UPDATE cajon SET estado = 'Ocupado' WHERE id_cajon = ?", [cajon.id_cajon]);

        const { rows: reloj } = await cx.query('SELECT NOW() AS ahora');
        const ahora = reloj[0].ahora;
        const { rows: boleto } = await cx.query(
            'INSERT INTO boleto (folio, fecha_entrada) VALUES (?, ?) RETURNING id_boleto',
            [`T${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 20), ahora] // folio temporal; se reemplaza abajo
        );
        const idBoleto = boleto[0].id_boleto;
        const folio = String(idBoleto).padStart(6, '0');
        await cx.query('UPDATE boleto SET folio = ? WHERE id_boleto = ?', [folio, idBoleto]);
        await cx.query('INSERT INTO estancia (id_boleto, id_cajon, id_tarifa, fecha_entrada) VALUES (?, ?, ?, ?)', [
            idBoleto,
            cajon.id_cajon,
            tarifas[0].id_tarifa,
            ahora,
        ]);
        return { folio, entrada: ahora, nivel: cajon.nivel, cajon: cajon.numero };
    });
}

// ---------- Conductor ----------
// CU-3.1: vincular el folio físico a la cuenta
async function vincular(idUsuario, folio) {
    return db.transaccion(async (cx) => {
        const { rows: boletos } = await cx.query('SELECT id_boleto, estado, id_usuario FROM boleto WHERE folio = ? FOR UPDATE', [
            folio,
        ]);
        const boleto = boletos[0];
        if (!boleto) throw new ErrorNegocio(404, 'No existe un boleto con ese folio');
        if (boleto.estado === 'Finalizado') throw new ErrorNegocio(409, 'Ese boleto ya fue finalizado');
        if (boleto.id_usuario && boleto.id_usuario !== idUsuario) {
            throw new ErrorNegocio(409, 'Ese boleto ya está asociado a otra cuenta');
        }
        const { rows: otros } = await cx.query(
            "SELECT id_boleto FROM boleto WHERE id_usuario = ? AND estado IN ('Activo', 'Pagado') AND id_boleto <> ?",
            [idUsuario, boleto.id_boleto]
        );
        if (otros.length > 0) throw new ErrorNegocio(409, 'Ya tienes un boleto activo. Finalízalo antes de registrar otro');
        await cx.query('UPDATE boleto SET id_usuario = ? WHERE id_boleto = ?', [idUsuario, boleto.id_boleto]);
    });
}

async function estanciaActivaBloqueada(cx, idUsuario) {
    const { rows } = await cx.query(
        `SELECT e.id_estancia, e.id_cajon FROM estancia e JOIN boleto b ON b.id_boleto = e.id_boleto
          WHERE b.id_usuario = ? AND b.estado IN ('Activo', 'Pagado') AND e.fecha_salida IS NULL
          ORDER BY b.id_boleto DESC LIMIT 1 FOR UPDATE OF e`,
        [idUsuario]
    );
    if (rows.length === 0) throw new ErrorNegocio(404, 'Primero registra tu boleto');
    return rows[0];
}

// CU-2.2: registrar (o cambiar) el cajón donde quedó el vehículo
async function ubicar(idUsuario, idNivel, idCajon) {
    return db.transaccion(async (cx) => {
        const estancia = await estanciaActivaBloqueada(cx, idUsuario);
        const { rows: cajones } = await cx.query('SELECT id_cajon, estado FROM cajon WHERE id_cajon = ? AND id_nivel = ? FOR UPDATE', [
            idCajon,
            idNivel,
        ]);
        const cajon = cajones[0];
        if (!cajon) throw new ErrorNegocio(404, 'Ese cajón no existe en el nivel elegido');
        if (cajon.id_cajon === estancia.id_cajon) return;
        // RF-2.6: el bloqueo FOR UPDATE garantiza que dos usuarios no ocupen el mismo cajón a la vez.
        if (cajon.estado !== 'Disponible') throw new ErrorNegocio(409, 'El cajón acaba de ser ocupado, seleccione otro');

        if (estancia.id_cajon) await cx.query("UPDATE cajon SET estado = 'Disponible' WHERE id_cajon = ?", [estancia.id_cajon]);
        await cx.query("UPDATE cajon SET estado = 'Ocupado' WHERE id_cajon = ?", [cajon.id_cajon]);
        await cx.query('UPDATE estancia SET id_cajon = ? WHERE id_estancia = ?', [cajon.id_cajon, estancia.id_estancia]);
    });
}

// CU-2.3: "Liberar cajón" (el vehículo se retira del cajón guardado)
async function liberar(idUsuario) {
    return db.transaccion(async (cx) => {
        const estancia = await estanciaActivaBloqueada(cx, idUsuario);
        if (!estancia.id_cajon) throw new ErrorNegocio(409, 'No tienes un cajón guardado');
        await cx.query("UPDATE cajon SET estado = 'Disponible' WHERE id_cajon = ?", [estancia.id_cajon]);
        await cx.query('UPDATE estancia SET id_cajon = NULL WHERE id_estancia = ?', [estancia.id_estancia]);
    });
}

function folioComprobante(id) {
    return `C${String(id).padStart(6, '0')}`;
}

async function crearPagoYComprobante(cx, { idEstancia, monto, metodo, tolerancia }) {
    const { rows: pago } = await cx.query(
        "INSERT INTO pago (id_estancia, monto, metodo_pago, estado) VALUES (?, ?, ?, 'Pagado') RETURNING id_pago",
        [idEstancia, monto, metodo]
    );
    const { rows: comp } = await cx.query(
        'INSERT INTO comprobante (id_pago, folio, monto_pagado, tiempo_tolerancia) VALUES (?, ?, ?, ?) RETURNING id_comprobante',
        [pago[0].id_pago, `T${Date.now()}`.slice(0, 20), monto, tolerancia]
    );
    await cx.query('UPDATE comprobante SET folio = ? WHERE id_comprobante = ?', [
        folioComprobante(comp[0].id_comprobante),
        comp[0].id_comprobante,
    ]);
}

// CU-4.2: pago digital simulado. Los datos de la tarjeta NO se guardan (solo los últimos 4 dígitos).
async function pagar(idUsuario, ultimos4) {
    return db.transaccion(async (cx) => {
        const filas = await consultar(cx, "b.id_usuario = ? AND b.estado IN ('Activo', 'Pagado')", [idUsuario], {
            bloquear: true,
            orden: 'ORDER BY b.id_boleto DESC',
            limite: 'LIMIT 1',
        });
        const fila = filas[0];
        if (!fila) throw new ErrorNegocio(404, 'Primero registra tu boleto');
        if (fila.estado === 'Pagado') throw new ErrorNegocio(409, 'Este boleto ya está pagado');

        const monto = calcularMonto(fila.minutos_estancia, fila.costo);
        await crearPagoYComprobante(cx, {
            idEstancia: fila.id_estancia,
            monto,
            metodo: `Tarjeta ****${ultimos4}`,
            tolerancia: fila.minutos_tolerancia,
        });
        await cx.query("UPDATE boleto SET estado = 'Pagado' WHERE id_boleto = ?", [fila.id_boleto]);
        return monto;
    });
}

// CU-4.3: último comprobante del conductor y tiempo de tolerancia restante
async function ultimoComprobante(idUsuario) {
    const { rows: filas } = await db.query(
        `SELECT cp.folio, cp.fecha_emision, cp.monto_pagado, cp.tiempo_tolerancia,
                p.metodo_pago, p.estado AS estado_pago, b.folio AS folio_boleto, b.estado AS estado_boleto,
                FLOOR(EXTRACT(EPOCH FROM (NOW() - p.fecha_pago)) / 60)::int AS minutos_desde_pago
           FROM comprobante cp
           JOIN pago p ON p.id_pago = cp.id_pago
           JOIN estancia e ON e.id_estancia = p.id_estancia
           JOIN boleto b ON b.id_boleto = e.id_boleto
          WHERE b.id_usuario = ? ORDER BY cp.id_comprobante DESC LIMIT 1`,
        [idUsuario]
    );
    const f = filas[0];
    if (!f) return undefined;
    const { minutos_desde_pago, ...resto } = f;
    return {
        ...resto,
        resultado: f.estado_pago,
        tolerancia_restante: f.estado_boleto === 'Finalizado' ? 0 : Math.max(0, f.tiempo_tolerancia - minutos_desde_pago),
    };
}

// ---------- Caseta (operador): RF-1.5 a RF-1.8 ----------
async function salida(folio) {
    return db.transaccion(async (cx) => {
        const filas = await consultar(cx, 'b.folio = ?', [folio], { bloquear: true });
        const fila = filas[0];
        if (!fila) throw new ErrorNegocio(404, 'No existe un boleto con ese folio');
        if (fila.estado === 'Finalizado') throw new ErrorNegocio(409, 'Ese boleto ya tiene su salida registrada');

        const cobro = resumenCobro(fila);
        const montoTotal = fila.id_pago ? redondear(cobro.monto_pagado + cobro.monto_extra) : cobro.monto_total;

        if (!fila.id_pago) {
            await crearPagoYComprobante(cx, {
                idEstancia: fila.id_estancia,
                monto: montoTotal,
                metodo: 'Efectivo',
                tolerancia: fila.minutos_tolerancia,
            });
        } else if (cobro.monto_extra > 0) {
            await cx.query('UPDATE pago SET monto = ? WHERE id_pago = ?', [montoTotal, fila.id_pago]);
            await cx.query('UPDATE comprobante SET monto_pagado = ? WHERE id_pago = ?', [montoTotal, fila.id_pago]);
        }

        await cx.query('UPDATE estancia SET fecha_salida = NOW(), duracion = ?, monto_total = ? WHERE id_estancia = ?', [
            cobro.duracion_horas,
            montoTotal,
            fila.id_estancia,
        ]);
        await cx.query("UPDATE boleto SET estado = 'Finalizado' WHERE id_boleto = ?", [fila.id_boleto]);
        if (fila.id_cajon) await cx.query("UPDATE cajon SET estado = 'Disponible' WHERE id_cajon = ?", [fila.id_cajon]);

        return { folio: fila.folio, monto_cobrado: cobro.monto_a_cobrar, monto_total: montoTotal, duracion_horas: cobro.duracion_horas };
    });
}

// Últimos boletos para el panel del operador
async function recientes(limite = 10) {
    const filas = await consultar(db, '1 = 1', [], { orden: 'ORDER BY b.id_boleto DESC', limite: `LIMIT ${Number(limite) || 10}` });
    return filas.map(formatear);
}

module.exports = { porFolio, actualDeUsuario, historial, entrada, vincular, ubicar, liberar, pagar, ultimoComprobante, salida, recientes };
