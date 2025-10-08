-- Migration: Add 'annullato' state to ordine_status enum
-- Date: 2025-10-08
-- Description: Add order cancellation state with notes support

-- Add 'annullato' to the ordine_status enum
ALTER TYPE ordine_status ADD VALUE 'annullato';

-- Verification: Check the enum values
-- SELECT unnest(enum_range(NULL::ordine_status));
