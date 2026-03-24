
-- Table to track active Play sessions for real-time visibility
CREATE TABLE public.active_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.active_timers ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can see active timers
CREATE POLICY "Authenticated can view active timers"
  ON public.active_timers FOR SELECT TO authenticated
  USING (true);

-- Users can insert their own timer
CREATE POLICY "Users can insert own timer"
  ON public.active_timers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own timer
CREATE POLICY "Users can delete own timer"
  ON public.active_timers FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_timers;
