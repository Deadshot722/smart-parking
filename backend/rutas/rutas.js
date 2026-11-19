const express = require('express');
const { requerirSesion, requerirRol } = require('../middleware/auth');
const auth = require('../controlador/auth_controlador');
const est = require('../controlador/estacionamientos_controlador');
const tarifas = require('../controlador/tarifas_controlador');
const boletos = require('../controlador/boletos_controlador');
const caseta = require('../controlador/caseta_controlador');

const router = express.Router();
const conductor = [requerirSesion, requerirRol('Conductor')];
const operador = [requerirSesion, requerirRol('Operador')];

// Autenticación
router.post('/auth/registro', auth.registro);
router.post('/auth/login', auth.login);
router.post('/auth/logout', requerirSesion, auth.logout);
router.get('/auth/yo', requerirSesion, auth.yo);

// Consulta pública (web informativa y app): aforo, niveles, cajones, tarifas
router.get('/aforo', est.aforo);
router.get('/estacionamientos', est.listar);
router.get('/estacionamientos/:id', est.obtener);
router.get('/niveles/:id/cajones', est.cajones);
router.get('/tarifas', tarifas.listar);

// Administración (operador) - CU-5.2 y CU-5.3
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

// Kiosco (simulador de pluma, sin sesión)
router.post('/boletos/entrada', boletos.entrada);

// Conductor
router.post('/boletos/vincular', conductor, boletos.vincular);
router.get('/boletos/actual', conductor, boletos.actual);
router.get('/boletos/historial', conductor, boletos.historial);
router.put('/boletos/ubicacion', conductor, boletos.ubicar);
router.delete('/boletos/ubicacion', conductor, boletos.liberar);
router.post('/boletos/pagar', conductor, boletos.pagar);
router.get('/boletos/comprobante', conductor, boletos.comprobante);

// Caseta (operador)
router.get('/caseta/recientes', operador, caseta.recientes);
router.get('/caseta/boleto/:folio', operador, caseta.consultar);
router.post('/caseta/salida', operador, caseta.salida);

module.exports = router;
