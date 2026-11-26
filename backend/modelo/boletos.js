// Boletos, estancias, pagos y comprobantes. Todo lo que cambia el aforo corre en transacciones ACID (RNF-3).
const db = require('../db');
const { ErrorNegocio } = require('../util/errores');
const { resumenCobro, calcularMonto, redondear } = require('../util/cobro');
const { minutosDeHora } = require('../validaciones');

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

// ¿El estacionamiento está abierto ahora? Horario "HH:MM - HH:MM" o "24 horas" (sin horario = siempre abierto).
// La hora se toma en la zona horaria del estacionamiento (ZONA_HORARIA, por defecto Ciudad de México), no la del servidor.
const ZONA_HORARIA = process.env.ZONA_HORARIA || 'America/Mexico_City';

async function revisarHorario(cx, idEstacionamiento) {
    const { rows } = await cx.query(
        "SELECT horario, to_char(NOW() AT TIME ZONE ?, 'HH24:MI') AS hora FROM estacionamiento WHERE id_estacionamiento = ?",
        [ZONA_HORARIA, idEstacionamiento]
    );
    if (rows.length === 0) throw new ErrorNegocio(404, 'Estacionamiento no encontrado');
    const { horario, hora } = rows[0];
    const m = /^(\d{2}:\d{2}) - (\d{2}:\d{2})$/.exec(String(horario || '').trim());
    if (!m) return; // "24 horas" o sin horario
    const ahora = minutosDeHora(hora);
    if (ahora < minutosDeHora(m[1]) || ahora >= minutosDeHora(m[2])) {
        throw new ErrorNegocio(409, `El estacionamiento está cerrado en este momento (horario ${horario}, son las ${hora})`);
    }
}

// ---------- Entrada del estacionamiento (RF-1.3, RF-1.4): "Obtener boleto" ----------
// El boleto queda registrado de una vez en la cuenta del conductor que lo pide. Así nadie puede "adivinar"
// un folio ajeno para quedárselo, y cada conductor solo puede tener un boleto activo (no puede llenar el estacionamiento).
async function entrada(idEstacionamiento, idUsuario) {
    return db.transaccion(async (cx) => {
        // Se bloquea la fila del usuario: si manda dos entradas al mismo tiempo, la segunda espera a la primera.
        await cx.query('SELECT id_usuario FROM usuario WHERE id_usuario = ? FOR UPDATE', [idUsuario]);
        const { rows: activos } = await cx.query(
            "SELECT folio FROM boleto WHERE id_usuario = ? AND estado IN ('Activo', 'Pagado') LIMIT 1",
            [idUsuario]
        );
        if (activos.length > 0) {
            throw new ErrorNegocio(409, `Ya tienes un boleto activo (folio ${activos[0].folio}). Sal por la caseta antes de pedir otro`);
        }
        await revisarHorario(cx, idEstacionamiento);

        const { rows: tarifas } = await cx.query(
            'SELECT id_tarifa FROM tarifa WHERE id_estacionamiento = ? ORDER BY id_tarifa DESC LIMIT 1',
            [idEstacionamiento]
        );
        if (tarifas.length === 0) throw new ErrorNegocio(409, 'El estacionamiento no tiene una tarifa registrada');

        // Se reserva el primer cajón libre: es lo que "resta un lugar" del aforo (SKIP LOCKED: dos entradas no se pisan).
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
            'INSERT INTO boleto (id_usuario, folio, fecha_entrada) VALUES (?, ?, ?) RETURNING id_boleto',
            [idUsuario, `T${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 20), ahora] // folio temporal; se reemplaza abajo
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

// CU-4.2: pago digital simulado. Los datos de la tarjeta NO se guardan (solo marca y últimos 4 dígitos).
async function pagar(idUsuario, metodo) {
    return db.transaccion(async (cx) => {
        const filas = await consultar(cx, "b.id_usuario = ? AND b.estado IN ('Activo', 'Pagado')", [idUsuario], {
            bloquear: true,
            orden: 'ORDER BY b.id_boleto DESC',
            limite: 'LIMIT 1',
        });
        const fila = filas[0];
        if (!fila) throw new ErrorNegocio(404, 'Primero registra tu boleto');
        if (fila.estado === 'Pagado') {
            if (resumenCobro(fila).tolerancia_vencida) {
                throw new ErrorNegocio(409, 'Tu tolerancia para salir ya terminó: el tiempo extra se paga en la caseta');
            }
            throw new ErrorNegocio(409, 'Este boleto ya está pagado');
        }

        const monto = calcularMonto(fila.minutos_estancia, fila.costo);
        await crearPagoYComprobante(cx, {
            idEstancia: fila.id_estancia,
            monto,
            metodo,
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
// Condición SQL: el estacionamiento del boleto ("est") es del operador del parámetro
const DEL_OPERADOR = 'est.id_estacionamiento IN (SELECT id_estacionamiento FROM operador_estacionamiento WHERE id_usuario = ?)';
const NO_ES_TUYO = 'Ese boleto es de un estacionamiento que no administras';

const dinero = (n) => `$${Number(n).toFixed(2)}`;

// Bloquea el boleto (y su estancia) y revisa que sea de un estacionamiento del operador
async function boletoDeCaseta(cx, folio, idOperador) {
    const filas = await consultar(cx, 'b.folio = ?', [folio], { bloquear: true });
    const fila = filas[0];
    if (!fila) throw new ErrorNegocio(404, 'No existe un boleto con ese folio');
    if (idOperador) {
        const { rows } = await cx.query(
            'SELECT 1 FROM operador_estacionamiento WHERE id_usuario = ? AND id_estacionamiento = ?',
            [idOperador, fila.id_estacionamiento]
        );
        if (rows.length === 0) throw new ErrorNegocio(403, NO_ES_TUYO);
    }
    if (fila.estado === 'Finalizado') throw new ErrorNegocio(409, 'Ese boleto ya tiene su salida registrada');
    return fila;
}

// RF-1.8: registrar la salida en caseta.
// Si hay algo por cobrar (no pagó en la app, o pagó pero se le venció la tolerancia), el operador DEBE confirmar
// que lo cobró mandando `cobrado` con el monto exacto. Sin esa confirmación no se puede dar la salida
// (la otra opción es darle un boleto nuevo por el tiempo extra: ver nuevoBoletoPorExcedente).
async function salida(folio, idOperador, cobrado) {
    return db.transaccion(async (cx) => {
        const fila = await boletoDeCaseta(cx, folio, idOperador);
        const cobro = resumenCobro(fila);
        const aCobrar = cobro.monto_a_cobrar;

        if (aCobrar > 0) {
            if (cobrado === undefined || cobrado === null || cobrado === '') {
                throw new ErrorNegocio(
                    409,
                    cobro.tolerancia_vencida
                        ? `Falta cobrar ${dinero(aCobrar)}: se le venció la tolerancia. Confirma el cobro o dale un boleto nuevo por el tiempo extra`
                        : `Falta cobrar ${dinero(aCobrar)}: el conductor no ha pagado. Confirma que ya se lo cobraste`
                );
            }
            // El monto se recalcula aquí: si pasó otra hora desde que se consultó el boleto, hay que volver a confirmar
            if (Math.abs(Number(cobrado) - aCobrar) > 0.009) {
                throw new ErrorNegocio(409, `El monto a cobrar es ${dinero(aCobrar)} (pudo cambiar si pasó otra hora). Revisa el boleto y confirma de nuevo`);
            }
        }

        const montoTotal = fila.id_pago ? redondear(cobro.monto_pagado + cobro.monto_extra) : cobro.monto_total;
        if (!fila.id_pago) {
            await crearPagoYComprobante(cx, {
                idEstancia: fila.id_estancia,
                monto: montoTotal,
                metodo: 'Efectivo',
                tolerancia: fila.minutos_tolerancia,
            });
        }
        // Si pagó en la app y se pasó de la tolerancia, el extra se cobra aquí. El pago y el comprobante de
        // la app NO se modifican (siguen diciendo lo que se pagó con tarjeta); el total real queda en estancia.monto_total.

        await cx.query('UPDATE estancia SET fecha_salida = NOW(), duracion = ?, monto_total = ? WHERE id_estancia = ?', [
            cobro.duracion_horas,
            montoTotal,
            fila.id_estancia,
        ]);
        await cx.query("UPDATE boleto SET estado = 'Finalizado' WHERE id_boleto = ?", [fila.id_boleto]);
        if (fila.id_cajon) await cx.query("UPDATE cajon SET estado = 'Disponible' WHERE id_cajon = ?", [fila.id_cajon]);

        return { folio: fila.folio, monto_cobrado: aCobrar, monto_total: montoTotal, duracion_horas: cobro.duracion_horas };
    });
}

// Tolerancia vencida: en lugar de cobrar el extra en caseta, el operador le da un BOLETO NUEVO.
// - El boleto pagado se cierra con lo que ya pagó, a la hora en que terminó su tolerancia.
// - El boleto nuevo empieza a contar desde esa misma hora, en el mismo cajón y con la misma tarifa,
//   y queda en la cuenta del mismo conductor: lo puede pagar en la app o en caseta como cualquier boleto.
async function nuevoBoletoPorExcedente(folio, idOperador) {
    return db.transaccion(async (cx) => {
        const fila = await boletoDeCaseta(cx, folio, idOperador);
        const cobro = resumenCobro(fila);
        if (!cobro.tolerancia_vencida) {
            throw new ErrorNegocio(409, 'Solo se da un boleto nuevo cuando el boleto ya se pagó y se le venció la tolerancia');
        }

        const { rows: tiempos } = await cx.query(
            `SELECT p.fecha_pago + make_interval(mins => ?::int) AS fin_tolerancia,
                    e.fecha_entrada, e.id_tarifa
               FROM estancia e JOIN pago p ON p.id_estancia = e.id_estancia
              WHERE e.id_estancia = ?`,
            [fila.minutos_tolerancia, fila.id_estancia]
        );
        const { fin_tolerancia: fin, fecha_entrada: entrada, id_tarifa: idTarifa } = tiempos[0];
        const horas = redondear((new Date(fin) - new Date(entrada)) / 3600000);

        // 1) Se cierra el boleto pagado (el cajón sigue ocupado: el auto no ha salido)
        await cx.query('UPDATE estancia SET fecha_salida = ?, duracion = ?, monto_total = ? WHERE id_estancia = ?', [
            fin,
            horas,
            cobro.monto_pagado,
            fila.id_estancia,
        ]);
        await cx.query("UPDATE boleto SET estado = 'Finalizado' WHERE id_boleto = ?", [fila.id_boleto]);

        // 2) Boleto nuevo desde que terminó la tolerancia
        const { rows: nuevo } = await cx.query(
            'INSERT INTO boleto (id_usuario, folio, fecha_entrada) VALUES (?, ?, ?) RETURNING id_boleto',
            [fila.id_usuario, `T${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 20), fin]
        );
        const idBoleto = nuevo[0].id_boleto;
        const folioNuevo = String(idBoleto).padStart(6, '0');
        await cx.query('UPDATE boleto SET folio = ? WHERE id_boleto = ?', [folioNuevo, idBoleto]);
        await cx.query('INSERT INTO estancia (id_boleto, id_cajon, id_tarifa, fecha_entrada) VALUES (?, ?, ?, ?)', [
            idBoleto,
            fila.id_cajon,
            idTarifa,
            fin,
        ]);
        return { folio_anterior: fila.folio, folio_nuevo: folioNuevo, entrada: fin };
    });
}

// Últimos boletos para el panel del operador (solo de sus estacionamientos)
async function recientes(limite = 10, idOperador) {
    const filas = await consultar(db, idOperador ? DEL_OPERADOR : '1 = 1', idOperador ? [idOperador] : [], {
        orden: 'ORDER BY b.id_boleto DESC',
        limite: `LIMIT ${Number(limite) || 10}`,
    });
    return filas.map(formatear);
}

// Consulta de todos los boletos de los estacionamientos del operador, con filtros y páginas
const ESTADOS = ['Activo', 'Pagado', 'Finalizado'];

async function buscarDelOperador(idOperador, { folio, estado, idEstacionamiento, pagina = 1, porPagina = 20 } = {}) {
    const condiciones = [DEL_OPERADOR];
    const parametros = [idOperador];
    if (folio) {
        condiciones.push('b.folio ILIKE ?');
        parametros.push(`%${folio}%`);
    }
    if (estado) {
        condiciones.push('b.estado = ?');
        parametros.push(estado);
    }
    if (idEstacionamiento) {
        condiciones.push('est.id_estacionamiento = ?');
        parametros.push(idEstacionamiento);
    }
    const donde = condiciones.join(' AND ');

    const { rows: conteo } = await db.query(
        `SELECT COUNT(*) AS total
           FROM boleto b
           JOIN estancia e ON e.id_boleto = b.id_boleto
           JOIN tarifa t ON t.id_tarifa = e.id_tarifa
           JOIN estacionamiento est ON est.id_estacionamiento = t.id_estacionamiento
          WHERE ${donde}`,
        parametros
    );
    const filas = await consultar(db, donde, parametros, {
        orden: 'ORDER BY b.id_boleto DESC',
        limite: `LIMIT ${Number(porPagina)} OFFSET ${(Number(pagina) - 1) * Number(porPagina)}`,
    });
    return { total: Number(conteo[0].total), boletos: filas.map(formatear) };
}

module.exports = { ESTADOS, buscarDelOperador, NO_ES_TUYO, porFolio, actualDeUsuario, historial, entrada, vincular, ubicar, liberar, pagar, ultimoComprobante, salida, nuevoBoletoPorExcedente, recientes };
