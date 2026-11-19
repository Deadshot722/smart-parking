const modelo = require('../modelo/boletos');
const { manejar } = require('../util/http');
const {
    validarFolio, validarTarjeta, validarVencimiento, validarCVV, validarEnteroPositivo,
} = require('../validaciones');

// POST /api/boletos/entrada  (simulador de pluma / modo kiosco, sin sesión)
const entrada = manejar(async (req, res) => {
    const id = (req.body || {}).id_estacionamiento;
    if (!validarEnteroPositivo(id)) return res.status(400).json({ error: 'id_estacionamiento es obligatorio' });
    res.status(201).json(await modelo.entrada(Number(id)));
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

// RNF-8: el servidor vuelve a validar la tarjeta aunque la app ya lo haya hecho
const pagar = manejar(async (req, res) => {
    const { numero_tarjeta, vencimiento, cvv } = req.body || {};
    if (!validarTarjeta(numero_tarjeta)) return res.status(400).json({ error: 'El número de tarjeta debe tener 16 dígitos' });
    if (!validarVencimiento(vencimiento)) return res.status(400).json({ error: 'El vencimiento debe ser MM/AA y no estar vencido' });
    if (!validarCVV(cvv)) return res.status(400).json({ error: 'El CVV debe tener 3 dígitos' });

    const ultimos4 = numero_tarjeta.replace(/\s/g, '').slice(-4);
    await modelo.pagar(req.usuario.id_usuario, ultimos4);
    res.status(201).json(await modelo.ultimoComprobante(req.usuario.id_usuario));
});

const comprobante = manejar(async (req, res) => {
    const c = await modelo.ultimoComprobante(req.usuario.id_usuario);
    if (!c) return res.status(404).json({ error: 'Aún no tienes comprobantes' });
    res.json(c);
});

module.exports = { entrada, vincular, actual, historial, ubicar, liberar, pagar, comprobante };
