import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Pantalla, Campo, Boton, Fila, Aviso } from '../components/ui';
import { enviar } from '../lib/api';
import { soloLetras, validarNombre, validarCorreo, validarContrasena } from '../lib/validaciones';

// M2 - CU-1.1. El nombre solo acepta letras y espacios.
export default function Registro({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function registrar() {
    setError('');
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    if (!limpio || !correo.trim() || !contrasena) return setError('Completa todos los campos.');
    if (!validarNombre(limpio)) return setError('El nombre solo puede contener letras y espacios.');
    if (!validarCorreo(correo)) return setError('El correo no tiene un formato válido.');
    if (!validarContrasena(contrasena)) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (contrasena !== confirmar) return setError('Las contraseñas no coinciden.');
    setEnviando(true);
    try {
      const r = await enviar('/auth/registro', 'POST', { nombre: limpio, correo: correo.trim(), contrasena });
      Alert.alert('Listo', r.mensaje);
      navigation.navigate('Login');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla titulo="REGISTRO">
      <Campo etiqueta="Nombre (solo letras)" value={nombre} onChangeText={(t) => setNombre(soloLetras(t))} autoCapitalize="words" maxLength={100} />
      <Campo etiqueta="Correo" value={correo} onChangeText={setCorreo} keyboardType="email-address" />
      <Campo etiqueta="Contraseña (mínimo 8 caracteres)" value={contrasena} onChangeText={setContrasena} secureTextEntry />
      <Campo etiqueta="Confirmar contraseña" value={confirmar} onChangeText={setConfirmar} secureTextEntry />
      <Aviso texto={error} />
      <Fila>
        <Boton texto="Cancelar" secundario onPress={() => navigation.goBack()} />
        <Boton texto={enviando ? 'Registrando…' : 'Registrar'} onPress={registrar} deshabilitado={enviando} />
      </Fila>
    </Pantalla>
  );
}
