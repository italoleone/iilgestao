
-- Commercial clients (leads) table
CREATE TABLE public.commercial_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  city text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage commercial clients" ON public.commercial_clients
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can view commercial clients" ON public.commercial_clients
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Commercial proposals table
CREATE TABLE public.commercial_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.commercial_clients(id) ON DELETE RESTRICT,
  project_name text NOT NULL,
  area_m2 numeric NOT NULL,
  disciplines jsonb NOT NULL DEFAULT '{}',
  total_value numeric NOT NULL DEFAULT 0,
  proposal_date date NOT NULL DEFAULT CURRENT_DATE,
  responsible_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'em_elaboracao',
  notes text,
  linked_project_id uuid REFERENCES public.projects(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage proposals" ON public.commercial_proposals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can view proposals" ON public.commercial_proposals
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
