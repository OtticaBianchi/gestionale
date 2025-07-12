import { Database } from './database.types';

export type BustaWithCliente = Database['public']['Tables']['buste']['Row'] & {
  clienti: Pick<Database['public']['Tables']['clienti']['Row'], 'nome' | 'cognome' | 'telefono' | 'email' | 'data_nascita' | 'genere'> | null;
  ordini_materiali?: Pick<Database['public']['Tables']['ordini_materiali']['Row'], 'id' | 'descrizione_prodotto' | 'stato' | 'da_ordinare' | 'note'>[];
  rate_pagamenti?: Array<{
    id: string;
    numero_rata: number;
    data_scadenza: string;
    is_pagata: boolean | null;
    reminder_attivo: boolean | null;
  }>;
  info_pagamenti?: {
    is_saldato: boolean | null;
    modalita_saldo: string;
  } | null;
};

export type OrdineMaterialeEssenziale = Pick<Database['public']['Tables']['ordini_materiali']['Row'], 'id' | 'descrizione_prodotto' | 'stato' | 'note'>;

export type RataPagamentoEssenziale = {
  id: string;
  numero_rata: number;
  data_scadenza: string;
  is_pagata: boolean | null;
  reminder_attivo: boolean | null;
};