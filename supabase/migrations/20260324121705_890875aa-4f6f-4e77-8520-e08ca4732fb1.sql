
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-projetista can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'admin_geral'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'planejamento'::app_role)
);

-- Seed existing clients from mock data
INSERT INTO public.clients (name) VALUES 
  ('Construtora Horizonte'),
  ('Incorporadora Sol'),
  ('Grupo Atlântica'),
  ('Indústrias Progresso'),
  ('Governo do Estado'),
  ('Prefeitura Municipal'),
  ('Construtora Onda')
ON CONFLICT (name) DO NOTHING;
