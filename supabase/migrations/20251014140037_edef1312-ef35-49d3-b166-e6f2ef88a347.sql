-- Add extra_fields column to leads table for storing custom data
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}'::jsonb;