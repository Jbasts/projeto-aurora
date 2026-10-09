import { useId } from 'react'

import { PERFIS, ROTULOS_PERFIL, type Perfil } from './perfis'

/** Opções de perfil de acesso (aprovar cadastro e tela Permissões). */
export function EscolhaPerfil({
  valor,
  aoMudar,
}: {
  valor: Perfil
  aoMudar: (perfil: Perfil) => void
}) {
  const idGrupo = useId()
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={`${idGrupo}-dica`}>
      <legend className="mb-1 text-sm font-medium text-texto">Perfil de acesso</legend>
      {PERFIS.map((p) => (
        <label
          key={p}
          className="alvo-toque flex cursor-pointer items-center gap-3 rounded-campo border border-divisor px-3 has-checked:border-primaria"
        >
          <input
            type="radio"
            name={idGrupo}
            value={p}
            checked={valor === p}
            onChange={() => aoMudar(p)}
            className="size-4 accent-primaria"
          />
          <span className="text-texto">{ROTULOS_PERFIL[p]}</span>
        </label>
      ))}
      <p id={`${idGrupo}-dica`} className="text-sm text-texto-suave">
        Pessoas colaboradoras cadastram pessoas e registram avistamentos; pessoas administradoras
        também gerenciam usuários, solicitações e permissões.
      </p>
    </fieldset>
  )
}
