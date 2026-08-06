DO $$
DECLARE
  _italo uuid;
BEGIN
  SELECT id INTO _italo FROM public.profiles WHERE email = 'italo@leoneengenharia.com.br';
  IF _italo IS NULL THEN
    RAISE EXCEPTION 'Diretor nao encontrado';
  END IF;

  CREATE TEMP TABLE _users_to_delete ON COMMIT DROP AS
  SELECT id, name, email FROM public.profiles
  WHERE email IN (
    'mylena@leoneengenharia.com.br',
    'pizeoeng@gmail.com',
    'joao.paulo@leoneengenharia.com.br',
    'rebecamartinsleone@gmail.com',
    'mylenagenes@leoneengenharia.com.br',
    'yasmim.eliza@leoneengenharia.com.br',
    'maria.eduarda@leoneengenharia.com.br',
    'matheus.ferris@leoneengenharia.com.br',
    'lessandra@leoneengenharia.com.br',
    'victoriadamacenoleone@gmail.com',
    'coordenacao@leoneengenharia.com.br'
  );

  -- BLOCO 2: reatribuicao por id
  UPDATE public.demands SET created_by = _italo WHERE created_by IN (SELECT id FROM _users_to_delete);
  UPDATE public.task_comments SET author_id = _italo WHERE author_id IN (SELECT id FROM _users_to_delete);
  UPDATE public.meetings SET created_by = _italo WHERE created_by IN (SELECT id FROM _users_to_delete);
  UPDATE public.payables SET created_by = _italo WHERE created_by IN (SELECT id FROM _users_to_delete);
  UPDATE public.receivables SET created_by = _italo WHERE created_by IN (SELECT id FROM _users_to_delete);
  UPDATE public.commercial_proposals SET responsible_id = _italo WHERE responsible_id IN (SELECT id FROM _users_to_delete);
  UPDATE public.commercial_proposals SET approved_by = _italo WHERE approved_by IN (SELECT id FROM _users_to_delete);
  UPDATE public.proposal_billing_schedule SET created_by = _italo WHERE created_by IN (SELECT id FROM _users_to_delete);
  UPDATE public.project_billing_schedule SET created_by = _italo WHERE created_by IN (SELECT id FROM _users_to_delete);
  UPDATE public.task_attachments SET uploaded_by = _italo WHERE uploaded_by IN (SELECT id FROM _users_to_delete);
  UPDATE public.schedule_allocations SET created_by = _italo WHERE created_by IN (SELECT id FROM _users_to_delete);
  UPDATE public.time_entries SET user_id = _italo, user_name = 'Ítalo Leone' WHERE user_id IN (SELECT id FROM _users_to_delete);
  UPDATE public.active_timers SET user_id = _italo, user_name = 'Ítalo Leone' WHERE user_id IN (SELECT id FROM _users_to_delete);
  UPDATE public.task_review_comments SET user_id = _italo, user_name = 'Ítalo Leone' WHERE user_id IN (SELECT id FROM _users_to_delete);
  UPDATE public.pdf_annotations SET user_id = _italo, user_name = 'Ítalo Leone' WHERE user_id IN (SELECT id FROM _users_to_delete);
  DELETE FROM public.bonus_salary WHERE user_id IN (SELECT id FROM _users_to_delete)
    AND EXISTS (SELECT 1 FROM public.bonus_salary b2 WHERE b2.user_id = _italo AND b2.year = bonus_salary.year);
  UPDATE public.bonus_salary SET user_id = _italo WHERE user_id IN (SELECT id FROM _users_to_delete);

  -- BLOCO 3: texto livre (apenas nomes sem colisao)
  DELETE FROM public.coordenador_projetistas
  WHERE projetista_nome IN (
    SELECT name FROM _users_to_delete
    WHERE name NOT IN ('Alessandra Mapelli', 'Victória Eduarda de Almeida Damaceno')
  );

  UPDATE public.demands SET kanban_assignee_nome = NULL
  WHERE kanban_assignee_nome IN (
    SELECT name FROM _users_to_delete
    WHERE name NOT IN ('Alessandra Mapelli', 'Victória Eduarda de Almeida Damaceno')
  );

  UPDATE public.tasks SET responsible = NULL
  WHERE responsible IN (SELECT id FROM _users_to_delete);

  UPDATE public.projects p
  SET team = array_remove(p.team, u.id)
  FROM _users_to_delete u
  WHERE u.id = ANY(p.team);

  -- BLOCO 4: exclusao definitiva
  DELETE FROM auth.users WHERE id IN (SELECT id FROM _users_to_delete);
END $$;