import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { cores } from '../tema';

export function Cartao(props: { titulo?: string; children: ReactNode; estilo?: ViewStyle }) {
  return (
    <View style={[estilos.cartao, props.estilo]}>
      {props.titulo ? <Text style={estilos.titulo}>{props.titulo.toUpperCase()}</Text> : null}
      {props.children}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { backgroundColor: cores.cartao, borderRadius: 16, borderWidth: 1, borderColor: cores.borda, padding: 16, gap: 6 },
  titulo: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: cores.textoApagado },
});
