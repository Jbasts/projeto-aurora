import { useFormContext, useWatch } from 'react-hook-form'

import { CampoTexto } from '../../components/formulario/CampoTexto'
import { calcularIdade, hojeNoCampoData, textoIdade } from '../comum/datas'

/** Data de nascimento com a idade calculada logo abaixo (cadastro e Meu perfil). */
export function CampoDataNascimento() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<{ data_nascimento: string }>()
  const valor = useWatch({ control, name: 'data_nascimento' })
  const idade = calcularIdade(valor ?? '')

  return (
    <CampoTexto
      rotulo="Data de nascimento"
      type="date"
      autoComplete="bday"
      max={hojeNoCampoData()}
      dica={idade !== null && idade >= 0 ? `Idade: ${textoIdade(idade)}` : undefined}
      erro={errors.data_nascimento?.message}
      {...register('data_nascimento')}
    />
  )
}
