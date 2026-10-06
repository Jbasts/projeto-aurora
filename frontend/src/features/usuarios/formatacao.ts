// Datas ficam em UTC no banco e são exibidas no horário de Brasília (seção 7).
const formatoData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatarData(iso: string): string {
  return formatoData.format(new Date(iso))
}
