-- Migration: add new 'sbagliato' status for ordini_materiali
ALTER TYPE ordine_status ADD VALUE IF NOT EXISTS 'sbagliato';
