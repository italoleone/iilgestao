CREATE TABLE public.demands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demands TO authenticated;
GRANT ALL ON public.demands TO service_role;

ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordenadores podem ver suas demandas"
ON public.demands FOR SELECT
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin_geral')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'planejamento')
);

CREATE POLICY "Coordenadores podem criar demandas"
ON public.demands FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Apenas o criador pode atualizar sua demanda"
ON public.demands FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Apenas o criador pode excluir sua demanda"
ON public.demands FOR DELETE
USING (created_by = auth.uid());