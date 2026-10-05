import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import { definirAccessToken } from '../api/cliente'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  definirAccessToken(null)
  localStorage.clear()
  document.documentElement.removeAttribute('data-tema')
  document.documentElement.style.fontSize = ''
})
