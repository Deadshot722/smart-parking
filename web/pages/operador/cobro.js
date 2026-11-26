import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { pedirJSON, enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import { dinero, duracion, formatearFechaHora } from '../../lib/formato';
import EstadoBoleto, { LeyendaEstados } from '../../components/EstadoBoleto';

// RF-1.5 a RF-1.8: cobro y salida.
// Si hay algo por cobrar, la salida solo se registra cuando el operador confirma que ya lo cobró.
// Si el conductor pagó en la app pero se le venció la tolerancia, también se le puede dar un boleto nuevo por el tiempo extra.
export default function Cobro() {
  const usuario = useSesion('Operador');
  const [folio, setFolio] = useState('');
  const [boleto, setBoleto] = useState(null);
  const [cobrado, setCobrado] = useState(false); // casilla "Ya cobré $X"
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [enviando, setEnviando] = useState(false);

  const router = useRouter();

  async function consultar(texto, { conservarMensajes = false } = {}) {
    if (!conservarMensajes) { setError(''); setExito(''); }
    setBoleto(null);
    setCobrado(false);
    if (!/^[A-Za-z0-9-]{1,20}$/.test(texto.trim())) return setError('Escribe un folio válido.');
    try {
      setBoleto(await pedirJSON(`/caseta/boleto/${encodeURIComponent(texto.trim())}`));
    } catch (err) {
      setError(err.message);
    }
  }

  function buscar(e) {
    e.preventDefault();
    consultar(folio);
  }

  // Si viene de "Consulta de boletos" (/operador/cobro?folio=000001) se busca solo
  useEffect(() => {
    if (!usuario || !router.isReady || typeof router.query.folio !== 'string') return;
    setFolio(router.query.folio);
    consultar(router.query.folio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, router.isReady, router.query.folio]);

  async function registrarSalida() {
    setError('');
    setEnviando(true);
    try {
      const cuerpo = { folio: boleto.folio };
      if (boleto.monto_a_cobrar > 0) cuerpo.cobrado = boleto.monto_a_cobrar;
      const r = await enviar('/caseta/salida', 'POST', cuerpo);
      setExito(r.monto_cobrado > 0 ? `Salida registrada. Cobrado: ${dinero(r.monto_cobrado)}.` : 'Salida registrada sin cobro (pagado con la app y dentro de la tolerancia).');
      setBoleto(null);
      setFolio('');
    } catch (err) {
      // Por ejemplo, el monto cambió porque pasó otra hora: se vuelve a consultar para mostrar el monto nuevo
      setError(err.message);
      consultar(boleto.folio, { conservarMensajes: true });
    } finally {
      setEnviando(false);
    }
  }

  async function darNuevoBoleto() {
    if (!window.confirm(`¿Cerrar el boleto ${boleto.folio} con lo que ya pagó y darle un boleto nuevo por el tiempo extra?`)) return;
    setError('');
    setEnviando(true);
    try {
      const r = await enviar('/caseta/nuevo-boleto', 'POST', { folio: boleto.folio });
      setExito(`Boleto nuevo: ${r.folio_nuevo} (cuenta desde ${formatearFechaHora(r.entrada)}, cuando terminó la tolerancia). El conductor lo puede pagar en la app o aquí en caseta.`);
      setFolio(r.folio_nuevo);
      consultar(r.folio_nuevo, { conservarMensajes: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!usuario) return null;
  const hayCobro = boleto && boleto.estado !== 'Finalizado' && boleto.monto_a_cobrar > 0;
  return (
    <main>
      <h1>Cobro y salida</h1>
      <form onSubmit={buscar} className="fila" noValidate>
        <label>Folio del boleto<input value={folio} onChange={(e) => setFolio(e.target.value)} maxLength={20} /></label>
        <button type="submit">Buscar</button>
      </form>
      <LeyendaEstados />
      {error && <p className="error">{error}</p>}
      {exito && <p className="exito">{exito}</p>}

      {boleto && (
        <section className="panel boleto">
          <div>Folio <strong>{boleto.folio}</strong> · Estado: <EstadoBoleto estado={boleto.estado} vencida={boleto.tolerancia_vencida} /></div>
          <div>Entrada: {formatearFechaHora(boleto.entrada)} · Tiempo: {duracion(boleto.minutos)}</div>
          <div>Monto por el tiempo total: {dinero(boleto.pagado ? boleto.monto_pagado : boleto.monto_total)}</div>
          {boleto.estado === 'Finalizado' && <p className="aviso">Este boleto ya tiene su salida registrada: no hay nada que cobrar.</p>}
          {boleto.estado === 'Pagado' && !boleto.tolerancia_vencida && (
            <p className="aviso">Pagado desde la app. Tolerancia restante: <strong>{boleto.tolerancia_restante} min</strong>. Puede salir sin cobro.</p>
          )}
          {boleto.tolerancia_vencida && (
            <p className="aviso">
              Pagó {dinero(boleto.monto_pagado)} en la app, pero <strong>se le venció la tolerancia hace {duracion(boleto.minutos_excedidos)}</strong>.
              El tiempo extra se cobra por hora o fracción: <strong>{dinero(boleto.monto_extra)}</strong>.
              No puede salir hasta que se le cobre o se le dé un boleto nuevo.
            </p>
          )}
          {boleto.estado === 'Activo' && <p className="aviso">No ha pagado en la app: se cobra todo el tiempo en caseta.</p>}

          <div style={{ fontSize: 28 }}>Monto a cobrar: <strong>{dinero(boleto.estado === 'Finalizado' ? 0 : boleto.monto_a_cobrar)}</strong></div>

          {hayCobro && (
            <label className="casilla confirmar-cobro">
              <input type="checkbox" checked={cobrado} onChange={(e) => setCobrado(e.target.checked)} />
              Ya cobré {dinero(boleto.monto_a_cobrar)} al conductor
            </label>
          )}
          <div className="acciones">
            <button className="secundario" onClick={() => setBoleto(null)}>Cancelar</button>
            {boleto.tolerancia_vencida && (
              <button className="secundario" onClick={darNuevoBoleto} disabled={enviando}>Dar boleto nuevo por el tiempo extra</button>
            )}
            {boleto.estado !== 'Finalizado' && (
              <button onClick={registrarSalida} disabled={enviando || (hayCobro && !cobrado)}>
                {hayCobro ? `Cobrar ${dinero(boleto.monto_a_cobrar)} y registrar salida` : 'Registrar salida'}
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
