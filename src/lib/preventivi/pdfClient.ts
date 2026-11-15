import type { GaranziaId, PreventivoData, RigaPreventivo, VersionePreventivo } from './types'

/** Riga di preventivo come arriva dalle API (campi usati per il PDF). */
export interface PreventivoPdfRow {
  numero_label: string
  cliente_nome: string
  cliente_cognome: string
  cliente_telefono: string
  data_stipula: string
  validita_giorni: number
  versioni: VersionePreventivo[]
  righe: RigaPreventivo[]
  garanzie: GaranziaId[] | null
  note_differenze: string | null
}

export const preventivoToData = (row: PreventivoPdfRow): PreventivoData => ({
  numero_label: row.numero_label,
  cliente_nome: `${row.cliente_nome} ${row.cliente_cognome}`.trim(),
  cliente_telefono: row.cliente_telefono,
  data_stipula: row.data_stipula,
  validita_giorni: row.validita_giorni,
  versioni: row.versioni,
  righe: row.righe,
  garanzie: row.garanzie || [],
  note_differenze: row.note_differenze || '',
})

export async function logoDataUrl(): Promise<string | null> {
  try {
    const blob = await (await fetch('/ob-logo.png')).blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Genera il PDF del preventivo (solo browser). */
export async function buildPreventivoPdf(row: PreventivoPdfRow) {
  const { generaPreventivoPdf, nomeFilePreventivo } = await import('./pdf')
  const data = preventivoToData(row)
  return { doc: generaPreventivoPdf(data, await logoDataUrl()), nomeFile: nomeFilePreventivo(data) }
}
