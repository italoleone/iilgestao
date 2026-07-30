ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_coordenador boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET is_coordenador = true
WHERE email = 'italo@leoneengenharia.com.br';