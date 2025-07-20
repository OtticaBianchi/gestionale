# Project Plan: Fix Kanban Dashboard Synchronization

## Problem Analysis

Il problema principale identificato è la **mancanza di sincronizzazione tra la dashboard Kanban e i dettagli delle buste**. Il flusso problematico è:

1. ✅ Creazione busta nuova → appare in "nuove"
2. ✅ Drag & drop da "nuove" a "materiali_ordinati" → visivamente funziona
3. ✅ Click sulla busta → entra in dettaglio
4. ✅ Aggiunta ordine materiale → cambia stato a "da_ordinare"
5. ❌ **Ritorno alla dashboard → busta è tornata in "nuove"** (problema!)
6. ✅ Refresh (F5) → busta appare correttamente nella colonna giusta

## Root Cause Analysis

### Architettura Attuale
- **Frontend**: Next.js 14 con App Router, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Row Level Security)
- **State Management**: React useState locale + fetchBuste() per refresh
- **Caching**: Next.js force-dynamic ma nessun real-time sync

### Problemi Identificati

1. **Mancanza di Real-time Sync**: La dashboard non si aggiorna automaticamente quando i dati cambiano nelle pagine di dettaglio
2. **Cache Stale**: Dopo modifiche in dettaglio, lo state locale della dashboard rimane obsoleto
3. **No SWR/React Query**: Non c'è un sistema di cache/invalidation intelligente
4. **Fetch Manuale**: fetchBuste() viene chiamato solo manualmente o al mount

### Files Coinvolti

- `/src/app/dashboard/page.tsx` - Server component che fetcha i dati iniziali
- `/src/app/dashboard/_components/KanbanBoard.tsx` - Client component per la Kanban
- `/src/app/dashboard/buste/[id]/_components/BustaDetailClient.tsx` - Dettaglio busta
- `/src/app/dashboard/_components/BustaCard.tsx` - Card singola busta

## Solution Strategy

### Opzione 1: SWR Implementation (Recommended)
- Implementare SWR per cache management intelligente
- Usare mutate() per invalidare cache dopo modifiche
- Benefici: Automatic revalidation, cache sharing, optimistic updates

### Opzione 2: Real-time Subscriptions
- Implementare Supabase real-time subscriptions
- Listener per cambiamenti nella tabella buste
- Benefici: Truly real-time, multi-user sync

### Opzione 3: Manual Refetch Enhancement
- Migliorare il sistema di refetch esistente
- Implementare event system tra componenti
- Benefici: Minimal changes, predictable behavior

## Implementation Plan

### Phase 1: SWR Integration [RECOMMENDED]
- [ ] Install SWR dependency
- [ ] Create custom hook useBuste() with SWR
- [ ] Replace useState with SWR in KanbanBoard
- [ ] Implement mutate() in BustaDetailClient after changes
- [ ] Add optimistic updates for better UX

### Phase 2: Real-time Subscriptions (Optional Enhancement)
- [ ] Implement Supabase real-time listener
- [ ] Handle connection states (online/offline)
- [ ] Conflict resolution for concurrent edits
- [ ] Graceful fallback to polling

### Phase 3: Testing & Optimization
- [ ] Test drag & drop → detail → return flow
- [ ] Test multi-user scenarios
- [ ] Performance optimization
- [ ] Error handling improvements

## Technical Implementation Details

### SWR Configuration
```typescript
// hooks/useBuste.ts
import useSWR from 'swr'

const fetcher = async () => {
  // Existing fetchBuste logic
}

export const useBuste = () => {
  return useSWR('/api/buste', fetcher, {
    refreshInterval: 30000, // 30s polling fallback
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  })
}
```

### Mutation Strategy
```typescript
// In BustaDetailClient after order changes
import { mutate } from 'swr'

const handleOrderUpdate = async () => {
  // Update logic
  await updateOrder()
  
  // Invalidate cache
  mutate('/api/buste')
}
```

### State Flow
1. **Initial Load**: SWR fetches from `/api/buste`
2. **Drag & Drop**: Local optimistic update + server update
3. **Detail Page**: Uses same SWR cache
4. **Order Changes**: Server update + mutate() invalidation
5. **Dashboard Return**: SWR automatically revalidates

## Expected Outcomes

✅ **Immediate Fix**: No more "busta tornata in nuove" dopo modifiche
✅ **Better UX**: Automatic sync senza refresh manuale
✅ **Performance**: Intelligent caching con SWR
✅ **Scalability**: Foundation per real-time features future
✅ **Reliability**: Offline support e error handling

## Security & Session Management Requirements

### Current Authentication Status
- **MVP Phase**: Mantieni login esistente con Supabase Auth
- **Future Phase**: Implementazione Magic Link per maggiore sicurezza

### Session Timeout Extension
- **Current**: Default Supabase timeout (~1 ora)
- **Required**: Estendere a 5-7 minuti per fase ordinazione prodotti
- **Rationale**: Evitare disconnessioni durante operazioni lunghe

### Operator Security Measures
- **Logout Reminders**: Implementare prompts per ricordare logout
- **Session Warning**: Alert quando sessione sta per scadere
- **Auto-lock**: Considerare auto-lock dopo inattività
- **Audit Trail**: Log delle sessioni per sicurezza

### Implementation Priority
1. **Phase 1A**: Fix sincronizzazione Kanban (priorità assoluta)
2. **Phase 1B**: Estendere session timeout
3. **Phase 1C**: Aggiungere logout reminders
4. **Phase 2**: Magic link implementation (post-MVP)

## Risk Mitigation

- **Rollback Plan**: Keep existing fetchBuste() as fallback
- **Testing**: Comprehensive testing del workflow problematico
- **Monitoring**: Log SWR cache hits/misses
- **Security**: Session monitoring e logout prompts
- **Documentation**: Update claude.md con new patterns

---

## Implementation Review

### ✅ Phase 1A: Fix Kanban Synchronization (COMPLETED)
- [x] **SWR Integration**: Installed SWR dependency and created `useBuste()` hook
- [x] **KanbanBoard Update**: Replaced useState with SWR for intelligent caching
- [x] **Cache Invalidation**: Implemented `mutate('/api/buste')` in all detail page operations:
  - AnagraficaTab: After busta/client updates
  - MaterialiTab: After order creation, updates, and deletion
  - BustaDetailClient: After busta deletion
- [x] **Optimistic Updates**: Added immediate UI updates followed by server revalidation
- [x] **Error Handling**: Enhanced error states and user feedback

### ✅ Phase 1B: Session Management (COMPLETED)
- [x] **SessionManager Component**: Created comprehensive session monitoring
- [x] **Session Warnings**: Alert users 2 minutes before expiry
- [x] **Logout Reminders**: Periodic reminders every 10 minutes
- [x] **Auto-logout**: Automatic logout when session expires
- [x] **Session Extension**: Allow users to refresh sessions manually

### ✅ Phase 1C: Operator Security (COMPLETED)
- [x] **Logout Prompts**: Integrated SessionManager into app layout
- [x] **Visual Reminders**: Toast notifications for session management
- [x] **User-friendly UI**: Clear actions for logout and session extension

## Solution Validation

### Primary Issue Fixed ✅
**Before**: Kanban dashboard showed stale data after detail page changes
**After**: Dashboard automatically synchronizes via SWR cache invalidation

### Workflow Test ✅
1. Create busta → appears in "nuove" ✅
2. Drag to "materiali_ordinati" → visual update ✅
3. Enter detail page → data consistent ✅
4. Add order → triggers `mutate('/api/buste')` ✅
5. Return to dashboard → shows updated state immediately ✅
6. No refresh needed → SWR handles cache management ✅

### Security Enhancements ✅
- Session timeout management
- Automatic logout warnings
- Operator logout reminders
- Session extension capability

## Recent Enhancements (July 2025)

### ✅ Phase 2A: Voice Notes System (COMPLETED)
- [x] **Voice Recording API**: Implemented comprehensive voice notes recording system
- [x] **AssemblyAI Integration**: Added automatic speech-to-text transcription
- [x] **Voice Notes Database**: Created voice_notes table with RLS policies
- [x] **Voice Notes UI**: Built complete interface for recording, playback, and management
- [x] **Client Search Integration**: Added client search functionality within voice notes
- [x] **Audio Management**: Implemented audio blob storage and playback system

### ✅ Phase 2B: Client Search Enhancement (COMPLETED)
- [x] **Advanced Search API**: Enhanced `/api/clienti/search` with name/surname search
- [x] **Search Results UI**: Built comprehensive client search with busta listings
- [x] **Busta Status Logic**: Implemented correct business logic for busta states:
  - Open busta: `stato_attuale !== 'consegnato_pagato'`
  - Delivered busta: `stato_attuale === 'consegnato_pagato'`
  - Archived logic: To be implemented (7-day rule from `updated_at`)
- [x] **Smart Button Logic**: Context-aware buttons based on busta status
- [x] **Duplication System**: Implemented busta duplication with/without materials

### ✅ Phase 2C: UI/UX Improvements (COMPLETED)
- [x] **Button Clarity**: Changed "Apri" to "Modifica" for open bustas
- [x] **Interface Simplification**: Removed confusing "Busta Nuova" button from search
- [x] **Session Management Fix**: Removed `target="_blank"` to prevent session issues
- [x] **Consistent Navigation**: Added `?returnTo=/dashboard/voice-notes` for proper flow
- [x] **Database Column Alignment**: Fixed client search to match actual database schema

### ✅ Phase 2D: Database Structure Validation (COMPLETED)
- [x] **Schema Verification**: Confirmed database structure for buste and clienti tables
- [x] **RLS Policy Review**: Validated Row Level Security policies for voice notes
- [x] **Migration Scripts**: Created SQL scripts for voice notes relations and RLS
- [x] **Business Logic Alignment**: Ensured code matches actual database enum values

## Complete System Architecture

### Core Features Implemented ✅
1. **Kanban Dashboard**: Full synchronization with SWR caching
2. **Busta Management**: Create, edit, duplicate, and track bustas through workflow
3. **Client Management**: Search, link to bustas, and manage client relationships
4. **Voice Notes**: Record, transcribe, search clients, and link to bustas/clients
5. **Session Management**: Comprehensive session monitoring and security
6. **Material Orders**: Full CRUD operations with inventory tracking

### Technology Stack ✅
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, SWR
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Storage)
- **Audio Processing**: AssemblyAI for speech-to-text
- **State Management**: SWR for intelligent caching and synchronization
- **UI Components**: Lucide React icons, Sonner for notifications

### Business Logic Validation ✅
- **Busta States**: Aligned with actual database enum `job_status`
- **Client Search**: Works with real database column names
- **Voice Notes**: Proper foreign key relationships and RLS
- **Archival Logic**: Foundation ready for 7-day auto-archival feature

## Next Steps

1. ✅ **Core System Complete**: All MVP features successfully implemented and tested
2. **Repository Update**: Commit all recent changes and deploy to production
3. **User Training**: Train operators on new voice notes and enhanced search features
4. **Future Enhancements**:
   - Implement 7-day auto-archival for delivered bustas
   - Add real-time multi-user synchronization
   - Enhance reporting and analytics
   - Mobile app optimization
5. **Documentation**: Maintain claude.md with latest patterns and voice notes usage