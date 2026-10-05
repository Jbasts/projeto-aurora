import { Outlet } from 'react-router'

import type { UsuarioResumo } from '../../features/usuarios/perfis'
import { BarraAcessibilidade } from '../BarraAcessibilidade'
import { LinkPularConteudo } from '../LinkPularConteudo'
import { Rodape } from '../Rodape'
import { Cabecalho } from './Cabecalho'

// TODO (Fase 2): substituir pelo usuário autenticado (GET /auth/me) e implementar "Sair".
const USUARIO_PROVISORIO: UsuarioResumo = { nome: 'Pessoa de teste', perfil: 'ADMIN' }

export function LayoutLogado() {
  return (
    <div className="flex min-h-screen flex-col bg-fundo">
      <LinkPularConteudo />
      <BarraAcessibilidade />
      <Cabecalho usuario={USUARIO_PROVISORIO} aoSair={() => {}} />
      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-conteudo flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Rodape />
    </div>
  )
}
