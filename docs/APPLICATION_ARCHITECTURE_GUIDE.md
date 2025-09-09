# 📋 Gestionale Ottico - Application Architecture Guide

> **Critical Reference Document** - Read this before making any modifications!

## 🏗️ Application Overview

**Tech Stack:**
- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
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
  - New “Conferma ordine + Acconto” action: enter Deposit amount, Method, Reference/Note, Date (defaults to today); or "Nessun acconto".
  - On submit: creates a `payments` row with purpose=deposit; sets `plan_type='deposit_then_balance'` and `status='awaiting_delivery'`; moves busta to `materiali_ordinati`.
- PagamentiTab
  - Always-visible header: Total | Paid | Outstanding | Status badge.
  - “Imposta totale” (editable until delivery) if not already computed via items.
  - At `pronto_ritiro`: primary CTA “Registra saldo” (prefill Outstanding); on success, if Outstanding=0 → suggest “Segna consegnato_pagato”.
  - Friendly plan: quick presets (2 or 3 rate) to suggest amounts/dates; still record actual cash-ins as `payments` (no hard schedule table required).
  - Consumer credit: record one payment with method=credit; store provider/contract; status becomes `paid`.

Busta Closure and Archive:
- When Outstanding = 0, surface a prominent “Chiudi busta” action to move to `consegnato_pagato`.
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

## 🔄 Recent Changes (Voice Notes, Orders, Suppliers)

What changed in this iteration:

- Voice Notes
  - Compact UI: smaller cards, denser grid, trimmed typography for faster scanning in `/dashboard/voice-notes`.
  - Link actions: from the search panel, admins can now:
    - “Collega al Cliente” → sets `voice_notes.cliente_id`.
    - “Collega qui” on any busta → sets `voice_notes.busta_id` (and `cliente_id` accordingly).
  - Re-transcription on link: when linking and `redo_transcription = true`, we re-run transcription (AssemblyAI) if audio is still present; then append the resulting text to `buste.note_generali`. The append is idempotent per voice note (marker `[VoiceNote <id>]`).
  - Audio retention: audio payload is purged after 7 days from completion (`processed_at`) to save DB space (we keep metadata and transcription). Admin GET on the list triggers a cleanup update; a dedicated cron endpoint is planned.

- Orders (Filtri Ordini)
  - “Chiama” replaced with “Apri portale”: supplier portal link opens in a new tab if `web_address` is set; email button remains.
  - Method badge prefers `Portale` when URL exists.
  - Quick access button “Gestisci fornitori” added to `/dashboard/filtri-ordini` header.

- Suppliers Management (Manager)
  - New page: `/modules/fornitori` (manager/admin) with tabs for categories and inline edit.
  - Fields: `nome`, `referente_nome`, `telefono`, `email`, `web_address`, `tempi_consegna_medi`, `note`.
  - API: `GET/POST /api/fornitori?tipo=...` and `PATCH /api/fornitori/[id]?tipo=...` (service-role after role check).
  - DB: added `referente_nome` to all supplier tables via `scripts/add_supplier_referente.sql`.
  - Seeds: placeholder portals in `scripts/seed_supplier_portals.sql`.

Notes:
- Current voice-notes storage uses `voice_notes.audio_blob` (base64). We clear it after retention; consider migrating to Supabase Storage + signed URLs later.

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
