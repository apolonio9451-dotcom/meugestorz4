
CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data->>'trial_token' IS NOT NULL)
  EXECUTE FUNCTION public.handle_trial_signup();
