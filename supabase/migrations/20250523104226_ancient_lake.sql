/*
  # Disable email verification

  1. Changes
    - Disable email confirmation requirement for new signups
    - Allow immediate access after registration
    
  2. Security Note
    - Users can access the application immediately after signup
    - No email verification step required
*/

BEGIN;
  -- Update auth.users to not require email verification
  ALTER TABLE auth.users ALTER COLUMN confirmed_at SET DEFAULT NOW();
  
  -- Update existing users to be confirmed
  UPDATE auth.users SET confirmed_at = NOW() WHERE confirmed_at IS NULL;
  
  -- Disable email confirmation requirement
  UPDATE auth.config SET confirm_email = false;
COMMIT;