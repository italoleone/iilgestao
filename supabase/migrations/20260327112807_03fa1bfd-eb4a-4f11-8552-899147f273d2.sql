
-- Add unique constraint on active_timers to enforce 1 timer per user at DB level
ALTER TABLE public.active_timers ADD CONSTRAINT active_timers_user_id_unique UNIQUE (user_id);

-- Atomic function: Start a timer (stops any existing timer for the user first, saving its time entry)
CREATE OR REPLACE FUNCTION public.fn_start_timer(
  _task_id uuid,
  _project_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_name text;
  _existing_timer record;
  _duration_minutes integer;
  _hours_worked numeric;
  _now timestamptz := now();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user name
  SELECT name INTO _user_name FROM public.profiles WHERE id = _user_id;

  -- Check if user already has an active timer
  SELECT * INTO _existing_timer FROM public.active_timers WHERE user_id = _user_id;

  IF _existing_timer IS NOT NULL THEN
    -- Auto-stop the existing timer: save time entry
    _duration_minutes := GREATEST(1, EXTRACT(EPOCH FROM (_now - _existing_timer.started_at))::integer / 60);
    _hours_worked := ROUND((EXTRACT(EPOCH FROM (_now - _existing_timer.started_at)) / 3600)::numeric, 2);

    INSERT INTO public.time_entries (task_id, project_id, user_id, user_name, date, start_time, end_time, duration_minutes)
    VALUES (
      _existing_timer.task_id,
      _existing_timer.project_id,
      _user_id,
      COALESCE(_user_name, ''),
      (_now AT TIME ZONE 'America/Sao_Paulo')::date,
      to_char(_existing_timer.started_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
      to_char(_now AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
      _duration_minutes
    );

    -- Update hours on the previous task
    UPDATE public.tasks
    SET hours_worked = ROUND(hours_worked + _hours_worked, 2)
    WHERE id = _existing_timer.task_id;

    -- Delete the old timer
    DELETE FROM public.active_timers WHERE id = _existing_timer.id;
  END IF;

  -- Insert new timer
  INSERT INTO public.active_timers (task_id, project_id, user_id, user_name, started_at)
  VALUES (_task_id, _project_id, _user_id, COALESCE(_user_name, ''), _now);

  -- Update task status to em_andamento if needed
  UPDATE public.tasks
  SET status = 'em_andamento'
  WHERE id = _task_id AND status IN ('nao_iniciada', 'reprovada');
END;
$$;

-- Atomic function: Stop the current user's timer
CREATE OR REPLACE FUNCTION public.fn_stop_timer()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_name text;
  _timer record;
  _duration_minutes integer;
  _hours_worked numeric;
  _now timestamptz := now();
  _new_hours numeric;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the active timer
  SELECT * INTO _timer FROM public.active_timers WHERE user_id = _user_id;

  IF _timer IS NULL THEN
    RETURN jsonb_build_object('stopped', false, 'reason', 'no_active_timer');
  END IF;

  -- Get user name
  SELECT name INTO _user_name FROM public.profiles WHERE id = _user_id;

  -- Calculate duration from backend timestamps (single source of truth)
  _duration_minutes := GREATEST(1, EXTRACT(EPOCH FROM (_now - _timer.started_at))::integer / 60);
  _hours_worked := ROUND((EXTRACT(EPOCH FROM (_now - _timer.started_at)) / 3600)::numeric, 2);

  -- Insert time entry
  INSERT INTO public.time_entries (task_id, project_id, user_id, user_name, date, start_time, end_time, duration_minutes)
  VALUES (
    _timer.task_id,
    _timer.project_id,
    _user_id,
    COALESCE(_user_name, ''),
    (_now AT TIME ZONE 'America/Sao_Paulo')::date,
    to_char(_timer.started_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
    to_char(_now AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
    _duration_minutes
  );

  -- Update task hours (atomic read+write)
  UPDATE public.tasks
  SET hours_worked = ROUND(hours_worked + _hours_worked, 2)
  WHERE id = _timer.task_id
  RETURNING hours_worked INTO _new_hours;

  -- Delete the timer
  DELETE FROM public.active_timers WHERE id = _timer.id;

  RETURN jsonb_build_object(
    'stopped', true,
    'task_id', _timer.task_id,
    'duration_minutes', _duration_minutes,
    'new_hours_worked', _new_hours
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.fn_start_timer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_stop_timer() TO authenticated;
