import { Contexto } from '../contexto';
import { quando } from '../formatar';
import { usarDados } from '../usarDados';

const ROTULO = { repor_agora: 'Repor agora', parado: 'Parado', ok: 'Abastecido', sem_dados: 'Sem dados' } as const;

export function Alertas({ ctx }: { ctx: Contexto }) {
  const produtos = usarDados(ctx.api.produtosEmAlerta, ctx.aoSessaoCair);
  const avisos = usarDados(ctx.api.avisos, ctx.aoSessaoCair);

  return (
    <div className="grade-larga" style={{ alignItems: 'start' }}>
      <section className="cartao" style={{ gridColumn: '1 / -1' }}>
        <h2>Produtos que pedem atenção</h2>
        <p className="vazio" style={{ marginTop: 0 }}>
          {ctx.papel === 'lider' ? 'Do departamento do seu setor.' : 'De todos os departamentos da loja.'} Calculado pelas vendas dos últimos 7 dias e pela
          quantidade na gôndola.
        </p>
        {produtos.erro ? <p className="aviso erro">{produtos.erro}</p> : null}
        {produtos.dados && produtos.dados.length === 0 ? <p className="vazio">Nenhum produto parado ou prestes a faltar.</p> : null}
        {produtos.dados?.length ? (
          <div className="tabela-caixa">
            <table className="tabela">
              <thead>
                <tr><th>Produto</th><th>Departamento</th><th>Área de venda</th><th>Situação</th><th>O que fazer</th></tr>
              </thead>
              <tbody>
                {produtos.dados.map((p) => (
                  <tr key={p.sku}>
                    <td><strong>{p.nome}</strong><div className="rotulo">SKU {p.sku}</div></td>
                    <td>{p.departamento}</td>
                    <td>{p.enderecoVenda ?? '—'}</td>
                    <td><span className={`selo ${p.previsao.alerta}`}>{ROTULO[p.previsao.alerta]}</span></td>
                    <td>{p.previsao.mensagem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="cartao">
        <h2>Avisos da loja</h2>
        {avisos.dados && avisos.dados.length === 0 ? <p className="vazio">Nenhum aviso.</p> : null}
        <div className="lista">
          {avisos.dados?.map((a) => (
            <div className="item" key={a.id} style={{ display: 'block' }}>
              <div style={{ fontWeight: 600, lineHeight: 1.4 }}>{a.texto}</div>
              <div className="rotulo">{quando(a.criado_em)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
