-- Drop the old check constraint FIRST
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- Now safely update any invalid status values
UPDATE public.leads 
SET status = 'À rappeler'
WHERE status IS NULL OR status = '' OR status NOT IN (
  'NEW', 'QUALIFIED', 'RDV_PLANIFIE', 'CONVERTED', 'ARCHIVED',
  'Non éligible', 'À rappeler', 'Phoning', 'À recontacter', 'Programmer pré-visite', 'Éligible'
);

-- Update existing data to match new French status values
UPDATE public.leads 
SET status = CASE 
  WHEN status = 'NEW' THEN 'À rappeler'
  WHEN status = 'QUALIFIED' THEN 'Éligible'
  WHEN status = 'RDV_PLANIFIE' THEN 'Programmer pré-visite'
  WHEN status = 'CONVERTED' THEN 'Éligible'
  WHEN status = 'ARCHIVED' THEN 'Non éligible'
  ELSE status
END
WHERE status IN ('NEW', 'QUALIFIED', 'RDV_PLANIFIE', 'CONVERTED', 'ARCHIVED');

-- Add new check constraint with French status values
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check 
CHECK (status = ANY (ARRAY[
  'Non éligible'::text,
  'À rappeler'::text,
  'Phoning'::text,
  'À recontacter'::text,
  'Programmer pré-visite'::text,
  'Éligible'::text
]));