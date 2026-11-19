import Link from 'next/link';
import { pedirJSON } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';
import { dinero, formatearFechaHora } from '../../lib/formato';

export default function PanelOperador() {
  const usuario = useSesion('Operador');
  const { datos: aforo, error } = useSondeo(() => pedirJSON('/aforo'), 2000, Boolean(usuario));
  const { datos: recientes } = useSondeo(() => pedirJSON('/caseta/recientes'), 3000, Boolean(usuario));
  if (!usuario) return null;
  return (
    <main>
      <h1>Panel del operador</h1>
      {error && <p className="error">{error}</p>}
      {aforo && (
        <div className="numeros">
          <div className="numero verde"><strong>{aforo.libres}</strong>Libres</div>
          <div className="numero roja"><strong>{aforo.ocupados}</strong>Ocupados</div>
          <div className="numero"><strong>{aforo.total}</strong>Capacidad</div>
        </div>
      )}
      <h2>Accesos rápidos</h2>
      <div className="menu-grande">
        <Link href="/operador/kiosco">Modo kiosco (obtener boleto)</Link>
        <Link href="/operador/cobro">Cobro y salida</Link>
        <Link href="/operador/estacionamientos">Estacionamientos y niveles</Link>
        <Link href="/operador/cajones">Control de cajones</Link>
        <Link href="/operador/tarifas">Tarifas</Link>
      </div>
      <h2>Últimos boletos</h2>
      {recientes && recientes.length === 0 && <p>Todavía no hay boletos.</p>}
      {recientes && recientes.length > 0 && (
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Folio</th><th>Entrada</th><th>Estado</th><th>Cajón</th><th>Monto a cobrar</th></tr></thead>
            <tbody>
              {recientes.map((b) => (
                <tr key={b.folio}>
                  <td>{b.folio}</td><td>{formatearFechaHora(b.entrada)}</td><td>{b.estado}</td>
                  <td>{b.cajon ? `${b.nivel} · ${b.cajon}` : '—'}</td>
                  <td>{b.estado === 'Finalizado' ? dinero(b.monto_total) : dinero(b.monto_a_cobrar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
