// Reglas de cobro (RF-1.5, RF-1.7, RF-2.4).
// La tarifa (tarifa.costo) es el precio por hora o fracción. Siempre se cobra al menos 1 hora.

function redondear(n) {
    return Math.round(n * 100) / 100;
}

function calcularMonto(minutos, costo) {
    const horas = Math.max(1, Math.ceil(minutos / 60));
    return redondear(horas * Number(costo));
}

// `fila` trae lo que devuelve modelo/boletos.js (minutos calculados por PostgreSQL, para no depender de zonas horarias).
function resumenCobro(fila) {
    const minutos = Number(fila.minutos_estancia);
    const tolerancia = Number(fila.minutos_tolerancia);
    const resumen = {
        minutos,
        duracion_horas: redondear(minutos / 60),
        monto_total: calcularMonto(minutos, fila.costo),
        pagado: false,
        monto_pagado: 0,
        tolerancia_minutos: tolerancia,
        tolerancia_restante: 0,
        monto_extra: 0,
        monto_a_cobrar: 0,
        // true cuando ya pagó en la app pero no salió a tiempo: desde ese momento se cobra el tiempo extra
        tolerancia_vencida: false,
        minutos_excedidos: 0,
    };

    // Estancia ya cerrada: los montos guardados mandan.
    if (fila.fecha_salida) {
        resumen.monto_total = Number(fila.monto_total || 0);
        resumen.duracion_horas = Number(fila.duracion || 0);
        resumen.pagado = true;
        resumen.monto_pagado = Number(fila.monto_total || 0);
        return resumen;
    }

    if (fila.id_pago) {
        const desdePago = Number(fila.minutos_desde_pago);
        const exceso = Math.max(0, desdePago - tolerancia);
        resumen.pagado = true;
        resumen.monto_pagado = Number(fila.pago_monto);
        resumen.monto_total = Number(fila.pago_monto);
        resumen.tolerancia_restante = Math.max(0, tolerancia - desdePago);
        resumen.monto_extra = exceso > 0 ? calcularMonto(exceso, fila.costo) : 0; // RF-1.7
        resumen.monto_a_cobrar = resumen.monto_extra;
        resumen.tolerancia_vencida = exceso > 0;
        resumen.minutos_excedidos = exceso;
    } else {
        resumen.monto_a_cobrar = resumen.monto_total;
    }
    return resumen;
}

module.exports = { calcularMonto, resumenCobro, redondear };
