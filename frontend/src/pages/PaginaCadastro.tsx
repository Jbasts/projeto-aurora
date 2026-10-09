import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Botao } from '../components/Botao'
import { CampoFoto } from '../components/formulario/CampoFoto'
import { CampoSenha } from '../components/formulario/CampoSenha'
import { CampoTexto } from '../components/formulario/CampoTexto'
import { mascaraCpf, mascaraTelefone } from '../components/formulario/mascaras'
import { RequisitosSenha } from '../components/formulario/RequisitosSenha'
import { CartaoAutenticacao, estiloLink } from '../components/layout/CartaoAutenticacao'
import { useCadastrar } from '../features/auth/api'
import { esquemaCadastro, type DadosCadastro } from '../features/auth/esquemas'
import { CamposEndereco } from '../features/enderecos/CamposEndereco'
import { ENDERECO_VAZIO, NOMES_CAMPOS_ENDERECO } from '../features/enderecos/esquemas'
import { CampoDataNascimento } from '../features/usuarios/CampoDataNascimento'
import { iniciaisDaConta } from '../features/usuarios/conta'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

const CAMPOS = [
  'nome',
  'sobrenome',
  'cpf',
  'data_nascimento',
  'email',
  'telefone',
  'foto',
  'senha',
  'confirmar_senha',
  ...NOMES_CAMPOS_ENDERECO,
] as const

/** Estado da navegação para /cadastro-enviado: o email, para reenviar a confirmação. */
export interface EstadoCadastroEnviado {
  email: string
}

const estiloSecao = 'flex flex-col gap-4'

export function PaginaCadastro() {
  useTituloDocumento('Cadastrar')
  const navigate = useNavigate()
  const cadastrar = useCadastrar()
  const [erro, setErro] = useState<string | null>(null)

  const formulario = useForm<DadosCadastro>({
    resolver: zodResolver(esquemaCadastro),
    defaultValues: {
      nome: '',
      sobrenome: '',
      data_nascimento: '',
      cpf: '',
      email: '',
      telefone: '',
      senha: '',
      confirmar_senha: '',
      ...ENDERECO_VAZIO,
    },
  })
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitted },
  } = formulario
  const senha = useWatch({ control, name: 'senha' })
  const [nome, sobrenome] = useWatch({ control, name: ['nome', 'sobrenome'] })
  const arquivoFoto = useWatch({ control, name: 'foto' })

  const enviar = handleSubmit(async (dados) => {
    setErro(null)
    try {
      await cadastrar.mutateAsync(dados)
      const estado: EstadoCadastroEnviado = { email: dados.email }
      navigate('/cadastro-enviado', { state: estado })
    } catch (e) {
      if (e instanceof ErroApi && e.campos.length > 0) {
        for (const { campo, mensagem } of e.campos) {
          const nome = CAMPOS.find((c) => c === campo)
          if (nome) setError(nome, { message: mensagem }, { shouldFocus: true })
          else setErro(mensagem)
        }
      } else {
        setErro(e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO)
      }
    }
  })

  const telefone = register('telefone')
  const cpf = register('cpf')
  // Só o ref (foco no erro) e o name: o arquivo escolhido entra por setValue.
  const { name: nomeFoto, ref: refFoto } = register('foto')

  return (
    <CartaoAutenticacao titulo="Cadastrar">
      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      <FormProvider {...formulario}>
        <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
          <fieldset className={estiloSecao}>
            <legend className="mb-1 text-base font-semibold text-texto">Seus dados</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto
                rotulo="Nome"
                autoComplete="given-name"
                erro={errors.nome?.message}
                {...register('nome')}
              />
              <CampoTexto
                rotulo="Sobrenome"
                autoComplete="family-name"
                erro={errors.sobrenome?.message}
                {...register('sobrenome')}
              />
            </div>
            <CampoTexto
              rotulo="CPF"
              inputMode="numeric"
              placeholder="000.000.000-00"
              maxLength={14}
              erro={errors.cpf?.message}
              {...cpf}
              onChange={(evento) => {
                evento.target.value = mascaraCpf(evento.target.value)
                return cpf.onChange(evento)
              }}
            />
            <CampoDataNascimento />
            <CampoTexto
              rotulo="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              dica="Vamos enviar um link para confirmar este email."
              erro={errors.email?.message}
              {...register('email')}
            />
            <CampoTexto
              rotulo="Celular"
              type="tel"
              autoComplete="tel-national"
              inputMode="tel"
              placeholder="(00) 00000-0000"
              erro={errors.telefone?.message}
              {...telefone}
              onChange={(evento) => {
                evento.target.value = mascaraTelefone(evento.target.value)
                return telefone.onChange(evento)
              }}
            />
            <CampoFoto
              rotulo="Sua foto"
              arquivo={arquivoFoto}
              aoEscolher={(arquivo) =>
                setValue('foto', arquivo ?? (undefined as unknown as File), {
                  shouldValidate: isSubmitted,
                })
              }
              iniciais={iniciaisDaConta({ nome: nome ?? '', sobrenome })}
              dica="Uma foto do seu rosto, em JPG, PNG ou WEBP, com até 5 MB. Ela aparece para a equipe do projeto."
              erro={errors.foto?.message}
              name={nomeFoto}
              ref={refFoto}
            />
          </fieldset>

          <CamposEndereco />

          <fieldset className={estiloSecao}>
            <legend className="mb-1 text-base font-semibold text-texto">Senha de acesso</legend>
            <CampoSenha
              rotulo="Senha"
              autoComplete="new-password"
              erro={errors.senha?.message}
              dica={<RequisitosSenha senha={senha} />}
              {...register('senha')}
            />
            <CampoSenha
              rotulo="Confirmar senha"
              autoComplete="new-password"
              erro={errors.confirmar_senha?.message}
              {...register('confirmar_senha')}
            />
          </fieldset>

          <Botao type="submit" carregando={cadastrar.isPending}>
            Cadastrar
          </Botao>
        </form>
      </FormProvider>

      <p className="text-center text-sm text-texto">
        Já possui cadastro?{' '}
        <Link to="/login" className={estiloLink}>
          Login
        </Link>
      </p>
    </CartaoAutenticacao>
  )
}
