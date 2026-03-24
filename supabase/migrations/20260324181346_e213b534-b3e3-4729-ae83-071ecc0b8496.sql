-- Allow planejamento to delete tasks
DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tasks;
CREATE POLICY "Non-projetista can delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin_geral'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planejamento'::app_role)
  );

-- Allow planejamento to delete projects
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
CREATE POLICY "Non-projetista can delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin_geral'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planejamento'::app_role)
  );

-- Allow non-projetista to delete time entries (cascade needs this)
CREATE POLICY "Non-projetista can delete time entries" ON public.time_entries
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin_geral'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planejamento'::app_role)
  );