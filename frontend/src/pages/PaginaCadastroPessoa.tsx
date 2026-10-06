import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Botao } from '../components/Botao'
import { CampoArquivo } from '../components/formulario/CampoArquivo'
import { CampoTexto } from '../components/formulario/CampoTexto'
import { Ondas } from '../components/Ondas'
import { TituloPagina } from '../components/TituloPagina'
import { paraCampoDataHora } from '../features/comum/datas'
import { enviarFoto, useCadastrarPessoa } from '../features/pessoas/api'
import { AvisoDuplicidade } from '../features/pessoas/AvisoDuplicidade'
import { CampoConsentimento, CamposPessoa } from '../features/pessoas/CamposPessoa'
import {
  erroDaFoto,
  esquemaPessoa,
  MAXIMO_FOTOS_ALBUM,
  PESSOA_VAZIA,
  paraDadosApi,
  type DadosPessoa,
} from '../features/pessoas/esquemas'
import { SeletorLocal } from '../features/pessoas/SeletorLocal'
import type { Coordenadas } from '../features/pessoas/tipos'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

const ETAPAS = ['Dados pessoais e contato', 'Consentimento e fotos', 'Onde foi vista'] as const

const CAMPOS_ETAPA_1 = [
  'nome',
  'sobrenome',
  'apelido',
  'idade_aproximada',
  'email',
  'telefone',
  'nome_contato',
  'telefone_contato',
  'observacoes',
] as const

interface FotoEscolhida {
  arquivo: File
  previa: string
  legenda: string
}

export interface EstadoPerfilPessoa {
  aviso?: string
  /** Fotos que não puderam ser enviadas depois do cadastro. */
  falhas?: number
}

export function PaginaCadastroPessoa() {
  useTituloDocumento('Cadastrar pessoa')
  const navigate = useNavigate()
  const cadastrar = useCadastrarPessoa()

  const [etapa, setEtapa] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const tituloEtapa = useRef<HTMLHeadingElement>(null)

  const [fotoPerfil, setFotoPerfil] = useState<FotoEscolhida | null>(null)
  const [album, setAlbum] = useState<FotoEscolhida[]>([])
  const [erroFotos, setErroFotos] = useState<string | null>(null)

  const [local, setLocal] = useState<Coordenadas | null>(null)
  const [vistoEm, setVistoEm] = useState(() => paraCampoDataHora(new Date()))
  const [erroVistoEm, setErroVistoEm] = useState<string | null>(null)

  const {
    register,
    trigger,
    getValues,
    setError,
    control,
    formState: { errors },
  } = useForm<DadosPessoa>({ resolver: zodResolver(esquemaPessoa), defaultValues: PESSOA_VAZIA })
  const [nome, sobrenome, apelido, consentimento] = useWatch({
    control,
    name: ['nome', 'sobrenome', 'apelido', 'consentimento'],
  })
  const podeEnviarFotos = consentimento === 'sim'

  // Libera as prévias das fotos ao sair da página.
  const previas = useRef<string[]>([])
  useEffect(() => () => previas.current.forEach((url) => URL.revokeObjectURL(url)), [])
  const escolher = (arquivo: File): FotoEscolhida => {
    const previa = URL.createObjectURL(arquivo)
    previas.current.push(previa)
    return { arquivo, previa, legenda: '' }
  }

  const irPara = (nova: number) => {
    setErro(null)
    setEtapa(nova)
    // Leva o foco (e o leitor de tela) para o título da nova etapa.
    requestAnimationFrame(() => tituloEtapa.current?.focus())
  }

  const proxima = async () => {
    const valido =
      etapa === 0
        ? await trigger([...CAMPOS_ETAPA_1], { shouldFocus: true })
        : await trigger('consentimento', { shouldFocus: true })
    if (valido) irPara(etapa + 1)
  }

  const finalizar = async (comLocal: boolean) => {
    setErro(null)
    let avistamento = null
    if (comLocal) {
      if (!local) {
        setErro('Marque no mapa onde a pessoa foi vista ou escolha "Pular por enquanto".')
        return
      }
      const data = new Date(vistoEm)
      if (!vistoEm || Number.isNaN(data.getTime())) {
        setErroVistoEm('Informe a data e a hora.')
        return
      }
      if (data.getTime() > Date.now() + 60_000) {
        setErroVistoEm('A data e a hora não podem estar no futuro.')
        return
      }
      setErroVistoEm(null)
      avistamento = { ...local, visto_em: data.toISOString() }
    }

    setEnviando(true)
    try {
      const pessoa = await cadastrar.mutateAsync({
        ...paraDadosApi(getValues()),
        avistamento,
      })
      // As fotos vão depois do cadastro; uma falha aqui não desfaz a pessoa cadastrada.
      let falhas = 0
      if (pessoa.consentimento) {
        const envios = [
          ...(fotoPerfil ? [{ tipo: 'PERFIL' as const, ...fotoPerfil }] : []),
          ...album.map((foto) => ({ tipo: 'ALBUM' as const, ...foto })),
        ]
        for (const envio of envios) {
          try {
            await enviarFoto({ pessoaId: pessoa.id, ...envio })
          } catch {
            falhas += 1
          }
        }
      }
      const estado: EstadoPerfilPessoa = { aviso: 'Pessoa cadastrada.', falhas }
      navigate(`/pessoas/${pessoa.id}`, { state: estado })
    } catch (e) {
      setEnviando(false)
      if (e instanceof ErroApi && e.campos.length > 0) {
        const primeiroCampo = e.campos[0].campo
        const campoDaEtapa1 = CAMPOS_ETAPA_1.find((c) => c === primeiroCampo)
        for (const { campo, mensagem } of e.campos) {
          const nomeCampo = [...CAMPOS_ETAPA_1, 'consentimento' as const].find((c) => c === campo)
          if (nomeCampo) setError(nomeCampo, { message: mensagem })
        }
        if (campoDaEtapa1) irPara(0)
        setErro('Revise os campos destacados.')
      } else {
        setErro(e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO)
      }
    }
  }

  const adicionarAoAlbum = (arquivos: FileList | null) => {
    setErroFotos(null)
    const lista = [...(arquivos ?? [])]
    const invalida = lista.map(erroDaFoto).find(Boolean)
    if (invalida) {
      setErroFotos(invalida)
      return
    }
    if (album.length + lista.length > MAXIMO_FOTOS_ALBUM) {
      setErroFotos(`O álbum aceita até ${MAXIMO_FOTOS_ALBUM} fotos.`)
      return
    }
    setAlbum((atual) => [...atual, ...lista.map(escolher)])
  }

  return (
    <>
      <TituloPagina texto="Cadastro de pessoas em" destaque="situação de rua" />

      <ol aria-label="Etapas do cadastro" className="mb-8 grid gap-2 sm:grid-cols-3">
        {ETAPAS.map((rotulo, indice) => {
          const atual = indice === etapa
          const feita = indice < etapa
          return (
            <li
              key={rotulo}
              aria-current={atual ? 'step' : undefined}
              className={`flex items-center gap-3 rounded-card border p-3 text-sm ${
                atual
                  ? 'border-primaria font-semibold text-texto'
                  : 'border-divisor text-texto-suave'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full font-bold ${
                  atual || feita
                    ? 'bg-primaria text-sobre-primaria'
                    : 'border border-borda-campo text-texto-suave'
                }`}
              >
                {feita ? '✓' : indice + 1}
              </span>
              <span>
                <span className="sr-only">
                  Etapa {indice + 1} de {ETAPAS.length}
                  {feita ? ', concluída' : ''}:{' '}
                </span>
                {rotulo}
              </span>
            </li>
          )
        })}
      </ol>

      <h2
        ref={tituloEtapa}
        tabIndex={-1}
        className="sr-only"
      >{`Etapa ${etapa + 1} de ${ETAPAS.length}: ${ETAPAS[etapa]}`}</h2>

      {erro && (
        <div className="mb-6">
          <Alerta tipo="erro">{erro}</Alerta>
        </div>
      )}

      <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-8">
        <div hidden={etapa !== 0} className="flex flex-col gap-8">
          <CamposPessoa register={register} errors={errors} />
          <AvisoDuplicidade nome={nome} sobrenome={sobrenome} apelido={apelido} />
        </div>

        <div hidden={etapa !== 1} className="flex flex-col gap-8">
          <CampoConsentimento register={register} errors={errors} />

          {consentimento === 'nao' && (
            <Alerta tipo="info">
              Sem a autorização da pessoa, não é possível enviar fotos. Você pode continuar o
              cadastro sem fotos.
            </Alerta>
          )}

          {podeEnviarFotos && (
            <section aria-labelledby="titulo-fotos" className="flex flex-col gap-6">
              <h3 id="titulo-fotos" className="text-lg font-semibold text-texto">
                Fotos (opcional)
              </h3>
              {erroFotos && <Alerta tipo="erro">{erroFotos}</Alerta>}

              <div className="flex flex-wrap items-center gap-4">
                {fotoPerfil && (
                  <img
                    src={fotoPerfil.previa}
                    alt="Prévia da foto de perfil"
                    className="size-24 rounded-full object-cover"
                  />
                )}
                <CampoArquivo
                  rotulo={fotoPerfil ? 'Trocar foto de perfil' : 'Escolher foto de perfil'}
                  aoEscolher={(arquivos) => {
                    setErroFotos(null)
                    const arquivo = arquivos?.[0]
                    if (!arquivo) return
                    const invalida = erroDaFoto(arquivo)
                    if (invalida) setErroFotos(invalida)
                    else setFotoPerfil(escolher(arquivo))
                  }}
                />
                {fotoPerfil && (
                  <Botao variante="secundario" onClick={() => setFotoPerfil(null)}>
                    Remover foto de perfil
                  </Botao>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <CampoArquivo
                  rotulo={`Adicionar fotos ao álbum (${album.length} de ${MAXIMO_FOTOS_ALBUM})`}
                  multiplo
                  aoEscolher={adicionarAoAlbum}
                />
                {album.length > 0 && (
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {album.map((foto, indice) => (
                      <li
                        key={foto.previa}
                        className="flex flex-col gap-2 rounded-card border border-divisor p-3"
                      >
                        <img
                          src={foto.previa}
                          alt={`Prévia da foto ${indice + 1} do álbum`}
                          className="aspect-[4/3] w-full rounded-campo object-cover"
                        />
                        <CampoTexto
                          rotulo={`Legenda da foto ${indice + 1} (opcional)`}
                          maxLength={255}
                          value={foto.legenda}
                          onChange={(e) =>
                            setAlbum((atual) =>
                              atual.map((f) =>
                                f.previa === foto.previa ? { ...f, legenda: e.target.value } : f,
                              ),
                            )
                          }
                        />
                        <Botao
                          variante="secundario"
                          onClick={() =>
                            setAlbum((atual) => atual.filter((f) => f.previa !== foto.previa))
                          }
                        >
                          Remover do álbum
                        </Botao>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </div>

        {etapa === 2 && (
          <div className="flex flex-col gap-6">
            <p className="text-texto-suave">
              Esta etapa é opcional. Você pode registrar onde a pessoa foi vista depois.
            </p>
            <SeletorLocal valor={local} aoMudar={setLocal} />
            <div className="max-w-xs">
              <CampoTexto
                rotulo="Data e hora em que foi vista"
                type="datetime-local"
                value={vistoEm}
                max={paraCampoDataHora(new Date())}
                erro={erroVistoEm ?? undefined}
                onChange={(e) => setVistoEm(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-divisor pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Botao
            variante="secundario"
            disabled={etapa === 0 || enviando}
            onClick={() => irPara(etapa - 1)}
          >
            Anterior
          </Botao>
          {etapa < 2 ? (
            <Botao onClick={proxima}>Próximo</Botao>
          ) : (
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Botao variante="secundario" disabled={enviando} onClick={() => finalizar(false)}>
                Pular por enquanto
              </Botao>
              <Botao carregando={enviando} onClick={() => finalizar(true)}>
                Cadastrar pessoa
              </Botao>
            </div>
          )}
        </div>
      </form>

      <Ondas className="mx-auto mt-10 h-16 w-full max-w-md" />
    </>
  )
}
