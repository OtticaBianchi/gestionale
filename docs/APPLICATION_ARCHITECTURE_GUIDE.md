# 📋 Gestionale Ottico - Application Architecture Guide

> **Critical Reference Document** - Read this before making any modifications!

## 🏗️ Application Overview

**Tech Stack:**
- **Frontend:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **File Storage:** Supabase Storage
- **External Services:** Telegram Bot, AssemblyAI (voice transcription)

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (app)/             # Protected routes layout
│   ├── api/               # API endpoints
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Main application interface
│   ├── admin/             # Admin-only pages
│   ├── modules/           # Role-based modules
│   ├── procedure/         # Procedures management system
│   └── profile/           # User profile & management
├── components/            # Reusable UI components
├── context/               # React context providers
├── lib/                   # Utility libraries
├── telegram/              # Telegram bot implementation
└── types/                 # TypeScript type definitions
```

---

## 🎯 Core Application Components

### 1. **DASHBOARD** (`/dashboard`)
**Main Interface - Kanban Board System**

**Key Files:**
- **`src/app/dashboard/page.tsx`** - Main dashboard with Kanban columns
- **`src/app/dashboard/_components/DashboardActions.tsx`** - Action buttons (New Busta, Orders, etc.)
- **`src/app/dashboard/_components/UserProfileHeader.tsx`** - User info display

**Database Tables:**
- **`buste`** - Main work orders
- **`profiles`** - User information

**Kanban Columns (based on `buste.stato`):**
1. `nuovo` - New orders
2. `misure_prese` - Measurements taken
3. `materiali_ordinati` - Materials ordered
4. `materiali_parzialmente_arrivati` - Partially arrived
5. `materiali_arrivati` - Materials arrived
6. `lavorazione` - In progress
7. `pronto_ritiro` - Ready for pickup
8. `consegnato_non_pagato` - Delivered unpaid
9. `consegnato_pagato` - Completed

**To Modify Dashboard:**
- **Add new column:** Update `STATI_CONFIG` in `dashboard/page.tsx`
- **Change actions:** Edit `DashboardActions.tsx`
- **Modify layout:** Update `dashboard/page.tsx` grid system

---

### 2. **BUSTA (Work Order)** System

#### **Busta Detail View** (`/dashboard/buste/[id]`)
**Key Files:**
- **`src/app/dashboard/buste/[id]/page.tsx`** - Main busta page
- **`src/app/dashboard/buste/[id]/_components/BustaDetailClient.tsx`** - Client component with tabs
- **`src/app/dashboard/buste/[id]/_components/tabs/`** - Individual tab components

**Tab Structure:**
- **`InfoTab.tsx`** - Basic busta information
- **`MaterialiTab.tsx`** - Materials and orders management  
- **`PagamentiTab.tsx`** - Payment tracking
- **`ComunicazioniTab.tsx`** - Communications/notes

#### **Database Schema - Busta:**
```sql
buste (
  id TEXT PRIMARY KEY,           -- Format: 2025-0001
  cliente_id UUID,
  stato VARCHAR,                 -- Kanban column state
  data_creazione TIMESTAMP,
  note_interne TEXT,
  created_by UUID,
  -- Additional fields in each tab
)
```

**To Modify Buste:**
- **Add new field:** Update database, then add to relevant tab component
- **New tab:** Create new file in `_components/tabs/` and add to `BustaDetailClient.tsx`
- **Change workflow:** Modify state transitions in detail components

---

### 3. **MATERIALI & ORDINI** System

#### **Materials Management** (`MaterialiTab.tsx`)
**Core Functionality:**
- Track materials needed for each busta
- Mark items as "da ordinare" (to be ordered)
- Update arrival status
- Link to suppliers

**Database Tables:**
- **`ordini_materiali`** - Individual material line items
  ```sql
  ordini_materiali (
    id UUID PRIMARY KEY,
    busta_id TEXT,                -- Links to buste.id
    descrizione TEXT,
    fornitore VARCHAR,
    quantita INTEGER,
    prezzo_unitario DECIMAL,
    da_ordinare BOOLEAN,          -- Needs to be ordered
    stato VARCHAR,                -- arrived, partial, etc.
    data_ordine DATE,
    data_arrivo_prevista DATE,
    data_arrivo_effettiva DATE
  )
  ```

#### **Order Management** (`/dashboard/filtri-ordini`)
**Key Files:**
- **`src/app/dashboard/filtri-ordini/page.tsx`** - Bulk order management

**Features:**
- Group orders by supplier
- Bulk mark as ordered
- Filter by status
- Export order lists

**To Modify Orders:**
- **Add supplier:** Update supplier list in `MaterialiTab.tsx`
- **New order status:** Update `stato` enum in database and UI
- **Change workflow:** Modify order processing logic

Supplier Portals (URLs):
- Each supplier table has a `web_address` field used by `/dashboard/filtri-ordini` to open the ordering portal in a new tab.
- We keep the email action; the old phone action is replaced by “Apri portale”. If no URL is set, the button is disabled.
- Seed placeholders via `scripts/seed_supplier_portals.sql` (Hoya, Zeiss, Essilor, Luxottica, etc.). Replace with real URLs when available.

---

### 6a. **Suppliers Management** (Manager)

Purpose: managers/admins keep supplier data current so ordering is fast and consistent.

Route:
- `/modules/fornitori` (manager+ role; protected in middleware)

Fields per supplier:
- `nome`, `referente_nome`, `telefono`, `email`, `web_address` (ordering URL), `tempi_consegna_medi`, `note`

Supported categories (separate tables):
- `fornitori_lenti`, `fornitori_montature`, `fornitori_lac`, `fornitori_sport`, `fornitori_lab_esterno`

DB Migration:
- Add contact person: `scripts/add_supplier_referente.sql` adds `referente_nome` to all supplier tables.

API Endpoints (role-checked → service role):
- `GET /api/fornitori?tipo=lenti|montature|lac|sport|lab_esterno` → list suppliers
- `POST /api/fornitori?tipo=...` → create supplier
- `PATCH /api/fornitori/[id]?tipo=...` → update supplier

UI:
- Tabbed categories, inline edit rows, quick add form, fields listed above. The `web_address` directly powers the “Apri portale” button in Filtri Ordini.

---

### 4. **VOICE NOTES** System (`/dashboard/voice-notes`)

**Key Files:**
- **`src/app/dashboard/voice-notes/page.tsx`** - Voice notes interface
- **`src/telegram/`** - Telegram bot implementation
- **`src/app/api/voice-notes/`** - API endpoints

**Database Tables:**
- **`voice_notes`** - Telegram voice messages
  ```sql
  voice_notes (
    id UUID PRIMARY KEY,
    telegram_message_id INTEGER,
    user_id UUID,
    transcription TEXT,           -- From AssemblyAI
    audio_url TEXT,
    processed BOOLEAN,
    linked_busta_id TEXT,         -- Optional link to busta
    created_at TIMESTAMP
  )
  ```

**Integration Points:**
- **Telegram Bot:** `src/telegram/bot.js`
- **Transcription:** AssemblyAI API
- **Storage:** Supabase Storage for audio files

---

### 5. **USER MANAGEMENT** System

#### **Profile & Admin** (`/profile`)
**Key Files:**
- **`src/app/profile/page.tsx`** - Enhanced profile with user management
- **`src/context/UserContext.tsx`** - Global user state
- **`src/app/api/admin/`** - Admin API endpoints

**Database Tables:**
- **`profiles`** - User profiles
  ```sql
  profiles (
    id UUID PRIMARY KEY,          -- Links to auth.users
    full_name VARCHAR,
    role VARCHAR,                 -- operatore, manager, admin
    avatar_url TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
  )
  ```

**Role System:**
- **`operatore`** - Basic dashboard access
- **`manager`** - + Order management, operations console
- **`admin`** - + User management, all modules

---

### 6. **PAYMENTS & FINANCE** (ASAP)

Purpose: make it trivial to record money in, close a busta, and power weekly/monthly revenue reports and installment reminders.

Scope covers the four payment patterns:
- One-shot payment (most common)
- Deposit at ordering, balance at delivery (record deposit in Materiali)
- Friendly plan (2–3 installments, long-term clients)
- Consumer credit (12x via bank; you receive full amount upfront)

Data Model:
- `buste_finance` (1:1 with `buste`)
  ```sql
  buste_finance (
    busta_id TEXT PRIMARY KEY REFERENCES buste(id) ON DELETE CASCADE,
    plan_type VARCHAR NOT NULL,                -- one_shot | deposit_then_balance | friendly | consumer_credit
    total_amount DECIMAL(10,2),                -- set by operator; can be null until delivery
    balance_due_date DATE,                     -- next due or balance date
    status VARCHAR NOT NULL,                   -- not_set | awaiting_delivery | due_now | overdue | paid (derived + cached)
    credit_provider TEXT,                      -- optional (consumer credit)
    credit_contract_ref TEXT,                  -- optional (consumer credit)
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
  )
  ```
- `payments` (n:1, immutable entries for cash-in events)
  ```sql
  payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    busta_id TEXT NOT NULL REFERENCES buste(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    method VARCHAR NOT NULL,                   -- cash | card | transfer | credit | other
    purpose VARCHAR,                           -- deposit | balance | generic (for reporting)
    received_at TIMESTAMP NOT NULL DEFAULT now(),
    reference TEXT,
    note TEXT,
    received_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT now()
  )
  ```

Key Derived Values (for UI and reports):
- `sum_paid` = SUM(payments.amount WHERE payments.busta_id = buste.id)
- `outstanding` = COALESCE(total_amount, 0) - sum_paid
- Status progression rules (cached into `buste_finance.status` and recomputed on changes):
  - deposit_then_balance: after deposit → `awaiting_delivery`; at `pronto_ritiro` set `due_now`; if past `balance_due_date` and outstanding > 0 → `overdue`; when outstanding = 0 → `paid`.
  - one_shot and consumer_credit: a single payment equal to total marks `paid`.

UI and Flow:
- MaterialiTab (`/dashboard/buste/[id]` → Materiali)
  - New "Conferma ordine + Acconto" action: enter Deposit amount, Method, Reference/Note, Date (defaults to today); or "Nessun acconto".
  - On submit: creates a `payments` row with purpose=deposit; sets `plan_type='deposit_then_balance'` and `status='awaiting_delivery'`; moves busta to `materiali_ordinati`.
- PagamentiTab
  - Always-visible header: Total | Paid | Outstanding | Status badge.
  - "Imposta totale" (editable until delivery) if not already computed via items.
  - At `pronto_ritiro`: primary CTA "Registra saldo" (prefill Outstanding); on success, if Outstanding=0 → suggest "Segna consegnato_pagato".
  - Friendly plan: quick presets (2 or 3 rate) to suggest amounts/dates; still record actual cash-ins as `payments` (no hard schedule table required).
  - Consumer credit: record one payment with method=credit; store provider/contract; status becomes `paid`.

Busta Closure and Archive:
- When Outstanding = 0, surface a prominent "Chiudi busta" action to move to `consegnato_pagato`.
- Auto-archive: after 7 days in `consegnato_pagato`, the busta no longer appears in active Kanban (kept for history and reports).

API Endpoints:
- `POST /api/payments` → create a payment; updates cached finance status and recomputed sums.
- `GET /api/payments?busta_id=...` → list payments for a busta.
- `PATCH /api/buste/[id]/finance` → set plan_type, total_amount, balance_due_date; recompute status.

Security and Roles:
- Operators: view finance/payouts.
- Managers: add payments (create).
- Admin: edit/delete/refund and change finance fields.
- Full audit trail on mutations (payment rows are append-only; edits are admin-only and should log changes).

Reporting (first-class):
- Revenue by day/week/month: aggregate `payments` by `received_at` (date, method), optionally filtered by plan_type.
- Outstanding and overdue: query `buste_finance` where `status IN ('due_now','overdue')` with `outstanding > 0`.
- Deposits vs balances: group by `purpose` to see share of acconti vs saldi.
- Staff performance: sum by `received_by`.

Implementation Note (ASAP): prioritize this module to unlock reliable revenue dashboards and reduce missed installments.

---

### 7. **FOLLOW-UP SYSTEM** ✅ **COMPLETED**

**Purpose**: Automated post-sale customer satisfaction call tracking with intelligent prioritization based on purchase value and type.

**Interface**: `/dashboard/follow-up`
- Call list management with priority-based sorting
- Real-time statistics dashboard with multiple time views
- Enhanced statistics with trend analysis and performance insights
- Integration with existing customer and busta data

**Database Schema**:
```sql
follow_up_chiamate (
  id UUID PRIMARY KEY,
  busta_id UUID REFERENCES buste(id),
  data_generazione DATE DEFAULT CURRENT_DATE,
  data_chiamata TIMESTAMP,
  operatore_id UUID REFERENCES profiles(id),
  stato_chiamata TEXT CHECK (stato_chiamata IN ('da_chiamare', 'chiamato_completato', 'non_vuole_essere_contattato', 'non_risponde', 'cellulare_staccato', 'numero_sbagliato', 'richiamami')),
  livello_soddisfazione TEXT CHECK (livello_soddisfazione IN ('molto_soddisfatto', 'soddisfatto', 'poco_soddisfatto', 'insoddisfatto')),
  note_chiamata TEXT,
  orario_richiamata_da TIME,
  orario_richiamata_a TIME,
  priorita TEXT CHECK (priorita IN ('alta', 'normale', 'bassa'))
)

statistiche_follow_up (
  id UUID PRIMARY KEY,
  data_riferimento DATE DEFAULT CURRENT_DATE,
  operatore_id UUID REFERENCES profiles(id),
  chiamate_totali INTEGER DEFAULT 0,
  chiamate_completate INTEGER DEFAULT 0,
  molto_soddisfatti INTEGER DEFAULT 0,
  soddisfatti INTEGER DEFAULT 0,
  poco_soddisfatti INTEGER DEFAULT 0,
  insoddisfatti INTEGER DEFAULT 0
)
```

**Smart Prioritization Logic**:
- **Alta**: €400+ OCV/OV (complete glasses with lenses) - immediate calls
- **Normale**: First LAC purchase OR €100+ LV (lenses only) - standard calls
- **Bassa**: €400+ OS (sunglasses) - end of list calls
- **WhatsApp Only**: OS €100-400 (future implementation)

**Call Generation**:
- Automatic generation for buste delivered 14-7 days ago
- Excludes already processed calls
- Priority-based ordering
- Product descriptions included for context

**Statistics & Analytics**:
- Multiple time views (day, week, month, quarter, semester, year)
- Per-operator performance tracking
- Real-time insights and recommendations
- Completion rates and satisfaction metrics

**Integration Points**:
- Links with buste and cliente data
- LAC first purchase tracking in MaterialiTab
- Follow-up button in DashboardActions.tsx

---

### 8. **ERROR TRACKING SYSTEM** ✅ **COMPLETED**

**Purpose**: Comprehensive team performance monitoring with error cost tracking and automated warning letter generation.

**Interface**: `/errori`
- Role-based access (operatore: view only, manager/admin: write access)
- Error registration with automatic cost estimation
- Performance analytics with employee ranking
- Automated report generation (weekly to annual)

**Database Schema**:
```sql
error_tracking (
  id UUID PRIMARY KEY,
  busta_id UUID REFERENCES buste(id),
  employee_id UUID REFERENCES profiles(id),
  cliente_id UUID REFERENCES clienti(id),
  error_type TEXT,                           -- anagrafica_cliente, materiali_ordine, etc.
  error_category TEXT CHECK (error_category IN ('critico', 'medio', 'basso')),
  error_description TEXT NOT NULL,
  cost_type TEXT CHECK (cost_type IN ('real', 'estimate')),
  cost_amount DECIMAL(10,2) NOT NULL,
  cost_detail TEXT,
  client_impacted BOOLEAN DEFAULT FALSE,
  requires_reorder BOOLEAN DEFAULT FALSE,
  time_lost_minutes INTEGER DEFAULT 0,
  reported_by UUID REFERENCES profiles(id),
  resolution_status TEXT CHECK (resolution_status IN ('open', 'in_progress', 'resolved', 'cannot_resolve')),
  reported_at TIMESTAMP DEFAULT NOW()
)
```

**Error Categories**:
- **Critico** (€200-500): Major rework, lost clients, significant problems
- **Medio** (€50-200): Callbacks, delays, moderate issues
- **Basso** (€5-50): Minor corrections, small mistakes

**Error Types**:
- anagrafica_cliente, materiali_ordine, comunicazione_cliente
- misurazioni_vista, controllo_qualita, consegna_prodotto
- gestione_pagamenti, voice_note_processing, busta_creation, altro

**Warning Letter System**:
- **Verbal Warnings**: Record-only entries
- **Written Warnings**: PDF generation with company letterhead
- **Disciplinary Actions**: Formal letters with legal language
- **Email Delivery**: Automated sending with PDF attachments
- **Templates**: Pre-formatted with employee statistics and error details

**Reporting System**:
- **HTML Reports**: Weekly, monthly, quarterly, semestral, annual
- **Automated Generation**: One-click report creation with full styling
- **Performance Analytics**: Employee ranking, cost analysis, trend monitoring
- **Export Options**: Downloadable HTML files with complete formatting

**Cost Tracking**:
- **Real Costs**: Actual expenses with detailed breakdown
- **Estimated Costs**: Automatic calculation based on error type/category
- **Time Tracking**: Minutes lost per error for productivity analysis
- **Total Impact**: Comprehensive cost analysis per employee/period

## 🔌 API Endpoints Structure

```
/api/
├── auth/                  # Authentication
│   ├── login/            # POST - User login
│   └── signout/          # POST - User logout
├── admin/                # Admin functions
│   ├── users/            # GET/POST - User management
│   ├── users/[id]/       # PATCH/DELETE - User operations
│   └── invite/           # POST - Send invitations
├── voice-notes/          # Voice notes
│   ├── route.ts          # GET/POST - List/create notes
│   └── [id]/             # GET/PATCH/DELETE - Note operations
├── ordini/               # Orders
│   ├── route.ts          # GET/POST - Order operations
│   └── [id]/             # PATCH - Update orders
├── payments/             # Payments (cash-in)
│   ├── route.ts          # GET/POST - List/create payments
│   └── [id]/             # PATCH/DELETE - Admin edits/refunds
├── buste/
│   └── [id]/
│       └── finance/      # PATCH - Update finance (plan_type, totals, due dates)
├── follow-up/            # Follow-up system
│   ├── route.ts          # GET/POST - List/generate calls
│   ├── calls/            # GET - List calls with filters
│   ├── calls/[id]/       # PATCH - Update call status
│   ├── generate/         # POST - Generate new call lists
│   ├── statistics/       # GET - Performance statistics
│   ├── statistics-enhanced/ # GET - Enhanced analytics
│   ├── debug/            # GET - Debug database state
│   └── generate-bypass/  # POST - Testing bypass generation
├── error-tracking/       # Error tracking system
│   ├── route.ts          # GET/POST/PATCH - List/create/update errors
│   ├── report/           # POST - Generate HTML reports
│   ├── weekly-report/    # POST - Generate weekly reports
│   └── warning-letters/  # POST - Generate warning letters
├── fornitori/            # Supplier management
│   ├── route.ts          # GET/POST - List/create suppliers
│   └── [id]/             # PATCH - Update supplier
└── telegram/             # Telegram integration
    └── webhook/          # POST - Telegram webhook
```

---

## 🗃️ Database Relationships

```mermaid
graph TB
    A[profiles] --> B[buste]
    B --> C[ordini_materiali]
    B --> G[buste_finance]
    B --> H[payments]
    B --> E[comunicazioni]
    A --> F[voice_notes]
    F -.-> B
    
    A[profiles]
    |id|full_name|role|avatar_url|
    
    B[buste]
    |id|cliente_id|stato|created_by|
    
    C[ordini_materiali]
    |busta_id|descrizione|fornitore|da_ordinare|
    
    G[buste_finance]
    |busta_id|plan_type|total_amount|status|
    
    H[payments]
    |busta_id|amount|method|received_at|
```

**Key Relationships:**
- `profiles.id` → `buste.created_by`
- `buste.id` → `ordini_materiali.busta_id`
- `buste.id` → `buste_finance.busta_id`
- `buste.id` → `payments.busta_id`
- `voice_notes.linked_busta_id` → `buste.id` (optional)

---

## 🛠️ Common Modification Patterns

### **Adding New Busta Field**
1. **Database:** Add column to `buste` table
2. **Types:** Update `Database` types in `src/types/database.types.ts`
3. **UI:** Add field to appropriate tab in `_components/tabs/`
4. **API:** Update any relevant API endpoints

### **New Kanban Column**
1. **Database:** Add new `stato` value
2. **Dashboard:** Update `STATI_CONFIG` in `dashboard/page.tsx`
3. **Transitions:** Update state change logic in busta components

### **Adding New Role**
1. **Database:** Update `profiles` table role constraint
2. **Middleware:** Update role checks in `middleware.ts`
3. **UI:** Update role displays and permissions

### **New Material Status**
1. **Database:** Update `ordini_materiali.stato` enum
2. **UI:** Update status displays in `MaterialiTab.tsx`
3. **Logic:** Update order processing workflow

---

## 🔧 Development Commands

```bash
# Development
npm run dev                 # Start dev server
npm run build              # Production build
npm start                  # Start production server

# Database
npm run db:reset           # Reset database (if script exists)
npm run db:migrate         # Run migrations (if script exists)

# Deployment
git add . && git commit -m "message"
git push origin master     # Triggers deployment
```

---

## 🚀 Vercel Deployment Setup

**IMPORTANT:** This project uses GitHub Actions for deployment due to private repository restrictions.

### Required Configuration:

#### 1. GitHub Secrets (Repository Settings → Secrets and variables → Actions)
Add these secrets with exact values from `.env.local`:

**Vercel Configuration:**
- `VERCEL_TOKEN` - Your Vercel API token
- `VERCEL_ORG_ID` - Your Vercel organization/team ID  
- `VERCEL_PROJECT_ID` - Your Vercel project ID

**Application Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ASSEMBLYAI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `OPENROUTER_API_KEY`
- `ARUBA_EMAIL_PASSWORD`

#### 2. GitHub Actions Workflow
File: `.github/workflows/vercel.yml` (already configured)
- Builds with all environment variables
- Deploys to Vercel on every push to master
- Handles private repository deployment issues

#### 3. Getting Vercel IDs:
```bash
# Get Vercel token
npx vercel login
# Go to: https://vercel.com/account/tokens

# Get Project and Org IDs
# Go to Vercel Dashboard → Project → Settings → General
# Copy "Project ID" and "Team ID" (or Personal Account ID)
```

### Troubleshooting:
- **Build fails**: Missing environment variables in GitHub secrets
- **Team access error**: Use GitHub Actions instead of direct Vercel CLI
- **Deploy hook not working**: Environment variables needed for build process

### Deployment Flow:
1. Push to master → GitHub Actions triggers
2. Environment variables loaded from secrets
3. Build succeeds with all dependencies
4. Deploy to Vercel production
5. App is live automatically ✅

---

## 📋 Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# AssemblyAI
ASSEMBLYAI_API_KEY=

# Other
NEXT_PUBLIC_APP_URL=
```

---

## 🚨 Critical Files - DO NOT DELETE

- **`src/context/UserContext.tsx`** - Global auth state
- **`middleware.ts`** - Route protection and auth
- **`src/app/(app)/layout.tsx`** - Main app layout and navigation
- **`src/lib/supabase/`** - Database connection configs
- **Database migrations** - Any SQL files in `scripts/`

---

## 📞 Integration Points

### **Telegram Bot**
- **Entry:** `src/telegram/bot.js`
- **Webhook:** `/api/telegram/webhook`
- **Storage:** Voice files in Supabase Storage
- **Processing:** Links to voice_notes table

### **Supabase**
- **Auth:** Automatic user creation
- **RLS:** Row Level Security policies
- **Storage:** Avatar images, voice recordings
- **Real-time:** Not currently used but available

### **External APIs**
- **AssemblyAI:** Voice transcription
- **Telegram API:** Bot messaging

---

## 🎯 Navigation Flow

```
Login → Dashboard (Kanban) → Busta Detail → Back to Dashboard
  ↓
Profile (Personal + Admin Management)
  ↓
Voice Notes ↔ Dashboard
  ↓
Order Management → Dashboard
```

**Key:** All navigation now centers around `/dashboard` - this is the main hub after removing the hub page.

---

## 💡 Quick Reference

**Need to modify the Kanban board?** → `dashboard/page.tsx`  
**Need to change busta workflow?** → `dashboard/buste/[id]/_components/tabs/`  
**Need to update materials?** → `MaterialiTab.tsx`  
**Need to manage orders?** → `dashboard/filtri-ordini/page.tsx`  
**Need to record payments or totals?** → `PagamentiTab.tsx` (+ MaterialiTab deposit flow)  
**Need user management?** → `profile/page.tsx` (admin section)  
**Need to fix auth?** → `middleware.ts` + `context/UserContext.tsx`

---

*Last Updated: September 8, 2025*  
*Version: Post-Hub Removal, Enhanced Profile*

---

## 🔄 Recent Changes (Voice Notes, Orders, Suppliers, Follow-up, Error Tracking)

What changed in this iteration:

### **Voice Notes System**
- Compact UI: smaller cards, denser grid, trimmed typography for faster scanning in `/dashboard/voice-notes`.
- Link actions: from the search panel, admins can now:
  - "Collega al Cliente" → sets `voice_notes.cliente_id`.
  - "Collega qui" on any busta → sets `voice_notes.busta_id` (and `cliente_id` accordingly).
- Auto-transcription at ingest: the Telegram webhook invokes AssemblyAI as soon as the audio arrives, saving the transcript in `voice_notes.transcription` so the card è già leggibile in dashboard. Linking to una busta con `redo_transcription = true` può comunque rigenerare il testo e aggiornare il blocco `[VoiceNote <id>]` in `buste.note_generali`.
- Webhook simplified for serverless: `/api/telegram/webhook` now processes Telegram updates directly (no bot class instantiation). It validates the secret header, downloads the file via Telegram API, saves a `voice_notes` row, and returns immediately. Idempotent by `telegram_message_id`.
- Serverless FS safety: temp writes use `/tmp` only; most processing is in‑memory.
- Audio retention: audio payload is purged after 7 days from completion (`processed_at`) to save DB space (we keep metadata and transcription). Admin GET on the list triggers a cleanup update; a dedicated cron endpoint is planned.

### **Orders & Suppliers System**
- "Chiama" replaced with "Apri portale": supplier portal link opens in a new tab if `web_address` is set; email button remains.
- Method badge prefers `Portale` when URL exists.
- Quick access button "Gestisci fornitori" added to `/dashboard/filtri-ordini` header.
- New page: `/modules/fornitori` (manager/admin) with tabs for categories and inline edit.
- Fields: `nome`, `referente_nome`, `telefono`, `email`, `web_address`, `tempi_consegna_medi`, `note`.
- API: `GET/POST /api/fornitori?tipo=...` and `PATCH /api/fornitori/[id]?tipo=...` (service-role after role check).
- DB: added `referente_nome` to all supplier tables via `scripts/add_supplier_referente.sql`.
- Seeds: placeholder portals in `scripts/seed_supplier_portals.sql`.

### **Follow-up System** ✅ **COMPLETED (Sept 14, 2025)**
- **Purpose**: Automated post-sale customer satisfaction call tracking
- **Interface**: `/dashboard/follow-up` with call management and real-time statistics
- **Database**: `follow_up_chiamate`, `statistiche_follow_up` tables
- **Smart Prioritization Logic**:
  - **Alta**: €400+ OCV/OV (lenses + frames)
  - **Normale**: First LAC purchase or €100+ LV (lenses only)
  - **Bassa**: €400+ OS (sunglasses)
- **Call States**: da_chiamare, chiamato_completato, non_vuole_essere_contattato, non_risponde, cellulare_staccato, numero_sbagliato, richiamami
- **Satisfaction Levels**: molto_soddisfatto, soddisfatto, poco_soddisfatto, insoddisfatto
- **Time-based Generation**: Automatic list creation for deliveries 14-7 days ago
- **Statistics Dashboard**: Multiple time views (day/week/month), operator performance tracking
- **LAC First Purchase**: Checkbox in MaterialiTab for tracking first LAC orders
- **Enhanced Features**: Debugging tools, enhanced statistics, product descriptions display

### **Error Tracking System** ✅ **COMPLETED**
- **Purpose**: Comprehensive team performance monitoring and error cost tracking
- **Interface**: `/errori` with role-based access (operatore view, manager/admin write)
- **Database**: `error_tracking` table with complete audit trail
- **Error Categories**:
  - **Critico**: €200-500 range (major rework, lost clients)
  - **Medio**: €50-200 range (callbacks, delays)
  - **Basso**: €5-50 range (minor corrections)
- **Error Types**: anagrafica_cliente, materiali_ordine, comunicazione_cliente, misurazioni_vista, controllo_qualita, consegna_prodotto, gestione_pagamenti, voice_note_processing, busta_creation, altro
- **Letter Generation System**:
  - Verbal warnings (record only)
  - Written warnings (PDF generation)
  - Disciplinary actions (formal letters)
  - Email delivery system with attachments
- **Automated Reporting**: Weekly, monthly, quarterly, semestral, annual HTML reports
- **Cost Tracking**: Real vs estimated costs, automatic calculation, time lost tracking
- **Performance Analytics**: Employee ranking, cost analysis, trend monitoring
- **Integration**: Links to buste and clienti for context

Notes:
- Current voice-notes storage uses `voice_notes.audio_blob` (base64). We clear it after retention; consider migrating to Supabase Storage + signed URLs later.
- Follow-up system includes comprehensive debugging infrastructure for troubleshooting generation issues.
- Error tracking system provides complete audit trail for team performance management.
- Procedures management system provides searchable digital manual with role-based access control.

---

### 9. **PROCEDURES MANAGEMENT SYSTEM** ✅ **COMPLETED**

**Purpose**: Digital manual system for operational procedures with search, filtering, and administrative management.

**Interface**: `/procedure`
- Main procedures library with search and filtering capabilities
- Individual procedure view with Markdown rendering and favorites
- Admin management dashboard (`/procedure/admin`) for CRUD operations
- Admin edit form (`/procedure/admin/[slug]`) for comprehensive procedure editing

**Key Features:**
- **Searchable procedure library** with full-text search and multi-dimensional filtering
- **Role-based access control** (view for all users, admin edit/create/delete)
- **Categories & types** for organized content structure (11 categories, 4 types)
- **Favorites system** for bookmarking important procedures
- **PDF export** functionality for offline use
- **Markdown content** with visual formatting, checklists, and error indicators
- **View tracking** and analytics for usage insights
- **Mini help** summaries for quick reference

**Database Schema:**
```sql
procedures (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  content TEXT NOT NULL, -- Markdown format
  context_category TEXT CHECK (context_category IN ('accoglienza', 'vendita', 'appuntamenti', 'sala_controllo', 'lavorazioni', 'consegna', 'customer_care', 'amministrazione', 'it', 'sport', 'straordinarie')),
  procedure_type TEXT CHECK (procedure_type IN ('checklist', 'istruzioni', 'formazione', 'errori_frequenti')),
  target_roles TEXT[] DEFAULT '{}',
  search_tags TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  mini_help_title TEXT,
  mini_help_summary TEXT,
  mini_help_action TEXT,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  last_reviewed_at DATE,
  last_reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

procedure_favorites (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  procedure_id UUID REFERENCES procedures(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, procedure_id)
)

procedure_access_log (
  id UUID PRIMARY KEY,
  procedure_id UUID REFERENCES procedures(id),
  user_id UUID REFERENCES profiles(id),
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

procedure_dependencies (
  id UUID PRIMARY KEY,
  procedure_id UUID REFERENCES procedures(id),
  depends_on_id UUID REFERENCES procedures(id),
  relationship_type TEXT CHECK (relationship_type IN ('prerequisite', 'related', 'follows')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(procedure_id, depends_on_id)
)
```

**API Endpoints:**
- `GET /api/procedures` - List procedures with search/filtering (all users)
- `GET /api/procedures/[slug]` - Single procedure view with analytics (all users)
- `POST /api/procedures/[slug]/favorite` - Toggle favorites (all users)
- `PUT /api/procedures/[slug]` - Update procedure (admin only)
- `DELETE /api/procedures/[slug]` - Soft delete (admin only)
- `POST /api/procedures` - Create new procedure (admin only)
- `GET /api/procedures/[slug]/pdf` - Export as HTML/PDF (admin only)

**Categories (11):**
🏠 Accoglienza, 💰 Vendita, 📅 Appuntamenti, 🎛️ Sala Controllo, ⚙️ Lavorazioni, 📦 Consegna, 📞 Customer Care, 📊 Amministrazione, 💻 IT, 🏆 Sport, ⚡ Straordinarie

**Types (4):** Checklist, Istruzioni, Formazione, Errori Frequenti

**Target Roles (6):** Addetti Vendita, Optometrista, Titolare, Manager/Responsabile, Laboratorio, Responsabile Sport

**Key Files:**
- `src/app/procedure/page.tsx` - Main procedures interface
- `src/app/procedure/[slug]/page.tsx` - Individual procedure view
- `src/app/procedure/admin/page.tsx` - Admin management dashboard
- `src/app/procedure/admin/[slug]/page.tsx` - Edit procedure form
- `src/app/api/procedures/route.ts` - Main API endpoint
- `src/app/api/procedures/[slug]/route.ts` - Individual procedure CRUD
- `scripts/procedures_migration.sql` - Database schema
- `scripts/seed_procedures.sql` - Initial data migration

**Migration Process:**
1. Run `scripts/procedures_migration.sql` to create schema
2. Run `scripts/seed_procedures.sql` to import existing procedures
3. Migrated 5 procedures from `procedure_personale/` folder
4. Added procedures link to main navigation sidebar

---

## 🧭 Developer Notes (Next Steps – Important)

- Telegram → Voice Message → Transcription reliability MUST be rock-solid (“Swiss clock”). Improve the pipeline:
  - Retries with backoff for AssemblyAI and Telegram downloads; idempotency keys per Telegram message id.
  - Stronger error logging + alerts; verbose logs behind a flag.
  - Ensure webhook secret validation (already present) + handle timeouts gracefully.
  - Add a background worker or Vercel Cron to reattempt failed transcriptions.

- Voice Notes retention & lifecycle
  - Add `archived_at` and automatic archive (linked notes) vs delete (unlinked) after 7 days from `processed_at`.
  - Replace the “cleanup on GET (admin)” with a dedicated maintenance endpoint `/api/maintenance/voice-notes` and schedule daily.
  - Optional: add UI filter “Archiviate”.

- Payments & Finance (ASAP)
  - Implement DB migrations for `buste_finance` + `payments` and wire `MaterialiTab` deposit flow + `PagamentiTab` header/CTAs.
