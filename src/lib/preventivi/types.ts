export interface CellaPreventivo {
  prezzo_unitario: number
  sconto: number
}

export interface VersionePreventivo {
  nome: string
  consigliata: boolean
}

/** Una riga prodotto, comune a tutte le versioni. celle[i] = null: voce non inclusa nella versione i. */
export interface RigaPreventivo {
  descrizione: string
  nota: string
  celle: (CellaPreventivo | null)[]
}

export type GaranziaId = 'adattamento' | 'assistenza_globale' | 'prova_lac' | 'under14'

export interface GaranziaDef {
  id: GaranziaId
  /** Etichetta del pulsante nel form */
  label: string
  /** Titolo stampato nel PDF */
  titolo: string
  testo: string
}

// Testi sintetizzati dalla politica di garanzia Ottica Bianchi
export const GARANZIE: GaranziaDef[] = [
  {
    id: 'adattamento',
    label: 'Adattamento progressive',
    titolo: 'Garanzia Adattamento Progressive (da 3 a 12 mesi)',
    testo:
      "Dopo il nostro controllo della visione, garantiamo l'adattamento alle lenti progressive, a seconda della tipologia scelta, da 3 a 12 mesi. " +
      'Potrai sostituire GRATUITAMENTE le lenti con un altro disegno di progressione, un bifocale oppure un doppio occhiale (uno per lontano e uno per vicino). ' +
      "Il costo dell'eventuale seconda montatura non è compreso nella sostituzione. " +
      'Se il controllo non viene effettuato presso il nostro Centro Ottico, la garanzia è limitata alla sostituzione delle lenti con uno sconto del 50%.',
  },
  {
    id: 'assistenza_globale',
    label: 'Assistenza globale 24 mesi',
    titolo: 'Assistenza Globale (24 mesi)',
    testo:
      'In caso di rottura accidentale (lenti, montatura o parti di essa) o danneggiamento che ne alteri la funzionalità, ti forniamo lenti identiche nei poteri e nei trattamenti e/o montatura uguale o equivalente. ' +
      '1° anno: lenti oftalmiche sconto 50%, montatura sconto 30%. 2° anno: lenti oftalmiche sconto 30%, montatura sconto 30%. ' +
      'È vincolante la restituzione delle parti danneggiate. In caso di smarrimento o furto: riduzione del 30% sul listino per un nuovo paio di occhiali. ' +
      'Ogni 6 mesi controllo gratuito con serraggio e lubrificazione delle viti e pulizia a ultrasuoni; ogni 12 mesi sostituzione delle parti soggette a usura (viti, terminali, naselli).',
  },
  {
    id: 'prova_lac',
    label: 'Prova lenti a contatto',
    titolo: 'Prova lenti a contatto (12 mesi)',
    testo:
      'Possibilità di provare in OMAGGIO per 2 ore una coppia di lenti a contatto con graduazione corrispondente a quella degli occhiali acquistati.',
  },
  {
    id: 'under14',
    label: 'Under 14',
    titolo: 'Under 14',
    testo:
      'Per i più piccoli, fino a 14 anni, per garantire sempre una visione ottimale, possibilità di sostituire le lenti a condizioni favorevoli.',
  },
]

export interface PreventivoData {
  numero_label: string
  cliente_nome: string // "Nome Cognome" da stampare
  cliente_telefono: string
  data_stipula: string // YYYY-MM-DD
  validita_giorni: number
  versioni: VersionePreventivo[]
  righe: RigaPreventivo[]
  garanzie: GaranziaId[]
  note_differenze: string
}

export interface VoceCatalogo {
  id: string
  nome: string
  prezzo_default: number | null
  garanzia_adattamento: boolean // suggerisce di attivare la garanzia Adattamento
}

export const NOTA_DIFFERENZE_DEFAULT =
  'Le soluzioni proposte si differenziano per qualità dei materiali, tecnologia delle lenti, trattamenti e design della montatura: ' +
  'al crescere del livello aumentano comfort visivo, resa nel tempo e personalizzazione, e con essi il prezzo.'

export const NOMI_VERSIONI = ['Base', 'Advanced', 'Premium']

/** Preventivo precompilato in base al prodotto: nomi voci (dal catalogo) e garanzie suggerite. */
export const PRESET_PRODOTTI: Array<{ id: string; label: string; voci: string[]; garanzie: GaranziaId[] }> = [
  {
    id: 'vista',
    label: 'Occhiale da vista',
    voci: ['Controllo della vista', 'Montatura', 'Lenti oftalmiche monofocali'],
    garanzie: ['assistenza_globale'],
  },
  {
    id: 'progressivi',
    label: 'Occhiale progressivo',
    voci: ['Controllo della vista', 'Montatura', 'Lenti oftalmiche progressive'],
    garanzie: ['assistenza_globale', 'adattamento'],
  },
  { id: 'sole', label: 'Occhiale da sole', voci: ['Occhiale da sole'], garanzie: [] },
  { id: 'lac', label: 'Lenti a contatto', voci: ['Controllo della vista', 'Lenti a contatto'], garanzie: ['prova_lac'] },
]

export const prezzoFinaleCella = (c: CellaPreventivo) =>
  Math.max(0, round2((Number(c.prezzo_unitario) || 0) - (Number(c.sconto) || 0)))

export const totaleVersione = (righe: Pick<RigaPreventivo, 'celle'>[], indice: number) =>
  round2(righe.reduce((sum, r) => sum + (r.celle[indice] ? prezzoFinaleCella(r.celle[indice]!) : 0), 0))

export const round2 = (n: number) => Math.round(n * 100) / 100

export function aggiungiGiorni(isoDate: string, giorni: number): string {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + giorni)
  return d.toISOString().slice(0, 10)
}

export const formatEuro = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

export const formatDataIt = (isoDate: string) =>
  new Date(isoDate.slice(0, 10) + 'T12:00:00').toLocaleDateString('it-IT')
