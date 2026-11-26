import { pedirJSON } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';
import { dinero, formatearFechaHora } from '../../lib/formato';

// CU-3.3: historial de estancias finalizadas
export default function Historial() {
  const usuario = useSesion('Conductor');
  const { datos, error, cargando } = useSondeo(() => pedirJSON('/boletos/historial'), 15000, Boolean(usuario));
  if (!usuario) return null;
  return (
    <main>
      <h1>Historial de estancias</h1>
      {error && <p className="error">{error}</p>}
      {cargando && <p>Cargando…</p>}
      {datos && datos.length === 0 && <p>Aún no tienes estancias finalizadas.</p>}
      {datos && datos.length > 0 && (
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Folio</th><th>Estacionamiento</th><th>Entrada</th><th>Salida</th><th>Duración</th><th>Monto</th></tr></thead>
            <tbody>
              {datos.map((h) => (
                <tr key={h.folio}>
                  <td>{h.folio}</td><td>{h.estacionamiento}</td>
                  <td>{formatearFechaHora(h.entrada)}</td><td>{formatearFechaHora(h.salida)}</td>
                  <td>{Math.floor(h.duracion_horas)} h {Math.round((h.duracion_horas % 1) * 60)} min</td>
                  <td>{dinero(h.monto_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
