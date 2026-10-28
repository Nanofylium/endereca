import { Contexto } from '../contexto';
import { quando } from '../formatar';
import { usarDados } from '../usarDados';

/** Quem está treinando, em que nível está e quantas lições já fez. */
export function Treinamento({ ctx }: { ctx: Contexto }) {
  const equipe = usarDados(ctx.api.treinoEquipe, ctx.aoSessaoCair);

  return (
    <section className="cartao">
      <h2>Treinamento dos repositores</h2>
      <p className="vazio" style={{ marginTop: 0 }}>
        {ctx.papel === 'lider' ? 'Da sua equipe.' : 'De todos os setores da loja.'} Cada um faz as lições e o desafio "ache o produto" no celular.
        Quem não abre o treino há dias merece uma conversa; quem está perto de "Pronto para liderar" merece ser visto.
      </p>
      {equipe.erro ? <p className="aviso erro">{equipe.erro}</p> : null}
      {equipe.dados && equipe.dados.length === 0 ? <p className="vazio">Nenhum repositor ativo.</p> : null}
      {equipe.dados?.length ? (
        <div className="tabela-caixa">
          <table className="tabela">
            <thead>
              <tr><th>Repositor</th><th>Setor</th><th>Nível</th><th>Pontos</th><th>Lições</th><th>Última atividade</th></tr>
            </thead>
            <tbody>
              {[...equipe.dados]
                .sort((a, b) => b.pontos - a.pontos)
                .map((p) => (
                  <tr key={p.matricula}>
                    <td><strong>{p.nome}</strong><div className="rotulo">Matrícula {p.matricula}</div></td>
                    <td>{p.setor ?? '—'}</td>
                    <td>{p.nivel}</td>
                    <td>{p.pontos}</td>
                    <td>{p.licoesConcluidas} de {p.licoesTotal}</td>
                    <td>{quando(p.ultimaAtividade)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
