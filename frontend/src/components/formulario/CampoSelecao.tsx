import { useId, type Ref, type SelectHTMLAttributes } from 'react'

import { estiloCampo } from './CampoTexto'

interface CampoSelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string
  opcoes: { valor: string; rotulo: string }[]
  erro?: string
  ref?: Ref<HTMLSelectElement>
}

/** Seleção com <label>; o erro, quando houver, fica ligado por aria-describedby e é anunciado. */
export function CampoSelecao({
  rotulo,
  opcoes,
  erro,
  id,
  className = '',
  ref,
  ...props
}: CampoSelecaoProps) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idErro = `${idCampo}-erro`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idCampo} className="text-sm font-medium text-texto">
        {rotulo}
      </label>
      <select
        ref={ref}
        id={idCampo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        className={`${estiloCampo} ${className}`}
        {...props}
      >
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
      {erro !== undefined && (
        <p id={idErro} aria-live="polite" className="text-sm font-medium text-erro empty:hidden">
          {erro}
        </p>
      )}
    </div>
  )
}
