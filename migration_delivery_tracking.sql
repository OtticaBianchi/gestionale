-- Migration: Add delivery tracking fields to buste table
-- Date: 2025-01-18
-- Description: Adds metodo_consegna, stato_consegna, and related timestamp fields for tracking pickup/delivery/shipping

-- Step 1: Create ENUM types for delivery tracking
CREATE TYPE metodo_consegna_enum AS ENUM ('da_ritirare', 'consegna_domicilio', 'spedizione');
CREATE TYPE stato_consegna_enum AS ENUM ('in_attesa', 'ritirato', 'consegnato', 'spedito', 'arrivato');

-- Step 2: Add new columns to buste table
ALTER TABLE buste
ADD COLUMN metodo_consegna metodo_consegna_enum,
ADD COLUMN stato_consegna stato_consegna_enum,
ADD COLUMN data_selezione_consegna TIMESTAMPTZ,
ADD COLUMN data_completamento_consegna TIMESTAMPTZ;

-- Step 3: Add helpful comments
COMMENT ON COLUMN buste.metodo_consegna IS 'Method of delivery: pickup at store, home delivery, or shipping';
COMMENT ON COLUMN buste.stato_consegna IS 'Current delivery status';
COMMENT ON COLUMN buste.data_selezione_consegna IS 'Timestamp when delivery method was selected';
COMMENT ON COLUMN buste.data_completamento_consegna IS 'Timestamp when delivery was completed (picked up/delivered/arrived)';

-- Step 4: Create index for faster queries on delivery tracking
CREATE INDEX idx_buste_delivery_tracking ON buste(metodo_consegna, stato_consegna, data_selezione_consegna)
WHERE metodo_consegna IS NOT NULL;

-- Step 5: Add RLS policies (inherit from existing buste policies)
-- No additional RLS needed - new columns will use existing buste table policies
