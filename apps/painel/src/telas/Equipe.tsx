import { useState } from 'react';
import { Contexto } from '../contexto';
import { iniciais, NOME_PAPEL, NOME_SITUACAO, quando } from '../formatar';
import { Situacao } from '../tipos';
import { usarDados } from '../usarDados';

const FILTROS: [Situacao | 'todos', string][] = [
  ['todos', 'Todos'],
  ['ativo', 'Ativos'],
  ['pendente', 'Aguardando acesso'],
  ['bloqueado', 'Bloqueados'],
];

export function Equipe({ ctx }: { ctx: Contexto }) {
  const { dados, erro, carregando } = usarDados(ctx.api.equipe, ctx.aoSessaoCair);
  const [filtro, setFiltro] = useState<Situacao | 'todos'>('todos');
  const lista = (dados ?? []).filter((m) => filtro === 'todos' || m.situacao === filtro);
  const contar = (s: Situacao) => (dados ?? []).filter((m) => m.situacao === s).length;

  return (
    <>
      <div className="grade">
        <div className="cartao"><div className="rotulo">Na equipe</div><div className="numero">{dados?.length ?? '—'}</div></div>
        <div className="cartao"><div className="rotulo">Usando o app</div><div className="numero">{dados ? contar('ativo') : '—'}</div></div>
        <div className="cartao"><div className="rotulo">Aguardando primeiro acesso</div><div className="numero">{dados ? contar('pendente') : '—'}</div></div>
        <div className="cartao"><div className="rotulo">Bloqueados agora</div><div className="numero" style={{ color: 'var(--laranja-texto)' }}>{dados ? contar('bloqueado') : '—'}</div></div>
      </div>
      <section className="cartao">
        <div className="filtros" role="group" aria-label="Filtrar equipe">
          {FILTROS.map(([valor, rotulo]) => (
            <button key={valor} aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>
              {rotulo}
            </button>
          ))}
        </div>
        {erro ? <p className="aviso erro">{erro}</p> : null}
        {carregando && !dados ? <p className="vazio">Carregando…</p> : null}
        {dados && lista.length === 0 ? <p className="vazio">Ninguém nesta situação.</p> : null}
        {lista.length ? (
          <div className="tabela-caixa">
            <table className="tabela">
              <thead>
                <tr><th>Pessoa</th><th>Matrícula</th><th>Papel</th><th>Setor</th><th>Situação</th><th>Último acesso</th></tr>
              </thead>
              <tbody>
                {lista.map((m) => (
                  <tr key={m.matricula}>
                    <td><span className="pessoa"><span className="avatar" aria-hidden="true">{iniciais(m.nome)}</span>{m.nome}</span></td>
                    <td>{m.matricula}</td>
                    <td>{NOME_PAPEL[m.papel]}</td>
                    <td>{m.setor ?? '—'}</td>
                    <td><span className={`selo ${m.situacao}`}>{NOME_SITUACAO[m.situacao]}</span></td>
                    <td>{quando(m.ultimoAcesso)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}
