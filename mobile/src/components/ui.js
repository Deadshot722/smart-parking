import React from 'react';
import { View, Text as TextoRN, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

// Paleta tomada del style.css del equipo (vino, café y crema).
export const colores = {
  fondo: '#280b0f', // --bg-color
  tarjeta: '#7B694E', // --card-bg
  acento: '#3b1319', // --accent
  crema: '#F0ECDD', // texto principal (en el css original el botón usa este color)
  secundario: '#C6B39a', // --text-secondary
  borde: 'rgba(240, 236, 221, 0.35)',
  verde: '#b7e4c7',
  verdeOscuro: '#14532d',
  rojo: '#ffb4a8',
  rojoOscuro: '#7f1d1d',
};
export const RADIO = 12; // --radius

// Todo el texto de la app usa este componente: así nunca queda negro sobre el fondo vino.
export function Text({ style, ...props }) {
  return <TextoRN style={[{ color: colores.crema }, style]} {...props} />;
}

// RNF-7: diseño flexible (flex + ScrollView) para que nada se superponga de 720p a 1080p
export function Pantalla({ titulo, children }) {
  return (
    <ScrollView style={estilos.fondo} contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      {titulo ? <Text style={estilos.titulo}>{titulo}</Text> : null}
      {children}
      <Text style={estilos.pie}>Smart-Parking · Laboratorio de Desarrollo de Software III</Text>
    </ScrollView>
  );
}

export function Campo({ etiqueta, ...props }) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput style={estilos.input} placeholderTextColor="#7a6a5a" autoCapitalize="none" {...props} />
    </View>
  );
}

export function Boton({ texto, onPress, secundario, peligro, deshabilitado }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={deshabilitado}
      activeOpacity={0.75}
      style={[estilos.boton, secundario && estilos.botonSec, peligro && estilos.botonPeligro, deshabilitado && { opacity: 0.5 }]}
    >
      <Text style={estilos.botonTxt}>{texto}</Text>
    </TouchableOpacity>
  );
}

// Chip para elegir estacionamiento / nivel
export function Chip({ texto, activo, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[estilos.chip, activo && { backgroundColor: colores.crema }]}>
      <Text style={{ color: activo ? colores.acento : colores.crema, fontWeight: '600' }}>{texto}</Text>
    </TouchableOpacity>
  );
}

export const Fila = ({ children }) => <View style={estilos.fila}>{children}</View>;
export const Tarjeta = ({ children, style }) => <View style={[estilos.tarjeta, style]}>{children}</View>;
// Tarjeta oscura para avisos (tolerancia, etc.)
export const TarjetaAviso = ({ children }) => <View style={[estilos.tarjeta, { backgroundColor: colores.acento, borderColor: colores.borde }]}>{children}</View>;
export const Aviso = ({ texto }) => (texto ? <Text style={estilos.error}>{texto}</Text> : null);
export const Exito = ({ texto }) => (texto ? <Text style={estilos.exito}>{texto}</Text> : null);

export const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 20, gap: 12 },
  titulo: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center', marginBottom: 8 },
  pie: { textAlign: 'center', color: colores.secundario, fontSize: 12, marginTop: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  campo: { gap: 4 },
  etiqueta: { fontSize: 14, color: colores.secundario },
  input: { borderWidth: 1, borderColor: colores.borde, borderRadius: RADIO - 4, padding: 12, fontSize: 16, backgroundColor: colores.crema, color: colores.acento },
  boton: { flex: 1, backgroundColor: colores.acento, borderWidth: 1, borderColor: colores.borde, borderRadius: RADIO - 4, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  botonSec: { backgroundColor: 'transparent', borderColor: colores.secundario },
  botonPeligro: { backgroundColor: colores.rojoOscuro, borderColor: '#fca5a5' },
  botonTxt: { fontSize: 16, fontWeight: '700' },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colores.secundario },
  fila: { flexDirection: 'row', gap: 10 },
  tarjeta: { backgroundColor: colores.tarjeta, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: RADIO, padding: 16, gap: 4, elevation: 3 },
  error: { color: colores.rojo, fontWeight: '600' },
  exito: { color: colores.verde, fontWeight: '600' },
});
