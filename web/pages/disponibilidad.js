import { useState, useEffect } from 'react';
import { pedirJSON } from '../lib/api';
import useSondeo from '../hooks/useSondeo';
import useSesion from '../hooks/useSesion';
import TablaNiveles from '../components/TablaNiveles';
import MapaCajones from '../components/MapaCajones';

// CU-2.1: conductor u operador con sesión iniciada
export default function Disponibilidad() {
  const usuario = useSesion();
  const { datos: lista, error } = useSondeo(
    // El operador solo ve los estacionamientos que creó; el conductor ve todos
    () => pedirJSON(usuario && usuario.rol === 'Operador' ? '/operador/estacionamientos' : '/estacionamientos'),
    10000,
    Boolean(usuario)
  );
  const [idEst, setIdEst] = useState('');
  const [idNivel, setIdNivel] = useState(null);

  useEffect(() => {
    if (lista && lista.length > 0 && !idEst) setIdEst(String(lista[0].id_estacionamiento));
  }, [lista, idEst]);

  const { datos: est, error: errorEst, recargar } = useSondeo(() => pedirJSON(`/estacionamientos/${idEst}`), 2000, Boolean(usuario && idEst), idEst);
  const { datos: cajones } = useSondeo(() => pedirJSON(`/niveles/${idNivel}/cajones`), 2000, Boolean(usuario && idNivel), idNivel);

  const mensaje = error || errorEst;
  if (!usuario) return null;

  return (
    <main>
      <h1>Disponibilidad por nivel</h1>
      {mensaje && (
        <p className="error">
          {mensaje} <button className="secundario" onClick={recargar}>Reintentar</button>
        </p>
      )}
      {lista && lista.length === 0 && <p>{usuario.rol === 'Operador' ? 'Aún no has creado estacionamientos.' : 'No hay estacionamientos registrados.'}</p>}

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
