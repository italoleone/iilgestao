
-- Add parent_task_id and rejection_reason to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Create task_attachments table
CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer DEFAULT 0,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view attachments
CREATE POLICY "Authenticated can view attachments" ON public.task_attachments
  FOR SELECT TO authenticated USING (true);

-- Task responsible or non-projetista can insert
CREATE POLICY "Users can insert attachments" ON public.task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- Non-projetista can delete attachments
CREATE POLICY "Non-projetista can delete attachments" ON public.task_attachments
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    has_role(auth.uid(), 'admin_geral'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planejamento'::app_role)
  );

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true);

-- Storage policies
CREATE POLICY "Authenticated can upload task attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Anyone can view task attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments');

CREATE POLICY "Users can delete own task attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments');
