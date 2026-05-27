-- 1. Create financial table
CREATE TABLE public.project_financials (
  project_id UUID PRIMARY KEY,
  sale_value NUMERIC NOT NULL DEFAULT 0,
  hours_sold NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Migrate existing data from projects
INSERT INTO public.project_financials (project_id, sale_value, hours_sold)
SELECT id, COALESCE(sale_value, 0), COALESCE(hours_sold, 0) FROM public.projects;

-- 3. Drop financial columns from projects
ALTER TABLE public.projects DROP COLUMN sale_value;
ALTER TABLE public.projects DROP COLUMN hours_sold;

-- 4. Grants (auth-only table, no anon access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_financials TO authenticated;
GRANT ALL ON public.project_financials TO service_role;

-- 5. RLS
ALTER TABLE public.project_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financial roles can view project financials"
ON public.project_financials FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin_geral'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planejamento'::app_role)
);

CREATE POLICY "Financial roles can insert project financials"
ON public.project_financials FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin_geral'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planejamento'::app_role)
);

CREATE POLICY "Financial roles can update project financials"
ON public.project_financials FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin_geral'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planejamento'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin_geral'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planejamento'::app_role)
);

CREATE POLICY "Financial roles can delete project financials"
ON public.project_financials FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin_geral'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planejamento'::app_role)
);

-- 6. Auto-create financial row when a new project is inserted
CREATE OR REPLACE FUNCTION public.fn_create_project_financial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_financials (project_id, sale_value, hours_sold)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (project_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_project_financial
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.fn_create_project_financial();

-- 7. Cascade delete: remove financial row when project is deleted
CREATE OR REPLACE FUNCTION public.fn_delete_project_financial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.project_financials WHERE project_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_delete_project_financial
AFTER DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.fn_delete_project_financial();

-- 8. updated_at trigger on project_financials
CREATE TRIGGER trg_project_financials_updated_at
BEFORE UPDATE ON public.project_financials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();