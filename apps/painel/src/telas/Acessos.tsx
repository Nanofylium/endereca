import { useState } from 'react';
import { ErroApi } from '../api';
import { Contexto } from '../contexto';
import { NOME_PAPEL, quando, textoMotivo } from '../formatar';
import { CodigoGerado } from '../tipos';
import { usarDados } from '../usarDados';

export function Acessos({ ctx }: { ctx: Contexto }) {
  const pendentes = usarDados(ctx.api.equipe, ctx.aoSessaoCair);
  const recusadas = usarDados(ctx.api.tentativasRecusadas, ctx.aoSessaoCair);
  const [gerados, setGerados] = useState<Record<string, CodigoGerado>>({});
  const [erro, setErro] = useState('');

  const liberaveis = (pendentes.dados ?? []).filter((m) => m.situacao === 'pendente' && m.podeLiberar);

  async function gerar(matricula: string) {
    setErro('');
    try {
      const codigo = await ctx.api.gerarCodigo(matricula);
      setGerados((atual) => ({ ...atual, [matricula]: codigo }));
    } catch (e) {
      if (e instanceof ErroApi && e.exigeNovoLogin) ctx.aoSessaoCair(e);
      else setErro(e instanceof Error ? e.message : 'Não foi possível gerar o código.');
    }
  }

  return (
    <div className="grade-larga" style={{ alignItems: 'start' }}>
      <section className="cartao" style={{ gridColumn: '1 / -1' }}>
        <h2>Liberar primeiro acesso</h2>
        <p className="aviso info" style={{ margin: '0 0 12px' }}>
          Só aparece quem já veio do cadastro do RH. Gere o código e entregue pessoalmente: ele vale por 24 horas, só uma vez,
          e só para aquela matrícula. Gerar de novo cancela o anterior.
        </p>
        {erro ? <p className="aviso erro">{erro}</p> : null}
        {pendentes.dados && liberaveis.length === 0 ? <p className="vazio">Ninguém aguardando liberação.</p> : null}
        <div className="lista">
          {liberaveis.map((m) => {
            const gerado = gerados[m.matricula];
            return (
              <div className="item" key={m.matricula}>
                <div>
                  <strong>{m.nome}</strong>
                  <div className="rotulo">
                    Matrícula {m.matricula} · {NOME_PAPEL[m.papel]}
                    {m.setor ? ` · ${m.setor}` : ''}
                    {m.codigoValidoAte && !gerado ? ` · já tem código válido até ${quando(m.codigoValidoAte)}` : ''}
                  </div>
                </div>
                {gerado ? (
                  <div style={{ textAlign: 'right' }}>
                    <div className="codigo" aria-label={`Código ${gerado.codigo.split('').join(' ')}`}>{gerado.codigo}</div>
                    <div className="rotulo">Uso único · vale até {quando(gerado.expiraEm)}</div>
                  </div>
                ) : (
                  <button className="botao" onClick={() => gerar(m.matricula)}>
                    {m.codigoValidoAte ? 'Gerar novo código' : 'Gerar código'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="cartao" style={{ gridColumn: '1 / -1' }}>
        <h2>Tentativas recusadas hoje</h2>
        {recusadas.erro ? <p className="aviso erro">{recusadas.erro}</p> : null}
        {recusadas.dados && recusadas.dados.length === 0 ? <p className="vazio">Nenhuma tentativa recusada hoje.</p> : null}
        {recusadas.dados?.length ? (
          <div className="tabela-caixa">
            <table className="tabela">
              <thead>
                <tr><th>Quando</th><th>Matrícula</th><th>Motivo</th><th>Aparelho</th></tr>
              </thead>
              <tbody>
                {recusadas.dados.map((t, i) => (
                  <tr key={i}>
                    <td>{quando(t.criado_em)}</td>
                    <td>{t.matricula}</td>
                    <td>{textoMotivo(t.motivo)}</td>
                    <td>{t.aparelho_id ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
