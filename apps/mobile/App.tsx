import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { criarApi, ErroApi } from './src/api';
import { identificarAparelho } from './src/aparelho';
import { apagarSessao, lerSessao, salvarSessao } from './src/sessaoSalva';
import { Acesso } from './src/telas/Acesso';
import { tipoDoCodigo } from './src/etiquetas';
import { Ficha } from './src/telas/Ficha';
import { Gondola } from './src/telas/Gondola';
import { Guardar } from './src/telas/Guardar';
import { Inicio } from './src/telas/Inicio';
import { Local } from './src/telas/Local';
import { Scanner } from './src/telas/Scanner';
import { cores } from './src/tema';
import { RespostaAcesso } from './src/tipos';

const API_URL: string = Constants.expoConfig?.extra?.apiUrl ?? 'http://10.0.2.2:3000';

type Tela =
  | { nome: 'inicio' }
  | { nome: 'scanner' }
  | { nome: 'ficha'; codigo: string }
  | { nome: 'local'; codigo: string }
  | { nome: 'guardar'; volume?: string }
  | { nome: 'gondola' };

export default function App() {
  const [aparelhoId, setAparelhoId] = useState<string | null>(null);
  const [sessao, setSessao] = useState<RespostaAcesso | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [tela, setTela] = useState<Tela>({ nome: 'inicio' });
  const token = useRef<string | null>(null);
  token.current = sessao?.token ?? null;

  useEffect(() => {
    Promise.all([identificarAparelho(), lerSessao()])
      .then(([id, salva]) => {
        setAparelhoId(id);
        setSessao(salva);
      })
      .finally(() => setCarregando(false));
  }, []);

  const api = useMemo(() => criarApi({ baseUrl: API_URL, aparelhoId: aparelhoId ?? '', token: () => token.current }), [aparelhoId]);

  async function entrar(resposta: RespostaAcesso) {
    await salvarSessao(resposta);
    setSessao(resposta);
    setTela({ nome: 'inicio' });
  }

  async function sair() {
    await apagarSessao();
    setSessao(null);
  }

  /** Sessão revogada (desligamento, outro aparelho, expirou) volta para o login. */
  function tratarErro(e: unknown) {
    if (e instanceof ErroApi && e.exigeNovoLogin) {
      Alert.alert('Entre novamente', e.message);
      sair();
      return;
    }
    Alert.alert('Não deu certo', e instanceof Error ? e.message : 'Tente de novo.');
  }

  /** O scanner geral lê qualquer etiqueta: produto abre a ficha, endereço mostra o que há nele, volume vai para o endereçamento. */
  function abrirLido(codigo: string) {
    const tipo = tipoDoCodigo(codigo);
    if (tipo === 'endereco') setTela({ nome: 'local', codigo });
    else if (tipo === 'volume') setTela({ nome: 'guardar', volume: codigo });
    else setTela({ nome: 'ficha', codigo });
  }

  if (carregando || !aparelhoId) {
    return (
      <View style={{ flex: 1, backgroundColor: cores.verde, justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={cores.branco} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {!sessao ? (
        <Acesso api={api} aparelhoId={aparelhoId} aoEntrar={entrar} />
      ) : tela.nome === 'scanner' ? (
        <Scanner aoLer={abrirLido} aoVoltar={() => setTela({ nome: 'inicio' })} />
      ) : tela.nome === 'local' ? (
        <Local
          api={api}
          codigo={tela.codigo}
          aoAbrirProduto={(sku) => setTela({ nome: 'ficha', codigo: sku })}
          aoVoltar={() => setTela({ nome: 'scanner' })}
          aoErro={tratarErro}
        />
      ) : tela.nome === 'guardar' ? (
        <Guardar api={api} volumeInicial={tela.volume} aoVoltar={() => setTela({ nome: 'inicio' })} aoErro={tratarErro} />
      ) : tela.nome === 'gondola' ? (
        <Gondola api={api} aoVoltar={() => setTela({ nome: 'inicio' })} aoErro={tratarErro} />
      ) : tela.nome === 'ficha' ? (
        <Ficha api={api} codigo={tela.codigo} aoVoltar={() => setTela({ nome: 'scanner' })} aoErro={tratarErro} />
      ) : (
        <Inicio
          api={api}
          colaborador={sessao.colaborador}
          aoEscanear={() => setTela({ nome: 'scanner' })}
          aoGuardar={() => setTela({ nome: 'guardar' })}
          aoGondola={() => setTela({ nome: 'gondola' })}
          aoAbrirProduto={(codigo) => setTela({ nome: 'ficha', codigo })}
          aoSair={sair}
          aoErro={tratarErro}
        />
      )}
    </>
  );
}
