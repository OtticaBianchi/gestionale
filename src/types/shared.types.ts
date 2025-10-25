import { Database } from './database.types';

export type BustaWithCliente = Database['public']['Tables']['buste']['Row'] & {
  clienti: Pick<Database['public']['Tables']['clienti']['Row'], 'nome' | 'cognome' | 'telefono' | 'email' | 'data_nascita' | 'genere'> | null;
  ordini_materiali?: Pick<Database['public']['Tables']['ordini_materiali']['Row'], 'id' | 'descrizione_prodotto' | 'stato' | 'stato_disponibilita' | 'promemoria_disponibilita' | 'da_ordinare' | 'note'>[];
  info_pagamenti?: {
    is_saldato: boolean | null;
    modalita_saldo: string;
    note_pagamento?: string | null;
    importo_acconto?: number | null;
    ha_acconto?: boolean | null;
    prezzo_finale?: number | null;
  } | null;
  payment_plan?: {
    id: string;
    total_amount: number | null;
    acconto: number | null;
    payment_type: string;
    auto_reminders_enabled: boolean | null;
    reminder_preference: string | null;
    is_completed: boolean;
    payment_installments?: Array<{
      id: string;
      installment_number: number;
      due_date: string;
      expected_amount: number | null;
      paid_amount: number | null;
      is_completed: boolean;
      reminder_3_days_sent: boolean;
      reminder_10_days_sent: boolean;
    }>;
  } | null;
};

export type OrdineMaterialeEssenziale = Pick<Database['public']['Tables']['ordini_materiali']['Row'], 'id' | 'descrizione_prodotto' | 'stato' | 'stato_disponibilita' | 'promemoria_disponibilita' | 'note'>;
