import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';

export default function Vincular() {
  const usuario = useSesion('Conductor');
  const router = useRouter();
  const [folio, setFolio] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Si viene de "Pedir boleto", el folio ya llega escrito
  useEffect(() => {
    if (router.isReady && typeof router.query.folio === 'string') setFolio(router.query.folio);
  }, [router.isReady, router.query.folio]);

  async function asociar(e) {
    e.preventDefault();
    setError('');
    if (!/^[A-Za-z0-9-]{1,20}$/.test(folio.trim())) return setError('Escribe el folio impreso en tu boleto (solo letras y números).');
    setEnviando(true);
    try {
      await enviar('/boletos/vincular', 'POST', { folio: folio.trim() });
      router.push('/conductor/estancia');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!usuario) return null;
  return (
    <main>
      <h1>Registrar boleto</h1>
      <p>Escribe el folio de un boleto impreso en la pluma de entrada. Si pediste tu boleto desde la página <strong>Estacionamiento</strong>, ya está registrado en tu cuenta.</p>
      <form onSubmit={asociar} className="formulario" noValidate>
        <label>Folio del boleto<input value={folio} onChange={(e) => setFolio(e.target.value)} maxLength={20} inputMode="numeric" /></label>
        <div className="fila">
          <button type="button" className="secundario" onClick={() => router.push('/conductor')}>Cancelar</button>
          <button type="submit" disabled={enviando}>{enviando ? 'Asociando…' : 'Asociar'}</button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
