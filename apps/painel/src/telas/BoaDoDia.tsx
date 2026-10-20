import { FormEvent, useCallback, useState } from 'react';
import { ErroApi } from '../api';
import { Contexto } from '../contexto';
import { candidatosTarefa, NOME_SITUACAO_TAREFA, quando } from '../formatar';
import { MembroEquipe, Tarefa } from '../tipos';
import { usarDados } from '../usarDados';

const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const CLASSE_SITUACAO = { aguardando_lider: 'pendente', atribuida: 'parado', concluida: 'ativo', sem_produto: 'bloqueado' } as const;

export function BoaDoDia({ ctx }: { ctx: Contexto }) {
  const gerente = ctx.papel !== 'lider';
  const [dia, setDia] = useState(hoje);
  const carregarTarefas = useCallback(() => ctx.api.tarefas(dia), [ctx.api, dia]);
  const tarefas = usarDados(carregarTarefas, ctx.aoSessaoCair);
  const equipe = usarDados(ctx.api.equipe, ctx.aoSessaoCair);
  const faltas = usarDados(ctx.api.faltas, ctx.aoSessaoCair);
  const [nova, setNova] = useState({ produto: '', setor: '', instrucoes: '' });
  const [falha, setFalha] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function executar(acao: () => Promise<unknown>) {
    setFalha('');
    setEnviando(true);
    try {
      await acao();
    } catch (e) {
      if (e instanceof ErroApi && e.exigeNovoLogin) ctx.aoSessaoCair(e);
      else setFalha(e instanceof Error ? e.message : 'Não deu certo.');
    } finally {
      setEnviando(false);
    }
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    executar(async () => {
      await ctx.api.enviarBoaDoDia({
        produto: nova.produto.trim(),
        setor: nova.setor.trim() || undefined,
        dia,
        instrucoes: nova.instrucoes.trim() || undefined,
      });
      setNova({ produto: '', setor: '', instrucoes: '' });
      await tarefas.recarregar();
    });
  }

  const atribuir = (t: Tarefa, matricula: string) =>
    executar(async () => {
      await ctx.api.atribuirTarefa(t.id, matricula);
      await tarefas.recarregar();
    });

  const resolver = (id: string) =>
    executar(async () => {
      await ctx.api.resolverFalta(id);
      await faltas.recarregar();
    });

  return (
    <>
      <p className="aviso info" style={{ margin: 0 }}>
        {gerente
          ? 'Escolha o produto da Boa do Dia e o setor. O líder do setor recebe o aviso e decide quem vai preparar.'
          : 'O gerente operacional escolhe a Boa do Dia. Você decide quem da sua equipe vai preparar; a pessoa recebe a tarefa no app.'}
      </p>
      {falha ? <p className="aviso erro" style={{ margin: 0 }}>{falha}</p> : null}

      <div className="grade-larga">
        {gerente ? (
          <form className="cartao formulario" onSubmit={enviar}>
            <h2>Enviar Boa do Dia</h2>
            <label>
              Produto (EAN ou SKU)
              <input required value={nova.produto} onChange={(e) => setNova({ ...nova, produto: e.target.value })} placeholder="7890000000011" />
            </label>
            <div className="campos-linha">
              <label>
                Setor
                <input value={nova.setor} onChange={(e) => setNova({ ...nova, setor: e.target.value })} placeholder="o do produto" />
              </label>
              <label>
                Dia
                <input type="date" required value={dia} onChange={(e) => setDia(e.target.value)} />
              </label>
            </div>
            <label>
              Instruções para a equipe
              <input value={nova.instrucoes} onChange={(e) => setNova({ ...nova, instrucoes: e.target.value })} placeholder="Ex.: ponta de gôndola da entrada, com cartaz" />
            </label>
            <button className="botao principal" disabled={enviando}>Enviar para o líder</button>
          </form>
        ) : (
          <section className="cartao formulario">
            <h2>Dia</h2>
            <label>
              Ver as tarefas de
              <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
            </label>
          </section>
        )}
      </div>

      <section className="cartao">
        <h2>Boa do Dia {dia === hoje() ? 'de hoje' : `de ${dia.split('-').reverse().join('/')}`}</h2>
        {tarefas.erro ? <p className="aviso erro">{tarefas.erro}</p> : null}
        {tarefas.dados?.length === 0 ? <p className="vazio">{gerente ? 'Nenhuma Boa do Dia enviada para este dia.' : 'Nenhuma Boa do Dia para o seu setor neste dia.'}</p> : null}
        <div className="lista">
          {tarefas.dados?.map((t) => (
            <CartaoTarefa key={t.id} tarefa={t} equipe={equipe.dados ?? []} ctx={ctx} enviando={enviando} aoAtribuir={atribuir} />
          ))}
        </div>
      </section>

      <section className="cartao">
        <h2>Faltas na gôndola</h2>
        <p className="vazio" style={{ marginTop: 0 }}>
          Quando não há produto para escanear, o repositor toca em "Não tem na gôndola". As faltas sem estoque na loja aparecem primeiro: peça reposição.
        </p>
        {faltas.erro ? <p className="aviso erro">{faltas.erro}</p> : null}
        {faltas.dados?.length === 0 ? <p className="vazio">Nenhuma falta aberta.</p> : null}
        <div className="lista">
          {faltas.dados?.map((f) => (
            <div className="item" key={f.id}>
              <div>
                <strong>{f.produto}</strong>{' '}
                <span className={`selo ${f.estoque === 0 ? 'bloqueado' : 'parado'}`}>{f.estoque === 0 ? 'Sem estoque na loja' : `${f.estoque} un. no estoque`}</span>
                <div className="rotulo">
                  {f.departamento} · avisado por {f.reportadoPorNome ?? f.reportadoPor}, {quando(f.reportadoEm)}
                  {f.observacao ? ` · "${f.observacao}"` : ''}
                </div>
              </div>
              <button className="botao secundario" disabled={enviando} onClick={() => resolver(f.id)}>Resolvida</button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function CartaoTarefa(props: { tarefa: Tarefa; equipe: MembroEquipe[]; ctx: Contexto; enviando: boolean; aoAtribuir: (t: Tarefa, matricula: string) => void }) {
  const t = props.tarefa;
  const candidatos = candidatosTarefa(props.equipe, t.setor, props.ctx.papel, props.ctx.matricula);
  const [escolhido, setEscolhido] = useState('');
  const fechada = t.situacao === 'concluida' || t.situacao === 'sem_produto';

  return (
    <div className="item" style={{ alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0, flex: '1 1 280px' }}>
        <span className={`selo ${CLASSE_SITUACAO[t.situacao]}`}>{NOME_SITUACAO_TAREFA[t.situacao]}</span>
        <div style={{ marginTop: 6 }}>
          <strong>{t.produto}</strong> <span className="rotulo">· {t.setor} · SKU {t.sku}</span>
        </div>
        <div className="rotulo">
          {t.enderecoVenda ? `Gôndola ${t.enderecoVenda.descricao}` : 'Sem endereço na área de venda'}
          {' · '}
          {t.estoque.length ? `estoque em ${t.estoque.map((e) => `${e.descricao} (${e.quantidade ?? '?'} un.)`).join(', ')}` : 'sem estoque registrado'}
        </div>
        {t.instrucoes ? <div className="rotulo">Instruções: {t.instrucoes}</div> : null}
        {t.responsavel ? (
          <div className="rotulo">
            Com {t.responsavel.nome}
            {t.concluidaEm ? `, encerrada ${quando(t.concluidaEm)}` : t.atribuidaEm ? `, desde ${quando(t.atribuidaEm)}` : ''}
            {t.observacao ? ` · "${t.observacao}"` : ''}
          </div>
        ) : null}
      </div>
      {!fechada ? (
        <div className="filtros" style={{ alignItems: 'center' }}>
          <select
            aria-label={`Quem vai preparar ${t.produto}`}
            className="selecao"
            value={escolhido || t.responsavel?.matricula || ''}
            onChange={(e) => setEscolhido(e.target.value)}
          >
            <option value="">Escolha quem faz</option>
            {candidatos.map((m) => (
              <option key={m.matricula} value={m.matricula}>
                {m.nome}
                {m.matricula === props.ctx.matricula ? ' (eu)' : ''}
              </option>
            ))}
          </select>
          <button
            className="botao"
            disabled={props.enviando || !escolhido || escolhido === t.responsavel?.matricula}
            onClick={() => props.aoAtribuir(t, escolhido)}
          >
            {t.responsavel ? 'Trocar' : 'Passar a tarefa'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
