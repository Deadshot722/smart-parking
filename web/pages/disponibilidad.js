import { useState, useEffect } from 'react';
import { pedirJSON } from '../lib/api';
import useSondeo from '../hooks/useSondeo';
import TablaNiveles from '../components/TablaNiveles';
import MapaCajones from '../components/MapaCajones';

export default function Disponibilidad() {
  const { datos: lista, error } = useSondeo(() => pedirJSON('/estacionamientos'), 10000);
  const [idEst, setIdEst] = useState('');
  const [idNivel, setIdNivel] = useState(null);

  useEffect(() => {
    if (lista && lista.length > 0 && !idEst) setIdEst(String(lista[0].id_estacionamiento));
  }, [lista, idEst]);

  const { datos: est, error: errorEst, recargar } = useSondeo(() => pedirJSON(`/estacionamientos/${idEst}`), 2000, Boolean(idEst));
  const { datos: cajones } = useSondeo(() => pedirJSON(`/niveles/${idNivel}/cajones`), 2000, Boolean(idNivel));

  const mensaje = error || errorEst;

  return (
    <main>
      <h1>Disponibilidad por nivel</h1>
      {mensaje && (
        <p className="error">
          {mensaje} <button className="secundario" onClick={recargar}>Reintentar</button>
        </p>
      )}
      {lista && lista.length === 0 && <p>No hay estacionamientos registrados.</p>}

      {lista && lista.length > 0 && (
        <label>
          Estacionamiento{' '}
          <select value={idEst} onChange={(e) => { setIdEst(e.target.value); setIdNivel(null); }}>
            {lista.map((e) => <option key={e.id_estacionamiento} value={e.id_estacionamiento}>{e.nombre}</option>)}
          </select>
        </label>
      )}

      {est && (
        <>
          <p>{est.direccion} · Horario: {est.horario || 'No especificado'}</p>
          <p>Elige un nivel para ver sus cajones:</p>
          <TablaNiveles niveles={est.niveles} onElegir={setIdNivel} elegido={idNivel} />
        </>
      )}

      {idNivel && cajones && (
        <section className="panel" style={{ marginTop: 20 }}>
          <h2>Distribución de cajones</h2>
          <p><span className="libre">■ Disponible</span> · <span className="ocupado">■ Ocupado</span></p>
          <MapaCajones cajones={cajones} />
        </section>
      )}
    </main>
  );
}
