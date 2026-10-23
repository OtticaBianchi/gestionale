// Giorni lavorativi del negozio: chiuso SOLO la domenica e nei festivi.
// Festivi: nazionali (incl. Pasquetta e San Francesco 4/10) + San Giuseppe 19/3 (patrono di La Spezia).

export const SCHEDA_FOCUS_GIORNI_LIMITE = 2

const FIXED_HOLIDAYS = [
  '01-01', // Capodanno
  '01-06', // Epifania
  '03-19', // San Giuseppe (patrono La Spezia)
  '04-25', // Liberazione
  '05-01', // Festa del lavoro
  '06-02', // Festa della Repubblica
  '08-15', // Ferragosto
  '10-04', // San Francesco
  '11-01', // Ognissanti
  '12-08', // Immacolata
  '12-25', // Natale
  '12-26', // Santo Stefano
]

// Algoritmo di Meeus/Jones/Butcher
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const pad = (n: number) => String(n).padStart(2, '0')
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const holidayCache = new Map<number, Set<string>>()

function holidaysOf(year: number): Set<string> {
  let set = holidayCache.get(year)
  if (set) return set
  set = new Set(FIXED_HOLIDAYS.map((md) => `${year}-${md}`))
  const pasquetta = easterSunday(year)
  pasquetta.setDate(pasquetta.getDate() + 1)
  set.add(toKey(pasquetta))
  holidayCache.set(year, set)
  return set
}

export function isGiornoLavorativo(d: Date): boolean {
  if (d.getDay() === 0) return false
  return !holidaysOf(d.getFullYear()).has(toKey(d))
}

// 'YYYY-MM-DD' (o ISO) -> Date locale a mezzogiorno (evita slittamenti di fuso)
function parseDay(value: string): Date | null {
  const [y, m, d] = value.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 12)
}

/**
 * Giorni lavorativi trascorsi dopo il giorno dell'ordine, fino a `today` incluso.
 * Ordine di venerdì: sabato = 1, lunedì = 2 (la domenica non conta).
 */
export function giorniLavorativiTrascorsi(dataOrdine: string, today: Date = new Date()): number {
  const start = parseDay(dataOrdine)
  if (!start) return 0
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  let count = 0
  const cursor = new Date(start)
  cursor.setDate(cursor.getDate() + 1)
  while (cursor <= end) {
    if (isGiornoLavorativo(cursor)) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

export function isSchedaFocusScaduta(dataOrdine: string | null | undefined, today: Date = new Date()): boolean {
  if (!dataOrdine) return false
  return giorniLavorativiTrascorsi(dataOrdine, today) >= SCHEDA_FOCUS_GIORNI_LIMITE
}

/** Oggi in ora italiana (le API girano su server UTC). */
export function oggiRoma(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }))
}
