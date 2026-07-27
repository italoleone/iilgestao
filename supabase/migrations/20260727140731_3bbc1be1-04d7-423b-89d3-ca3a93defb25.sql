DROP POLICY IF EXISTS "Criador e admins podem ver demandas" ON public.demands;
DROP POLICY IF EXISTS "Usuarios podem ver demandas" ON public.demands;

CREATE POLICY "Usuarios autenticados podem ver demandas"
ON public.demands FOR SELECT TO authenticated
USING (true);