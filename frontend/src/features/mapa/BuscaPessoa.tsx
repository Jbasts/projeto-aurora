import { useId, useState } from 'react'

import { Avatar } from '../../components/Avatar'
import { estiloCampo } from '../../components/formulario/CampoTexto'
import { useValorAtrasado } from '../../hooks/useValorAtrasado'
import { useSugestoes } from '../pessoas/api'
import { iniciais, nomeCompleto } from '../pessoas/nomes'
import type { SugestaoPessoa } from '../pessoas/tipos'

interface BuscaPessoaProps {
  aoEscolher: (pessoa: SugestaoPessoa) => void
  rotulo?: string
  /** Chamado com o texto digitado quando não há resultado (atalho "Cadastrar nova pessoa"). */
  semResultado?: (termo: string) => React.ReactNode
}

/**
 * Autocomplete por nome, sobrenome ou apelido, a partir de 2 letras, sem diferenciar acentos
 * (seção 3.9). Padrão combobox: setas navegam, Enter escolhe, Esc fecha.
 */
export function BuscaPessoa({
  aoEscolher,
  rotulo = 'Quem foi vista? (nome, sobrenome ou apelido)',
  semResultado,
}: BuscaPessoaProps) {
  const id = useId()
  const [termo, setTermo] = useState('')
  const [aberta, setAberta] = useState(false)
  const [ativa, setAtiva] = useState(0)
  const termoAtrasado = useValorAtrasado(termo, 250)
  const consulta = useSugestoes(termoAtrasado)

  // Só pessoas ativas: recebem avistamento e aparecem no mapa e no mapa de calor.
  const opcoes = (consulta.data ?? []).filter((p) => p.status === 'ATIVA')
  const curta = termo.trim().length < 2
  const buscando = !curta && (termo !== termoAtrasado || consulta.isFetching)
  const mostrarLista = aberta && !curta && opcoes.length > 0

  const escolher = (pessoa: SugestaoPessoa) => {
    aoEscolher(pessoa)
    setAberta(false)
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-campo`} className="text-sm font-medium text-texto">
        {rotulo}
      </label>
      <div className="relative">
        <input
          id={`${id}-campo`}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={mostrarLista}
          aria-controls={`${id}-lista`}
          aria-activedescendant={mostrarLista ? `${id}-opcao-${ativa}` : undefined}
          aria-describedby={`${id}-dica`}
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value)
            setAtiva(0)
            setAberta(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && opcoes.length) {
              e.preventDefault()
              setAberta(true)
              setAtiva((a) => (a + 1) % opcoes.length)
            } else if (e.key === 'ArrowUp' && opcoes.length) {
              e.preventDefault()
              setAtiva((a) => (a - 1 + opcoes.length) % opcoes.length)
            } else if (e.key === 'Enter' && mostrarLista) {
              e.preventDefault()
              escolher(opcoes[ativa])
            } else if (e.key === 'Escape' && mostrarLista) {
              // Fecha só a lista, sem fechar o modal.
              e.stopPropagation()
              e.nativeEvent.stopImmediatePropagation()
              setAberta(false)
            }
          }}
          className={estiloCampo}
        />
        <ul
          id={`${id}-lista`}
          role="listbox"
          aria-label="Pessoas encontradas"
          hidden={!mostrarLista}
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-campo border border-divisor bg-fundo py-1 shadow-lg"
        >
          {opcoes.map((pessoa, indice) => (
            <li
              key={pessoa.id}
              id={`${id}-opcao-${indice}`}
              role="option"
              aria-selected={indice === ativa}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(pessoa)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                indice === ativa ? 'bg-fundo-topo' : ''
              }`}
            >
              <Avatar
                url={pessoa.url_miniatura}
                iniciais={iniciais(pessoa)}
                alt=""
                tamanho="pequeno"
              />
              <span className="flex flex-col">
                <span className="font-medium text-texto">{nomeCompleto(pessoa)}</span>
                {pessoa.apelido && (
                  <span className="text-sm text-texto-suave">"{pessoa.apelido}"</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p id={`${id}-dica`} aria-live="polite" className="text-sm text-texto-suave">
        {curta
          ? 'Digite pelo menos 2 letras.'
          : buscando
            ? 'Buscando…'
            : opcoes.length === 0
              ? 'Nenhuma pessoa encontrada.'
              : `${opcoes.length} ${opcoes.length === 1 ? 'pessoa encontrada' : 'pessoas encontradas'}. Use as setas para escolher.`}
      </p>
      {!curta && !buscando && opcoes.length === 0 && semResultado?.(termo)}
    </div>
  )
}
