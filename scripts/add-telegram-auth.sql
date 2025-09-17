-- Add Telegram authorization to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS telegram_user_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS telegram_bot_access BOOLEAN DEFAULT false;

-- Create table for logging unauthorized telegram users (temporary)
CREATE TABLE IF NOT EXISTS telegram_auth_requests (
    id SERIAL PRIMARY KEY,
    telegram_user_id VARCHAR(50) NOT NULL,
    telegram_username VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    first_seen_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW(),
    message_count INTEGER DEFAULT 1,
    authorized BOOLEAN DEFAULT false,
    UNIQUE(telegram_user_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_user_id ON profiles(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_auth_requests_user_id ON telegram_auth_requests(telegram_user_id);

-- Comments
COMMENT ON COLUMN profiles.telegram_user_id IS 'ID utente Telegram autorizzato';
COMMENT ON COLUMN profiles.telegram_bot_access IS 'Permesso di accesso al bot Telegram';
COMMENT ON TABLE telegram_auth_requests IS 'Log temporaneo utenti non autorizzati (rimuovere dopo setup iniziale)';