CREATE TABLE public.schedule_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenador_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  projetista_nome text NOT NULL,
  date date NOT NULL,
  entry_type text NOT NULL DEFAULT 'trabalho' CHECK (entry_type IN ('trabalho','feriado','ferias','casual')),
  label text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coordenador_id, projetista_nome, date)
);

CREATE INDEX idx_schedule_allocations_date ON public.schedule_allocations(date);
CREATE INDEX idx_schedule_allocations_coordenador ON public.schedule_allocations(coordenador_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_allocations TO authenticated;
GRANT ALL ON public.schedule_allocations TO service_role;

ALTER TABLE public.schedule_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso de visualizacao restrito por role" ON public.schedule_allocations
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin_geral'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'planejamento'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
  );

CREATE POLICY "Insercao respeitando hierarquia" ON public.schedule_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin_geral'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'planejamento'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND coordenador_id = auth.uid())
  );

CREATE POLICY "Atualizacao respeitando hierarquia" ON public.schedule_allocations
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin_geral'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'planejamento'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND coordenador_id = auth.uid())
  );

CREATE POLICY "Exclusao respeitando hierarquia" ON public.schedule_allocations
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin_geral'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'planejamento'::app_role)
    OR (has_role(auth.uid(), 'coordenador'::app_role) AND coordenador_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.update_schedule_allocations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_schedule_allocations_updated_at
  BEFORE UPDATE ON public.schedule_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_schedule_allocations_updated_at();