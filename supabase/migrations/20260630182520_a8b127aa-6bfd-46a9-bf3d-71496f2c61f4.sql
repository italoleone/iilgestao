CREATE TYPE public.demand_type AS ENUM ('estrutura', 'alvenaria_estrutural', 'hidraulica', 'eletrica');

ALTER TABLE public.demands ADD COLUMN demand_type public.demand_type NOT NULL DEFAULT 'estrutura';
ALTER TABLE public.demands ALTER COLUMN demand_type DROP DEFAULT;
ALTER TABLE public.demands ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.fn_demands_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_demands_updated_at
BEFORE UPDATE ON public.demands
FOR EACH ROW
EXECUTE FUNCTION public.fn_demands_set_updated_at();