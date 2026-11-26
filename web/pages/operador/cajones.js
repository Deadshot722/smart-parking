import Link from 'next/link';
import { useState, useEffect } from 'react';
import { pedirJSON, enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';
import MapaCajones from '../../components/MapaCajones';
import TablaNiveles from '../../components/TablaNiveles';

// CU-2.1 / 2.3: el operador ve la distribución en tiempo real y puede cambiar el estado de un cajón
export default function ControlCajones() {
  const usuario = useSesion('Operador');
  const { datos: lista } = useSondeo(() => pedirJSON('/operador/estacionamientos'), 10000, Boolean(usuario));
  const [idEst, setIdEst] = useState('');
  const [idNivel, setIdNivel] = useState(null);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    if (lista && lista[0] && !idEst) setIdEst(String(lista[0].id_estacionamiento));
  }, [lista, idEst]);

  const { datos: est } = useSondeo(() => pedirJSON(`/estacionamientos/${idEst}`), 2000, Boolean(idEst), idEst);
  const { datos: cajones, recargar } = useSondeo(() => pedirJSON(`/niveles/${idNivel}/cajones`), 2000, Boolean(idNivel), idNivel);

  async function alternar(c) {
    const nuevo = c.estado === 'Disponible' ? 'Ocupado' : 'Disponible';
    if (!window.confirm(`¿Marcar el cajón ${c.numero} como ${nuevo}?`)) return;
    try {
      await enviar(`/cajones/${c.id_cajon}`, 'PUT', { estado: nuevo });
      setMensaje({ tipo: 'exito', texto: `Cajón ${c.numero}: ${nuevo}.` });
      recargar();
    } catch (err) { setMensaje({ tipo: 'error', texto: err.message }); }
  }

  async function eliminarNivel() {
    const n = est.niveles.find((x) => x.id_nivel === idNivel);
    if (!window.confirm(`¿Eliminar el nivel "${n.nombre}" y sus cajones?`)) return;
    try { await enviar(`/niveles/${idNivel}`, 'DELETE'); setIdNivel(null); setMensaje({ tipo: 'exito', texto: 'Nivel eliminado.' }); }
    catch (err) { setMensaje({ tipo: 'error', texto: err.message }); }
  }

  if (!usuario) return null;
  return (
    <main>
      <h1>Control de cajones</h1>
      {lista && lista.length === 0 && <p>Aún no has creado estacionamientos. Crea el primero en <Link href="/operador/estacionamientos">Gestión de estacionamientos</Link>.</p>}
      {lista && lista.length > 0 && (
        <label>Estacionamiento{' '}
          <select value={idEst} onChange={(e) => { setIdEst(e.target.value); setIdNivel(null); }}>
            {lista.map((e) => <option key={e.id_estacionamiento} value={e.id_estacionamiento}>{e.nombre}</option>)}
          </select>
        </label>
      )}
      {est && <TablaNiveles niveles={est.niveles} onElegir={setIdNivel} elegido={idNivel} />}
      {mensaje.texto && <p className={mensaje.tipo === 'error' ? 'error' : 'exito'}>{mensaje.texto}</p>}
      {idNivel && cajones && (
        <section className="panel" style={{ marginTop: 20 }}>
          <p>Haz clic en un cajón para cambiar su estado.</p>
          <MapaCajones cajones={cajones} onElegir={alternar} />
          <button className="peligro" onClick={eliminarNivel}>Eliminar nivel</button>
        </section>
      )}
    </main>
  );
}
