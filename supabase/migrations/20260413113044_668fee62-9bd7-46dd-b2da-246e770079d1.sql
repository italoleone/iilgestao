
ALTER TABLE public.receivables
  ADD COLUMN nf_number text,
  ADD COLUMN tax_percentage numeric(5,2) DEFAULT 0,
  ADD COLUMN installment_number text;
