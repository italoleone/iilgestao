ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS speaker_map jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS pdf_path text;