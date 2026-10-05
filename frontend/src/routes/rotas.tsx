import type { RouteObject } from 'react-router'

import { LayoutAutenticacao } from '../components/layout/LayoutAutenticacao'
import { LayoutLogado } from '../components/layout/LayoutLogado'
import { PaginaAcessoNegado } from '../pages/PaginaAcessoNegado'
import { PaginaInicio } from '../pages/PaginaInicio'
import { PaginaLogin } from '../pages/PaginaLogin'
import { PaginaNaoEncontrada } from '../pages/PaginaNaoEncontrada'

// Rotas da seção 4.2. A proteção por login e perfil entra na Fase 2.
export const rotas: RouteObject[] = [
  {
    element: <LayoutAutenticacao />,
    children: [{ path: '/login', element: <PaginaLogin /> }],
  },
  {
    element: <LayoutLogado />,
    children: [{ path: '/', element: <PaginaInicio /> }],
  },
  { path: '/acesso-negado', element: <PaginaAcessoNegado /> },
  { path: '*', element: <PaginaNaoEncontrada /> },
]
