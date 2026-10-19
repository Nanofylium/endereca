import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cores } from '../tema';

export function Cabecalho(props: { titulo: string; subtitulo?: string; onVoltar?: () => void; acao?: { titulo: string; onPress: () => void } }) {
  return (
    <View style={estilos.barra}>
      {props.onVoltar ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={props.onVoltar} style={estilos.voltar}>
          <Text style={estilos.seta}>‹</Text>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={estilos.titulo}>{props.titulo}</Text>
        {props.subtitulo ? <Text style={estilos.subtitulo}>{props.subtitulo}</Text> : null}
      </View>
      {props.acao ? (
        <Pressable accessibilityRole="button" onPress={props.acao.onPress} style={estilos.acao}>
          <Text style={estilos.acaoTexto}>{props.acao.titulo}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { backgroundColor: cores.verde, paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltar: { width: 44, height: 44, borderRadius: 10, backgroundColor: cores.verdeMedio, alignItems: 'center', justifyContent: 'center' },
  seta: { color: cores.branco, fontSize: 30, lineHeight: 32, fontWeight: '700' },
  titulo: { color: cores.branco, fontSize: 18, fontWeight: '700' },
  subtitulo: { color: cores.verdeClaroTexto, fontSize: 13 },
  acao: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, backgroundColor: cores.verdeMedio, justifyContent: 'center' },
  acaoTexto: { color: cores.branco, fontSize: 14, fontWeight: '600' },
});
