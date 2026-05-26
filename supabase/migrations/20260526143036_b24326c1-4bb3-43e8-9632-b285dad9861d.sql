
-- 1. Restrict project_billing_schedule writes to admin/planejamento
DROP POLICY IF EXISTS "Authenticated can insert billing schedule" ON public.project_billing_schedule;
DROP POLICY IF EXISTS "Authenticated can update billing schedule" ON public.project_billing_schedule;
DROP POLICY IF EXISTS "Authenticated can delete billing schedule" ON public.project_billing_schedule;

CREATE POLICY "Admin can insert billing schedule"
ON public.project_billing_schedule FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planejamento'::app_role));

CREATE POLICY "Admin can update billing schedule"
ON public.project_billing_schedule FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planejamento'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planejamento'::app_role));

CREATE POLICY "Admin can delete billing schedule"
ON public.project_billing_schedule FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planejamento'::app_role));

-- 2. Add UPDATE policy for task-attachments storage
CREATE POLICY "Owner or admin can update task attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    EXISTS (SELECT 1 FROM public.task_attachments ta WHERE ta.file_path = objects.name AND ta.uploaded_by = auth.uid())
    OR has_role(auth.uid(), 'admin_geral'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'planejamento'::app_role)
  )
);

-- 3. Restrict listing of public buckets to authenticated users
DROP POLICY IF EXISTS "Anyone can view task attachments" ON storage.objects;
CREATE POLICY "Authenticated can view task attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

DROP POLICY IF EXISTS "Authenticated can read task-files" ON storage.objects;
CREATE POLICY "Authenticated can read task-files v2"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-files');

DROP POLICY IF EXISTS "Public can read proposal templates" ON storage.objects;
CREATE POLICY "Admin can list proposal templates"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'proposal-templates'
  AND (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- 4. Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 5. Lock down EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.fn_start_timer(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_stop_timer() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_start_timer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_stop_timer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
