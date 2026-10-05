import type { RouteObject } from 'react-router'

import { LayoutAutenticacao } from '../components/layout/LayoutAutenticacao'
import { LayoutLogado } from '../components/layout/LayoutLogado'
import { PaginaAcessoNegado } from '../pages/PaginaAcessoNegado'
import { PaginaCadastro } from '../pages/PaginaCadastro'
import { PaginaCadastroEnviado } from '../pages/PaginaCadastroEnviado'
import { PaginaInicio } from '../pages/PaginaInicio'
import { PaginaLinkExpirado } from '../pages/PaginaLinkExpirado'
import { PaginaLogin } from '../pages/PaginaLogin'
import { PaginaNaoEncontrada } from '../pages/PaginaNaoEncontrada'
import { PaginaRecuperarSenha } from '../pages/PaginaRecuperarSenha'
import { PaginaRedefinirSenha } from '../pages/PaginaRedefinirSenha'
import { RotaProtegida, RotaSomenteAnonima } from './protecao'

// Rotas da seção 4.2. Rotas por perfil usam <RotaComPerfil perfis={[...]} /> (a partir da Fase 3).
export const rotas: RouteObject[] = [
  {
    element: <LayoutAutenticacao />,
    children: [
      {
        element: <RotaSomenteAnonima />,
        children: [{ path: '/login', element: <PaginaLogin /> }],
      },
      { path: '/cadastro', element: <PaginaCadastro /> },
      { path: '/cadastro-enviado', element: <PaginaCadastroEnviado /> },
      { path: '/recuperar-senha', element: <PaginaRecuperarSenha /> },
      { path: '/redefinir-senha', element: <PaginaRedefinirSenha /> },
    ],
  },
  { path: '/link-expirado', element: <PaginaLinkExpirado /> },
  {
    element: <RotaProtegida />,
    children: [
      {
        element: <LayoutLogado />,
        children: [{ path: '/', element: <PaginaInicio /> }],
      },
      { path: '/acesso-negado', element: <PaginaAcessoNegado /> },
    ],
  },
  { path: '*', element: <PaginaNaoEncontrada /> },
]
