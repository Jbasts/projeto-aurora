import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'

import { ROTULOS_PERFIL, type UsuarioResumo } from '../../features/usuarios/perfis'

interface MenuPessoaProps {
  usuario: UsuarioResumo
  aoSair: () => void
}

export function MenuPessoa({ usuario, aoSair }: MenuPessoaProps) {
  const [aberto, setAberto] = useState(false)
  const idMenu = useId()
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fecharAoClicarFora = (evento: MouseEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false)
    }
    const fecharComEsc = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fecharAoClicarFora)
    document.addEventListener('keydown', fecharComEsc)
    return () => {
      document.removeEventListener('mousedown', fecharAoClicarFora)
      document.removeEventListener('keydown', fecharComEsc)
    }
  }, [aberto])

  const estiloItem =
    'alvo-toque flex w-full items-center px-4 text-left text-texto hover:bg-fundo-topo'

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={idMenu}
        onClick={() => setAberto((valor) => !valor)}
        className="alvo-toque flex items-center gap-2 rounded-botao px-2 text-left hover:bg-fundo"
      >
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-texto">{usuario.nome}</span>
          <span className="text-xs text-texto-suave">{ROTULOS_PERFIL[usuario.perfil]}</span>
        </span>
        <svg viewBox="0 0 24 24" className="size-4 text-texto-suave" aria-hidden="true">
          <path fill="currentColor" d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {aberto && (
        <ul
          id={idMenu}
          className="absolute right-0 z-20 mt-1 min-w-48 overflow-hidden rounded-card border border-divisor bg-fundo py-1 shadow-lg"
        >
          <li>
            <Link to="/meu-perfil" className={estiloItem} onClick={() => setAberto(false)}>
              Meu perfil
            </Link>
          </li>
          <li>
            <button
              type="button"
              className={estiloItem}
              onClick={() => {
                setAberto(false)
                aoSair()
              }}
            >
              Sair
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
