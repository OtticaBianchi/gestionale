import jsPDF from 'jspdf'
import {
  COLORE_VERSIONE_RGB,
  GARANZIE,
  PreventivoData,
  aggiungiGiorni,
  formatDataIt,
  totaleListino,
  totaleVersione,
} from './types'

const AZIENDA = {
  nome: 'Ottica Bianchi',
  titolare: 'Enrico Bianchi',
  indirizzo: 'Via del Torretto, 61, 19121 La Spezia',
  telefono: 'Tel. 0187 29165',
  piva: 'P.IVA IT01110730114',
}

const SCALES = [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64]

const eur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n).replace(/\u00a0/g, ' ')

const GRIGIO_TESTO: [number, number, number] = [70, 70, 70]

/**
 * Una versione: pagina A4 verticale, tabella voce / prezzo unitario.
 * Due o tre versioni: pagina A4 orizzontale, matrice con una colonna per versione.
 * Gli sconti non compaiono sulle singole righe: in fondo si vede solo lo sconto totale in euro
 * rispetto al prezzo di partenza (mai la percentuale).
 */
function render(data: PreventivoData, logoDataUrl: string | null, scale: number): { doc: jsPDF; endY: number; limit: number } {
  const multi = data.versioni.length > 1
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: multi ? 'landscape' : 'portrait' })
  const PAGE_W = multi ? 297 : 210
  const PAGE_H = multi ? 210 : 297
  const MARGIN = multi ? 12 : 14
  const CONTENT_W = PAGE_W - MARGIN * 2
  const limit = PAGE_H - 12

  const fs = (pt: number) => pt * scale
  const lh = (pt: number) => pt * scale * 0.4 // interlinea approssimata in mm

  let y = MARGIN

  // ── Intestazione ──────────────────────────────────────────────
  const logoW = (multi ? 34 : 42) * Math.max(scale, 0.8)
  const logoH = logoW * (534 / 800)
  if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', MARGIN, y, logoW, logoH)

  doc.setFont('helvetica', 'bold').setFontSize(fs(15)).setTextColor(20, 20, 20)
  doc.text(AZIENDA.nome, PAGE_W - MARGIN, y + 6, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(fs(8.5)).setTextColor(...GRIGIO_TESTO)
  let hy = y + 6 + lh(11)
  for (const riga of [AZIENDA.titolare, AZIENDA.indirizzo, AZIENDA.telefono, AZIENDA.piva]) {
    doc.text(riga, PAGE_W - MARGIN, hy, { align: 'right' })
    hy += lh(9.5)
  }
  y += Math.max(logoH, hy - y) + 3
  doc.setDrawColor(40, 40, 40).setLineWidth(0.4).line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 6

  // ── Titolo, numero, cliente, date ─────────────────────────────
  doc.setFont('helvetica', 'bold').setFontSize(fs(14)).setTextColor(20, 20, 20)
  doc.text(`PREVENTIVO N. ${data.numero_label}`, MARGIN, y)
  y += lh(17)

  doc.setFontSize(fs(10.5))
  doc.text(data.cliente_nome, MARGIN, y)
  doc.setFont('helvetica', 'normal')
  if (data.cliente_telefono) {
    doc.text(`Cell. ${data.cliente_telefono}`, MARGIN + doc.getTextWidth(data.cliente_nome) + 6, y)
  }

  const scadenza = aggiungiGiorni(data.data_stipula, data.validita_giorni)
  doc.setFontSize(fs(9)).setTextColor(...GRIGIO_TESTO)
  doc.text(`Data di stipula: ${formatDataIt(data.data_stipula)}`, PAGE_W - MARGIN, y - lh(2), { align: 'right' })
  doc.text(`Valido ${data.validita_giorni} giorni, fino al ${formatDataIt(scadenza)}`, PAGE_W - MARGIN, y + lh(8), {
    align: 'right',
  })
  y += lh(17)

  // ── Tabella ───────────────────────────────────────────────────
  const colDesc = MARGIN + 2
  const nV = data.versioni.length
  const descW = multi ? CONTENT_W * 0.28 : CONTENT_W * 0.7
  const blockW = multi ? (CONTENT_W - descW) / nV : 0
  const blockX = (i: number) => MARGIN + descW + i * blockW
  // x (bordo destro) della colonna dei prezzi di un blocco; in verticale c'è un solo blocco
  const priceX = (i: number) => (multi ? blockX(i) + blockW - 3 : PAGE_W - MARGIN - 2)
  const tableTop = y

  // intestazione versioni: la targhetta del livello compare sempre, anche con una sola versione
  for (let i = 0; i < nV; i++) {
    const v = data.versioni[i]
    const x = multi ? blockX(i) + 0.5 : MARGIN
    const w = multi ? blockW - 1 : CONTENT_W
    doc.setFillColor(35, 35, 35).rect(x, y, w, lh(15), 'F')
    doc.setFont('helvetica', 'bold').setFontSize(fs(10.5)).setTextColor(255, 255, 255)
    const titolo = `${v.nome.toUpperCase()}${multi && v.consigliata ? '  (consigliata)' : ''}`
    if (multi) doc.text(titolo, x + w / 2, y + lh(10.5), { align: 'center' })
    else doc.text(titolo, colDesc, y + lh(10.5))
  }
  y += lh(15)

  // intestazione colonne
  doc.setFillColor(235, 235, 235).rect(MARGIN, y, CONTENT_W, lh(13), 'F')
  doc.setFont('helvetica', 'bold').setFontSize(fs(8)).setTextColor(40, 40, 40)
  doc.text('Voce', colDesc, y + lh(9))
  for (let i = 0; i < nV; i++) doc.text('Prezzo', priceX(i), y + lh(9), { align: 'right' })
  y += lh(13)

  // righe
  for (const r of data.righe) {
    const righeDesc = doc.setFont('helvetica', 'normal').setFontSize(fs(9.5)).splitTextToSize(r.descrizione, descW - 6) as string[]
    const hRiga = Math.max(lh(13), lh(10.5) * righeDesc.length + lh(3))
    doc.setTextColor(20, 20, 20).text(righeDesc, colDesc, y + lh(9))
    for (let i = 0; i < nV; i++) {
      const c = r.celle[i]
      if (!c) {
        doc.setTextColor(150, 150, 150).text('—', priceX(i), y + lh(9), { align: 'right' })
        continue
      }
      doc.setTextColor(20, 20, 20).text(eur(c.prezzo_unitario), priceX(i), y + lh(9), { align: 'right' })
    }
    y += hRiga

    // nota di riga
    if (r.nota) {
      doc.setFont('helvetica', 'italic').setFontSize(fs(8)).setTextColor(...GRIGIO_TESTO)
      const righeNota = doc.splitTextToSize(r.nota, CONTENT_W - 6) as string[]
      doc.text(righeNota, colDesc, y + lh(5))
      y += lh(9) * righeNota.length + lh(1)
    }
    doc.setDrawColor(215, 215, 215).setLineWidth(0.15).line(MARGIN, y, PAGE_W - MARGIN, y)
  }

  // totali: prezzo di partenza, sconto complessivo in euro (se c'è), totale da pagare
  const listino = data.versioni.map((_, i) => totaleListino(data.righe, i))
  const finale = data.versioni.map((_, i) => totaleVersione(data.righe, i))
  const sconti = listino.map((l, i) => Math.round((l - finale[i]) * 100) / 100)
  const haSconto = sconti.some((s) => s > 0)

  doc.setFont('helvetica', 'normal').setFontSize(fs(9.5)).setTextColor(20, 20, 20)
  if (haSconto) {
    doc.text('Totale', colDesc, y + lh(10))
    for (let i = 0; i < nV; i++) doc.text(eur(listino[i]), priceX(i), y + lh(10), { align: 'right' })
    y += lh(13)
    doc.text('Sconto', colDesc, y + lh(10))
    for (let i = 0; i < nV; i++) {
      doc.text(sconti[i] > 0 ? `- ${eur(sconti[i])}` : '—', priceX(i), y + lh(10), { align: 'right' })
    }
    y += lh(13)
    doc.setDrawColor(40, 40, 40).setLineWidth(0.3).line(MARGIN, y, PAGE_W - MARGIN, y)
  }
  doc.setFont('helvetica', 'bold').setFontSize(fs(10.5))
  doc.text(haSconto ? 'TOTALE DA PAGARE' : 'TOTALE', colDesc, y + lh(12))
  for (let i = 0; i < nV; i++) doc.text(eur(finale[i]), priceX(i), y + lh(12), { align: 'right' })
  y += lh(17)

  // cornice della versione consigliata, nel colore del suo pulsante
  if (multi) {
    data.versioni.forEach((v, i) => {
      if (!v.consigliata) return
      const [r, g, b] = COLORE_VERSIONE_RGB[v.nome] ?? [35, 35, 35]
      doc.setDrawColor(r, g, b).setLineWidth(0.9).rect(blockX(i) + 0.5, tableTop, blockW - 1, y - tableTop)
    })
  }
  y += lh(3)

  // ── Garanzie scelte (a due colonne in orizzontale) ────────────
  const garanzie = GARANZIE.filter((g) => data.garanzie.includes(g.id))
  if (garanzie.length > 0) {
    doc.setFont('helvetica', 'bold').setFontSize(fs(9)).setTextColor(20, 20, 20)
    doc.text('Le nostre garanzie', MARGIN, y + lh(7))
    y += lh(11)
    const cols = multi ? 2 : 1
    const gap = 4
    const boxW = (CONTENT_W - gap * (cols - 1)) / cols
    for (let k = 0; k < garanzie.length; k += cols) {
      const gruppo = garanzie.slice(k, k + cols)
      doc.setFont('helvetica', 'normal').setFontSize(fs(7.8))
      const prepared = gruppo.map((g) => ({ g, righe: doc.splitTextToSize(g.testo, boxW - 6) as string[] }))
      const boxH = Math.max(...prepared.map((p) => lh(10) + lh(9.2) * p.righe.length + lh(4)))
      prepared.forEach((p, idx) => {
        const x = MARGIN + idx * (boxW + gap)
        doc.setDrawColor(150, 150, 150).setLineWidth(0.25).rect(x, y, boxW, boxH)
        doc.setFont('helvetica', 'bold').setFontSize(fs(8.3)).setTextColor(20, 20, 20)
        doc.text(p.g.titolo, x + 3, y + lh(8))
        doc.setFont('helvetica', 'normal').setFontSize(fs(7.8)).setTextColor(60, 60, 60)
        doc.text(p.righe, x + 3, y + lh(8) + lh(9.5))
      })
      y += boxH + lh(3)
    }
    y += lh(3)
  }

  // ── Nota differenze (solo preventivo con più versioni) ────────
  if (multi && data.note_differenze.trim()) {
    doc.setFont('helvetica', 'bold').setFontSize(fs(8.5)).setTextColor(20, 20, 20)
    doc.text('Perché le soluzioni differiscono', MARGIN, y + lh(7))
    doc.setFont('helvetica', 'normal').setFontSize(fs(8)).setTextColor(60, 60, 60)
    const righe = doc.splitTextToSize(data.note_differenze.trim(), CONTENT_W) as string[]
    doc.text(righe, MARGIN, y + lh(7) + lh(10))
    y += lh(7) + lh(10) + lh(9.5) * righe.length + lh(4)
  }

  // ── Perché consigliamo una versione ───────────────────────────
  const consigliata = multi ? data.versioni.find((v) => v.consigliata && v.motivo_consigliata?.trim()) : undefined
  if (consigliata) {
    const [r, g, b] = COLORE_VERSIONE_RGB[consigliata.nome] ?? [35, 35, 35]
    doc.setFont('helvetica', 'bold').setFontSize(fs(8.5)).setTextColor(r, g, b)
    doc.text(`Perché consigliamo la versione ${consigliata.nome}`, MARGIN, y + lh(7))
    doc.setFont('helvetica', 'normal').setFontSize(fs(8)).setTextColor(60, 60, 60)
    const righe = doc.splitTextToSize(consigliata.motivo_consigliata!.trim(), CONTENT_W) as string[]
    doc.text(righe, MARGIN, y + lh(7) + lh(10))
    y += lh(7) + lh(10) + lh(9.5) * righe.length + lh(4)
  }

  // ── Piè di pagina ─────────────────────────────────────────────
  doc.setFont('helvetica', 'normal').setFontSize(fs(7.5)).setTextColor(110, 110, 110)
  doc.text('Prezzi IVA inclusa. Il presente preventivo non costituisce documento fiscale.', MARGIN, y + lh(6))
  y += lh(8)

  return { doc, endY: y, limit }
}

/** Genera il PDF a pagina singola; riduce la scala se serve. Lancia se non entra in una pagina. */
export function generaPreventivoPdf(data: PreventivoData, logoDataUrl: string | null): jsPDF {
  for (const scale of SCALES) {
    const { doc, endY, limit } = render(data, logoDataUrl, scale)
    if (endY <= limit) return doc
  }
  throw new Error('Troppe voci o note: il preventivo non entra in una pagina. Riduci le voci o accorcia le note.')
}

export function nomeFilePreventivo(data: Pick<PreventivoData, 'numero_label' | 'cliente_nome'>): string {
  const cliente = data.cliente_nome.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `Preventivo_${data.numero_label}_${cliente || 'cliente'}.pdf`
}
