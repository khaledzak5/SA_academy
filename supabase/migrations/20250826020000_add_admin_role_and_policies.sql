-- Add role column to profiles, ensure admin profile exists, and create secure admin-check function + policies

-- 1) ensure role column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role text;

-- 2) upsert admin profile (replace user_id if you need a different admin)
-- NOTE: change the user_id below if your admin id differs
INSERT INTO public.profiles (user_id, student_id, full_name, role)
VALUES (
  '5d0ee60a-acc5-4883-9cf2-6d0f488190ab',
  'Admin_5288',
  'Admin_5288',
  'admin'
)
ON CONFLICT (user_id) DO UPDATE
SET student_id = EXCLUDED.student_id,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- 3) create a SECURITY DEFINER helper that checks if the caller is admin
-- The function runs with the privileges of its owner, avoiding RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  );
$$;

-- 4) Create safe policies using the helper (drop if present first)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (
  auth.uid() = user_id OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins can view quiz_results" ON public.quiz_results;
CREATE POLICY "Admins can view quiz_results"
ON public.quiz_results FOR SELECT
USING (
  auth.uid() = user_id OR public.is_admin()
);

-- (optional) allow admins to insert/select chat threads if you need
-- DROP POLICY IF EXISTS "Admins can view chat_history" ON public.chat_history;
-- CREATE POLICY "Admins can view chat_history"
-- ON public.chat_history FOR SELECT
-- USING (
--   auth.uid() = user_id OR public.is_admin()
-- );
