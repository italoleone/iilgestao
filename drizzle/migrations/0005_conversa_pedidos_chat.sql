CREATE TABLE public.demand_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'comentario' CHECK (kind IN ('comentario','ja_feito','concluido','reaberto')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.demand_comments TO authenticated;
GRANT ALL ON public.demand_comments TO service_role;
ALTER TABLE public.demand_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ativos leem conversa das demandas visiveis" ON public.demand_comments FOR SELECT TO authenticated
USING ((select public.is_active_user()) AND EXISTS (SELECT 1 FROM public.demands d WHERE d.id = demand_id));
CREATE INDEX demand_comments_demand_created_idx ON public.demand_comments(demand_id, created_at, id);
CREATE INDEX demand_comments_author_idx ON public.demand_comments(author_id);
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON public.demand_comments FOR EACH ROW EXECUTE FUNCTION public.fn_audit();

CREATE OR REPLACE FUNCTION public.fn_demands_pedido_concluido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  actor uuid; who text; proj record; descr text; comment_kind text; comment_body text; comment_id uuid; project_token text;
BEGIN
  IF NEW.is_done IS NOT DISTINCT FROM OLD.is_done THEN RETURN NULL; END IF;
  actor := COALESCE(auth.uid(), NULLIF(current_setting('app.pedido_actor', true), '')::uuid, NEW.assigned_to, NEW.created_by);
  IF NEW.is_done THEN
    comment_kind := CASE WHEN current_setting('app.pedido_kind', true) = 'ja_feito' THEN 'ja_feito' ELSE 'concluido' END;
    comment_body := CASE WHEN comment_kind = 'ja_feito' THEN 'Já estava feito' ELSE 'Concluído' END;
  ELSE
    comment_kind := 'reaberto'; comment_body := 'Reaberto';
  END IF;
  INSERT INTO public.demand_comments(demand_id, author_id, body, kind)
  VALUES(NEW.id, actor, comment_body, comment_kind) RETURNING id INTO comment_id;
  IF NEW.source = 'chat' AND NEW.is_done THEN
    SELECT name INTO who FROM public.profiles WHERE id = actor;
    SELECT id, name INTO proj FROM public.projects WHERE id = NEW.project_id;
    project_token := '@[p:' || proj.id || '|' || replace(replace(COALESCE(proj.name, ''), '|', ' '), ']', ' ') || ']';
    descr := regexp_replace(NEW.description, '^\[Pedido via chat\]\s*', '');
    INSERT INTO public.chat_messages(id, user_id, sender, kind, body, demand_id, actions)
    VALUES(comment_id, NEW.created_by, 'agente', 'pedido',
      CASE WHEN comment_kind = 'ja_feito'
        THEN '✅ ' || COALESCE(who, 'Alguém') || ' informou que o pedido sobre ' || project_token || ' já estava feito.'
        ELSE '✅ ' || COALESCE(who, 'Alguém') || ' concluiu seu pedido sobre ' || project_token || ':' || chr(10) || descr END,
      NEW.id, '[{"id":"responder_pedido","label":"Responder"}]'::jsonb);
  END IF;
  RETURN NULL;
END $function$;

CREATE FUNCTION public.fn_finish_chat_pedido(_demand_id uuid, _actor uuid, _kind text)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE d public.demands;
BEGIN
  IF _kind NOT IN ('concluido','ja_feito') THEN RAISE EXCEPTION 'Tipo de conclusão inválido'; END IF;
  SELECT * INTO d FROM public.demands WHERE id = _demand_id FOR UPDATE;
  IF NOT FOUND OR d.source <> 'chat' THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF d.assigned_to IS DISTINCT FROM _actor OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _actor AND status = 'active') THEN
    RAISE EXCEPTION 'Somente o responsável pode concluir este pedido';
  END IF;
  IF d.is_done THEN RETURN false; END IF;
  PERFORM set_config('app.pedido_actor', _actor::text, true);
  PERFORM set_config('app.pedido_kind', _kind, true);
  UPDATE public.demands SET is_done = true, done_at = now() WHERE id = d.id;
  RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.fn_finish_chat_pedido(uuid,uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_finish_chat_pedido(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.fn_respond_chat_pedido(_demand_id uuid, _actor uuid, _body text)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE d public.demands; who text; proj record; recipient uuid; cid uuid; buttons jsonb;
BEGIN
  IF length(trim(_body)) < 1 OR length(_body) > 10000 THEN RAISE EXCEPTION 'Resposta inválida'; END IF;
  SELECT * INTO d FROM public.demands WHERE id = _demand_id FOR UPDATE;
  IF NOT FOUND OR d.source <> 'chat' THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF (_actor IS DISTINCT FROM d.created_by AND _actor IS DISTINCT FROM d.assigned_to)
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _actor AND status = 'active') THEN
    RAISE EXCEPTION 'Somente participantes podem responder a este pedido';
  END IF;
  recipient := CASE WHEN _actor = d.assigned_to THEN d.created_by ELSE d.assigned_to END;
  IF recipient IS NULL THEN RAISE EXCEPTION 'Este pedido não tem responsável'; END IF;
  SELECT name INTO who FROM public.profiles WHERE id = _actor;
  SELECT id, name INTO proj FROM public.projects WHERE id = d.project_id;
  INSERT INTO public.demand_comments(demand_id, author_id, body) VALUES(d.id, _actor, trim(_body)) RETURNING id INTO cid;
  buttons := '[{"id":"responder_pedido","label":"Responder"}]'::jsonb;
  IF recipient = d.assigned_to AND NOT d.is_done THEN
    buttons := '[{"id":"concluir_pedido","label":"Concluído"}]'::jsonb || buttons;
  END IF;
  INSERT INTO public.chat_messages(id,user_id,sender,kind,body,demand_id,actions)
  VALUES(cid,recipient,'agente','pedido','💬 ' || COALESCE(who,'Alguém') || ' respondeu sobre @[p:' || proj.id || '|' || replace(replace(COALESCE(proj.name,''),'|',' '),']',' ') || ']:' || chr(10) || trim(_body),d.id,buttons);
  INSERT INTO public.chat_messages(user_id,sender,kind,body,demand_id,processed_at)
  VALUES(_actor,'usuario','texto',trim(_body),d.id,now());
  RETURN cid;
END $function$;
REVOKE ALL ON FUNCTION public.fn_respond_chat_pedido(uuid,uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_respond_chat_pedido(uuid,uuid,text) TO service_role;

DO $block$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='demands') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.demands;
  END IF;
END $block$;