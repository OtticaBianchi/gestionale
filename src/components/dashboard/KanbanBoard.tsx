"use client"

import { useMemo } from 'react'
import { Database } from '@/types/database.types'
// Importiamo i componenti che creeremo tra poco
import { KanbanColumn } from './KanbanColumn' 

// Definiamo i nostri tipi
type BustaWithCliente = Database['public']['Tables']['buste']['Row'] & {
  clienti: Pick<Database['public']['Tables']['clienti']['Row'], 'nome' | 'cognome'> | null;
}
type JobStatus = Database['public']['Enums']['job_status']

// Definiamo le props
interface KanbanBoardProps {
  initialBuste: BustaWithCliente[];
}

// Definiamo l'ordine e i titoli delle colonne (6 stati)
const STATUS_COLUMNS: { status: JobStatus; title: string }[] = [
  { status: 'nuove', title: 'Nuove' },
  { status: 'materiali_ordinati', title: 'Materiali Ordinati' },
  { status: 'materiali_arrivati', title: 'Materiali Arrivati' },
  { status: 'in_lavorazione', title: 'In Lavorazione' },
  { status: 'pronto_ritiro', title: 'Pronto per Ritiro' },
  { status: 'consegnato_pagato', title: 'Consegnato/Pagato' },
]

export function KanbanBoard({ initialBuste }: KanbanBoardProps) {
  // Usiamo useMemo per raggruppare le buste per stato.
  // Questo calcolo viene fatto solo quando 'initialBuste' cambia.
  const groupedBuste = useMemo(() => {
    const groups: Record<JobStatus, BustaWithCliente[]> = {
      nuove: [],
      materiali_ordinati: [],
      materiali_arrivati: [],
      in_lavorazione: [],
      pronto_ritiro: [],
      consegnato_pagato: [],
    }
    
    initialBuste.forEach(busta => {
      // Usiamo un controllo per assicurarci che lo stato sia valido
      if (busta.stato_attuale && groups[busta.stato_attuale]) {
        groups[busta.stato_attuale].push(busta)
      }
    })
    
    return groups
  }, [initialBuste])

  return (
    <div className="flex gap-4 p-1 h-full">
      {/* Mappiamo l'array delle colonne per renderizzarle */}
      {STATUS_COLUMNS.map(({ status, title }) => (
        <KanbanColumn
          key={status}
          title={title}
          buste={groupedBuste[status]} // Passiamo l'array di buste per questa colonna
        />
      ))}
    </div>
  )
}