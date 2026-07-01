ALTER TABLE public.demands
  ADD COLUMN priority integer,
  ADD COLUMN assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;