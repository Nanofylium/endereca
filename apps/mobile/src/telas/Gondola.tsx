import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Api, ErroApi } from '../api';
import { Botao } from '../componentes/Botao';
import { Cabecalho } from '../componentes/Cabecalho';
import { Cartao } from '../componentes/Cartao';
import { reais } from '../formatar';
import { cores } from '../tema';
import { Conferencia, ModuloGondola, ProdutoNaGondola } from '../tipos';
import { Scanner } from './Scanner';

type Modulo = { rua: string; modulo: string | null };
type Passo =
  | { nome: 'escolher' }
  | { nome: 'modulo'; alvo: Modulo }
  | { nome: 'conferir'; alvo: Modulo; nivel: string; posicao: string; quantidade: string }
  | { nome: 'bipar'; alvo: Modulo; nivel: string; posicao: string; quantidade: string };

/**
 * Gôndola sem etiqueta de prateleira: o celular mostra o que vai em cada nível do módulo, com o preço,
 * e o repositor confirma o lugar bipando o código de barras da própria embalagem.
 */
export function Gondola(props: { api: Api; aoVoltar: () => void; aoErro: (e: unknown) => void }) {
  const [passo, setPasso] = useState<Passo>({ nome: 'escolher' });
  const [ruas, setRuas] = useState<{ rua: string; modulo: string | null; produtos: number }[] | null>(null);
  const [modulo, setModulo] = useState<ModuloGondola | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean; troca?: { produto: string } } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    props.api.ruasGondola().then(setRuas).catch(props.aoErro);
  }, []);

  async function abrir(alvo: Modulo) {
    setPasso({ nome: 'modulo', alvo });
    setModulo(null);
    try {
      setModulo(await props.api.moduloGondola(alvo.rua, alvo.modulo));
    } catch (e) {
      props.aoErro(e);
    }
  }

  async function conferir(p: Extract<Passo, { nome: 'bipar' }>, produto: string, substituir = false) {
    setEnviando(true);
    try {
      const r = await props.api.conferirNaGondola({
        produto,
        rua: p.alvo.rua,
        modulo: p.alvo.modulo ?? undefined,
        nivel: p.nivel.trim() || undefined,
        posicao: p.posicao.trim() || undefined,
        quantidade: p.quantidade.trim() ? Number(p.quantidade) : undefined,
        substituir,
      });
      setAviso({ texto: textoConferencia(r) });
      await abrir(p.alvo);
    } catch (e) {
      if (e instanceof ErroApi && e.motivo === 'posicao_ocupada') {
        setAviso({ texto: e.message, erro: true, troca: { produto } });
        setPasso({ ...p, nome: 'conferir' });
      } else if (e instanceof ErroApi && !e.exigeNovoLogin) {
        setAviso({ texto: e.message, erro: true });
        setPasso({ ...p, nome: 'conferir' });
      } else props.aoErro(e);
    } finally {
      setEnviando(false);
    }
  }

  if (passo.nome === 'bipar') {
    return (
      <Scanner
        titulo="Bipe o produto"
        subtitulo={`${passo.alvo.rua}${passo.alvo.modulo ? ` · Módulo ${passo.alvo.modulo}` : ''} · Nível ${passo.nivel || '—'}`}
        instrucao="Aponte para o código de barras da embalagem, na frente da prateleira."
        aoLer={(lido) => conferir(passo, lido)}
        aoVoltar={() => setPasso({ ...passo, nome: 'conferir' })}
      />
    );
  }

  if (passo.nome === 'conferir') {
    const campo = (rotulo: string, valor: string, chave: 'nivel' | 'posicao' | 'quantidade') => (
      <View style={{ gap: 4, flex: 1 }}>
        <Text style={estilos.apagado}>{rotulo}</Text>
        <TextInput
          accessibilityLabel={rotulo}
          value={valor}
          keyboardType={chave === 'quantidade' ? 'number-pad' : 'default'}
          onChangeText={(t) => setPasso({ ...passo, [chave]: t })}
          style={estilos.campo}
        />
      </View>
    );
    const bipar = { ...passo, nome: 'bipar' as const };
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <Cabecalho titulo="Conferir na prateleira" subtitulo={passo.alvo.rua} onVoltar={() => setPasso({ nome: 'modulo', alvo: passo.alvo })} />
        <ScrollView contentContainerStyle={estilos.conteudo}>
          <Cartao titulo="Onde o produto está">
            <View style={estilos.linha}>
              {campo('Nível', passo.nivel, 'nivel')}
              {campo('Posição', passo.posicao, 'posicao')}
              {campo('Na frente (un.)', passo.quantidade, 'quantidade')}
            </View>
            <Text style={estilos.apagado}>Depois bipe o código de barras da embalagem. Nenhuma etiqueta é impressa.</Text>
          </Cartao>
          {aviso ? <Text style={aviso.erro ? estilos.erro : estilos.ok}>{aviso.texto}</Text> : null}
          {aviso?.troca ? (
            <Botao titulo="Ele saiu daqui: confirmar a troca" carregando={enviando} onPress={() => conferir(bipar, aviso.troca!.produto, true)} />
          ) : null}
          <Botao titulo="Bipar o produto" variante={aviso?.troca ? 'contorno' : 'principal'} onPress={() => {
              setAviso(null);
              setPasso(bipar);
            }} />
        </ScrollView>
      </View>
    );
  }

  if (passo.nome === 'modulo') {
    const alvo = passo.alvo;
    const novaConferencia = (nivel: string | null) => {
      setAviso(null);
      setPasso({ nome: 'conferir', alvo, nivel: nivel ?? '', posicao: '', quantidade: '' });
    };
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <Cabecalho titulo={`${alvo.rua}${alvo.modulo ? ` · Módulo ${alvo.modulo}` : ''}`} subtitulo="Gôndola sem etiqueta" onVoltar={() => setPasso({ nome: 'escolher' })} />
        <ScrollView contentContainerStyle={estilos.conteudo}>
          {aviso && !aviso.erro ? <Text style={estilos.ok}>{aviso.texto}</Text> : null}
          {!modulo ? <ActivityIndicator style={{ marginTop: 32 }} size="large" color={cores.verde} /> : null}
          {modulo?.niveis.map((n) => (
            <Cartao key={n.nivel ?? ''} titulo={n.nivel ? `Nível ${n.nivel}` : 'Sem nível'}>
              {n.produtos.map((p) => (
                <ItemGondola key={p.sku} p={p} />
              ))}
              <Botao titulo="Conferir produto neste nível" variante="contorno" onPress={() => novaConferencia(n.nivel)} />
            </Cartao>
          ))}
          {modulo ? <Botao titulo="Conferir produto em outro nível" variante="escuro" onPress={() => novaConferencia(null)} /> : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Cabecalho titulo="Gôndola sem etiqueta" subtitulo="Escolha o módulo" onVoltar={props.aoVoltar} />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Text style={estilos.texto}>
          O que antes ficava impresso na prateleira agora está aqui: o produto de cada nível, o preço de varejo e o de atacado. O cliente consulta o preço no leitor da gôndola.
        </Text>
        {!ruas ? <ActivityIndicator style={{ marginTop: 32 }} size="large" color={cores.verde} /> : null}
        {ruas?.length === 0 ? <Text style={estilos.apagado}>Nenhum produto com endereço na área de venda ainda.</Text> : null}
        {ruas?.map((r) => (
          <Pressable key={`${r.rua}|${r.modulo ?? ''}`} accessibilityRole="button" onPress={() => abrir({ rua: r.rua, modulo: r.modulo })} style={estilos.item}>
            <Text style={estilos.rua}>{r.rua}</Text>
            <Text style={[estilos.texto, { flex: 1 }]}>{r.modulo ? `Módulo ${r.modulo}` : 'Sem módulo'}</Text>
            <Text style={estilos.apagado}>{r.produtos} produto(s)</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ItemGondola({ p }: { p: ProdutoNaGondola }) {
  return (
    <View style={estilos.produto}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={estilos.nome}>
          {p.posicao ? `${p.posicao}. ` : ''}
          {p.nome}
        </Text>
        <Text style={estilos.preco}>{reais(p.precoUnidade)}</Text>
      </View>
      {p.precoAtacado !== null ? (
        <Text style={estilos.atacado}>
          Atacado: {reais(p.precoAtacado)} a partir de {p.quantidadeAtacado ?? '—'} un.
        </Text>
      ) : null}
      <Text style={estilos.apagado}>
        EAN {p.ean ?? '—'}
        {p.quantidade !== null ? ` · ${p.quantidade} un. na frente` : ''}
      </Text>
      {p.conferirDeNovo ? <Text style={estilos.conferir}>Conferir de novo</Text> : null}
    </View>
  );
}

function textoConferencia(r: Conferencia): string {
  const troca = r.substituido ? ` ${r.substituido.nome} saiu desta posição.` : '';
  if (r.resultado === 'confirmado') return `${r.produto.nome} confirmado em ${r.endereco}.${troca}`;
  if (r.resultado === 'movido') return `${r.produto.nome} mudou de ${r.antes} para ${r.endereco}.${troca}`;
  return `${r.produto.nome} agora consta em ${r.endereco}.${troca}`;
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 12, paddingBottom: 32 },
  texto: { fontSize: 15, color: cores.textoSecundario, lineHeight: 21 },
  apagado: { fontSize: 13, color: cores.textoApagado },
  linha: { flexDirection: 'row', gap: 10 },
  campo: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.cartao, paddingHorizontal: 12, fontSize: 18, color: cores.texto },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cores.cartao, borderRadius: 14, borderWidth: 1, borderColor: cores.borda, padding: 14 },
  rua: { fontSize: 24, fontWeight: '800', color: cores.verde },
  produto: { paddingVertical: 8, gap: 2, borderBottomWidth: 1, borderBottomColor: cores.borda },
  nome: { fontSize: 15, fontWeight: '700', color: cores.texto, flexShrink: 1 },
  preco: { fontSize: 18, fontWeight: '800', color: cores.verde },
  atacado: { fontSize: 13, fontWeight: '600', color: cores.laranjaTexto },
  conferir: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: cores.amareloTexto, backgroundColor: cores.amareloFundo, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ok: { fontSize: 14, fontWeight: '600', color: cores.confirmar },
  erro: { fontSize: 14, fontWeight: '600', color: cores.laranjaTexto },
});
