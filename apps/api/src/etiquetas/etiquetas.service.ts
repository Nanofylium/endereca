import { HttpStatus, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ErroAcesso } from '../auth/acesso.service';
import { SessaoAtual } from '../auth/tipos';
import { DbService, Executor } from '../db/db.service';
import { interpretarCodigoLido } from '../produtos/indicadores';
import { conteudoQrLocal, conteudoQrVolume, descreverLocal, interpretarEtiqueta, NOME_TIPO, novoCodigo } from './codigos';
import { CriarLocaisDto, ReceberVolumesDto } from './etiquetas.dto';

interface LinhaLocal {
  id: string;
  codigo: string;
  tipo: string;
  rua: string;
  modulo: string | null;
  nivel: string | null;
  posicao: string | null;
}

interface LinhaVolume {
  id: string;
  codigo: string;
  loja_id: string;
  sku: string;
  nome: string;
  quantidade: number;
  lote: string | null;
  validade: string | null;
  recebido_em: Date;
  local_id: string | null;
  guardado_em: Date | null;
  guardado_por: string | null;
}

export interface EtiquetaLocal {
  codigo: string;
  qr: string;
  tipo: string;
  nomeTipo: string;
  descricao: string;
}

export interface EtiquetaVolume {
  codigo: string;
  qr: string;
  sku: string;
  produto: string;
  quantidade: number;
  lote: string | null;
  validade: string | null;
  recebidoEm: Date;
  guardado: { local: EtiquetaLocal; em: Date; por: string | null } | null;
}

const COLUNAS_LOCAL = 'id, codigo, tipo, rua, modulo, nivel, posicao';
const SELECT_VOLUME = `SELECT v.id, v.codigo, v.loja_id, v.sku, p.nome, v.quantidade, v.lote, v.validade, v.recebido_em, v.local_id, v.guardado_em, v.guardado_por
  FROM volumes v JOIN produtos p ON p.sku = v.sku`;

const etiquetaLocal = (l: LinhaLocal): EtiquetaLocal => ({
  codigo: l.codigo,
  qr: conteudoQrLocal(l.codigo),
  tipo: l.tipo,
  nomeTipo: NOME_TIPO[l.tipo] ?? l.tipo,
  descricao: descreverLocal(l),
});

const vazioParaNulo = (v?: string) => (v?.trim() ? v.trim() : null);

@Injectable()
export class EtiquetasService {
  constructor(
    private readonly db: DbService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Cria as etiquetas de endereço. Um endereço que já existe devolve a mesma etiqueta, para reimprimir. */
  async criarLocais(sessao: SessaoAtual, dados: CriarLocaisDto): Promise<EtiquetaLocal[]> {
    const linhas: LinhaLocal[] = [];
    for (const l of dados.locais) {
      const valores = [sessao.loja, l.tipo, l.rua.trim(), vazioParaNulo(l.modulo), vazioParaNulo(l.nivel), vazioParaNulo(l.posicao)];
      await this.db.query(
        `INSERT INTO locais (codigo, loja_id, tipo, rua, modulo, nivel, posicao, criado_por) VALUES ($7, $1, $2, $3, $4, $5, $6, $8)
         ON CONFLICT (loja_id, tipo, rua, (COALESCE(modulo, '')), (COALESCE(nivel, '')), (COALESCE(posicao, ''))) DO NOTHING`,
        [...valores, novoCodigo(), sessao.sub],
      );
      const [linha] = await this.db.query<LinhaLocal>(
        `SELECT ${COLUNAS_LOCAL} FROM locais WHERE loja_id = $1 AND tipo = $2 AND rua = $3
           AND modulo IS NOT DISTINCT FROM $4 AND nivel IS NOT DISTINCT FROM $5 AND posicao IS NOT DISTINCT FROM $6`,
        valores,
      );
      linhas.push(linha);
    }
    await this.auditoria.registrar({ autor: sessao.sub, acao: 'etiquetas.enderecos', lojaId: sessao.loja, aparelhoId: sessao.ap, detalhes: { total: linhas.length } });
    return linhas.map(etiquetaLocal);
  }

  async listarLocais(sessao: SessaoAtual, tipo?: string): Promise<EtiquetaLocal[]> {
    const linhas = await this.db.query<LinhaLocal>(
      `SELECT ${COLUNAS_LOCAL} FROM locais WHERE loja_id = $1 AND ($2::text IS NULL OR tipo = $2)
       ORDER BY tipo, rua, modulo NULLS FIRST, nivel NULLS FIRST, posicao NULLS FIRST`,
      [sessao.loja, tipo || null],
    );
    return linhas.map(etiquetaLocal);
  }

  /** Recebimento: uma etiqueta para cada caixa ou palete que chegou. */
  async receberVolumes(sessao: SessaoAtual, dados: ReceberVolumesDto): Promise<EtiquetaVolume[]> {
    const sku = await this.skuDoProduto(dados.produto);
    const lote = vazioParaNulo(dados.lote);
    const validade = dados.validade ?? null;
    const criados = await this.db.transacao(async (cliente) => {
      const ids: string[] = [];
      for (let i = 0; i < (dados.volumes ?? 1); i++) {
        const [v] = await this.db.query<{ id: string }>(
          `INSERT INTO volumes (codigo, loja_id, sku, quantidade, lote, validade, recebido_por) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [novoCodigo(), sessao.loja, sku, dados.quantidade, lote, validade, sessao.sub],
          cliente,
        );
        ids.push(v.id);
      }
      // O lote recebido passa a aparecer na ficha do produto.
      if (lote) {
        await this.db.query(
          `INSERT INTO lotes_produto (sku, loja_id, lote, validade)
           SELECT $1, $2, $3, $4 WHERE NOT EXISTS (SELECT 1 FROM lotes_produto WHERE sku = $1 AND loja_id = $2 AND lote = $3)`,
          [sku, sessao.loja, lote, validade],
          cliente,
        );
      }
      return this.db.query<LinhaVolume>(`${SELECT_VOLUME} WHERE v.id = ANY($1::bigint[]) ORDER BY v.id`, [ids], cliente);
    });
    await this.auditoria.registrar({
      autor: sessao.sub,
      acao: 'etiquetas.volumes',
      lojaId: sessao.loja,
      aparelhoId: sessao.ap,
      detalhes: { sku, volumes: criados.length, quantidade: dados.quantidade },
    });
    return criados.map((v) => this.etiquetaVolume(v, null));
  }

  /** Volumes recebidos que ainda não foram bipados num endereço. */
  async aguardando(sessao: SessaoAtual): Promise<EtiquetaVolume[]> {
    const linhas = await this.db.query<LinhaVolume>(`${SELECT_VOLUME} WHERE v.loja_id = $1 AND v.local_id IS NULL ORDER BY v.recebido_em, v.id LIMIT 200`, [
      sessao.loja,
    ]);
    return linhas.map((v) => this.etiquetaVolume(v, null));
  }

  /** Diz o que foi bipado: um endereço (com o que está guardado nele), um volume ou um produto. */
  async ler(sessao: SessaoAtual, lido: string) {
    const codigo = interpretarEtiqueta(lido);
    if (codigo.tipo === 'endereco') {
      const local = await this.localPorCodigo(sessao.loja, codigo.codigo);
      const produtos = await this.db.query<{ sku: string; nome: string; quantidade: number | null; confirmado_em: Date | null }>(
        `SELECT e.sku, p.nome, e.quantidade, e.confirmado_em FROM enderecos_produto e JOIN produtos p ON p.sku = e.sku
         WHERE e.loja_id = $1 AND e.tipo = $2 AND e.rua = $3
           AND e.modulo IS NOT DISTINCT FROM $4 AND e.nivel IS NOT DISTINCT FROM $5 AND e.posicao IS NOT DISTINCT FROM $6
         ORDER BY p.nome`,
        [sessao.loja, local.tipo, local.rua, local.modulo, local.nivel, local.posicao],
      );
      return {
        tipo: 'endereco' as const,
        endereco: etiquetaLocal(local),
        produtos: produtos.map((p) => ({ sku: p.sku, nome: p.nome, quantidade: p.quantidade, confirmadoEm: p.confirmado_em })),
      };
    }
    if (codigo.tipo === 'volume') {
      const [v] = await this.db.query<LinhaVolume>(`${SELECT_VOLUME} WHERE v.codigo = $1 AND v.loja_id = $2`, [codigo.codigo, sessao.loja]);
      if (!v) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'volume_inexistente', 'Etiqueta de volume desconhecida nesta loja.');
      return { tipo: 'volume' as const, volume: await this.comLocal(v) };
    }
    return { tipo: 'produto' as const, sku: await this.skuDoProduto(codigo.codigo) };
  }

  /**
   * Bipou o volume e depois o endereço: o produto passa a constar naquele endereço com a quantidade do volume.
   * Se o volume já estava em outro endereço, é uma mudança de lugar e a quantidade sai do endereço antigo.
   */
  async guardar(sessao: SessaoAtual, codigoVolume: string, codigoEndereco: string) {
    const volume = interpretarEtiqueta(codigoVolume);
    const endereco = interpretarEtiqueta(codigoEndereco);
    if (volume.tipo !== 'volume') throw new ErroAcesso(HttpStatus.BAD_REQUEST, 'nao_e_volume', 'Bipe primeiro a etiqueta da caixa ou do palete.');
    if (endereco.tipo !== 'endereco') throw new ErroAcesso(HttpStatus.BAD_REQUEST, 'nao_e_endereco', 'Agora bipe a etiqueta do endereço onde guardou.');

    const resultado = await this.db.transacao(async (cliente) => {
      const [v] = await this.db.query<LinhaVolume>(`${SELECT_VOLUME} WHERE v.codigo = $1 AND v.loja_id = $2 FOR UPDATE OF v`, [volume.codigo, sessao.loja], cliente);
      if (!v) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'volume_inexistente', 'Etiqueta de volume desconhecida nesta loja.');
      const local = await this.localPorCodigo(sessao.loja, endereco.codigo, cliente);
      if (v.local_id === local.id) throw new ErroAcesso(HttpStatus.CONFLICT, 'ja_guardado', 'Este volume já está registrado neste endereço.');

      if (v.local_id) {
        const [antigo] = await this.db.query<LinhaLocal>(`SELECT ${COLUNAS_LOCAL} FROM locais WHERE id = $1`, [v.local_id], cliente);
        await this.somarNoEndereco(cliente, sessao, v.sku, antigo, -v.quantidade);
      }
      await this.somarNoEndereco(cliente, sessao, v.sku, local, v.quantidade);
      await this.db.query('UPDATE volumes SET local_id = $1, guardado_por = $2, guardado_em = now() WHERE id = $3', [local.id, sessao.sub, v.id], cliente);
      return { v, local, mudou: v.local_id !== null };
    });

    await this.auditoria.registrar({
      autor: sessao.sub,
      acao: resultado.mudou ? 'volume.movido' : 'volume.guardado',
      lojaId: sessao.loja,
      aparelhoId: sessao.ap,
      detalhes: { volume: resultado.v.codigo, sku: resultado.v.sku, endereco: resultado.local.codigo },
    });
    const [atualizado] = await this.db.query<LinhaVolume>(`${SELECT_VOLUME} WHERE v.id = $1`, [resultado.v.id]);
    return { volume: await this.comLocal(atualizado), movido: resultado.mudou };
  }

  private async somarNoEndereco(cliente: PoolClient, sessao: SessaoAtual, sku: string, local: LinhaLocal, unidades: number) {
    const chave = [sku, sessao.loja, local.tipo, local.rua, local.modulo, local.nivel, local.posicao];
    const atualizados = await this.db.query(
      `UPDATE enderecos_produto SET quantidade = GREATEST(COALESCE(quantidade, 0) + $8, 0), confirmado_em = now(), confirmado_por = $9
       WHERE sku = $1 AND loja_id = $2 AND tipo = $3 AND rua = $4
         AND modulo IS NOT DISTINCT FROM $5 AND nivel IS NOT DISTINCT FROM $6 AND posicao IS NOT DISTINCT FROM $7
       RETURNING id`,
      [...chave, unidades, sessao.sub],
      cliente,
    );
    if (atualizados.length || unidades <= 0) return;
    await this.db.query(
      `INSERT INTO enderecos_produto (sku, loja_id, tipo, rua, modulo, nivel, posicao, quantidade, principal, confirmado_em, confirmado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
         NOT EXISTS (SELECT 1 FROM enderecos_produto WHERE sku = $1 AND loja_id = $2 AND (tipo = 'venda') = ($3 = 'venda')),
         now(), $9)`,
      [...chave, unidades, sessao.sub],
      cliente,
    );
  }

  private async localPorCodigo(lojaId: string, codigo: string, executor?: Executor): Promise<LinhaLocal> {
    const [local] = await this.db.query<LinhaLocal>(`SELECT ${COLUNAS_LOCAL} FROM locais WHERE codigo = $1 AND loja_id = $2`, [codigo, lojaId], executor);
    if (!local) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'endereco_inexistente', 'Etiqueta de endereço desconhecida nesta loja.');
    return local;
  }

  private async skuDoProduto(lido: string): Promise<string> {
    const { sku, eanOuSku } = interpretarCodigoLido(lido);
    const [p] = await this.db.query<{ sku: string }>(
      sku ? 'SELECT sku FROM produtos WHERE ativo AND sku = $1' : 'SELECT sku FROM produtos WHERE ativo AND (ean = $1 OR sku = $1)',
      [sku ?? eanOuSku],
    );
    if (!p) throw new ErroAcesso(HttpStatus.NOT_FOUND, 'produto_nao_encontrado', 'Produto não encontrado no catálogo. Confira o EAN ou peça a importação do ERP.');
    return p.sku;
  }

  private async comLocal(v: LinhaVolume): Promise<EtiquetaVolume> {
    if (!v.local_id) return this.etiquetaVolume(v, null);
    const [local] = await this.db.query<LinhaLocal>(`SELECT ${COLUNAS_LOCAL} FROM locais WHERE id = $1`, [v.local_id]);
    return this.etiquetaVolume(v, local);
  }

  private etiquetaVolume(v: LinhaVolume, local: LinhaLocal | null): EtiquetaVolume {
    return {
      codigo: v.codigo,
      qr: conteudoQrVolume(v.codigo),
      sku: v.sku,
      produto: v.nome,
      quantidade: v.quantidade,
      lote: v.lote,
      validade: v.validade,
      recebidoEm: v.recebido_em,
      guardado: local && v.guardado_em ? { local: etiquetaLocal(local), em: v.guardado_em, por: v.guardado_por } : null,
    };
  }
}
