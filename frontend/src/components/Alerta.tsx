import type { ReactNode } from 'react'

interface AlertaProps {
  tipo: 'erro' | 'sucesso' | 'info'
  children: ReactNode
}

const estilos = {
  erro: 'border-erro text-erro',
  sucesso: 'border-primaria text-primaria',
  info: 'border-borda-campo text-texto',
}

const icones = {
  erro: 'M11 7h2v6h-2zm0 8h2v2h-2zM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  sucesso:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.5 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4z',
  info: 'M11 11h2v6h-2zm0-4h2v2h-2zM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
}

/** Mensagem de destaque. Erros usam role="alert" (anunciados na hora); os demais, role="status". */
export function Alerta({ tipo, children }: AlertaProps) {
  return (
    <div
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-campo border-l-4 bg-fundo-topo px-4 py-3 text-sm font-medium ${estilos[tipo]}`}
    >
      <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0" aria-hidden="true">
        <path fill="currentColor" d={icones[tipo]} />
      </svg>
      <div>{children}</div>
    </div>
  )
}
