import React, { useState } from 'react';
import { ActivityIndicator, View, TouchableOpacity } from 'react-native';
import { Text, Pantalla, Boton, Chip, Tarjeta, Aviso, colores } from '../components/ui';
import { pedirJSON } from '../lib/api';
import useSondeo from '../lib/useSondeo';

// M5 - CU-2.1: niveles con libres/ocupados y distribución de cajones del nivel elegido
export default function Disponibilidad({ navigation }) {
  const [idEst, setIdEst] = useState(null);
  const [idNivel, setIdNivel] = useState(null);

  const { datos: lista, error: e1, recargar: r1 } = useSondeo(() => pedirJSON('/estacionamientos'), 10000);
  const id = idEst || (lista && lista[0] && lista[0].id_estacionamiento);
  const { datos: est, error: e2, cargando, recargar: r2 } = useSondeo(() => pedirJSON(`/estacionamientos/${id}`), 2000, Boolean(id));
  const { datos: cajones } = useSondeo(() => pedirJSON(`/niveles/${idNivel}/cajones`), 2000, Boolean(idNivel));

  const error = e1 || e2;
  return (
    <Pantalla titulo="VERIFICAR DISPONIBILIDAD">
      {error ? <><Aviso texto={error} /><Boton texto="Reintentar" onPress={() => { r1(); r2(); }} /></> : null}
      {cargando && !error && !est && <ActivityIndicator color={colores.crema} />}

      {lista && lista.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {lista.map((e) => (
            <Chip key={e.id_estacionamiento} texto={e.nombre} activo={e.id_estacionamiento === id} onPress={() => { setIdEst(e.id_estacionamiento); setIdNivel(null); }} />
          ))}
        </View>
      )}

      {est && est.niveles.map((n) => (
        <TouchableOpacity key={n.id_nivel} onPress={() => setIdNivel(n.id_nivel === idNivel ? null : n.id_nivel)}>
          <Tarjeta style={idNivel === n.id_nivel ? { borderColor: colores.crema, borderWidth: 2 } : null}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>{n.nombre}</Text>
            <Text><Text style={{ color: colores.verde }}>Libres: {n.libres}</Text>  ·  <Text style={{ color: colores.rojo }}>Ocupados: {n.ocupados}</Text></Text>
            {n.sin_disponibilidad && <Text style={{ color: colores.rojoOscuro, backgroundColor: colores.rojo, alignSelf: 'flex-start', paddingHorizontal: 8, borderRadius: 6, fontWeight: '700' }}>Nivel sin disponibilidad</Text>}
            {n.sectores.map((s) => <Text key={s.sector} style={{ opacity: 0.85 }}>Sector {s.sector}: {s.libres} libres</Text>)}
          </Tarjeta>
        </TouchableOpacity>
      ))}

      {idNivel && cajones && (
        <Tarjeta>
          <Text style={{ fontWeight: '700' }}>Cajones (verde = disponible, rojo = ocupado)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {cajones.map((c) => (
              <View key={c.id_cajon} style={{ minWidth: 48, padding: 8, borderRadius: 6, alignItems: 'center', backgroundColor: c.estado === 'Disponible' ? colores.verde : colores.rojo }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: c.estado === 'Disponible' ? colores.verdeOscuro : colores.rojoOscuro }}>{c.numero}</Text>
              </View>
            ))}
          </View>
        </Tarjeta>
      )}
      <Boton texto="Regresar" secundario onPress={() => navigation.goBack()} />
    </Pantalla>
  );
}
