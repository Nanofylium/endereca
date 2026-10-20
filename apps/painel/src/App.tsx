import { useCallback, useMemo, useRef, useState } from 'react';
import { criarApi, ErroApi } from './api';
import { identificarNavegador, lerSessao, salvarSessao } from './aparelho';
import { Contexto } from './contexto';
import { NOME_PAPEL } from './formatar';
import { Acessos } from './telas/Acessos';
import { Alertas } from './telas/Alertas';
import { Aparelhos } from './telas/Aparelhos';
import { Equipe } from './telas/Equipe';
import { Etiquetas } from './telas/Etiquetas';
import { Login } from './telas/Login';
import { Setores } from './telas/Setores';
import { Papel, RespostaAcesso } from './tipos';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type Aba = 'setores' | 'equipe' | 'acessos' | 'alertas' | 'etiquetas' | 'aparelhos';

const ABAS: { id: Aba; rotulo: string; titulo: string; papeis: Papel[] }[] = [
  { id: 'setores', rotulo: 'Setores', titulo: 'Visão dos setores', papeis: ['gerente', 'admin'] },
  { id: 'equipe', rotulo: 'Equipe', titulo: 'Equipe', papeis: ['lider', 'gerente', 'admin'] },
  { id: 'acessos', rotulo: 'Acessos', titulo: 'Acessos e segurança', papeis: ['lider', 'gerente', 'admin'] },
  { id: 'alertas', rotulo: 'Produtos e avisos', titulo: 'Produtos e avisos', papeis: ['lider', 'gerente', 'admin'] },
  { id: 'etiquetas', rotulo: 'Etiquetas', titulo: 'Etiquetas de endereço e de volume', papeis: ['lider', 'gerente', 'admin'] },
  { id: 'aparelhos', rotulo: 'Aparelhos', titulo: 'Aparelhos da loja', papeis: ['gerente', 'admin'] },
];

export function App() {
  const aparelhoId = useMemo(identificarNavegador, []);
  const [sessao, setSessao] = useState<RespostaAcesso | null>(() => lerSessao<RespostaAcesso>());
  const [aba, setAba] = useState<Aba | null>(null);
  const [avisoLogin, setAvisoLogin] = useState('');
  const token = useRef<string | null>(null);
  token.current = sessao?.token ?? null;

  const api = useMemo(() => criarApi({ baseUrl: API_URL, aparelhoId, token: () => token.current }), [aparelhoId]);

  const sair = useCallback((motivo = '') => {
    salvarSessao(null);
    setSessao(null);
    setAba(null);
    setAvisoLogin(motivo);
  }, []);

  const aoSessaoCair = useCallback((e: ErroApi) => sair(e.message), [sair]);

  if (!sessao) {
    return (
      <Login
        api={api}
        aparelhoId={aparelhoId}
        avisoInicial={avisoLogin}
        aoEntrar={(r) => {
          salvarSessao(r);
          setSessao(r);
        }}
      />
    );
  }

  const papel = sessao.colaborador.papel;
  const abas = ABAS.filter((a) => a.papeis.includes(papel));
  const atual = abas.find((a) => a.id === aba) ?? abas[0];
  const ctx: Contexto = { api, papel, aoSessaoCair };

  return (
    <div className="layout">
      <nav className="menu" aria-label="Seções do painel">
        <div className="marca">
          <div className="logo" aria-hidden="true">E</div>
          <div>
            <strong>Endereça</strong>
            <span>{papel === 'lider' ? 'Painel do líder' : 'Painel do gerente operacional'}</span>
          </div>
        </div>
        {abas.map((a) => (
          <button key={a.id} aria-current={a.id === atual.id ? 'page' : undefined} onClick={() => setAba(a.id)}>
            {a.rotulo}
          </button>
        ))}
        <div className="rodape">
          {sessao.colaborador.nome}
          <br />
          {NOME_PAPEL[papel]} · {sessao.colaborador.matricula}
          <br />
          <button onClick={() => sair()} style={{ background: 'none', border: 'none' }}>Sair</button>
        </div>
      </nav>
      <main className="conteudo">
        <div className="cabecalho">
          <div>
            <h1>{atual.titulo}</h1>
            <p className="subtitulo">Loja {sessao.colaborador.lojaId}</p>
          </div>
        </div>
        {atual.id === 'setores' ? <Setores ctx={ctx} /> : null}
        {atual.id === 'equipe' ? <Equipe ctx={ctx} /> : null}
        {atual.id === 'acessos' ? <Acessos ctx={ctx} /> : null}
        {atual.id === 'alertas' ? <Alertas ctx={ctx} /> : null}
        {atual.id === 'etiquetas' ? <Etiquetas ctx={ctx} /> : null}
        {atual.id === 'aparelhos' ? <Aparelhos ctx={ctx} /> : null}
      </main>
    </div>
  );
}
