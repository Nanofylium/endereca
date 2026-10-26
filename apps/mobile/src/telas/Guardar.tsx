import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Api, ErroApi } from '../api';
import { Botao } from '../componentes/Botao';
import { Cabecalho } from '../componentes/Cabecalho';
import { Cartao } from '../componentes/Cartao';
import { tipoDoCodigo } from '../etiquetas';
import { cores } from '../tema';
import { EtiquetaLocal, EtiquetaVolume } from '../tipos';
import { Scanner } from './Scanner';

type Passo =
  | { nome: 'volume' }
  | { nome: 'endereco'; volume: EtiquetaVolume }
  | { nome: 'feito'; volume: EtiquetaVolume; local: EtiquetaLocal; movido: boolean }
  | { nome: 'baixado'; volume: EtiquetaVolume };

/** O código impresso embaixo do QR pode ser digitado sem o prefixo. */
const completar = (lido: string, prefixo: 'L' | 'V') => (/^ENDERECA:/i.test(lido.trim()) ? lido.trim() : `ENDERECA:${prefixo}:${lido.trim()}`);

/** Endereçamento: bipa a caixa ou o palete, depois o endereço onde guardou. */
export function Guardar(props: { api: Api; volumeInicial?: string; aoVoltar: () => void; aoErro: (e: unknown) => void }) {
  const [passo, setPasso] = useState<Passo>({ nome: 'volume' });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [leitura, setLeitura] = useState(0);

  function falhou(e: unknown) {
    if (e instanceof ErroApi && !e.exigeNovoLogin) setErro(e.message);
    else props.aoErro(e);
  }

  async function lerVolume(lido: string) {
    setErro('');
    const codigo = completar(lido, 'V');
    if (tipoDoCodigo(codigo) !== 'volume') return setErro('Esse não é o QR de uma caixa ou palete. Bipe a etiqueta do volume.');
    setCarregando(true);
    try {
      const r = await props.api.lerEtiqueta(codigo);
      if (r.tipo === 'volume') setPasso({ nome: 'endereco', volume: r.volume });
    } catch (e) {
      falhou(e);
    } finally {
      setCarregando(false);
      setLeitura((n) => n + 1);
    }
  }

  async function lerEndereco(volume: EtiquetaVolume, lido: string) {
    setErro('');
    const codigo = completar(lido, 'L');
    if (tipoDoCodigo(codigo) !== 'endereco') return setErro('Agora bipe a etiqueta do endereço onde você guardou o volume.');
    setCarregando(true);
    try {
      const r = await props.api.guardar(volume.qr, codigo);
      if (r.volume.guardado) setPasso({ nome: 'feito', volume: r.volume, local: r.volume.guardado.local, movido: r.movido });
    } catch (e) {
      falhou(e);
    } finally {
      setCarregando(false);
      setLeitura((n) => n + 1);
    }
  }

  async function baixar(volume: EtiquetaVolume) {
    setErro('');
    setCarregando(true);
    try {
      const r = await props.api.baixarVolume(volume.qr);
      setPasso({ nome: 'baixado', volume: r.volume });
    } catch (e) {
      falhou(e);
    } finally {
      setCarregando(false);
    }
  }

  // Volume lido pelo scanner geral: já começa pedindo o endereço.
  useEffect(() => {
    if (props.volumeInicial) lerVolume(props.volumeInicial);
  }, [props.volumeInicial]);

  if (passo.nome === 'feito') {
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <Cabecalho titulo="Volume guardado" onVoltar={props.aoVoltar} />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={estilos.sucesso}>
            <Text style={estilos.sucessoTitulo}>{passo.movido ? 'Mudança de lugar registrada' : 'Endereço registrado'}</Text>
            <Text style={estilos.sucessoTexto}>
              {passo.volume.quantidade} un. de {passo.volume.produto} em {passo.local.nomeTipo}, {passo.local.descricao}.
            </Text>
          </View>
          <Botao titulo="Guardar outro volume" onPress={() => setPasso({ nome: 'volume' })} />
          <Botao titulo="Voltar ao início" variante="escuro" onPress={props.aoVoltar} />
        </ScrollView>
      </View>
    );
  }

  if (passo.nome === 'baixado') {
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <Cabecalho titulo="Caixa com baixa" onVoltar={props.aoVoltar} />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={estilos.sucesso}>
            <Text style={estilos.sucessoTitulo}>Baixa registrada</Text>
            <Text style={estilos.sucessoTexto}>
              A caixa de {passo.volume.produto} saiu do estoque{passo.volume.guardado ? ` de ${passo.volume.guardado.local.descricao}` : ''}. Pode descartar a etiqueta.
            </Text>
          </View>
          <Botao titulo="Bipar outra caixa" onPress={() => setPasso({ nome: 'volume' })} />
          <Botao titulo="Voltar ao início" variante="escuro" onPress={props.aoVoltar} />
        </ScrollView>
      </View>
    );
  }

  const volume = passo.nome === 'endereco' ? passo.volume : null;
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0F1A' }}>
      {volume ? (
        <View style={estilos.volume}>
          <Cartao titulo="Passo 2 de 2 · volume lido">
            <Text style={estilos.produto}>{volume.produto}</Text>
            <Text style={estilos.info}>
              {volume.quantidade} un.{volume.lote ? ` · lote ${volume.lote}` : ''}
              {volume.guardado ? ` · hoje em ${volume.guardado.local.descricao}` : ''}
            </Text>
            <Botao titulo="A caixa acabou: dar baixa" variante="contorno" carregando={carregando} onPress={() => baixar(volume)} />
          </Cartao>
        </View>
      ) : null}
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
      <View style={{ flex: 1 }}>
        <Scanner
          key={`${passo.nome}-${leitura}`}
          titulo={volume ? 'Bipe o endereço' : 'Bipe a caixa ou o palete'}
          subtitulo={volume ? 'Etiqueta fixa do local' : 'Passo 1 de 2'}
          instrucao={
            carregando
              ? 'Conferindo...'
              : volume
                ? 'Aponte para a etiqueta do endereço onde você guardou o volume (rua, módulo, nível).'
                : 'Aponte para a etiqueta colada na caixa ou no palete no recebimento.'
          }
          rotuloDigitar="Ou digite o código da etiqueta"
          aoLer={(lido) => (volume ? lerEndereco(volume, lido) : lerVolume(lido))}
          aoVoltar={volume ? () => setPasso({ nome: 'volume' }) : props.aoVoltar}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  volume: { padding: 16, paddingTop: 48, backgroundColor: cores.verde },
  produto: { fontSize: 17, fontWeight: '700', color: cores.texto },
  info: { fontSize: 14, color: cores.textoApagado },
  erro: { backgroundColor: cores.laranjaFundo, color: cores.laranjaTexto, fontSize: 15, padding: 14, fontWeight: '600' },
  sucesso: { backgroundColor: cores.confirmarFundo, borderRadius: 16, padding: 18, gap: 6 },
  sucessoTitulo: { fontSize: 18, fontWeight: '700', color: cores.confirmar },
  sucessoTexto: { fontSize: 15, color: cores.texto, lineHeight: 22 },
});
