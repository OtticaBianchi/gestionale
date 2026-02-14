// app/dashboard/_components/KanbanBoard.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useDroppable,
  CollisionDetection,
  rectIntersection,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { Database } from '@/types/database.types';
import BustaCard from './BustaCard';
import CompactBustaCard from './CompactBustaCard';
import { 
  isTransitionAllowed, 
  getTransitionReason, 
  WorkflowState,
  hasSpecialWorkflow,
  isAdminOnlyTransition
} from './WorkflowLogic';
import { CheckCircle, XCircle, Info, Loader2, RefreshCw, Wifi, WifiOff, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { BustaWithCliente } from '@/types/shared.types';
import { useBuste } from '@/hooks/useBuste';
import { mutate } from 'swr';
import { useUser } from '@/context/UserContext';

interface KanbanBoardProps {
  buste: BustaWithCliente[];
}

type UpdateStatusResult =
  | { ok: true }
  | {
      ok: false;
      code: string;
      httpStatus?: number;
      message?: string;
    };

// Colonne Kanban in ordine (6 stati)
const columns: (Database['public']['Tables']['buste']['Row']['stato_attuale'])[] = [
  'nuove',
  'materiali_ordinati',
  'materiali_arrivati',
  'in_lavorazione',
  'pronto_ritiro',
  'consegnato_pagato',
];

// Nomi colonne user-friendly
const getColumnName = (status: string) => {
  const names: { [key: string]: string } = {
    'nuove': 'Nuove',
    'materiali_ordinati': 'Mat. Ordinati',
    'materiali_arrivati': 'Mat. Arrivati',
    'in_lavorazione': 'In Lavorazione',
    'pronto_ritiro': 'Pronto Ritiro',
    'consegnato_pagato': 'Consegnato & Pagato',
  };
  return names[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Skeleton loader per le card
function BustaCardSkeleton() {
  return (
    <div className="bg-white rounded-md shadow-sm p-2 mb-2 border-l-4 border-l-gray-200 animate-pulse">
      <div className="flex justify-between items-start mb-2">
        <div className="h-3 bg-gray-200 rounded w-16"></div>
        <div className="h-3 bg-gray-200 rounded w-8"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div className="flex justify-end">
        <div className="h-3 bg-gray-200 rounded w-8"></div>
      </div>
    </div>
  );
}

// Componente per le card draggabili
function DraggableBustaCard({
  busta,
  isDragEnabled,
  isExpanded,
  onToggleExpand
}: {
  busta: BustaWithCliente;
  isDragEnabled: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `busta-${busta.id}`,
    disabled: !isDragEnabled
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    // ✅ FIX: Prevent cards from being drop targets
    pointerEvents: isDragging ? 'none' : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDragEnabled ? attributes : {})}
      {...(isDragEnabled ? listeners : {})}
      className={`${isDragEnabled ? (isDragging ? 'cursor-grabbing z-50' : 'cursor-grab') : ''}`}
      // ✅ FIX: Prevent this card from being a drop target for other cards
      data-no-drop="true"
    >
      {isExpanded ? (
        <BustaCard busta={busta} />
      ) : (
        <CompactBustaCard busta={busta} onClick={onToggleExpand} />
      )}
    </div>
  );
}

// 🔧 FIX: Componente per le colonne droppabili - CORRETTO per evitare conflitti UUID
function DroppableColumn({
  status,
  buste,
  suspendedCount,
  isOver,
  isDragEnabled,
  isLoading,
  onHeaderClick,
  isHeaderActive,
  expandedCardId,
  onToggleExpand
}: {
  status: WorkflowState;
  buste: BustaWithCliente[];
  suspendedCount: number;
  isOver: boolean;
  isDragEnabled: boolean;
  isLoading: boolean;
  onHeaderClick?: () => void;
  isHeaderActive?: boolean;
  expandedCardId: string | null;
  onToggleExpand: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${status}`, // ✅ FIX CRITICO: Prefisso per evitare conflitti con UUID buste
  });

  const isFinalColumn = status === 'consegnato_pagato';
  const showSuspendedBadge = status === 'nuove' && suspendedCount > 0;
  const columnShellClasses = isFinalColumn
    ? 'bg-emerald-50 border border-emerald-100/80'
    : 'bg-white/70 border border-slate-200/80 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.6)]';
  const titleColor = isFinalColumn ? 'text-emerald-700' : 'text-slate-700';
  const isInteractive = Boolean(onHeaderClick);
  const countBadgeClasses = isHeaderActive
    ? 'bg-[var(--ink)] text-[var(--paper)] text-xs font-bold px-2 py-1 rounded-full'
    : 'bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-full';

  return (
    <div className="flex-shrink-0 w-64">
      <div className={`${columnShellClasses} rounded-lg p-3 h-full flex flex-col transition-colors duration-200`}>
        {isInteractive ? (
          <button
            type="button"
            onClick={onHeaderClick}
            className={`w-full flex justify-between items-center mb-4 px-2 py-1 rounded-md text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/40 focus:ring-offset-0 ${
              isHeaderActive ? 'bg-white/90 shadow-sm' : 'hover:bg-white/80'
            }`}
            aria-expanded={!!isHeaderActive}
            aria-pressed={!!isHeaderActive}
          >
            <div className="flex items-center gap-2">
              <h2 className={`font-semibold text-[11px] uppercase tracking-[0.16em] ${titleColor}`}>
                {getColumnName(status)}
              </h2>
              {showSuspendedBadge && (
                <span className="text-[10px] font-semibold text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full">
                  SOSPESE {suspendedCount}
                </span>
              )}
            </div>
            <span className={countBadgeClasses}>
              {buste.length}
            </span>
          </button>
        ) : (
          <div className="flex justify-between items-center mb-4 px-2">
            <div className="flex items-center gap-2">
              <h2 className={`font-semibold text-[11px] uppercase tracking-[0.16em] ${titleColor}`}>
                {getColumnName(status)}
              </h2>
              {showSuspendedBadge && (
                <span className="text-[10px] font-semibold text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full">
                  SOSPESE {suspendedCount}
                </span>
              )}
            </div>
            <span className={countBadgeClasses}>
              {buste.length}
            </span>
          </div>
        )}
        {isFinalColumn && (
          <p className="text-[10px] text-emerald-700 bg-emerald-100 rounded px-2 py-1 mx-2 mb-2 font-medium">
            Si archivia automaticamente dopo 1 giorno
          </p>
        )}
        
        <div
          ref={setNodeRef}
          className={`
            flex-grow overflow-y-auto space-y-2 p-2 rounded transition-all duration-200
            min-h-[400px] max-h-[calc(100vh-200px)]
            ${isOver 
              ? 'bg-[var(--teal)]/5 border-2 border-[var(--teal)]/40 border-dashed shadow-inner' 
              : isFinalColumn
                ? 'bg-emerald-50/50'
                : 'bg-transparent'
            }
          `}
          style={{
            position: 'relative',
            zIndex: 10
          }}
          data-column={status}
        >
          {/* Skeleton loaders durante il caricamento iniziale */}
          {isLoading && buste.length === 0 ? (
            <>
              <BustaCardSkeleton />
              <BustaCardSkeleton />
              <BustaCardSkeleton />
            </>
          ) : (
            <>
              <div style={{ pointerEvents: 'auto', position: 'relative', zIndex: 1 }}>
                {isDragEnabled ? (
                  <SortableContext items={buste.map(b => `busta-${b.id}`)} strategy={verticalListSortingStrategy}>
                    {buste.map((busta) => (
                      <DraggableBustaCard
                        key={busta.id}
                        busta={busta}
                        isDragEnabled={isDragEnabled}
                        isExpanded={expandedCardId === busta.id}
                        onToggleExpand={() => onToggleExpand(busta.id)}
                      />
                    ))}
                  </SortableContext>
                ) : (
                  buste.map((busta) => (
                    expandedCardId === busta.id ? (
                      <BustaCard key={busta.id} busta={busta} />
                    ) : (
                      <CompactBustaCard key={busta.id} busta={busta} onClick={() => onToggleExpand(busta.id)} />
                    )
                  ))
                )}
              </div>

              {buste.length === 0 && !isLoading && (
                <div className="text-center text-gray-400 text-xs py-8">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nessuna busta</p>
                  <p className="text-xs mt-1 opacity-75">in questo stato</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KanbanBoard({ buste: initialBuste }: KanbanBoardProps) {
  // ✅ SWR Integration - Replace useState with SWR
  const { data: buste, error: swrError, isLoading: swrLoading, mutate: revalidate } = useBuste();
  
  // Use SWR data if available, fallback to initial data
  const currentBuste = buste || initialBuste || [];
  const suspendedCount = currentBuste.filter(busta => busta.is_suspended).length;
  
  // User context for role checking
  const { profile } = useUser();
  
  const [openStatusList, setOpenStatusList] = useState<WorkflowState | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [dragFeedback, setDragFeedback] = useState<{
    show: boolean;
    allowed: boolean;
    message: string;
    businessRule?: string;
    permissionHint?: string;
  }>({ show: false, allowed: false, message: '' });

  const isAdmin = profile?.role === 'admin';

  const logKanbanDiagnostic = useCallback((
    code: string,
    options: {
      severity?: 'info' | 'warn' | 'error';
      message?: string;
      busta?: BustaWithCliente | null;
      oldStatus?: string;
      newStatus?: string;
      httpStatus?: number;
      context?: Record<string, unknown>;
    } = {}
  ) => {
    const incidentId = `KBN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const busta = options.busta || null;

    const payload = {
      code,
      severity: options.severity || 'warn',
      message: options.message || null,
      bustaId: busta?.id || null,
      readableId: busta?.readable_id || null,
      oldStatus: options.oldStatus || null,
      newStatus: options.newStatus || null,
      tipoLavorazione: busta?.tipo_lavorazione || null,
      incidentId,
      context: {
        http_status: options.httpStatus || null,
        role: profile?.role || null,
        is_online: navigator.onLine,
        online_state: isOnline,
        user_agent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        ...(options.context || {}),
      },
    };

    void fetch('/api/buste/diagnostics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch((error) => {
      console.warn('KANBAN_DIAGNOSTIC_CLIENT_LOG_FAILED', { code, incidentId, error });
    });
  }, [isOnline, profile?.role]);

  // Toggle expand/collapse card
  const handleToggleExpand = useCallback((bustaId: string) => {
    setExpandedCardId(prev => prev === bustaId ? null : bustaId);
  }, []);

  // ✅ Derived loading state
  const isLoading = swrLoading || isUpdating;

  // ✅ FIX: Custom collision detection that prioritizes columns over cards
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // First try to find column collisions
    const columnContainers = args.droppableContainers.filter(
      container => container.id.toString().startsWith('column-')
    );
    
    const columnCollisions = closestCorners({
      ...args,
      droppableContainers: columnContainers
    });
    
    if (columnCollisions.length > 0) {
      return columnCollisions;
    }
    
    // If no column collisions, fall back to default behavior
    return closestCorners(args);
  }, []);

  // ✅ GESTIONE CONNESSIONE ONLINE/OFFLINE
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connessione ripristinata', { duration: 2000 });
      revalidate(); // ✅ Use SWR revalidate instead of fetchBuste
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Connessione persa - Modalità offline', { duration: 3000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [revalidate]);

  // ✅ SWR replaces fetchBuste - now we have revalidate function
  const handleManualRefresh = useCallback(async () => {
    if (!isOnline) {
      toast.error('Impossibile sincronizzare - Offline');
      return;
    }

    try {
      setLastSync(new Date());
      await revalidate();
      toast.success(`Sincronizzate ${currentBuste.length} buste`);
    } catch (error) {
      console.error('❌ Manual refresh error:', error);
      toast.error('Errore durante la sincronizzazione');
    }
  }, [isOnline, revalidate, currentBuste.length]);

  // ✅ Handle SWR errors
  useEffect(() => {
    if (swrError) {
      console.error('❌ SWR Error:', swrError);
      toast.error(`Errore caricamento: ${swrError.message}`);
    }
  }, [swrError]);

  // Sensori drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Helper function to determine priority category
  const getPriorityCategory = useCallback((busta: BustaWithCliente): number => {
    // 1 = CRITICA (highest priority)
    // 2 = URGENTE
    // 3 = IN RITARDO (has delayed orders - only for materiali_ordinati state)
    // 4 = NORMALE (lowest priority)

    if (busta.priorita === 'critica') return 1;
    if (busta.priorita === 'urgente') return 2;

    // Check for delayed orders (only relevant in materiali_ordinati state)
    if (busta.stato_attuale === 'materiali_ordinati') {
      const hasDelays = (busta.ordini_materiali || []).some(
        (ordine) => ordine.stato === 'in_ritardo'
      );
      if (hasDelays) return 3;
    }

    return 4; // normale
  }, []);

  // Helper function to sort buste by priority, then by date (newest first)
  const sortBusteByPriorityAndDate = useCallback((busteList: BustaWithCliente[]) => {
    return [...busteList].sort((a, b) => {
      // First sort by priority category
      const priorityA = getPriorityCategory(a);
      const priorityB = getPriorityCategory(b);

      if (priorityA !== priorityB) {
        return priorityA - priorityB; // Lower number = higher priority
      }

      // Within same priority, sort by date (newest first)
      const dateA = new Date(a.data_apertura).getTime();
      const dateB = new Date(b.data_apertura).getTime();
      return dateB - dateA; // Descending (newest first)
    });
  }, [getPriorityCategory]);

  // Raggruppa le buste per stato with priority sorting applied
  const groupedBuste = useMemo(() => {
    console.log('🔍 GROUPING BUSTE:', currentBuste.map(b => ({ id: b.readable_id || b.id, stato: b.stato_attuale })));

    const groups: { [key: string]: BustaWithCliente[] } = {};
    columns.forEach(col => groups[col] = []);

    currentBuste.forEach(busta => {
      if (groups[busta.stato_attuale]) {
        groups[busta.stato_attuale].push(busta);
      }
    });

    // Apply priority sorting to each group for Kanban display
    Object.keys(groups).forEach(status => {
      groups[status] = sortBusteByPriorityAndDate(groups[status]);
    });

    // Debug: mostra conteggi per colonna
    Object.entries(groups).forEach(([status, buste]) => {
      if (buste.length > 0) {
        console.log(`📊 Colonna ${status}: ${buste.length} buste`, buste.map(b => b.readable_id || b.id));
      }
    });

    return groups;
  }, [currentBuste, lastSync, sortBusteByPriorityAndDate]);

  // Helper function to sort buste by cognome (for drawer)
  const sortBusteByCognome = useCallback((busteList: BustaWithCliente[]) => {
    return [...busteList].sort((a, b) => {
      const lastA = (a.clienti?.cognome || '').trim();
      const lastB = (b.clienti?.cognome || '').trim();

      if (lastA && !lastB) return -1;
      if (!lastA && lastB) return 1;
      if (lastA || lastB) {
        const compareLast = lastA.localeCompare(lastB, 'it', { sensitivity: 'base' });
        if (compareLast !== 0) return compareLast;
      }

      const firstA = (a.clienti?.nome || '').trim();
      const firstB = (b.clienti?.nome || '').trim();

      if (firstA && !firstB) return -1;
      if (!firstA && firstB) return 1;
      if (firstA || firstB) {
        const compareFirst = firstA.localeCompare(firstB, 'it', { sensitivity: 'base' });
        if (compareFirst !== 0) return compareFirst;
      }

      const readableA = (a.readable_id || a.id || '').toString();
      const readableB = (b.readable_id || b.id || '').toString();
      return readableA.localeCompare(readableB, 'it', { sensitivity: 'base', numeric: true });
    });
  }, []);

  // For drawer: sorted alphabetically by cognome
  const orderedNuoveBuste = useMemo(() => {
    const list = groupedBuste['nuove'] ? [...groupedBuste['nuove']] : [];
    return sortBusteByCognome(list);
  }, [groupedBuste, sortBusteByCognome]);

  const orderedMatOrdinatiBuste = useMemo(() => {
    const list = groupedBuste['materiali_ordinati'] ? [...groupedBuste['materiali_ordinati']] : [];
    return sortBusteByCognome(list);
  }, [groupedBuste, sortBusteByCognome]);

  const orderedMatArrivatiBuste = useMemo(() => {
    const list = groupedBuste['materiali_arrivati'] ? [...groupedBuste['materiali_arrivati']] : [];
    return sortBusteByCognome(list);
  }, [groupedBuste, sortBusteByCognome]);

  const orderedLavorazioneBuste = useMemo(() => {
    const list = groupedBuste['in_lavorazione'] ? [...groupedBuste['in_lavorazione']] : [];
    return sortBusteByCognome(list);
  }, [groupedBuste, sortBusteByCognome]);

  const orderedProntoRitiroBuste = useMemo(() => {
    const list = groupedBuste['pronto_ritiro'] ? [...groupedBuste['pronto_ritiro']] : [];
    return sortBusteByCognome(list);
  }, [groupedBuste, sortBusteByCognome]);

  const handleStatusHeaderClick = useCallback((status: WorkflowState) => {
    setOpenStatusList(prev => (prev === status ? null : status));
  }, []);

  const handleCloseStatusList = useCallback(() => {
    setOpenStatusList(null);
  }, []);

  // ✅ DATABASE UPDATE
  const updateBustaStatus = useCallback(async (
    bustaId: string, 
    newStatus: WorkflowState,
    oldStatus: WorkflowState,
    tipoLavorazione: string | null
  ): Promise<UpdateStatusResult> => {
    if (!isOnline) {
      toast.error('Impossibile aggiornare - Modalità offline');
      return {
        ok: false,
        code: 'CLIENT_OFFLINE',
        message: 'Impossibile aggiornare - Modalità offline'
      };
    }

    try {
      if (isAdminOnlyTransition(oldStatus, newStatus) && !isAdmin) {
        toast.error('Solo admin può eseguire questo movimento');
        return {
          ok: false,
          code: 'CLIENT_ADMIN_ONLY_BLOCK',
          message: 'Solo admin può eseguire questo movimento'
        };
      }

      // ✅ VALIDAZIONE BUSINESS RULES
      const allowed = isTransitionAllowed(oldStatus, newStatus, tipoLavorazione);
      if (!allowed) {
        const reason = getTransitionReason(oldStatus, newStatus, tipoLavorazione);
        toast.error(`Movimento non permesso: ${reason}`);
        return {
          ok: false,
          code: 'CLIENT_TRANSITION_NOT_ALLOWED',
          message: reason
        };
      }

      const response = await fetch('/api/buste/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bustaId,
          newStatus,
          oldStatus,
          tipoLavorazione: tipoLavorazione ?? null
        })
      })

      const payload = await response.json().catch(() => ({}))

      if (response.status === 401) {
        toast.error('Sessione scaduta - Effettua nuovamente il login')
        return {
          ok: false,
          code: 'HTTP_401',
          httpStatus: 401,
          message: 'Sessione scaduta'
        }
      }

      if (response.status === 409) {
        toast.error('Questa busta è già stata aggiornata da un altro operatore')
        return {
          ok: false,
          code: 'HTTP_409',
          httpStatus: 409,
          message: payload?.error || 'Conflict stato busta'
        }
      }

      if (response.status === 403) {
        toast.error(payload?.error || 'Permessi insufficienti per il movimento')
        return {
          ok: false,
          code: 'HTTP_403',
          httpStatus: 403,
          message: payload?.error || 'Permessi insufficienti'
        }
      }

      if (!response.ok || !payload.success) {
        const message = payload?.error || 'Errore durante l\'aggiornamento'
        console.error('❌ Kanban API error:', payload)
        toast.error(message)
        return {
          ok: false,
          code: `HTTP_${response.status || 0}`,
          httpStatus: response.status,
          message
        }
      }

      if (payload.historyWarning) {
        toast.warning('Busta aggiornata, ma lo storico non è stato salvato')
      }

      toast.success('Busta aggiornata con successo')
      return { ok: true }
    } catch (error) {
      console.error('❌ Error in updateBustaStatus:', error);
      toast.error('Errore durante l\'aggiornamento');
      return {
        ok: false,
        code: 'CLIENT_NETWORK_EXCEPTION',
        message: error instanceof Error ? error.message : 'Errore di rete'
      };
    }
  }, [isAdmin, isOnline]);

  // ✅ GESTIONI DRAG
  const handleDragStart = useCallback((event: DragStartEvent) => {
    console.log('🎯 DRAG START:', event.active.id);
    setActiveId(event.active.id as string);
    
    // ✅ FIX: Estrai l'ID reale della busta
    const realBustaId = (event.active.id as string).replace('busta-', '');
    const bustaToDrag = currentBuste?.find(b => b.id === realBustaId);
    
    if (bustaToDrag) {
      const clienteNome = bustaToDrag.clienti 
        ? `${bustaToDrag.clienti.cognome} ${bustaToDrag.clienti.nome}` 
        : 'Cliente non specificato';
      
      setDragFeedback({
        show: true,
        allowed: false,
        message: `📋 ${bustaToDrag.readable_id} - ${clienteNome}`,
        businessRule: bustaToDrag.tipo_lavorazione || 'Tipo da specificare',
        permissionHint: undefined
      });
    }
  }, [currentBuste]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setOverId(null);
      setDragFeedback(prev => ({
        ...prev,
        allowed: false,
        message: 'Rilascia qui per annullare'
      }));
      return;
    }

    const overId = over.id as string;
    setOverId(overId);
    console.log('🎯 DRAG OVER:', { activeId: active.id, overId });

    // ✅ FIX: Estrai il nome della colonna dal prefisso
    let newStatus = overId;
    if (overId.startsWith('column-')) {
      newStatus = overId.replace('column-', '');
    }

    // Verifica che sia una colonna valida
    if (!columns.includes(newStatus as any)) {
      console.log('❌ DRAG OVER: Invalid column', { overId, newStatus, validColumns: columns });
      return;
    }

    // ✅ FIX: Estrai l'ID reale della busta
    const realBustaId = (active.id as string).replace('busta-', '');
    const bustaToDrag = currentBuste?.find(b => b.id === realBustaId);
    if (!bustaToDrag) return;

    const oldStatus = bustaToDrag.stato_attuale as WorkflowState;
    
    // Verifica transizione workflow
    const adminRequired = isAdminOnlyTransition(oldStatus, newStatus as WorkflowState);
    const workflowAllowed = isTransitionAllowed(oldStatus, newStatus as WorkflowState, bustaToDrag.tipo_lavorazione);
    const reason = getTransitionReason(oldStatus, newStatus as WorkflowState, bustaToDrag.tipo_lavorazione);
    const canMove = workflowAllowed && (!adminRequired || isAdmin);
    
    setDragFeedback(prev => ({
      ...prev,
      allowed: canMove,
      message: adminRequired && !isAdmin ? '❌ Solo admin può eseguire questo movimento' : (workflowAllowed ? `✅ ${reason}` : `❌ ${reason}`),
      permissionHint: adminRequired && !isAdmin ? 'Richiede ruolo admin' : undefined
    }));
  }, [currentBuste, isAdmin]);

  // ✅ DRAG END CORRETTO - FIX PER UUID CONFLICTS
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    console.log('🎯 DRAG END STARTED', { activeId, overId });
    
    setActiveId(null);
    setOverId(null);
    setDragFeedback({ show: false, allowed: false, message: '' });

    const { active, over } = event;
    if (!over || !currentBuste) {
      console.log('❌ DRAG END: Missing over or currentBuste');
      return;
    }

    // ✅ FIX: Estrai ID reali
    const fullActiveId = active.id as string;
    const bustaId = fullActiveId.replace('busta-', ''); // Rimuovi prefisso busta-
    let newStatus = over.id as string;

    // ✅ FIX CRITICO: ACCETTA SOLO COLONNE
    if (!newStatus.startsWith('column-')) {
      console.log('❌ DRAG END: Not dropping on column, ignoring', { 
        originalOverId: over.id, 
        newStatus 
      });
      logKanbanDiagnostic('DRAG_DROP_NON_COLUMN_TARGET', {
        severity: 'warn',
        message: 'Drop target non valido',
        context: {
          original_over_id: over.id,
          new_status_raw: newStatus,
          active_id: active.id,
        },
      });
      return;
    }
    
    // ✅ Ora rimuovi il prefisso
    newStatus = newStatus.replace('column-', '');

    console.log('🎯 DRAG END: IDs extracted', { 
      fullActiveId, 
      bustaId, 
      newStatus, 
      originalOverId: over.id 
    });

    // Validazione colonna
    if (!columns.includes(newStatus as any)) {
      console.log('❌ DRAG END: Invalid column', { newStatus, validColumns: columns });
      toast.error('Colonna non valida');
      logKanbanDiagnostic('DRAG_DROP_INVALID_COLUMN', {
        severity: 'warn',
        message: 'Colonna non valida',
        newStatus,
        context: {
          active_id: active.id,
          valid_columns: columns,
        },
      });
      return;
    }

    const bustaDaAggiornare = currentBuste.find(b => b.id === bustaId);
    if (!bustaDaAggiornare) {
      console.log('❌ DRAG END: Busta not found');
      toast.error('Busta non trovata');
      logKanbanDiagnostic('DRAG_BUSTA_NOT_FOUND', {
        severity: 'error',
        message: 'Busta non trovata nel dataset client',
        context: {
          busta_id: bustaId,
          active_id: active.id,
        },
      });
      return;
    }

    const oldStatus = bustaDaAggiornare.stato_attuale as WorkflowState;
    console.log('🎯 DRAG END: Status transition', { 
      bustaId: bustaDaAggiornare.readable_id, 
      oldStatus, 
      newStatus 
    });

    // Se è la stessa colonna, non fare nulla
    if (oldStatus === newStatus) {
      console.log('ℹ️ DRAG END: Same column, skipping');
      return;
    }

    // ✅ VALIDAZIONE BUSINESS RULES PRE-UPDATE
    const adminRequired = isAdminOnlyTransition(oldStatus, newStatus as WorkflowState);
    if (adminRequired && !isAdmin) {
      toast.error('❌ Solo admin può eseguire questo movimento', { duration: 4000 });
      logKanbanDiagnostic('CLIENT_ADMIN_ONLY_BLOCK', {
        severity: 'info',
        message: 'Movimento bloccato: transizione solo admin',
        busta: bustaDaAggiornare,
        oldStatus,
        newStatus,
      });
      return;
    }

    const allowed = isTransitionAllowed(oldStatus, newStatus as WorkflowState, bustaDaAggiornare.tipo_lavorazione);
    
    if (!allowed) {
      const reason = getTransitionReason(oldStatus, newStatus as WorkflowState, bustaDaAggiornare.tipo_lavorazione);
      console.log('❌ DRAG END: Business rule violation', { reason });
      toast.error(`❌ Movimento non permesso: ${reason}`, { duration: 4000 });
      logKanbanDiagnostic('CLIENT_TRANSITION_NOT_ALLOWED', {
        severity: 'info',
        message: reason,
        busta: bustaDaAggiornare,
        oldStatus,
        newStatus,
      });
      return;
    }

    try {
      setIsUpdating(true);
      
      const result = await updateBustaStatus(
        bustaId, 
        newStatus as WorkflowState, 
        oldStatus, 
        bustaDaAggiornare.tipo_lavorazione
      );
      
      if (result.ok) {
        // ✅ SWR: Optimistic update + revalidation
        await mutate('/api/buste', 
          currentBuste.map(b => 
            b.id === bustaId 
              ? { ...b, stato_attuale: newStatus as any, updated_at: new Date().toISOString() }
              : b
          ),
          false // Don't revalidate immediately
        );
        
        // ✅ Refresh dati dal server dopo un breve delay
        setTimeout(() => revalidate(), 500);
      } else {
        logKanbanDiagnostic(result.code, {
          severity: result.httpStatus && result.httpStatus >= 500 ? 'error' : 'warn',
          message: result.message,
          busta: bustaDaAggiornare,
          oldStatus,
          newStatus,
          httpStatus: result.httpStatus,
        });
      }
      
    } catch (error: any) {
      console.error('❌ DRAG END: Error', error);
      toast.error(`Errore: ${error.message}`);
      logKanbanDiagnostic('DRAG_END_EXCEPTION', {
        severity: 'error',
        message: error?.message || 'Eccezione in handleDragEnd',
        busta: bustaDaAggiornare,
        oldStatus,
        newStatus,
      });
    } finally {
      setIsUpdating(false);
    }
  }, [currentBuste, isAdmin, logKanbanDiagnostic, revalidate, updateBustaStatus]);

  // Trova la busta attiva per la drag overlay
  const activeBusta = activeId && currentBuste ? currentBuste.find(b => `busta-${b.id}` === activeId) : null;

  return (
    <div className="h-full overflow-x-auto relative">
      {/* Removed overlapping status bar - functionality moved to main actions */}

      {/* Loading indicator */}
      {isLoading && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white border rounded-lg shadow-lg px-4 py-2 flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="text-sm font-medium text-gray-700">Sincronizzazione...</span>
        </div>
      )}

      {/* Feedback drag & drop */}
      {dragFeedback.show && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-white border rounded-lg shadow-lg px-4 py-3 max-w-md">
          <div className="flex items-center space-x-2 mb-1">
            {dragFeedback.allowed ? (
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            )}
            <span className={`text-sm font-medium ${
              dragFeedback.allowed ? 'text-green-700' : 'text-red-700'
            }`}>
              {dragFeedback.message}
            </span>
          </div>
          {dragFeedback.businessRule && (
            <div className="text-xs text-gray-600 ml-7">
              {dragFeedback.businessRule}
            </div>
          )}
          {dragFeedback.permissionHint && (
            <div className="text-xs text-amber-700 ml-7">
              {dragFeedback.permissionHint}
            </div>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex w-full justify-start items-start gap-4 min-w-max h-full pb-6">
          {columns.map(status => {
            // Only enable drawer for states except consegnato_pagato
            const enableDrawer = status !== 'consegnato_pagato';
            return (
              <DroppableColumn
                key={status}
                status={status}
                buste={groupedBuste[status] || []}
                suspendedCount={suspendedCount}
                isOver={overId === `column-${status}`}
                isDragEnabled={!isLoading && isOnline && profile?.role !== 'operatore'}
                isLoading={isLoading}
                onHeaderClick={enableDrawer ? () => handleStatusHeaderClick(status) : undefined}
                isHeaderActive={openStatusList === status}
                expandedCardId={expandedCardId}
                onToggleExpand={handleToggleExpand}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeBusta ? (
            <div className="rotate-2 scale-105 shadow-2xl opacity-90">
              <BustaCard busta={activeBusta} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {openStatusList && (
        <StatusDrawer
          status={openStatusList}
          buste={
            openStatusList === 'nuove' ? orderedNuoveBuste :
            openStatusList === 'materiali_ordinati' ? orderedMatOrdinatiBuste :
            openStatusList === 'materiali_arrivati' ? orderedMatArrivatiBuste :
            openStatusList === 'in_lavorazione' ? orderedLavorazioneBuste :
            openStatusList === 'pronto_ritiro' ? orderedProntoRitiroBuste :
            []
          }
          onClose={handleCloseStatusList}
        />
      )}
    </div>
  );
}

function StatusDrawer({
  status,
  buste,
  onClose,
}: {
  status: WorkflowState;
  buste: BustaWithCliente[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, onClose]);

  const sortByCognomeNome = useCallback((a: BustaWithCliente, b: BustaWithCliente) => {
    const lastA = (a.clienti?.cognome || '').trim();
    const lastB = (b.clienti?.cognome || '').trim();

    if (lastA && !lastB) return -1;
    if (!lastA && lastB) return 1;
    if (lastA || lastB) {
      const compareLast = lastA.localeCompare(lastB, 'it', { sensitivity: 'base' });
      if (compareLast !== 0) return compareLast;
    }

    const firstA = (a.clienti?.nome || '').trim();
    const firstB = (b.clienti?.nome || '').trim();

    if (firstA && !firstB) return -1;
    if (!firstA && firstB) return 1;
    if (firstA || firstB) {
      const compareFirst = firstA.localeCompare(firstB, 'it', { sensitivity: 'base' });
      if (compareFirst !== 0) return compareFirst;
    }

    const readableA = (a.readable_id || a.id || '').toString();
    const readableB = (b.readable_id || b.id || '').toString();
    return readableA.localeCompare(readableB, 'it', { sensitivity: 'base', numeric: true });
  }, []);

  const orderedBuste = useMemo(() => {
    return [...buste].sort(sortByCognomeNome);
  }, [buste, sortByCognomeNome]);

  const getOpenActionCount = useCallback((busta: BustaWithCliente) => {
    return (busta.ordini_materiali || []).filter(
      ordine => ordine.needs_action && !ordine.needs_action_done
    ).length;
  }, []);

  const groupedSpecial = useMemo(() => {
    const daChiamare = orderedBuste.filter(
      busta => busta.richiede_telefonata && !busta.telefonata_completata
    );
    const azioneDaCompiere = orderedBuste.filter(
      busta => getOpenActionCount(busta) > 0
    );

    return {
      da_chiamare: daChiamare,
      azione_da_compiere: azioneDaCompiere
    };
  }, [orderedBuste, getOpenActionCount]);

  // Group buste by priority
  const groupedByPriority = useMemo(() => {
    const groups = {
      sospese: [] as BustaWithCliente[],
      critica: [] as BustaWithCliente[],
      urgente: [] as BustaWithCliente[],
      in_ritardo: [] as BustaWithCliente[],
      normale: [] as BustaWithCliente[]
    };

    orderedBuste.forEach(busta => {
      if (status === 'nuove' && busta.is_suspended) {
        groups.sospese.push(busta);
        return;
      }
      if (busta.priorita === 'critica') {
        groups.critica.push(busta);
      } else if (busta.priorita === 'urgente') {
        groups.urgente.push(busta);
      } else {
        // Check for delayed orders (only for materiali_ordinati state)
        const hasDelays = status === 'materiali_ordinati' &&
          (busta.ordini_materiali || []).some(ordine => ordine.stato === 'in_ritardo');

        if (hasDelays) {
          groups.in_ritardo.push(busta);
        } else {
          groups.normale.push(busta);
        }
      }
    });

    return groups;
  }, [orderedBuste, status]);

  // Auto-collapse NORMALI if more than 20
  useEffect(() => {
    if (groupedByPriority.normale.length > 20) {
      setCollapsedGroups(prev => new Set(prev).add('normale'));
    }
  }, [groupedByPriority.normale.length]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  if (!mounted) {
    return null;
  }

  const listTitle = getColumnName(status);

  const priorityLabels = {
    sospese: { label: 'SOSPESE', className: 'text-yellow-800 bg-yellow-50/80 border-yellow-200' },
    critica: { label: 'CRITICA', className: 'text-red-700 bg-red-50/80 border-red-200' },
    urgente: { label: 'URGENTE', className: 'text-orange-600 bg-orange-50/80 border-orange-200' },
    in_ritardo: { label: 'IN RITARDO', className: 'text-amber-600 bg-amber-50/80 border-amber-200' },
    normale: { label: 'NORMALE', className: 'text-slate-600 bg-slate-50/80 border-slate-200' }
  };

  const priorityOrder = status === 'nuove'
    ? (['sospese', 'critica', 'urgente', 'in_ritardo', 'normale'] as const)
    : (['critica', 'urgente', 'in_ritardo', 'normale'] as const);

  const specialLabels = {
    da_chiamare: {
      label: 'CHIAMARE IL CLIENTE',
      className: 'text-red-700 bg-red-50/80 border-red-200'
    },
    azione_da_compiere: {
      label: 'AZIONE DA COMPIERE',
      className: 'text-amber-700 bg-amber-50/80 border-amber-200'
    }
  };

  const specialOrder = ['da_chiamare', 'azione_da_compiere'] as const;

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{listTitle}</h2>
            <p className="text-xs text-gray-500 mt-1">Elenco buste ordinate per cognome</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Chiudi elenco buste nuove"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {buste.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-gray-500">
              <Info className="mb-2 h-5 w-5 text-gray-400" />
              Nessuna busta in questo stato
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {specialOrder.map(specialKey => {
                const groupBuste = groupedSpecial[specialKey];
                if (groupBuste.length === 0) return null;

                const collapseKey = `special-${specialKey}`;
                const isCollapsed = collapsedGroups.has(collapseKey);
                const { label, className } = specialLabels[specialKey];

                return (
                  <div key={specialKey}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(collapseKey)}
                      className={`w-full flex items-center justify-between px-5 py-3 border-b transition-colors hover:brightness-95 ${className}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold tracking-[0.18em]">{label}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/70 border border-white/60">
                          {groupBuste.length}
                        </span>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    </button>

                    {!isCollapsed && (
                      <ul className="divide-y divide-gray-100">
                        {groupBuste.map((busta) => {
                          const readableId = busta.readable_id || busta.id;
                          const cognome = (busta.clienti?.cognome || '').trim();
                          const nome = (busta.clienti?.nome || '').trim();
                          const displayName = [cognome, nome].filter(Boolean).join(' ') || 'Cliente non specificato';
                          const openActionCount = getOpenActionCount(busta);

                          return (
                            <li key={`special-${specialKey}-${busta.id}`}>
                              <Link
                                href={`/dashboard/buste/${busta.id}`}
                                className="group flex items-center justify-between px-5 py-3 transition-colors hover:bg-blue-50"
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-gray-500">{readableId}</span>
                                  <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
                                    {displayName}
                                  </span>
                                  {specialKey === 'da_chiamare' && (
                                    <span className="text-[11px] text-red-700 mt-0.5">
                                      {busta.telefonata_assegnata_a
                                        ? `Assegnata a: ${busta.telefonata_assegnata_a}`
                                        : 'Assegnazione non indicata'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {specialKey === 'da_chiamare' ? (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-200">
                                      Telefono rosso
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-200">
                                      Azione !{openActionCount}
                                    </span>
                                  )}
                                  <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700">
                                    Apri
                                  </span>
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}

              {priorityOrder.map(priorityKey => {
                const groupBuste = groupedByPriority[priorityKey];
                if (groupBuste.length === 0) return null;

                const isCollapsed = collapsedGroups.has(priorityKey);
                const { label, className } = priorityLabels[priorityKey];

                return (
                  <div key={priorityKey}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(priorityKey)}
                      className={`w-full flex items-center justify-between px-5 py-3 border-b transition-colors hover:brightness-95 ${className}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold tracking-[0.18em]">{label}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/70 border border-white/60">
                          {groupBuste.length}
                        </span>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    </button>

                    {!isCollapsed && (
                      <ul className="divide-y divide-gray-100">
                        {groupBuste.map((busta) => {
                          const readableId = busta.readable_id || busta.id;
                          const cognome = (busta.clienti?.cognome || '').trim();
                          const nome = (busta.clienti?.nome || '').trim();
                          const displayName = [cognome, nome].filter(Boolean).join(' ') || 'Cliente non specificato';

                          return (
                            <li key={busta.id}>
                              <Link
                                href={`/dashboard/buste/${busta.id}`}
                                className="group flex items-center justify-between px-5 py-3 transition-colors hover:bg-blue-50"
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-gray-500">{readableId}</span>
                                  <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
                                    {displayName}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700">
                                  Apri
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
