import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Api, ErroApi } from '../api';
import { Botao } from '../componentes/Botao';
import { Cabecalho } from '../componentes/Cabecalho';
import { AvisoFalta } from '../componentes/AvisoFalta';
import { Cartao } from '../componentes/Cartao';
import { ALERTA_GRAVE, dataCurta, diaDaSemana, formatarEndereco, NOME_TIPO, notaComVirgula, textoDiasSemVenda } from '../formatar';
import { cores } from '../tema';
import { ResultadoFalta, Ficha as TipoFicha } from '../tipos';

const ALTURA_BARRAS = 56;

export function Ficha(props: { api: Api; codigo: string; aoVoltar: () => void; aoErro: (e: unknown) => void }) {
  const [ficha, setFicha] = useState<TipoFicha | null>(null);
  const [erro, setErro] = useState('');
  const [falta, setFalta] = useState<ResultadoFalta | null>(null);
  const [avisando, setAvisando] = useState(false);

  async function avisarFalta(sku: string) {
    setAvisando(true);
    try {
      setFalta(await props.api.registrarFalta(sku));
    } catch (e) {
      props.aoErro(e);
    } finally {
      setAvisando(false);
    }
  }

  useEffect(() => {
    let atual = true;
    props.api
      .ficha(props.codigo)
      .then((f) => atual && setFicha(f))
      .catch((e) => {
        if (!atual) return;
        if (e instanceof ErroApi && !e.exigeNovoLogin) setErro(e.message);
        else props.aoErro(e);
      });
    return () => {
      atual = false;
    };
  }, [props.codigo]);

  if (erro) {
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <Cabecalho titulo="Ficha do produto" onVoltar={props.aoVoltar} />
        <View style={{ padding: 20, gap: 16 }}>
          <Text style={estilos.erro}>{erro}</Text>
          <Botao titulo="Escanear outro" variante="escuro" onPress={props.aoVoltar} />
        </View>
      </View>
    );
  }

  if (!ficha) {
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <Cabecalho titulo="Ficha do produto" onVoltar={props.aoVoltar} />
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={cores.verde} />
      </View>
    );
  }

  const venda = ficha.areaDeVenda[0];
  const parado = ficha.diasSemVenda !== null && ficha.previsao.alerta === 'parado';
  const maiorVenda = Math.max(1, ...ficha.vendas7Dias.map((v) => v.unidades));
  const grave = ALERTA_GRAVE[ficha.previsao.alerta];

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Cabecalho titulo="Ficha do produto" subtitulo={ficha.produto.departamento} onVoltar={props.aoVoltar} />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Cartao>
          <Text style={estilos.nome}>{ficha.produto.nome}</Text>
          <Text style={estilos.apagado}>
            SKU {ficha.produto.sku}
            {ficha.produto.ean ? ` · EAN ${ficha.produto.ean}` : ''}
          </Text>
        </Cartao>

        <Cartao titulo="Na área de venda" estilo={{ borderWidth: 2, borderColor: cores.verde }}>
          {venda ? (
            <>
              <Text style={estilos.destaque}>{venda.rua}</Text>
              <Text style={estilos.texto}>{formatarEndereco({ ...venda, rua: '' }) || 'Sem módulo informado'}</Text>
              {ficha.quantidadeGondola !== null ? <Text style={estilos.apagado}>Na gôndola: {ficha.quantidadeGondola} un.</Text> : null}
            </>
          ) : (
            <Text style={estilos.texto}>Sem endereço na área de venda.</Text>
          )}
        </Cartao>

        {falta ? (
          <AvisoFalta falta={falta} />
        ) : (
          <Botao titulo="Não tem na gôndola" variante="contorno" carregando={avisando} onPress={() => avisarFalta(ficha.produto.sku)} />
        )}

        <View style={estilos.linha}>
          <Cartao titulo="Dias sem venda" estilo={{ flex: 1, ...(parado ? { backgroundColor: cores.laranjaFundo, borderColor: '#F3C7A8' } : {}) }}>
            <Text style={[estilos.numero, parado && { color: cores.laranjaTexto }]}>{ficha.diasSemVenda ?? '—'}</Text>
            <Text style={estilos.pequeno}>{textoDiasSemVenda(ficha.diasSemVenda)}</Text>
          </Cartao>
          <Cartao titulo="Apreciação" estilo={{ flex: 1 }}>
            <Text style={estilos.numero}>{ficha.apreciacao ? notaComVirgula(ficha.apreciacao.nota) : '—'}</Text>
            <Text style={estilos.pequeno}>{ficha.apreciacao ? 'de 5, pelo giro e recompra' : 'Ainda sem nota'}</Text>
          </Cartao>
        </View>

        <Cartao titulo={`Vendas dos últimos 7 dias · ${ficha.totalVendas7Dias} un.`}>
          <View style={estilos.barras}>
            {ficha.vendas7Dias.map((v) => (
              <View key={v.dia} style={estilos.coluna}>
                <View
                  style={{
                    width: '100%',
                    height: Math.max(2, Math.round((v.unidades / maiorVenda) * ALTURA_BARRAS)),
                    backgroundColor: v.unidades ? cores.verdeBarra : '#F3C7A8',
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                  }}
                />
                <Text style={estilos.dia}>{diaDaSemana(v.dia)}</Text>
              </View>
            ))}
          </View>
          <View style={[estilos.previsao, grave ? { backgroundColor: cores.laranjaFundo } : { backgroundColor: cores.confirmarFundo }]}>
            <Text style={{ color: grave ? cores.laranjaTexto : '#1B5E2A', fontWeight: '600', fontSize: 14, lineHeight: 20 }}>{ficha.previsao.mensagem}</Text>
          </View>
        </Cartao>

        <Cartao titulo="No estoque">
          {ficha.estoque.length === 0 ? <Text style={estilos.textoClaro}>Sem endereço de estoque.</Text> : null}
          {ficha.estoque.map((e, i) => (
            <View key={i} style={{ paddingVertical: 6, gap: 2 }}>
              <Text style={estilos.textoClaroForte}>
                {NOME_TIPO[e.tipo]} · {formatarEndereco(e)}
              </Text>
              {e.quantidade !== null ? <Text style={estilos.textoClaro}>Qtd. estimada: {e.quantidade}</Text> : null}
            </View>
          ))}
        </Cartao>

        {ficha.lote ? (
          <Cartao titulo="Lote e fornecedor">
            <Linha rotulo="Lote" valor={ficha.lote.lote} />
            <Linha rotulo="Validade mais próxima" valor={dataCurta(ficha.lote.validade)} />
            <Linha rotulo="Fornecedor" valor={ficha.lote.fornecedor ?? '—'} />
            <Linha rotulo="Próxima entrega" valor={ficha.lote.proximaEntrega ? new Date(ficha.lote.proximaEntrega).toLocaleString('pt-BR') : 'Sem pedido aberto'} />
          </Cartao>
        ) : null}

        <Botao titulo="Escanear outro produto" variante="escuro" onPress={props.aoVoltar} />
      </ScrollView>
    </View>
  );
}

function Linha(props: { rotulo: string; valor: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <Text style={estilos.apagado}>{props.rotulo}</Text>
      <Text style={{ fontWeight: '700', color: cores.texto, flexShrink: 1, textAlign: 'right' }}>{props.valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 12, paddingBottom: 32 },
  nome: { fontSize: 19, fontWeight: '700', color: cores.texto },
  apagado: { fontSize: 13, color: cores.textoApagado },
  destaque: { fontSize: 28, fontWeight: '800', color: cores.verde },
  texto: { fontSize: 15, color: cores.textoSecundario },
  linha: { flexDirection: 'row', gap: 12 },
  numero: { fontSize: 28, fontWeight: '800', color: cores.verde },
  pequeno: { fontSize: 12, color: cores.textoSecundario },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: ALTURA_BARRAS + 18 },
  coluna: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  dia: { fontSize: 10, color: cores.textoApagado },
  previsao: { borderRadius: 10, padding: 10, marginTop: 6 },
  textoClaro: { color: cores.textoApagado, fontSize: 13 },
  textoClaroForte: { color: cores.texto, fontSize: 15, fontWeight: '600' },
  erro: { fontSize: 16, color: cores.laranjaTexto, fontWeight: '600', lineHeight: 22 },
});
