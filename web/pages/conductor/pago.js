import { useState } from 'react';
import { useRouter } from 'next/router';
import { pedirJSON, enviar } from '../../lib/api';
import useSesion from '../../hooks/useSesion';
import useSondeo from '../../hooks/useSondeo';
import {
  soloDigitos, soloLetras, marcaTarjeta, largoCVV, formatearTarjeta,
  errorTitular, errorTarjeta, errorVencimiento, errorCVV,
} from '../../lib/validaciones';
import { dinero } from '../../lib/formato';

// CU-4.2: pago simulado. RNF-8: se valida todo antes de enviar (y el servidor lo vuelve a validar).
// American Express: 15 dígitos y CVV de 4. Visa, Mastercard y las demás: 16 dígitos y CVV de 3.
export default function Pago() {
  const usuario = useSesion('Conductor');
  const router = useRouter();
  const { datos: b, error: errorBoleto } = useSondeo(() => pedirJSON('/boletos/actual'), 2000, Boolean(usuario));
  const [titular, setTitular] = useState('');
  const [tarjeta, setTarjeta] = useState('');
  const [vence, setVence] = useState('');
  const [cvv, setCvv] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const marca = soloDigitos(tarjeta).length >= 2 ? marcaTarjeta(tarjeta) : '';
  const digitosCVV = largoCVV(tarjeta);

  function formatearVence(t) {
    const d = soloDigitos(t, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }

  function cambiarTarjeta(texto) {
    const nueva = formatearTarjeta(texto);
    setTarjeta(nueva);
    setCvv((actual) => actual.slice(0, largoCVV(nueva))); // si cambia de Amex a Visa, el CVV se recorta a 3
  }

  async function pagar(e) {
    e.preventDefault();
    const problema = errorTitular(titular) || errorTarjeta(tarjeta) || errorVencimiento(vence) || errorCVV(cvv, tarjeta);
    if (problema) return setError(problema);
    setError('');
    setEnviando(true);
    try {
      await enviar('/boletos/pagar', 'POST', {
        titular: titular.trim().replace(/\s+/g, ' '),
        numero_tarjeta: soloDigitos(tarjeta),
        vencimiento: vence,
        cvv,
      });
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
      {b && b.pagado && !b.tolerancia_vencida && <p className="aviso">Este boleto ya está pagado.</p>}
      {b && b.tolerancia_vencida && (
        <p className="aviso">Tu tolerancia para salir terminó: el tiempo extra (<strong>{dinero(b.monto_extra)}</strong>) se paga en la caseta.</p>
      )}
      {b && !b.pagado && (
        <>
          <p className="boleto">Monto a pagar: <strong>{dinero(b.monto_total)}</strong></p>
          <p className="pie">Pago simulado: no se hace ningún cargo real y los datos de la tarjeta no se guardan (solo la marca y los últimos 4 dígitos).</p>
          <form onSubmit={pagar} className="formulario" noValidate>
            <label>
              Nombre del titular
              <input value={titular} maxLength={40} autoComplete="cc-name" placeholder="Como aparece en la tarjeta" onChange={(e) => setTitular(soloLetras(e.target.value))} />
            </label>
            <label>
              <span>Número de tarjeta {marca && <span className="marca-tarjeta">{marca}</span>}</span>
              <input inputMode="numeric" value={tarjeta} onChange={(e) => cambiarTarjeta(e.target.value)} placeholder="0000 0000 0000 0000" autoComplete="cc-number" />
              <small className="ayuda">Visa y Mastercard: 16 dígitos. American Express: 15 dígitos.</small>
            </label>
            <div className="fila">
              <label>Vencimiento (MM/AA)<input inputMode="numeric" value={vence} onChange={(e) => setVence(formatearVence(e.target.value))} placeholder="MM/AA" autoComplete="cc-exp" /></label>
              <label>
                CVV ({digitosCVV} dígitos)
                <input type="password" inputMode="numeric" value={cvv} maxLength={digitosCVV} onChange={(e) => setCvv(soloDigitos(e.target.value, digitosCVV))} autoComplete="cc-csc" />
              </label>
            </div>
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
