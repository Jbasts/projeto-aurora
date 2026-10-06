import { Outlet, useNavigate } from 'react-router'

import { useAutenticacao, useUsuarioLogado } from '../../contexts/autenticacao'
import { useContagemPendentes } from '../../features/usuarios/api'
import { BarraAcessibilidade } from '../BarraAcessibilidade'
import { LinkPularConteudo } from '../LinkPularConteudo'
import { Rodape } from '../Rodape'
import { Cabecalho } from './Cabecalho'

export function LayoutLogado() {
  const usuario = useUsuarioLogado()
  const { sair } = useAutenticacao()
  const navigate = useNavigate()
  const { data: pendentes } = useContagemPendentes(usuario.perfil === 'ADMIN')

  const aoSair = async () => {
    await sair()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-fundo">
      <LinkPularConteudo />
      <BarraAcessibilidade />
      <Cabecalho usuario={usuario} aoSair={aoSair} contadores={{ '/usuarios': pendentes }} />
      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-conteudo flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Rodape />
    </div>
  )
}
