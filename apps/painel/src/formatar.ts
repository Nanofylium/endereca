import { MembroEquipe, Papel, Situacao, SituacaoTarefa } from './tipos';

export const NOME_PAPEL: Record<Papel, string> = {
  repositor: 'Repositor',
  lider: 'Líder',
  gerente: 'Gerente operacional',
  admin: 'Administrador',
};

export const NOME_SITUACAO: Record<Situacao, string> = {
  ativo: 'Ativo',
  pendente: 'Aguardando primeiro acesso',
  bloqueado: 'Bloqueado por tentativas',
};

const MOTIVOS: Record<string, string> = {
  matricula_inexistente: 'Matrícula fora do cadastro do RH',
  aparelho_nao_autorizado: 'Aparelho não autorizado',
  codigo_invalido: 'Código de ativação inválido ou vencido',
  palavra_errada: 'Palavra secreta errada',
  loja_diferente: 'Matrícula de outra loja',
  bloqueado: 'Tentou durante o bloqueio',
};

export function textoMotivo(motivo: string): string {
  return MOTIVOS[motivo] ?? motivo;
}

const relogio = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const diaHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** "hoje, 09:42", "ontem, 17:30" ou "12/10, 08:15". */
export function quando(iso: string | null, agora = new Date()): string {
  if (!iso) return 'Nunca';
  const data = new Date(iso);
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diferenca = Math.round((dia(agora) - dia(data)) / 86_400_000);
  if (diferenca === 0) return `hoje, ${relogio.format(data)}`;
  if (diferenca === 1) return `ontem, ${relogio.format(data)}`;
  return diaHora.format(data);
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export const NOME_SITUACAO_TAREFA: Record<SituacaoTarefa, string> = {
  aguardando_lider: 'Esperando o líder',
  atribuida: 'Em andamento',
  concluida: 'Concluída',
  sem_produto: 'Sem produto',
};

/** Quem pode receber a tarefa: o líder escolhe na própria equipe; o gerente vê primeiro quem é do setor. */
export function candidatosTarefa(equipe: MembroEquipe[], setor: string, papel: Papel, eu: string): MembroEquipe[] {
  const mesmo = (s: string | null) => !!s && s.trim().toLocaleLowerCase('pt-BR') === setor.trim().toLocaleLowerCase('pt-BR');
  const executam = equipe.filter((m) => m.situacao !== 'pendente' && (m.papel === 'repositor' || m.papel === 'lider'));
  if (papel === 'lider') return executam.filter((m) => m.matricula === eu || (m.papel === 'repositor' && mesmo(m.setor)));
  const doSetor = executam.filter((m) => mesmo(m.setor));
  return doSetor.length ? doSetor : executam;
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const reais = (valor: number) => moeda.format(valor);

/** "venceu há 2 dias", "vence hoje", "vence amanhã", "vence em 12 dias". */
export function textoVencimento(dias: number): string {
  if (dias < -1) return `venceu há ${-dias} dias`;
  if (dias === -1) return 'venceu ontem';
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `vence em ${dias} dias`;
}

/** 2026-11-02 vira 02/11. */
export const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
