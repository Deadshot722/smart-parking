const modelo = require('../modelo/boletos');
const { manejar } = require('../util/http');
const { validarFolio } = require('../validaciones');
const estacionamientos = require('../modelo/estacionamientos');

// RF-1.5 / 1.6 / 1.7: consulta del folio con el monto a cobrar
const consultar = manejar(async (req, res) => {
    if (!validarFolio(req.params.folio)) return res.status(400).json({ error: 'Folio inválido' });
    const boleto = await modelo.porFolio(req.params.folio.trim());
    if (!boleto) return res.status(404).json({ error: 'No existe un boleto con ese folio' });
    // El operador solo cobra boletos de sus propios estacionamientos
    if (!(await estacionamientos.esDelOperador(req.usuario.id_usuario, boleto.id_estacionamiento))) {
        return res.status(403).json({ error: modelo.NO_ES_TUYO });
    }
    res.json(boleto);
});

// RF-1.8: registrar salida. Si hay algo por cobrar, `cobrado` (el monto que el operador cobró) es obligatorio.
const salida = manejar(async (req, res) => {
    const { folio, cobrado } = req.body || {};
    if (!validarFolio(folio)) return res.status(400).json({ error: 'Folio inválido' });
    if (cobrado !== undefined && cobrado !== null && !(Number.isFinite(Number(cobrado)) && Number(cobrado) >= 0)) {
        return res.status(400).json({ error: 'El monto cobrado no es válido' });
    }
    res.json(await modelo.salida(folio.trim(), req.usuario.id_usuario, cobrado));
});

// Tolerancia vencida: boleto nuevo por el tiempo extra (en lugar de cobrarlo en caseta)
const nuevoBoleto = manejar(async (req, res) => {
    const { folio } = req.body || {};
    if (!validarFolio(folio)) return res.status(400).json({ error: 'Folio inválido' });
    res.status(201).json(await modelo.nuevoBoletoPorExcedente(folio.trim(), req.usuario.id_usuario));
});

// Consulta de TODOS los boletos del operador: ?folio=&estado=&estacionamiento=&pagina=
const POR_PAGINA = 20;
const todos = manejar(async (req, res) => {
    const { folio = '', estado = '', estacionamiento = '', pagina = '1' } = req.query;
    if (folio && !/^[A-Za-z0-9-]{1,20}$/.test(folio)) return res.status(400).json({ error: 'El folio solo puede tener letras, números y guiones' });
    if (estado && !modelo.ESTADOS.includes(estado)) return res.status(400).json({ error: 'El estado debe ser Activo, Pagado o Finalizado' });
    const idEst = estacionamiento ? Number(estacionamiento) : null;
    if (estacionamiento && !(Number.isInteger(idEst) && idEst > 0)) return res.status(400).json({ error: 'Estacionamiento inválido' });
    if (idEst && !(await estacionamientos.esDelOperador(req.usuario.id_usuario, idEst))) {
        return res.status(403).json({ error: 'Este estacionamiento no te pertenece' });
    }
    const numPagina = Math.max(1, Math.min(10000, parseInt(pagina, 10) || 1));

    const { total, boletos } = await modelo.buscarDelOperador(req.usuario.id_usuario, {
        folio,
        estado,
        idEstacionamiento: idEst,
        pagina: numPagina,
        porPagina: POR_PAGINA,
    });
    res.json({ total, pagina: numPagina, por_pagina: POR_PAGINA, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)), boletos });
});

const recientes = manejar(async (req, res) => res.json(await modelo.recientes(15, req.usuario.id_usuario)));

module.exports = { consultar, salida, nuevoBoleto, recientes, todos };
