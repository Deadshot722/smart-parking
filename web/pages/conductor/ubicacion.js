import { useState, useEffect } from 'react';
import { pedirJSON, enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';
import MapaCajones from '../../components/MapaCajones';

// CU-2.1 / 2.2 / 2.3: elegir nivel y cajón libre, guardar la ubicación o liberar el cajón
export default function Ubicacion() {
  const usuario = useSesion('Conductor');
  const { datos: b, error: errorBoleto, recargar } = useSondeo(() => pedirJSON('/boletos/actual'), 3000, Boolean(usuario));
  const idEst = b && b.id_estacionamiento;
  const { datos: est } = useSondeo(() => pedirJSON(`/estacionamientos/${idEst}`), 5000, Boolean(idEst));
  const [idNivel, setIdNivel] = useState('');
  const [cajon, setCajon] = useState(null);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    if (est && !idNivel && est.niveles.length > 0) setIdNivel(String(est.niveles[0].id_nivel));
  }, [est, idNivel]);

  const { datos: cajones } = useSondeo(() => pedirJSON(`/niveles/${idNivel}/cajones`), 2000, Boolean(idNivel));

  async function guardar() {
    setMensaje({ tipo: '', texto: '' });
    if (!cajon) return setMensaje({ tipo: 'error', texto: 'Elige un cajón disponible.' });
    if (b.cajon && !window.confirm(`Ya tienes guardado el cajón ${b.cajon}. ¿Quieres cambiarlo?`)) return; // flujo alterno 2
    try {
      await enviar('/boletos/ubicacion', 'PUT', { id_nivel: Number(idNivel), id_cajon: cajon.id_cajon });
      setMensaje({ tipo: 'exito', texto: `Ubicación guardada: cajón ${cajon.numero}.` });
      setCajon(null);
      recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message }); // "El cajón acaba de ser ocupado, seleccione otro"
    }
  }

  async function liberar() {
    try {
      await enviar('/boletos/ubicacion', 'DELETE');
      setMensaje({ tipo: 'exito', texto: 'Cajón liberado.' });
      recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  }

  if (!usuario) return null;
  return (
    <main>
      <h1>Ubicar mi vehículo</h1>
      {errorBoleto && <p className="error">{errorBoleto} (primero registra tu boleto)</p>}
      {b && (
        <>
          <p>Cajón guardado actualmente: <strong>{b.cajon ? `${b.nivel} · Cajón ${b.cajon}` : 'ninguno'}</strong></p>
          {est && (
            <label>
              Nivel{' '}
              <select value={idNivel} onChange={(e) => { setIdNivel(e.target.value); setCajon(null); }}>
                {est.niveles.map((n) => <option key={n.id_nivel} value={n.id_nivel}>{n.nombre} ({n.libres} libres)</option>)}
              </select>
            </label>
          )}
          {cajones && (
            <section className="panel" style={{ marginTop: 14 }}>
              <p>Toca un cajón <span className="libre">disponible</span> para elegirlo.</p>
              <MapaCajones cajones={cajones} elegido={cajon && cajon.id_cajon} onElegir={(c) => c.estado === 'Disponible' && setCajon(c)} />
            </section>
          )}
          <div className="acciones">
            <button className="secundario" onClick={liberar} disabled={!b.cajon}>Liberar cajón</button>
            <button onClick={guardar} disabled={!cajon}>Guardar{cajon ? ` (${cajon.numero})` : ''}</button>
          </div>
        </>
      )}
      {mensaje.texto && <p className={mensaje.tipo === 'error' ? 'error' : 'exito'}>{mensaje.texto}</p>}
    </main>
  );
}
