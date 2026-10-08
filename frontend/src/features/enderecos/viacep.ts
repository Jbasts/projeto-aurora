import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

/** Consulta de CEP no ViaCEP (https://viacep.com.br), feita direto pelo navegador. */
const URL_VIACEP = 'https://viacep.com.br/ws'

export interface EnderecoViaCep {
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}

export class ErroViaCep extends Error {}

/** Devolve o endereço, ou null se o CEP não existir. Falha de rede lança ErroViaCep. */
export async function buscarCep(cep: string): Promise<EnderecoViaCep | null> {
  const digitos = cep.replace(/\D/g, '')
  let resposta: Response
  try {
    resposta = await fetch(`${URL_VIACEP}/${digitos}/json/`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new ErroViaCep('ViaCEP indisponível.')
  }
  // CEP com formato inválido responde 400; CEP inexistente responde 200 com {"erro": true}.
  if (resposta.status === 400) return null
  if (!resposta.ok) throw new ErroViaCep(`ViaCEP respondeu ${resposta.status}.`)

  const corpo = (await resposta.json().catch(() => null)) as Record<string, unknown> | null
  if (!corpo || corpo.erro) return null
  const texto = (valor: unknown) => (typeof valor === 'string' ? valor : '')
  return {
    logradouro: texto(corpo.logradouro),
    bairro: texto(corpo.bairro),
    cidade: texto(corpo.localidade),
    uf: texto(corpo.uf),
  }
}

/** buscarCep com cache do TanStack Query: o mesmo CEP não é consultado duas vezes. */
export function useBuscarCep() {
  const queryClient = useQueryClient()
  return useCallback(
    (cep: string) =>
      queryClient.fetchQuery({
        queryKey: ['viacep', cep.replace(/\D/g, '')],
        queryFn: () => buscarCep(cep),
        staleTime: Infinity,
        retry: false,
      }),
    [queryClient],
  )
}
