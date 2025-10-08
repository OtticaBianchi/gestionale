# Gestionale Ottica Bianchi - System Overview (CORRECTED)

**Last Updated**: October 4, 2025
**Version**: 3.0.1

---

## Buste Workflow - Kanban States

### Current: 7 States (Manual Transitions)

1. **nuovo** - Customer just arrived, initial intake
2. **materiali_ordinati** - Products ordered from suppliers
3. **materiali_parzialmente_arrivati** - Some products arrived
4. **materiali_arrivati** - All products received
5. **lavorazione** - Lab is assembling/adjusting the eyewear
6. **pronto_ritiro** - Ready for customer pickup
7. **consegnato_pagato** - Fully paid ✅ (auto-archives)

### Important Notes
- All state transitions are currently **MANUAL**
- Future plan: Make some transitions **AUTOMATIC** (to be defined)
- Target: Reduce to **6 states** (which state to remove TBD)

---

## Role-Based Access Control (CORRECTED)

### 👤 Operatore (Operator)
- **READ-ONLY** access to everything
- Cannot create, edit, or delete anything
- View-only mode for all modules

### 👔 Manager
- Can do **ANYTHING** except:
  - ❌ Cannot DELETE buste
  - ❌ Cannot DELETE orders
  - ❌ Cannot DELETE clients
- Full create and edit permissions
- Access to all modules and features

### 🔑 Admin
- **FULL PERMISSIONS** - no restrictions
- Can delete buste, orders, and clients
- System configuration access
- Analytics dashboard access
- User management

---

## Material Order States (Automatic Transitions)

Material orders within each busta have their own lifecycle with **AUTOMATIC** transitions:

**Automatic States:**
- `da_ordinare` → `ordinato` → `in_arrivo` → `in_ritardo` (if delayed)

**Manual States:**
- `consegnato`, `accettato_con_riserva`, `rifiutato`

These operate independently from the main busta workflow states.

---

## Key Differences from Previous Understanding

| Aspect | Previous (INCORRECT) | Current (CORRECT) |
|--------|---------------------|-------------------|
| Number of busta states | 9 | 7 |
| State: misure_prese | Existed | REMOVED |
| State: consegnato_non_pagato | Existed | REMOVED (merged into consegnato_pagato) |
| Busta state transitions | Some automatic | ALL MANUAL (for now) |
| Operatore permissions | Could create/edit | READ-ONLY |
| Manager delete permissions | Could delete | CANNOT delete buste/orders/clients |
| Future busta states | Unknown | Planning to reduce to 6 |

---

## System Architecture

### Technology Stack
- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Deployment**: Vercel
- **Integrations**: Telegram Bot, AssemblyAI (transcription)

### Main Modules
1. **Buste Management** - Kanban workflow (7 states)
2. **Cliente (Customer) Management** - Anagrafica
3. **Materials Management** - 6 categories (Lenti, Montature, LAC, Sport, Lab Esterno, Accessori)
4. **Payment System** - 4 payment patterns
5. **Follow-up System** - Post-delivery satisfaction calls
6. **Error Tracking** - Team performance monitoring
7. **Procedures Management** - Digital operations manual
8. **Analytics Dashboard** - Business intelligence (v3.0.1)
9. **Voice Notes** - Telegram bot integration
10. **Supplier Management** - Portal links and tracking

### Data Security
- Row Level Security (RLS) on all tables
- Role-based policies (operatore/manager/admin)
- Supabase authentication
- Immutable audit logs

---

## Notes for Future Development

### Planned Changes
- [ ] Reduce busta states from 7 to 6 (decision pending on which to remove)
- [ ] Implement automatic busta state transitions (TBD which states)
- [ ] Define rules for automatic progression

### Current Automation
- ✅ Material order states (automatic: da_ordinare → ordinato → in_arrivo → in_ritardo)
- ✅ Delivery date calculations (business days only)
- ✅ Follow-up call generation (7-14 days post-delivery)
- ✅ Busta auto-archiving (7 days after consegnato_pagato)
- ❌ Busta state transitions (currently manual, automation planned)

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
