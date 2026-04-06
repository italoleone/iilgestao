
CREATE TABLE public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES public.commercial_proposals(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  received_date date,
  status text NOT NULL DEFAULT 'pendente',
  category text NOT NULL DEFAULT 'servico',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage receivables" ON public.receivables
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  supplier text,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  paid_date date,
  status text NOT NULL DEFAULT 'pendente',
  category text NOT NULL DEFAULT 'outros',
  recurrent boolean NOT NULL DEFAULT false,
  recurrent_day integer,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payables" ON public.payables
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin_geral'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
