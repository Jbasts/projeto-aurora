import { Outlet, useNavigate } from 'react-router'

import { useAutenticacao, useUsuarioLogado } from '../../contexts/autenticacao'
import { useContagemSolicitacoes } from '../../features/solicitacoes/api'
import { useContagemPendentes } from '../../features/usuarios/api'
import { BarraAcessibilidade } from '../BarraAcessibilidade'
import { LinkPularConteudo } from '../LinkPularConteudo'
import { Rodape } from '../Rodape'
import { Cabecalho } from './Cabecalho'

export function LayoutLogado() {
  const usuario = useUsuarioLogado()
  const { sair } = useAutenticacao()
  const navigate = useNavigate()
  const ehAdmin = usuario.perfil === 'ADMIN'
  const { data: pendentes } = useContagemPendentes(ehAdmin)
  const { data: solicitacoes } = useContagemSolicitacoes(ehAdmin)

  const aoSair = async () => {
    await sair()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-fundo">
      <LinkPularConteudo />
      <BarraAcessibilidade />
      <Cabecalho
        usuario={usuario}
        aoSair={aoSair}
        contadores={{ '/usuarios': pendentes, '/solicitacoes': solicitacoes }}
      />
      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-conteudo flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Rodape />
    </div>
  )
}
