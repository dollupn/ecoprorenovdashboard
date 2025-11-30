-- Add new columns to product_kwh_cumac for "État du bâtiment" (Neuf/Existant)
ALTER TABLE product_kwh_cumac
ADD COLUMN kwh_cumac_neuf_lt_400 numeric,
ADD COLUMN kwh_cumac_neuf_gte_400 numeric;

-- Rename existing columns for clarity
ALTER TABLE product_kwh_cumac
RENAME COLUMN kwh_cumac_lt_400 TO kwh_cumac_existant_lt_400;

ALTER TABLE product_kwh_cumac
RENAME COLUMN kwh_cumac_gte_400 TO kwh_cumac_existant_gte_400;

-- Copy existing "Existant" values to "Neuf" columns (user will manually update differences later)
UPDATE product_kwh_cumac
SET kwh_cumac_neuf_lt_400 = kwh_cumac_existant_lt_400,
    kwh_cumac_neuf_gte_400 = kwh_cumac_existant_gte_400;

-- Add building_state column to projects table
ALTER TABLE projects
ADD COLUMN building_state text NOT NULL DEFAULT 'existant';

-- Add check constraint for building_state
ALTER TABLE projects
ADD CONSTRAINT projects_building_state_check 
CHECK (building_state IN ('neuf', 'existant'));

-- Add building_state column to leads table (for lead conversion)
ALTER TABLE leads
ADD COLUMN building_state text DEFAULT 'existant';