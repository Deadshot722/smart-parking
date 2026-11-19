import React, { useState } from 'react';
import { Pantalla, Campo, Boton, Fila, Aviso } from '../components/ui';
import { enviar, ponerToken } from '../lib/api';
import { useAuth } from '../AuthContext';

// M1 - CU-1.2
export default function Login({ navigation }) {
  const { entrar } = useAuth();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function iniciar() {
    setError('');
    if (!correo.trim() || !contrasena) return setError('Ingresa tu correo y contraseña.');
    setEnviando(true);
    try {
      const datos = await enviar('/auth/login', 'POST', { correo: correo.trim(), contrasena });
      if (datos.usuario.rol !== 'Conductor') {
        // La app móvil es para conductores; el operador usa la aplicación web.
        ponerToken(datos.token);
        try { await enviar('/auth/logout', 'POST'); } catch {}
        ponerToken('');
        return setError('Los operadores deben usar la aplicación web.');
      }
      await entrar(datos);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla titulo="INICIO DE SESIÓN">
      <Campo etiqueta="Correo" value={correo} onChangeText={setCorreo} keyboardType="email-address" autoComplete="email" />
      <Campo etiqueta="Contraseña" value={contrasena} onChangeText={setContrasena} secureTextEntry />
      <Aviso texto={error} />
      <Fila>
        <Boton texto="Registrarse" secundario onPress={() => navigation.navigate('Registro')} />
        <Boton texto={enviando ? 'Entrando…' : 'Iniciar sesión'} onPress={iniciar} deshabilitado={enviando} />
      </Fila>
    </Pantalla>
  );
}
