import { useState } from 'react';
import { useRouter } from 'next/router';
import { pedirJSON, enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';
import { soloDigitos } from '../../lib/validaciones';
import { dinero } from '../../lib/formato';

// CU-4.2: pago simulado. RNF-8: se valida todo antes de enviar.
export default function Pago() {
  const usuario = useSesion('Conductor');
  const router = useRouter();
  const { datos: b, error: errorBoleto } = useSondeo(() => pedirJSON('/boletos/actual'), 2000, Boolean(usuario));
  const [tarjeta, setTarjeta] = useState('');
  const [vence, setVence] = useState('');
  const [cvv, setCvv] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function formatearTarjeta(t) {
    return soloDigitos(t, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  }
  function formatearVence(t) {
    const d = soloDigitos(t, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }

  function validar() {
    if (soloDigitos(tarjeta).length !== 16) return 'El número de tarjeta debe tener 16 dígitos.';
    const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(vence);
    if (!m) return 'El vencimiento debe tener el formato MM/AA.';
    const hoy = new Date();
    const anio = 2000 + Number(m[2]);
    if (anio < hoy.getFullYear() || (anio === hoy.getFullYear() && Number(m[1]) < hoy.getMonth() + 1)) return 'La tarjeta está vencida.';
    if (!/^\d{3}$/.test(cvv)) return 'El CVV debe tener 3 dígitos.';
    return '';
  }

  async function pagar(e) {
    e.preventDefault();
    const problema = validar();
    if (problema) return setError(problema);
    setError('');
    setEnviando(true);
    try {
      await enviar('/boletos/pagar', 'POST', { numero_tarjeta: soloDigitos(tarjeta), vencimiento: vence, cvv });
      router.push('/conductor/comprobante');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!usuario) return null;
  return (
    <main>
      <h1>Pagar boleto</h1>
      {errorBoleto && <p className="error">{errorBoleto}</p>}
      {b && b.pagado && <p className="aviso">Este boleto ya está pagado.</p>}
      {b && !b.pagado && (
        <>
          <p className="boleto">Monto a pagar: <strong>{dinero(b.monto_total)}</strong></p>
          <p className="pie">Pago simulado: no se hace ningún cargo real y los datos de la tarjeta no se guardan.</p>
          <form onSubmit={pagar} className="formulario" noValidate>
            <label>Número de tarjeta<input inputMode="numeric" value={tarjeta} onChange={(e) => setTarjeta(formatearTarjeta(e.target.value))} placeholder="0000 0000 0000 0000" autoComplete="cc-number" /></label>
            <label>Vencimiento (MM/AA)<input inputMode="numeric" value={vence} onChange={(e) => setVence(formatearVence(e.target.value))} placeholder="MM/AA" autoComplete="cc-exp" /></label>
            <label>CVV<input type="password" inputMode="numeric" value={cvv} onChange={(e) => setCvv(soloDigitos(e.target.value, 3))} autoComplete="cc-csc" /></label>
            <div className="fila">
              <button type="button" className="secundario" onClick={() => router.push('/conductor/estancia')}>Cancelar</button>
              <button type="submit" disabled={enviando}>{enviando ? 'Procesando…' : 'Pagar'}</button>
            </div>
          </form>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </main>
  );
}
