-- Storage bucket for task review PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-files', 'task-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated can read task-files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'task-files');

CREATE POLICY "Authenticated can upload task-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-files' AND owner = auth.uid());

CREATE POLICY "Owner can update task-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'task-files' AND owner = auth.uid());

CREATE POLICY "Owner or admin can delete task-files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-files'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin_geral'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'planejamento'::app_role)
  )
);

-- Review comments table
CREATE TABLE public.task_review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  comment text NOT NULL,
  page integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_review_comments_task ON public.task_review_comments(task_id);

ALTER TABLE public.task_review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view review comments"
ON public.task_review_comments FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated can insert own review comments"
ON public.task_review_comments FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Author or admin can delete review comments"
ON public.task_review_comments FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin_geral'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_review_comments;
ALTER TABLE public.task_review_comments REPLICA IDENTITY FULL;