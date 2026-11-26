import Link from 'next/link';
import { pedirJSON } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';
import { dinero, duracion, formatearFechaHora } from '../../lib/formato';

// CU-3.2 / CU-4.1: detalle de consumo, con el monto actualizado cada 2 segundos
export default function Estancia() {
  const usuario = useSesion('Conductor');
  const { datos: b, error, cargando } = useSondeo(() => pedirJSON('/boletos/actual').catch((e) => (e.message === 'No tienes un boleto activo' ? null : Promise.reject(e))), 2000, Boolean(usuario));

  if (!usuario) return null;
  return (
    <main>
      <h1>Boleto registrado</h1>
      {error && <p className="error">{error}</p>}
      {cargando && <p>Cargando…</p>}
      {!cargando && !b && !error && (
        <p>No tienes un boleto activo. <Link href="/conductor/vincular">Registrar boleto</Link></p>
      )}

      {b && (
        <section className="panel boleto">
          <div className="folio-grande">{b.folio}</div>
          <div>{b.estacionamiento}</div>
          <div>Entrada: <strong>{formatearFechaHora(b.entrada)}</strong></div>
          <div>Tiempo: <strong>{duracion(b.minutos)}</strong></div>
          <div>
            Monto: <strong>{dinero(b.pagado ? b.monto_pagado : b.monto_total)}</strong>{' '}
            {b.pagado && !b.tolerancia_vencida && <span className="exito">· Pagado</span>}
            {b.tolerancia_vencida && <span className="error">· Tolerancia vencida</span>}
          </div>
          <div>Ubicación: {b.cajon ? `${b.nivel} · Sector ${b.sector} · Cajón ${b.cajon}` : 'Sin cajón guardado'}</div>
          {b.pagado && !b.tolerancia_vencida && <p className="aviso">Tolerancia restante para salir: <strong>{b.tolerancia_restante} min</strong>. Si no sales a tiempo se te cobrará el tiempo extra.</p>}
          {b.tolerancia_vencida && (
            <p className="aviso">
              <strong>Tu tolerancia para salir terminó hace {duracion(b.minutos_excedidos)}.</strong> Desde entonces se cobra el tiempo extra
              por hora o fracción: <strong>{dinero(b.monto_extra)}</strong>. Págalo en la caseta para poder salir.
            </p>
          )}
          <div className="acciones">
            <Link href="/disponibilidad"><button className="secundario">Verificar disponibilidad</button></Link>
            <Link href="/conductor/ubicacion"><button className="secundario">Ubicar mi vehículo</button></Link>
            {!b.pagado && <Link href="/conductor/pago"><button>Pagar boleto</button></Link>}
            {b.pagado && <Link href="/conductor/comprobante"><button>Ver comprobante</button></Link>}
          </div>
        </section>
      )}
    </main>
  );
}
