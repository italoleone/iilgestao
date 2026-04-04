
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-templates', 'proposal-templates', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read proposal templates"
ON storage.objects FOR SELECT
USING (bucket_id = 'proposal-templates');

CREATE POLICY "Admins can upload proposal templates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proposal-templates' AND (
    has_role(auth.uid(), 'admin_geral'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);

ALTER TABLE public.commercial_proposals
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'residencial';
