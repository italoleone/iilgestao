
CREATE TABLE public.pdf_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid NOT NULL REFERENCES public.task_attachments(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  annotation_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdf_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view annotations"
  ON public.pdf_annotations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own annotations"
  ON public.pdf_annotations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own annotations"
  ON public.pdf_annotations FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own annotations"
  ON public.pdf_annotations FOR DELETE TO authenticated
  USING (user_id = auth.uid());
