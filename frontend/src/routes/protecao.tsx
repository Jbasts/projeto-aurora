import { Navigate, Outlet, useLocation, type Location } from 'react-router'

import { TelaCarregando } from '../components/TelaCarregando'
import { useAutenticacao } from '../contexts/autenticacao'
import type { Perfil } from '../features/usuarios/perfis'

export interface EstadoNavegacaoLogin {
  /** Rota que a pessoa tentou abrir antes de entrar. */
  de?: Location
  /** Aviso exibido no topo do login (ex.: senha atualizada). */
  aviso?: string
}

/** Só para pessoas logadas. Sem login, vai para /login e depois volta para onde estava. */
export function RotaProtegida() {
  const { estado } = useAutenticacao()
  const location = useLocation()

  if (estado.situacao === 'carregando') return <TelaCarregando />
  if (estado.situacao === 'anonima') {
    const estadoLogin: EstadoNavegacaoLogin = { de: location }
    return <Navigate to="/login" replace state={estadoLogin} />
  }
  return <Outlet />
}

/** Restringe por perfil. O backend também valida; aqui só evitamos telas inúteis. */
export function RotaComPerfil({ perfis }: { perfis: Perfil[] }) {
  const { estado } = useAutenticacao()
  if (estado.situacao !== 'autenticada') return null
  if (!perfis.includes(estado.usuario.perfil)) return <Navigate to="/acesso-negado" replace />
  return <Outlet />
}

/** /login: pessoa já logada vai para a rota que pediu antes, ou para o início. */
export function RotaSomenteAnonima() {
  const { estado } = useAutenticacao()
  const location = useLocation()

  if (estado.situacao === 'carregando') return <TelaCarregando />
  if (estado.situacao === 'autenticada') {
    const de = (location.state as EstadoNavegacaoLogin | null)?.de
    const destino = de ? `${de.pathname}${de.search}${de.hash}` : '/'
    return <Navigate to={destino} replace />
  }
  return <Outlet />
}
