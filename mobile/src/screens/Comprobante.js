import React from 'react';
import {ActivityIndicator} from 'react-native';
import { Text, Pantalla, Boton, Tarjeta, TarjetaAviso, Aviso, colores } from '../components/ui';
import { pedirJSON } from '../lib/api';
import useSondeo from '../lib/useSondeo';
import { dinero, formatearFechaHora } from '../lib/formato';

// M9 - CU-4.3
export default function Comprobante({ navigation }) {
  const { datos: c, error, cargando } = useSondeo(() => pedirJSON('/boletos/comprobante'), 5000);
  return (
    <Pantalla titulo="COMPROBANTE">
      {cargando && <ActivityIndicator color={colores.crema} />}
      <Aviso texto={error} />
      {c && (
        <>
          <Tarjeta>
            <Text>Folio: {c.folio} (boleto {c.folio_boleto})</Text>
            <Text>Fecha: {formatearFechaHora(c.fecha_emision)}</Text>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>Monto: {dinero(c.monto_pagado)}</Text>
            <Text>Método: {c.metodo_pago}</Text>
            <Text>Resultado: <Text style={{ color: colores.verde, fontWeight: '700' }}>{c.resultado}</Text></Text>
          </Tarjeta>
          {c.estado_boleto !== 'Finalizado' && (
            <TarjetaAviso>
              <Text>Tiempo de tolerancia restante: {c.tolerancia_restante} min. Si lo excedes se cobrará el tiempo extra en caseta.</Text>
            </TarjetaAviso>
          )}
        </>
      )}
      <Boton texto="Aceptar" onPress={() => navigation.navigate('Principal')} />
    </Pantalla>
  );
}
