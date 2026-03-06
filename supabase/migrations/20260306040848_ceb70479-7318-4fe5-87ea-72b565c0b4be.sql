
-- Create triggers on auth.users for signup handling
-- handle_trial_signup runs first (priority 1), handle_new_user runs after (priority 2)
CREATE OR REPLACE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_trial_signup();

CREATE OR REPLACE TRIGGER on_auth_user_created_default
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
