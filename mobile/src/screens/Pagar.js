import React, { useState } from 'react';

import { Text, Pantalla, Campo, Boton, Fila, Aviso, colores } from '../components/ui';
import { pedirJSON, enviar } from '../lib/api';
import useSondeo from '../lib/useSondeo';
import { soloDigitos } from '../lib/validaciones';
import { dinero } from '../lib/formato';

// M8 - CU-4.1 / CU-4.2. RNF-8: se valida todo antes de enviar. Pago simulado; no se guardan datos de tarjeta.
export default function Pagar({ navigation }) {
  const { datos: b, error: errorBoleto } = useSondeo(() => pedirJSON('/boletos/actual'));
  const [tarjeta, setTarjeta] = useState('');
  const [vence, setVence] = useState('');
  const [cvv, setCvv] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const formatearTarjeta = (t) => soloDigitos(t, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  const formatearVence = (t) => { const d = soloDigitos(t, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };

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

  async function pagar() {
    const problema = validar();
    if (problema) return setError(problema);
    setError('');
    setEnviando(true);
    try {
      await enviar('/boletos/pagar', 'POST', { numero_tarjeta: soloDigitos(tarjeta), vencimiento: vence, cvv });
      navigation.replace('Comprobante');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla titulo="PAGAR BOLETO">
      <Aviso texto={errorBoleto} />
      {b && b.pagado && <Text style={{ textAlign: 'center' }}>Este boleto ya está pagado.</Text>}
      {b && !b.pagado && (
        <>
          <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center' }}>Monto a pagar: {dinero(b.monto_total)}</Text>
          <Campo etiqueta="Número de tarjeta" value={tarjeta} onChangeText={(t) => setTarjeta(formatearTarjeta(t))} keyboardType="number-pad" placeholder="0000 0000 0000 0000" />
          <Campo etiqueta="Vencimiento (MM/AA)" value={vence} onChangeText={(t) => setVence(formatearVence(t))} keyboardType="number-pad" placeholder="MM/AA" />
          <Campo etiqueta="CVV" value={cvv} onChangeText={(t) => setCvv(soloDigitos(t, 3))} keyboardType="number-pad" secureTextEntry />
          <Text style={{ color: colores.secundario, fontSize: 12 }}>Pago simulado: no se hace ningún cargo real.</Text>
          <Aviso texto={error} />
          <Fila>
            <Boton texto="Cancelar" secundario onPress={() => navigation.goBack()} />
            <Boton texto={enviando ? 'Procesando…' : 'Pagar'} onPress={pagar} deshabilitado={enviando} />
          </Fila>
        </>
      )}
    </Pantalla>
  );
}
