import { ROTULOS_PERFIL, ROTULOS_STATUS_USUARIO, type Perfil } from '../usuarios/perfis'
import type { StatusUsuario } from '../auth/tipos'

/** Espelha AcaoAuditoria em app/services/auditoria.py. */
export const ROTULOS_ACAO = {
  LOGIN_SUCESSO: 'Login realizado',
  LOGIN_FALHA: 'Falha no login',
  LOGIN_BLOQUEIO: 'Conta bloqueada por tentativas',
  EMAIL_VERIFICADO: 'Email confirmado',
  SOLICITACAO_CRIADA: 'Solicitação de troca criada',
  SOLICITACAO_EMAIL_CONFIRMADO: 'Email novo confirmado pelo link',
  SOLICITACAO_APROVADA: 'Solicitação de troca aprovada',
  SOLICITACAO_RECUSADA: 'Solicitação de troca recusada',
  USUARIO_APROVADO: 'Cadastro aprovado',
  USUARIO_RECUSADO: 'Cadastro recusado',
  USUARIO_INATIVADO: 'Usuário inativado',
  USUARIO_REATIVADO: 'Usuário reativado',
  USUARIO_PERFIL_ALTERADO: 'Perfil de acesso alterado',
  USUARIO_VISUALIZADO: 'Dados de usuário visualizados',
  USUARIO_DADOS_COMPLETADOS: 'Dados de conta antiga completados',
  MEUS_DADOS_ALTERADOS: 'Dados próprios alterados',
  SENHA_ALTERADA: 'Senha alterada',
  PESSOA_CADASTRADA: 'Pessoa cadastrada',
  PESSOA_EDITADA: 'Pessoa editada',
  PESSOA_INATIVADA: 'Pessoa inativada',
  PESSOA_REATIVADA: 'Pessoa reativada',
  PESSOA_VISUALIZADA: 'Perfil de pessoa visualizado',
  FOTO_ENVIADA: 'Foto enviada',
  FOTO_REMOVIDA: 'Foto removida',
  AVISTAMENTO_REGISTRADO: 'Avistamento registrado',
} as const

export type AcaoAuditoria = keyof typeof ROTULOS_ACAO

export const ACOES = Object.keys(ROTULOS_ACAO) as AcaoAuditoria[]

const MOTIVOS_LOGIN: Record<string, string> = {
  EMAIL_DESCONHECIDO: 'email ou CPF não cadastrado',
  SENHA_INCORRETA: 'senha incorreta',
  CONTA_BLOQUEADA: 'conta bloqueada no momento',
  TENTATIVAS_ESGOTADAS: 'tentativas esgotadas',
  EMAIL_NAO_VERIFICADO: 'email ainda não confirmado',
  CONTA_PENDENTE: 'cadastro pendente de aprovação',
  CONTA_INATIVA: 'conta inativa',
}

// `tipo` aparece em fotos (PERFIL/ALBUM) e em solicitações de troca (EMAIL/CPF).
const TIPOS: Record<string, string> = {
  PERFIL: 'foto de perfil',
  ALBUM: 'álbum',
  EMAIL: 'troca de email',
  CPF: 'troca de CPF',
}

function rotuloValor(valor: string): string {
  return ROTULOS_PERFIL[valor as Perfil] ?? ROTULOS_STATUS_USUARIO[valor as StatusUsuario] ?? valor
}

/** Texto legível para `detalhes` (que só têm IDs, códigos e nomes de campos). */
export function descreverDetalhes(detalhes: Record<string, unknown> | null): string | null {
  if (!detalhes) return null
  const partes: string[] = []
  const { motivo, de, para, campos, tipo } = detalhes
  if (typeof motivo === 'string') partes.push(`Motivo: ${MOTIVOS_LOGIN[motivo] ?? motivo}`)
  if (typeof de === 'string' && typeof para === 'string') {
    partes.push(`De ${rotuloValor(de)} para ${rotuloValor(para)}`)
  }
  if (Array.isArray(campos) && campos.length) partes.push(`Campos: ${campos.join(', ')}`)
  if (typeof tipo === 'string') partes.push(`Tipo: ${TIPOS[tipo] ?? tipo}`)
  return partes.length ? partes.join(' · ') : null
}

/** ID da PSDR relacionada ao registro (para o link "Ver pessoa"), se houver. */
export function pessoaDoRegistro(log: {
  entidade: string | null
  entidade_id: string | null
  detalhes: Record<string, unknown> | null
}): string | null {
  if (log.entidade === 'pessoa' && log.entidade_id) return log.entidade_id
  const pessoaId = log.detalhes?.pessoa_id
  return typeof pessoaId === 'string' ? pessoaId : null
}
