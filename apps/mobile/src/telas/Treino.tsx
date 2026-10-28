import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Api, ErroApi } from '../api';
import { Botao } from '../componentes/Botao';
import { Cabecalho } from '../componentes/Cabecalho';
import { Cartao } from '../componentes/Cartao';
import { cores } from '../tema';
import { DesafioTreino, LicaoTreino, NivelTreino, ResultadoDesafio, ResultadoLicao, ResumoTreino } from '../tipos';

type Passo =
  | { nome: 'inicio' }
  | { nome: 'licao'; licao: LicaoTreino; respostas: (number | null)[]; resultado: ResultadoLicao | null }
  | { nome: 'desafio'; desafio: DesafioTreino; resultado: ResultadoDesafio | null; escolha: string | null };

/**
 * Treino do repositor: lições curtas com perguntas, desafio de achar produto na loja de verdade,
 * pontos, níveis e o caminho até liderar. Serve para quem está chegando e para quem quer crescer.
 */
export function Treino(props: { api: Api; aoVoltar: () => void; aoErro: (e: unknown) => void }) {
  const [resumo, setResumo] = useState<ResumoTreino | null>(null);
  const [passo, setPasso] = useState<Passo>({ nome: 'inicio' });
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  const carregar = () => props.api.treino().then(setResumo).catch(props.aoErro);
  useEffect(() => {
    carregar();
  }, []);

  async function abrirLicao(id: string) {
    try {
      const licao = await props.api.licao(id);
      setPasso({ nome: 'licao', licao, respostas: licao.perguntas.map(() => null), resultado: null });
    } catch (e) {
      props.aoErro(e);
    }
  }

  async function abrirDesafio() {
    setAviso('');
    try {
      setPasso({ nome: 'desafio', desafio: await props.api.desafio(), resultado: null, escolha: null });
    } catch (e) {
      if (e instanceof ErroApi && !e.exigeNovoLogin) setAviso(e.message);
      else props.aoErro(e);
    }
  }

  async function enviarLicao(p: Extract<Passo, { nome: 'licao' }>) {
    setEnviando(true);
    try {
      const resultado = await props.api.responderLicao(p.licao.id, p.respostas.map((r) => r ?? 0));
      setPasso({ ...p, resultado });
      carregar();
    } catch (e) {
      props.aoErro(e);
    } finally {
      setEnviando(false);
    }
  }

  async function responderDesafio(p: Extract<Passo, { nome: 'desafio' }>, escolha: string) {
    setEnviando(true);
    try {
      const resultado = await props.api.responderDesafio(p.desafio.sku, escolha);
      setPasso({ ...p, escolha, resultado });
      carregar();
    } catch (e) {
      props.aoErro(e);
    } finally {
      setEnviando(false);
    }
  }

  const voltarAoInicio = () => setPasso({ nome: 'inicio' });

  if (passo.nome === 'licao') {
    const { licao, respostas, resultado } = passo;
    const completo = respostas.every((r) => r !== null);
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <Cabecalho titulo={licao.titulo} subtitulo={`${licao.minutos} min de leitura`} onVoltar={voltarAoInicio} />
        <ScrollView contentContainerStyle={estilos.conteudo}>
          <Cartao titulo="O que você precisa saber">
            {licao.topicos.map((t, i) => (
              <Text key={i} style={estilos.topico}>
                {i + 1}. {t}
              </Text>
            ))}
          </Cartao>
          {licao.perguntas.map((q, i) => {
            const correcao = resultado?.correcoes[i];
            return (
              <Cartao key={i} titulo={`Pergunta ${i + 1} de ${licao.perguntas.length}`}>
                <Text style={estilos.pergunta}>{q.pergunta}</Text>
                {q.opcoes.map((o, j) => {
                  const marcada = respostas[i] === j;
                  const certa = correcao && correcao.correta === j;
                  const errada = correcao && marcada && !correcao.acertou;
                  return (
                    <Pressable
                      key={j}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: marcada, disabled: !!resultado }}
                      disabled={!!resultado}
                      onPress={() => setPasso({ ...passo, respostas: respostas.map((r, k) => (k === i ? j : r)) })}
                      style={[estilos.opcao, marcada && estilos.opcaoMarcada, certa && estilos.opcaoCerta, errada && estilos.opcaoErrada]}
                    >
                      <Text style={estilos.textoOpcao}>{o}</Text>
                    </Pressable>
                  );
                })}
                {correcao ? <Text style={correcao.acertou ? estilos.ok : estilos.erro}>{correcao.explicacao}</Text> : null}
              </Cartao>
            );
          })}
          {resultado ? (
            <>
              <Comemoracao
                titulo={resultado.aprovado ? `Lição concluída: ${resultado.acertos} de ${resultado.total}` : `${resultado.acertos} de ${resultado.total}. Releia e tente de novo`}
                ganhou={resultado.ganhou}
                subiu={resultado.subiuDeNivel}
                nivel={resultado.nivel}
              />
              {!resultado.aprovado ? <Botao titulo="Tentar de novo" onPress={() => abrirLicao(licao.id)} /> : null}
              <Botao titulo="Voltar ao treino" variante="escuro" onPress={voltarAoInicio} />
            </>
          ) : (
            <Botao titulo="Conferir respostas" desabilitado={!completo} carregando={enviando} onPress={() => enviarLicao(passo)} />
          )}
        </ScrollView>
      </View>
    );
  }

  if (passo.nome === 'desafio') {
    const { desafio, resultado, escolha } = passo;
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <Cabecalho titulo="Ache o produto" subtitulo="Um produto de verdade da sua loja" onVoltar={voltarAoInicio} />
        <ScrollView contentContainerStyle={estilos.conteudo}>
          <Cartao titulo="Onde fica na área de venda?">
            <Text style={estilos.produto}>{desafio.nome}</Text>
            {desafio.ean ? <Text style={estilos.apagado}>EAN {desafio.ean}</Text> : null}
          </Cartao>
          {desafio.opcoes.map((o) => {
            const certa = resultado && o === resultado.correta;
            const errada = resultado && o === escolha && !resultado.acertou;
            return (
              <Pressable
                key={o}
                accessibilityRole="button"
                disabled={!!resultado || enviando}
                onPress={() => responderDesafio(passo, o)}
                style={[estilos.opcao, certa && estilos.opcaoCerta, errada && estilos.opcaoErrada]}
              >
                <Text style={estilos.endereco}>{o}</Text>
              </Pressable>
            );
          })}
          {resultado ? (
            <>
              <Comemoracao
                titulo={resultado.acertou ? 'Achou! É aí mesmo.' : `Quase. Fica em ${resultado.correta}.`}
                ganhou={resultado.ganhou}
                subiu={resultado.subiuDeNivel}
                nivel={resultado.nivel}
              />
              <Botao titulo="Outro produto" onPress={abrirDesafio} />
              <Botao titulo="Voltar ao treino" variante="escuro" onPress={voltarAoInicio} />
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Cabecalho titulo="Treinamento" subtitulo="Sua trilha no setor" onVoltar={props.aoVoltar} />
      {!resumo ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={cores.verde} />
      ) : (
        <ScrollView contentContainerStyle={estilos.conteudo}>
          <View style={estilos.nivel}>
            <Text style={estilos.nivelRotulo}>SEU NÍVEL</Text>
            <Text style={estilos.nivelNome}>{resumo.nivel.atual.nome}</Text>
            <Text style={estilos.nivelTexto}>{resumo.nivel.atual.descricao}</Text>
            <BarraNivel nivel={resumo.nivel} pontos={resumo.pontos} />
            <Text style={estilos.nivelTexto}>
              {resumo.pontos} pontos{resumo.nivel.proximo ? ` · faltam ${resumo.nivel.faltam} para ${resumo.nivel.proximo.nome}` : ' · nível máximo da trilha'}
            </Text>
          </View>

          <Cartao titulo="Desafio do dia · ache o produto" estilo={{ borderWidth: 2, borderColor: cores.laranja }}>
            <Text style={estilos.texto}>Um produto da sua loja aparece e você diz onde ele fica. Cada acerto vale 5 pontos (até 10 por dia).</Text>
            <Text style={estilos.apagado}>
              Hoje: {resumo.desafiosHoje.acertos} acerto(s) em {resumo.desafiosHoje.feitos} tentativa(s)
            </Text>
            {aviso ? <Text style={estilos.erro}>{aviso}</Text> : null}
            <Botao titulo="Começar desafio" onPress={abrirDesafio} />
          </Cartao>

          <Text style={estilos.secao}>Lições · {resumo.licoes.filter((l) => l.concluida).length} de {resumo.licoes.length}</Text>
          {resumo.licoes.map((l, i) => (
            <Pressable key={l.id} accessibilityRole="button" onPress={() => abrirLicao(l.id)} style={[estilos.licao, l.concluida && estilos.licaoFeita]}>
              <Text style={[estilos.numeroLicao, l.concluida && { backgroundColor: cores.confirmar }]}>{l.concluida ? '✓' : i + 1}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={estilos.tituloLicao}>{l.titulo}</Text>
                <Text style={estilos.apagado}>
                  {l.resumo} · {l.minutos} min
                  {l.acertos !== null ? ` · ${l.acertos}/${l.perguntas} certas` : ''}
                </Text>
              </View>
            </Pressable>
          ))}

          <Cartao titulo="Onde essa trilha leva">
            {resumo.carreira.map((c, i) => (
              <View key={c.cargo} style={{ flexDirection: 'row', gap: 10, paddingVertical: 4 }}>
                <Text style={estilos.degrau}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.tituloLicao}>{c.cargo}</Text>
                  <Text style={estilos.apagado}>{c.foco}</Text>
                </View>
              </View>
            ))}
          </Cartao>
        </ScrollView>
      )}
    </View>
  );
}

function BarraNivel(props: { nivel: NivelTreino; pontos: number }) {
  const { atual, proximo } = props.nivel;
  const fracao = proximo ? Math.min(1, (props.pontos - atual.apartir) / (proximo.apartir - atual.apartir)) : 1;
  return (
    <View style={estilos.barraFundo} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(fracao * 100) }}>
      <View style={[estilos.barra, { width: `${Math.round(fracao * 100)}%` }]} />
    </View>
  );
}

function Comemoracao(props: { titulo: string; ganhou: number; subiu: string | null; nivel: NivelTreino }) {
  return (
    <View style={[estilos.comemoracao, props.subiu ? { backgroundColor: cores.laranjaFundo, borderColor: cores.laranja } : null]}>
      <Text style={estilos.produto}>{props.titulo}</Text>
      {props.ganhou ? <Text style={estilos.ok}>+{props.ganhou} pontos</Text> : null}
      {props.subiu ? <Text style={estilos.subiu}>Você agora é {props.subiu}! {props.nivel.atual.descricao}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 12, paddingBottom: 32 },
  texto: { fontSize: 15, color: cores.textoSecundario, lineHeight: 21 },
  apagado: { fontSize: 13, color: cores.textoApagado },
  secao: { fontSize: 14, fontWeight: '700', color: cores.textoSecundario, marginTop: 4 },
  nivel: { backgroundColor: cores.verde, borderRadius: 16, padding: 18, gap: 6 },
  nivelRotulo: { color: cores.verdeClaroTexto, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  nivelNome: { color: cores.branco, fontSize: 28, fontWeight: '800' },
  nivelTexto: { color: cores.verdeClaroTexto, fontSize: 13 },
  barraFundo: { height: 10, borderRadius: 5, backgroundColor: cores.verdeMedio, overflow: 'hidden', marginVertical: 4 },
  barra: { height: 10, borderRadius: 5, backgroundColor: cores.laranja },
  licao: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: cores.cartao, borderRadius: 14, borderWidth: 1, borderColor: cores.borda, padding: 14 },
  licaoFeita: { borderColor: cores.confirmar },
  numeroLicao: { width: 32, height: 32, borderRadius: 16, backgroundColor: cores.verde, color: cores.branco, textAlign: 'center', lineHeight: 32, fontWeight: '800', overflow: 'hidden' },
  tituloLicao: { fontSize: 15, fontWeight: '700', color: cores.texto },
  degrau: { width: 26, height: 26, borderRadius: 13, backgroundColor: cores.laranjaFundo, color: cores.laranjaTexto, textAlign: 'center', lineHeight: 26, fontWeight: '800', overflow: 'hidden' },
  topico: { fontSize: 15, color: cores.texto, lineHeight: 22 },
  pergunta: { fontSize: 16, fontWeight: '700', color: cores.texto, marginBottom: 4 },
  opcao: { borderRadius: 12, borderWidth: 2, borderColor: cores.borda, backgroundColor: cores.cartao, padding: 12 },
  opcaoMarcada: { borderColor: cores.verde },
  opcaoCerta: { borderColor: cores.confirmar, backgroundColor: cores.confirmarFundo },
  opcaoErrada: { borderColor: cores.laranja, backgroundColor: cores.laranjaFundo },
  textoOpcao: { fontSize: 15, color: cores.texto },
  produto: { fontSize: 18, fontWeight: '800', color: cores.texto },
  endereco: { fontSize: 18, fontWeight: '700', color: cores.verde },
  comemoracao: { borderRadius: 16, borderWidth: 2, borderColor: cores.confirmar, backgroundColor: cores.confirmarFundo, padding: 16, gap: 4 },
  subiu: { fontSize: 15, fontWeight: '700', color: cores.laranjaTexto },
  ok: { fontSize: 14, fontWeight: '600', color: cores.confirmar },
  erro: { fontSize: 14, fontWeight: '600', color: cores.laranjaTexto },
});
