import type { StatusUsuario } from '../auth/tipos'

export type Perfil = 'ADMIN' | 'COLABORADOR' | 'PADRAO'

export const PERFIS: Perfil[] = ['ADMIN', 'COLABORADOR', 'PADRAO']

/** Rótulos do "Perfil de acesso" na interface (glossário da especificação). */
export const ROTULOS_PERFIL: Record<Perfil, string> = {
  ADMIN: 'Pessoa administradora',
  COLABORADOR: 'Pessoa colaboradora',
  PADRAO: 'Pessoa usuária',
}

export const ROTULOS_STATUS_USUARIO: Record<StatusUsuario, string> = {
  PENDENTE: 'Pendente',
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
}

export interface UsuarioResumo {
  nome: string
  perfil: Perfil
}
