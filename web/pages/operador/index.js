import Link from 'next/link';
import { pedirJSON } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';
import { dinero, formatearFechaHora } from '../../lib/formato';
import EstadoBoleto, { LeyendaEstados } from '../../components/EstadoBoleto';
import BarraAforo from '../../components/BarraAforo';

export default function PanelOperador() {
  const usuario = useSesion('Operador');
  const { datos: aforo, error } = useSondeo(() => pedirJSON('/operador/aforo'), 2000, Boolean(usuario));
  // Todo el sistema: los estacionamientos de todos los operadores (solo consulta, no se pueden modificar)
  const { datos: global } = useSondeo(() => pedirJSON('/aforo'), 5000, Boolean(usuario));
  const { datos: recientes } = useSondeo(() => pedirJSON('/caseta/recientes'), 3000, Boolean(usuario));
  if (!usuario) return null;

  const mios = new Set(((aforo && aforo.estacionamientos) || []).map((e) => e.id_estacionamiento));

  return (
    <main>
      <h1>Panel del operador</h1>

      <h2>Mis estacionamientos</h2>
      {error && <p className="error">{error}</p>}
      {aforo && aforo.estacionamientos.length === 0 && <p>Aún no has creado estacionamientos. Crea el primero en <Link href="/operador/estacionamientos">Gestión de estacionamientos</Link>.</p>}
      {aforo && aforo.estacionamientos.length > 0 && (
        <div className="numeros">
          <div className="numero verde"><strong>{aforo.libres}</strong>Cajones libres</div>
          <div className="numero roja"><strong>{aforo.ocupados}</strong>Cajones ocupados</div>
          <div className="numero"><strong>{aforo.total}</strong>Capacidad</div>
          <div className="numero"><strong>{aforo.dentro}</strong>Vehículos dentro</div>
        </div>
      )}
      {aforo && aforo.dentro > aforo.ocupados && (
        <p className="pie">Hay {aforo.dentro - aforo.ocupados} vehículo(s) dentro sin cajón guardado (por ejemplo, ya liberaron su cajón y van hacia la salida).</p>
      )}

      <h2>Todo el sistema</h2>
      <p className="pie">Todos los estacionamientos registrados en Smart-Parking, de cualquier operador. Solo puedes administrar los tuyos.</p>
      {global && (
        <>
          <div className="numeros">
            <div className="numero verde"><strong>{global.libres}</strong>Cajones libres</div>
            <div className="numero roja"><strong>{global.ocupados}</strong>Cajones ocupados</div>
            <div className="numero"><strong>{global.total}</strong>Capacidad total</div>
            <div className="numero"><strong>{global.estacionamientos.length}</strong>Estacionamientos</div>
          </div>
          <div className="tabla-scroll">
            <table>
              <thead><tr><th>Estacionamiento</th><th>Dirección</th><th>Libres / Total</th><th>Ocupación</th><th></th></tr></thead>
              <tbody>
                {global.estacionamientos.map((e) => (
                  <tr key={e.id_estacionamiento}>
                    <td>{e.nombre}</td>
                    <td>{e.direccion}</td>
                    <td>{e.libres} / {e.total}</td>
                    <td style={{ minWidth: 120 }}><BarraAforo libres={e.libres} ocupados={e.ocupados} /></td>
                    <td>{mios.has(e.id_estacionamiento) ? <span className="estado estado-pagado">Tuyo</span> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Accesos rápidos</h2>
      <div className="menu-grande">
        <Link href="/disponibilidad">Disponibilidad por nivel</Link>
        <Link href="/operador/estacionamientos">Gestión de estacionamientos</Link>
        <Link href="/operador/cajones">Ocupar / liberar cajones</Link>
        <Link href="/operador/tarifas">Tarifas y condiciones</Link>
        <Link href="/operador/cobro">Cobro y salida</Link>
      </div>
      <div className="encabezado-tabla">
        <h2>Últimos boletos de mis estacionamientos</h2>
        <Link className="btn" href="/operador/boletos">Consultar todos los boletos</Link>
      </div>
      <LeyendaEstados />
      {recientes && recientes.length === 0 && <p>Todavía no hay boletos en tus estacionamientos.</p>}
      {recientes && recientes.length > 0 && (
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Folio</th><th>Entrada</th><th>Estado</th><th>Cajón</th><th>Monto</th></tr></thead>
            <tbody>
              {recientes.map((b) => (
                <tr key={b.folio}>
                  <td>{b.folio}</td><td>{formatearFechaHora(b.entrada)}</td><td><EstadoBoleto estado={b.estado} vencida={b.tolerancia_vencida} /></td>
                  <td>{b.cajon ? `${b.nivel} · ${b.cajon}` : '—'}</td>
                  <td>{b.estado === 'Finalizado' ? `${dinero(b.monto_total)} cobrado` : b.monto_a_cobrar > 0 ? `${dinero(b.monto_a_cobrar)} por cobrar` : 'Sin cobro pendiente'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
