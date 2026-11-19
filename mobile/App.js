import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthContext } from './src/AuthContext';
import { leerSesion, guardarSesion, borrarSesion } from './src/lib/sesion';
import { ponerToken, alSesionExpirada, enviar } from './src/lib/api';
import { colores } from './src/components/ui';

import Login from './src/screens/Login';
import Registro from './src/screens/Registro';
import Principal from './src/screens/Principal';
import Estancia from './src/screens/Estancia';
import Disponibilidad from './src/screens/Disponibilidad';
import RegistrarBoleto from './src/screens/RegistrarBoleto';
import Ubicar from './src/screens/Ubicar';
import Pagar from './src/screens/Pagar';
import Comprobante from './src/screens/Comprobante';
import Historial from './src/screens/Historial';

const Stack = createNativeStackNavigator();
const opciones = {
  headerStyle: { backgroundColor: colores.acento },
  headerTintColor: colores.crema,
  contentStyle: { backgroundColor: colores.fondo },
};

export default function App() {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState(null);

  useEffect(() => {
    leerSesion().then((s) => {
      if (s && s.token) { ponerToken(s.token); setSesion(s); }
      setCargando(false);
    });
    // Si el servidor dice 401 (sesión vencida), se regresa al inicio de sesión.
    alSesionExpirada(() => { ponerToken(''); borrarSesion(); setSesion(null); });
  }, []);

  const auth = useMemo(() => ({
    sesion,
    entrar: async (datos) => { ponerToken(datos.token); await guardarSesion(datos); setSesion(datos); },
    // CU-1.3: aunque no haya red, se borra la sesión local
    salir: async () => {
      try { await enviar('/auth/logout', 'POST'); } catch {}
      ponerToken('');
      await borrarSesion();
      setSesion(null);
    },
  }), [sesion]);

  if (cargando) {
    return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colores.fondo }}><ActivityIndicator size="large" color={colores.crema} /></View>;
  }

  return (
    <SafeAreaProvider>
      <AuthContext.Provider value={auth}>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator screenOptions={opciones}>
            {sesion ? (
              <>
                <Stack.Screen name="Principal" component={Principal} options={{ title: 'Smart-Parking' }} />
                <Stack.Screen name="Disponibilidad" component={Disponibilidad} options={{ title: 'Disponibilidad' }} />
                <Stack.Screen name="RegistrarBoleto" component={RegistrarBoleto} options={{ title: 'Registrar boleto' }} />
                <Stack.Screen name="Estancia" component={Estancia} options={{ title: 'Boleto registrado' }} />
                <Stack.Screen name="Ubicar" component={Ubicar} options={{ title: 'Ubicar mi vehículo' }} />
                <Stack.Screen name="Pagar" component={Pagar} options={{ title: 'Pagar boleto' }} />
                <Stack.Screen name="Comprobante" component={Comprobante} options={{ title: 'Comprobante' }} />
                <Stack.Screen name="Historial" component={Historial} options={{ title: 'Historial de estancias' }} />
              </>
            ) : (
              <>
                <Stack.Screen name="Login" component={Login} options={{ title: 'Inicio de sesión' }} />
                <Stack.Screen name="Registro" component={Registro} options={{ title: 'Registro' }} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
}
