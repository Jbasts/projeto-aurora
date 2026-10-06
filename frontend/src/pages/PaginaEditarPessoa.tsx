import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Botao } from '../components/Botao'
import { TelaCarregando } from '../components/TelaCarregando'
import { TituloPagina } from '../components/TituloPagina'
import { useAtualizarPessoa, usePessoa } from '../features/pessoas/api'
import { CampoConsentimento, CamposPessoa } from '../features/pessoas/CamposPessoa'
import {
  esquemaPessoa,
  paraDadosApi,
  paraFormulario,
  type DadosPessoa,
} from '../features/pessoas/esquemas'
import { nomeCompleto } from '../features/pessoas/nomes'
import type { Pessoa } from '../features/pessoas/tipos'
import { useTituloDocumento } from '../hooks/useTituloDocumento'
import type { EstadoPerfilPessoa } from './PaginaCadastroPessoa'
import { PaginaNaoEncontrada } from './PaginaNaoEncontrada'

export function PaginaEditarPessoa() {
  const { id = '' } = useParams()
  const consulta = usePessoa(id)

  if (consulta.isPending) return <TelaCarregando />
  if (consulta.isError) {
    if (consulta.error instanceof ErroApi && consulta.error.status === 404) {
      return <PaginaNaoEncontrada />
    }
    return <Alerta tipo="erro">Não foi possível carregar a pessoa. {consulta.error.message}</Alerta>
  }
  return <FormularioEdicao pessoa={consulta.data} />
}

const CAMPOS = Object.keys(esquemaPessoa.shape) as (keyof DadosPessoa)[]

/** Mesmos campos do cadastro, numa tela única dividida em seções (seção 3.7). */
function FormularioEdicao({ pessoa }: { pessoa: Pessoa }) {
  useTituloDocumento(`Editar ${nomeCompleto(pessoa)}`)
  const navigate = useNavigate()
  const atualizar = useAtualizarPessoa(pessoa.id)
  const [erro, setErro] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosPessoa>({
    resolver: zodResolver(esquemaPessoa),
    defaultValues: paraFormulario(pessoa),
  })

  const salvar = handleSubmit(async (dados) => {
    setErro(null)
    try {
      await atualizar.mutateAsync(paraDadosApi(dados))
      const estado: EstadoPerfilPessoa = { aviso: 'Dados atualizados.' }
      navigate(`/pessoas/${pessoa.id}`, { state: estado })
    } catch (e) {
      if (e instanceof ErroApi && e.campos.length > 0) {
        for (const { campo, mensagem } of e.campos) {
          const nome = CAMPOS.find((c) => c === campo)
          if (nome) setError(nome, { message: mensagem }, { shouldFocus: true })
        }
        setErro('Revise os campos destacados.')
      } else {
        setErro(e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO)
      }
    }
  })

  return (
    <>
      <TituloPagina texto="Editar" destaque={nomeCompleto(pessoa)} />
      {erro && (
        <div className="mb-6">
          <Alerta tipo="erro">{erro}</Alerta>
        </div>
      )}
      <form onSubmit={salvar} noValidate className="flex flex-col gap-8">
        <CamposPessoa register={register} errors={errors} />
        <section aria-labelledby="secao-consentimento" className="flex flex-col gap-4">
          <h2 id="secao-consentimento" className="text-lg font-semibold text-texto">
            Consentimento
          </h2>
          <CampoConsentimento register={register} errors={errors} />
          <p className="text-sm text-texto-suave">As fotos são gerenciadas no perfil da pessoa.</p>
        </section>
        <div className="flex flex-col-reverse gap-3 border-t border-divisor pt-6 sm:flex-row sm:justify-end">
          <Link
            to={`/pessoas/${pessoa.id}`}
            className="alvo-toque inline-flex items-center justify-center rounded-botao border border-borda-campo px-6 font-semibold text-texto hover:bg-fundo-topo"
          >
            Cancelar
          </Link>
          <Botao type="submit" carregando={atualizar.isPending}>
            Salvar alterações
          </Botao>
        </div>
      </form>
    </>
  )
}
