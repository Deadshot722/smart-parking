import { useState, useEffect } from 'react';
import Link from 'next/link';
import { pedirJSON, enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import { formatearFechaHora } from '../../lib/formato';

// RF-1.3 / RF-1.4: entrada del estacionamiento (simula la máquina de la pluma).
// El boleto queda registrado en la cuenta del conductor al pedirlo (solo se puede tener uno activo).
export default function Estacionamiento() {
  const usuario = useSesion('Conductor');
  const [lista, setLista] = useState([]);
  const [idEst, setIdEst] = useState('');
  const [boleto, setBoleto] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    pedirJSON('/estacionamientos')
      .then((l) => { setLista(l); if (l[0]) setIdEst(String(l[0].id_estacionamiento)); })
      .catch((e) => setError(e.message));
  }, [usuario]);

  async function obtener() {
    setError('');
    setEnviando(true);
    try {
      setBoleto(await enviar('/boletos/entrada', 'POST', { id_estacionamiento: Number(idEst) }));
    } catch (err) {
      setBoleto(null);
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!usuario) return null;
  return (
    <main style={{ textAlign: 'center' }}>
      <h1>Estacionamiento</h1>
      <p>Elige el estacionamiento al que vas a entrar y pide tu boleto.</p>
      {lista.length === 0 && !error && <p>No hay estacionamientos registrados.</p>}
      {lista.length > 0 && (
        <label>
          Estacionamiento{' '}
          <select value={idEst} onChange={(e) => { setIdEst(e.target.value); setBoleto(null); }}>
            {lista.map((e) => <option key={e.id_estacionamiento} value={e.id_estacionamiento}>{e.nombre}</option>)}
          </select>
        </label>
      )}
      <p>
        <button style={{ fontSize: 28, padding: '20px 40px' }} onClick={obtener} disabled={!idEst || enviando}>
          {enviando ? 'Imprimiendo…' : 'Obtener boleto'}
        </button>
      </p>
      {error && <p className="error">{error}</p>}
      {boleto && (
        <section className="panel">
          <div className="pie">Folio</div>
          <div className="folio-grande">{boleto.folio}</div>
          <div>Entrada: {formatearFechaHora(boleto.entrada)}</div>
          <div>Cajón asignado: {boleto.nivel} · {boleto.cajon}</div>
          <p className="exito" style={{ marginTop: 10 }}>El boleto ya quedó registrado en tu cuenta.</p>
          <p style={{ marginTop: 14 }}>
            <Link className="btn" href="/conductor/estancia">Ver mi estancia</Link>
          </p>
        </section>
      )}
    </main>
  );
}
