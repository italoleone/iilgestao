CREATE TABLE public.project_billing_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  stage_label text NOT NULL,
  execution_month integer,
  execution_year integer,
  billing_month integer,
  billing_year integer,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pbs_project ON public.project_billing_schedule(project_id);

ALTER TABLE public.project_billing_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view billing schedule"
  ON public.project_billing_schedule FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert billing schedule"
  ON public.project_billing_schedule FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update billing schedule"
  ON public.project_billing_schedule FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete billing schedule"
  ON public.project_billing_schedule FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER trg_pbs_updated_at
  BEFORE UPDATE ON public.project_billing_schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();