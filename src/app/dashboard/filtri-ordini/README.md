# ⚠️ DEPRECATED - Dashboard Filtri Ordini

## Status: ARCHIVED (October 2025)

This route has been **replaced** by `/modules/operations` which provides:
- Same core functionality (group orders by supplier, bulk operations)
- Additional features (tabbed interface, mark as arrived, table view)
- Manager/Admin-only access control
- Better maintainability

## History

- **Created**: ~September 2025 - Initial order management dashboard
- **Evolved**: October 2025 - Enhanced version created as `/modules/operations`
- **Archived**: October 2025 - Superseded by operations module

## Migration Notes

All functionality from `filtri-ordini` is available in `/modules/operations`:
- Grouping by supplier → Same
- Bulk "marca come ordinato" → Same
- Supplier contact actions → Same (+ improved)
- Statistics → Same (+ per-tab filtering)

## Archived File

The original implementation is preserved as `_page.tsx.archived` for reference.

## Access

- Old route: `/dashboard/filtri-ordini` → **No longer accessible**
- New route: `/modules/operations` → **Active**

---

*If you need to restore this route, rename `_page.tsx.archived` back to `page.tsx`*
