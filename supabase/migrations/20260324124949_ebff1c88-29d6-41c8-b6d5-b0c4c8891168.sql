-- Allow directors and managers to update user profiles during approval and user management
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin_geral'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin_geral'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);