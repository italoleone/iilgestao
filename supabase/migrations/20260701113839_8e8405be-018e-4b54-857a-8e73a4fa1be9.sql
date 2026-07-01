DROP POLICY IF EXISTS "Apenas o criador pode atualizar sua demanda" ON public.demands;
CREATE POLICY "Criador e admins podem atualizar demandas"
  ON public.demands FOR UPDATE
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin_geral')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'planejamento')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin_geral')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'planejamento')
  );