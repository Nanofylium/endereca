import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Api, ErroApi } from '../api';
import { Botao } from '../componentes/Botao';
import { Cabecalho } from '../componentes/Cabecalho';
import { cores } from '../tema';
import { LeituraEtiqueta } from '../tipos';

type LeituraEndereco = Extract<LeituraEtiqueta, { tipo: 'endereco' }>;

/** O que está guardado no endereço da etiqueta lida. */
export function Local(props: { api: Api; codigo: string; aoAbrirProduto: (sku: string) => void; aoVoltar: () => void; aoErro: (e: unknown) => void }) {
  const [leitura, setLeitura] = useState<LeituraEndereco | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let atual = true;
    props.api
      .lerEtiqueta(props.codigo)
      .then((r) => atual && r.tipo === 'endereco' && setLeitura(r))
      .catch((e) => {
        if (!atual) return;
        if (e instanceof ErroApi && !e.exigeNovoLogin) setErro(e.message);
        else props.aoErro(e);
      });
    return () => {
      atual = false;
    };
  }, [props.codigo]);

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Cabecalho titulo={leitura?.endereco.descricao ?? 'Endereço'} subtitulo={leitura?.endereco.nomeTipo} onVoltar={props.aoVoltar} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
        {erro ? (
          <>
            <Text style={estilos.aviso}>{erro}</Text>
            <Botao titulo="Escanear outro" variante="escuro" onPress={props.aoVoltar} />
          </>
        ) : !leitura ? (
          <ActivityIndicator style={{ marginTop: 48 }} size="large" color={cores.verde} />
        ) : leitura.produtos.length === 0 ? (
          <Text style={estilos.aviso}>Nada registrado neste endereço ainda. Para guardar algo aqui, bipe a caixa e depois esta etiqueta.</Text>
        ) : (
          leitura.produtos.map((p) => (
            <Pressable key={p.sku} accessibilityRole="button" onPress={() => props.aoAbrirProduto(p.sku)} style={estilos.item}>
              <Text style={estilos.nome}>{p.nome}</Text>
              <Text style={estilos.info}>
                SKU {p.sku}
                {p.quantidade !== null ? ` · ${p.quantidade} un.` : ''}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: { fontSize: 15, color: cores.textoApagado, lineHeight: 22 },
  item: { backgroundColor: cores.cartao, borderRadius: 14, borderWidth: 1, borderColor: cores.borda, padding: 16, minHeight: 64, gap: 2 },
  nome: { fontSize: 16, fontWeight: '600', color: cores.texto },
  info: { fontSize: 13, color: cores.textoApagado },
});
