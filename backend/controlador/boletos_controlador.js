const modelo = require('../modelo/boletos');
const { manejar } = require('../util/http');
const {
    validarFolio, marcaTarjeta, errorTarjeta, errorCVV, errorTitular, validarVencimiento, validarEnteroPositivo,
} = require('../validaciones');

// POST /api/boletos/entrada  (el conductor pide su boleto en la entrada del estacionamiento).
// El boleto queda registrado en su cuenta de una vez (no hace falta "Registrar boleto").
const entrada = manejar(async (req, res) => {
    const id = (req.body || {}).id_estacionamiento;
    if (!validarEnteroPositivo(id)) return res.status(400).json({ error: 'id_estacionamiento es obligatorio' });
    res.status(201).json(await modelo.entrada(Number(id), req.usuario.id_usuario));
});

const vincular = manejar(async (req, res) => {
    const { folio } = req.body || {};
    if (!validarFolio(folio)) return res.status(400).json({ error: 'Escribe el folio del boleto (solo letras y números)' });
    await modelo.vincular(req.usuario.id_usuario, folio.trim());
    res.json(await modelo.actualDeUsuario(req.usuario.id_usuario));
});

const actual = manejar(async (req, res) => {
    const boleto = await modelo.actualDeUsuario(req.usuario.id_usuario);
    if (!boleto) return res.status(404).json({ error: 'No tienes un boleto activo' });
    res.json(boleto);
});

const historial = manejar(async (req, res) => res.json(await modelo.historial(req.usuario.id_usuario)));

const ubicar = manejar(async (req, res) => {
    const { id_nivel, id_cajon } = req.body || {};
    if (!validarEnteroPositivo(id_nivel) || !validarEnteroPositivo(id_cajon)) {
        return res.status(400).json({ error: 'Elige el nivel y el cajón' });
    }
    await modelo.ubicar(req.usuario.id_usuario, Number(id_nivel), Number(id_cajon));
    res.json(await modelo.actualDeUsuario(req.usuario.id_usuario));
});

const liberar = manejar(async (req, res) => {
    await modelo.liberar(req.usuario.id_usuario);
    res.json(await modelo.actualDeUsuario(req.usuario.id_usuario));
});

// RNF-8: el servidor vuelve a validar la tarjeta aunque la app ya lo haya hecho.
// Los datos de la tarjeta NO se guardan: solo la marca y los últimos 4 dígitos (ej. "Visa ****1111").
const pagar = manejar(async (req, res) => {
    const { titular, numero_tarjeta, vencimiento, cvv } = req.body || {};
    const problema =
        errorTitular(titular) ||
        errorTarjeta(numero_tarjeta) ||
        (!validarVencimiento(vencimiento) && 'El vencimiento debe ser MM/AA y no estar vencido') ||
        errorCVV(cvv, numero_tarjeta);
    if (problema) return res.status(400).json({ error: problema });

    const numero = String(numero_tarjeta).replace(/[\s-]/g, '');
    await modelo.pagar(req.usuario.id_usuario, `${marcaTarjeta(numero)} ****${numero.slice(-4)}`);
    res.status(201).json(await modelo.ultimoComprobante(req.usuario.id_usuario));
});

const comprobante = manejar(async (req, res) => {
    const c = await modelo.ultimoComprobante(req.usuario.id_usuario);
    if (!c) return res.status(404).json({ error: 'Aún no tienes comprobantes' });
    res.json(c);
});

module.exports = { entrada, vincular, actual, historial, ubicar, liberar, pagar, comprobante };
