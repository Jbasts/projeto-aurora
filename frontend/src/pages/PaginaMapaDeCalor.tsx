import { useState } from 'react'

import { Alerta } from '../components/Alerta'
import { Avatar } from '../components/Avatar'
import { Botao } from '../components/Botao'
import { CampoSelecao } from '../components/formulario/CampoSelecao'
import { CampoTexto } from '../components/formulario/CampoTexto'
import type { PontoCalor } from '../components/mapa/CamadaCalor'
import { LegendaCalor } from '../components/mapa/LegendaCalor'
import { MapaCalor } from '../components/mapa/MapaSobDemanda'
import { TituloPagina } from '../components/TituloPagina'
import { useCalor } from '../features/mapa/api'
import { BuscaPessoa } from '../features/mapa/BuscaPessoa'
import { iniciais, nomeCompleto } from '../features/pessoas/nomes'
import type { SugestaoPessoa } from '../features/pessoas/tipos'
import { useTituloDocumento } from '../hooks/useTituloDocumento'

type Periodo = '7' | '30' | '90' | 'personalizado'

const OPCOES_PERIODO: { valor: Periodo; rotulo: string }[] = [
  { valor: '7', rotulo: 'Últimos 7 dias' },
  { valor: '30', rotulo: 'Últimos 30 dias' },
  { valor: '90', rotulo: 'Últimos 90 dias' },
  { valor: 'personalizado', rotulo: 'Intervalo personalizado' },
]

/** "AAAA-MM-DD" no horário do aparelho (valor de <input type="date">). */
function paraCampoData(data: Date): string {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** Início (00:00) ou fim (23:59:59.999) do dia de um <input type="date">, em ISO. */
function limiteDoDia(valor: string, fim: boolean): string | null {
  const [ano, mes, dia] = valor.split('-').map(Number)
  if (!ano || !mes || !dia) return null
  const data = fim ? new Date(ano, mes - 1, dia, 23, 59, 59, 999) : new Date(ano, mes - 1, dia)
  return data.toISOString()
}

// Referência estável: a camada de calor só é refeita quando os pontos mudam.
const SEM_PONTOS: PontoCalor[] = []

const numero = new Intl.NumberFormat('pt-BR')

/** Mapa de calor geral (seção 3.10): filtros por pessoa e período, padrão de 30 dias. */
export function PaginaMapaDeCalor() {
  useTituloDocumento('Mapa de calor')
  const [hoje] = useState(() => paraCampoData(new Date()))
  const [pessoa, setPessoa] = useState<SugestaoPessoa | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('30')
  const [inicio, setInicio] = useState(() => paraCampoData(new Date(Date.now() - 30 * 86_400_000)))
  const [fim, setFim] = useState(hoje)

  // Períodos fixos contam a partir do início do dia: a consulta não muda a cada segundo.
  let de: string | null
  let ate: string | null = null
  if (periodo === 'personalizado') {
    de = inicio ? limiteDoDia(inicio, false) : null
    ate = fim ? limiteDoDia(fim, true) : null
  } else {
    const [ano, mes, dia] = hoje.split('-').map(Number)
    de = new Date(ano, mes - 1, dia - Number(periodo) + 1).toISOString()
  }
  const intervaloInvalido = de !== null && ate !== null && de > ate

  const consulta = useCalor({ pessoaId: pessoa?.id, de, ate }, !intervaloInvalido)
  const pontos = consulta.data ?? SEM_PONTOS
  const avistamentos = pontos.reduce((soma, [, , peso]) => soma + peso, 0)

  return (
    <>
      <TituloPagina texto="Mapa de calor das pessoas em" destaque="situação de rua" />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {pessoa ? (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-texto">Pessoa</span>
            <div className="flex items-center gap-3 rounded-campo bg-fundo-topo p-3">
              <Avatar
                url={pessoa.url_miniatura}
                iniciais={iniciais(pessoa)}
                alt=""
                tamanho="pequeno"
              />
              <span className="flex flex-1 flex-col">
                <span className="font-semibold text-texto">{nomeCompleto(pessoa)}</span>
                {pessoa.apelido && (
                  <span className="text-sm text-texto-suave">"{pessoa.apelido}"</span>
                )}
              </span>
              <Botao
                variante="secundario"
                className="px-3 text-sm"
                aria-label={`Mostrar todas as pessoas em vez de só ${nomeCompleto(pessoa)}`}
                onClick={() => setPessoa(null)}
              >
                Ver todas
              </Botao>
            </div>
          </div>
        ) : (
          <BuscaPessoa
            rotulo="Pessoa (opcional; sem escolher, mostra todas)"
            aoEscolher={setPessoa}
          />
        )}

        <div className="flex flex-col gap-4">
          <CampoSelecao
            rotulo="Período"
            opcoes={OPCOES_PERIODO}
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
          />
          {periodo === 'personalizado' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto
                rotulo="De"
                type="date"
                value={inicio}
                max={hoje}
                onChange={(e) => setInicio(e.target.value)}
              />
              <CampoTexto
                rotulo="Até"
                type="date"
                value={fim}
                max={hoje}
                erro={intervaloInvalido ? 'A data final não pode ser antes da inicial.' : undefined}
                onChange={(e) => setFim(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-texto" aria-live="polite">
          {intervaloInvalido
            ? 'Corrija o período para ver o mapa de calor.'
            : consulta.isPending
              ? 'Carregando avistamentos…'
              : avistamentos === 0
                ? 'Nenhum avistamento no período.'
                : `${numero.format(avistamentos)} ${avistamentos === 1 ? 'avistamento' : 'avistamentos'} em ${numero.format(pontos.length)} ${pontos.length === 1 ? 'local' : 'locais'}${pessoa ? ` de ${nomeCompleto(pessoa)}` : ''}.`}
        </p>
        <LegendaCalor />
      </div>

      {consulta.isError && (
        <div className="mb-4">
          <Alerta tipo="erro">
            Não foi possível carregar o mapa de calor. {consulta.error.message}
          </Alerta>
        </div>
      )}

      <MapaCalor
        rotulo="Mapa de calor com os locais onde as pessoas em situação de rua foram vistas"
        className="h-[60vh] min-h-80"
        pontos={pontos}
      />
    </>
  )
}
