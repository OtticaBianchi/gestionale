-- Allow negozio orders to omit scheduling dates
ALTER TABLE ordini_materiali
  ALTER COLUMN data_ordine DROP NOT NULL,
  ALTER COLUMN data_consegna_prevista DROP NOT NULL;
