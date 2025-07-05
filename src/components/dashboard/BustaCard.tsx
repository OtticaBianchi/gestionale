import { Database } from '@/types/database.types'

// Definiamo i tipi
type BustaWithCliente = Database['public']['Tables']['buste']['Row'] & {
  clienti: Pick<Database['public']['Tables']['clienti']['Row'], 'nome' | 'cognome'> | null;
}

// Definiamo le props
interface BustaCardProps {
  busta: BustaWithCliente
}

export function BustaCard({ busta }: BustaCardProps) {
  // Funzione helper per calcolare i giorni passati
  const giorniTrascorsi = Math.floor(
    (new Date().getTime() - new Date(busta.data_apertura).getTime()) / (1000 * 3600 * 24)
  )

  return (
    <div className="bg-white rounded-md shadow-sm border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-medium text-gray-800">
          {busta.readable_id} - {busta.clienti?.nome} {busta.clienti?.cognome}
        </span>
        {/* Placeholder per le icone di stato/urgenza */}
        {busta.priorita === 'urgente' && <span className="text-red-500 text-xs font-bold">URGENTE</span>}
      </div>

      <p className="text-xs text-gray-500 mb-2">
        Lavorazione: <span className="font-semibold">{busta.tipo_lavorazione}</span>
      </p>

      <div className="flex justify-between items-center text-xs text-gray-400">
        <span>Aperta da {giorniTrascorsi} giorni</span>
        {/* Placeholder per l'avatar dell'operatore */}
      </div>
    </div>
  )
}