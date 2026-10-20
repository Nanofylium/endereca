import QRCode from 'qrcode';
import { FormEvent, useEffect, useState } from 'react';
import { ErroApi } from '../api';
import { Contexto } from '../contexto';
import { montarLocais } from '../etiquetas';
import { quando } from '../formatar';
import { EtiquetaLocal, EtiquetaVolume, TipoLocal } from '../tipos';
import { usarDados } from '../usarDados';

const TIPOS: { id: TipoLocal; nome: string }[] = [
  { id: 'venda', nome: 'Área de venda (R-)' },
  { id: 'deposito', nome: 'Depósito' },
  { id: 'caixaria', nome: 'Caixaria' },
  { id: 'gaveta', nome: 'Gaveta' },
  { id: 'intermedio', nome: 'Intermédio' },
  { id: 'aereo', nome: 'Aéreo' },
];

type Folha = { tipo: 'endereco'; itens: EtiquetaLocal[] } | { tipo: 'volume'; itens: EtiquetaVolume[] };

function Qr({ texto }: { texto: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(texto, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg);
  }, [texto]);
  // O SVG é gerado aqui mesmo a partir do código da etiqueta.
  return <div className="qr" role="img" aria-label={`QR Code ${texto}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

export function Etiquetas({ ctx }: { ctx: Contexto }) {
  const enderecos = usarDados(ctx.api.enderecos, ctx.aoSessaoCair);
  const aguardando = usarDados(ctx.api.volumesAguardando, ctx.aoSessaoCair);
  const [folha, setFolha] = useState<Folha | null>(null);
  const [falha, setFalha] = useState('');
  const [local, setLocal] = useState({ tipo: 'venda' as TipoLocal, rua: '', modulos: '', niveis: '', posicoes: '' });
  const [receb, setReceb] = useState({ produto: '', quantidade: '', volumes: '1', lote: '', validade: '' });
  const [enviando, setEnviando] = useState(false);

  async function executar(acao: () => Promise<void>) {
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

  function criarEnderecos(ev: FormEvent) {
    ev.preventDefault();
    executar(async () => {
      const itens = await ctx.api.criarEnderecos(montarLocais(local.tipo, local.rua, local.modulos, local.niveis, local.posicoes));
      setFolha({ tipo: 'endereco', itens });
      await enderecos.recarregar();
    });
  }

  function receber(ev: FormEvent) {
    ev.preventDefault();
    executar(async () => {
      const itens = await ctx.api.receberVolumes({
        produto: receb.produto.trim(),
        quantidade: Number(receb.quantidade),
        volumes: Number(receb.volumes) || 1,
        lote: receb.lote.trim() || undefined,
        validade: receb.validade || undefined,
      });
      setFolha({ tipo: 'volume', itens });
      setReceb({ produto: '', quantidade: '', volumes: '1', lote: '', validade: '' });
      await aguardando.recarregar();
    });
  }

  return (
    <>
      <p className="aviso info" style={{ margin: 0 }}>
        Cada lugar da loja recebe uma etiqueta fixa de endereço. Cada caixa ou palete recebe uma etiqueta de volume na chegada. Para endereçar, o
        repositor bipa o volume no app e depois o endereço onde guardou. Os produtos vêm do catálogo do ERP pelo EAN.
      </p>
      {falha ? <p className="aviso erro" style={{ margin: 0 }}>{falha}</p> : null}

      <div className="grade-larga">
        <form className="cartao formulario" onSubmit={criarEnderecos}>
          <h2>Etiquetas de endereço</h2>
          <label>
            Tipo de lugar
            <select value={local.tipo} onChange={(e) => setLocal({ ...local, tipo: e.target.value as TipoLocal })}>
              {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>
          <label>
            Rua
            <input required value={local.rua} onChange={(e) => setLocal({ ...local, rua: e.target.value })} placeholder="R-07 ou Rua B" />
          </label>
          <div className="campos-linha">
            <label>Módulos<input value={local.modulos} onChange={(e) => setLocal({ ...local, modulos: e.target.value })} placeholder="1-10" /></label>
            <label>Níveis<input value={local.niveis} onChange={(e) => setLocal({ ...local, niveis: e.target.value })} placeholder="1-4" /></label>
            <label>Posições<input value={local.posicoes} onChange={(e) => setLocal({ ...local, posicoes: e.target.value })} placeholder="opcional" /></label>
          </div>
          <p className="rotulo" style={{ margin: 0 }}>Use faixas como 1-10 ou listas como 1,3,5. Gera uma etiqueta para cada combinação.</p>
          <button className="botao" disabled={enviando}>Gerar etiquetas</button>
        </form>

        <form className="cartao formulario" onSubmit={receber}>
          <h2>Recebimento: etiquetas de volume</h2>
          <label>
            Produto (EAN ou SKU)
            <input required value={receb.produto} onChange={(e) => setReceb({ ...receb, produto: e.target.value })} placeholder="7890000000011" />
          </label>
          <div className="campos-linha">
            <label>Unidades por volume<input required type="number" min={1} value={receb.quantidade} onChange={(e) => setReceb({ ...receb, quantidade: e.target.value })} /></label>
            <label>Volumes<input required type="number" min={1} max={200} value={receb.volumes} onChange={(e) => setReceb({ ...receb, volumes: e.target.value })} /></label>
          </div>
          <div className="campos-linha">
            <label>Lote<input value={receb.lote} onChange={(e) => setReceb({ ...receb, lote: e.target.value })} placeholder="opcional" /></label>
            <label>Validade<input type="date" value={receb.validade} onChange={(e) => setReceb({ ...receb, validade: e.target.value })} /></label>
          </div>
          <button className="botao principal" disabled={enviando}>Gerar etiquetas de volume</button>
        </form>
      </div>

      {folha ? (
        <section className="cartao">
          <div className="cabecalho" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>{folha.itens.length} etiqueta{folha.itens.length > 1 ? 's' : ''} para imprimir</h2>
            <div className="filtros">
              <button className="botao" onClick={() => window.print()}>Imprimir</button>
              <button className="botao secundario" onClick={() => setFolha(null)}>Fechar</button>
            </div>
          </div>
          <div className="folha">
            {folha.tipo === 'endereco'
              ? folha.itens.map((l) => (
                  <div className="etiqueta" key={l.codigo}>
                    <Qr texto={l.qr} />
                    <div>
                      <span className="etiqueta-tipo">{l.nomeTipo}</span>
                      <strong>{l.descricao}</strong>
                      <span className="etiqueta-codigo">{l.codigo}</span>
                    </div>
                  </div>
                ))
              : folha.itens.map((v) => (
                  <div className="etiqueta" key={v.codigo}>
                    <Qr texto={v.qr} />
                    <div>
                      <span className="etiqueta-tipo">Volume · SKU {v.sku}</span>
                      <strong>{v.produto}</strong>
                      <span>{v.quantidade} un.{v.lote ? ` · lote ${v.lote}` : ''}{v.validade ? ` · val. ${dataBr(v.validade)}` : ''}</span>
                      <span className="etiqueta-codigo">{v.codigo}</span>
                    </div>
                  </div>
                ))}
          </div>
        </section>
      ) : null}

      <div className="grade-larga">
        <section className="cartao">
          <h2>Volumes esperando endereço</h2>
          {aguardando.erro ? <p className="aviso erro">{aguardando.erro}</p> : null}
          {aguardando.dados?.length === 0 ? <p className="vazio">Tudo recebido já foi guardado.</p> : null}
          <div className="lista">
            {aguardando.dados?.map((v) => (
              <div className="item" key={v.codigo}>
                <div>
                  <strong>{v.produto}</strong>
                  <div className="rotulo">{v.quantidade} un. · recebido {quando(v.recebidoEm)} · {v.codigo}</div>
                </div>
                <button className="botao secundario" onClick={() => setFolha({ tipo: 'volume', itens: [v] })}>Reimprimir</button>
              </div>
            ))}
          </div>
        </section>
        <section className="cartao">
          <h2>Endereços com etiqueta ({enderecos.dados?.length ?? 0})</h2>
          {enderecos.erro ? <p className="aviso erro">{enderecos.erro}</p> : null}
          {enderecos.dados?.length === 0 ? <p className="vazio">Nenhum endereço etiquetado ainda.</p> : null}
          <div className="lista">
            {enderecos.dados?.slice(0, 50).map((l) => (
              <div className="item" key={l.codigo}>
                <div>
                  <strong>{l.descricao}</strong>
                  <div className="rotulo">{l.nomeTipo} · {l.codigo}</div>
                </div>
                <button className="botao secundario" onClick={() => setFolha({ tipo: 'endereco', itens: [l] })}>Reimprimir</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
