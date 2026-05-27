-- project_billing_schedule: restrict SELECT to financial roles
DROP POLICY IF EXISTS "Authenticated can view billing schedule" ON public.project_billing_schedule;

CREATE POLICY "Financial roles can view billing schedule"
ON public.project_billing_schedule
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin_geral'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planejamento'::app_role)
);

-- proposal_billing_schedule: restrict SELECT to financial roles
DROP POLICY IF EXISTS "Autenticados podem visualizar cronograma" ON public.proposal_billing_schedule;

CREATE POLICY "Financial roles can view proposal billing schedule"
ON public.proposal_billing_schedule
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin_geral'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'planejamento'::app_role)
);