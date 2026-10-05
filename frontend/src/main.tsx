import './styles/global.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'

import { queryClient } from './api/queryClient'
import { PreferenciasProvider } from './contexts/PreferenciasProvider'
import { rotas } from './routes/rotas'

const router = createBrowserRouter(rotas)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PreferenciasProvider>
        <RouterProvider router={router} />
      </PreferenciasProvider>
    </QueryClientProvider>
  </StrictMode>,
)
