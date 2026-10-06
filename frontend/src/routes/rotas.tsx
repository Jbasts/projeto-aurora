import type { RouteObject } from 'react-router'

import { LayoutAutenticacao } from '../components/layout/LayoutAutenticacao'
import { LayoutLogado } from '../components/layout/LayoutLogado'
import { PaginaAcessoNegado } from '../pages/PaginaAcessoNegado'
import { PaginaBuscarPessoas } from '../pages/PaginaBuscarPessoas'
import { PaginaCadastro } from '../pages/PaginaCadastro'
import { PaginaCadastroEnviado } from '../pages/PaginaCadastroEnviado'
import { PaginaCadastroPessoa } from '../pages/PaginaCadastroPessoa'
import { PaginaEditarPessoa } from '../pages/PaginaEditarPessoa'
import { PaginaInicio } from '../pages/PaginaInicio'
import { PaginaLinkExpirado } from '../pages/PaginaLinkExpirado'
import { PaginaLogin } from '../pages/PaginaLogin'
import { PaginaMeuPerfil } from '../pages/PaginaMeuPerfil'
import { PaginaNaoEncontrada } from '../pages/PaginaNaoEncontrada'
import { PaginaPerfilPessoa } from '../pages/PaginaPerfilPessoa'
import { PaginaRecuperarSenha } from '../pages/PaginaRecuperarSenha'
import { PaginaRedefinirSenha } from '../pages/PaginaRedefinirSenha'
import { PaginaUsuarios } from '../pages/PaginaUsuarios'
import { RotaComPerfil, RotaProtegida, RotaSomenteAnonima } from './protecao'

// Rotas da seção 4.2. Rotas por perfil usam <RotaComPerfil perfis={[...]} />.
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
        children: [
          { path: '/', element: <PaginaInicio /> },
          { path: '/meu-perfil', element: <PaginaMeuPerfil /> },
          { path: '/pessoas', element: <PaginaBuscarPessoas /> },
          { path: '/pessoas/:id', element: <PaginaPerfilPessoa /> },
          {
            element: <RotaComPerfil perfis={['ADMIN', 'COLABORADOR']} />,
            children: [
              { path: '/pessoas/nova', element: <PaginaCadastroPessoa /> },
              { path: '/pessoas/:id/editar', element: <PaginaEditarPessoa /> },
            ],
          },
          {
            element: <RotaComPerfil perfis={['ADMIN']} />,
            children: [{ path: '/usuarios', element: <PaginaUsuarios /> }],
          },
        ],
      },
      { path: '/acesso-negado', element: <PaginaAcessoNegado /> },
    ],
  },
  { path: '*', element: <PaginaNaoEncontrada /> },
]
