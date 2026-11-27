CREATE TABLE public.project_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  invoice_group text,
  invoice_number text,
  has_invoice boolean NOT NULL DEFAULT true,
  description text NOT NULL,
  gross_amount numeric(14,2) NOT NULL,
  net_amount numeric(14,2),
  split_pct numeric(6,3),
  issue_date date,
  due_date date,
  paid_date date,
  payment_method text CHECK (payment_method IN ('boleto','transferencia','outro')),
  status text NOT NULL CHECK (status IN ('pago','em_aberto','previsto','cancelado')),
  needs_review boolean NOT NULL DEFAULT false,
  review_note text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','planilha_nf_2026')),
  source_ref text,
  contact text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_receipts TO authenticated;
GRANT ALL ON public.project_receipts TO service_role;
ALTER TABLE public.project_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recebimentos: ler (diretor/gerente)" ON public.project_receipts FOR SELECT TO authenticated
  USING ((select public.has_role((select auth.uid()),'admin_geral')) OR (select public.has_role((select auth.uid()),'admin')));
CREATE POLICY "Recebimentos: inserir (diretor/gerente)" ON public.project_receipts FOR INSERT TO authenticated
  WITH CHECK ((select public.has_role((select auth.uid()),'admin_geral')) OR (select public.has_role((select auth.uid()),'admin')));
CREATE POLICY "Recebimentos: editar (diretor/gerente)" ON public.project_receipts FOR UPDATE TO authenticated
  USING ((select public.has_role((select auth.uid()),'admin_geral')) OR (select public.has_role((select auth.uid()),'admin')))
  WITH CHECK ((select public.has_role((select auth.uid()),'admin_geral')) OR (select public.has_role((select auth.uid()),'admin')));
CREATE POLICY "Recebimentos: excluir (diretor/gerente)" ON public.project_receipts FOR DELETE TO authenticated
  USING ((select public.has_role((select auth.uid()),'admin_geral')) OR (select public.has_role((select auth.uid()),'admin')));
CREATE INDEX idx_project_receipts_project ON public.project_receipts(project_id);
CREATE INDEX idx_project_receipts_paid_date ON public.project_receipts(paid_date);
CREATE INDEX idx_project_receipts_status ON public.project_receipts(status);
CREATE INDEX idx_project_receipts_invoice_group ON public.project_receipts(invoice_group);
CREATE TRIGGER trg_project_receipts_updated_at BEFORE UPDATE ON public.project_receipts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON public.project_receipts FOR EACH ROW EXECUTE FUNCTION public.fn_audit();

CREATE VIEW public.project_receipt_totals WITH (security_invoker = true) AS
WITH r AS (
  SELECT project_id,
    coalesce(sum(gross_amount) FILTER (WHERE status='pago'),0) AS recebido_bruto,
    coalesce(sum(net_amount) FILTER (WHERE status='pago'),0) AS recebido_liquido,
    coalesce(sum(gross_amount) FILTER (WHERE status='em_aberto'),0) AS em_aberto,
    coalesce(sum(gross_amount) FILTER (WHERE status='em_aberto' AND due_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date),0) AS vencido,
    coalesce(sum(gross_amount) FILTER (WHERE status='previsto'),0) AS previsto
  FROM public.project_receipts GROUP BY project_id
)
SELECT coalesce(r.project_id, f.project_id) AS project_id,
  f.sale_value,
  coalesce(r.recebido_bruto,0) AS recebido_bruto,
  coalesce(r.recebido_liquido,0) AS recebido_liquido,
  coalesce(r.em_aberto,0) AS em_aberto,
  coalesce(r.vencido,0) AS vencido,
  coalesce(r.previsto,0) AS previsto,
  coalesce(f.sale_value,0) - coalesce(r.recebido_bruto,0) AS saldo_a_receber,
  (f.sale_value IS NULL OR f.sale_value = 0) AS sem_valor_venda
FROM r FULL JOIN public.project_financials f ON f.project_id = r.project_id;
GRANT SELECT ON public.project_receipt_totals TO authenticated, service_role;