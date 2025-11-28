-- Fix infinite recursion in profiles RLS policies
-- The issue: "Admins can view all profiles" policy queries profiles table, causing recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create a corrected policy that checks role from JWT metadata instead of querying profiles table
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT
  USING (
    (auth.jwt()->>'role')::text = 'admin'
  );

-- Also add a policy to allow users to read their own profile even during the check
-- This ensures the initial profile fetch after signup works
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);