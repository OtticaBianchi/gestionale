# 🔬 Gestionale Ottico - Optical Shop Management System

A comprehensive **Next.js 14** web application designed specifically for optical shops, featuring a complete workflow management system from customer visit to product delivery and payment.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)](https://tailwindcss.com/)

## 📋 Table of Contents

- [Features Overview](#-features-overview)
- [Authentication & User Management](#-authentication--user-management)
- [User Roles & Permissions](#-user-roles--permissions)
- [Dashboard & Kanban Workflow](#-dashboard--kanban-workflow)
- [Voice Notes System](#-voice-notes-system)
- [Materials & Orders Management](#-materials--orders-management)
- [Payment System](#-payment-system)
- [Follow-up System](#-follow-up-system)
- [Error Tracking System](#-error-tracking-system)
- [Procedures Management](#-procedures-management)
- [API Documentation](#-api-documentation)
- [Installation & Setup](#-installation--setup)
- [Deployment](#-deployment)
- [Usage Examples](#-usage-examples)
- [Contributing](#-contributing)

---

## 🚀 Features Overview

**Gestionale Ottico** digitalizes the complete optical shop workflow:

- **📊 Kanban Dashboard** - Visual workflow management for work orders
- **👥 Multi-role System** - Operatore, Manager, and Admin access levels
- **🎤 Voice Notes** - Telegram bot integration with AI transcription
- **📦 Inventory Management** - Materials tracking with supplier portals
- **💰 Payment Tracking** - Flexible payment plans and financial reporting
- **📞 Follow-up System** - Automated customer satisfaction calls
- **📈 Error Tracking** - Performance monitoring with cost analysis
- **📚 Procedures Manual** - Digital operational procedures library

---

## 🔐 Authentication & User Management

### Registration Process

The system uses an **invite-only registration** model for security:

1. **Admin sends invitation** with predefined role
2. **User receives email** with registration link
3. **Guided registration** with role pre-assignment
4. **Account activation** on first login

### Login Process

#### Step 1: Access the Login Page
Navigate to `/auth/login` or the application root URL.

```typescript
// Example login flow
const loginUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    console.error('Login failed:', error.message)
    return
  }

  // Redirect to dashboard after successful login
  router.push('/dashboard')
}
```

#### Step 2: Profile Creation
After authentication, the system automatically creates a user profile:

```sql
-- Automatic profile creation trigger
INSERT INTO profiles (id, full_name, role, created_at)
VALUES (NEW.id, NEW.email, 'operatore', NOW());
```

#### Step 3: Role-based Redirect
Users are redirected based on their assigned role:

- **Operatore** → `/dashboard` (Main Kanban board)
- **Manager** → `/dashboard` with additional module access
- **Admin** → `/dashboard` with full system access

### Password Reset

```typescript
// Password reset flow
const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`
  })

  if (!error) {
    alert('Check your email for reset instructions')
  }
}
```

### Session Management

The application uses **automatic session refresh** with middleware protection:

```typescript
// middleware.ts - Route protection
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(/* config */)
  const { data: { session } } = await supabase.auth.getSession()

  // Protect authenticated routes
  if (!session && protectedPaths.includes(pathname)) {
    return NextResponse.redirect('/auth/login')
  }

  // Role-based access control
  if (adminPaths.includes(pathname) && profile?.role !== 'admin') {
    return NextResponse.redirect('/dashboard')
  }
}
```

---

## 👥 User Roles & Permissions

### 1. Operatore (Base Level)

**Access Rights:**
- ✅ View and manage assigned buste (work orders)
- ✅ Update Kanban board states
- ✅ Manage materials and basic orders
- ✅ View customer information
- ✅ Record basic payments

**Restrictions:**
- ❌ Cannot delete buste or customers
- ❌ No access to advanced reports
- ❌ Cannot manage users
- ❌ No voice triage access

**Example Usage:**
```typescript
// Operatore updating busta status
const updateBustaStatus = async (bustaId: string, newStatus: string) => {
  const { error } = await supabase
    .from('buste')
    .update({ stato: newStatus })
    .eq('id', bustaId)
    .eq('created_by', user.id) // RLS ensures own buste only
}
```

### 2. Manager (Intermediate Level)

**Additional Access:**
- ✅ Operations Console for order management
- ✅ Archive access for completed buste
- ✅ Supplier management
- ✅ Bulk order processing
- ✅ Performance analytics

**Restrictions:**
- ❌ No voice triage access
- ❌ Cannot delete critical data
- ❌ Limited user management

**Example Usage:**
```typescript
// Manager bulk ordering materials
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

### 3. Admin (Full Access)

**Complete System Control:**
- ✅ User management and invitations
- ✅ Voice triage for note processing
- ✅ System configuration
- ✅ Data deletion and modification
- ✅ Advanced reporting and analytics
- ✅ Error tracking management

**Example Usage:**
```typescript
// Admin inviting new user
const inviteUser = async (email: string, role: string) => {
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { role, invited_by: user.id }
  })
}
```

### Role Verification

```typescript
// Check user permissions
const checkPermissions = (userRole: string, requiredRole: string) => {
  const roleHierarchy = { operatore: 1, manager: 2, admin: 3 }
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}
```

---

## 📊 Dashboard & Kanban Workflow

### Main Dashboard Overview

The dashboard is the central hub featuring a **7-column Kanban board** representing the optical shop workflow:

```typescript
// Kanban column configuration
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

### Busta (Work Order) Lifecycle

#### 1. Creating a New Busta

```typescript
// Create new work order
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

#### 2. State Transitions

State changes follow strict business rules:

```typescript
// Valid state transitions
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

#### 3. Drag & Drop Interface

```typescript
// Handle Kanban drag and drop
const handleDragEnd = async (result) => {
  const { draggableId, destination } = result

  if (!destination) return

  const bustaId = draggableId
  const newStatus = destination.droppableId

  // Validate transition
  if (!validateTransition(currentStatus, newStatus)) {
    alert('Transizione non valida!')
    return
  }

  // Update database
  await updateBustaStatus(bustaId, newStatus)
}
```

### Busta Detail Views

Each busta has a detailed view with multiple tabs:

#### Tab Structure
```typescript
interface BustaDetailTabs {
  info: 'Basic information and customer data'
  materiali: 'Materials and orders management'
  pagamenti: 'Payment tracking and financial info'
  comunicazioni: 'Customer communications and notes'
}
```

#### Example: Materials Tab Usage
```typescript
// Add material to busta
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

### Dashboard Actions

The dashboard header provides quick actions:

```typescript
// Dashboard action buttons
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

## 🎤 Voice Notes System

### Telegram Bot Integration

The voice notes system allows rapid voice message capture via Telegram:

#### Bot Setup
```javascript
// telegram/bot.js
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false })

// Webhook endpoint
app.post('/api/telegram/webhook', async (req, res) => {
  const update = req.body

  if (update.message?.voice) {
    await processVoiceMessage(update.message)
  }

  res.status(200).send('OK')
})
```

#### Voice Message Processing
```typescript
// Process incoming voice message
const processVoiceMessage = async (message: TelegramMessage) => {
  // Download audio file
  const audioBuffer = await downloadTelegramFile(message.voice.file_id)

  // Save to database
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

  // Trigger transcription
  await transcribeAudio(voiceNote.id, audioBuffer)
}
```

#### AI Transcription with AssemblyAI
```typescript
// Automatic transcription
const transcribeAudio = async (voiceNoteId: string, audioBuffer: Buffer) => {
  try {
    // Upload to AssemblyAI
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

    // Request transcription
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

    // Poll for completion
    const transcriptId = transcriptResponse.data.id
    let transcript = await pollTranscript(transcriptId)

    // Update voice note with transcription
    await supabase
      .from('voice_notes')
      .update({ transcription: transcript.text })
      .eq('id', voiceNoteId)

  } catch (error) {
    console.error('Transcription failed:', error)
  }
}
```

### Voice Triage Interface (Admin Only)

```typescript
// Voice triage component
const VoiceTriage = () => {
  const [voiceNotes, setVoiceNotes] = useState([])

  // Load pending voice notes
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

  // Link note to customer/busta
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

### Usage Examples

#### Example 1: Quick Customer Note
```
Operator workflow:
1. Customer walks in during busy period
2. Operator sends voice message: "Cliente Mario Rossi, vuole controllo vista urgente"
3. Voice note auto-transcribed and saved
4. Admin later links to Mario Rossi's profile
5. Creates new busta for eye exam
```

#### Example 2: Material Issue
```
Voice message: "Montatura difettosa per busta 2024-0123, contattare fornitore Luxottica"
→ Auto-transcribed and linked to specific busta
→ Added to busta notes for tracking
→ Material reorder triggered
```

---

## 📦 Materials & Orders Management

### Material Categories

The system manages five supplier categories:

```typescript
// Supplier types
type SupplierType =
  | 'lenti'           // Optical lenses
  | 'montature'       // Frames
  | 'lac'             // Contact lenses
  | 'sport'           // Sports eyewear
  | 'lab_esterno'     // External lab services

interface Supplier {
  nome: string
  referente_nome: string
  telefono: string
  email: string
  web_address: string      // Portal URL for ordering
  tempi_consegna_medi: number
  note: string
}
```

### Order States & Workflow

```typescript
// Order material states
enum OrderStatus {
  DA_ORDINARE = 'da_ordinare',        // Needs to be ordered
  ORDINATO = 'ordinato',              // Order sent to supplier
  IN_ARRIVO = 'in_arrivo',            // Confirmed by supplier
  IN_RITARDO = 'in_ritardo',          // Past expected date
  CONSEGNATO = 'consegnato',          // Delivered and verified
  ACCETTATO_CON_RISERVA = 'accettato_con_riserva',  // Delivered with issues
  RIFIUTATO = 'rifiutato'             // Rejected, needs reorder
}
```

### Operations Console (Manager/Admin)

The Operations Console provides bulk management tools:

#### Tab: "Da Ordinare" (To Order)
```typescript
// Bulk order materials
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
    // Update related buste status
    await updateRelatedBusteStatus(materialIds)
  }
}
```

#### Tab: "In Ritardo" (Delayed)
```typescript
// Automatic delay detection
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

### Supplier Portal Integration

```typescript
// Supplier management with portal links
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

### Material Ordering Examples

#### Example 1: Progressive Lenses Order
```typescript
const orderProgressiveLenses = async (bustaId: string) => {
  const material = {
    busta_id: bustaId,
    descrizione: 'Lenti progressive Varilux 1.6 AR',
    fornitore_lenti_id: 'essilor_id',
    quantita: 1,
    prezzo_unitario: 180.00,
    da_ordinare: true,
    note_ordine: 'Add +2.00, Cyl -0.75 x 90°'
  }

  await supabase.from('ordini_materiali').insert(material)
}
```

#### Example 2: Frame Order with Tracking
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

  // Calculate estimated delivery
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

## 💰 Payment System

### Payment Plans Support

The system supports four payment patterns:

```typescript
type PaymentPlan =
  | 'one_shot'              // Single payment
  | 'deposit_then_balance'  // Deposit + balance at delivery
  | 'friendly'              // 2-3 installments for regulars
  | 'consumer_credit'       // 12x through bank

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

### Payment Recording

```typescript
// Record payment
const recordPayment = async (payment: {
  busta_id: string
  amount: number
  method: 'cash' | 'card' | 'transfer' | 'credit' | 'other'
  purpose?: 'deposit' | 'balance' | 'generic'
  reference?: string
  note?: string
}) => {
  // Insert payment record
  const { data: paymentRecord } = await supabase
    .from('payments')
    .insert({
      ...payment,
      received_at: new Date().toISOString(),
      received_by: user.id
    })
    .select()
    .single()

  // Update finance status
  await updateFinanceStatus(payment.busta_id)

  return paymentRecord
}
```

### Finance Status Calculation

```typescript
// Calculate payment status
const updateFinanceStatus = async (bustaId: string) => {
  // Get total paid
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('busta_id', bustaId)

  const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0

  // Get finance info
  const { data: finance } = await supabase
    .from('buste_finance')
    .select('*')
    .eq('busta_id', bustaId)
    .single()

  const outstanding = (finance?.total_amount || 0) - totalPaid

  // Calculate new status
  let newStatus = finance?.status || 'not_set'

  if (outstanding <= 0) {
    newStatus = 'paid'
  } else if (finance?.plan_type === 'deposit_then_balance') {
    // Check if busta is ready for pickup
    const { data: busta } = await supabase
      .from('buste')
      .select('stato')
      .eq('id', bustaId)
      .single()

    if (busta?.stato === 'pronto_ritiro') {
      newStatus = 'due_now'
    }
  }

  // Update status
  await supabase
    .from('buste_finance')
    .update({ status: newStatus })
    .eq('busta_id', bustaId)
}
```

### Payment Workflow Examples

#### Example 1: Deposit Flow
```typescript
// Customer places order with deposit
const handleDeposit = async (bustaId: string, depositAmount: number) => {
  // Record deposit payment
  await recordPayment({
    busta_id: bustaId,
    amount: depositAmount,
    method: 'card',
    purpose: 'deposit'
  })

  // Set finance plan
  await supabase
    .from('buste_finance')
    .upsert({
      busta_id: bustaId,
      plan_type: 'deposit_then_balance',
      status: 'awaiting_delivery'
    })

  // Update busta status to allow material ordering
  await supabase
    .from('buste')
    .update({ stato: 'materiali_ordinati' })
    .eq('id', bustaId)
}
```

#### Example 2: Final Balance Collection
```typescript
// Collect balance at delivery
const collectBalance = async (bustaId: string, balanceAmount: number) => {
  await recordPayment({
    busta_id: bustaId,
    amount: balanceAmount,
    method: 'cash',
    purpose: 'balance'
  })

  // Check if fully paid
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
    // Mark as fully paid and suggest busta completion
    await supabase
      .from('buste_finance')
      .update({ status: 'paid' })
      .eq('busta_id', bustaId)

    // Suggest moving to completed
    alert('Pagamento completato! Segna busta come consegnata?')
  }
}
```

#### Example 3: Installment Plan
```typescript
// Set up friendly payment plan
const setupInstallmentPlan = async (bustaId: string, totalAmount: number, installments: number) => {
  // Set finance record
  await supabase
    .from('buste_finance')
    .upsert({
      busta_id: bustaId,
      plan_type: 'friendly',
      total_amount: totalAmount,
      status: 'due_now'
    })

  // Create installment schedule
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

## 📞 Follow-up System

### Automated Customer Satisfaction Calls

The follow-up system generates prioritized call lists based on purchase value and type:

#### Priority Logic
```typescript
// Smart prioritization algorithm
const calculatePriority = (busta: any): 'alta' | 'normale' | 'bassa' => {
  const totalValue = busta.total_amount || 0
  const workType = busta.tipo_lavorazione
  const isFirstLAC = busta.is_first_lac_purchase

  if (totalValue >= 400 && ['OCV', 'OV'].includes(workType)) {
    return 'alta'      // Complete glasses €400+
  }

  if (isFirstLAC || (totalValue >= 100 && workType === 'LV')) {
    return 'normale'   // First LAC or lenses €100+
  }

  if (totalValue >= 400 && workType === 'OS') {
    return 'bassa'     // Sunglasses €400+
  }

  return 'bassa'       // Default low priority
}
```

---

## 📈 Error Tracking System

### Error Categories & Cost Tracking

```typescript
// Error classification
interface ErrorRecord {
  error_type: 'anagrafica_cliente' | 'materiali_ordine' | 'comunicazione_cliente' |
              'misurazioni_vista' | 'controllo_qualita' | 'consegna_prodotto' |
              'gestione_pagamenti' | 'voice_note_processing' | 'busta_creation' | 'altro'

  error_category: 'critico' | 'medio' | 'basso'  // Auto-determines cost range
  cost_amount: number                            // €200-500 | €50-200 | €5-50
  cost_type: 'real' | 'estimate'
  employee_id: string
  client_impacted: boolean
  requires_reorder: boolean
  time_lost_minutes: number
}
```

---

## 📚 Procedures Management

### Digital Manual System

```typescript
// Procedure structure
interface Procedure {
  title: string
  slug: string
  description: string
  content: string                    // Markdown format
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

## 🔌 API Documentation

### Authentication Endpoints

#### POST /api/auth/login
```typescript
// Login request
interface LoginRequest {
  email: string
  password: string
}

// Example usage
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})

if (response.ok) {
  const { user, session } = await response.json()
  // Handle successful login
}
```

### Buste Management

#### GET /api/buste
```typescript
// List buste with filters
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

## 🛠 Installation & Setup

### Prerequisites

- **Node.js** 18.17 or later
- **npm** or **yarn** package manager
- **Supabase** account and project
- **Telegram Bot Token** (for voice notes)
- **AssemblyAI API Key** (for transcription)

### Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# AssemblyAI (Voice Transcription)
ASSEMBLYAI_API_KEY=your_assemblyai_api_key

# Email Configuration (for error tracking letters)
ARUBA_EMAIL_PASSWORD=your_email_password

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Application Installation

#### 1. Clone Repository
```bash
git clone https://github.com/your-org/gestionale-ottico.git
cd gestionale-ottico
```

#### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

#### 3. Start Development Server
```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:3000`.

---

## 🚀 Deployment

### Vercel Deployment (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### Post-Deployment Checklist

- [ ] Verify all environment variables are set
- [ ] Test user authentication
- [ ] Confirm Telegram webhook is working
- [ ] Test voice note transcription
- [ ] Verify database connectivity
- [ ] Check email functionality (error tracking)
- [ ] Test all user roles and permissions
- [ ] Validate API endpoints

---

## 💡 Usage Examples

### Complete Workflow Example

#### Scenario: New Customer Eye Exam

```typescript
// 1. Customer arrives for eye exam
const customer = await createCustomer({
  nome: 'Mario',
  cognome: 'Rossi',
  telefono: '+39 123 456 789',
  email: 'mario.rossi@email.com'
})

// 2. Create new busta for eye exam
const busta = await createBusta({
  cliente_id: customer.id,
  tipo_lavorazione: 'OCV',
  priorita: 'normale'
})

// 3. After exam, add required materials
await addMaterial(busta.id, {
  descrizione: 'Lenti progressive Varilux 1.6',
  fornitore_lenti_id: 'essilor_id',
  prezzo_unitario: 180.00
})

// 4. Customer pays deposit
await recordPayment({
  busta_id: busta.id,
  amount: 150.00,
  method: 'card',
  purpose: 'deposit'
})

// 5. Update busta status to enable ordering
await updateBustaStatus(busta.id, 'materiali_ordinati')
```

---

## 🤝 Contributing

### Development Guidelines

1. **Code Style**: Follow TypeScript best practices
2. **Testing**: Add tests for new features
3. **Documentation**: Update docs for API changes
4. **Security**: Follow security best practices
5. **Performance**: Optimize for fast loading

### Pull Request Process

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Support

For support and questions:

- **Documentation**: Check this README and code comments
- **Issues**: Use GitHub Issues for bugs and feature requests
- **Email**: Contact the development team

---

**Built with ❤️ for Ottica Bianchi**
