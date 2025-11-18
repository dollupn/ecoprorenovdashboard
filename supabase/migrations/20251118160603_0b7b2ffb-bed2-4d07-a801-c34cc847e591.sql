-- Create trigger function to auto-fill date_fin when status changes to TERMINE
CREATE OR REPLACE FUNCTION auto_set_site_date_fin()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changing to TERMINE and date_fin is NULL, set it to today
  IF NEW.status = 'TERMINE' AND NEW.date_fin IS NULL THEN
    NEW.date_fin = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on sites table
DROP TRIGGER IF EXISTS trigger_auto_set_site_date_fin ON sites;
CREATE TRIGGER trigger_auto_set_site_date_fin
  BEFORE INSERT OR UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_site_date_fin();