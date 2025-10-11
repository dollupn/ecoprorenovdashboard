-- Créer l'organisation principale
INSERT INTO public.organizations (id, name, created_at, updated_at)
VALUES (
  'a1b2c3d4-5678-90ab-cdef-1234567890ab'::uuid,
  'EcoProRenov',
  now(),
  now()
);

-- Assigner Rahvi Bichon comme propriétaire (owner)
INSERT INTO public.memberships (org_id, user_id, role, created_at)
VALUES (
  'a1b2c3d4-5678-90ab-cdef-1234567890ab'::uuid,
  '9595c6be-504b-4c44-90d7-22e423930208'::uuid,
  'owner'::org_role,
  now()
);

-- Assigner Emmanuel BOYER comme administrateur
INSERT INTO public.memberships (org_id, user_id, role, created_at)
VALUES (
  'a1b2c3d4-5678-90ab-cdef-1234567890ab'::uuid,
  'e2988c3c-2bb6-46c6-ac68-aca29f38ebae'::uuid,
  'admin'::org_role,
  now()
);

-- Assigner Test User comme membre
INSERT INTO public.memberships (org_id, user_id, role, created_at)
VALUES (
  'a1b2c3d4-5678-90ab-cdef-1234567890ab'::uuid,
  'b3fca1aa-de5d-44e0-b7c5-7b8ca079e3b1'::uuid,
  'member'::org_role,
  now()
);