import { StyleSheet, Text, View } from 'react-native';
import { cores } from '../tema';
import { ResultadoFalta } from '../tipos';

/** Depois de avisar a falta: onde buscar no estoque, ou que o líder já sabe. */
export function AvisoFalta({ falta }: { falta: ResultadoFalta }) {
  const temEstoque = falta.estoque.length > 0;
  return (
    <View style={[estilos.caixa, temEstoque ? estilos.buscar : estilos.semEstoque]}>
      <Text style={[estilos.titulo, { color: temEstoque ? cores.confirmar : cores.laranjaTexto }]}>
        {temEstoque ? 'Busque no estoque' : 'Líder avisado'}
      </Text>
      <Text style={estilos.texto}>{falta.mensagem}</Text>
      {falta.estoque.map((e, i) => (
        <Text key={i} style={estilos.local}>
          {e.nomeTipo} · {e.descricao}
          {e.quantidade !== null ? ` · ${e.quantidade} un.` : ''}
        </Text>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { borderRadius: 14, padding: 14, gap: 4 },
  buscar: { backgroundColor: cores.confirmarFundo },
  semEstoque: { backgroundColor: cores.laranjaFundo },
  titulo: { fontSize: 16, fontWeight: '700' },
  texto: { fontSize: 14, color: cores.texto, lineHeight: 20 },
  local: { fontSize: 15, fontWeight: '700', color: cores.texto },
});
