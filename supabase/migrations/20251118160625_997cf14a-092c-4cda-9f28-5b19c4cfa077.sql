-- Fix security warning: Set search_path for the trigger function
CREATE OR REPLACE FUNCTION auto_set_site_date_fin()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changing to TERMINE and date_fin is NULL, set it to today
  IF NEW.status = 'TERMINE' AND NEW.date_fin IS NULL THEN
    NEW.date_fin = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;