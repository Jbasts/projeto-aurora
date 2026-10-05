import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'

export interface CampoTextoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string
  erro?: string
  /** Texto de apoio abaixo do campo, ligado por aria-describedby. */
  dica?: ReactNode
  /** Conteúdo dentro do campo, à direita (ex.: botão de mostrar senha). */
  acessorio?: ReactNode
  ref?: Ref<HTMLInputElement>
}

export const estiloCampo =
  'alvo-toque w-full rounded-campo border border-borda-campo bg-fundo px-3 text-texto placeholder:text-texto-suave aria-[invalid=true]:border-erro aria-[invalid=true]:border-2'

/** Campo com <label>, dica e erro ligados por aria-describedby; o erro é anunciado (aria-live). */
export function CampoTexto({
  rotulo,
  erro,
  dica,
  acessorio,
  id,
  className = '',
  ref,
  ...props
}: CampoTextoProps) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idErro = `${idCampo}-erro`
  const idDica = `${idCampo}-dica`
  const descritores = [dica ? idDica : null, erro ? idErro : null].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idCampo} className="text-sm font-medium text-texto">
        {rotulo}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={idCampo}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descritores || undefined}
          className={`${estiloCampo} ${acessorio ? 'pr-12' : ''} ${className}`}
          {...props}
        />
        {acessorio && (
          <div className="absolute inset-y-0 right-0 flex items-center">{acessorio}</div>
        )}
      </div>
      {dica && (
        <div id={idDica} className="text-sm text-texto-suave">
          {dica}
        </div>
      )}
      <p id={idErro} aria-live="polite" className="text-sm font-medium text-erro empty:hidden">
        {erro}
      </p>
    </div>
  )
}
