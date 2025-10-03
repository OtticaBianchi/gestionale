# 🔬 Gestionale Ottico - Sistema di Gestione per Ottiche

Un'applicazione web completa **Next.js 14** progettata specificamente per le ottiche, con un sistema completo di gestione del flusso di lavoro dalla visita del cliente alla consegna del prodotto e al pagamento.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)](https://tailwindcss.com/)

## 📋 Indice

- [Panoramica delle Funzionalità](#-panoramica-delle-funzionalità)
- [Autenticazione e Gestione Utenti](#-autenticazione-e-gestione-utenti)
- [Ruoli Utente e Permessi](#-ruoli-utente-e-permessi)
- [Dashboard e Workflow Kanban](#-dashboard-e-workflow-kanban)
- [Sistema Note Vocali](#-sistema-note-vocali)
- [Gestione Materiali e Ordini](#-gestione-materiali-e-ordini)
- [Sistema Pagamenti](#-sistema-pagamenti)
- [Sistema Follow-up](#-sistema-follow-up)
- [Sistema Tracciamento Errori](#-sistema-tracciamento-errori)
- [Gestione Procedure](#-gestione-procedure)
- [Documentazione API](#-documentazione-api)
- [Installazione e Configurazione](#-installazione-e-configurazione)
- [Deployment](#-deployment)
- [Esempi di Utilizzo](#-esempi-di-utilizzo)
- [Contribuire](#-contribuire)

---

## 🚀 Panoramica delle Funzionalità

**Gestionale Ottico** digitalizza il flusso di lavoro completo di un'ottica:

- **📊 Dashboard Kanban** - Gestione visuale del workflow per gli ordini di lavoro
- **👥 Sistema Multi-ruolo** - Livelli di accesso Operatore, Manager e Admin
- **🎤 Note Vocali** - Integrazione bot Telegram con trascrizione AI
- **📦 Gestione Inventario** - Tracciamento materiali con portali fornitori
- **💰 Tracciamento Pagamenti** - Piani di pagamento flessibili e reportistica finanziaria
- **📞 Sistema Follow-up** - Chiamate automatiche di soddisfazione clienti
- **📈 Tracciamento Errori** - Monitoraggio performance con analisi costi
- **📚 Manuale Procedure** - Libreria digitale delle procedure operative

---

## 🔐 Autenticazione e Gestione Utenti

### Processo di Registrazione

Il sistema utilizza un modello di **registrazione solo su invito** per la sicurezza:

1. **L'Admin invia l'invito** con ruolo predefinito
2. **L'utente riceve l'email** con link di registrazione
3. **Registrazione guidata** con ruolo pre-assegnato
4. **Attivazione account** al primo login

### Processo di Login

#### Passo 1: Accedere alla Pagina di Login
Navigare su `/auth/login` o l'URL root dell'applicazione.

```typescript
// Esempio flusso di login
const loginUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    console.error('Login fallito:', error.message)
    return
  }

  // Reindirizzamento alla dashboard dopo login riuscito
  router.push('/dashboard')
}
```

#### Passo 2: Creazione Profilo
Dopo l'autenticazione, il sistema crea automaticamente un profilo utente:

```sql
-- Trigger creazione profilo automatica
INSERT INTO profiles (id, full_name, role, created_at)
VALUES (NEW.id, NEW.email, 'operatore', NOW());
```

#### Passo 3: Reindirizzamento Basato su Ruolo
Gli utenti vengono reindirizzati in base al loro ruolo assegnato:

- **Operatore** → `/dashboard` (Board Kanban principale)
- **Manager** → `/dashboard` con accesso a moduli aggiuntivi
- **Admin** → `/dashboard` con accesso completo al sistema

### Reset Password

```typescript
// Flusso reset password
const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`
  })

  if (!error) {
    alert('Controlla la tua email per le istruzioni di reset')
  }
}
```

### Gestione Sessioni

L'applicazione utilizza il **refresh automatico delle sessioni** con protezione middleware:

```typescript
// middleware.ts - Protezione route
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(/* config */)
  const { data: { session } } = await supabase.auth.getSession()

  // Protezione route autenticate
  if (!session && protectedPaths.includes(pathname)) {
    return NextResponse.redirect('/auth/login')
  }

  // Controllo accesso basato su ruolo
  if (adminPaths.includes(pathname) && profile?.role !== 'admin') {
    return NextResponse.redirect('/dashboard')
  }
}
```

---

## 👥 Ruoli Utente e Permessi

### 1. Operatore (Livello Base)

**Diritti di Accesso:**
- ✅ Visualizzare e gestire buste assegnate (ordini di lavoro)
- ✅ Aggiornare stati della board Kanban
- ✅ Gestire materiali e ordini base
- ✅ Visualizzare informazioni clienti
- ✅ Registrare pagamenti base

**Restrizioni:**
- ❌ Non può eliminare buste o clienti
- ❌ Nessun accesso a report avanzati
- ❌ Non può gestire utenti
- ❌ Nessun accesso al voice triage

**Esempio di Utilizzo:**
```typescript
// Operatore che aggiorna stato busta
const updateBustaStatus = async (bustaId: string, newStatus: string) => {
  const { error } = await supabase
    .from('buste')
    .update({ stato: newStatus })
    .eq('id', bustaId)
    .eq('created_by', user.id) // RLS assicura solo le proprie buste
}
```

### 2. Manager (Livello Intermedio)

**Accesso Aggiuntivo:**
- ✅ Console Operativa per gestione ordini
- ✅ Accesso archivio per buste completate
- ✅ Gestione fornitori
- ✅ Elaborazione ordini in blocco
- ✅ Analytics performance

**Restrizioni:**
- ❌ Nessun accesso al voice triage
- ❌ Non può eliminare dati critici
- ❌ Gestione utenti limitata

**Esempio di Utilizzo:**
```typescript
// Manager che ordina materiali in blocco
const bulkOrderMaterials = async (orderIds: string[]) => {
  const { error } = await supabase
    .from('ordini_materiali')
    .update({
      stato: 'ordinato',
      da_ordinare: false,
      data_ordine: new Date().toISOString()
    })
    .in('id', orderIds)
}
```

### 3. Admin (Accesso Completo)

**Controllo Completo del Sistema:**
- ✅ Gestione utenti e inviti
- ✅ Voice triage per elaborazione note
- ✅ Configurazione sistema
- ✅ Eliminazione e modifica dati
- ✅ Reportistica e analytics avanzate
- ✅ Gestione tracciamento errori

**Esempio di Utilizzo:**
```typescript
// Admin che invita nuovo utente
const inviteUser = async (email: string, role: string) => {
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { role, invited_by: user.id }
  })
}
```

### Verifica Permessi

```typescript
// Controllo permessi utente
const checkPermissions = (userRole: string, requiredRole: string) => {
  const roleHierarchy = { operatore: 1, manager: 2, admin: 3 }
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}
```

---

## 📊 Dashboard e Workflow Kanban

### Panoramica Dashboard Principale

La dashboard è il hub centrale con una **board Kanban a 7 colonne** che rappresenta il workflow dell'ottica:

```typescript
// Configurazione colonne Kanban
const STATI_CONFIG = {
  nuovo: { label: 'Nuove', color: 'blue' },
  misure_prese: { label: 'Misure Prese', color: 'yellow' },
  materiali_ordinati: { label: 'Materiali Ordinati', color: 'orange' },
  materiali_parzialmente_arrivati: { label: 'Parzialmente Arrivati', color: 'purple' },
  materiali_arrivati: { label: 'Materiali Arrivati', color: 'indigo' },
  lavorazione: { label: 'In Lavorazione', color: 'pink' },
  pronto_ritiro: { label: 'Pronto Ritiro', color: 'green' },
  consegnato_non_pagato: { label: 'Consegnato Non Pagato', color: 'red' },
  consegnato_pagato: { label: 'Completato', color: 'gray' }
}
```

### Ciclo di Vita della Busta (Ordine di Lavoro)

#### 1. Creazione di una Nuova Busta

```typescript
// Crea nuovo ordine di lavoro
const createBusta = async (clienteId: string, tipoLavorazione: string) => {
  const { data, error } = await supabase
    .from('buste')
    .insert({
      cliente_id: clienteId,
      stato: 'nuovo',
      tipo_lavorazione: tipoLavorazione,
      data_creazione: new Date().toISOString(),
      created_by: user.id
    })
    .select()
    .single()

  return data
}
```

#### 2. Transizioni di Stato

I cambi di stato seguono regole business rigorose:

```typescript
// Transizioni di stato valide
const VALID_TRANSITIONS = {
  nuovo: ['misure_prese'],
  misure_prese: ['materiali_ordinati'],
  materiali_ordinati: ['materiali_parzialmente_arrivati', 'materiali_arrivati'],
  materiali_parzialmente_arrivati: ['materiali_arrivati'],
  materiali_arrivati: ['lavorazione'],
  lavorazione: ['pronto_ritiro'],
  pronto_ritiro: ['consegnato_non_pagato'],
  consegnato_non_pagato: ['consegnato_pagato']
}

const validateTransition = (currentState: string, newState: string) => {
  return VALID_TRANSITIONS[currentState]?.includes(newState) || false
}
```

#### 3. Interfaccia Drag & Drop

```typescript
// Gestione drag and drop Kanban
const handleDragEnd = async (result) => {
  const { draggableId, destination } = result

  if (!destination) return

  const bustaId = draggableId
  const newStatus = destination.droppableId

  // Valida transizione
  if (!validateTransition(currentStatus, newStatus)) {
    alert('Transizione non valida!')
    return
  }

  // Aggiorna database
  await updateBustaStatus(bustaId, newStatus)
}
```

### Viste Dettaglio Busta

Ogni busta ha una vista dettagliata con schede multiple:

#### Struttura Schede
```typescript
interface BustaDetailTabs {
  info: 'Informazioni base e dati cliente'
  materiali: 'Gestione materiali e ordini'
  pagamenti: 'Tracciamento pagamenti e info finanziarie'
  comunicazioni: 'Comunicazioni clienti e note'
}
```

#### Esempio: Utilizzo Scheda Materiali
```typescript
// Aggiungi materiale alla busta
const addMaterial = async (bustaId: string, material: Material) => {
  const { error } = await supabase
    .from('ordini_materiali')
    .insert({
      busta_id: bustaId,
      descrizione: material.descrizione,
      fornitore: material.fornitore,
      quantita: material.quantita,
      prezzo_unitario: material.prezzo,
      da_ordinare: true
    })
}
```

### Azioni Dashboard

L'header della dashboard fornisce azioni rapide:

```typescript
// Pulsanti azione dashboard
const DashboardActions = () => {
  const actions = [
    { label: 'Nuova Busta', action: () => router.push('/dashboard/buste/new') },
    { label: 'Gestisci Ordini', action: () => router.push('/modules/operations') },
    { label: 'Follow-up', action: () => router.push('/dashboard/follow-up') },
    { label: 'Errori', action: () => router.push('/errori') }
  ]

  return (
    <div className="flex gap-4">
      {actions.map(action => (
        <Button key={action.label} onClick={action.action}>
          {action.label}
        </Button>
      ))}
    </div>
  )
}
```

---

## 🎤 Sistema Note Vocali

### Integrazione Bot Telegram

Il sistema note vocali permette la cattura rapida di messaggi vocali via Telegram:

#### Configurazione Bot
```javascript
// telegram/bot.js
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false })

// Endpoint webhook
app.post('/api/telegram/webhook', async (req, res) => {
  const update = req.body

  if (update.message?.voice) {
    await processVoiceMessage(update.message)
  }

  res.status(200).send('OK')
})
```

#### Elaborazione Messaggi Vocali
```typescript
// Elabora messaggio vocale in arrivo
const processVoiceMessage = async (message: TelegramMessage) => {
  // Scarica file audio
  const audioBuffer = await downloadTelegramFile(message.voice.file_id)

  // Salva nel database
  const { data: voiceNote } = await supabase
    .from('voice_notes')
    .insert({
      telegram_message_id: message.message_id,
      audio_blob: audioBuffer.toString('base64'),
      addetto_nome: message.from.username,
      stato: 'pending'
    })
    .select()
    .single()

  // Attiva trascrizione
  await transcribeAudio(voiceNote.id, audioBuffer)
}
```

#### Trascrizione AI con AssemblyAI
```typescript
// Trascrizione automatica
const transcribeAudio = async (voiceNoteId: string, audioBuffer: Buffer) => {
  try {
    // Upload ad AssemblyAI
    const uploadResponse = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      audioBuffer,
      {
        headers: {
          'authorization': process.env.ASSEMBLYAI_API_KEY,
          'content-type': 'application/octet-stream'
        }
      }
    )

    // Richiedi trascrizione
    const transcriptResponse = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      {
        audio_url: uploadResponse.data.upload_url,
        language_code: 'it'
      },
      {
        headers: { 'authorization': process.env.ASSEMBLYAI_API_KEY }
      }
    )

    // Polling fino al completamento
    const transcriptId = transcriptResponse.data.id
    let transcript = await pollTranscript(transcriptId)

    // Aggiorna nota vocale con trascrizione
    await supabase
      .from('voice_notes')
      .update({ transcription: transcript.text })
      .eq('id', voiceNoteId)

  } catch (error) {
    console.error('Trascrizione fallita:', error)
  }
}
```

### Interfaccia Voice Triage (Solo Admin)

```typescript
// Componente voice triage
const VoiceTriage = () => {
  const [voiceNotes, setVoiceNotes] = useState([])

  // Carica note vocali in sospeso
  useEffect(() => {
    const loadVoiceNotes = async () => {
      const { data } = await supabase
        .from('voice_notes')
        .select('*')
        .eq('stato', 'pending')
        .order('created_at', { ascending: false })

      setVoiceNotes(data || [])
    }

    loadVoiceNotes()
  }, [])

  // Collega nota a cliente/busta
  const linkToCustomer = async (noteId: string, clienteId: string) => {
    await supabase
      .from('voice_notes')
      .update({ cliente_id: clienteId })
      .eq('id', noteId)
  }

  const linkToBusta = async (noteId: string, bustaId: string) => {
    await supabase
      .from('voice_notes')
      .update({ linked_busta_id: bustaId })
      .eq('id', noteId)
  }
}
```

### Esempi di Utilizzo

#### Esempio 1: Nota Cliente Rapida
```
Workflow operatore:
1. Cliente entra durante periodo intenso
2. Operatore invia messaggio vocale: "Cliente Mario Rossi, vuole controllo vista urgente"
3. Nota vocale auto-trascritta e salvata
4. Admin in seguito collega al profilo di Mario Rossi
5. Crea nuova busta per esame vista
```

#### Esempio 2: Problema Materiale
```
Messaggio vocale: "Montatura difettosa per busta 2024-0123, contattare fornitore Luxottica"
→ Auto-trascritto e collegato alla busta specifica
→ Aggiunto alle note busta per tracciamento
→ Riordino materiale attivato
```

---

## 📦 Gestione Materiali e Ordini

### Categorie Materiali

Il sistema gestisce cinque categorie di fornitori:

```typescript
// Tipi fornitori
type SupplierType =
  | 'lenti'           // Lenti oftalmiche
  | 'montature'       // Montature
  | 'lac'             // Lenti a contatto
  | 'sport'           // Occhiali sportivi
  | 'lab_esterno'     // Servizi laboratorio esterno

interface Supplier {
  nome: string
  referente_nome: string
  telefono: string
  email: string
  web_address: string      // URL portale per ordinare
  tempi_consegna_medi: number
  note: string
}
```

### Stati Ordini e Workflow

```typescript
// Stati materiali ordine
enum OrderStatus {
  DA_ORDINARE = 'da_ordinare',        // Deve essere ordinato
  ORDINATO = 'ordinato',              // Ordine inviato al fornitore
  IN_ARRIVO = 'in_arrivo',            // Confermato dal fornitore
  IN_RITARDO = 'in_ritardo',          // Oltre la data prevista
  CONSEGNATO = 'consegnato',          // Consegnato e verificato
  ACCETTATO_CON_RISERVA = 'accettato_con_riserva',  // Consegnato con problemi minori
  RIFIUTATO = 'rifiutato'             // Rifiutato, da ri-ordinare
}
```

### Console Operativa (Manager/Admin)

La Console Operativa fornisce strumenti di gestione in blocco:

#### Scheda: "Da Ordinare"
```typescript
// Ordina materiali in blocco
const bulkOrder = async (materialIds: string[]) => {
  const updates = materialIds.map(id => ({
    id,
    stato: 'ordinato',
    da_ordinare: false,
    data_ordine: new Date().toISOString()
  }))

  const { error } = await supabase
    .from('ordini_materiali')
    .upsert(updates)

  if (!error) {
    // Aggiorna stato buste correlate
    await updateRelatedBusteStatus(materialIds)
  }
}
```

#### Scheda: "In Ritardo"
```typescript
// Rilevamento automatico ritardi
const detectDelayedOrders = async () => {
  const { data: delayedOrders } = await supabase
    .from('ordini_materiali')
    .select(`
      *,
      busta:buste(readable_id),
      cliente:clienti(nome, cognome)
    `)
    .eq('stato', 'ordinato')
    .lt('data_consegna_prevista', new Date().toISOString())

  return delayedOrders?.map(order => ({
    ...order,
    days_delayed: Math.floor(
      (Date.now() - new Date(order.data_consegna_prevista).getTime())
      / (1000 * 60 * 60 * 24)
    )
  }))
}
```

### Integrazione Portali Fornitori

```typescript
// Gestione fornitori con link portali
const SupplierCard = ({ supplier }: { supplier: Supplier }) => {
  const openPortal = () => {
    if (supplier.web_address) {
      window.open(supplier.web_address, '_blank')
    }
  }

  const sendEmail = () => {
    window.location.href = `mailto:${supplier.email}`
  }

  return (
    <div className="supplier-card">
      <h3>{supplier.nome}</h3>
      <p>Referente: {supplier.referente_nome}</p>

      <div className="actions">
        <Button
          onClick={openPortal}
          disabled={!supplier.web_address}
        >
          🌐 Apri Portale
        </Button>
        <Button onClick={sendEmail}>
          📧 Email
        </Button>
      </div>
    </div>
  )
}
```

### Esempi Ordinazione Materiali

#### Esempio 1: Ordine Lenti Progressive
```typescript
const orderProgressiveLenses = async (bustaId: string) => {
  const material = {
    busta_id: bustaId,
    descrizione: 'Lenti progressive Varilux 1.6 AR',
    fornitore_lenti_id: 'essilor_id',
    quantita: 1,
    prezzo_unitario: 180.00,
    da_ordinare: true,
    note_ordine: 'Add +2.00, Cil -0.75 x 90°'
  }

  await supabase.from('ordini_materiali').insert(material)
}
```

#### Esempio 2: Ordine Montatura con Tracciamento
```typescript
const orderFrame = async (bustaId: string, frameDetails: any) => {
  const { data: order } = await supabase
    .from('ordini_materiali')
    .insert({
      busta_id: bustaId,
      descrizione: `${frameDetails.brand} ${frameDetails.model} ${frameDetails.color}`,
      fornitore_montature_id: frameDetails.supplier_id,
      quantita: 1,
      prezzo_unitario: frameDetails.price,
      da_ordinare: true
    })
    .select()
    .single()

  // Calcola consegna stimata
  const supplier = await getSupplier(frameDetails.supplier_id)
  const estimatedDelivery = new Date()
  estimatedDelivery.setDate(estimatedDelivery.getDate() + supplier.tempi_consegna_medi)

  await supabase
    .from('ordini_materiali')
    .update({ data_consegna_prevista: estimatedDelivery.toISOString() })
    .eq('id', order.id)
}
```

---

## 💰 Sistema Pagamenti

### Supporto Piani di Pagamento

Il sistema supporta quattro modelli di pagamento:

```typescript
type PaymentPlan =
  | 'one_shot'              // Pagamento singolo
  | 'deposit_then_balance'  // Acconto + saldo alla consegna
  | 'friendly'              // 2-3 rate per clienti abituali
  | 'consumer_credit'       // 12x tramite banca

interface BustaFinance {
  busta_id: string
  plan_type: PaymentPlan
  total_amount: number
  balance_due_date?: Date
  status: 'not_set' | 'awaiting_delivery' | 'due_now' | 'overdue' | 'paid'
  credit_provider?: string
  credit_contract_ref?: string
}
```

### Registrazione Pagamenti

```typescript
// Registra pagamento
const recordPayment = async (payment: {
  busta_id: string
  amount: number
  method: 'cash' | 'card' | 'transfer' | 'credit' | 'other'
  purpose?: 'deposit' | 'balance' | 'generic'
  reference?: string
  note?: string
}) => {
  // Inserisci record pagamento
  const { data: paymentRecord } = await supabase
    .from('payments')
    .insert({
      ...payment,
      received_at: new Date().toISOString(),
      received_by: user.id
    })
    .select()
    .single()

  // Aggiorna stato finanziario
  await updateFinanceStatus(payment.busta_id)

  return paymentRecord
}
```

### Calcolo Stato Finanziario

```typescript
// Calcola stato pagamento
const updateFinanceStatus = async (bustaId: string) => {
  // Ottieni totale pagato
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('busta_id', bustaId)

  const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0

  // Ottieni info finanziarie
  const { data: finance } = await supabase
    .from('buste_finance')
    .select('*')
    .eq('busta_id', bustaId)
    .single()

  const outstanding = (finance?.total_amount || 0) - totalPaid

  // Calcola nuovo stato
  let newStatus = finance?.status || 'not_set'

  if (outstanding <= 0) {
    newStatus = 'paid'
  } else if (finance?.plan_type === 'deposit_then_balance') {
    // Controlla se busta è pronta per ritiro
    const { data: busta } = await supabase
      .from('buste')
      .select('stato')
      .eq('id', bustaId)
      .single()

    if (busta?.stato === 'pronto_ritiro') {
      newStatus = 'due_now'
    }
  }

  // Aggiorna stato
  await supabase
    .from('buste_finance')
    .update({ status: newStatus })
    .eq('busta_id', bustaId)
}
```

### Esempi Workflow Pagamenti

#### Esempio 1: Flusso Acconto
```typescript
// Cliente effettua ordine con acconto
const handleDeposit = async (bustaId: string, depositAmount: number) => {
  // Registra pagamento acconto
  await recordPayment({
    busta_id: bustaId,
    amount: depositAmount,
    method: 'card',
    purpose: 'deposit'
  })

  // Imposta piano finanziario
  await supabase
    .from('buste_finance')
    .upsert({
      busta_id: bustaId,
      plan_type: 'deposit_then_balance',
      status: 'awaiting_delivery'
    })

  // Aggiorna stato busta per permettere ordinazione materiali
  await supabase
    .from('buste')
    .update({ stato: 'materiali_ordinati' })
    .eq('id', bustaId)
}
```

#### Esempio 2: Riscossione Saldo Finale
```typescript
// Riscuoti saldo alla consegna
const collectBalance = async (bustaId: string, balanceAmount: number) => {
  await recordPayment({
    busta_id: bustaId,
    amount: balanceAmount,
    method: 'cash',
    purpose: 'balance'
  })

  // Controlla se completamente pagato
  const { data: finance } = await supabase
    .from('buste_finance')
    .select('total_amount')
    .eq('busta_id', bustaId)
    .single()

  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('busta_id', bustaId)

  const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0

  if (totalPaid >= (finance?.total_amount || 0)) {
    // Segna come completamente pagato e suggerisci completamento busta
    await supabase
      .from('buste_finance')
      .update({ status: 'paid' })
      .eq('busta_id', bustaId)

    // Suggerisci spostamento a completato
    alert('Pagamento completato! Segnare busta come consegnata?')
  }
}
```

#### Esempio 3: Piano Rateale
```typescript
// Imposta piano pagamento dilazionato
const setupInstallmentPlan = async (bustaId: string, totalAmount: number, installments: number) => {
  // Imposta record finanziario
  await supabase
    .from('buste_finance')
    .upsert({
      busta_id: bustaId,
      plan_type: 'friendly',
      total_amount: totalAmount,
      status: 'due_now'
    })

  // Crea scadenzario rate
  const installmentAmount = totalAmount / installments

  for (let i = 0; i < installments; i++) {
    const dueDate = new Date()
    dueDate.setMonth(dueDate.getMonth() + i + 1)

    await supabase
      .from('payment_schedule')
      .insert({
        busta_id: bustaId,
        installment_number: i + 1,
        amount: installmentAmount,
        due_date: dueDate.toISOString(),
        status: 'pending'
      })
  }
}
```

## 📞 Sistema Follow-up

### Chiamate Automatiche di Soddisfazione Cliente

Il sistema follow-up genera liste di chiamate prioritizzate basate su valore e tipo di acquisto:

#### Logica di Priorità
```typescript
// Algoritmo prioritizzazione intelligente
const calculatePriority = (busta: any): 'alta' | 'normale' | 'bassa' => {
  const totalValue = busta.total_amount || 0
  const workType = busta.tipo_lavorazione
  const isFirstLAC = busta.is_first_lac_purchase

  if (totalValue >= 400 && ['OCV', 'OV'].includes(workType)) {
    return 'alta'      // Occhiali completi €400+
  }

  if (isFirstLAC || (totalValue >= 100 && workType === 'LV')) {
    return 'normale'   // Primo LAC o lenti €100+
  }

  if (totalValue >= 400 && workType === 'OS') {
    return 'bassa'     // Occhiali da sole €400+
  }

  return 'bassa'       // Priorità bassa di default
}
```

---

## 📈 Sistema Tracciamento Errori

### Categorie Errori e Tracciamento Costi

```typescript
// Classificazione errori
interface ErrorRecord {
  error_type: 'anagrafica_cliente' | 'materiali_ordine' | 'comunicazione_cliente' |
              'misurazioni_vista' | 'controllo_qualita' | 'consegna_prodotto' |
              'gestione_pagamenti' | 'voice_note_processing' | 'busta_creation' | 'altro'

  error_category: 'critico' | 'medio' | 'basso'  // Auto-determina range costi
  cost_amount: number                            // €200-500 | €50-200 | €5-50
  cost_type: 'real' | 'estimate'
  employee_id: string
  client_impacted: boolean
  requires_reorder: boolean
  time_lost_minutes: number
}
```

---

## 📚 Gestione Procedure

### Sistema Manuale Digitale

```typescript
// Struttura procedura
interface Procedure {
  title: string
  slug: string
  description: string
  content: string                    // Formato Markdown
  context_category: ProcedureCategory
  procedure_type: ProcedureType
  target_roles: Role[]
  search_tags: string[]
  is_featured: boolean
  mini_help_title?: string
  mini_help_summary?: string
}

type ProcedureCategory =
  | 'accoglienza' | 'vendita' | 'appuntamenti' | 'sala_controllo'
  | 'lavorazioni' | 'consegna' | 'customer_care' | 'amministrazione'
  | 'it' | 'sport' | 'straordinarie'

type ProcedureType = 'checklist' | 'istruzioni' | 'formazione' | 'errori_frequenti'
```

---

## 🔌 Documentazione API

### Endpoint Autenticazione

#### POST /api/auth/login
```typescript
// Richiesta login
interface LoginRequest {
  email: string
  password: string
}

// Esempio utilizzo
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})

if (response.ok) {
  const { user, session } = await response.json()
  // Gestisci login riuscito
}
```

### Gestione Buste

#### GET /api/buste
```typescript
// Lista buste con filtri
const getBuste = async (filters?: {
  stato?: string
  cliente_id?: string
  date_from?: string
  date_to?: string
  limit?: number
}) => {
  const params = new URLSearchParams(filters)
  const response = await fetch(`/api/buste?${params}`)
  return await response.json()
}
```

---

## 🛠 Installazione e Configurazione

### Prerequisiti

- **Node.js** 18.17 o superiore
- **npm** o **yarn** package manager
- Account e progetto **Supabase**
- **Token Bot Telegram** (per note vocali)
- **API Key AssemblyAI** (per trascrizione)

### Variabili d'Ambiente

Crea un file `.env.local` nella root del progetto:

```bash
# Configurazione Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Bot Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# AssemblyAI (Trascrizione Vocale)
ASSEMBLYAI_API_KEY=your_assemblyai_api_key

# Configurazione Email (per lettere tracciamento errori)
ARUBA_EMAIL_PASSWORD=your_email_password

# URL Applicazione
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Installazione Applicazione

#### 1. Clona Repository
```bash
git clone https://github.com/your-org/gestionale-ottico.git
cd gestionale-ottico
```

#### 2. Installa Dipendenze
```bash
npm install
# oppure
yarn install
```

#### 3. Avvia Server di Sviluppo
```bash
npm run dev
# oppure
yarn dev
```

L'applicazione sarà disponibile su `http://localhost:3000`.

---

## 🚀 Deployment

### Deployment Vercel (Raccomandato)

```bash
# Installa Vercel CLI
npm install -g vercel

# Login a Vercel
vercel login

# Deploy in produzione
vercel --prod
```

### Checklist Post-Deployment

- [ ] Verifica che tutte le variabili d'ambiente siano impostate
- [ ] Testa autenticazione utente
- [ ] Conferma funzionamento webhook Telegram
- [ ] Testa trascrizione note vocali
- [ ] Verifica connettività database
- [ ] Controlla funzionalità email (tracciamento errori)
- [ ] Testa tutti i ruoli utente e permessi
- [ ] Valida endpoint API

---

## 💡 Esempi di Utilizzo

### Esempio Workflow Completo

#### Scenario: Nuovo Cliente Esame Vista

```typescript
// 1. Cliente arriva per esame vista
const customer = await createCustomer({
  nome: 'Mario',
  cognome: 'Rossi',
  telefono: '+39 123 456 789',
  email: 'mario.rossi@email.com'
})

// 2. Crea nuova busta per esame vista
const busta = await createBusta({
  cliente_id: customer.id,
  tipo_lavorazione: 'OCV',
  priorita: 'normale'
})

// 3. Dopo esame, aggiungi materiali richiesti
await addMaterial(busta.id, {
  descrizione: 'Lenti progressive Varilux 1.6',
  fornitore_lenti_id: 'essilor_id',
  prezzo_unitario: 180.00
})

// 4. Cliente paga acconto
await recordPayment({
  busta_id: busta.id,
  amount: 150.00,
  method: 'card',
  purpose: 'deposit'
})

// 5. Aggiorna stato busta per abilitare ordinazione
await updateBustaStatus(busta.id, 'materiali_ordinati')
```

---

## 🤝 Contribuire

### Linee Guida di Sviluppo

1. **Stile Codice**: Segui le best practice TypeScript
2. **Testing**: Aggiungi test per nuove funzionalità
3. **Documentazione**: Aggiorna docs per cambi API
4. **Sicurezza**: Segui le best practice di sicurezza
5. **Performance**: Ottimizza per caricamento veloce

### Processo Pull Request

1. Fai fork del repository
2. Crea branch feature: `git checkout -b feature/funzionalita-straordinaria`
3. Commit modifiche: `git commit -m 'Aggiungi funzionalità straordinaria'`
4. Push al branch: `git push origin feature/funzionalita-straordinaria`
5. Apri una Pull Request

---

## 📄 Licenza

Questo progetto è rilasciato sotto licenza MIT - vedi il file [LICENSE](LICENSE) per i dettagli.

---

## 👥 Supporto

Per supporto e domande:

- **Documentazione**: Controlla questo README e i commenti nel codice
- **Issues**: Usa GitHub Issues per bug e richieste funzionalità
- **Email**: Contatta il team di sviluppo

---

**Costruito con ❤️ per Ottica Bianchi**