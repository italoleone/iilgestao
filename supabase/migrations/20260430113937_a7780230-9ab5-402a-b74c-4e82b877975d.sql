ALTER TABLE public.commercial_proposals
  ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'medicao',
  ADD COLUMN IF NOT EXISTS installment_count integer,
  ADD COLUMN IF NOT EXISTS installment_start_month integer,
  ADD COLUMN IF NOT EXISTS installment_start_year integer;