export type Perfil = 'ADMIN' | 'COLABORADOR' | 'PADRAO'

/** Rótulos do "Perfil de acesso" na interface (glossário da especificação). */
export const ROTULOS_PERFIL: Record<Perfil, string> = {
  ADMIN: 'Pessoa administradora',
  COLABORADOR: 'Pessoa colaboradora',
  PADRAO: 'Pessoa usuária',
}

export interface UsuarioResumo {
  nome: string
  perfil: Perfil
}
