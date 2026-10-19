import { useState } from 'react';
import { ErroApi } from '../api';
import { Contexto } from '../contexto';
import { quando } from '../formatar';
import { usarDados } from '../usarDados';

export function Aparelhos({ ctx }: { ctx: Contexto }) {
  const { dados, erro, recarregar } = usarDados(ctx.api.aparelhos, ctx.aoSessaoCair);
  const [falha, setFalha] = useState('');

  async function alternar(id: string, bloquear: boolean) {
    if (bloquear && !window.confirm('Bloquear este aparelho? Quem estiver usando sai na hora.')) return;
    setFalha('');
    try {
      await ctx.api.bloquearAparelho(id, bloquear);
      await recarregar();
    } catch (e) {
      if (e instanceof ErroApi && e.exigeNovoLogin) ctx.aoSessaoCair(e);
      else setFalha(e instanceof Error ? e.message : 'Não foi possível alterar o aparelho.');
    }
  }

  return (
    <section className="cartao">
      <h2>Aparelhos autorizados da loja</h2>
      <p className="aviso info" style={{ margin: '0 0 12px' }}>
        Celular perdido ou roubado? Bloqueie aqui: todas as sessões abertas nele caem na hora. Novos aparelhos são cadastrados pela TI.
      </p>
      {erro || falha ? <p className="aviso erro">{erro || falha}</p> : null}
      {dados && dados.length === 0 ? <p className="vazio">Nenhum aparelho cadastrado.</p> : null}
      {dados?.length ? (
        <div className="tabela-caixa">
          <table className="tabela">
            <thead>
              <tr><th>Aparelho</th><th>Identificador</th><th>Último uso</th><th>Situação</th><th></th></tr>
            </thead>
            <tbody>
              {dados.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.descricao}</strong></td>
                  <td>{a.id}</td>
                  <td>{quando(a.ultimo_uso)}</td>
                  <td>
                    <span className={`selo ${a.ativo ? 'ativo' : 'bloqueado'}`}>{a.ativo ? 'Autorizado' : 'Bloqueado'}</span>
                    {!a.ativo && a.bloqueado_por ? <div className="rotulo">por {a.bloqueado_por}, {quando(a.bloqueado_em)}</div> : null}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className={a.ativo ? 'botao perigo' : 'botao secundario'} onClick={() => alternar(a.id, a.ativo)}>
                      {a.ativo ? 'Bloquear' : 'Desbloquear'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
