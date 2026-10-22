CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['active_timers','bonus_config','bonus_salary','clients','commercial_clients','commercial_proposals','coordenador_projetistas','demands','meetings','payables','pdf_annotations','project_billing_schedule','project_financials','projects','proposal_billing_schedule','receivables','schedule_allocations','task_attachments','task_comments','task_review_comments','tasks','time_entries']
  LOOP
    EXECUTE format('CREATE POLICY "Somente usuarios ativos" ON public.%I AS RESTRICTIVE FOR ALL TO public USING ((select public.is_active_user())) WITH CHECK ((select public.is_active_user()))', t);
  END LOOP;
END $$;

CREATE POLICY "Somente usuarios ativos - select" ON public.profiles AS RESTRICTIVE FOR SELECT TO public
  USING ((select public.is_active_user()) OR id = auth.uid());
CREATE POLICY "Somente usuarios ativos - insert" ON public.profiles AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK ((select public.is_active_user()));
CREATE POLICY "Somente usuarios ativos - update" ON public.profiles AS RESTRICTIVE FOR UPDATE TO public
  USING ((select public.is_active_user())) WITH CHECK ((select public.is_active_user()));
CREATE POLICY "Somente usuarios ativos - delete" ON public.profiles AS RESTRICTIVE FOR DELETE TO public
  USING ((select public.is_active_user()));

CREATE POLICY "Somente usuarios ativos - select" ON public.user_roles AS RESTRICTIVE FOR SELECT TO public
  USING ((select public.is_active_user()) OR user_id = auth.uid());
CREATE POLICY "Somente usuarios ativos - insert" ON public.user_roles AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK ((select public.is_active_user()));
CREATE POLICY "Somente usuarios ativos - update" ON public.user_roles AS RESTRICTIVE FOR UPDATE TO public
  USING ((select public.is_active_user())) WITH CHECK ((select public.is_active_user()));
CREATE POLICY "Somente usuarios ativos - delete" ON public.user_roles AS RESTRICTIVE FOR DELETE TO public
  USING ((select public.is_active_user()));

CREATE POLICY "Somente usuarios ativos" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING ((select public.is_active_user())) WITH CHECK ((select public.is_active_user()));

CREATE OR REPLACE FUNCTION public.fn_profiles_guard_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated'
     AND NOT public.has_role(auth.uid(), 'admin_geral')
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.cost_per_hour IS DISTINCT FROM OLD.cost_per_hour
       OR NEW.is_coordenador IS DISTINCT FROM OLD.is_coordenador THEN
      RAISE EXCEPTION 'Somente administradores podem alterar este campo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_profiles_guard_admin_fields BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_profiles_guard_admin_fields();

CREATE OR REPLACE FUNCTION public.fn_stop_timer_for_user(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_name text;
  _timer record;
  _duration_minutes integer;
  _hours_worked numeric;
  _now timestamptz := now();
BEGIN
  SELECT * INTO _timer FROM public.active_timers WHERE user_id = _user_id;
  IF _timer IS NULL THEN RETURN; END IF;

  SELECT name INTO _user_name FROM public.profiles WHERE id = _user_id;

  _duration_minutes := GREATEST(1, EXTRACT(EPOCH FROM (_now - _timer.started_at))::integer / 60);
  _hours_worked := ROUND((EXTRACT(EPOCH FROM (_now - _timer.started_at)) / 3600)::numeric, 2);

  INSERT INTO public.time_entries (task_id, project_id, user_id, user_name, date, start_time, end_time, duration_minutes)
  VALUES (
    _timer.task_id, _timer.project_id, _user_id, COALESCE(_user_name, ''),
    (_now AT TIME ZONE 'America/Sao_Paulo')::date,
    to_char(_timer.started_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
    to_char(_now AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
    _duration_minutes
  );

  UPDATE public.tasks
  SET hours_worked = ROUND(hours_worked + _hours_worked, 2),
      status = CASE WHEN status = 'em_andamento' THEN 'pausada' ELSE status END
  WHERE id = _timer.task_id;

  DELETE FROM public.active_timers WHERE id = _timer.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_stop_timer_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_stop_timer_for_user(uuid) TO service_role;