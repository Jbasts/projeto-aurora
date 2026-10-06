import { Link } from 'react-router'

// Banner oficial do protótipo (computador) e versão mais alta da mesma rua (celular).
// Para trocar, substitua os arquivos mantendo os nomes. Nunca usar foto de pessoa em situação
// de rua real.
import bannerInicioCelular from '../assets/banner-inicio-celular.webp'
import bannerInicio from '../assets/banner-inicio.webp'
import { useUsuarioLogado } from '../contexts/autenticacao'
import { useContagemPendentes } from '../features/usuarios/api'
import type { Perfil } from '../features/usuarios/perfis'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

interface Cartao {
  texto: string
  para: string
  perfis: Perfil[]
  /** Caminho SVG do ícone (viewBox 0 0 24 24). */
  icone: string
}

const TODOS: Perfil[] = ['ADMIN', 'COLABORADOR', 'PADRAO']

const CARTOES: Cartao[] = [
  {
    texto: 'Visualizar meu cadastro',
    para: '/meu-perfil',
    perfis: TODOS,
    icone:
      'M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v12h16V6zm4.5 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM5 16.5c0-1.9 1.6-3 3.5-3s3.5 1.1 3.5 3zM13.5 9H19v1.6h-5.5zm0 3.4H19V14h-5.5z',
  },
  {
    texto: 'Buscar pessoas em situação de rua',
    para: '/pessoas',
    perfis: TODOS,
    icone:
      'M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 1.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM6.2 13.7c.7-1.6 2.2-2.4 3.8-2.4s3.1.8 3.8 2.4a6 6 0 0 1-7.6 0z',
  },
  {
    texto: 'Visualizar mapeamento',
    para: '/mapa',
    perfis: TODOS,
    icone:
      'M12 1.5a7.5 7.5 0 0 1 7.5 7.5c0 5.3-7.5 13.5-7.5 13.5S4.5 14.3 4.5 9A7.5 7.5 0 0 1 12 1.5zm0 2A5.5 5.5 0 0 0 6.5 9c0 3.3 3.8 8.4 5.5 10.4 1.7-2 5.5-7.1 5.5-10.4A5.5 5.5 0 0 0 12 3.5zm0 2.8a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4z',
  },
  {
    texto: 'Mapa de calor',
    para: '/mapa-de-calor',
    perfis: TODOS,
    icone:
      'M12 1.5s6 5 6 11.5a6 6 0 0 1-12 0c0-2.8 1.3-5 2.6-6.4.1 2 1.1 3.7 2.6 3.7C11.2 6.6 12 3.6 12 1.5zm0 11.2c-1.4 1.2-2.5 2.6-2.5 4.1a2.5 2.5 0 0 0 5 0c0-1.5-1.1-2.9-2.5-4.1z',
  },
  {
    texto: 'Cadastrar pessoa em situação de rua',
    para: '/pessoas/nova',
    perfis: ['ADMIN', 'COLABORADOR'],
    icone:
      'M9 3a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm0 9c4.1 0 7.5 2.1 7.5 5v2h-15v-2c0-2.9 3.4-5 7.5-5zm0 2c-3 0-5.3 1.3-5.5 3h11c-.2-1.7-2.5-3-5.5-3zm9-9h2v3h3v2h-3v3h-2v-3h-3V10h3z',
  },
  {
    texto: 'Gerenciar usuários',
    para: '/usuarios',
    perfis: ['ADMIN'],
    icone:
      'M8.5 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm8 0a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8.5 13c3.9 0 7 1.9 7 4.5V20h-14v-2.5c0-2.6 3.1-4.5 7-4.5zm0 2c-2.6 0-4.7 1.1-5 2.5v.5h10v-.5c-.3-1.4-2.4-2.5-5-2.5zm8-1.5c3 0 5.5 1.5 5.5 3.8V20h-4.5v-2h2.5v-.7c0-1-1.3-1.8-3-2l-.7-.1a6 6 0 0 0-.9-1.6z',
  },
]

export function PaginaInicio() {
  useTituloDocumento('Início')
  const usuario = useUsuarioLogado()
  const ehAdmin = usuario.perfil === 'ADMIN'
  const { data: pendentes = 0 } = useContagemPendentes(ehAdmin)
  const cartoes = CARTOES.filter((cartao) => cartao.perfis.includes(usuario.perfil))

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <section
        aria-labelledby="titulo-projeto"
        className="grid gap-4 md:grid-cols-[2fr_3fr] md:items-center md:gap-12"
      >
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold tracking-widest text-primaria uppercase">
            <span aria-hidden="true" className="h-px w-6 bg-primaria" />O projeto
          </p>
          <h1 id="titulo-projeto" className="text-3xl font-semibold text-texto md:text-4xl">
            Plataforma <span className="block text-primaria">Projeto Aurora</span>
          </h1>
        </div>
        <p className="leading-relaxed text-texto-suave">
          Uma plataforma de cadastro e mapeamento de pessoas em situação de rua, facilitando a ajuda
          humanitária. Conectamos recursos e apoio a quem mais precisa, promovendo dignidade e
          esperança.
        </p>
      </section>

      {/* Faixa do protótipo no computador; no celular, a versão mais alta da mesma rua,
          para a faixa não ficar espremida. */}
      <picture>
        <source media="(min-width: 768px)" srcSet={bannerInicio} />
        <img
          src={bannerInicioCelular}
          alt="Rua de uma cidade entre prédios, com carros e faixa de pedestres"
          width={1171}
          height={288}
          className="h-48 w-full rounded-card object-cover object-bottom sm:h-64 md:h-auto"
        />
      </picture>

      <nav aria-label="Atalhos" className="border-y border-divisor py-8">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
          {cartoes.map((cartao) => {
            const contador = cartao.para === '/usuarios' ? pendentes : 0
            return (
              <li key={cartao.para}>
                <Link
                  to={cartao.para}
                  className="relative flex h-full min-h-40 flex-col items-center justify-center gap-3 rounded-card bg-primaria p-4 text-center font-semibold text-sobre-primaria transition-colors hover:bg-primaria-hover"
                >
                  <svg viewBox="0 0 24 24" className="size-12" aria-hidden="true">
                    <path fill="currentColor" d={cartao.icone} />
                  </svg>
                  <span>{cartao.texto}</span>
                  {contador > 0 && (
                    <span className="absolute top-3 right-3 inline-flex min-w-7 items-center justify-center rounded-full bg-fundo px-2 py-0.5 text-sm font-bold text-primaria">
                      <span aria-hidden="true">{contador}</span>
                      <span className="sr-only">
                        {`, ${contador} ${contador === 1 ? 'cadastro pendente' : 'cadastros pendentes'}`}
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
