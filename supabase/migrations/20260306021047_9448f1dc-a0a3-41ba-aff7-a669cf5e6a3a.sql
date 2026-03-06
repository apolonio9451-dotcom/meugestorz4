
-- Remove duplicate/problematic triggers, keep only the correct pair
DROP TRIGGER IF EXISTS on_auth_trial_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
DROP TRIGGER IF EXISTS on_trial_signup ON auth.users;

-- Ensure the correct trial trigger exists (with proper WHEN clause)
CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'trial_token' IS NOT NULL)
  EXECUTE FUNCTION public.handle_trial_signup();
