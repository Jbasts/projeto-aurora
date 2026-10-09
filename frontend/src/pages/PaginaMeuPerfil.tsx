import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import {
  FormProvider,
  useForm,
  useWatch,
  type FieldValues,
  type Path,
  type UseFormSetError,
} from 'react-hook-form'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Botao } from '../components/Botao'
import { CampoSenha } from '../components/formulario/CampoSenha'
import { CampoTexto } from '../components/formulario/CampoTexto'
import { mascaraTelefone } from '../components/formulario/mascaras'
import { RequisitosSenha } from '../components/formulario/RequisitosSenha'
import { TituloPagina } from '../components/TituloPagina'
import { useAutenticacao, useUsuarioLogado } from '../contexts/autenticacao'
import { CamposEndereco } from '../features/enderecos/CamposEndereco'
import { AlteracaoEmailCpf } from '../features/usuarios/AlteracaoEmailCpf'
import { CampoDataNascimento } from '../features/usuarios/CampoDataNascimento'
import { FotoDaConta } from '../features/usuarios/FotoDaConta'
import { enderecoInicial, NOMES_CAMPOS_ENDERECO } from '../features/enderecos/esquemas'
import { useAtualizarMeusDados, useTrocarSenha } from '../features/usuarios/api'
import {
  esquemaMeusDados,
  esquemaTrocarSenha,
  type DadosMeusDados,
  type DadosTrocarSenha,
} from '../features/usuarios/esquemas'
import { ROTULOS_PERFIL } from '../features/usuarios/perfis'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

type Aviso = { tipo: 'sucesso' | 'erro'; texto: string } | null

/** Leva os erros de campo da API para o formulário; devolve a mensagem geral, se houver. */
function aplicarErrosDaApi<T extends FieldValues>(
  erro: unknown,
  campos: readonly Path<T>[],
  setError: UseFormSetError<T>,
): string | null {
  if (erro instanceof ErroApi && erro.campos.length > 0) {
    let geral: string | null = null
    for (const { campo, mensagem } of erro.campos) {
      const nome = campos.find((c) => c === campo)
      if (nome) setError(nome, { message: mensagem }, { shouldFocus: true })
      else geral = mensagem
    }
    return geral
  }
  return erro instanceof ErroApi ? erro.message : MENSAGEM_SEM_CONEXAO
}

const estiloSecao = 'flex flex-col gap-4 rounded-card border border-divisor p-5 md:p-6'

export function PaginaMeuPerfil() {
  useTituloDocumento('Meu perfil')
  const usuario = useUsuarioLogado()

  return (
    <>
      <TituloPagina texto="Meu" destaque="perfil" />
      <div className="grid gap-6 lg:grid-cols-2">
        <SecaoDados key={usuario.id} />
        <section aria-labelledby="titulo-senha" className={estiloSecao}>
          <h2 id="titulo-senha" className="text-lg font-semibold text-texto">
            Trocar senha
          </h2>
          <FormularioSenha />
        </section>
      </div>
    </>
  )
}

function SecaoDados() {
  const usuario = useUsuarioLogado()
  const { atualizarUsuario } = useAutenticacao()
  const atualizar = useAtualizarMeusDados()
  const [aviso, setAviso] = useState<Aviso>(null)

  const formulario = useForm<DadosMeusDados>({
    resolver: zodResolver(esquemaMeusDados),
    defaultValues: {
      nome: usuario.nome,
      sobrenome: usuario.sobrenome ?? '',
      data_nascimento: usuario.data_nascimento ?? '',
      telefone: usuario.telefone ?? '',
      ...enderecoInicial(usuario),
    },
  })
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = formulario

  const enviar = handleSubmit(async (dados) => {
    setAviso(null)
    try {
      atualizarUsuario(await atualizar.mutateAsync(dados))
      setAviso({ tipo: 'sucesso', texto: 'Dados atualizados.' })
    } catch (e) {
      const geral = aplicarErrosDaApi(
        e,
        ['nome', 'sobrenome', 'data_nascimento', 'telefone', ...NOMES_CAMPOS_ENDERECO],
        setError,
      )
      if (geral) setAviso({ tipo: 'erro', texto: geral })
    }
  })

  const telefone = register('telefone')

  return (
    <section aria-labelledby="titulo-dados" className={estiloSecao}>
      <h2 id="titulo-dados" className="text-lg font-semibold text-texto">
        Dados da conta
      </h2>

      <FotoDaConta />

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-texto-suave">Email</dt>
          <dd className="break-all text-texto">{usuario.email}</dd>
        </div>
        <div>
          <dt className="font-medium text-texto-suave">CPF</dt>
          <dd className="text-texto">{usuario.cpf_mascarado ?? 'Não informado'}</dd>
        </div>
        <div>
          <dt className="font-medium text-texto-suave">Perfil de acesso</dt>
          <dd className="text-texto">{ROTULOS_PERFIL[usuario.perfil]}</dd>
        </div>
      </dl>
      <AlteracaoEmailCpf />

      {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}

      <FormProvider {...formulario}>
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
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
          <CampoDataNascimento />
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
          <CamposEndereco />
          <Botao type="submit" carregando={atualizar.isPending} className="self-start">
            Salvar dados
          </Botao>
        </form>
      </FormProvider>
    </section>
  )
}

function FormularioSenha() {
  const trocar = useTrocarSenha()
  const [aviso, setAviso] = useState<Aviso>(null)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors },
  } = useForm<DadosTrocarSenha>({
    resolver: zodResolver(esquemaTrocarSenha),
    defaultValues: { senha_atual: '', senha: '', confirmar_senha: '' },
  })
  const senha = useWatch({ control, name: 'senha' })

  const enviar = handleSubmit(async (dados) => {
    setAviso(null)
    try {
      await trocar.mutateAsync(dados)
      reset()
      setAviso({ tipo: 'sucesso', texto: 'Senha alterada.' })
    } catch (e) {
      const geral = aplicarErrosDaApi(e, ['senha_atual', 'senha', 'confirmar_senha'], setError)
      if (geral) setAviso({ tipo: 'erro', texto: geral })
    }
  })

  return (
    <>
      {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoSenha
          rotulo="Senha atual"
          autoComplete="current-password"
          erro={errors.senha_atual?.message}
          {...register('senha_atual')}
        />
        <CampoSenha
          rotulo="Nova senha"
          autoComplete="new-password"
          erro={errors.senha?.message}
          dica={<RequisitosSenha senha={senha} />}
          {...register('senha')}
        />
        <CampoSenha
          rotulo="Confirmar nova senha"
          autoComplete="new-password"
          erro={errors.confirmar_senha?.message}
          {...register('confirmar_senha')}
        />
        <Botao type="submit" carregando={trocar.isPending} className="self-start">
          Alterar senha
        </Botao>
      </form>
    </>
  )
}
