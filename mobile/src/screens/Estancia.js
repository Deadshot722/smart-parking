import React from 'react';
import {ActivityIndicator} from 'react-native';
import { Text, Pantalla, Boton, Tarjeta, TarjetaAviso, Fila, Aviso, estilos, colores } from '../components/ui';
import { pedirJSON } from '../lib/api';
import useSondeo from '../lib/useSondeo';
import { dinero, duracion, formatearFechaHora } from '../lib/formato';

const SIN_BOLETO = 'No tienes un boleto activo';

// M4 - CU-3.2 / CU-4.1: monto y tiempo se actualizan cada 2 segundos
export default function Estancia({ navigation }) {
  const { datos: b, error, cargando, recargar } = useSondeo(() =>
    pedirJSON('/boletos/actual').catch((e) => (e.message === SIN_BOLETO ? null : Promise.reject(e)))
  );

  return (
    <Pantalla titulo="BOLETO REGISTRADO">
      {cargando && <ActivityIndicator color={colores.crema} />}
      {error ? <><Aviso texto={error} /><Boton texto="Reintentar" onPress={recargar} /></> : null}
      {!cargando && !b && !error && (
        <>
          <Text style={{ textAlign: 'center' }}>No tienes un boleto activo.</Text>
          <Boton texto="Registrar boleto" onPress={() => navigation.replace('RegistrarBoleto')} />
        </>
      )}
      {b && (
        <>
          <Tarjeta>
            <Text style={{ fontSize: 36, fontWeight: '800', color: colores.crema, textAlign: 'center' }}>{b.folio}</Text>
            <Text>{b.estacionamiento}</Text>
            <Text>Entrada: {formatearFechaHora(b.entrada)}</Text>
            <Text>Tiempo: {duracion(b.minutos)}</Text>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>Monto: {dinero(b.pagado ? b.monto_pagado : b.monto_total)}{b.pagado ? ' · Pagado' : ''}</Text>
            <Text>Ubicación: {b.cajon ? `${b.nivel} · Sector ${b.sector} · Cajón ${b.cajon}` : 'Sin cajón guardado'}</Text>
          </Tarjeta>
          {b.pagado && (
            <TarjetaAviso>
              <Text>Tolerancia restante para salir: {b.tolerancia_restante} min{b.monto_extra > 0 ? `. Tiempo excedido: se cobrarán ${dinero(b.monto_extra)} extra en caseta.` : ''}</Text>
            </TarjetaAviso>
          )}
          <Boton texto="Verificar disponibilidad" secundario onPress={() => navigation.navigate('Disponibilidad')} />
          <Boton texto="Ubicar mi vehículo" secundario onPress={() => navigation.navigate('Ubicar')} />
          {b.pagado ? (
            <Boton texto="Ver comprobante" onPress={() => navigation.navigate('Comprobante')} />
          ) : (
            <Boton texto="Pagar boleto" onPress={() => navigation.navigate('Pagar')} />
          )}
        </>
      )}
      <Fila><Boton texto="Regresar" secundario onPress={() => navigation.goBack()} /></Fila>
    </Pantalla>
  );
}
