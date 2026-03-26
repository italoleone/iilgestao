
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  start_time text NOT NULL,
  end_time text,
  audio_path text,
  transcription text,
  minutes_text text,
  processing_status text NOT NULL DEFAULT 'pendente',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view meetings" ON public.meetings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own meetings" ON public.meetings
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator or admin can update meetings" ON public.meetings
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planejamento'::app_role));

CREATE POLICY "Admin can delete meetings" ON public.meetings
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'planejamento'::app_role));

INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-audio', 'meeting-audio', true);

CREATE POLICY "Authenticated can upload meeting audio" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'meeting-audio');

CREATE POLICY "Anyone can view meeting audio" ON storage.objects
  FOR SELECT USING (bucket_id = 'meeting-audio');

CREATE POLICY "Admin can delete meeting audio" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'meeting-audio' AND (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
