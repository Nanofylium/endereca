import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { cores } from '../tema';

type Variante = 'principal' | 'confirmar' | 'contorno' | 'escuro';

export function Botao(props: { titulo: string; onPress: () => void; variante?: Variante; carregando?: boolean; desabilitado?: boolean }) {
  const variante = props.variante ?? 'principal';
  const inativo = props.desabilitado || props.carregando;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inativo }}
      onPress={props.onPress}
      disabled={inativo}
      style={({ pressed }) => [estilos.base, estilos[variante], (pressed || inativo) && estilos.apertado]}
    >
      {props.carregando ? (
        <ActivityIndicator color={variante === 'contorno' ? cores.laranjaTexto : cores.branco} />
      ) : (
        <Text style={[estilos.texto, variante === 'contorno' && estilos.textoContorno]}>{props.titulo}</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  principal: { backgroundColor: cores.laranja },
  confirmar: { backgroundColor: cores.confirmar },
  escuro: { backgroundColor: cores.verde },
  contorno: { backgroundColor: cores.branco, borderWidth: 2, borderColor: '#C2410C' },
  apertado: { opacity: 0.75 },
  texto: { color: cores.branco, fontSize: 17, fontWeight: '700' },
  textoContorno: { color: cores.laranjaTexto },
});
