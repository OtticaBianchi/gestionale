export const DASHBOARD_BUSTE_SELECT = `
  id,
  readable_id,
  cliente_id,
  stato_attuale,
  priorita,
  tipo_lavorazione,
  data_apertura,
  updated_at,
  is_suspended,
  pinned_to_kanban,
  data_sospensione,
  data_riesame_sospensione,
  richiede_telefonata,
  telefonata_completata,
  telefonata_assegnata_a,
  metodo_consegna,
  stato_consegna,
  data_selezione_consegna,
  clienti:cliente_id (
    nome,
    cognome,
    telefono
  ),
  ordini_materiali (
    id,
    descrizione_prodotto,
    stato,
    stato_disponibilita,
    promemoria_disponibilita,
    da_ordinare,
    note,
    needs_action,
    needs_action_done,
    needs_action_type,
    deleted_at
  ),
  payment_plan:payment_plans (
    id,
    total_amount,
    acconto,
    payment_type,
    auto_reminders_enabled,
    reminder_preference,
    is_completed,
    created_at,
    updated_at,
    payment_installments (
      id,
      installment_number,
      due_date,
      paid_amount,
      is_completed,
      updated_at
    )
  ),
  info_pagamenti (
    is_saldato,
    modalita_saldo,
    note_pagamento,
    importo_acconto,
    prezzo_finale,
    data_saldo,
    updated_at
  )
`;
