CREATE FUNCTION public.fn_tasks_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  is_admin boolean;
  is_plan boolean;
  is_proj_coord boolean;
  is_resp boolean;
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  uid := auth.uid();
  is_admin := public.has_role(uid, 'admin_geral') OR public.has_role(uid, 'admin');
  is_plan := public.has_role(uid, 'planejamento');
  is_proj_coord := EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = OLD.project_id AND responsible = uid
  );
  is_resp := COALESCE(OLD.responsible = uid, false);

  -- 1. Approval/rejection is reserved to admins or the project responsible user.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('aprovada', 'reprovada')
     AND NOT (is_admin OR is_proj_coord) THEN
    RAISE EXCEPTION 'Somente o coordenador do projeto ou um administrador pode aprovar ou reprovar esta tarefa';
  END IF;

  -- 1b. The project responsible user may review regardless of role.
  IF is_proj_coord
     AND OLD.status = 'aguardando_validacao'
     AND NEW.status IN ('aprovada', 'reprovada')
     AND (to_jsonb(NEW) - 'status' - 'rejection_reason' - 'updated_at')
         = (to_jsonb(OLD) - 'status' - 'rejection_reason' - 'updated_at') THEN
    RETURN NEW;
  END IF;

  -- 2. Administrators and planning retain all remaining update permissions.
  IF is_admin OR is_plan THEN
    RETURN NEW;
  END IF;

  -- 3. Coordinators may manage their own projects, but not recorded hours.
  IF public.has_role(uid, 'coordenador') AND is_proj_coord THEN
    IF NEW.hours_worked IS DISTINCT FROM OLD.hours_worked THEN
      RAISE EXCEPTION 'Sem permissão para alterar esta tarefa';
    END IF;
    IF NEW.project_id IS DISTINCT FROM OLD.project_id AND NOT EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = NEW.project_id AND responsible = uid
    ) THEN
      RAISE EXCEPTION 'Sem permissão para alterar esta tarefa';
    END IF;
    RETURN NEW;
  END IF;

  -- 4. Task responsible users may only perform the specified status transitions.
  IF is_resp THEN
    IF (to_jsonb(NEW) - 'status' - 'updated_at')
       IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
      RAISE EXCEPTION 'Alteração não permitida para esta tarefa';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT COALESCE(
        (OLD.status = 'nao_iniciada' AND NEW.status = 'em_andamento') OR
        (OLD.status = 'pausada' AND NEW.status = 'em_andamento') OR
        (OLD.status = 'reprovada' AND NEW.status = 'em_andamento') OR
        (OLD.status = 'em_andamento' AND NEW.status = 'pausada') OR
        (OLD.status = 'pausada' AND NEW.status = 'aguardando_validacao') OR
        (OLD.status = 'aprovada' AND NEW.status = 'concluida') OR
        (OLD.status = 'concluida' AND NEW.status = 'enviado_cliente'),
        false
      ) THEN
        RAISE EXCEPTION 'Alteração não permitida para esta tarefa';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- 5. All other updates are rejected.
  RAISE EXCEPTION 'Sem permissão para alterar esta tarefa';
END;
$$;

CREATE TRIGGER trg_tasks_guard
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.fn_tasks_guard();

CREATE POLICY "Projetista nao insere horas diretamente"
ON public.time_entries
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (
  public.has_role(auth.uid(), 'admin_geral') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'planejamento') OR
  public.has_role(auth.uid(), 'coordenador')
);

CREATE POLICY "Projetista nao edita horas diretamente"
ON public.time_entries
AS RESTRICTIVE
FOR UPDATE
TO public
USING (
  public.has_role(auth.uid(), 'admin_geral') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'planejamento') OR
  public.has_role(auth.uid(), 'coordenador')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin_geral') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'planejamento') OR
  public.has_role(auth.uid(), 'coordenador')
);