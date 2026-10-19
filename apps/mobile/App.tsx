import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { criarApi, ErroApi } from './src/api';
import { identificarAparelho } from './src/aparelho';
import { apagarSessao, lerSessao, salvarSessao } from './src/sessaoSalva';
import { Acesso } from './src/telas/Acesso';
import { Ficha } from './src/telas/Ficha';
import { Inicio } from './src/telas/Inicio';
import { Scanner } from './src/telas/Scanner';
import { cores } from './src/tema';
import { RespostaAcesso } from './src/tipos';

const API_URL: string = Constants.expoConfig?.extra?.apiUrl ?? 'http://10.0.2.2:3000';

type Tela = { nome: 'inicio' } | { nome: 'scanner' } | { nome: 'ficha'; codigo: string };

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
        <Scanner aoLer={(codigo) => setTela({ nome: 'ficha', codigo })} aoVoltar={() => setTela({ nome: 'inicio' })} />
      ) : tela.nome === 'ficha' ? (
        <Ficha api={api} codigo={tela.codigo} aoVoltar={() => setTela({ nome: 'scanner' })} aoErro={tratarErro} />
      ) : (
        <Inicio
          api={api}
          colaborador={sessao.colaborador}
          aoEscanear={() => setTela({ nome: 'scanner' })}
          aoAbrirProduto={(codigo) => setTela({ nome: 'ficha', codigo })}
          aoSair={sair}
          aoErro={tratarErro}
        />
      )}
    </>
  );
}
