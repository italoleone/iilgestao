CREATE TABLE public.coordenador_projetistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenador_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  projetista_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coordenador_id, projetista_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coordenador_projetistas TO authenticated;
GRANT ALL ON public.coordenador_projetistas TO service_role;

ALTER TABLE public.coordenador_projetistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver equipes" ON public.coordenador_projetistas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coordenador adiciona na propria equipe" ON public.coordenador_projetistas
  FOR INSERT TO authenticated
  WITH CHECK (
    coordenador_id = auth.uid()
    OR has_role(auth.uid(), 'admin_geral'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Coordenador remove da propria equipe" ON public.coordenador_projetistas
  FOR DELETE TO authenticated
  USING (
    coordenador_id = auth.uid()
    OR has_role(auth.uid(), 'admin_geral'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );