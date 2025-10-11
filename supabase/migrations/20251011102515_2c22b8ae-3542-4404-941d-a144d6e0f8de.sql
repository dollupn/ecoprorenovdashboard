-- Créer le profil manquant pour Test User
INSERT INTO public.profiles (user_id, full_name, created_at, updated_at)
VALUES (
  'b3fca1aa-de5d-44e0-b7c5-7b8ca079e3b1'::uuid,
  'Test User',
  now(),
  now()
)
ON CONFLICT (user_id) DO NOTHING;