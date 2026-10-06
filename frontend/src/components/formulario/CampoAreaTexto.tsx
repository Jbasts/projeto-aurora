import { useId, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react'

interface CampoAreaTextoProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  rotulo: string
  erro?: string
  dica?: ReactNode
  ref?: Ref<HTMLTextAreaElement>
}

/** Texto longo, com as mesmas ligações de acessibilidade do CampoTexto. */
export function CampoAreaTexto({
  rotulo,
  erro,
  dica,
  id,
  className = '',
  ref,
  ...props
}: CampoAreaTextoProps) {
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
      <textarea
        ref={ref}
        id={idCampo}
        rows={4}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritores || undefined}
        className={`w-full rounded-campo border border-borda-campo bg-fundo px-3 py-2 text-texto placeholder:text-texto-suave aria-[invalid=true]:border-2 aria-[invalid=true]:border-erro ${className}`}
        {...props}
      />
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
