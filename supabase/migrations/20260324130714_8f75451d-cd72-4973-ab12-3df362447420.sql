
-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  discipline TEXT NOT NULL,
  start_date DATE NOT NULL,
  deadline DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  responsible UUID NOT NULL,
  team UUID[] NOT NULL DEFAULT '{}',
  hours_sold NUMERIC NOT NULL DEFAULT 0,
  sale_value NUMERIC NOT NULL DEFAULT 0,
  hours_worked NUMERIC NOT NULL DEFAULT 0,
  stages JSONB NOT NULL DEFAULT '[]',
  revisions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view projects (projetista filtering done in app)
CREATE POLICY "Authenticated users can view projects" ON public.projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Non-projetista can insert projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin_geral'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planejamento'::app_role)
  );

CREATE POLICY "Non-projetista can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin_geral'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planejamento'::app_role)
  );

CREATE POLICY "Admins can delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin_geral'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  discipline TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  responsible UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  estimated_hours NUMERIC NOT NULL DEFAULT 0,
  hours_worked NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'nao_iniciada',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tasks" ON public.tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Non-projetista can insert tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin_geral'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'planejamento'::app_role)
  );

CREATE POLICY "Authenticated can update tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin_geral'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Time entries table
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view time entries" ON public.time_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own time entries" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own time entries" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
