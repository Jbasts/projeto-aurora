import type { RouteObject } from 'react-router'

import { LayoutAutenticacao } from '../components/layout/LayoutAutenticacao'
import { LayoutLogado } from '../components/layout/LayoutLogado'
import { LayoutPublico } from '../components/layout/LayoutPublico'
import { PaginaAcessoNegado } from '../pages/PaginaAcessoNegado'
import { PaginaAuditoria } from '../pages/PaginaAuditoria'
import { PaginaBuscarPessoas } from '../pages/PaginaBuscarPessoas'
import { PaginaCadastro } from '../pages/PaginaCadastro'
import { PaginaCadastroEnviado } from '../pages/PaginaCadastroEnviado'
import { PaginaCadastroPessoa } from '../pages/PaginaCadastroPessoa'
import { PaginaEditarPessoa } from '../pages/PaginaEditarPessoa'
import { PaginaInicio } from '../pages/PaginaInicio'
import { PaginaLinkExpirado } from '../pages/PaginaLinkExpirado'
import { PaginaLogin } from '../pages/PaginaLogin'
import { PaginaMapaDeCalor } from '../pages/PaginaMapaDeCalor'
import { PaginaMapaSobDemanda } from '../pages/PaginaMapaSobDemanda'
import { PaginaMeuPerfil } from '../pages/PaginaMeuPerfil'
import { PaginaNaoEncontrada } from '../pages/PaginaNaoEncontrada'
import { PaginaPerfilPessoa } from '../pages/PaginaPerfilPessoa'
import { PaginaPrivacidade } from '../pages/PaginaPrivacidade'
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
    element: <LayoutPublico />,
    children: [{ path: '/privacidade', element: <PaginaPrivacidade /> }],
  },
  {
    element: <RotaProtegida />,
    children: [
      {
        element: <LayoutLogado />,
        children: [
          { path: '/', element: <PaginaInicio /> },
          { path: '/meu-perfil', element: <PaginaMeuPerfil /> },
          { path: '/pessoas', element: <PaginaBuscarPessoas /> },
          { path: '/mapa', element: <PaginaMapaSobDemanda /> },
          { path: '/mapa-de-calor', element: <PaginaMapaDeCalor /> },
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
            children: [
              { path: '/usuarios', element: <PaginaUsuarios /> },
              { path: '/auditoria', element: <PaginaAuditoria /> },
            ],
          },
        ],
      },
      { path: '/acesso-negado', element: <PaginaAcessoNegado /> },
    ],
  },
  { path: '*', element: <PaginaNaoEncontrada /> },
]
