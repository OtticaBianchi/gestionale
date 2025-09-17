# Telegram Bot Authorization Setup

## Setup Steps

1. **Run Database Migration**
   ```bash
   # Execute in Supabase SQL Editor or via CLI:
   cat scripts/add-telegram-auth.sql
   ```

2. **Test the System**
   - Have someone send a voice note to your bot
   - They'll get a message with their user ID
   - Check `/admin/users` page - you'll see their request in the orange box
   - Select their profile from dropdown and click "Autorizza"
   - They can now use the bot immediately

## How It Works

### For Unauthorized Users:
- Bot blocks access and logs their info
- User gets: *"🔒 Non sei autorizzato ad usare questo bot. Per ottenere l'accesso, contatta un amministratore e fornisci questo codice: `123456789`"*

### For Admins:
- Go to `/admin/users` page
- See "Richieste Accesso Bot Telegram" section with pending requests
- Link Telegram ID to existing user profile
- User can immediately start using bot

### For Authorized Users:
- Bot processes voice notes normally
- Shows ✅ checkmark in admin users table

## Security Features

- Only existing gestionale users can be authorized
- Admin must manually approve each Telegram user
- Temporary logging table for audit trail
- No anonymous access allowed

## Cleanup (Optional)

After initial setup, you can remove the logging table:

```sql
DROP TABLE telegram_auth_requests;
```

The bot will continue working with authorized users.