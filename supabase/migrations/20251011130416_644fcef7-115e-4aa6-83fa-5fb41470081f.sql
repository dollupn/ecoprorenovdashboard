-- Créer les profils manquants pour tous les utilisateurs de l'organisation
INSERT INTO public.profiles (user_id, full_name, created_at, updated_at)
VALUES 
  ('9595c6be-504b-4c44-90d7-22e423930208'::uuid, 'Rahvi Bichon', now(), now()),
  ('e2988c3c-2bb6-46c6-ac68-aca29f38ebae'::uuid, 'Emmanuel BOYER', now(), now())
ON CONFLICT (user_id) DO UPDATE 
SET 
  full_name = EXCLUDED.full_name,
  updated_at = now();