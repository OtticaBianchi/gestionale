# Interventions – 06/09/2025

This document summarizes all changes and decisions made, with rationale and next steps. It’s meant as a hand‑off so we can pick up smoothly tomorrow.

## High‑Level Goals Achieved
- Hardened authentication and role‑based access (invite‑only, admin gating, manager capabilities).
- Split “Voice Triage” and “Archivio Buste” into standalone, role‑aware modules (clean navigation from a new Hub).
- Made managers actually useful operationally (Operations Console) without giving destructive powers.
- Fixed session consistency and local development noise (Speed Insights).

---

## Auth, Roles, and Sessions

- Invite‑only onboarding
  - Admin can invite users and pre‑assign role.
  - New signup page is informational (no open signup).
  - Profile creation on first login uses invited role.
  - Files:
    - `src/app/api/admin/invite/route.ts` (new)
    - `src/app/api/admin/users/route.ts` (list users)
    - `src/app/api/admin/users/[id]/route.ts` (update role/full name)
    - `src/app/admin/users/page.tsx` (UI for invites and user management)
    - `src/app/signup/page.tsx` (invite‑only notice)
    - `src/app/auth/callback/route.ts` (use invited role; role‑based default redirect)

- Role‑based default landing
  - Admin/Manager → `/hub`
  - Operatore → `/dashboard`
  - Files:
    - `src/app/login/page.tsx` (post‑login redirect based on role)
    - `src/app/auth/callback/route.ts` (role‑aware default next)
    - `middleware.ts` (redirect from `/login` when already authenticated)

- Session consistency
  - All new SSR module pages use the shared server supabase client helper to correctly refresh cookies.
  - Files:
    - `src/app/hub/page.tsx` (uses `createServerSupabaseClient`)
    - `src/app/modules/voice-triage/page.tsx` (ditto)
    - `src/app/modules/archive/page.tsx` (ditto)

- Speed Insights dev noise removed
  - Load only in production via dynamic import.
  - File: `src/app/layout.tsx`

---

## Navigation & Structure

- New Hub (Welcome) page
  - Path: `/hub` (admins/managers only), cards to modules and VisionHUB.
  - Files:
    - `src/app/hub/page.tsx` (new)
    - `src/app/(app)/layout.tsx` (adds Hub link for admin/manager)

- Modules
  - Voice Triage (admin): `/modules/voice-triage` – reuses voice notes UI.
  - Archivio Buste (admin/manager): `/modules/archive` – quick read‑only archive list.
  - Operations Console (admin/manager): `/modules/operations` – actionable ordini overview.
  - Files:
    - `src/app/modules/voice-triage/page.tsx` (new)
    - `src/app/modules/archive/page.tsx` (new)
    - `src/app/modules/operations/page.tsx` (new)

- Middleware protections
  - Admin‑only: `/admin/*`, `/modules/voice-triage`
  - Manager+Admin: `/modules/archive`, `/modules/operations`
  - Protected auth paths include `/profile` and `/modules/*`.
  - File: `middleware.ts`

- Profile route fixes
  - Replaced `/profilo` links with `/profile` and protected it.
  - Files:
    - `src/app/(app)/layout.tsx`
    - `middleware.ts`

---

## Voice Notes (Admin‑only actions)

- API hardening
  - GET `/api/voice-notes`: requires auth; non‑admins receive metadata only (no audio blob). Admins get full payload.
  - PATCH `/api/voice-notes/[id]`: admin‑only; server checks role before using service role for updates.
  - DELETE `/api/voice-notes/[id]`: admin‑only (already enforced).
  - Files:
    - `src/app/api/voice-notes/route.ts`
    - `src/app/api/voice-notes/[id]/route.ts`

- UI gating
  - Only admins see playback, download, complete/delete actions.
  - Back from Voice Triage returns to `/hub` for admins.
  - “+ Nuova Busta” button added in client search (admin) in Voice Triage.
  - File: `src/app/dashboard/voice-notes/page.tsx`

- Telegram webhook verification
  - Validates `x-telegram-bot-api-secret-token` header.
  - File: `src/app/api/telegram/webhook/route.ts`

---

## Manager Role – Useful but Safe

- Principles implemented
  - Can see and act on any busta and related orders.
  - Cannot delete clients, buste, ordini, or payments.
  - No access to Reports dashboard.

- Operations Console
  - Path: `/modules/operations` (admin/manager)
  - Tabs: Da ordinare, Ordinati, In arrivo, In ritardo, Tutti
  - Actions: mark `ordinato` (also flips `da_ordinare`), set ETA (`data_consegna_prevista`), mark `consegnato` (sets `data_consegna_effettiva`), edit `note`.
  - File: `src/app/modules/operations/page.tsx`

- Safe server‑gated APIs for ordini
  - GET `/api/ordini?status=…`: service role after role check; managers see all orders.
  - PATCH `/api/ordini/[id]`: allows only safe fields (stato, da_ordinare, data_consegna_prevista, data_consegna_effettiva, data_ordine, note).
  - Files:
    - `src/app/api/ordini/route.ts` (new)
    - `src/app/api/ordini/[id]/route.ts` (new)

- Materiali Tab tweaks
  - Order deletion button is admin‑only (manager never sees it).
  - Status/da_ordinare updates now use the new secure API.
  - Files:
    - `src/app/dashboard/buste/[id]/_components/tabs/MaterialiTab.tsx`
    - `src/app/dashboard/buste/[id]/_components/BustaDetailClient.tsx`

---

## Admin User Management

- User list + invite UI
  - `/admin/users` shows all auth users with profiles, allows inline role/full_name edit, and invites new users (with role).
  - Files:
    - `src/app/admin/users/page.tsx`
    - `src/app/api/admin/users/route.ts`
    - `src/app/api/admin/users/[id]/route.ts`
    - `src/app/api/admin/invite/route.ts`

---

## Miscellaneous

- Speed Insights only in production (avoid local 404/MIME errors).
  - File: `src/app/layout.tsx`

- Minor navigation improvements
  - Sidebar now includes Hub, Voice Triage, Archivio, Operations (role‑aware).
  - File: `src/app/(app)/layout.tsx`

---

## Environment & Config

- Required envs
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server only)
  - `TELEGRAM_BOT_TOKEN` (existing)
  - `TELEGRAM_WEBHOOK_SECRET` (new; used to verify Telegram webhook)

- Supabase Auth
  - Turn on email invites; ensure redirect URL includes `/auth/callback`.

---

## Open Items / Next Steps

1) VisionHUB Dashboard (Manager tiles)
- Add “Cosa ordinare oggi” and “In ritardo” cards backed by `/api/ordini`.
- Add “Buste da consegnare” list.

2) Busta prefill from Voice Triage
- When clicking “+ Nuova Busta” from a client search result, prefill the new busta form with `cliente_id`.

3) Supplier SLA accuracy
- Ensure we capture `data_consegna_effettiva` on arrival to compute on‑time rates.

4) RLS review
- With server‑gated writes in place, we can keep RLS strict and rely on role checks in endpoints. Alternatively, selectively allow manager UPDATEs on operational tables if we prefer pure RLS.

5) Cleanup legacy paths
- Optionally remove `/dashboard/voice-notes` from navigation and rely solely on `/modules/voice-triage`.

6) Session listeners consolidation (optional)
- Consider consolidating auth listeners to `UserContext` and keep `SessionManager` UI‑only if we see double refreshes.

---

## File Inventory (touched)
- Auth & roles: `src/app/auth/callback/route.ts`, `src/app/signup/page.tsx`, `src/app/login/page.tsx`, `middleware.ts`
- Admin users: `src/app/api/admin/invite/route.ts`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/route.ts`, `src/app/admin/users/page.tsx`
- Hub & modules: `src/app/hub/page.tsx`, `src/app/modules/voice-triage/page.tsx`, `src/app/modules/archive/page.tsx`, `src/app/modules/operations/page.tsx`
- Voice notes: `src/app/dashboard/voice-notes/page.tsx`, `src/app/api/voice-notes/route.ts`, `src/app/api/voice-notes/[id]/route.ts`, `src/app/api/telegram/webhook/route.ts`
- VisionHUB details: `src/app/dashboard/buste/[id]/_components/BustaDetailClient.tsx`, `src/app/dashboard/buste/[id]/_components/tabs/MaterialiTab.tsx`
- Orders APIs: `src/app/api/ordini/route.ts`, `src/app/api/ordini/[id]/route.ts`
- Layout/UX: `src/app/(app)/layout.tsx`, `src/app/layout.tsx`

---

## Summary
We tightened security and roles, introduced a clean Hub with focused modules, and made managers truly effective through a safe Operations Console and server‑gated updates. Sessions are now consistent across modules, and local dev is quieter. Next, we’ll enrich the manager dashboard tiles, streamline Voice Triage → new busta prefills, and (optionally) tune RLS further.

