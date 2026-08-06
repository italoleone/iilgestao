CREATE TEMP TABLE _team_map (
  email text PRIMARY KEY,
  role text NOT NULL,
  discipline text,
  is_coordenador boolean NOT NULL
);

INSERT INTO _team_map (email, role, discipline, is_coordenador) VALUES
  ('italo@leoneengenharia.com.br',              'admin_geral',  NULL,          false),
  ('alessandra@leoneengenharia.com.br',         'admin',        NULL,          false),
  ('rebeca@leoneengenharia.com.br',             'planejamento', NULL,          false),
  ('nilson@leoneengenharia.com.br',             'coordenador',  'estrutural',  true),
  ('crislaine@leoneengenharia.com.br',          'coordenador',  'estrutural',  true),
  ('igor@leoneengenharia.com.br',               'coordenador',  'hidraulica',  true),
  ('daniel@leoneengenharia.com.br',             'coordenador',  'hidraulica',  true),
  ('lucas@leoneengenharia.com.br',              'coordenador',  'eletrica',    true),
  ('janayna@leoneengenharia.com.br',            'projetista',   'estrutural',  false),
  ('victoria.eduarda@leoneengenharia.com.br',   'projetista',   'estrutural',  false),
  ('felipe@leoneengenharia.com.br',             'projetista',   'estrutural',  false),
  ('luca@leoneengenharia.com.br',               'projetista',   'estrutural',  false),
  ('marcelo@leoneengenharia.com.br',            'projetista',   'estrutural',  false),
  ('leticia@leoneengenharia.com.br',            'projetista',   'estrutural',  false),
  ('victoria@leoneengenharia.com.br',           'projetista',   'estrutural',  false),
  ('laiane@leoneengenharia.com.br',             'projetista',   'hidraulica',  false),
  ('victor@leoneengenharia.com.br',             'projetista',   'hidraulica',  false),
  ('pedro@leoneengenharia.com.br',              'projetista',   'hidraulica',  false),
  ('caio@leoneengenharia.com.br',               'projetista',   'hidraulica',  false),
  ('marina@leoneengenharia.com.br',             'projetista',   'hidraulica',  false),
  ('bruno@leoneengenharia.com.br',              'projetista',   'hidraulica',  false),
  ('ederalvesleone@gmail.com',                  'projetista',   'eletrica',    false),
  ('guilherme.barros@leoneengenharia.com.br',   'projetista',   'eletrica',    false),
  ('gabriel@leoneengenharia.com.br',            'projetista',   'eletrica',    false);

UPDATE public.profiles p
SET discipline = tm.discipline,
    is_coordenador = tm.is_coordenador
FROM _team_map tm
WHERE p.email = tm.email;

DELETE FROM public.user_roles ur
USING public.profiles p, _team_map tm
WHERE ur.user_id = p.id AND p.email = tm.email;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, tm.role::app_role
FROM _team_map tm
JOIN public.profiles p ON p.email = tm.email;

DELETE FROM public.coordenador_projetistas cp
USING public.profiles pc
WHERE cp.coordenador_id = pc.id
  AND pc.email IN (
    'nilson@leoneengenharia.com.br',
    'crislaine@leoneengenharia.com.br',
    'igor@leoneengenharia.com.br',
    'daniel@leoneengenharia.com.br',
    'lucas@leoneengenharia.com.br'
  );

INSERT INTO public.coordenador_projetistas (coordenador_id, projetista_nome)
SELECT (SELECT id FROM public.profiles WHERE email = 'nilson@leoneengenharia.com.br'), p.name
FROM public.profiles p
WHERE p.email IN (
  'janayna@leoneengenharia.com.br',
  'victoria.eduarda@leoneengenharia.com.br',
  'felipe@leoneengenharia.com.br',
  'luca@leoneengenharia.com.br',
  'marcelo@leoneengenharia.com.br',
  'leticia@leoneengenharia.com.br'
);

INSERT INTO public.coordenador_projetistas (coordenador_id, projetista_nome)
SELECT (SELECT id FROM public.profiles WHERE email = 'crislaine@leoneengenharia.com.br'), p.name
FROM public.profiles p
WHERE p.email = 'victoria@leoneengenharia.com.br';

INSERT INTO public.coordenador_projetistas (coordenador_id, projetista_nome)
SELECT (SELECT id FROM public.profiles WHERE email = 'igor@leoneengenharia.com.br'), p.name
FROM public.profiles p
WHERE p.email IN (
  'laiane@leoneengenharia.com.br',
  'victor@leoneengenharia.com.br',
  'pedro@leoneengenharia.com.br',
  'caio@leoneengenharia.com.br',
  'marina@leoneengenharia.com.br'
);

INSERT INTO public.coordenador_projetistas (coordenador_id, projetista_nome)
SELECT (SELECT id FROM public.profiles WHERE email = 'daniel@leoneengenharia.com.br'), p.name
FROM public.profiles p
WHERE p.email = 'bruno@leoneengenharia.com.br';

INSERT INTO public.coordenador_projetistas (coordenador_id, projetista_nome)
SELECT (SELECT id FROM public.profiles WHERE email = 'lucas@leoneengenharia.com.br'), p.name
FROM public.profiles p
WHERE p.email IN (
  'ederalvesleone@gmail.com',
  'guilherme.barros@leoneengenharia.com.br',
  'gabriel@leoneengenharia.com.br'
);

DROP TABLE _team_map;