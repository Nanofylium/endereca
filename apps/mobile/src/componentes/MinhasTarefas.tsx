import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Api, ErroApi } from '../api';
import { cores } from '../tema';
import { ResultadoFalta, Tarefa } from '../tipos';
import { AvisoFalta } from './AvisoFalta';
import { Botao } from './Botao';

/** Tarefas da pessoa (Boa do Dia e reposições que ela pegou) e as reposições abertas do setor. */
export function MinhasTarefas(props: { api: Api; aoErro: (e: unknown) => void }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [abertas, setAbertas] = useState<Tarefa[]>([]);
  const [faltas, setFaltas] = useState<Record<string, ResultadoFalta>>({});
  const [enviando, setEnviando] = useState<string | null>(null);

  const carregar = useCallback(() => {
    props.api.minhasTarefas().then(setTarefas).catch(props.aoErro);
    props.api
      .reposicoes()
      .then((r) => setAbertas(r.filter((t) => t.situacao === 'aberta')))
      .catch(props.aoErro);
  }, [props.api]);

  async function pegar(t: Tarefa) {
    setEnviando(t.id);
    try {
      await props.api.pegarReposicao(t.id);
    } catch (e) {
      if (!(e instanceof ErroApi && e.motivo === 'reposicao_ja_pega')) props.aoErro(e);
    } finally {
      setEnviando(null);
      carregar();
    }
  }

  useEffect(carregar, [carregar]);

  async function concluir(t: Tarefa, resultado: 'feito' | 'sem_produto') {
    setEnviando(t.id);
    try {
      const r = await props.api.concluirTarefa(t.id, resultado);
      if (r.falta) setFaltas((f) => ({ ...f, [t.id]: r.falta! }));
      setTarefas((lista) => lista.map((x) => (x.id === t.id ? r.tarefa : x)));
    } catch (e) {
      props.aoErro(e);
    } finally {
      setEnviando(null);
    }
  }

  if (!tarefas.length && !abertas.length) return null;
  return (
    <View style={{ gap: 10 }}>
      {abertas.length ? (
        <>
          <Text style={estilos.rotulo}>Reposições abertas no seu setor</Text>
          {abertas.map((t) => (
            <View key={t.id} style={[estilos.cartao, { borderColor: cores.confirmar }]}>
              <Text style={[estilos.selo, { backgroundColor: cores.confirmar }]}>REPOR AGORA</Text>
              <Text style={estilos.produto}>{t.produto}</Text>
              {t.instrucoes ? <Text style={estilos.texto}>{t.instrucoes}</Text> : null}
              <Botao titulo="Eu faço" variante="confirmar" carregando={enviando === t.id} onPress={() => pegar(t)} />
            </View>
          ))}
        </>
      ) : null}
      {tarefas.length ? <Text style={estilos.rotulo}>Suas tarefas de hoje</Text> : null}
      {tarefas.map((t) => (
        <View key={t.id} style={[estilos.cartao, t.situacao !== 'atribuida' && { opacity: 0.85 }]}>
          <Text style={estilos.selo}>{t.tipo === 'reposicao' ? `REPOR ${t.quantidade ?? ''} UN.`.trim() : 'BOA DO DIA'}</Text>
          <Text style={estilos.produto}>{t.produto}</Text>
          {t.enderecoVenda ? <Text style={estilos.texto}>Gôndola: {t.enderecoVenda.descricao}</Text> : null}
          {t.estoque[0] ? (
            <Text style={estilos.texto}>
              Buscar em: {t.estoque[0].nomeTipo} · {t.estoque[0].descricao}
              {t.estoque[0].quantidade !== null ? ` (${t.estoque[0].quantidade} un.)` : ''}
            </Text>
          ) : (
            <Text style={estilos.texto}>Sem estoque registrado na loja.</Text>
          )}
          {t.instrucoes ? <Text style={estilos.instrucoes}>{t.instrucoes}</Text> : null}
          {t.situacao === 'atribuida' ? (
            <View style={estilos.botoes}>
              <View style={{ flex: 1 }}>
                <Botao titulo="Feito" variante="confirmar" carregando={enviando === t.id} onPress={() => concluir(t, 'feito')} />
              </View>
              <View style={{ flex: 1 }}>
                <Botao titulo="Sem produto" variante="contorno" desabilitado={enviando === t.id} onPress={() => concluir(t, 'sem_produto')} />
              </View>
            </View>
          ) : (
            <Text style={estilos.feito}>{t.situacao === 'concluida' ? 'Concluída' : 'Avisado: sem produto'}</Text>
          )}
          {faltas[t.id] ? <AvisoFalta falta={faltas[t.id]} /> : null}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  rotulo: { fontSize: 14, fontWeight: '600', color: cores.textoSecundario },
  cartao: { backgroundColor: cores.cartao, borderRadius: 16, borderWidth: 2, borderColor: cores.laranja, padding: 16, gap: 6 },
  selo: { alignSelf: 'flex-start', backgroundColor: cores.laranja, color: cores.branco, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  produto: { fontSize: 18, fontWeight: '700', color: cores.texto },
  texto: { fontSize: 14, color: cores.textoSecundario },
  instrucoes: { fontSize: 14, color: cores.texto, fontStyle: 'italic' },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 6 },
  feito: { fontSize: 14, fontWeight: '700', color: cores.confirmar, marginTop: 4 },
});
