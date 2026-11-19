import { useState } from 'react';
import { pedirJSON, enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import { dinero, duracion, formatearFechaHora } from '../../lib/formato';

// RF-1.5 a RF-1.8: cobro y salida
export default function Cobro() {
  const usuario = useSesion('Operador');
  const [folio, setFolio] = useState('');
  const [boleto, setBoleto] = useState(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  async function buscar(e) {
    e.preventDefault();
    setError(''); setExito(''); setBoleto(null);
    if (!/^[A-Za-z0-9-]{1,20}$/.test(folio.trim())) return setError('Escribe un folio válido.');
    try {
      setBoleto(await pedirJSON(`/caseta/boleto/${encodeURIComponent(folio.trim())}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmar() {
    setError('');
    try {
      const r = await enviar('/caseta/salida', 'POST', { folio: boleto.folio });
      setExito(r.monto_cobrado > 0 ? `Salida registrada. Cobrado: ${dinero(r.monto_cobrado)}.` : 'Salida registrada sin cobro adicional (pagado con la app).');
      setBoleto(null);
      setFolio('');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!usuario) return null;
  return (
    <main>
      <h1>Cobro y salida</h1>
      <form onSubmit={buscar} className="fila" noValidate>
        <label>Folio del boleto<input value={folio} onChange={(e) => setFolio(e.target.value)} maxLength={20} /></label>
        <button type="submit">Buscar</button>
      </form>
      {error && <p className="error">{error}</p>}
      {exito && <p className="exito">{exito}</p>}

      {boleto && (
        <section className="panel boleto">
          <div>Folio <strong>{boleto.folio}</strong> · Estado: <strong>{boleto.estado}</strong></div>
          <div>Entrada: {formatearFechaHora(boleto.entrada)} · Tiempo: {duracion(boleto.minutos)}</div>
          <div>Monto por el tiempo total: {dinero(boleto.pagado ? boleto.monto_pagado : boleto.monto_total)}</div>
          {boleto.estado === 'Pagado' && (
            <p className="aviso">
              Pagado desde la app. Tolerancia restante: <strong>{boleto.tolerancia_restante} min</strong>.
              {boleto.monto_extra > 0 ? ` Se excedió la tolerancia: cobrar ${dinero(boleto.monto_extra)} extra.` : ' Puede salir sin cobro.'}
            </p>
          )}
          <div style={{ fontSize: 28 }}>Monto a cobrar: <strong>{dinero(boleto.monto_a_cobrar)}</strong></div>
          <div className="acciones">
            <button className="secundario" onClick={() => setBoleto(null)}>Cancelar</button>
            <button onClick={confirmar} disabled={boleto.estado === 'Finalizado'}>Confirmar pago y salida</button>
          </div>
        </section>
      )}
    </main>
  );
}
