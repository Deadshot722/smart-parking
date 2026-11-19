import { useState, useEffect } from 'react';
import { pedirJSON, enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import { formatearFechaHora } from '../../lib/formato';

// RF-1.3 / RF-1.4: simulador de la máquina expendedora de la pluma
export default function Kiosco() {
  const usuario = useSesion('Operador');
  const [lista, setLista] = useState([]);
  const [idEst, setIdEst] = useState('');
  const [boleto, setBoleto] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!usuario) return;
    pedirJSON('/estacionamientos')
      .then((l) => { setLista(l); if (l[0]) setIdEst(String(l[0].id_estacionamiento)); })
      .catch((e) => setError(e.message));
  }, [usuario]);

  async function obtener() {
    setError('');
    try {
      setBoleto(await enviar('/boletos/entrada', 'POST', { id_estacionamiento: Number(idEst) }));
    } catch (err) {
      setBoleto(null);
      setError(err.message);
    }
  }

  if (!usuario) return null;
  return (
    <main style={{ textAlign: 'center' }}>
      <h1>Modo kiosco</h1>
      <label>
        Estacionamiento{' '}
        <select value={idEst} onChange={(e) => setIdEst(e.target.value)}>
          {lista.map((e) => <option key={e.id_estacionamiento} value={e.id_estacionamiento}>{e.nombre}</option>)}
        </select>
      </label>
      <p><button style={{ fontSize: 28, padding: '20px 40px' }} onClick={obtener} disabled={!idEst}>Obtener boleto</button></p>
      {error && <p className="error">{error}</p>}
      {boleto && (
        <section className="panel">
          <div className="pie">Folio</div>
          <div className="folio-grande">{boleto.folio}</div>
          <div>Entrada: {formatearFechaHora(boleto.entrada)}</div>
          <div>Cajón asignado: {boleto.nivel} · {boleto.cajon}</div>
        </section>
      )}
    </main>
  );
}
