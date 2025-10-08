# Changelog v3.0.1

**Date**: 04 October 2025
**Status**: ✅ Deployed and Working

## New Features

### Analytics Dashboard
- **Location**: `/dashboard/analytics`
- **Access**: Admin only
- **Description**: Comprehensive Business Intelligence dashboard with:
  - Statistics on lavorazioni (work types)
  - Revenue tracking and analysis by type
  - Top suppliers/brands analytics
  - Sunglasses analytics by brand and gender
  - Monthly trends (last 12 months)
  - Interactive charts using Recharts
  - Period filtering (month/quarter/year/custom)

## Technical Changes

### Files Modified
1. `package.json` - Version bumped from 2.9.1 to 3.0.1
2. `src/app/page.tsx` - Added v3.0.1 to homepage changelog
3. `src/app/login/page.tsx` - Added collapsible changelog section
4. `src/app/dashboard/analytics/page.tsx` - New analytics dashboard page
5. `src/app/api/analytics/route.ts` - New API route for analytics data

### API Implementation
- **Route**: `/api/analytics`
- **Method**: GET
- **Auth**: Requires admin role
- **Query Params**: `period` (month|quarter|year|custom), `start_date`, `end_date`
- **Implementation Details**:
  - Uses `createServerClient` from `@supabase/ssr` for authentication
  - Validates admin role via `profiles` table
  - Uses service role key to bypass RLS for data aggregation
  - Returns comprehensive analytics including revenue, trends, and statistics

### Database Schema Notes
- `tipi_lenti` table columns: `id`, `nome`, `created_at`, `giorni_consegna_stimati`
  - ⚠️ Note: No `tipo` column exists (fixed in final implementation)
- Authentication uses `profiles` table with `role` column
- User matching uses `id` field (not `supabase_uid`)

## Issues Resolved

1. **Initial auth error (401)**: Fixed by using correct `createServerClient` pattern matching other admin routes
2. **Table name error**: Changed from `utenti` to `profiles` table
3. **Column name errors**:
   - Changed `ruolo` to `role`
   - Changed `supabase_uid` to `id`
   - Changed `tipi_lenti.tipo` to `tipi_lenti.nome`
4. **Deployment issues**: Multiple commits were made during debugging; workflow improved for future

## Deployment Notes

- Total commits for this feature: 7 (including fixes)
- Final working commit: `52e447d`
- Deployment platform: Vercel
- All changes successfully deployed and tested

## Lessons Learned

1. **Always check database schema first** before writing queries
2. **Test authentication patterns** by referencing working admin routes
3. **Minimize commits** by testing locally before committing
4. **Use `git commit --amend`** for fixing mistakes instead of creating new commits
5. **Force push requires** branch protection to be disabled on GitHub

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
