import Link from 'next/link';
import { pedirJSON } from '../lib/api';
import useSondeo from '../hooks/useSondeo';
import BarraAforo from '../components/BarraAforo';
import { dinero } from '../lib/formato';

// RF-3.2: políticas generales (información estática)
const POLITICAS = [
  'El boleto se obtiene en la pluma de entrada y debe conservarse hasta la salida.',
  'El cobro es por hora o fracción; siempre se cobra al menos una hora.',
  'Después de pagar desde la app hay un tiempo de tolerancia para salir; si se excede se cobra el tiempo extra.',
  'En caso de boleto extraviado acude con el operador en caseta.',
  'El estacionamiento no se hace responsable por objetos de valor dejados dentro del vehículo.',
];

export default function Inicio() {
  const { datos: aforo, error } = useSondeo(() => pedirJSON('/aforo'), 2000);
  const { datos: tarifas } = useSondeo(() => pedirJSON('/tarifas'), 30000);
  // Solo la tarifa en uso de cada estacionamiento (la que se cobra a los boletos nuevos)
  const vigentes = (tarifas || []).filter((t) => t.vigente);

  return (
    <main>
      <h1>Smart-Parking</h1>
      <p>Consulta en tiempo real cuántos cajones hay libres y ocupados.</p>

      {error && <p className="error">{error}</p>}
      {!aforo && !error && <p>Cargando aforo…</p>}

      {aforo && (
        <>
          <div className="numeros">
            <div className="numero verde"><strong>{aforo.libres}</strong>Cajones libres</div>
            <div className="numero roja"><strong>{aforo.ocupados}</strong>Cajones ocupados</div>
            <div className="numero"><strong>{aforo.total}</strong>Capacidad total</div>
          </div>

          <h2>Por estacionamiento</h2>
          <div className="rejilla">
            {aforo.estacionamientos.map((e) => (
              <article key={e.id_estacionamiento} className="tarjeta">
                <h3>{e.nombre}</h3>
                <p>{e.direccion}</p>
                <p>Horario: {e.horario || 'No especificado'}</p>
                <p>
                  <span className="libre">Libres: {e.libres}</span> · <span className="ocupado">Ocupados: {e.ocupados}</span>
                </p>
                <BarraAforo libres={e.libres} ocupados={e.ocupados} />
              </article>
            ))}
          </div>
          <p><Link href="/disponibilidad">Ver detalle por nivel y sector →</Link></p>
        </>
      )}

      <h2>Tarifas</h2>
      {vigentes.length > 0 ? (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr><th>Estacionamiento</th><th>Costo por hora o fracción</th><th>Tolerancia de salida</th></tr>
            </thead>
            <tbody>
              {vigentes.map((t) => (
                <tr key={t.id_tarifa}>
                  <td>{t.estacionamiento}</td>
                  <td>{dinero(t.costo)} (mínimo 1 hora)</td>
                  <td>{t.minutos_tolerancia} min después del pago</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Aún no hay tarifas registradas.</p>
      )}

      <h2>App para Android</h2>
      <section className="panel app-android">
        <p>Consulta los espacios disponibles desde tu celular.</p>
        {/* El archivo se sube a web/public/descargas/ (ver DESPLIEGUE.md → "App Android") */}
        <a className="btn" href="/descargas/smart-parking.apk" download>Descargar la app (APK)</a>
        <p className="pie">Al instalarla, Android pedirá permitir apps de origen desconocido para tu navegador.</p>
      </section>

      <h2>Políticas del estacionamiento</h2>
      <ul>{POLITICAS.map((p) => <li key={p}>{p}</li>)}</ul>
    </main>
  );
}
