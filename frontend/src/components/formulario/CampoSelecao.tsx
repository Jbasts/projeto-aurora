import { useId, type SelectHTMLAttributes } from 'react'

import { estiloCampo } from './CampoTexto'

interface CampoSelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string
  opcoes: { valor: string; rotulo: string }[]
}

export function CampoSelecao({ rotulo, opcoes, id, className = '', ...props }: CampoSelecaoProps) {
  const idGerado = useId()
  const idCampo = id ?? idGerado

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idCampo} className="text-sm font-medium text-texto">
        {rotulo}
      </label>
      <select id={idCampo} className={`${estiloCampo} ${className}`} {...props}>
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </div>
  )
}
