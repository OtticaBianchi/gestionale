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

## Next Steps

1. ✅ **Implementation Complete**: All phases successfully implemented
2. **User Testing**: Deploy to MVP environment for operator testing
3. **Performance Monitoring**: Monitor SWR cache performance
4. **Future Enhancements**: Consider real-time subscriptions for multi-user sync
5. **Documentation**: Update claude.md with SWR patterns and session management