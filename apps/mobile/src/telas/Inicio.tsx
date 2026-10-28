import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Api, ErroApi } from '../api';
import { Botao } from '../componentes/Botao';
import { Cabecalho } from '../componentes/Cabecalho';
import { MinhasTarefas } from '../componentes/MinhasTarefas';
import { cores } from '../tema';
import { Colaborador, ItemBusca } from '../tipos';

export function Inicio(props: {
  api: Api;
  colaborador: Colaborador;
  aoEscanear: () => void;
  aoGuardar: () => void;
  aoGondola: () => void;
  aoTreino: () => void;
  aoAbrirProduto: (codigo: string) => void;
  aoSair: () => void;
  aoErro: (e: unknown) => void;
}) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<ItemBusca[]>([]);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) {
      setResultados([]);
      setAviso('');
      return;
    }
    let atual = true;
    // Espera a pessoa parar de digitar antes de buscar.
    const espera = setTimeout(async () => {
      try {
        const itens = await props.api.buscar(t);
        if (!atual) return;
        setResultados(itens);
        setAviso(itens.length ? '' : 'Nenhum produto com esse termo nesta loja.');
      } catch (e) {
        if (!atual) return;
        if (e instanceof ErroApi && !e.exigeNovoLogin) setAviso(e.message);
        else props.aoErro(e);
      }
    }, 300);
    return () => {
      atual = false;
      clearTimeout(espera);
    };
  }, [termo]);

  const primeiroNome = props.colaborador.nome.split(' ')[0];

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Cabecalho titulo={`Olá, ${primeiroNome}`} subtitulo={`Matrícula ${props.colaborador.matricula}`} acao={{ titulo: 'Sair', onPress: props.aoSair }} />
      <FlatList
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        data={resultados}
        keyExtractor={(item) => item.sku}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <MinhasTarefas api={props.api} aoErro={props.aoErro} />
            <Botao titulo="Escanear QR Code ou código de barras" onPress={props.aoEscanear} />
            <Botao titulo="Guardar caixa ou palete" variante="escuro" onPress={props.aoGuardar} />
            <Botao titulo="Gôndola sem etiqueta" variante="contorno" onPress={props.aoGondola} />
            <Botao titulo="Treinamento: lições e desafios" variante="contorno" onPress={props.aoTreino} />
            <View style={{ gap: 8 }}>
              <Text style={estilos.rotulo}>Ou busque por nome, marca, SKU ou EAN</Text>
              <TextInput
                accessibilityLabel="Buscar produto"
                value={termo}
                onChangeText={setTermo}
                placeholder="Ex.: arroz, óleo, 100245"
                placeholderTextColor={cores.textoApagado}
                style={estilos.busca}
                autoCorrect={false}
              />
            </View>
            <Text style={estilos.dica}>
              Gôndola vazia e nada para escanear? Bipe a etiqueta do endereço na prateleira ou busque pelo nome, e toque em "Não tem na gôndola" na ficha.
            </Text>
            {aviso ? <Text style={estilos.aviso}>{aviso}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => props.aoAbrirProduto(item.sku)} style={estilos.item}>
            <Text style={estilos.itemNome}>{item.nome}</Text>
            <Text style={estilos.itemInfo}>
              {item.departamento} · SKU {item.sku}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 20, gap: 10 },
  rotulo: { fontSize: 14, fontWeight: '600', color: cores.textoSecundario },
  busca: { height: 56, borderRadius: 14, borderWidth: 2, borderColor: '#C9D2E0', backgroundColor: cores.branco, fontSize: 17, paddingHorizontal: 16, color: cores.texto },
  aviso: { fontSize: 15, color: cores.textoApagado },
  dica: { fontSize: 13, color: cores.textoApagado, lineHeight: 19 },
  item: { backgroundColor: cores.cartao, borderRadius: 14, borderWidth: 1, borderColor: cores.borda, padding: 16, minHeight: 64, gap: 2 },
  itemNome: { fontSize: 16, fontWeight: '600', color: cores.texto },
  itemInfo: { fontSize: 13, color: cores.textoApagado },
});
