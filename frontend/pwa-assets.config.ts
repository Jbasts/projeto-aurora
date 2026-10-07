import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Ícones do PWA gerados a partir de public/favicon.svg (`npm run gerar-icones`).
// O fundo verde do ícone "maskable" é a --cor-primaria, para não aparecer borda branca.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#1e7f6b' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#1e7f6b' } },
  },
  images: ['public/favicon.svg'],
})
