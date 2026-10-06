import type { Map as MapaLeaflet } from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { Popup, useMap } from 'react-leaflet'
import { Link } from 'react-router'

import { Alerta } from '../components/Alerta'
import { Avatar } from '../components/Avatar'
import { Botao } from '../components/Botao'
import { CamadaMarcadores, type PontoNoMapa } from '../components/mapa/CamadaMarcadores'
import { Mapa } from '../components/mapa/Mapa'
import { TituloPagina } from '../components/TituloPagina'
import { useUsuarioLogado } from '../contexts/autenticacao'
import { formatarDataHora } from '../features/comum/datas'
import { useMarcadores, type Marcador } from '../features/mapa/api'
import { ModalRegistrarAvistamento } from '../features/mapa/ModalRegistrarAvistamento'
import { altFoto, iniciais, nomeCompleto } from '../features/pessoas/nomes'
import type { Coordenadas } from '../features/pessoas/tipos'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

function localizacao(marcador: Marcador): string {
  return (
    marcador.ultimo_endereco ?? `${marcador.latitude.toFixed(5)}, ${marcador.longitude.toFixed(5)}`
  )
}

/** Entrega a instância do Leaflet para os botões fora do mapa (GPS, centro do mapa). */
function CapturarMapa({ aoPronto }: { aoPronto: (mapa: MapaLeaflet | null) => void }) {
  const mapa = useMap()
  useEffect(() => {
    aoPronto(mapa)
    // Ao sair da tela (ex.: "Ver como lista"), a instância é destruída: não guardar referência.
    return () => aoPronto(null)
  }, [mapa, aoPronto])
  return null
}

interface Visao {
  centro: [number, number]
  zoom: number
}

export function PaginaMapa() {
  useTituloDocumento('Mapa')
  const usuario = useUsuarioLogado()
  const gestor = usuario.perfil === 'ADMIN' || usuario.perfil === 'COLABORADOR'
  const consulta = useMarcadores()
  const marcadores = consulta.data ?? []

  const [comoLista, setComoLista] = useState(false)
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [pontoNovo, setPontoNovo] = useState<Coordenadas | null>(null)
  const [registrando, setRegistrando] = useState<Coordenadas | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'sucesso' | 'erro' | 'info'; texto: string } | null>(
    null,
  )
  const [buscandoGps, setBuscandoGps] = useState(false)
  const [mapa, setMapa] = useState<MapaLeaflet | null>(null)
  // Centro e zoom pedidos pela tela (GPS, "Mostrar no mapa"); o mapa acompanha.
  const [visao, setVisao] = useState<Visao | null>(null)
  const tituloPainel = useRef<HTMLHeadingElement>(null)

  const selecionado = marcadores.find((m) => m.id === selecionadoId) ?? null
  const pontos: PontoNoMapa[] = marcadores.map((m) => ({
    id: m.id,
    latitude: m.latitude,
    longitude: m.longitude,
    rotulo: m.apelido ? `${nomeCompleto(m)} ("${m.apelido}")` : nomeCompleto(m),
    url_miniatura: m.url_miniatura,
    iniciais: iniciais(m),
  }))

  const selecionar = (id: string) => {
    setPontoNovo(null)
    setSelecionadoId(id)
    requestAnimationFrame(() => tituloPainel.current?.focus())
  }

  const mostrarNoMapa = (marcador: Marcador) => {
    setComoLista(false)
    setSelecionadoId(marcador.id)
    setVisao({ centro: [marcador.latitude, marcador.longitude], zoom: 17 })
  }

  const usarMinhaLocalizacao = () => {
    setAviso(null)
    if (!('geolocation' in navigator)) {
      setAviso({ tipo: 'erro', texto: 'Este aparelho não informa a localização.' })
      return
    }
    setBuscandoGps(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setBuscandoGps(false)
        setVisao({ centro: [coords.latitude, coords.longitude], zoom: 17 })
        if (gestor) {
          setSelecionadoId(null)
          setPontoNovo({ latitude: coords.latitude, longitude: coords.longitude })
        }
      },
      () => {
        setBuscandoGps(false)
        setAviso({
          tipo: 'erro',
          texto: 'Não foi possível obter sua localização. Verifique a permissão do navegador.',
        })
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  const painelAberto = !comoLista && selecionado !== null

  return (
    <>
      <TituloPagina texto="Visualizar mapeamento de pessoas em" destaque="situação de rua" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Botao variante="secundario" carregando={buscandoGps} onClick={usarMinhaLocalizacao}>
          Usar minha localização
        </Botao>
        {gestor && !comoLista && (
          <Botao
            variante="secundario"
            disabled={!mapa}
            onClick={() => {
              if (!mapa) return
              const centro = mapa.getCenter()
              setSelecionadoId(null)
              setRegistrando({ latitude: centro.lat, longitude: centro.lng })
            }}
          >
            Registrar avistamento no centro do mapa
          </Botao>
        )}
        <Botao
          variante="secundario"
          aria-pressed={comoLista}
          onClick={() => setComoLista((v) => !v)}
          className="sm:ml-auto"
        >
          {comoLista ? 'Ver no mapa' : 'Ver como lista'}
        </Botao>
      </div>

      <p className="mb-4 text-sm text-texto-suave" aria-live="polite">
        {consulta.isPending
          ? 'Carregando pessoas…'
          : `${marcadores.length} ${marcadores.length === 1 ? 'pessoa' : 'pessoas'} com última localização registrada.`}
        {gestor && !comoLista && ' Clique em um ponto do mapa para registrar um avistamento.'}
      </p>

      {aviso && (
        <div className="mb-4">
          <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>
        </div>
      )}
      {consulta.isError && (
        <div className="mb-4">
          <Alerta tipo="erro">Não foi possível carregar o mapa. {consulta.error.message}</Alerta>
        </div>
      )}

      {comoLista ? (
        <ListaMarcadores marcadores={marcadores} aoMostrar={mostrarNoMapa} />
      ) : (
        <div
          className={`grid gap-6 ${painelAberto ? 'md:grid-cols-[minmax(16rem,20rem)_1fr]' : ''}`}
        >
          {painelAberto && (
            <PainelPessoa
              marcador={selecionado}
              tituloRef={tituloPainel}
              aoVoltar={() => setSelecionadoId(null)}
            />
          )}
          <Mapa
            rotulo="Mapa com a última localização das pessoas em situação de rua"
            className="order-1 h-[60vh] min-h-80 md:order-2"
            centro={visao?.centro}
            zoom={visao?.zoom}
            aoClicar={
              gestor
                ? (ponto) => {
                    setSelecionadoId(null)
                    setPontoNovo(ponto)
                  }
                : undefined
            }
          >
            <CapturarMapa aoPronto={setMapa} />
            <CamadaMarcadores
              pontos={pontos}
              selecionadoId={selecionadoId}
              aoSelecionar={selecionar}
            />
            {pontoNovo && (
              <Popup
                position={[pontoNovo.latitude, pontoNovo.longitude]}
                eventHandlers={{ remove: () => setPontoNovo(null) }}
              >
                <Botao
                  className="px-4 text-sm"
                  onClick={() => {
                    setRegistrando(pontoNovo)
                    setPontoNovo(null)
                  }}
                >
                  Adicionar avistamento aqui
                </Botao>
              </Popup>
            )}
          </Mapa>
        </div>
      )}

      {registrando && (
        <ModalRegistrarAvistamento
          coordenadas={registrando}
          aoFechar={() => setRegistrando(null)}
          aoRegistrar={(avistamento, pessoa) => {
            setRegistrando(null)
            setAviso({
              tipo: 'sucesso',
              texto: avistamento.mais_recente
                ? `Avistamento de ${nomeCompleto(pessoa)} registrado.`
                : `Avistamento de ${nomeCompleto(pessoa)} registrado. Ele é mais antigo que o último, então o marcador não mudou de lugar.`,
            })
            setSelecionadoId(pessoa.id)
          }}
        />
      )}
    </>
  )
}

/** Painel da pessoa (lateral no computador, abaixo do mapa no celular), só texto. */
function PainelPessoa({
  marcador,
  tituloRef,
  aoVoltar,
}: {
  marcador: Marcador
  tituloRef: React.RefObject<HTMLHeadingElement | null>
  aoVoltar: () => void
}) {
  return (
    <aside
      aria-labelledby="titulo-painel-pessoa"
      className="order-2 flex flex-col items-center gap-5 rounded-card border border-divisor p-5 md:order-1"
    >
      <Avatar
        url={marcador.url_miniatura}
        iniciais={iniciais(marcador)}
        alt={marcador.url_miniatura ? altFoto(marcador) : ''}
        tamanho="grande"
      />
      <h2
        id="titulo-painel-pessoa"
        ref={tituloRef}
        tabIndex={-1}
        className="text-center text-xl font-semibold text-texto"
      >
        {nomeCompleto(marcador)}
      </h2>
      <dl className="grid w-full gap-4 text-sm">
        <Item rotulo="Apelido">{marcador.apelido}</Item>
        <Item rotulo="Idade aproximada">
          {marcador.idade_aproximada != null ? `${marcador.idade_aproximada} anos` : null}
        </Item>
        <Item rotulo="Última localização">{localizacao(marcador)}</Item>
        <Item rotulo="Visto por último">{formatarDataHora(marcador.ultima_vez_visto)}</Item>
      </dl>
      <div className="flex w-full flex-col gap-3">
        <Link
          to={`/pessoas/${marcador.id}`}
          className="alvo-toque inline-flex items-center justify-center rounded-botao bg-primaria px-6 font-semibold text-sobre-primaria hover:bg-primaria-hover"
        >
          Ver perfil completo
        </Link>
        <Botao variante="secundario" onClick={aoVoltar}>
          Voltar
        </Botao>
      </div>
    </aside>
  )
}

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-divisor pb-3 last:border-0">
      <dt className="font-medium text-texto-suave">{rotulo}</dt>
      <dd className="text-base text-texto">
        {children ?? <span className="text-texto-suave">Não informado</span>}
      </dd>
    </div>
  )
}

/** "Ver como lista": a mesma informação do mapa em tabela (alternativa acessível). */
function ListaMarcadores({
  marcadores,
  aoMostrar,
}: {
  marcadores: Marcador[]
  aoMostrar: (marcador: Marcador) => void
}) {
  if (marcadores.length === 0) {
    return (
      <p role="status" className="py-10 text-center text-texto-suave">
        Nenhuma pessoa com localização registrada ainda.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-card border border-divisor">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Pessoas no mapa, da vista mais recentemente</caption>
        <thead className="bg-fundo-topo text-texto">
          <tr>
            {['Pessoa', 'Idade aproximada', 'Última localização', 'Visto por último', 'Ações'].map(
              (t) => (
                <th key={t} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                  {t}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {marcadores.map((m) => (
            <tr key={m.id} className="border-t border-divisor align-middle">
              <th scope="row" className="px-4 py-3 font-normal">
                <span className="flex items-center gap-3">
                  <Avatar
                    url={m.url_miniatura}
                    iniciais={iniciais(m)}
                    alt={m.url_miniatura ? altFoto(m) : ''}
                    tamanho="pequeno"
                  />
                  <span className="flex flex-col">
                    <span className="font-semibold text-texto">{nomeCompleto(m)}</span>
                    {m.apelido && <span className="text-texto-suave">"{m.apelido}"</span>}
                  </span>
                </span>
              </th>
              <td className="px-4 py-3 text-texto">
                {m.idade_aproximada != null ? `${m.idade_aproximada} anos` : '—'}
              </td>
              <td className="px-4 py-3 text-texto">{localizacao(m)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-texto">
                {formatarDataHora(m.ultima_vez_visto)}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-nowrap gap-2">
                  <Link
                    to={`/pessoas/${m.id}`}
                    aria-label={`Ver perfil de ${nomeCompleto(m)}`}
                    className="alvo-toque inline-flex items-center rounded-botao border border-borda-campo px-3 font-semibold whitespace-nowrap text-texto hover:bg-fundo-topo"
                  >
                    Ver perfil
                  </Link>
                  <Botao
                    variante="secundario"
                    className="px-3 text-sm whitespace-nowrap"
                    aria-label={`Mostrar ${nomeCompleto(m)} no mapa`}
                    onClick={() => aoMostrar(m)}
                  >
                    Mostrar no mapa
                  </Botao>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
