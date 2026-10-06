import { useId } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'

import { CampoAreaTexto } from '../../components/formulario/CampoAreaTexto'
import { CampoTexto } from '../../components/formulario/CampoTexto'
import { mascaraTelefone } from '../../components/formulario/mascaras'
import type { DadosPessoa } from './esquemas'

interface CamposProps {
  register: UseFormRegister<DadosPessoa>
  errors: FieldErrors<DadosPessoa>
}

const estiloSecao = 'flex flex-col gap-4'
const estiloTituloSecao = 'text-lg font-semibold text-texto'
const estiloGrade = 'grid gap-4 md:grid-cols-2'

function useCampoTelefone(register: UseFormRegister<DadosPessoa>) {
  return (nome: 'telefone' | 'telefone_contato') => {
    const campo = register(nome)
    return {
      ...campo,
      type: 'tel',
      inputMode: 'tel' as const,
      placeholder: '(00) 00000-0000',
      onChange: (evento: React.ChangeEvent<HTMLInputElement>) => {
        evento.target.value = mascaraTelefone(evento.target.value)
        return campo.onChange(evento)
      },
    }
  }
}

/** Dados pessoais, contato, pessoa de referência e observações (seção 3.7). */
export function CamposPessoa({ register, errors }: CamposProps) {
  const telefone = useCampoTelefone(register)

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="secao-dados" className={estiloSecao}>
        <h2 id="secao-dados" className={estiloTituloSecao}>
          Dados pessoais
        </h2>
        <div className={estiloGrade}>
          <CampoTexto rotulo="Nome" erro={errors.nome?.message} {...register('nome')} />
          <CampoTexto
            rotulo="Sobrenome"
            erro={errors.sobrenome?.message}
            {...register('sobrenome')}
          />
          <CampoTexto
            rotulo="Apelido (opcional)"
            dica="Como a pessoa é conhecida."
            erro={errors.apelido?.message}
            {...register('apelido')}
          />
          <CampoTexto
            rotulo="Idade aproximada (opcional)"
            inputMode="numeric"
            erro={errors.idade_aproximada?.message}
            {...register('idade_aproximada')}
          />
        </div>
      </section>

      <section aria-labelledby="secao-contato" className={estiloSecao}>
        <h2 id="secao-contato" className={estiloTituloSecao}>
          Contato
        </h2>
        <div className={estiloGrade}>
          <CampoTexto
            rotulo="Email (opcional)"
            type="email"
            inputMode="email"
            erro={errors.email?.message}
            {...register('email')}
          />
          <CampoTexto
            rotulo="Telefone (opcional)"
            erro={errors.telefone?.message}
            {...telefone('telefone')}
          />
          <CampoTexto
            rotulo="Pessoa de referência (opcional)"
            dica="Familiar, assistente social ou outra pessoa de contato."
            erro={errors.nome_contato?.message}
            {...register('nome_contato')}
          />
          <CampoTexto
            rotulo="Telefone da pessoa de referência (opcional)"
            erro={errors.telefone_contato?.message}
            {...telefone('telefone_contato')}
          />
        </div>
      </section>

      <section aria-labelledby="secao-observacoes" className={estiloSecao}>
        <h2 id="secao-observacoes" className={estiloTituloSecao}>
          Observações
        </h2>
        <CampoAreaTexto
          rotulo="Observações (opcional)"
          dica="Registre apenas o que ajuda no atendimento."
          erro={errors.observacoes?.message}
          {...register('observacoes')}
        />
      </section>
    </div>
  )
}

/** Pergunta obrigatória, sem resposta pré-marcada. */
export function CampoConsentimento({ register, errors }: CamposProps) {
  const id = useId()
  const erro = errors.consentimento?.message
  return (
    <fieldset
      className="flex flex-col gap-3"
      aria-describedby={erro ? `${id}-erro` : undefined}
      aria-invalid={erro ? true : undefined}
    >
      <legend className="mb-1 font-semibold text-texto">
        A pessoa foi informada sobre o cadastro e autorizou o uso de fotos?
      </legend>
      {[
        { valor: 'sim', rotulo: 'Sim, autorizou' },
        { valor: 'nao', rotulo: 'Não autorizou' },
      ].map((opcao) => (
        <label
          key={opcao.valor}
          className="alvo-toque flex cursor-pointer items-center gap-3 rounded-campo border border-divisor px-3 has-checked:border-primaria"
        >
          <input
            type="radio"
            value={opcao.valor}
            className="size-4 accent-primaria"
            {...register('consentimento')}
          />
          <span className="text-texto">{opcao.rotulo}</span>
        </label>
      ))}
      <p
        id={`${id}-erro`}
        aria-live="polite"
        className="text-sm font-medium text-erro empty:hidden"
      >
        {erro}
      </p>
    </fieldset>
  )
}
