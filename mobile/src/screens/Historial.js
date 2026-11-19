import React from 'react';
import {ActivityIndicator} from 'react-native';
import { Text, Pantalla, Boton, Tarjeta, Aviso, colores } from '../components/ui';
import { pedirJSON } from '../lib/api';
import useSondeo from '../lib/useSondeo';
import { dinero, formatearFechaHora } from '../lib/formato';

// M10 - CU-3.3
export default function Historial({ navigation }) {
  const { datos, error, cargando, recargar } = useSondeo(() => pedirJSON('/boletos/historial'), 20000);
  return (
    <Pantalla titulo="HISTORIAL DE ESTANCIAS">
      {cargando && <ActivityIndicator color={colores.crema} />}
      {error ? <><Aviso texto={error} /><Boton texto="Reintentar" onPress={recargar} /></> : null}
      {datos && datos.length === 0 && <Text style={{ textAlign: 'center' }}>Aún no tienes estancias finalizadas.</Text>}
      {(datos || []).map((h) => (
        <Tarjeta key={h.folio}>
          <Text style={{ fontWeight: '700' }}>{formatearFechaHora(h.salida)} · {h.estacionamiento}</Text>
          <Text>{Math.floor(h.duracion_horas)} h {Math.round((h.duracion_horas % 1) * 60)} min · {dinero(h.monto_total)}</Text>
          <Text style={{ opacity: 0.85 }}>Folio {h.folio}</Text>
        </Tarjeta>
      ))}
      <Boton texto="Regresar" secundario onPress={() => navigation.goBack()} />
    </Pantalla>
  );
}
