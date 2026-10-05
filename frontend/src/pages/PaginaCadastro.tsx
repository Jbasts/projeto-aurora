import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Botao } from '../components/Botao'
import { CampoSenha } from '../components/formulario/CampoSenha'
import { CampoTexto } from '../components/formulario/CampoTexto'
import { mascaraTelefone } from '../components/formulario/mascaras'
import { RequisitosSenha } from '../components/formulario/RequisitosSenha'
import { CartaoAutenticacao, estiloLink } from '../components/layout/CartaoAutenticacao'
import { useCadastrar } from '../features/auth/api'
import { esquemaCadastro, type DadosCadastro } from '../features/auth/esquemas'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

const CAMPOS = ['nome', 'email', 'telefone', 'senha', 'confirmar_senha'] as const

export function PaginaCadastro() {
  useTituloDocumento('Cadastrar')
  const navigate = useNavigate()
  const cadastrar = useCadastrar()
  const [erro, setErro] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<DadosCadastro>({
    resolver: zodResolver(esquemaCadastro),
    defaultValues: { nome: '', email: '', telefone: '', senha: '', confirmar_senha: '' },
  })
  const senha = useWatch({ control, name: 'senha' })

  const enviar = handleSubmit(async (dados) => {
    setErro(null)
    try {
      await cadastrar.mutateAsync(dados)
      navigate('/cadastro-enviado')
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

  return (
    <CartaoAutenticacao titulo="Cadastrar">
      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoTexto
          rotulo="Nome"
          autoComplete="name"
          erro={errors.nome?.message}
          {...register('nome')}
        />
        <CampoTexto
          rotulo="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          erro={errors.email?.message}
          {...register('email')}
        />
        <CampoTexto
          rotulo="Telefone (opcional)"
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
        <Botao type="submit" carregando={cadastrar.isPending}>
          Cadastrar
        </Botao>
      </form>

      <p className="text-center text-sm text-texto">
        Já possui cadastro?{' '}
        <Link to="/login" className={estiloLink}>
          Login
        </Link>
      </p>
    </CartaoAutenticacao>
  )
}
