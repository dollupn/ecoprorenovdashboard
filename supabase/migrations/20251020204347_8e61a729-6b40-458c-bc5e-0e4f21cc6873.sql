-- Delete duplicate appointment types, keeping only the oldest one for each name per organization
DELETE FROM public.appointment_types a
USING public.appointment_types b
WHERE a.id > b.id 
  AND a.name = b.name 
  AND a.org_id = b.org_id 
  AND a.is_default = b.is_default;