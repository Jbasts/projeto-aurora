import { useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { ErroApi, MENSAGEM_SEM_CONEXAO } from '../api/cliente'
import { Alerta } from '../components/Alerta'
import { Avatar } from '../components/Avatar'
import { Botao } from '../components/Botao'
import { CampoAreaTexto } from '../components/formulario/CampoAreaTexto'
import { CampoArquivo } from '../components/formulario/CampoArquivo'
import { CampoTexto } from '../components/formulario/CampoTexto'
import { Mapa } from '../components/mapa/MapaSobDemanda'
import { Modal } from '../components/Modal'
import { TelaCarregando } from '../components/TelaCarregando'
import { useUsuarioLogado } from '../contexts/autenticacao'
import { formatarData, formatarDataHora } from '../features/comum/datas'
import {
  useEnviarFoto,
  useInativarPessoa,
  usePessoa,
  useReativarPessoa,
  useRemoverFoto,
} from '../features/pessoas/api'
import { erroDaFoto, MAXIMO_FOTOS_ALBUM } from '../features/pessoas/esquemas'
import { altFoto, iniciais, nomeCompleto } from '../features/pessoas/nomes'
import type { Foto, Pessoa } from '../features/pessoas/tipos'
import { useTituloDocumento } from '../hooks/useTituloDocumento'
import { PaginaNaoEncontrada } from './PaginaNaoEncontrada'
import type { EstadoPerfilPessoa } from './PaginaCadastroPessoa'

type Aviso = { tipo: 'sucesso' | 'erro'; texto: string } | null

const mensagemDeErro = (e: unknown) => (e instanceof ErroApi ? e.message : MENSAGEM_SEM_CONEXAO)

export function PaginaPerfilPessoa() {
  const { id = '' } = useParams()
  const consulta = usePessoa(id)

  if (consulta.isPending) return <TelaCarregando />
  if (consulta.isError) {
    if (consulta.error instanceof ErroApi && consulta.error.status === 404) {
      return <PaginaNaoEncontrada />
    }
    return <Alerta tipo="erro">Não foi possível carregar a pessoa. {consulta.error.message}</Alerta>
  }
  return <PerfilPessoa pessoa={consulta.data} />
}

function PerfilPessoa({ pessoa }: { pessoa: Pessoa }) {
  useTituloDocumento(nomeCompleto(pessoa))
  const usuario = useUsuarioLogado()
  const gestor = usuario.perfil === 'ADMIN' || usuario.perfil === 'COLABORADOR'
  const estado = useLocation().state as EstadoPerfilPessoa | null

  const [aviso, setAviso] = useState<Aviso>(() =>
    estado?.aviso
      ? {
          tipo: estado.falhas ? 'erro' : 'sucesso',
          texto: estado.falhas
            ? `${estado.aviso} ${estado.falhas} foto(s) não puderam ser enviadas; tente de novo no álbum.`
            : estado.aviso,
        }
      : null,
  )
  const [inativando, setInativando] = useState(false)
  const reativar = useReativarPessoa(pessoa.id)
  const inativa = pessoa.status === 'INATIVA'

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-6 border-b border-divisor pb-6 md:flex-row md:items-center">
        <Avatar
          url={pessoa.foto_perfil?.url_miniatura}
          iniciais={iniciais(pessoa)}
          alt={pessoa.foto_perfil ? altFoto(pessoa) : ''}
          tamanho="grande"
        />
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-texto md:text-3xl">
              {nomeCompleto(pessoa)}
            </h1>
            <span
              className={`rounded-full border px-3 py-0.5 text-sm ${
                inativa ? 'border-divisor text-texto-suave' : 'border-primaria text-primaria'
              }`}
            >
              {inativa ? 'Inativa' : 'Ativa'}
            </span>
          </div>
          {pessoa.apelido && (
            <p className="text-lg text-primaria">
              <span className="sr-only">Apelido: </span>"{pessoa.apelido}"
            </p>
          )}
          <p className="text-sm text-texto-suave">
            Cadastrada por {pessoa.cadastrada_por?.nome ?? 'pessoa removida'} em{' '}
            {formatarData(pessoa.criado_em)}
          </p>
        </div>
        {gestor && (
          <div className="flex flex-wrap gap-3">
            <Link
              to={`/pessoas/${pessoa.id}/editar`}
              className="alvo-toque inline-flex items-center justify-center rounded-botao bg-primaria px-6 font-semibold text-sobre-primaria hover:bg-primaria-hover"
            >
              Editar
            </Link>
            {inativa ? (
              <Botao
                variante="secundario"
                carregando={reativar.isPending}
                onClick={async () => {
                  try {
                    await reativar.mutateAsync()
                    setAviso({ tipo: 'sucesso', texto: 'Pessoa reativada.' })
                  } catch (e) {
                    setAviso({ tipo: 'erro', texto: mensagemDeErro(e) })
                  }
                }}
              >
                Reativar
              </Botao>
            ) : (
              <Botao variante="secundario" onClick={() => setInativando(true)}>
                Inativar
              </Botao>
            )}
          </div>
        )}
      </header>

      {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}

      {inativa && (
        <Alerta tipo="info">
          Pessoa inativa desde {pessoa.inativada_em ? formatarData(pessoa.inativada_em) : '—'}
          {pessoa.inativada_por && ` (por ${pessoa.inativada_por.nome})`}. Ela não aparece no mapa
          nem no mapa de calor.
          {pessoa.motivo_inativacao && (
            <>
              <br />
              Motivo: {pessoa.motivo_inativacao}
            </>
          )}
        </Alerta>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao titulo="Dados e contato">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dado rotulo="Idade aproximada">
              {pessoa.idade_aproximada != null ? `${pessoa.idade_aproximada} anos` : null}
            </Dado>
            <Dado rotulo="Telefone">{pessoa.telefone}</Dado>
            <Dado rotulo="Email">{pessoa.email}</Dado>
            <Dado rotulo="Pessoa de referência">
              {[pessoa.nome_contato, pessoa.telefone_contato].filter(Boolean).join(' · ') || null}
            </Dado>
            <Dado rotulo="Consentimento" largo>
              {pessoa.consentimento
                ? `Autorizou o cadastro e o uso de fotos${
                    pessoa.consentimento_em ? ` em ${formatarData(pessoa.consentimento_em)}` : ''
                  }.`
                : 'Não autorizou o uso de fotos.'}
            </Dado>
            <Dado rotulo="Observações" largo>
              {pessoa.observacoes}
            </Dado>
          </dl>
        </Secao>

        <Secao titulo="Última localização">
          {pessoa.ultima_vez_visto &&
          pessoa.ultima_latitude != null &&
          pessoa.ultima_longitude != null ? (
            <div className="flex flex-col gap-3">
              <p className="text-texto">
                <span className="font-medium text-texto-suave">Visto por último em </span>
                {formatarDataHora(pessoa.ultima_vez_visto)}
              </p>
              <p className="text-sm text-texto-suave">
                {pessoa.ultimo_endereco ??
                  `Coordenadas: ${pessoa.ultima_latitude.toFixed(5)}, ${pessoa.ultima_longitude.toFixed(5)}`}
              </p>
              <Mapa
                rotulo={`Minimapa com a última localização de ${nomeCompleto(pessoa)}`}
                className="h-56"
                estatico
                zoom={16}
                centro={[pessoa.ultima_latitude, pessoa.ultima_longitude]}
                marcador={{ latitude: pessoa.ultima_latitude, longitude: pessoa.ultima_longitude }}
              />
            </div>
          ) : (
            <p className="text-texto-suave">Ainda não há registro de onde a pessoa foi vista.</p>
          )}
        </Secao>
      </div>

      <Album pessoa={pessoa} gestor={gestor} aoAvisar={setAviso} />

      {inativando && (
        <ModalInativar
          pessoa={pessoa}
          aoFechar={() => setInativando(false)}
          aoConcluir={() => {
            setInativando(false)
            setAviso({ tipo: 'sucesso', texto: 'Pessoa inativada.' })
          }}
        />
      )}
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = `secao-${titulo.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-card border border-divisor p-5 md:p-6"
    >
      <h2 id={id} className="text-lg font-semibold text-texto">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

function Dado({
  rotulo,
  children,
  largo = false,
}: {
  rotulo: string
  children: ReactNode
  largo?: boolean
}) {
  return (
    <div className={largo ? 'sm:col-span-2' : undefined}>
      <dt className="text-sm font-medium text-texto-suave">{rotulo}</dt>
      <dd className="break-words whitespace-pre-line text-texto">
        {children ?? <span className="text-texto-suave">Não informado</span>}
      </dd>
    </div>
  )
}

// --- Álbum (seção 3.8) ---

function Album({
  pessoa,
  gestor,
  aoAvisar,
}: {
  pessoa: Pessoa
  gestor: boolean
  aoAvisar: (aviso: Aviso) => void
}) {
  const enviar = useEnviarFoto()
  const [aberta, setAberta] = useState<Foto | null>(null)
  const [legenda, setLegenda] = useState('')
  const podeEnviar = gestor && pessoa.consentimento
  const cheio = pessoa.album.length >= MAXIMO_FOTOS_ALBUM

  const enviarArquivo = async (tipo: 'PERFIL' | 'ALBUM', arquivo: File | undefined) => {
    if (!arquivo) return
    const invalida = erroDaFoto(arquivo)
    if (invalida) {
      aoAvisar({ tipo: 'erro', texto: invalida })
      return
    }
    try {
      await enviar.mutateAsync({ pessoaId: pessoa.id, tipo, arquivo, legenda })
      setLegenda('')
      aoAvisar({
        tipo: 'sucesso',
        texto: tipo === 'PERFIL' ? 'Foto de perfil atualizada.' : 'Foto adicionada ao álbum.',
      })
    } catch (e) {
      const campo = e instanceof ErroApi ? e.campos[0]?.mensagem : null
      aoAvisar({ tipo: 'erro', texto: campo ?? mensagemDeErro(e) })
    }
  }

  return (
    <Secao titulo="Fotos">
      {gestor && !pessoa.consentimento && (
        <p className="text-sm text-texto-suave">
          A pessoa não autorizou o uso de fotos. Para enviar fotos, edite o cadastro depois de obter
          a autorização.
        </p>
      )}

      {podeEnviar && (
        <div className="flex flex-col gap-4 rounded-campo bg-fundo-topo p-4">
          <div className="flex flex-wrap items-center gap-3">
            <CampoArquivo
              rotulo={pessoa.foto_perfil ? 'Trocar foto de perfil' : 'Adicionar foto de perfil'}
              aoEscolher={(arquivos) => enviarArquivo('PERFIL', arquivos?.[0])}
            />
            {pessoa.foto_perfil && (
              <BotaoRemoverFoto
                pessoa={pessoa}
                foto={pessoa.foto_perfil}
                rotulo="Remover foto de perfil"
                aoAvisar={aoAvisar}
              />
            )}
          </div>
          {cheio ? (
            <p className="text-sm text-texto-suave">
              O álbum chegou ao limite de {MAXIMO_FOTOS_ALBUM} fotos.
            </p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="sm:w-72">
                <CampoTexto
                  rotulo="Legenda da nova foto (opcional)"
                  maxLength={255}
                  value={legenda}
                  onChange={(e) => setLegenda(e.target.value)}
                />
              </div>
              <CampoArquivo
                rotulo={`Adicionar ao álbum (${pessoa.album.length} de ${MAXIMO_FOTOS_ALBUM})`}
                aoEscolher={(arquivos) => enviarArquivo('ALBUM', arquivos?.[0])}
              />
            </div>
          )}
          {enviar.isPending && (
            <p role="status" className="text-sm text-texto">
              Enviando foto…
            </p>
          )}
        </div>
      )}

      {pessoa.album.length === 0 ? (
        <p className="text-texto-suave">Nenhuma foto no álbum.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pessoa.album.map((foto, indice) => (
            <li key={foto.id}>
              <button
                type="button"
                onClick={() => setAberta(foto)}
                className="block w-full overflow-hidden rounded-campo"
              >
                <img
                  src={foto.url_miniatura}
                  alt={`${altFoto(pessoa)} — ${foto.legenda ?? `foto ${indice + 1} do álbum`}`}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform hover:scale-105"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {aberta && (
        <Modal titulo={aberta.legenda ?? 'Foto do álbum'} aoFechar={() => setAberta(null)}>
          <img
            src={aberta.url}
            alt={`${altFoto(pessoa)}${aberta.legenda ? ` — ${aberta.legenda}` : ''}`}
            className="max-h-[60vh] w-full rounded-campo object-contain"
          />
          <p className="text-sm text-texto-suave">
            Enviada por {aberta.enviada_por?.nome ?? 'pessoa removida'} em{' '}
            {formatarDataHora(aberta.criado_em)}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Botao variante="secundario" onClick={() => setAberta(null)}>
              Fechar
            </Botao>
            {gestor && (
              <BotaoRemoverFoto
                pessoa={pessoa}
                foto={aberta}
                rotulo="Remover foto"
                aoAvisar={aoAvisar}
                aoRemover={() => setAberta(null)}
              />
            )}
          </div>
        </Modal>
      )}
    </Secao>
  )
}

/** Remover pede confirmação (seção 3.8). */
function BotaoRemoverFoto({
  pessoa,
  foto,
  rotulo,
  aoAvisar,
  aoRemover,
}: {
  pessoa: Pessoa
  foto: Foto
  rotulo: string
  aoAvisar: (aviso: Aviso) => void
  aoRemover?: () => void
}) {
  const remover = useRemoverFoto(pessoa.id)
  const [confirmando, setConfirmando] = useState(false)

  if (!confirmando) {
    return (
      <Botao variante="secundario" onClick={() => setConfirmando(true)}>
        {rotulo}
      </Botao>
    )
  }
  return (
    <div role="group" aria-label="Confirmar remoção" className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-texto">Remover esta foto?</span>
      <Botao variante="secundario" onClick={() => setConfirmando(false)}>
        Cancelar
      </Botao>
      <Botao
        carregando={remover.isPending}
        onClick={async () => {
          try {
            await remover.mutateAsync(foto.id)
            aoRemover?.()
            aoAvisar({ tipo: 'sucesso', texto: 'Foto removida.' })
          } catch (e) {
            aoAvisar({ tipo: 'erro', texto: mensagemDeErro(e) })
          } finally {
            setConfirmando(false)
          }
        }}
      >
        Sim, remover
      </Botao>
    </div>
  )
}

// --- Inativação (seção 3.7) ---

function ModalInativar({
  pessoa,
  aoFechar,
  aoConcluir,
}: {
  pessoa: Pessoa
  aoFechar: () => void
  aoConcluir: () => void
}) {
  const inativar = useInativarPessoa(pessoa.id)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  return (
    <Modal titulo={`Inativar ${nomeCompleto(pessoa)}`} aoFechar={aoFechar}>
      <p className="text-texto">
        A pessoa deixa de aparecer no mapa e no mapa de calor, e pessoas usuárias não a encontram
        mais. O cadastro não é apagado e pode ser reativado depois.
      </p>
      <CampoAreaTexto
        rotulo="Motivo (opcional)"
        rows={3}
        maxLength={500}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Botao variante="secundario" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao
          carregando={inativar.isPending}
          onClick={async () => {
            setErro(null)
            try {
              await inativar.mutateAsync(motivo)
              aoConcluir()
            } catch (e) {
              setErro(mensagemDeErro(e))
            }
          }}
        >
          Inativar
        </Botao>
      </div>
    </Modal>
  )
}
