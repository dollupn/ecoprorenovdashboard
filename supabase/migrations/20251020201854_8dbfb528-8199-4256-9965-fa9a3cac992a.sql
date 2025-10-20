-- Delete all test data from leads table
DELETE FROM public.leads;

-- Delete all test data from projects table
DELETE FROM public.projects;

-- Delete all test data from quotes table (related to projects)
DELETE FROM public.quotes;

-- Delete all test data from invoices table (related to projects)
DELETE FROM public.invoices;

-- Delete all test data from sites table (related to projects)
DELETE FROM public.sites;

-- Delete all test data from project_products table (related to projects)
DELETE FROM public.project_products;