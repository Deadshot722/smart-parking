const express = require('express');
const { requerirSesion, requerirRol } = require('../middleware/auth');
const auth = require('../controlador/auth_controlador');
const est = require('../controlador/estacionamientos_controlador');
const tarifas = require('../controlador/tarifas_controlador');
const boletos = require('../controlador/boletos_controlador');
const caseta = require('../controlador/caseta_controlador');
const github = require('../controlador/github_controlador');

const router = express.Router();
const conductor = [requerirSesion, requerirRol('Conductor')];
const operador = [requerirSesion, requerirRol('Operador')];

// Autenticación
router.post('/auth/registro', auth.registro);
router.post('/auth/login', auth.login);
router.post('/auth/logout', requerirSesion, auth.logout);
router.get('/auth/yo', requerirSesion, auth.yo);

// Registro e inicio de sesión con GitHub (OAuth)
router.get('/auth/github', github.inicio);
router.get('/auth/github/callback', github.callback);

// Consulta pública (página de inicio, CU-5.1): aforo general, lista de estacionamientos y tarifas
router.get('/aforo', est.aforo);
router.get('/estacionamientos', est.listar);
router.get('/tarifas', tarifas.listar);

// CU-2.1: distribución por nivel y cajones (conductor u operador con sesión)
router.get('/estacionamientos/:id', requerirSesion, est.obtener);
router.get('/niveles/:id/cajones', requerirSesion, est.cajones);

// Administración (operador) - CU-5.2 y CU-5.3. Cada operador solo ve y modifica los estacionamientos que creó.
router.get('/operador/estacionamientos', operador, est.listarPropios);
router.get('/operador/aforo', operador, est.aforoPropio);
router.get('/operador/tarifas', operador, tarifas.listarPropias);
router.post('/estacionamientos', operador, est.crear);
router.put('/estacionamientos/:id', operador, est.actualizar);
router.delete('/estacionamientos/:id', operador, est.eliminar);
router.post('/estacionamientos/:id/niveles', operador, est.crearNivel);
router.put('/niveles/:id', operador, est.actualizarNivel);
router.delete('/niveles/:id', operador, est.eliminarNivel);
router.put('/cajones/:id', operador, est.estadoCajon);
router.post('/tarifas', operador, tarifas.crear);
router.put('/tarifas/:id', operador, tarifas.actualizar);
router.delete('/tarifas/:id', operador, tarifas.eliminar);

// Conductor: pedir boleto en la entrada del estacionamiento (simulador de la pluma)
router.post('/boletos/entrada', conductor, boletos.entrada);

// Conductor: CU-3.1, 3.2, 3.3, 2.2, 2.3, 4.1, 4.2, 4.3
router.post('/boletos/vincular', conductor, boletos.vincular);
router.get('/boletos/actual', conductor, boletos.actual);
router.get('/boletos/historial', conductor, boletos.historial);
router.put('/boletos/ubicacion', conductor, boletos.ubicar);
router.delete('/boletos/ubicacion', conductor, boletos.liberar);
router.post('/boletos/pagar', conductor, boletos.pagar);
router.get('/boletos/comprobante', conductor, boletos.comprobante);

// Caseta de cobro y salida (operador)
router.get('/caseta/recientes', operador, caseta.recientes);
router.get('/caseta/boletos', operador, caseta.todos);
router.get('/caseta/boleto/:folio', operador, caseta.consultar);
router.post('/caseta/salida', operador, caseta.salida);
router.post('/caseta/nuevo-boleto', operador, caseta.nuevoBoleto);

module.exports = router;
