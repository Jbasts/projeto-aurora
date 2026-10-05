import type { ButtonHTMLAttributes } from 'react'

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario'
  carregando?: boolean
}

const estilos = {
  primario:
    'bg-primaria text-sobre-primaria hover:bg-primaria-hover disabled:hover:bg-primaria border border-transparent',
  secundario: 'border border-borda-campo bg-fundo text-texto hover:bg-fundo-topo',
}

export function Botao({
  variante = 'primario',
  carregando = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...props
}: BotaoProps) {
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={`alvo-toque inline-flex items-center justify-center gap-2 rounded-botao px-6 font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${estilos[variante]} ${className}`}
      {...props}
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  )
}
