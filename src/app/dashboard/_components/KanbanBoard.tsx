// app/dashboard/_components/KanbanBoard.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database.types';
import BustaCard from './BustaCard';
import { 
  isTransitionAllowed, 
  getTransitionReason, 
  WorkflowState,
  hasSpecialWorkflow 
} from './WorkflowLogic';
import { CheckCircle, XCircle, Info, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { BustaWithCliente } from '@/types/shared.types';
import { useBuste } from '@/hooks/useBuste';
import { mutate } from 'swr';
import { useUser } from '@/context/UserContext';

interface KanbanBoardProps {
  buste: BustaWithCliente[];
}

// Colonne Kanban in ordine
const columns: (Database['public']['Tables']['buste']['Row']['stato_attuale'])[] = [
  'nuove',
  'materiali_ordinati',
  'materiali_parzialmente_arrivati',
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
    'materiali_parzialmente_arrivati': 'Mat. Parziali',
    'materiali_arrivati': 'Mat. Arrivati',
    'in_lavorazione': 'In Lavorazione',
    'pronto_ritiro': 'Pronto Ritiro',
    'consegnato_pagato': 'Consegnato',
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
function DraggableBustaCard({ busta, isDragEnabled }: { busta: BustaWithCliente; isDragEnabled: boolean }) {
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
      <BustaCard busta={busta} />
    </div>
  );
}

// 🔧 FIX: Componente per le colonne droppabili - CORRETTO per evitare conflitti UUID
function DroppableColumn({ 
  status, 
  buste, 
  isOver,
  isDragEnabled,
  isLoading
}: { 
  status: WorkflowState; 
  buste: BustaWithCliente[]; 
  isOver: boolean;
  isDragEnabled: boolean;
  isLoading: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${status}`, // ✅ FIX CRITICO: Prefisso per evitare conflitti con UUID buste
  });

  return (
    <div className="flex-shrink-0 w-64">
      <div className="bg-gray-100 rounded-lg p-3 h-full flex flex-col">
        <div className="flex justify-between items-center mb-4 px-2">
          <h2 className="font-semibold text-gray-700 text-xs">{getColumnName(status)}</h2>
          <span className="bg-gray-300 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">
            {buste.length}
          </span>
        </div>
        
        <div
          ref={setNodeRef}
          className={`
            flex-grow overflow-y-auto space-y-2 p-2 rounded transition-all duration-200
            min-h-[400px] max-h-[calc(100vh-200px)]
            ${isOver 
              ? 'bg-blue-50 border-2 border-blue-300 border-dashed shadow-inner' 
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
                      <DraggableBustaCard key={busta.id} busta={busta} isDragEnabled={isDragEnabled} />
                    ))}
                  </SortableContext>
                ) : (
                  buste.map((busta) => (
                    <BustaCard key={busta.id} busta={busta} />
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
  
  // User context for role checking
  const { profile } = useUser();
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [dragFeedback, setDragFeedback] = useState<{
    show: boolean;
    allowed: boolean;
    message: string;
    businessRule?: string;
  }>({ show: false, allowed: false, message: '' });

  const supabase = createClient();
  
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

  // Raggruppa le buste per stato
  const groupedBuste = useMemo(() => {
    console.log('🔍 GROUPING BUSTE:', currentBuste.map(b => ({ id: b.readable_id || b.id, stato: b.stato_attuale })));
    
    const groups: { [key: string]: BustaWithCliente[] } = {};
    columns.forEach(col => groups[col] = []);
    
    currentBuste.forEach(busta => {
      if (groups[busta.stato_attuale]) {
        groups[busta.stato_attuale].push(busta);
      }
    });
    
    // Debug: mostra conteggi per colonna
    Object.entries(groups).forEach(([status, buste]) => {
      if (buste.length > 0) {
        console.log(`📊 Colonna ${status}: ${buste.length} buste`, buste.map(b => b.readable_id || b.id));
      }
    });
    
    return groups;
  }, [currentBuste, lastSync]);

  // ✅ DATABASE UPDATE
  const updateBustaStatus = useCallback(async (
    bustaId: string, 
    newStatus: WorkflowState,
    oldStatus: WorkflowState,
    tipoLavorazione: string | null
  ): Promise<boolean> => {
    if (!isOnline) {
      toast.error('Impossibile aggiornare - Modalità offline');
      return false;
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error('❌ Auth error:', authError);
        toast.error("Sessione scaduta - Effettua nuovamente il login");
        return false;
      }

      // ✅ VALIDAZIONE BUSINESS RULES
      const allowed = isTransitionAllowed(oldStatus, newStatus, tipoLavorazione);
      if (!allowed) {
        const reason = getTransitionReason(oldStatus, newStatus, tipoLavorazione);
        toast.error(`Movimento non permesso: ${reason}`);
        return false;
      }

      // ✅ UPDATE DATABASE
      const updateResult = await supabase
        .from('buste')
        .update({ 
          stato_attuale: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bustaId)
        .select('id, stato_attuale, updated_at');

      if (updateResult.error) {
        console.error('❌ Error updating busta:', updateResult.error);
        toast.error(`Errore database: ${updateResult.error.message}`);
        return false;
      }

      if (!updateResult.data || updateResult.data.length === 0) {
        console.error('❌ No data returned - possible RLS issue');
        toast.error('Errore: aggiornamento bloccato (permissions?)');
        return false;
      }

      // Aggiungi record allo status_history
      const { error: historyError } = await supabase
        .from('status_history')
        .insert({
          busta_id: bustaId,
          stato: newStatus,
          data_ingresso: new Date().toISOString(),
          operatore_id: user.id,
          note_stato: getTransitionReason(oldStatus, newStatus, tipoLavorazione)
        });

      if (historyError) {
        console.error('❌ Error saving history:', historyError);
        toast.warning('Busta aggiornata, ma errore nel salvataggio storico');
      }

      toast.success('Busta aggiornata con successo');
      return true;
    } catch (error) {
      console.error('❌ Error in updateBustaStatus:', error);
      toast.error('Errore durante l\'aggiornamento');
      return false;
    }
  }, [supabase, isOnline]);

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
        businessRule: bustaToDrag.tipo_lavorazione || 'Tipo da specificare'
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
    const workflowAllowed = isTransitionAllowed(oldStatus, newStatus as WorkflowState, bustaToDrag.tipo_lavorazione);
    const reason = getTransitionReason(oldStatus, newStatus as WorkflowState, bustaToDrag.tipo_lavorazione);
    
    setDragFeedback(prev => ({
      ...prev,
      allowed: workflowAllowed,
      message: workflowAllowed ? `✅ ${reason}` : `❌ ${reason}`,
    }));
  }, [currentBuste]);

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
      return;
    }

    const bustaDaAggiornare = currentBuste.find(b => b.id === bustaId);
    if (!bustaDaAggiornare) {
      console.log('❌ DRAG END: Busta not found');
      toast.error('Busta non trovata');
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
    const allowed = isTransitionAllowed(oldStatus, newStatus as WorkflowState, bustaDaAggiornare.tipo_lavorazione);
    
    if (!allowed) {
      const reason = getTransitionReason(oldStatus, newStatus as WorkflowState, bustaDaAggiornare.tipo_lavorazione);
      console.log('❌ DRAG END: Business rule violation', { reason });
      toast.error(`❌ Movimento non permesso: ${reason}`, { duration: 4000 });
      return;
    }

    try {
      setIsUpdating(true);
      
      const success = await updateBustaStatus(
        bustaId, 
        newStatus as WorkflowState, 
        oldStatus, 
        bustaDaAggiornare.tipo_lavorazione
      );
      
      if (success) {
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
      }
      
    } catch (error: any) {
      console.error('❌ DRAG END: Error', error);
      toast.error(`Errore: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  }, [currentBuste, updateBustaStatus, revalidate]);

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
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 min-w-max h-full pb-6">
          {columns.map(status => (
            <DroppableColumn
              key={status}
              status={status}
              buste={groupedBuste[status] || []}
              isOver={overId === `column-${status}`}
              isDragEnabled={!isLoading && isOnline && profile?.role !== 'operatore'}
              isLoading={isLoading}
            />
          ))}
        </div>

        <DragOverlay>
          {activeBusta ? (
            <div className="rotate-2 scale-105 shadow-2xl opacity-90">
              <BustaCard busta={activeBusta} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}