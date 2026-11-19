// Error "esperado" con su código HTTP (por ejemplo 404 o 409). Los controladores lo convierten en respuesta.
class ErrorNegocio extends Error {
    constructor(status, mensaje) {
        super(mensaje);
        this.status = status;
    }
}

module.exports = { ErrorNegocio };
