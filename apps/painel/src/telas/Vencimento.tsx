import { useCallback, useState } from 'react';
import { ErroApi } from '../api';
import { Contexto } from '../contexto';
import { diaMes, quando, reais, textoVencimento } from '../formatar';
import { AcaoVencimento, AlertaVencimento } from '../tipos';
import { usarDados } from '../usarDados';

const NOME_ACAO: Record<AlertaVencimento['sugestao'], string> = {
  destacar: 'Destacar',
  rebaixar: 'Rebaixar preço',
  devolver: 'Devolver ao fornecedor',
  retirar: 'Retirar da venda',
  vende_a_tempo: 'Vende a tempo',
};

const EXPLICA: Record<AlertaVencimento['sugestao'], string> = {
  destacar: 'Ainda dá tempo de vender no preço: leve para a ponta de gôndola ou peça na Boa do Dia.',
  rebaixar: 'Faltam poucos dias e não vai dar tempo no ritmo atual: rebaixe o preço agora.',
  devolver: 'O produto está parado e há prazo: negocie a troca com o fornecedor.',
  retirar: 'Venceu: retire da venda e dê baixa.',
  vende_a_tempo: 'No ritmo de venda atual, sai antes de vencer.',
};

const ACOES: AcaoVencimento[] = ['destacar', 'rebaixar', 'devolver', 'retirar'];
const JANELAS = [15, 45, 90];

function Linha({ a, aoDecidir }: { a: AlertaVencimento; aoDecidir: (a: AlertaVencimento, acao: AcaoVencimento, obs: string) => Promise<void> }) {
  const [aberta, setAberta] = useState(false);
  const [acao, setAcao] = useState<AcaoVencimento>(a.sugestao === 'vende_a_tempo' ? 'destacar' : a.sugestao);
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setEnviando(true);
    setErro('');
    try {
      await aoDecidir(a, acao, obs);
      setAberta(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para salvar.');
    } finally {
      setEnviando(false);
    }
  }

  const urgente = a.diasParaVencer <= 7 && a.sobra > 0 && !a.tratado;
  return (
    <div className="item" style={{ display: 'block', opacity: a.tratado ? 0.75 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <strong>{a.nome}</strong>
          <div className="rotulo">
            SKU {a.sku} · {a.departamento} · lote {a.lote || 'sem lote'} · validade {diaMes(a.validade)}
          </div>
        </div>
        <span className={`selo ${a.tratado ? 'ativo' : urgente || a.diasParaVencer <= 0 ? 'repor_agora' : a.sobra > 0 ? 'parado' : 'pendente'}`}>
          {textoVencimento(a.diasParaVencer)}
        </span>
      </div>
      <div className="grade" style={{ marginTop: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
        <div><div className="rotulo">No estoque</div><strong>{a.quantidade} un</strong></div>
        <div><div className="rotulo">Vende até lá</div><strong>{a.vendeAte} un</strong> <span className="rotulo">({a.vendaMediaDia}/dia)</span></div>
        <div><div className="rotulo">Deve sobrar</div><strong>{a.sobra} un</strong></div>
        <div><div className="rotulo">Valor em risco</div><strong>{a.valorEmRisco === null ? '—' : reais(a.valorEmRisco)}</strong></div>
      </div>
      <p style={{ margin: '12px 0 4px', lineHeight: 1.5 }}>
        <strong>{NOME_ACAO[a.sugestao]}.</strong> {EXPLICA[a.sugestao]}
        {a.sugestao === 'devolver' && a.fornecedor ? ` Fornecedor: ${a.fornecedor}.` : ''}
      </p>
      <div className="rotulo" style={{ lineHeight: 1.6 }}>
        {a.caixas.map((c) => `${c.codigo} (${c.quantidade} un) em ${c.local}`).join(' · ')}
      </div>
      {a.tratado ? (
        <p className="aviso info" style={{ margin: '10px 0 0' }}>
          {a.tratado.por} decidiu <strong>{NOME_ACAO[a.tratado.acao].toLowerCase()}</strong> {quando(a.tratado.em)}
          {a.tratado.observacao ? `: ${a.tratado.observacao}` : '.'}
        </p>
      ) : null}
      {aberta ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div className="filtros" role="group" aria-label="O que fazer">
            {ACOES.map((x) => (
              <button key={x} type="button" aria-pressed={acao === x} onClick={() => setAcao(x)}>{NOME_ACAO[x]}</button>
            ))}
          </div>
          <input
            value={obs}
            maxLength={300}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Observação (opcional): 30% na ponta da R-02"
            style={{ minHeight: 44, borderRadius: 10, border: '1px solid #c9d2e0', padding: '0 12px' }}
          />
          {erro ? <p className="aviso erro" style={{ margin: 0 }}>{erro}</p> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="botao" disabled={enviando} onClick={salvar}>{enviando ? 'Salvando…' : 'Registrar decisão'}</button>
            <button className="botao secundario" onClick={() => setAberta(false)}>Cancelar</button>
          </div>
        </div>
      ) : a.sugestao !== 'vende_a_tempo' || a.tratado ? (
        <button className="botao secundario" style={{ marginTop: 12 }} onClick={() => setAberta(true)}>
          {a.tratado ? 'Mudar decisão' : 'Decidir o que fazer'}
        </button>
      ) : null}
    </div>
  );
}

/** Lotes perto de vencer: quanto deve sobrar pelo ritmo de venda, quanto dinheiro está em risco e o que fazer. */
export function Vencimento({ ctx }: { ctx: Contexto }) {
  const [janela, setJanela] = useState(45);
  const carregar = useCallback(() => ctx.api.alertasVencimento(janela), [ctx.api, janela]);
  const alertas = usarDados(carregar, ctx.aoSessaoCair);
  const [mostrarTodos, setMostrarTodos] = useState(false);

  async function decidir(a: AlertaVencimento, acao: AcaoVencimento, observacao: string) {
    try {
      await ctx.api.registrarAcaoVencimento({ sku: a.sku, lote: a.lote, validade: a.validade, acao, observacao: observacao.trim() || undefined });
    } catch (e) {
      if (e instanceof ErroApi && e.exigeNovoLogin) ctx.aoSessaoCair(e);
      throw e;
    }
    await alertas.recarregar();
  }

  const lista = alertas.dados?.alertas ?? [];
  const pendentes = lista.filter((a) => !a.tratado && a.sobra > 0);
  const visiveis = mostrarTodos ? lista : lista.filter((a) => a.sobra > 0 || a.tratado);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="grade">
        <section className="cartao"><div className="rotulo">Valor em risco</div><div className="numero">{reais(alertas.dados?.valorEmRisco ?? 0)}</div></section>
        <section className="cartao"><div className="rotulo">Lotes para decidir</div><div className="numero">{pendentes.length}</div></section>
        <section className="cartao"><div className="rotulo">Vencem em 7 dias</div><div className="numero">{pendentes.filter((a) => a.diasParaVencer <= 7).length}</div></section>
      </div>
      <section className="cartao">
        <div className="cabecalho" style={{ marginBottom: 12 }}>
          <p className="vazio" style={{ margin: 0, maxWidth: 640 }}>
            {ctx.papel === 'lider' ? 'Do departamento do seu setor.' : 'De todos os departamentos da loja.'} Pela validade das caixas etiquetadas e
            pelas vendas dos últimos 7 dias. A gôndola vende primeiro e os lotes saem pela validade.
          </p>
          <div className="filtros" role="group" aria-label="Janela">
            {JANELAS.map((d) => (
              <button key={d} aria-pressed={janela === d} onClick={() => setJanela(d)}>{d} dias</button>
            ))}
          </div>
        </div>
        {alertas.erro ? <p className="aviso erro">{alertas.erro}</p> : null}
        {alertas.dados && visiveis.length === 0 ? <p className="vazio">Nenhum lote em risco nos próximos {janela} dias.</p> : null}
        <div className="lista">
          {visiveis.map((a) => (
            <Linha key={`${a.sku}|${a.lote}|${a.validade}`} a={a} aoDecidir={decidir} />
          ))}
        </div>
        {lista.length > visiveis.length || mostrarTodos ? (
          <button className="botao secundario" style={{ marginTop: 12 }} onClick={() => setMostrarTodos(!mostrarTodos)}>
            {mostrarTodos ? 'Esconder os que vendem a tempo' : `Ver também ${lista.length - visiveis.length} que vendem a tempo`}
          </button>
        ) : null}
      </section>
    </div>
  );
}
