import { useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'

import { CampoSelecao } from '../../components/formulario/CampoSelecao'
import { CampoTexto } from '../../components/formulario/CampoTexto'
import { mascaraCep } from '../../components/formulario/mascaras'
import { UFS, type DadosEndereco } from './esquemas'
import { useBuscarCep } from './viacep'

export const MENSAGEM_CEP_NAO_ENCONTRADO =
  'CEP não encontrado. Confira o número ou preencha o endereço manualmente.'
export const MENSAGEM_VIACEP_FORA =
  'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.'

const OPCOES_UF = [
  { valor: '', rotulo: 'Selecione' },
  ...UFS.map((uf) => ({ valor: uf, rotulo: uf })),
]

const CAMPOS_PREENCHIDOS_PELO_CEP = ['logradouro', 'bairro', 'cidade', 'uf'] as const

type Situacao = 'parado' | 'buscando' | 'encontrado'

const DICAS: Record<Situacao, string> = {
  parado: 'Digite o CEP para preencher o endereço automaticamente.',
  buscando: 'Buscando endereço…',
  encontrado: 'Endereço preenchido pelo CEP. Confira e informe o número.',
}

/**
 * Campos de endereço com preenchimento pelo ViaCEP. Usa o formulário do <FormProvider> em volta,
 * que precisa ter os campos de DadosEndereco.
 */
export function CamposEndereco() {
  const {
    register,
    setValue,
    setError,
    clearErrors,
    setFocus,
    formState: { errors },
  } = useFormContext<DadosEndereco>()
  const buscarCep = useBuscarCep()
  const [situacao, setSituacao] = useState<Situacao>('parado')
  // Último CEP consultado: evita repetir a consulta e descarta respostas atrasadas.
  const ultimoCep = useRef('')

  async function consultar(valor: string) {
    const digitos = valor.replace(/\D/g, '')
    if (digitos.length !== 8) {
      setSituacao('parado')
      return
    }
    if (digitos === ultimoCep.current) return
    ultimoCep.current = digitos
    setSituacao('buscando')
    clearErrors('cep')

    try {
      const endereco = await buscarCep(digitos)
      if (ultimoCep.current !== digitos) return
      if (!endereco) {
        setSituacao('parado')
        setError('cep', { message: MENSAGEM_CEP_NAO_ENCONTRADO })
        return
      }
      for (const campo of CAMPOS_PREENCHIDOS_PELO_CEP) {
        if (endereco[campo]) {
          setValue(campo, endereco[campo], { shouldValidate: true, shouldDirty: true })
        }
      }
      setSituacao('encontrado')
      // CEP geral de cidade pequena vem sem rua: aí a pessoa começa pela rua.
      setFocus(endereco.logradouro ? 'numero' : 'logradouro')
    } catch {
      if (ultimoCep.current !== digitos) return
      ultimoCep.current = '' // permite tentar de novo
      setSituacao('parado')
      setError('cep', { message: MENSAGEM_VIACEP_FORA })
    }
  }

  const cep = register('cep')

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-base font-semibold text-texto">Endereço</legend>

      <div className="sm:w-1/2">
        <CampoTexto
          rotulo="CEP"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          maxLength={9}
          aria-busy={situacao === 'buscando' || undefined}
          erro={errors.cep?.message}
          dica={<span aria-live="polite">{DICAS[situacao]}</span>}
          {...cep}
          onChange={(evento) => {
            evento.target.value = mascaraCep(evento.target.value)
            void consultar(evento.target.value)
            return cep.onChange(evento)
          }}
        />
      </div>
      <CampoTexto
        rotulo="Rua"
        autoComplete="address-line1"
        erro={errors.logradouro?.message}
        {...register('logradouro')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto rotulo="Número" erro={errors.numero?.message} {...register('numero')} />
        <CampoTexto
          rotulo="Complemento (opcional)"
          autoComplete="address-line2"
          erro={errors.complemento?.message}
          {...register('complemento')}
        />
      </div>
      <CampoTexto
        rotulo="Bairro (opcional)"
        erro={errors.bairro?.message}
        {...register('bairro')}
      />
      <div className="grid grid-cols-[1fr_7rem] gap-4">
        <CampoTexto
          rotulo="Cidade"
          autoComplete="address-level2"
          erro={errors.cidade?.message}
          {...register('cidade')}
        />
        <CampoSelecao
          rotulo="UF"
          autoComplete="address-level1"
          opcoes={OPCOES_UF}
          erro={errors.uf?.message ?? ''}
          {...register('uf')}
        />
      </div>
    </fieldset>
  )
}
