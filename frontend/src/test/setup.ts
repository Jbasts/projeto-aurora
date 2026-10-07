import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import { definirAccessToken } from '../api/cliente'

// jsdom não desenha em canvas (o mapa de calor detecta isso e não cria a camada).
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  definirAccessToken(null)
  localStorage.clear()
  document.documentElement.removeAttribute('data-tema')
  document.documentElement.style.fontSize = ''
})
