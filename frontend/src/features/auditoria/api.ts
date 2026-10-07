import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { requisitar } from '../../api/cliente'
import type { Perfil } from '../usuarios/perfis'
import type { AcaoAuditoria } from './rotulos'

export interface UsuarioAuditoria {
  id: string
  nome: string
  email: string
  perfil: Perfil
}

export interface LogAuditoria {
  id: number
  criado_em: string
  /** Nulo em tentativas de login com email desconhecido. */
  usuario: UsuarioAuditoria | null
  acao: AcaoAuditoria
  entidade: string | null
  entidade_id: string | null
  /** Quando o registro é sobre um usuário (aprovação, perfil etc.), quem foi afetado. */
  usuario_afetado: UsuarioAuditoria | null
  detalhes: Record<string, unknown> | null
  ip: string | null
}

export interface PaginaLogsAuditoria {
  itens: LogAuditoria[]
  total: number
  pagina: number
  tamanho: number
}

export interface FiltrosAuditoria {
  usuarioId: string
  acao: AcaoAuditoria | ''
  /** Datas em ISO (limites do dia); null = sem limite. */
  de: string | null
  ate: string | null
  pagina: number
  tamanho: number
}

/** `ativo` = false não consulta (ex.: intervalo inválido). */
export function useLogsAuditoria(filtros: FiltrosAuditoria, ativo = true) {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanho: String(filtros.tamanho),
  })
  if (filtros.usuarioId) parametros.set('usuario_id', filtros.usuarioId)
  if (filtros.acao) parametros.set('acao', filtros.acao)
  if (filtros.de) parametros.set('de', filtros.de)
  if (filtros.ate) parametros.set('ate', filtros.ate)
  return useQuery({
    queryKey: ['auditoria', filtros],
    queryFn: () => requisitar<PaginaLogsAuditoria>(`/auditoria?${parametros}`),
    placeholderData: keepPreviousData,
    enabled: ativo,
  })
}
