
-- Trigger for normal signups
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'trial_token' IS NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger for trial signups
CREATE OR REPLACE TRIGGER on_auth_trial_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'trial_token' IS NOT NULL)
  EXECUTE FUNCTION public.handle_trial_signup();
