ALTER TABLE public.coordenador_projetistas ADD COLUMN projetista_nome text;

UPDATE public.coordenador_projetistas cp
SET projetista_nome = p.name
FROM public.profiles p
WHERE p.id = cp.projetista_id;

DELETE FROM public.coordenador_projetistas WHERE projetista_nome IS NULL;

ALTER TABLE public.coordenador_projetistas ALTER COLUMN projetista_nome SET NOT NULL;

ALTER TABLE public.coordenador_projetistas DROP COLUMN projetista_id CASCADE;

ALTER TABLE public.coordenador_projetistas ADD CONSTRAINT coordenador_projetistas_nome_unique UNIQUE (coordenador_id, projetista_nome);

ALTER TABLE public.demands ADD COLUMN kanban_assignee_nome text;