import React, { useState } from 'react';
import { Pantalla, Campo, Boton, Fila, Aviso } from '../components/ui';
import { enviar } from '../lib/api';

// M6 - CU-3.1
export default function RegistrarBoleto({ navigation }) {
  const [folio, setFolio] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function asociar() {
    setError('');
    if (!/^[A-Za-z0-9-]{1,20}$/.test(folio.trim())) return setError('Escribe el folio impreso en tu boleto (solo letras y números).');
    setEnviando(true);
    try {
      await enviar('/boletos/vincular', 'POST', { folio: folio.trim() });
      navigation.replace('Estancia');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla titulo="REGISTRAR BOLETO">
      <Campo etiqueta="Folio del boleto" value={folio} onChangeText={setFolio} keyboardType="number-pad" maxLength={20} />
      <Aviso texto={error} />
      <Fila>
        <Boton texto="Cancelar" secundario onPress={() => navigation.goBack()} />
        <Boton texto={enviando ? 'Asociando…' : 'Asociar'} onPress={asociar} deshabilitado={enviando} />
      </Fila>
    </Pantalla>
  );
}
