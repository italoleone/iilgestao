ALTER TABLE public.agent_followups DROP CONSTRAINT agent_followups_status_check;
ALTER TABLE public.agent_followups ADD CONSTRAINT agent_followups_status_check CHECK (status = ANY (ARRAY['aguardando_resposta','resposta_recebida','aguardando_aprovacao','aguardando_coordenador','aguardando_planejamento','resolvido','sem_resposta','cancelado']));
ALTER TABLE public.agent_followups
  ADD COLUMN coordinator_decision text NULL,
  ADD COLUMN coordinator_decided_by uuid NULL REFERENCES public.profiles(id),
  ADD COLUMN coordinator_decided_at timestamptz NULL,
  ADD COLUMN planning_decision text NULL,
  ADD COLUMN planning_decided_by uuid NULL REFERENCES public.profiles(id),
  ADD COLUMN planning_decided_at timestamptz NULL,
  ADD COLUMN approval_reminders integer NOT NULL DEFAULT 0,
  ADD COLUMN approval_last_reminder_at timestamptz NULL;
ALTER TABLE public.agent_followups ADD CONSTRAINT agent_followups_coord_decision_check CHECK (coordinator_decision IS NULL OR coordinator_decision IN ('aprovado','recusado','simulado'));
ALTER TABLE public.agent_followups ADD CONSTRAINT agent_followups_planning_decision_check CHECK (planning_decision IS NULL OR planning_decision IN ('aprovado','recusado','simulado'));
ALTER TABLE public.agent_settings ADD COLUMN planning_approver_id uuid NULL REFERENCES public.profiles(id);
UPDATE public.agent_settings SET planning_approver_id = 'c7c960ed-01d5-4c54-bc0f-c398039846cb' WHERE id = 1 AND planning_approver_id IS NULL;
COMMENT ON COLUMN public.agent_settings.auto_limit_business_days IS 'DEPRECATED: every new date now needs coordinator and planning approval';