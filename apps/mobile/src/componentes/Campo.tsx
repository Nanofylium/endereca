import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { cores } from '../tema';

/** Campo sobre o fundo verde das telas de acesso. */
export function Campo(props: { rotulo: string; dica?: string } & TextInputProps) {
  const { rotulo, dica, style, ...resto } = props;
  return (
    <View style={estilos.grupo}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput accessibilityLabel={rotulo} placeholderTextColor={cores.verdeClaroTexto} style={[estilos.campo, style]} {...resto} />
      {dica ? <Text style={estilos.dica}>{dica}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 8 },
  rotulo: { color: '#DCEBE4', fontSize: 14, fontWeight: '600' },
  campo: {
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: cores.verdeBorda,
    backgroundColor: cores.verdeMedio,
    color: cores.branco,
    fontSize: 20,
    paddingHorizontal: 16,
  },
  dica: { color: '#A3C4B6', fontSize: 12, lineHeight: 17 },
});
