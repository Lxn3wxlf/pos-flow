-- Fix the handle_new_user function to work with both role systems correctly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  user_app_role app_role;
  user_profile_role user_role;
BEGIN
  -- Get the role from metadata, default to 'cashier'
  user_app_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'cashier'::app_role);
  
  -- Map app_role to user_role for profiles table (only admin and cashier allowed)
  IF user_app_role IN ('admin', 'cashier') THEN
    user_profile_role := user_app_role::text::user_role;
  ELSE
    -- For waiter and kitchen roles, default to cashier in profiles
    user_profile_role := 'cashier'::user_role;
  END IF;
  
  -- Insert into profiles
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    user_profile_role
  );
  
  -- Insert into user_roles with the full app_role
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, user_app_role);
  
  RETURN NEW;
END;
$function$;