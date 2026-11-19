import React from 'react';
import {Alert} from 'react-native';
import { Text, Pantalla, Boton } from '../components/ui';
import { useAuth } from '../AuthContext';

// M3
export default function Principal({ navigation }) {
  const { sesion, salir } = useAuth();

  function confirmarSalida() {
    Alert.alert('Cerrar sesión', '¿Quieres cerrar tu sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: salir },
    ]);
  }

  return (
    <Pantalla titulo="PRINCIPAL">
      <Text style={{ textAlign: 'center', fontSize: 16 }}>Hola, {sesion.usuario.nombre}</Text>
      <Boton texto="Verificar disponibilidad" onPress={() => navigation.navigate('Disponibilidad')} />
      <Boton texto="Registrar boleto" onPress={() => navigation.navigate('RegistrarBoleto')} />
      <Boton texto="Mi estancia actual" onPress={() => navigation.navigate('Estancia')} />
      <Boton texto="Ver historial" onPress={() => navigation.navigate('Historial')} />
      <Boton texto="Cerrar sesión" secundario onPress={confirmarSalida} />
    </Pantalla>
  );
}
