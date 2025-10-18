# Simplified Delivery Tracking - Requirements

## What we need:

### 1. Three delivery method buttons:
- Ritiro in Negozio
- Consegna a Domicilio
- Spedizione

### 2. When user clicks a button:
- Open modal with date picker
- Date defaults to today
- User can select any date (past or present, not future)
- User clicks Conferma

### 3. On Conferma:
- Save to database:
  - `metodo_consegna` = selected method
  - `stato_consegna` = 'in_attesa'
  - `data_selezione_consegna` = selected date
  - `data_completamento_consegna` = null
- Close modal
- Refresh page data

### 4. Status update buttons (when method is selected):
- For "Ritiro in Negozio" → Show "Segna come Ritirato" button
- For "Consegna a Domicilio" → Show "Segna come Consegnato" button
- For "Spedizione" → Show "Segna come Spedito" AND "Segna come Arrivato" buttons

### 5. When user clicks status button:
- Update database:
  - `stato_consegna` = clicked status (ritirato/consegnato/spedito/arrivato)
  - `data_completamento_consegna` = now (if ritirato/consegnato/arrivato)
  - `stato_attuale` = 'consegnato_pagato' (if ritirato/consegnato/arrivato)
- Refresh page data

### 6. Warning logic:
- Show warning if:
  - `metodo_consegna` is 'consegna_domicilio' OR 'spedizione'
  - AND `stato_consegna` = 'in_attesa'
  - AND days since `data_selezione_consegna` >= 2

## THAT'S IT. Keep it simple.
