import { Link } from 'react-router'

import { Avatar } from '../../components/Avatar'
import { useValorAtrasado } from '../../hooks/useValorAtrasado'
import { useSugestoes } from './api'
import { iniciais, nomeCompleto } from './nomes'
import type { SugestaoPessoa } from './tipos'

interface AvisoDuplicidadeProps {
  nome: string
  sobrenome: string
  apelido: string
}

/** "Pessoas com nome parecido": só um aviso, não bloqueia o cadastro (seção 3.7). */
export function AvisoDuplicidade({ nome, sobrenome, apelido }: AvisoDuplicidadeProps) {
  const termoNome = useValorAtrasado(`${nome} ${sobrenome}`.trim(), 400)
  const termoApelido = useValorAtrasado(apelido.trim(), 400)
  const porNome = useSugestoes(termoNome)
  const porApelido = useSugestoes(termoApelido)

  const vistas = new Set<string>()
  const parecidas: SugestaoPessoa[] = []
  for (const sugestao of [...(porNome.data ?? []), ...(porApelido.data ?? [])]) {
    if (!vistas.has(sugestao.id)) {
      vistas.add(sugestao.id)
      parecidas.push(sugestao)
    }
  }

  return (
    <div aria-live="polite">
      {parecidas.length > 0 && (
        <aside
          aria-labelledby="titulo-parecidas"
          className="flex flex-col gap-3 rounded-card border-l-4 border-primaria bg-fundo-topo p-4"
        >
          <h2 id="titulo-parecidas" className="font-semibold text-texto">
            Pessoas com nome parecido
          </h2>
          <p className="text-sm text-texto-suave">
            Confira se a pessoa já não está cadastrada. Se for outra pessoa, continue normalmente.
          </p>
          <ul className="flex flex-col gap-2">
            {parecidas.map((sugestao) => (
              <li key={sugestao.id}>
                <Link
                  to={`/pessoas/${sugestao.id}`}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-3 rounded-campo p-1 hover:bg-fundo"
                >
                  <Avatar
                    url={sugestao.url_miniatura}
                    iniciais={iniciais(sugestao)}
                    alt=""
                    tamanho="pequeno"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium text-primaria underline underline-offset-2">
                      {nomeCompleto(sugestao)}
                      <span className="sr-only"> (abre em nova aba)</span>
                    </span>
                    <span className="text-sm text-texto-suave">
                      {[
                        sugestao.apelido && `"${sugestao.apelido}"`,
                        sugestao.status === 'INATIVA' && 'Inativa',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  )
}
