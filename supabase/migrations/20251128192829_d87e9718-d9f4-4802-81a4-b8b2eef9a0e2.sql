-- Update the handle_new_user function to also insert into user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Get the role from metadata, default to 'cashier'
  user_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'cashier'::app_role);
  
  -- Insert into profiles
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'cashier')
  );
  
  -- Insert into user_roles
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, user_role);
  
  RETURN NEW;
END;
$$;