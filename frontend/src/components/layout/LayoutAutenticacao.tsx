import { Outlet } from 'react-router'

import imagemAutenticacao from '../../assets/imagem-autenticacao.svg'
import { BarraAcessibilidade } from '../BarraAcessibilidade'
import { LinkPularConteudo } from '../LinkPularConteudo'
import { Logo } from '../Logo'
import { Rodape } from '../Rodape'

/** Login, cadastro e recuperar senha: imagem com véu verde à esquerda e formulário à direita. */
export function LayoutAutenticacao() {
  return (
    <div className="flex min-h-screen flex-col bg-fundo-auth">
      <LinkPularConteudo />
      <BarraAcessibilidade />
      <div className="mx-auto grid w-full max-w-conteudo flex-1 gap-6 px-4 py-6 md:grid-cols-2 md:gap-10 md:py-10">
        <div
          className="relative h-32 overflow-hidden rounded-card bg-cover bg-center md:h-auto md:min-h-[32rem]"
          style={{ backgroundImage: `url("${imagemAutenticacao}")` }}
        >
          <div className="absolute inset-0 flex items-center justify-center bg-sobreposicao">
            <Logo className="h-14 w-auto md:h-24" />
          </div>
        </div>
        <main id="conteudo" tabIndex={-1} className="flex flex-col justify-center">
          <Outlet />
        </main>
      </div>
      <Rodape />
    </div>
  )
}
