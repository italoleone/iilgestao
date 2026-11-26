ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS source_message_id uuid NULL;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS demand_id uuid NULL REFERENCES public.demands(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_demand_id ON public.chat_messages(demand_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_pedido_concluido ON public.chat_messages(demand_id) WHERE kind = 'pedido_concluido';
CREATE INDEX IF NOT EXISTS idx_demands_chat_daily ON public.demands(assigned_to, created_at) WHERE source = 'chat';

-- Only the service role (edge function) may mark origin or link messages to demands.
CREATE OR REPLACE FUNCTION public.fn_demands_source_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.source := 'manual'; NEW.source_message_id := NULL;
    ELSIF NEW.source IS DISTINCT FROM OLD.source OR NEW.source_message_id IS DISTINCT FROM OLD.source_message_id THEN
      RAISE EXCEPTION 'A origem da demanda não pode ser alterada';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_demands_source_guard BEFORE INSERT OR UPDATE ON public.demands
FOR EACH ROW EXECUTE FUNCTION public.fn_demands_source_guard();

CREATE OR REPLACE FUNCTION public.fn_chat_demand_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_user = 'authenticated' THEN NEW.demand_id := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_chat_demand_guard BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.fn_chat_demand_guard();

CREATE OR REPLACE FUNCTION public.fn_demands_pedido_concluido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE who text; proj record; descr text;
BEGIN
  IF NEW.source = 'chat' AND NEW.is_done = true AND COALESCE(OLD.is_done, false) = false THEN
    SELECT name INTO who FROM profiles WHERE id = COALESCE(auth.uid(), NEW.assigned_to);
    SELECT id, name INTO proj FROM projects WHERE id = NEW.project_id;
    descr := regexp_replace(NEW.description, '^\[Pedido via chat\]\s*', '');
    INSERT INTO chat_messages (user_id, sender, kind, body, demand_id)
    VALUES (NEW.created_by, 'agente', 'pedido_concluido',
      '✅ ' || COALESCE(who, 'Alguém') || ' concluiu seu pedido sobre @[p:' || proj.id || '|' || replace(replace(COALESCE(proj.name, ''), '|', ' '), ']', ' ') || ']:' || chr(10) || descr,
      NEW.id)
    ON CONFLICT (demand_id) WHERE kind = 'pedido_concluido' DO NOTHING;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_demands_pedido_concluido AFTER UPDATE OF is_done ON public.demands
FOR EACH ROW EXECUTE FUNCTION public.fn_demands_pedido_concluido();