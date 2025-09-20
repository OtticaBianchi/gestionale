# SUPABASE SESSION CONFIGURATION

## IMMEDIATE ACTION REQUIRED

To prevent users from getting logged out during active work, configure longer JWT session duration:

### 1. Go to Supabase Dashboard
1. Open your Supabase project dashboard
2. Navigate to **Authentication** → **Settings**
3. Scroll down to **Session expiry**

### 2. Update Session Settings
Change these values:

**Current (likely causing issues):**
- JWT expiry: `3600` seconds (1 hour)

**Recommended:**
- JWT expiry: `14400` seconds (4 hours)
- Refresh token expiry: `2592000` seconds (30 days)

### 3. Additional Settings
Also verify these are set:
- **Enable refresh token rotation**: ✅ Enabled
- **Enable phone confirmations**: As per your needs
- **Allow multiple sign-ins per email**: ✅ Enabled (for multiple devices)

### 4. Why This Fixes the Issue
- **Current problem**: JWT tokens expire after 1 hour, forcing logout even for active users
- **Solution**: 4-hour JWT sessions give enough time for work sessions
- **Auto-refresh**: SessionManager now auto-refreshes tokens at 5 minutes before expiry
- **Multiple users**: Each user gets their own session token

### 5. Save and Deploy
1. Click **Save** in Supabase dashboard
2. Changes take effect immediately (no code deployment needed)

## HOW THE NEW SYSTEM WORKS

1. **JWT tokens last 4 hours** instead of 1 hour
2. **Auto-refresh happens** at 5 minutes before expiry
3. **Multiple users** can work simultaneously without conflicts
4. **Idle timeout** still works (60 minutes of inactivity)
5. **Session warnings** appear 2 minutes before expiry

This should completely resolve the random logout issues during active work.