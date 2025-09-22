-- Debug Garmin Search Issues
-- Run these queries in Supabase SQL Editor to investigate

-- 1. Check what Garmin suppliers exist in your system
SELECT 'fornitori_montature' as table_name, nome
FROM fornitori_montature
WHERE nome ILIKE '%garmin%'
UNION ALL
SELECT 'fornitori_lenti' as table_name, nome
FROM fornitori_lenti
WHERE nome ILIKE '%garmin%'
UNION ALL
SELECT 'fornitori_lac' as table_name, nome
FROM fornitori_lac
WHERE nome ILIKE '%garmin%'
UNION ALL
SELECT 'fornitori_sport' as table_name, nome
FROM fornitori_sport
WHERE nome ILIKE '%garmin%'
UNION ALL
SELECT 'fornitori_lab_esterno' as table_name, nome
FROM fornitori_lab_esterno
WHERE nome ILIKE '%garmin%';

-- 2. Check all supplier names that contain variations of Garmin
SELECT DISTINCT nome
FROM (
    SELECT nome FROM fornitori_montature
    UNION ALL
    SELECT nome FROM fornitori_lenti
    UNION ALL
    SELECT nome FROM fornitori_lac
    UNION ALL
    SELECT nome FROM fornitori_sport
    UNION ALL
    SELECT nome FROM fornitori_lab_esterno
) all_suppliers
WHERE nome ILIKE '%garm%' OR nome ILIKE '%GARM%'
ORDER BY nome;

-- 3. Count orders linked to any Garmin suppliers
SELECT
    COUNT(*) as total_orders,
    COUNT(DISTINCT busta_id) as unique_buste,
    COUNT(DISTINCT b.cliente_id) as unique_clients
FROM ordini_materiali om
JOIN buste b ON b.id = om.busta_id
WHERE (
    om.fornitore_montature_id IN (SELECT id FROM fornitori_montature WHERE nome ILIKE '%garmin%')
    OR om.fornitore_lenti_id IN (SELECT id FROM fornitori_lenti WHERE nome ILIKE '%garmin%')
    OR om.fornitore_lac_id IN (SELECT id FROM fornitori_lac WHERE nome ILIKE '%garmin%')
    OR om.fornitore_sport_id IN (SELECT id FROM fornitori_sport WHERE nome ILIKE '%garmin%')
    OR om.fornitore_lab_esterno_id IN (SELECT id FROM fornitori_lab_esterno WHERE nome ILIKE '%garmin%')
)
AND b.stato_attuale = 'consegnato_pagato';

-- 4. Show actual client details for Garmin buyers
SELECT DISTINCT
    c.nome,
    c.cognome,
    c.email,
    c.telefono,
    b.data_apertura,
    suppliers.supplier_name,
    suppliers.supplier_type,
    om.descrizione_prodotto
FROM buste b
JOIN clienti c ON c.id = b.cliente_id
JOIN ordini_materiali om ON om.busta_id = b.id
LEFT JOIN LATERAL (
    SELECT fm.nome as supplier_name, 'montature' as supplier_type
    FROM fornitori_montature fm
    WHERE fm.id = om.fornitore_montature_id AND fm.nome ILIKE '%garmin%'
    UNION ALL
    SELECT fl.nome as supplier_name, 'lenti' as supplier_type
    FROM fornitori_lenti fl
    WHERE fl.id = om.fornitore_lenti_id AND fl.nome ILIKE '%garmin%'
    UNION ALL
    SELECT flac.nome as supplier_name, 'lac' as supplier_type
    FROM fornitori_lac flac
    WHERE flac.id = om.fornitore_lac_id AND flac.nome ILIKE '%garmin%'
    UNION ALL
    SELECT fs.nome as supplier_name, 'sport' as supplier_type
    FROM fornitori_sport fs
    WHERE fs.id = om.fornitore_sport_id AND fs.nome ILIKE '%garmin%'
    UNION ALL
    SELECT fle.nome as supplier_name, 'lab_esterno' as supplier_type
    FROM fornitori_lab_esterno fle
    WHERE fle.id = om.fornitore_lab_esterno_id AND fle.nome ILIKE '%garmin%'
) suppliers ON true
WHERE b.stato_attuale = 'consegnato_pagato'
AND suppliers.supplier_name IS NOT NULL
ORDER BY b.data_apertura DESC;