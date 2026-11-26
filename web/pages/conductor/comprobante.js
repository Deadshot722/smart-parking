import Link from 'next/link';
import { pedirJSON } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';
import { dinero, formatearFechaHora } from '../../lib/formato';

// CU-4.3: comprobante digital y tiempo de tolerancia restante
export default function Comprobante() {
  const usuario = useSesion('Conductor');
  const { datos: c, error } = useSondeo(() => pedirJSON('/boletos/comprobante'), 5000, Boolean(usuario));
  if (!usuario) return null;
  return (
    <main>
      <h1>Comprobante</h1>
      {error && <p className="error">{error}</p>}
      {c && (
        <section className="panel boleto">
          <div>Folio: <strong>{c.folio}</strong> (boleto {c.folio_boleto})</div>
          <div>Fecha: {formatearFechaHora(c.fecha_emision)}</div>
          <div>Monto: <strong>{dinero(c.monto_pagado)}</strong></div>
          <div>Método: {c.metodo_pago}</div>
          <div>Resultado: <strong className="exito">{c.resultado}</strong></div>
          {c.estado_boleto !== 'Finalizado' && (
            <p className="aviso">Tiempo de tolerancia restante: <strong>{c.tolerancia_restante} min</strong>. Si excedes ese tiempo se cobrará el tiempo extra en caseta.</p>
          )}
          <div className="acciones">
            <Link href="/conductor/estancia"><button>Aceptar</button></Link>
            <button className="secundario" onClick={() => window.print()}>Imprimir</button>
          </div>
        </section>
      )}
    </main>
  );
}
