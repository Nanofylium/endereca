import { Contexto } from '../contexto';
import { usarDados } from '../usarDados';

/** Visão do gerente operacional: um cartão por setor da loja. */
export function Setores({ ctx }: { ctx: Contexto }) {
  const { dados, erro } = usarDados(ctx.api.setores, ctx.aoSessaoCair);
  return (
    <>
      {erro ? <p className="aviso erro">{erro}</p> : null}
      {dados && dados.length === 0 ? <p className="vazio">Nenhum setor com equipe cadastrada pelo RH.</p> : null}
      <div className="grade-larga">
        {dados?.map((s) => (
          <section className="cartao" key={s.setor}>
            <h2 style={{ fontSize: 18 }}>{s.setor}</h2>
            <div className="rotulo" style={{ marginBottom: 12 }}>
              {s.lideres.length ? `Líder: ${s.lideres.join(', ')}` : 'Sem líder cadastrado'}
            </div>
            <div className="grade" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <div><div className="rotulo">Equipe</div><div className="numero">{s.total}</div></div>
              <div><div className="rotulo">Usando o app</div><div className="numero">{s.ativos}</div></div>
              <div><div className="rotulo">Aguardando acesso</div><div className="numero">{s.pendentes}</div></div>
              <div>
                <div className="rotulo">Produtos em alerta</div>
                <div className="numero" style={{ color: s.produtosEmAlerta ? 'var(--laranja-texto)' : undefined }}>{s.produtosEmAlerta}</div>
              </div>
            </div>
            {s.bloqueados ? <p className="aviso erro" style={{ margin: '12px 0 0' }}>{s.bloqueados} pessoa(s) bloqueada(s) por tentativas erradas.</p> : null}
          </section>
        ))}
      </div>
    </>
  );
}
