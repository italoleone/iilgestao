CREATE POLICY "Coordenador can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordenador'::app_role));