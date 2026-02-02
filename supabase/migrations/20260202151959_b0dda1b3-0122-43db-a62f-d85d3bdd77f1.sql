-- Allow admins to view all practice sessions
CREATE POLICY "Admins can view all practice sessions"
ON public.practice_sessions
FOR SELECT
USING (is_admin());