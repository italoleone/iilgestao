DROP POLICY IF EXISTS "Criador e admins podem atualizar demandas" ON public.demands;
DROP POLICY IF EXISTS "Apenas o criador pode excluir sua demanda" ON public.demands;

CREATE POLICY "Usuarios autenticados podem atualizar demandas"
ON public.demands FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem excluir demandas"
ON public.demands FOR DELETE TO authenticated
USING (true);