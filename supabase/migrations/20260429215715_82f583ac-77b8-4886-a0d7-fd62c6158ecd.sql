ALTER TABLE public.proposal_billing_schedule
  ADD COLUMN IF NOT EXISTS execution_month integer,
  ADD COLUMN IF NOT EXISTS execution_year integer;