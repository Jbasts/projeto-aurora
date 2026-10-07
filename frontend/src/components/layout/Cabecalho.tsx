import { useState } from 'react'
import { Link, NavLink } from 'react-router'

import type { UsuarioResumo } from '../../features/usuarios/perfis'
import { Logo } from '../Logo'
import { MenuPessoa } from './MenuPessoa'
import { itensDoPerfil } from './navegacao'

interface CabecalhoProps {
  usuario: UsuarioResumo
  aoSair: () => void
  /** Contador ao lado de um item do menu, pela rota (ex.: pendentes em /usuarios). */
  contadores?: Partial<Record<string, number>>
}

export function Cabecalho({ usuario, aoSair, contadores = {} }: CabecalhoProps) {
  const [menuAberto, setMenuAberto] = useState(false)
  const itens = itensDoPerfil(usuario.perfil)

  return (
    <header className="bg-fundo-topo">
      <div className="mx-auto flex max-w-conteudo flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link to="/" className="alvo-toque inline-flex items-center rounded-campo">
          <Logo className="h-11 w-auto text-texto" />
        </Link>

        <button
          type="button"
          className="alvo-toque inline-flex items-center justify-center rounded-botao text-primaria lg:hidden"
          aria-expanded={menuAberto}
          aria-controls="menu-principal"
          onClick={() => setMenuAberto((valor) => !valor)}
        >
          <span className="sr-only">{menuAberto ? 'Fechar menu' : 'Abrir menu'}</span>
          <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
            {menuAberto ? (
              <path
                fill="currentColor"
                d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z"
              />
            ) : (
              <path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
            )}
          </svg>
        </button>

        <div
          id="menu-principal"
          className={`${menuAberto ? 'flex' : 'hidden'} w-full flex-col gap-2 lg:flex lg:w-auto lg:flex-row lg:items-center lg:gap-6`}
        >
          <nav aria-label="Navegação principal">
            <ul className="flex flex-col lg:flex-row lg:items-center lg:gap-1">
              {itens.map((item) => (
                <li key={item.para}>
                  <NavLink
                    to={item.para}
                    end={item.exato}
                    onClick={() => setMenuAberto(false)}
                    className={({ isActive }) =>
                      `alvo-toque flex items-center rounded-botao px-3 text-sm ${
                        isActive
                          ? 'font-bold text-primaria underline decoration-2 underline-offset-8'
                          : 'font-medium text-texto hover:text-primaria'
                      }`
                    }
                  >
                    {item.rotulo}
                    <Contador valor={contadores[item.para]} />
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t border-divisor pt-2 lg:border-0 lg:pt-0">
            <MenuPessoa usuario={usuario} aoSair={aoSair} />
          </div>
        </div>
      </div>
    </header>
  )
}

function Contador({ valor }: { valor?: number }) {
  if (!valor) return null
  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primaria px-1.5 text-xs font-bold text-sobre-primaria no-underline">
      <span aria-hidden="true">{valor}</span>
      <span className="sr-only">{`, ${valor} ${valor === 1 ? 'pendente' : 'pendentes'}`}</span>
    </span>
  )
}
