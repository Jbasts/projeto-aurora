import { Outlet } from 'react-router'

// Painel oficial do projeto (foto com véu verde e logo já aplicados, cantos arredondados).
// Para trocar, substitua o arquivo mantendo o nome (proporção aproximada de 3:4, logo no centro).
import imagemAutenticacao from '../../assets/painel-autenticacao.webp'
import { BarraAcessibilidade } from '../BarraAcessibilidade'
import { LinkPularConteudo } from '../LinkPularConteudo'
import { Rodape } from '../Rodape'

/** Login, cadastro e recuperar senha: imagem com o logo à esquerda e formulário à direita. */
export function LayoutAutenticacao() {
  return (
    <div className="flex min-h-screen flex-col bg-fundo-auth">
      <LinkPularConteudo />
      <BarraAcessibilidade />
      <div className="mx-auto grid w-full max-w-conteudo flex-1 gap-6 px-4 py-6 md:grid-cols-2 md:items-center md:gap-12 md:py-10">
        <header>
          <img
            src={imagemAutenticacao}
            alt="Projeto Aurora"
            className="h-36 w-full rounded-card object-cover md:aspect-[573/787] md:h-auto md:max-h-[42rem] md:object-contain"
          />
        </header>
        <main id="conteudo" tabIndex={-1} className="flex flex-col justify-center">
          <Outlet />
        </main>
      </div>
      <Rodape />
    </div>
  )
}
