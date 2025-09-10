# Supabase RLS Update — Operator Read‑Only, Manager/Admin Edit

This guide enables read‑only visibility for authenticated users (operators) across core tables, while leaving write access to your existing rules (typically manager/admin via app APIs).

Follow the steps below in the Supabase SQL editor (public schema).

## 1) Enable RLS (if not already enabled)

```sql
alter table buste enable row level security;
alter table clienti enable row level security;
alter table ordini_materiali enable row level security;
alter table info_pagamenti enable row level security;
alter table rate_pagamenti enable row level security;
alter table status_history enable row level security;
alter table comunicazioni enable row level security;
alter table lavorazioni enable row level security;

alter table fornitori_lenti enable row level security;
alter table fornitori_montature enable row level security;
alter table fornitori_lac enable row level security;
alter table fornitori_sport enable row level security;
alter table fornitori_lab_esterno enable row level security;

alter table tipi_lenti enable row level security;
alter table tipi_ordine enable row level security;
```

## 2) Add SELECT policies for authenticated users

This allows all logged‑in users to read data. Operators can see, but not modify. Managers/Admins keep write permissions through existing API routes (service role) or separate write policies you already have.

```sql
-- Core entities
create policy "buste select for authenticated" on buste for select using (auth.role() = 'authenticated');
create policy "clienti select for authenticated" on clienti for select using (auth.role() = 'authenticated');
create policy "ordini_materiali select for authenticated" on ordini_materiali for select using (auth.role() = 'authenticated');
create policy "info_pagamenti select for authenticated" on info_pagamenti for select using (auth.role() = 'authenticated');
create policy "rate_pagamenti select for authenticated" on rate_pagamenti for select using (auth.role() = 'authenticated');
create policy "status_history select for authenticated" on status_history for select using (auth.role() = 'authenticated');
create policy "comunicazioni select for authenticated" on comunicazioni for select using (auth.role() = 'authenticated');
create policy "lavorazioni select for authenticated" on lavorazioni for select using (auth.role() = 'authenticated');

-- Suppliers and helpers
create policy "fornitori_lenti select for authenticated" on fornitori_lenti for select using (auth.role() = 'authenticated');
create policy "fornitori_montature select for authenticated" on fornitori_montature for select using (auth.role() = 'authenticated');
create policy "fornitori_lac select for authenticated" on fornitori_lac for select using (auth.role() = 'authenticated');
create policy "fornitori_sport select for authenticated" on fornitori_sport for select using (auth.role() = 'authenticated');
create policy "fornitori_lab_esterno select for authenticated" on fornitori_lab_esterno for select using (auth.role() = 'authenticated');

create policy "tipi_lenti select for authenticated" on tipi_lenti for select using (auth.role() = 'authenticated');
create policy "tipi_ordine select for authenticated" on tipi_ordine for select using (auth.role() = 'authenticated');
```

Notes:
- These policies only grant SELECT. Your app APIs that use the Supabase Service Role key are unaffected and can still write as before (admin/manager routes).
- If you already have SELECT policies, skip duplicates or adjust names.

## 3) Optional: grants (schema usage)

```sql
grant usage on schema public to authenticated;
-- Optional redundancy with RLS but harmless:
grant select on 
  buste, clienti, ordini_materiali, info_pagamenti, rate_pagamenti, status_history, comunicazioni,
  fornitori_lenti, fornitori_montature, fornitori_lac, fornitori_sport, fornitori_lab_esterno,
  tipi_lenti, tipi_ordine
  to authenticated;
```

## 4) Verify

- Log in as an “operatore”
- Open a busta detail page and confirm you can see:
  - Ordini & stato arrivi (read‑only)
  - Storico stati (read‑only)
  - Pagamenti (read‑only)
- Ensure actions (create/update/delete) are blocked for operator (UI already enforces read‑only).

## 5) Rollback (if needed)

To remove these policies quickly:

```sql
-- Drop the policies you just created (example for a few tables)
drop policy if exists "buste select for authenticated" on buste;
drop policy if exists "clienti select for authenticated" on clienti;
drop policy if exists "ordini_materiali select for authenticated" on ordini_materiali;
-- ...repeat for the others as necessary...
```

## 6) Recommended next steps

- Keep write access restricted to admin/manager by using API routes that run with the Service Role key (already in this app), or add explicit INSERT/UPDATE/DELETE policies limited by role via `auth.jwt() ->> 'app_metadata'` or a `profiles` join.
- If you have multi‑tenant constraints, replace `auth.role() = 'authenticated'` with your tenant logic (e.g., match store or membership tables).

---

Last updated: 2025‑09‑10
