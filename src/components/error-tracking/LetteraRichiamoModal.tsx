'use client'

import { useState, useEffect } from 'react'
import { X, FileText, AlertTriangle, User, Edit3, Eye, Save, Send, Printer, Mail } from 'lucide-react'
import jsPDF from 'jspdf'

interface LetteraRichiamoModalProps {
  isOpen: boolean
  onClose: () => void
  preselectedEmployeeId?: string
  errorsByEmployee: Record<string, {
    count: number
    cost: number
    critical: number
    employee_id: string
    errors: any[]
  }>
}

export default function LetteraRichiamoModal({
  isOpen,
  onClose,
  preselectedEmployeeId,
  errorsByEmployee
}: LetteraRichiamoModalProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [letterType, setLetterType] = useState<'verbal' | 'written' | 'disciplinary'>('verbal')
  const [customText, setCustomText] = useState('')
  const [editableLetter, setEditableLetter] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [ccEmails, setCcEmails] = useState('')
  const [customMessage, setCustomMessage] = useState('')

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedEmployeeId(preselectedEmployeeId || '')
      setLetterType('verbal')
      setCustomText('')
      setEditableLetter('')
      setShowEditor(false)
      setShowSendModal(false)
      setRecipientEmail('')
      setCcEmails('')
      setCustomMessage('')
    }
  }, [isOpen, preselectedEmployeeId])

  // Generate and set editable letter when parameters change
  useEffect(() => {
    if (selectedEmployeeId && letterType) {
      const generatedLetter = generateLetter()
      if (generatedLetter) {
        setEditableLetter(generatedLetter)
      }
    }
  }, [selectedEmployeeId, letterType, customText])

  const selectedEmployee = Object.entries(errorsByEmployee).find(
    ([, data]) => data.employee_id === selectedEmployeeId
  )

  const generateLetter = () => {
    if (!selectedEmployee) return

    const [employeeName, employeeData] = selectedEmployee
    const today = new Date().toLocaleDateString('it-IT')

    const letterTypes = {
      verbal: {
        title: 'RICHIAMO VERBALE',
        severity: 'richiamo verbale',
        consequences: 'Si avverte che il ripetersi di tali errori potrà comportare provvedimenti disciplinari più gravi.'
      },
      written: {
        title: 'RICHIAMO SCRITTO',
        severity: 'richiamo scritto',
        consequences: 'Si avverte che il ripetersi di tali errori potrà comportare sospensione dal servizio e/o licenziamento disciplinare.'
      },
      disciplinary: {
        title: 'PROVVEDIMENTO DISCIPLINARE',
        severity: 'provvedimento disciplinare',
        consequences: 'Ulteriori errori di tale gravità comporteranno il licenziamento per giusta causa.'
      }
    }

    const letter = letterTypes[letterType]

    // Calcola statistiche periodo
    const weeklyErrors = employeeData.errors.filter(error =>
      new Date(error.reported_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    )
    const monthlyErrors = employeeData.errors.filter(error =>
      new Date(error.reported_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )

    return `
Ottica Bianchi di Bianchi Enrico
Via del Torretto, 61 - La Spezia
${letter.title}

Data: ${today}
Destinatario: ${employeeName}

Oggetto: ${letter.title} per errori operativi

Con la presente si comunica che sono stati rilevati errori operativi significativi nelle Sue prestazioni lavorative:

RIEPILOGO ERRORI:
- Errori totali registrati: ${employeeData.count}
- Errori critici: ${employeeData.critical}
- Costo totale stimato: €${employeeData.cost.toFixed(2)}
- Errori ultima settimana: ${weeklyErrors.length}
- Errori ultimo mese: ${monthlyErrors.length}

DETTAGLIO ERRORI CRITICI:
${employeeData.errors
  .filter(error => error.error_category === 'critico')
  .slice(-5) // Ultimi 5 errori critici
  .map(error => `- ${new Date(error.reported_at).toLocaleDateString('it-IT')}: ${error.error_description} (€${error.cost_amount.toFixed(2)})`)
  .join('\n')}

${customText ? `\nNOTE AGGIUNTIVE:\n${customText}\n` : ''}

La gestione degli errori operativi è fondamentale per:
- Mantenere la qualità del servizio ai clienti
- Ridurre i costi operativi dell'azienda
- Garantire l'efficienza dei processi
- Preservare la reputazione aziendale

I dati sopra riportati evidenziano la necessità di un immediato miglioramento delle prestazioni lavorative.

Si procede pertanto con il presente ${letter.severity} ai sensi del CCNL applicabile.

${letter.consequences}

Si invita a prestare maggiore attenzione nello svolgimento delle proprie mansioni e a consultare il responsabile diretto per eventuali chiarimenti sui processi operativi.

Il sottoscritto rimane a disposizione per un confronto costruttivo finalizzato al miglioramento delle performance lavorative.

Si ricorda, che in accordo alle vigenti norme regolanti i rapporti di lavoro subordinato, lei ha 5 giorni per contestare in forma scritta questa comunicazione, trascorsi i quali la stessa verrà considerata accettata.

Cordiali saluti,

Il Titolare
Enrico Bianchi

---
Firma del dipendente (per ricevuta): ___________________________________________________

Data: _____ / _____ / __________

---
Documento generato automaticamente dal sistema di tracciamento errori
OB Moduli v2.9 - ${today}
    `.trim()
  }


  const handleGeneratePreview = () => {
    const generatedLetter = generateLetter()
    if (generatedLetter) {
      setEditableLetter(generatedLetter)
      setShowEditor(true)
    }
  }

  const saveLetter = async () => {
    if (!selectedEmployee) return

    setLoading(true)
    try {
      const [employeeName, employeeData] = selectedEmployee
      const letterContent = editableLetter || generateLetter()

      if (!letterContent) {
        alert('❌ Impossibile generare la lettera')
        return
      }

      // Genera PDF blob
      const pdfBlob = generatePDFBlob(letterContent, employeeName)

      // Converti il blob in base64
      const pdfBuffer = await pdfBlob.arrayBuffer()
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)))

      const weeklyErrors = employeeData.errors.filter(error =>
        new Date(error.reported_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      )
      const monthlyErrors = employeeData.errors.filter(error =>
        new Date(error.reported_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      )

      const response = await fetch('/api/error-tracking/warning-letters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save',
          letterData: {
            employeeId: employeeData.employee_id,
            employeeName: employeeName,
            letterType: letterType,
            pdfData: pdfBase64,
            stats: {
              totalErrors: employeeData.count,
              criticalErrors: employeeData.critical,
              totalCost: employeeData.cost,
              weeklyErrors: weeklyErrors.length,
              monthlyErrors: monthlyErrors.length
            }
          }
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        alert('✅ Lettera salvata con successo nel database!')
      } else {
        throw new Error(result.error || 'Errore nel salvare la lettera')
      }
    } catch (error: any) {
      console.error('Save error:', error)
      alert('❌ Errore nel salvare la lettera: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const sendLetter = async () => {
    if (!selectedEmployee || !recipientEmail.trim()) {
      alert('⚠️ Inserire l\'email del destinatario')
      return
    }

    setLoading(true)
    try {
      const [employeeName, employeeData] = selectedEmployee
      const letterContent = editableLetter || generateLetter()

      if (!letterContent) {
        alert('❌ Impossibile generare la lettera')
        return
      }

      // Genera PDF blob
      const pdfBlob = generatePDFBlob(letterContent, employeeName)

      // Converti il blob in base64 per l'invio
      const pdfBuffer = await pdfBlob.arrayBuffer()
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)))

      const weeklyErrors = employeeData.errors.filter(error =>
        new Date(error.reported_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      )
      const monthlyErrors = employeeData.errors.filter(error =>
        new Date(error.reported_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      )

      const response = await fetch('/api/error-tracking/warning-letters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send',
          letterData: {
            employeeId: employeeData.employee_id,
            employeeName: employeeName,
            letterType: letterType,
            pdfData: pdfBase64,
            stats: {
              totalErrors: employeeData.count,
              criticalErrors: employeeData.critical,
              totalCost: employeeData.cost,
              weeklyErrors: weeklyErrors.length,
              monthlyErrors: monthlyErrors.length
            }
          },
          emailData: {
            recipientEmail: recipientEmail.trim(),
            ccEmails: ccEmails.trim() ? ccEmails.split(',').map(email => email.trim()) : [],
            customMessage: customMessage.trim()
          }
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        alert('✅ Lettera salvata e inviata via email con successo!')
        setShowSendModal(false)
      } else {
        throw new Error(result.error || 'Errore nell\'invio della lettera')
      }
    } catch (error: any) {
      console.error('Send error:', error)
      alert('❌ Errore nell\'invio della lettera: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const generatePDFBlob = (letterContent: string, employeeName: string) => {
    // Crea PDF con jsPDF
    const doc = new jsPDF()

    // Configura font e dimensioni
    doc.setFont('helvetica')
    doc.setFontSize(10)

    // Dividi il contenuto in righe per rispettare i margini
    const pageWidth = 190 // Larghezza utilizzabile (210mm - 20mm margini)
    const lines = doc.splitTextToSize(letterContent, pageWidth)

    // Aggiungi il testo al PDF
    let yPosition = 20
    const lineHeight = 5

    lines.forEach((line: string) => {
      if (yPosition > 270) { // Se arriva a fine pagina
        doc.addPage()
        yPosition = 20
      }
      doc.text(line, 10, yPosition)
      yPosition += lineHeight
    })

    // Restituisce il blob PDF
    return doc.output('blob')
  }

  const recordVerbalWarning = async () => {
    if (!selectedEmployee) return

    setLoading(true)
    try {
      const [employeeName, employeeData] = selectedEmployee

      const weeklyErrors = employeeData.errors.filter(error =>
        new Date(error.reported_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      )
      const monthlyErrors = employeeData.errors.filter(error =>
        new Date(error.reported_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      )

      const response = await fetch('/api/error-tracking/warning-letters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'record-verbal',
          letterData: {
            employeeId: employeeData.employee_id,
            employeeName: employeeName,
            letterType: 'verbal',
            notes: customText.trim() || 'Richiamo verbale registrato',
            stats: {
              totalErrors: employeeData.count,
              criticalErrors: employeeData.critical,
              totalCost: employeeData.cost,
              weeklyErrors: weeklyErrors.length,
              monthlyErrors: monthlyErrors.length
            }
          }
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        alert('✅ Richiamo verbale registrato con successo!')
        onClose()
      } else {
        throw new Error(result.error || 'Errore nella registrazione del richiamo verbale')
      }
    } catch (error: any) {
      console.error('Record verbal warning error:', error)
      alert('❌ Errore nella registrazione: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const printToPDF = () => {
    if (!selectedEmployee) return

    try {
      const [employeeName] = selectedEmployee
      const letterContent = editableLetter || generateLetter()

      if (!letterContent) {
        alert('❌ Impossibile generare la lettera')
        return
      }

      const pdfBlob = generatePDFBlob(letterContent, employeeName)

      // Crea URL e scarica il file
      const url = window.URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lettera-richiamo-${employeeName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      alert('✅ PDF generato e scaricato con successo!')
    } catch (error) {
      console.error('PDF generation error:', error)
      alert('❌ Errore nella generazione del PDF')
    }
  }

  if (!isOpen) return null

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900">Genera Lettera di Richiamo</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Selezione Dipendente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Seleziona Dipendente
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Seleziona dipendente...</option>
              {Object.entries(errorsByEmployee)
                .sort(([,a], [,b]) => b.cost - a.cost)
                .map(([name, data]) => (
                  <option key={data.employee_id} value={data.employee_id}>
                    {name} - {data.count} errori (€{data.cost.toFixed(2)})
                  </option>
                ))}
            </select>
          </div>

          {selectedEmployee && (
            <>
              {/* Statistiche Dipendente */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-medium text-red-800 mb-2">Statistiche Errori - {selectedEmployee[0]}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-red-700">Errori Totali</div>
                    <div className="text-red-900">{selectedEmployee[1].count}</div>
                  </div>
                  <div>
                    <div className="font-medium text-red-700">Costo Totale</div>
                    <div className="text-red-900">€{selectedEmployee[1].cost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="font-medium text-red-700">Errori Critici</div>
                    <div className="text-red-900">{selectedEmployee[1].critical}</div>
                  </div>
                  <div>
                    <div className="font-medium text-red-700">Costo Medio</div>
                    <div className="text-red-900">
                      €{selectedEmployee[1].count > 0 ? (selectedEmployee[1].cost / selectedEmployee[1].count).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tipo Lettera */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <FileText className="w-4 h-4 inline mr-2" />
                  Tipo di Richiamo
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="verbal"
                      checked={letterType === 'verbal'}
                      onChange={(e) => setLetterType(e.target.value as any)}
                      className="mr-3 mt-0.5"
                    />
                    <div>
                      <div className="font-medium text-yellow-700">Richiamo Verbale</div>
                      <div className="text-sm text-yellow-600">Solo registrazione - nessuna lettera generata</div>
                    </div>
                  </label>
                  <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="written"
                      checked={letterType === 'written'}
                      onChange={(e) => setLetterType(e.target.value as any)}
                      className="mr-3 mt-0.5"
                    />
                    <div>
                      <div className="font-medium text-orange-700">Richiamo Scritto</div>
                      <div className="text-sm text-orange-600">Per errori ripetuti o di media gravità</div>
                    </div>
                  </label>
                  <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="disciplinary"
                      checked={letterType === 'disciplinary'}
                      onChange={(e) => setLetterType(e.target.value as any)}
                      className="mr-3 mt-0.5"
                    />
                    <div>
                      <div className="font-medium text-red-700">Provvedimento Disciplinare</div>
                      <div className="text-sm text-red-600">Per errori gravi o recidivi</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Note Aggiuntive */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note Aggiuntive (Opzionale)
                </label>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  rows={4}
                  placeholder="Aggiungi note specifiche, contesto aggiuntivo o raccomandazioni..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Anteprima e Editor Lettera - Solo per Written/Disciplinary */}
              {letterType !== 'verbal' && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-gray-800">
                    {showEditor ? 'Modifica Lettera' : 'Anteprima Lettera'}
                  </h3>
                  <div className="flex gap-2">
                    {!showEditor ? (
                      <button
                        type="button"
                        onClick={handleGeneratePreview}
                        className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        Modifica
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowEditor(false)}
                        className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Anteprima
                      </button>
                    )}
                  </div>
                </div>

                {showEditor ? (
                  <div>
                    <textarea
                      value={editableLetter}
                      onChange={(e) => setEditableLetter(e.target.value)}
                      className="w-full h-96 p-4 border border-gray-300 rounded text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Il contenuto della lettera verrà generato automaticamente..."
                    />
                    <p className="text-xs text-gray-600 mt-2">
                      💡 Puoi modificare qualsiasi parte della lettera. Le modifiche saranno incluse nel file scaricato.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="bg-white p-4 border rounded text-sm max-h-60 overflow-y-auto font-mono whitespace-pre-line">
                      {editableLetter || generateLetter()}
                    </div>
                    {selectedEmployee && (
                      <p className="text-xs text-gray-600 mt-2">
                        📝 Clicca "Modifica" per personalizzare il contenuto della lettera prima di scaricarla
                      </p>
                    )}
                  </div>
                )}
              </div>
              )}
            </>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-between items-center gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annulla
          </button>

          {selectedEmployee && (
            <div className="flex gap-3">
              {letterType === 'verbal' ? (
                /* Verbal Warning - Just Record */
                <button
                  onClick={recordVerbalWarning}
                  disabled={loading}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Registra Richiamo Verbale
                </button>
              ) : editableLetter && (
                /* Written/Disciplinary - Generate Letters */
                <>
                  <button
                    onClick={saveLetter}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Salva Lettera
                  </button>

                  <button
                    onClick={() => setShowSendModal(true)}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Invia Lettera
                  </button>

                  <button
                    onClick={printToPDF}
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    PDF
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Send Modal */}
    {showSendModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Mail className="w-6 h-6 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900">Invia Lettera via Email</h3>
            </div>
            <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Recipient Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Destinatario *
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="dipendente@esempio.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>

            {/* CC Emails */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CC (Opzionale)
              </label>
              <input
                type="text"
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
                placeholder="email1@esempio.com, email2@esempio.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">Separa più email con virgole</p>
            </div>

            {/* Custom Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Messaggio Aggiuntivo (Opzionale)
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
                placeholder="Messaggio personalizzato da includere nell'email..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
            <button
              onClick={() => setShowSendModal(false)}
              disabled={loading}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              onClick={sendLetter}
              disabled={loading || !recipientEmail.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Invio...' : 'Invia Email'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}