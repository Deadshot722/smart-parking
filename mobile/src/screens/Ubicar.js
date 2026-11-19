import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { Text, Pantalla, Boton, Chip, Fila, Tarjeta, Aviso, Exito, colores } from '../components/ui';
import { pedirJSON, enviar } from '../lib/api';
import useSondeo from '../lib/useSondeo';

// M7 - CU-2.2 / CU-2.3: elegir nivel y cajón disponible; guardar o liberar
export default function Ubicar({ navigation }) {
  const { datos: b, error: errorBoleto, recargar } = useSondeo(() => pedirJSON('/boletos/actual'), 3000);
  const idEst = b && b.id_estacionamiento;
  const { datos: est } = useSondeo(() => pedirJSON(`/estacionamientos/${idEst}`), 5000, Boolean(idEst));
  const [idNivel, setIdNivel] = useState(null);
  const [cajon, setCajon] = useState(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  useEffect(() => {
    if (est && !idNivel && est.niveles[0]) setIdNivel(est.niveles[0].id_nivel);
  }, [est, idNivel]);

  const { datos: cajones } = useSondeo(() => pedirJSON(`/niveles/${idNivel}/cajones`), 2000, Boolean(idNivel));

  async function enviarUbicacion() {
    try {
      await enviar('/boletos/ubicacion', 'PUT', { id_nivel: idNivel, id_cajon: cajon.id_cajon });
      setExito(`Ubicación guardada: cajón ${cajon.numero}.`);
      setCajon(null);
      recargar();
    } catch (err) {
      setError(err.message); // "El cajón acaba de ser ocupado, seleccione otro"
    }
  }

  function guardar() {
    setError(''); setExito('');
    if (!cajon) return setError('Elige un cajón disponible.');
    if (b.cajon) {
      // Flujo alterno 2: ya tenía un cajón guardado
      Alert.alert('Cambiar cajón', `Ya tienes guardado el cajón ${b.cajon}. ¿Quieres cambiarlo?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cambiar', onPress: enviarUbicacion },
      ]);
    } else enviarUbicacion();
  }

  async function liberar() {
    setError(''); setExito('');
    try {
      await enviar('/boletos/ubicacion', 'DELETE');
      setExito('Cajón liberado.');
      recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Pantalla titulo="UBICAR MI VEHÍCULO">
      <Aviso texto={errorBoleto ? `${errorBoleto} (primero registra tu boleto)` : ''} />
      {b && (
        <>
          <Text>Cajón guardado: {b.cajon ? `${b.nivel} · Cajón ${b.cajon}` : 'ninguno'}</Text>
          <Text style={{ fontWeight: '700' }}>Nivel</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {est && est.niveles.map((n) => (
              <Chip key={n.id_nivel} texto={`${n.nombre} (${n.libres})`} activo={n.id_nivel === idNivel} onPress={() => { setIdNivel(n.id_nivel); setCajon(null); }} />
            ))}
          </View>
          <Tarjeta>
            <Text style={{ fontWeight: '700' }}>Toca un cajón disponible</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {(cajones || []).map((c) => {
                const libre = c.estado === 'Disponible';
                const elegido = cajon && cajon.id_cajon === c.id_cajon;
                return (
                  <TouchableOpacity key={c.id_cajon} disabled={!libre} onPress={() => setCajon(c)}
                    style={{ minWidth: 52, padding: 8, borderRadius: 6, alignItems: 'center', backgroundColor: libre ? colores.verde : colores.rojo, borderWidth: elegido ? 3 : 0, borderColor: colores.crema }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: libre ? colores.verdeOscuro : colores.rojoOscuro }}>{c.numero}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Tarjeta>
          <Aviso texto={error} />
          <Exito texto={exito} />
          <Fila>
            <Boton texto="Liberar cajón" secundario onPress={liberar} deshabilitado={!b.cajon} />
            <Boton texto="Guardar" onPress={guardar} deshabilitado={!cajon} />
          </Fila>
        </>
      )}
      <Boton texto="Regresar" secundario onPress={() => navigation.goBack()} />
    </Pantalla>
  );
}
