
-- Fix overly permissive UPDATE policy on tasks
DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.tasks;
CREATE POLICY "Authenticated can update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    responsible = auth.uid() OR
    has_role(auth.uid(), 'admin_geral'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planejamento'::app_role)
  );
