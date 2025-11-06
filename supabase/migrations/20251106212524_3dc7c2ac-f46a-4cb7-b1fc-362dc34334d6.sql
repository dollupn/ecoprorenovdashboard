-- Add commission per LED fields for Éclairage projects
ALTER TABLE sites 
ADD COLUMN commission_eur_per_led numeric,
ADD COLUMN commission_eur_per_led_enabled boolean DEFAULT false;

COMMENT ON COLUMN sites.commission_eur_per_led IS 'Commission commerciale par LED installé (pour projets Éclairage)';
COMMENT ON COLUMN sites.commission_eur_per_led_enabled IS 'Indique si la commission par LED est activée';