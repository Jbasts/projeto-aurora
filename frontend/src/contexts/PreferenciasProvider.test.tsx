import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { BarraAcessibilidade } from '../components/BarraAcessibilidade'
import { CHAVE_NIVEL_FONTE, CHAVE_TEMA } from './preferencias'
import { PreferenciasProvider } from './PreferenciasProvider'

function renderizarBarra() {
  render(
    <MemoryRouter>
      <PreferenciasProvider>
        <BarraAcessibilidade />
      </PreferenciasProvider>
    </MemoryRouter>,
  )
  return {
    diminuir: screen.getByRole('button', { name: 'Diminuir tamanho do texto' }),
    padrao: screen.getByRole('button', { name: 'Tamanho padrão do texto' }),
    aumentar: screen.getByRole('button', { name: 'Aumentar tamanho do texto' }),
    modoEscuro: screen.getByRole('button', { name: 'Modo escuro' }),
  }
}

const tamanhoFonte = () => document.documentElement.style.fontSize

describe('tamanho da fonte', () => {
  it('começa em 100% e percorre 87,5% a 125%, salvando a escolha', async () => {
    const usuario = userEvent.setup()
    const { diminuir, padrao, aumentar } = renderizarBarra()
    expect(tamanhoFonte()).toBe('100%')

    await usuario.click(aumentar)
    expect(tamanhoFonte()).toBe('112.5%')
    await usuario.click(aumentar)
    expect(tamanhoFonte()).toBe('125%')
    expect(aumentar).toBeDisabled()
    expect(localStorage.getItem(CHAVE_NIVEL_FONTE)).toBe('3')

    await usuario.click(padrao)
    expect(tamanhoFonte()).toBe('100%')

    await usuario.click(diminuir)
    expect(tamanhoFonte()).toBe('87.5%')
    expect(diminuir).toBeDisabled()
  })

  it('restaura o tamanho salvo', () => {
    localStorage.setItem(CHAVE_NIVEL_FONTE, '2')
    renderizarBarra()
    expect(tamanhoFonte()).toBe('112.5%')
  })

  it('ignora valor salvo inválido', () => {
    localStorage.setItem(CHAVE_NIVEL_FONTE, '9')
    renderizarBarra()
    expect(tamanhoFonte()).toBe('100%')
  })
})

describe('modo escuro', () => {
  it('alterna o tema, marca o botão e salva a escolha', async () => {
    const usuario = userEvent.setup()
    const { modoEscuro } = renderizarBarra()
    expect(document.documentElement.dataset.tema).toBe('claro')
    expect(modoEscuro).toHaveAttribute('aria-pressed', 'false')

    await usuario.click(modoEscuro)
    expect(document.documentElement.dataset.tema).toBe('escuro')
    expect(modoEscuro).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('escuro')
  })

  it('restaura o tema salvo', () => {
    localStorage.setItem(CHAVE_TEMA, 'escuro')
    renderizarBarra()
    expect(document.documentElement.dataset.tema).toBe('escuro')
  })
})
