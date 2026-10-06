import { Outlet } from 'react-router'

// Painel do protótipo: foto de rua com o véu verde e o logo aplicados por CSS.
// Para trocar a foto, substitua o arquivo (o recorte é centralizado, em 3:4 no desktop).
import imagemAutenticacao from '../../assets/rua.jpg'
import { BarraAcessibilidade } from '../BarraAcessibilidade'
import { LinkPularConteudo } from '../LinkPularConteudo'
import { Logo } from '../Logo'
import { Rodape } from '../Rodape'

/** Login, cadastro e recuperar senha: imagem com o logo à esquerda e formulário à direita. */
export function LayoutAutenticacao() {
  return (
    <div className="flex min-h-screen flex-col bg-fundo-auth">
      <LinkPularConteudo />
      <BarraAcessibilidade />
      <div className="mx-auto grid w-full max-w-conteudo flex-1 gap-6 px-4 py-6 md:grid-cols-2 md:items-center md:gap-12 md:py-10">
        <div className="relative h-36 w-full overflow-hidden rounded-card md:aspect-[3/4] md:h-auto md:max-h-[42rem]">
          <img
            src={imagemAutenticacao}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-sobreposicao" />
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <Logo className="w-52 text-sobre-imagem drop-shadow-lg md:w-3/4 md:max-w-sm" />
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
