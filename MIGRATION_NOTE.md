# Database Migration Required

## Migration: Remove cellulare_staccato Status

**File**: `scripts/remove_cellulare_staccato_status.sql`

### What this migration does:
1. **Updates database constraint** to remove `cellulare_staccato` from valid call statuses
2. **Converts existing data** - any existing `cellulare_staccato` records become `non_risponde`
3. **Updates trigger function** to stop tracking `cellulari_staccati` (sets to 0)
4. **Adds documentation** marking the field as deprecated

### To apply the migration:
```sql
-- Run this SQL against your database:
\i scripts/remove_cellulare_staccato_status.sql
```

### UI Changes Made:
- ✅ Removed `cellulare_staccato` from CallStatus type
- ✅ Removed from status labels and dropdown options
- ✅ Updated completed states logic
- ✅ Hidden deprecated statistics display
- ✅ Updated API endpoints

### After Migration:
- Users will no longer see "Cellulare staccato" as an option
- Existing "cellulare_staccato" records become "non_risponde"
- Statistics UI no longer shows deprecated counts
- Follow-up generation excludes old deprecated states

**Status**: ✅ Ready to run - code is already updated to handle the change