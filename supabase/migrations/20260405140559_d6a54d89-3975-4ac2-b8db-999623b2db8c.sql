ALTER TABLE public.commercial_proposals
  ADD COLUMN IF NOT EXISTS arquivo_ref_1 text,
  ADD COLUMN IF NOT EXISTS arquivo_ref_2 text;