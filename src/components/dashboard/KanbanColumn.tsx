import { Database } from '@/types/database.types'
// Creeremo BustaCard tra un attimo
import { BustaCard } from './BustaCard'

// Definiamo i tipi
type BustaWithCliente = Database['public']['Tables']['buste']['Row'] & {
  clienti: Pick<Database['public']['Tables']['clienti']['Row'], 'nome' | 'cognome'> | null;
}

// Definiamo le props
interface KanbanColumnProps {
  title: string
  buste: BustaWithCliente[]
}

export function KanbanColumn({ title, buste }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-72 md:w-80 bg-gray-100 rounded-lg shadow-sm flex-shrink-0">
      {/* Header della colonna */}
      <div className="p-3 border-b border-gray-200 sticky top-0 bg-gray-100 rounded-t-lg z-10">
        <h2 className="text-md font-semibold text-gray-700 flex items-center justify-between">
          <span>{title}</span>
          <span className="text-sm font-normal bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">
            {buste.length}
          </span>
        </h2>
      </div>

      {/* Corpo della colonna con le card */}
      <div className="flex-1 p-2 overflow-y-auto space-y-2">
        {buste.map(busta => (
          <BustaCard key={busta.id} busta={busta} />
        ))}
        
        {/* Messaggio se la colonna è vuota */}
        {buste.length === 0 && (
          <div className="text-center text-sm text-gray-400 p-4">
            Nessuna busta in questo stato.
          </div>
        )}
      </div>
    </div>
  )
}