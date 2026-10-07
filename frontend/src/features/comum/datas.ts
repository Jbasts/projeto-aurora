// Datas ficam em UTC no banco e são exibidas no horário de Brasília (seção 7).
const FUSO = 'America/Sao_Paulo'

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatarData(iso: string): string {
  return formatoData.format(new Date(iso))
}

/** Ex.: "06/10/2026 às 14:30". */
export function formatarDataHora(iso: string): string {
  return formatoDataHora.format(new Date(iso)).replace(', ', ' às ')
}

/** Valor para <input type="datetime-local"> no horário do aparelho (ex.: "2026-10-06T14:30"). */
export function paraCampoDataHora(data: Date): string {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

/** "AAAA-MM-DD" no horário do aparelho (valor de <input type="date">). */
export function paraCampoData(data: Date): string {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** Início (00:00) ou fim (23:59:59.999) do dia de um <input type="date">, em ISO. */
export function limiteDoDia(valor: string, fim: boolean): string | null {
  const [ano, mes, dia] = valor.split('-').map(Number)
  if (!ano || !mes || !dia) return null
  const data = fim ? new Date(ano, mes - 1, dia, 23, 59, 59, 999) : new Date(ano, mes - 1, dia)
  return data.toISOString()
}
