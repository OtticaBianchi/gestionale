export const SALDO_UNICO_METHODS = ['contanti', 'pos', 'bonifico'] as const

export type SaldoUnicoMethod = typeof SALDO_UNICO_METHODS[number]
export type CanonicalModalitaSaldo = 'saldo_unico' | 'due_rate' | 'tre_rate' | 'finanziamento'

const SALDO_METHOD_NOTE_PREFIX = '[SYS]SALDO_UNICO_METHOD='
const NO_PAYMENT_NOTE = 'NESSUN_INCASSO'

const normalizeNoteLines = (note?: string | null): string[] => {
  if (!note) return []
  return note
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const stripSystemPaymentNotes = (note?: string | null): string | null => {
  const preservedLines = normalizeNoteLines(note).filter(
    (line) => !line.startsWith(SALDO_METHOD_NOTE_PREFIX) && line !== NO_PAYMENT_NOTE
  )
  return preservedLines.length > 0 ? preservedLines.join('\n') : null
}

export const normalizeSaldoUnicoMethod = (value?: string | null): SaldoUnicoMethod | '' => {
  if (!value) return ''
  if (value === 'carta') return 'pos'
  if (value === 'saldo_unico') return 'contanti'
  if (SALDO_UNICO_METHODS.includes(value as SaldoUnicoMethod)) {
    return value as SaldoUnicoMethod
  }
  return ''
}

export const extractSaldoUnicoMethodFromNote = (note?: string | null): SaldoUnicoMethod | '' => {
  if (!note) return ''
  const markerLine = normalizeNoteLines(note).find((line) => line.startsWith(SALDO_METHOD_NOTE_PREFIX))
  if (!markerLine) return ''
  const rawMethod = markerLine.slice(SALDO_METHOD_NOTE_PREFIX.length).trim()
  return normalizeSaldoUnicoMethod(rawMethod)
}

export const resolveSaldoUnicoMethod = (params: {
  modalitaSaldo?: string | null
  notePagamento?: string | null
}): SaldoUnicoMethod | '' => {
  const fromNote = extractSaldoUnicoMethodFromNote(params.notePagamento)
  if (fromNote) return fromNote
  return normalizeSaldoUnicoMethod(params.modalitaSaldo)
}

export const composePagamentoNoteWithSaldoMethod = (
  existingNote?: string | null,
  saldoMethod?: SaldoUnicoMethod | ''
): string | null => {
  const baseNote = stripSystemPaymentNotes(existingNote)
  if (!saldoMethod) {
    return baseNote
  }

  return baseNote
    ? `${baseNote}\n${SALDO_METHOD_NOTE_PREFIX}${saldoMethod}`
    : `${SALDO_METHOD_NOTE_PREFIX}${saldoMethod}`
}

export const canonicalizeModalitaSaldo = (value?: string | null): CanonicalModalitaSaldo => {
  if (!value) return 'saldo_unico'

  if (value === 'due_rate') return 'due_rate'
  if (value === 'tre_rate') return 'tre_rate'
  if (value === 'finanziamento' || value === 'finanziamento_bancario') return 'finanziamento'
  if (value === 'saldo_unico' || value === 'contanti' || value === 'pos' || value === 'bonifico' || value === 'carta') {
    return 'saldo_unico'
  }

  return 'saldo_unico'
}
