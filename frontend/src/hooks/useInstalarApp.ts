import { useCallback, useSyncExternalStore } from 'react'

/** Evento do navegador que permite mostrar o pedido de instalação do PWA. */
interface EventoInstalacao extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Estado compartilhado: o botão aparece na barra superior e no rodapé, e o pedido só pode ser
// usado uma vez. Os ouvintes ficam no módulo para não perder um evento disparado antes da tela.
let pedido: EventoInstalacao | null = null
const inscritos = new Set<() => void>()

function definir(novo: EventoInstalacao | null) {
  pedido = novo
  inscritos.forEach((avisar) => avisar())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // guarda o pedido para mostrar só quando a pessoa clicar
    definir(e as EventoInstalacao)
  })
  window.addEventListener('appinstalled', () => definir(null))
}

function inscrever(avisar: () => void) {
  inscritos.add(avisar)
  return () => {
    inscritos.delete(avisar)
  }
}

/**
 * "Instalar app" (seção 5): só aparece quando o navegador oferece a instalação
 * (Chrome, Edge e Android). No iPhone, instala-se por "Adicionar à Tela de Início".
 */
export function useInstalarApp() {
  const atual = useSyncExternalStore(
    inscrever,
    () => pedido,
    () => null,
  )

  const instalar = useCallback(async () => {
    if (!pedido) return
    const usado = pedido
    definir(null) // o pedido só pode ser usado uma vez
    await usado.prompt()
    await usado.userChoice
  }, [])

  return { podeInstalar: atual !== null, instalar }
}
