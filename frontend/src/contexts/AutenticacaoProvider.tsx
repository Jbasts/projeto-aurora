import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  definirAccessToken,
  definirAoExpirarSessao,
  renovarSessao,
  requisitar,
} from '../api/cliente'
import type { SessaoResposta } from '../features/auth/tipos'
import { AutenticacaoContext, type EstadoAutenticacao } from './autenticacao'

export function AutenticacaoProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [estado, setEstado] = useState<EstadoAutenticacao>({
    situacao: 'carregando',
    usuario: null,
  })

  const encerrarLocalmente = useCallback(() => {
    definirAccessToken(null)
    queryClient.clear()
    setEstado({ situacao: 'anonima', usuario: null })
  }, [queryClient])

  // Ao abrir ou recarregar a página, recupera a sessão pelo cookie de refresh (seção 3.2).
  useEffect(() => {
    let ativo = true
    renovarSessao().then((sessao) => {
      if (!ativo) return
      setEstado(
        sessao
          ? { situacao: 'autenticada', usuario: sessao.usuario }
          : { situacao: 'anonima', usuario: null },
      )
    })
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    definirAoExpirarSessao(encerrarLocalmente)
    return () => definirAoExpirarSessao(null)
  }, [encerrarLocalmente])

  const entrar = useCallback(async (email: string, senha: string) => {
    const sessao = await requisitar<SessaoResposta>('/auth/login', {
      metodo: 'POST',
      corpo: { email, senha },
      renovarSeExpirado: false,
    })
    definirAccessToken(sessao.access_token)
    setEstado({ situacao: 'autenticada', usuario: sessao.usuario })
    return sessao.usuario
  }, [])

  const sair = useCallback(async () => {
    try {
      await requisitar('/auth/logout', { metodo: 'POST', renovarSeExpirado: false })
    } finally {
      encerrarLocalmente()
    }
  }, [encerrarLocalmente])

  const valor = useMemo(() => ({ estado, entrar, sair }), [estado, entrar, sair])

  return <AutenticacaoContext.Provider value={valor}>{children}</AutenticacaoContext.Provider>
}
