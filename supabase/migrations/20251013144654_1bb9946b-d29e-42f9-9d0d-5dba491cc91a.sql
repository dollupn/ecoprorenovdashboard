-- Add address field to leads table
ALTER TABLE public.leads 
ADD COLUMN address text NOT NULL DEFAULT '';