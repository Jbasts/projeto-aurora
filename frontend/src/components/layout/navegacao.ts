import type { Perfil } from '../../features/usuarios/perfis'

export interface ItemNavegacao {
  rotulo: string
  para: string
  perfis: Perfil[]
  /** Destaca só na rota exata (evita "Pessoas" ativo em /pessoas/nova). */
  exato?: boolean
}

const TODOS: Perfil[] = ['ADMIN', 'COLABORADOR', 'PADRAO']

export const ITENS_NAVEGACAO: ItemNavegacao[] = [
  { rotulo: 'Início', para: '/', perfis: TODOS, exato: true },
  { rotulo: 'Pessoas', para: '/pessoas', perfis: TODOS, exato: true },
  { rotulo: 'Cadastrar', para: '/pessoas/nova', perfis: ['ADMIN', 'COLABORADOR'] },
  { rotulo: 'Mapa', para: '/mapa', perfis: TODOS },
  { rotulo: 'Mapa de calor', para: '/mapa-de-calor', perfis: TODOS },
]

/** Itens de administração, no menu da conta (junto de Meu perfil e Sair). */
export const ITENS_MENU_CONTA: ItemNavegacao[] = [
  { rotulo: 'Usuários', para: '/usuarios', perfis: ['ADMIN'] },
  { rotulo: 'Solicitações', para: '/solicitacoes', perfis: ['ADMIN'] },
  { rotulo: 'Permissões', para: '/permissoes', perfis: ['ADMIN'] },
  { rotulo: 'Auditoria', para: '/auditoria', perfis: ['ADMIN'] },
]

export function itensDoPerfil(perfil: Perfil): ItemNavegacao[] {
  return ITENS_NAVEGACAO.filter((item) => item.perfis.includes(perfil))
}
