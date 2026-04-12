
-- 1. Make meeting-audio bucket private
UPDATE storage.buckets SET public = false WHERE id = 'meeting-audio';

-- 2. Drop the overly permissive "Anyone can view meeting audio" policy
DROP POLICY IF EXISTS "Anyone can view meeting audio" ON storage.objects;

-- 3. Add authenticated-only SELECT for meeting audio
CREATE POLICY "Authenticated can view meeting audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'meeting-audio');

-- 4. Drop the overly permissive task attachments DELETE policy
DROP POLICY IF EXISTS "Users can delete own task attachments" ON storage.objects;

-- 5. Add ownership-checked DELETE for task attachments
CREATE POLICY "Owner or admin can delete task attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.task_attachments ta
      WHERE ta.file_path = name
      AND ta.uploaded_by = auth.uid()
    )
    OR has_role(auth.uid(), 'admin_geral'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'planejamento'::app_role)
  )
);
