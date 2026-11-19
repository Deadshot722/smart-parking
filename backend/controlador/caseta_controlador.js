const modelo = require('../modelo/boletos');
const { manejar } = require('../util/http');
const { validarFolio } = require('../validaciones');

// RF-1.5 / 1.6 / 1.7: consulta del folio con el monto a cobrar
const consultar = manejar(async (req, res) => {
    if (!validarFolio(req.params.folio)) return res.status(400).json({ error: 'Folio inválido' });
    const boleto = await modelo.porFolio(req.params.folio.trim());
    if (!boleto) return res.status(404).json({ error: 'No existe un boleto con ese folio' });
    res.json(boleto);
});

// RF-1.8: confirmar pago y registrar salida
const salida = manejar(async (req, res) => {
    const { folio } = req.body || {};
    if (!validarFolio(folio)) return res.status(400).json({ error: 'Folio inválido' });
    res.json(await modelo.salida(folio.trim()));
});

const recientes = manejar(async (req, res) => res.json(await modelo.recientes(15)));

module.exports = { consultar, salida, recientes };
