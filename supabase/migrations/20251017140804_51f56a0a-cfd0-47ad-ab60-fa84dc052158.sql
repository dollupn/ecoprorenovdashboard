-- Add first_name and last_name columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Add client_first_name and client_last_name to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS client_first_name TEXT,
ADD COLUMN IF NOT EXISTS client_last_name TEXT;

-- Add client_first_name and client_last_name to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS client_first_name TEXT,
ADD COLUMN IF NOT EXISTS client_last_name TEXT;

-- Add client_first_name and client_last_name to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS client_first_name TEXT,
ADD COLUMN IF NOT EXISTS client_last_name TEXT;

-- Add client_first_name and client_last_name to sites table
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS client_first_name TEXT,
ADD COLUMN IF NOT EXISTS client_last_name TEXT;

-- Migrate existing data in leads from full_name
UPDATE public.leads
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
WHERE first_name IS NULL AND full_name IS NOT NULL AND full_name != '';

-- Migrate existing data in projects from client_name
UPDATE public.projects
SET 
  client_first_name = SPLIT_PART(client_name, ' ', 1),
  client_last_name = SUBSTRING(client_name FROM POSITION(' ' IN client_name) + 1)
WHERE client_first_name IS NULL AND client_name IS NOT NULL AND client_name != '';

-- Migrate existing data in quotes from client_name
UPDATE public.quotes
SET 
  client_first_name = SPLIT_PART(client_name, ' ', 1),
  client_last_name = SUBSTRING(client_name FROM POSITION(' ' IN client_name) + 1)
WHERE client_first_name IS NULL AND client_name IS NOT NULL AND client_name != '';

-- Migrate existing data in invoices from client_name
UPDATE public.invoices
SET 
  client_first_name = SPLIT_PART(client_name, ' ', 1),
  client_last_name = SUBSTRING(client_name FROM POSITION(' ' IN client_name) + 1)
WHERE client_first_name IS NULL AND client_name IS NOT NULL AND client_name != '';

-- Migrate existing data in sites from client_name
UPDATE public.sites
SET 
  client_first_name = SPLIT_PART(client_name, ' ', 1),
  client_last_name = SUBSTRING(client_name FROM POSITION(' ' IN client_name) + 1)
WHERE client_first_name IS NULL AND client_name IS NOT NULL AND client_name != '';